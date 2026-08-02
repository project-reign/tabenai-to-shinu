import { expect, test } from '@playwright/test';
import { collectBrowserProblems } from './helpers/presentation.mjs';

const DEBUG_URL = './?debug=1';
const APP_VERSION = '1.0.0-rc.1';
const STORY_ENDINGS = [
  'death', 'starve', 'ancient', 'monster_clear', 'party', 'true', 'shield',
  'salad', 'human_again', 'regeneration_loop', 'overgrowth', 'shadow_exit', 'blank', 'refuse'
];
const VIEWPORTS = [
  [320, 568], [375, 667], [390, 844], [430, 932],
  [768, 1024], [1280, 720], [1920, 1080]
];

async function openDebug(page) {
  await page.goto(DEBUG_URL);
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__ && globalThis.TabenaiSurvival));
}

test('RC1表示は版情報だけに限定し、保存schemaと正式版タイトルを維持する', async ({ page, request }) => {
  await page.goto('./');
  await expect(page).toHaveTitle(`食べないと死ぬ：50日目の晩餐 v${APP_VERSION}`);
  await expect(page.locator('.title-version')).toHaveText(`v${APP_VERSION}`);
  await expect(page.locator('#titleScreen')).not.toContainText('Release Candidate');
  await expect(page.locator('#modeHardBtn .badge')).toHaveText('PLAYABLE');
  await expect(page.locator('#modeSurvivalBtn .badge')).toHaveText('PLAYABLE');

  await page.locator('#settingsBtn').click();
  await page.locator('#settingsCreditsBtn').click();
  await expect(page.locator('#creditsScreen')).toContainText('Release Candidate 1');
  await expect(page.locator('#creditsScreen')).toContainText('完成版公開前の品質確認版');

  const worker = await (await request.get('./sw.js')).text();
  expect(worker).toContain(`const APP_VERSION = '${APP_VERSION}'`);
  expect(worker).toContain(`const CACHE_REVISION = '${APP_VERSION}'`);

  await openDebug(page);
  const contract = await page.evaluate(() => ({
    app: globalThis.__TABENAI_DEBUG__.version,
    run: globalThis.__TABENAI_DEBUG__.schemaVersion,
    transfer: globalThis.TabenaiRecords.formatVersion,
    slots: globalThis.TabenaiRecords.slotCount,
    history: globalThis.TabenaiRecords.historyLimit
  }));
  expect(contract).toEqual({ app: APP_VERSION, run: 4, transfer: 3, slots: 3, history: 30 });
});

test('STORY／HARDの44シーン・102遷移を列挙し、到達不能・循環・行き止まりを残さない', async ({ page }) => {
  await openDebug(page);
  const matrix = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    api.silent(true);
    const sceneIds = api.scenes();
    const names = Object.fromEntries(api.catalog('events')
      .filter(item => item.id.startsWith('story:'))
      .map(item => [item.id.slice(6), item.name]));
    const variantsFor = scene => {
      const variants = [{ name: 'default', patch: {} }];
      if (scene === 'finalDish') variants[0].patch.flags = { selectedPair: ['salad', 'meat'] };
      if (scene === 'finalCommit') variants[0].patch.flags = {
        selectedPair: ['salad', 'meat'], selectedAppearance: 'salad', selectedTrueDish: 'salad'
      };
      if (scene === 'shadow') {
        variants.push({ name: 'hungry', patch: { flags: { shadowHunger: true } } });
        variants.push({ name: 'bean', patch: { flags: { beanCarried: true } } });
        variants.push({ name: 'hungry-bean', patch: { flags: { shadowHunger: true, beanCarried: true } } });
      }
      if (scene === 'shadowFoodType' || scene === 'shadowRiceBread') {
        variants.push({ name: 'bean', patch: { flags: { beanCarried: true } } });
      }
      if (scene === 'collapse' || scene === 'collapseAction') {
        variants.push({ name: 'jr-egg', patch: { flags: { jrEgg: true, extraLife: true } } });
      }
      return variants;
    };
    const rows = [];
    const failures = [];
    for (const mode of ['story', 'hard']) {
      for (const scene of sceneIds) {
        for (const variant of variantsFor(scene)) {
          const base = api.fresh(0x43_00_21, mode);
          base.scene = scene;
          base.hp = 100;
          base.hunger = 0;
          if (variant.patch.flags) Object.assign(base.flags, variant.patch.flags);
          for (const choiceIndex of [0, 1]) {
            try {
              api.setState(base);
              const choices = api.choices();
              if (choices.length !== 2) failures.push(`${mode}/${scene}/${variant.name}: choices=${choices.length}`);
              const choice = choices[choiceIndex];
              const after = api.step(choiceIndex);
              rows.push({
                mode, scene, sceneName: names[scene] || scene, variant: variant.name,
                choiceIndex, choiceTitle: choice.title, choiceKind: choice.kind,
                nextScene: after.ended ? null : after.scene,
                ending: after.ending && after.ending.code || null,
                ended: after.ended
              });
              if (!after.ended && !sceneIds.includes(after.scene)) failures.push(`${mode}/${scene}: unknown=${after.scene}`);
            } catch (error) {
              failures.push(`${mode}/${scene}/${variant.name}/${choiceIndex}: ${error.message}`);
            }
          }
        }
      }
    }
    return { sceneIds, rows, failures };
  });

  expect(matrix.sceneIds).toHaveLength(44);
  expect(matrix.rows.filter(row => row.mode === 'story')).toHaveLength(102);
  expect(matrix.rows.filter(row => row.mode === 'hard')).toHaveLength(102);
  expect(matrix.failures).toEqual([]);

  for (const mode of ['story', 'hard']) {
    const edges = matrix.rows.filter(row => row.mode === mode && !row.ended && row.nextScene);
    const adjacency = new Map(matrix.sceneIds.map(scene => [scene, new Set()]));
    for (const edge of edges) adjacency.get(edge.scene).add(edge.nextScene);
    const reached = new Set(['riceball']);
    const queue = ['riceball'];
    while (queue.length) {
      const current = queue.shift();
      for (const next of adjacency.get(current) || []) {
        if (!reached.has(next)) { reached.add(next); queue.push(next); }
      }
    }
    expect([...matrix.sceneIds].filter(scene => !reached.has(scene))).toEqual([]);
    expect(matrix.sceneIds.filter(scene => (adjacency.get(scene) || new Set()).size === 0 && scene !== 'finalCommit')).toEqual([]);

    const visiting = new Set();
    const visited = new Set();
    const cycles = [];
    const visit = scene => {
      if (visiting.has(scene)) { cycles.push(scene); return; }
      if (visited.has(scene)) return;
      visiting.add(scene);
      for (const next of adjacency.get(scene) || []) if (next !== scene) visit(next);
      visiting.delete(scene);
      visited.add(scene);
    };
    visit('riceball');
    expect(cycles).toEqual([]);
  }
});

