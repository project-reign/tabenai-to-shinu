import { expect, test } from '@playwright/test';
import {
  APP_URL,
  collectBrowserProblems,
  installMediaSpies,
  openApp,
  waitForPresentation
} from './helpers/presentation.mjs';

const SLOTS_KEY = 'tabenai-to-shinu-run-slots-v1';
const META_KEY = 'tabenai-to-shinu-meta-v1';

async function openMediaPage(browser, options = {}) {
  const context = await browser.newContext(options);
  await installMediaSpies(context);
  const page = await context.newPage();
  const problems = collectBrowserProblems(page);
  await openApp(page);
  await waitForPresentation(page);
  return { context, page, problems };
}

async function unlockOnBlank(page) {
  await page.locator('#sceneContent').click({ position: { x: 6, y: 6 } });
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().audioUnlocked)).toBe(true);
}

test('hidden／pagehide／freezeはBGM・SEを32ms fadeしてから停止・suspendする', async ({ browser }) => {
  for (const lifecycle of ['hidden', 'pagehide', 'freeze']) {
    const { context, page, problems } = await openMediaPage(browser);
    await unlockOnBlank(page);
    await page.evaluate(() => {
      const engine = globalThis.__TABENAI_PRESENTATION__;
      engine.cue(engine.registry.action('choice'));
    });
    const before = await page.evaluate(() => ({
      calls: structuredClone(globalThis.__MEDIA_CALLS__),
      snapshot: globalThis.__TABENAI_PRESENTATION__.snapshot()
    }));
    await page.evaluate(value => {
      if (value === 'hidden') globalThis.__setTestVisibility(true);
      if (value === 'pagehide') globalThis.__dispatchPageHide(true);
      if (value === 'freeze') globalThis.__dispatchFreeze();
    }, lifecycle);
    const immediate = await page.evaluate(() => ({
      calls: structuredClone(globalThis.__MEDIA_CALLS__),
      snapshot: globalThis.__TABENAI_PRESENTATION__.snapshot()
    }));
    expect(immediate.calls.suspends).toBe(before.calls.suspends);
    expect(immediate.calls.oscillatorStopTimes.slice(before.calls.oscillatorStopTimes.length).every(time => time >= 0.04)).toBe(true);
    expect(immediate.calls.gainEvents.slice(before.calls.gainEvents.length)).toEqual(expect.arrayContaining([
      ['linear', 0.0001, 0.032]
    ]));
    expect(immediate.snapshot.music.schedulerActive).toBe(false);
    await page.waitForTimeout(80);
    const settled = await page.evaluate(() => ({
      calls: structuredClone(globalThis.__MEDIA_CALLS__),
      snapshot: globalThis.__TABENAI_PRESENTATION__.snapshot()
    }));
    expect(settled.calls.suspends).toBe(before.calls.suspends + 1);
    expect(settled.snapshot.activeSeVoices).toBe(0);
    expect(settled.snapshot.music.activeVoices).toBe(0);
    expect(settled.snapshot.audioLifecycle.some(entry => entry.event === 'context-suspend' && entry.afterFade)).toBe(true);
    expect(problems.console).toEqual([]);
    expect(problems.pageErrors).toEqual([]);
    await context.close();
  }
});

test('iPhone touchはpointerdownを候補に留め、touchendで一度だけ初回音声を解除する', async ({ browser }) => {
  const { context, page } = await openMediaPage(browser, {
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true
  });
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));
  const box = await page.locator('#newGameBtn').boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().audioUnlocked)).toBe(true);
  const state = await page.evaluate(() => ({
    calls: structuredClone(globalThis.__MEDIA_CALLS__),
    presentation: globalThis.__TABENAI_PRESENTATION__.snapshot()
  }));
  expect(state.calls.contexts).toBe(1);
  expect(state.calls.resumes).toBe(1);
  expect(state.presentation.lastConsumedGestureType).toBe('touchend');
  expect(state.presentation.audioLifecycle.some(entry => entry.event === 'touch-unlock-candidate')).toBe(true);
  expect(state.presentation.audioLifecycle.filter(entry => entry.event === 'audio-unlocked')).toHaveLength(1);
  await context.close();
});