test('STORY／HARDの全14エンディングへ機械的に到達できる', async ({ page }) => {
  await openDebug(page);
  const results = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    api.silent(true);
    const final = (mode, dish, patch = {}, choiceIndex = 0) => {
      const run = api.fresh(10_018, mode);
      run.scene = 'finalCommit';
      run.hp = 100;
      run.hunger = 0;
      run.flags.selectedPair = ['salad', 'meat'];
      run.flags.selectedAppearance = dish;
      run.flags.selectedTrueDish = dish;
      Object.assign(run.flags, patch.flags || {});
      Object.assign(run.stats, patch.stats || {});
      Object.assign(run.memories, patch.memories || {});
      Object.assign(run.companions, patch.companions || {});
      api.setState(run);
      return api.step(choiceIndex).ending.code;
    };
    const terminal = (mode, kind) => {
      const run = api.fresh(10_019, mode);
      run.hp = kind === 'death' ? 1 : 100;
      run.hunger = kind === 'starve' ? 99 : 0;
      run.scene = kind === 'death' ? 'gel' : 'riceball';
      api.setState(run);
      return api.step(kind === 'death' ? 0 : 1).ending.code;
    };
    return Object.fromEntries(['story', 'hard'].map(mode => [mode, [
      terminal(mode, 'death'), terminal(mode, 'starve'),
      final(mode, 'cake', { flags: { ancientAwake: true } }),
      final(mode, 'cake', { flags: { monsterForm: true } }),
      final(mode, 'cake', { memories: { tako: true }, companions: { jr: true, beanChild: true } }),
      final(mode, 'cake'),
      final(mode, 'salad', { flags: { extraLife: true }, companions: { jr: true } }),
      final(mode, 'salad'),
      final(mode, 'meat', { flags: { monsterForm: true } }),
      final(mode, 'meat', { stats: { memoriesLost: 1 } }),
      final(mode, 'meat'),
      final(mode, 'soup', { flags: { shadowAwake: true } }),
      final(mode, 'soup'),
      final(mode, 'cake', {}, 1)
    ]]));
  });
  for (const mode of ['story', 'hard']) expect(new Set(results[mode])).toEqual(new Set(STORY_ENDINGS));
});

test('SURVIVAL全分類・節目・状態異常・rare 0／1／2回を固定seedで維持する', async ({ page }) => {
  await openDebug(page);
  const result = await page.evaluate(() => {
    const engine = globalThis.TabenaiSurvival;
    const events = engine.events;
    const plays = [
      [4_900_001, 'allConsume'],
      [4_900_005, 'allConsume'],
      [4_900_030, 'allConsume']
    ].map(([seed, policy]) => engine.playSeed(seed, { policy }));
    const ailmentHits = { toxin: false, fatigue: false, injury: false };
    for (let seed = 1; seed <= 500 && !Object.values(ailmentHits).every(Boolean); seed += 1) {
      const played = engine.playSeed(seed, { policy: 'random' });
      for (const step of played.trace) {
        for (const snapshot of Array.isArray(step.ailments) ? step.ailments : []) {
          for (const key of Object.keys(ailmentHits)) if (Number(snapshot && snapshot[key]) > 0) ailmentHits[key] = true;
        }
      }
    }
    return {
      categories: [...new Set(events.map(event => event.category))].sort(),
      milestones: events.filter(event => event.category === 'milestone').map(event => event.day).sort((a, b) => a - b),
      finalCount: events.filter(event => event.category === 'final').length,
      everyBinary: events.every(event => Array.isArray(event.choices) && event.choices.length === 2),
      rareSeen: plays.map(play => play.rare.seen),
      outcomes: plays.map(play => play.outcome),
      ailmentHits
    };
  });
  expect(result.categories).toEqual(['common', 'conditional', 'final', 'milestone', 'rare', 'uncommon']);
  expect(result.milestones).toEqual([10, 20, 30, 40]);
  expect(result.finalCount).toBeGreaterThanOrEqual(4);
  expect(result.everyBinary).toBe(true);
  expect(result.rareSeen).toEqual([0, 1, 2]);
  expect(result.outcomes).toEqual(['clear', 'clear', 'clear']);
  expect(result.ailmentHits).toEqual({ toxin: true, fatigue: true, injury: true });
});

test('自動保存直後の終了・再起動でもactive slotとlegacy mirrorを同じ進行へ保つ', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  await openDebug(page);
  const saved = await page.evaluate(() => {
    localStorage.clear();
    const api = globalThis.__TABENAI_DEBUG__;
    api.start('story', 1_000_018);
    const after = api.step(0);
    return { scene: after.scene, choiceCount: after.choiceCount, rngState: after.rngState };
  });
  await page.close();

  const resumed = await context.newPage();
  await resumed.goto('./?resume=1');
  await resumed.waitForFunction(() => Boolean(globalThis.TabenaiRecords));
  const state = await resumed.evaluate(() => {
    const workspace = globalThis.TabenaiRecords.decodeStorage(Object.fromEntries(
      Object.values(globalThis.TabenaiRecords.storageKeys).map(key => [key, localStorage.getItem(key)])
    ));
    const mirror = JSON.parse(localStorage.getItem(globalThis.TabenaiRecords.storageKeys.legacyRun));
    return { active: globalThis.TabenaiRecords.activeMirror(workspace.workspace), mirror };
  });
  expect(state.active).toMatchObject(saved);
  expect(state.mirror).toMatchObject(saved);
  await context.close();
});

test('公開画面へ開発用語を出さず、診断値は詳細表示だけに隔離する', async ({ page }) => {
  await openDebug(page);
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const run = api.fresh(1_000_022, 'survival');
    run.day = 49;
    run.survival.currentEventId = 'ordinary-meal';
    run.survival.currentSelection = {
      eventId: 'ordinary-meal', day: 49, rareChance: 0.04, rareBaseChance: 0.015,
      rarePityBonus: 0.025, rareRoll: 0.02, pityCounter: 45, pityForced: true
    };
    let workspace = globalThis.TabenaiRecords.freshWorkspace();
    workspace = globalThis.TabenaiRecords.setSlot(workspace, 'slot-1', run, {
      timestamp: '2026-08-02T00:00:00.000Z', activate: true
    });
    api.setRecords(workspace);
  });
  await page.goto('./?resume=1');
  const screens = ['title', 'modes', 'records', 'settings', 'credits', 'game'];
  const forbidden = ['SEED', 'rareChance', 'rareRoll', 'pity counter', 'event ID', 'cache revision', 'formatVersion', 'localStorage', 'ONLINE'];
  for (const screen of screens) {
    await page.evaluate(name => globalThis.__TABENAI_DEBUG__?.screen(name), screen).catch(() => {});
    if (screen !== 'title') {
      const selectors = { modes: '#newGameBtn', records: '#recordsBtn', settings: '#settingsBtn' };
      if (selectors[screen]) {
        await page.goto('./');
        await page.locator(selectors[screen]).click();
      } else if (screen === 'credits') {
        await page.goto('./'); await page.locator('#settingsBtn').click(); await page.locator('#settingsCreditsBtn').click();
      } else if (screen === 'game') await page.goto('./?resume=1');
    } else await page.goto('./');
    const text = await page.locator('body').innerText();
    for (const term of forbidden) expect(text, `${screen}: ${term}`).not.toContain(term);
  }

  await page.goto('./?debug=1&resume=1');
  const debugText = await page.locator('#gameScreen').innerText();
  for (const term of ['SEED', 'rareChance', 'rareRoll', 'pity counter']) expect(debugText).toContain(term);
});