test('5つのゲーム開始経路は同一documentで音声を維持し、メニューtapを要求しない', async ({ browser }) => {
  for (const route of ['new', 'continue', 'daily', 'ending', 'fate']) {
    const { context, page, problems } = await openMediaPage(browser);
    await page.evaluate(() => { globalThis.__RC3_DOCUMENT_MARKER__ = 'same-document'; });

    if (route === 'continue') {
      await page.evaluate(() => {
        globalThis.__TABENAI_DEBUG__.start('story', 10301);
        globalThis.__TABENAI_DEBUG__.screen('title');
      });
      await page.locator('#continueBtn').click();
      await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().audioUnlocked)).toBe(true);
      await page.locator('[data-slot-continue="slot-1"]').click();
    } else if (route === 'daily') {
      await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));
      await page.locator('#dailyStartBtn').click();
      await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().audioUnlocked)).toBe(true);
      await page.locator('[data-slot-start="slot-1"]').click();
    } else if (route === 'ending') {
      await page.evaluate(() => {
        const api = globalThis.__TABENAI_DEBUG__;
        const ended = api.fresh(10302, 'story');
        ended.ended = true;
        ended.ending = { code: 'true', title: '生還', text: '帰還した。', icon: '🏁' };
        api.setState(ended);
        api.screen('game');
      });
      await page.locator('#newSeedRestart').click();
      await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().audioUnlocked)).toBe(true);
      await page.locator('[data-slot-start="slot-1"]').click();
    } else if (route === 'fate') {
      const code = await page.evaluate(() => globalThis.TabenaiRecords.encodeFateCode({
        gameVersion: '1.0.0-rc.3', mode: 'story', seed: 10303, choices: [0, 1]
      }));
      await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('modes'));
      await page.locator('#fateOpenBtn').click();
      await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().audioUnlocked)).toBe(true);
      await page.locator('#fateCodeText').fill(code);
      await page.locator('#fatePreviewBtn').click();
      await page.locator('#fateStartBtn').click();
      await page.locator('[data-slot-start="slot-1"]').click();
    } else {
      await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));
      await page.locator('#newGameBtn').click();
      await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().audioUnlocked)).toBe(true);
      await page.locator('#modeStoryBtn').click();
      await page.locator('[data-slot-start="slot-1"]').click();
    }

    await expect(page.locator('#gameScreen')).toBeVisible();
    const result = await page.evaluate(() => ({
      marker: globalThis.__RC3_DOCUMENT_MARKER__,
      contexts: globalThis.__MEDIA_CALLS__.contexts,
      navigationCount: performance.getEntriesByType('navigation').length,
      menuOpen: document.querySelector('#appMenu').open,
      presentation: globalThis.__TABENAI_PRESENTATION__.snapshot()
    }));
    expect(result.marker).toBe('same-document');
    expect(result.navigationCount).toBe(1);
    expect(result.contexts).toBe(1);
    expect(result.menuOpen).toBe(false);
    expect(result.presentation).toMatchObject({
      audioUnlocked: true,
      currentBgmKey: 'bgm.normal',
      audioLifecycleListenerCount: 9
    });
    expect(result.presentation.music.schedulerActive).toBe(true);
    expect(result.presentation.cueCount).toBeLessThanOrEqual(1);
    expect(problems.console).toEqual([]);
    expect(problems.pageErrors).toEqual([]);
    await context.close();
  }
});

test('80ms二重tapはSTORY／HARD／SURVIVAL／四皿／四箱を一度だけ処理する', async ({ browser }) => {
  const cases = [
    { name: 'story', mode: 'story' },
    { name: 'hard', mode: 'hard' },
    { name: 'survival', mode: 'survival' },
    { name: 'four-dishes', mode: 'story', scene: 'finalPair', day: 50 },
    { name: 'four-boxes', mode: 'survival', survivalEvent: 'final-pair', day: 50 }
  ];
  for (const setup of cases) {
    const { context, page } = await openMediaPage(browser, {
      viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true
    });
    await unlockOnBlank(page);
    await page.evaluate(value => {
      const api = globalThis.__TABENAI_DEBUG__;
      api.recording(true);
      api.start(value.mode, 10400 + value.name.length);
      const meta = api.meta();
      meta.settings.autoScroll = 'off';
      api.setMeta(meta);
      const run = api.snapshot();
      run.recording = {
        runId: `rc3-${value.name}`,
        slotId: 'slot-1',
        choices: [], timeline: [], rareEncounterLog: [], encounterTokens: [],
        dailyDate: null, fateReplay: false, expectedChoices: [], achievementIdsAtStart: []
      };
      if (value.scene) { run.scene = value.scene; run.day = value.day; run.hp = 100; run.hunger = 0; }
      if (value.survivalEvent) {
        run.day = value.day;
        run.scene = 'survival';
        run.survival.currentEventId = value.survivalEvent;
        run.survival.currentSelection = { eventId: value.survivalEvent, day: value.day, category: 'final' };
      }
      api.setState(run);
      api.screen('game');
      const original = Storage.prototype.setItem;
      globalThis.__RC3_SLOT_WRITES__ = 0;
      Storage.prototype.setItem = function (key, item) {
        if (key === 'tabenai-to-shinu-run-slots-v1') globalThis.__RC3_SLOT_WRITES__ += 1;
        return original.call(this, key, item);
      };
    }, setup);
    const before = await page.evaluate(() => ({
      run: globalThis.__TABENAI_DEBUG__.snapshot(),
      sequence: globalThis.__TABENAI_PRESENTATION__.snapshot().audioLifecycle.at(-1)?.sequence || 0
    }));
    const box = await page.locator('#choiceA').boundingBox();
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.touchscreen.tap(point.x, point.y);
    await page.waitForTimeout(80);
    await page.touchscreen.tap(point.x, point.y);
    await page.waitForTimeout(420);
    const after = await page.evaluate(sequence => {
      const api = globalThis.__TABENAI_DEBUG__;
      const run = api.snapshot();
      const presentation = globalThis.__TABENAI_PRESENTATION__;
      const snapshot = presentation.snapshot();
      const action = document.documentElement.dataset.lastPresentationAction;
      const actionKey = presentation.registry.action(action) || presentation.registry.action('choice');
      return {
        run,
        slotWrites: globalThis.__RC3_SLOT_WRITES__,
        transaction: api.choiceTransaction(),
        actionCues: snapshot.audioLifecycle.filter(entry => entry.sequence > sequence && entry.event === 'cue' && entry.cueKey === actionKey)
      };
    }, before.sequence);
    expect(after.run.choiceCount).toBe(before.run.choiceCount + 1);
    expect(after.run.recording.timeline).toHaveLength(before.run.recording.timeline.length + 1);
    expect(after.slotWrites).toBe(1);
    expect(after.actionCues).toHaveLength(1);
    expect(after.transaction.locked).toBe(false);
    if (!setup.scene && !setup.survivalEvent) expect(after.run.day).toBe(before.run.day + 1);
    await context.close();
  }
});

test('50回連打・キーボード連打・確認dialogでも一操作一遷移を守り、350ms後に次を選べる', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    api.start('story', 10501);
    const meta = api.meta();
    meta.settings.autoScroll = 'off';
    api.setMeta(meta);
    api.screen('game');
  });
  const before = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.snapshot().choiceCount);
  await page.locator('#choiceA').evaluate(button => { for (let index = 0; index < 50; index += 1) button.click(); });
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_DEBUG__.snapshot().choiceCount)).toBe(before + 1);
  await expect(page.locator('#choiceA')).toBeDisabled();
  await page.waitForTimeout(360);
  await expect(page.locator('#choiceA')).toBeEnabled();
  await page.locator('#choiceA').click();
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_DEBUG__.snapshot().choiceCount)).toBe(before + 2);
  await page.waitForTimeout(360);
  await page.evaluate(() => { for (let index = 0; index < 50; index += 1) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })); });
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_DEBUG__.snapshot().choiceCount)).toBe(before + 3);

  await page.waitForTimeout(360);
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const meta = api.meta();
    meta.settings.confirmChoices = true;
    api.setMeta(meta);
  });
  let dialogs = 0;
  page.on('dialog', async dialog => { dialogs += 1; await dialog.accept(); });
  await page.locator('#choiceA').evaluate(button => { button.click(); button.click(); });
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_DEBUG__.snapshot().choiceCount)).toBe(before + 4);
  expect(dialogs).toBe(1);
});

test('非操作領域のdouble tapはタイトル・ゲーム・記録・設定・モーダルのscrollYを変えない', async ({ browser }) => {
  const { context, page, problems } = await openMediaPage(browser, {
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true
  });
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const meta = api.meta();
    meta.settings.reducedMotion = true;
    api.setMeta(meta);
  });
  const targets = [
    ['title', '.title-hero'],
    ['game', '#sceneContent'],
    ['records', '#recordsScreen .screen-card'],
    ['settings', '#settingsScreen .screen-card']
  ];
  let expectedSuppressions = 0;
  for (const [screen, selector] of targets) {
    await page.evaluate(value => globalThis.__TABENAI_DEBUG__.screen(value), screen);
    await page.evaluate(() => scrollTo(0, Math.min(280, Math.max(0, document.documentElement.scrollHeight - innerHeight))));
    const before = await page.evaluate(() => scrollY);
    const box = await page.locator(selector).boundingBox();
    const x = box.x + Math.min(8, box.width / 4);
    const visibleTop = Math.max(56, box.y + 8);
    const visibleBottom = Math.min(836, box.y + box.height - 8);
    const y = Math.max(56, Math.min(836, (visibleTop + visibleBottom) / 2));
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(80);
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(220);
    expectedSuppressions += 1;
    const guarded = await page.evaluate(() => ({ y: scrollY, guard: globalThis.__TABENAI_DEBUG__.blankDoubleTap() }));
    expect(guarded.y, `${screen} ${JSON.stringify(guarded.guard)}`).toBe(before);
    expect(guarded.guard.suppressions).toBe(expectedSuppressions);
    expect(await page.evaluate(() => visualViewport?.scale ?? 1)).toBe(1);
    await page.waitForTimeout(500);
  }

  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('game'));
  await page.locator('#rulesBtn').evaluate(button => button.click());
  await expect(page.locator('#rulesModal')).toHaveClass(/open/);
  const modalBefore = await page.evaluate(() => scrollY);
  const modalBox = await page.locator('#rulesModal .modal-box').boundingBox();
  const modalPoint = { x: modalBox.x + 8, y: modalBox.y + 8 };
  await page.touchscreen.tap(modalPoint.x, modalPoint.y);
  await page.waitForTimeout(80);
  await page.touchscreen.tap(modalPoint.x, modalPoint.y);
  await page.waitForTimeout(220);
  expect(await page.evaluate(() => scrollY)).toBe(modalBefore);
  expect((await page.evaluate(() => globalThis.__TABENAI_DEBUG__.blankDoubleTap())).suppressions).toBe(expectedSuppressions + 1);
  expect(problems.console).toEqual([]);
  expect(problems.pageErrors).toEqual([]);
  await context.close();
});