test('7画面サイズで横溢れ・選択不能・モーダル切れ・browser errorがない', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  const problems = collectBrowserProblems(page);
  for (const [width, height] of VIEWPORTS) {
    await page.setViewportSize({ width, height });
    await openDebug(page);
    for (const screen of ['title', 'modes', 'slots', 'records', 'settings', 'game']) {
      await page.evaluate(name => globalThis.__TABENAI_DEBUG__.screen(name), screen);
      const geometry = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth
      }));
      expect(geometry.scroll, `${width}x${height}/${screen}`).toBeLessThanOrEqual(geometry.client);
    }
    await expect(page.locator('#choices .choice')).toHaveCount(2);
    for (const choice of [page.locator('#choiceA'), page.locator('#choiceB')]) {
      await expect(choice).toBeEnabled();
      await choice.scrollIntoViewIfNeeded();
      await expect(choice).toBeVisible();
    }
    await page.evaluate(() => globalThis.TabenaiModal.open(document.getElementById('dataModal')));
    const modal = await page.locator('#dataModal .modal-box').boundingBox();
    expect(modal.x).toBeGreaterThanOrEqual(0);
    expect(modal.y).toBeGreaterThanOrEqual(0);
    expect(modal.x + modal.width).toBeLessThanOrEqual(width);
    expect(modal.y + modal.height).toBeLessThanOrEqual(height);
    await page.keyboard.press('Escape');
  }
  expect(problems).toEqual({ console: [], pageErrors: [], requestFailures: [], httpErrors: [] });
  await context.close();
});

test('キーボード操作・フォーカス表示・モーダル復帰・alt／ariaを満たす', async ({ page }) => {
  await page.goto('./');
  await page.keyboard.press('Tab');
  const firstFocus = await page.evaluate(() => ({
    id: document.activeElement && document.activeElement.id,
    outline: getComputedStyle(document.activeElement).outlineStyle
  }));
  expect(firstFocus.id).toBe('newGameBtn');
  expect(firstFocus.outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.locator('#modeScreen')).toBeVisible();
  await expect(page.locator('#modeScreen h1')).toBeFocused();

  await openDebug(page);
  await page.locator('#appMenu > summary').focus();
  await page.keyboard.press('Enter');
  await page.locator('#rulesBtn').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#rulesModal')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#closeRules')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#closeRules')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#rulesModal')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#appMenu > summary')).toBeFocused();

  const semantics = await page.evaluate(() => ({
    namelessButtons: Array.from(document.querySelectorAll('button,summary')).filter(element => {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return !(element.getAttribute('aria-label') || element.textContent.trim());
    }).length,
    imagesWithoutAlt: Array.from(document.images).filter(image => !image.hasAttribute('alt')).length,
    dialogs: Array.from(document.querySelectorAll('.modal')).map(modal => ({
      role: modal.getAttribute('role'), modal: modal.getAttribute('aria-modal'), label: modal.getAttribute('aria-labelledby')
    }))
  }));
  expect(semantics.namelessButtons).toBe(0);
  expect(semantics.imagesWithoutAlt).toBe(0);
  expect(semantics.dialogs.every(item => item.role === 'dialog' && item.modal === 'true' && item.label)).toBe(true);
});

test('図鑑を20件ずつ遅延描画し、全174件を起動時に一括生成しない', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addInitScript(() => {
    const queue = [];
    globalThis.requestIdleCallback = callback => { queue.push(callback); return queue.length; };
    globalThis.cancelIdleCallback = () => {};
    globalThis.__flushIdleCallbacks = () => {
      let guard = 0;
      while (queue.length && guard < 50) { queue.shift()({ didTimeout: false, timeRemaining: () => 50 }); guard += 1; }
      return guard;
    };
  });
  const page = await context.newPage();
  await openDebug(page);
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('records'));
  await page.locator('[data-record-tab="codex"]').click();
  await expect(page.locator('#codexGrid')).toHaveAttribute('data-rendered-count', '20');
  expect(await page.locator('.codex-item').count()).toBe(20);
  const total = Number(await page.locator('#codexGrid').getAttribute('data-total-count'));
  expect(total).toBeGreaterThan(20);
  await page.evaluate(() => globalThis.__flushIdleCallbacks());
  await expect(page.locator('#codexGrid')).toHaveAttribute('data-rendered-count', String(total));
  await context.close();
});