test('autoScroll true／falseを列挙値へ移行し、context／choices／offを4画面幅で守る', async ({ browser }) => {
  for (const [legacy, expected] of [[true, 'context'], [false, 'off'], [undefined, 'context']]) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    if (legacy !== undefined) await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify({ settings: { autoScroll: value } })), { key: META_KEY, value: legacy });
    const page = await context.newPage();
    await openApp(page);
    expect(await page.evaluate(() => globalThis.__TABENAI_DEBUG__.meta().settings.autoScroll)).toBe(expected);
    await context.close();
  }

  for (const viewport of [
    { width: 320, height: 568 }, { width: 375, height: 667 },
    { width: 390, height: 844 }, { width: 430, height: 932 }
  ]) {
    for (const mode of ['context', 'choices', 'off']) {
      const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
      const page = await context.newPage();
      await openApp(page);
      await page.evaluate(value => {
        const api = globalThis.__TABENAI_DEBUG__;
        api.start('story', 10601);
        const meta = api.meta();
        meta.settings.autoScroll = value;
        meta.settings.reducedMotion = true;
        api.setMeta(meta);
        api.screen('game');
        scrollTo(0, document.documentElement.scrollHeight);
      }, mode);
      await page.locator('#choiceA').scrollIntoViewIfNeeded();
      const before = await page.evaluate(() => scrollY);
      await page.locator('#choiceA').click();
      await page.waitForTimeout(80);
      const result = await page.evaluate(() => {
        const status = document.querySelector('#sceneContextStatus').getBoundingClientRect();
        const title = document.querySelector('#sceneTitle').getBoundingClientRect();
        const choices = document.querySelector('#choices').getBoundingClientRect();
        const max = document.documentElement.scrollHeight - innerHeight;
        return { status, title, choices, y: scrollY, max, debug: globalThis.__TABENAI_DEBUG__.autoScroll() };
      });
      if (mode === 'context') {
        expect(result.status.top).toBeGreaterThanOrEqual(0);
        expect(result.title.bottom).toBeLessThanOrEqual(viewport.height);
        if (result.max > 1 && result.debug.moved) {
          expect(result.y).toBeGreaterThan(0);
          expect(result.y).toBeLessThan(result.max);
        }
      } else if (mode === 'choices') {
        expect(result.choices.top).toBeGreaterThanOrEqual(0);
        expect(result.choices.bottom).toBeLessThanOrEqual(viewport.height);
        if (result.max > 1 && result.debug.moved) expect(result.y).toBeLessThan(result.max);
      } else {
        expect(result.y).toBe(before);
        expect(result.debug.moved).toBe(false);
      }
      await context.close();
    }
  }
});

test('RC3はzoom禁止指定・hard stop・ゲーム開始reloadを含まない', async ({ page }) => {
  await page.goto(APP_URL);
  const contract = await page.evaluate(() => ({
    viewport: document.querySelector('meta[name="viewport"]').content,
    css: document.querySelector('style').textContent,
    autoScrollOptions: [...document.querySelectorAll('#autoScrollSetting option')].map(option => [option.value, option.textContent])
  }));
  expect(contract.viewport).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);
  expect(contract.css).not.toMatch(/touch-action\s*:\s*none/i);
  expect(contract.autoScrollOptions).toEqual([
    ['context', '次の出来事へ'], ['choices', '選択肢へ'], ['off', '自動で移動しない']
  ]);
  const [music, presentation, index] = await Promise.all([
    page.request.get('./music-engine.js').then(response => response.text()),
    page.request.get('./presentation-engine.js').then(response => response.text()),
    page.request.get('./index.html').then(response => response.text())
  ]);
  expect(music).not.toContain('oscillator.stop(now);');
  expect(presentation).not.toContain('oscillator.stop(now);');
  expect(index).not.toContain("location.assign(url.href)");
});
