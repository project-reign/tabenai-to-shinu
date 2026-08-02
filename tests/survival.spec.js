import { expect, test } from '@playwright/test';

const DEBUG_URL = './?debug=1';
const SAVE_KEY = 'tabenai-to-shinu-50days-v4';
const META_KEY = 'tabenai-to-shinu-meta-v1';
const CONDITIONAL_TITLES = [
  '寄生タコの帰還',
  'Jr.の空腹',
  '黒豆の里帰り',
  '影の夜食',
  '透明清掃員の市場',
  '失った誕生日会',
  '未来の自分の置き手紙',
  '古きものの寝息'
];
const RARE_TITLES = [
  '完全に普通の定食',
  '存在しない51日目',
  '二人目のプレイヤー',
  '食べ物からの拒否',
  '森の管理者',
  '寄生タコ生存確認'
];
const MILESTONES = new Map([
  [10, '最初の備蓄'],
  [20, '空腹の徴税人'],
  [30, '同行者の席'],
  [40, '最後の献立表']
]);
const BOX_NAMES = ['保存食の箱', '生きている箱', '空の箱', '帰還の箱'];
const SURVIVAL_ACHIEVEMENTS = [
  ['wild_fifty', '野生の50日'],
  ['rare_encounter', '稀少遭遇'],
  ['luck_is_skill', '運も実力'],
  ['solo_survivor', '孤独な生還'],
  ['refusal_master', '拒否の達人'],
  ['as_planned', '全ては予定通り'],
  ['ordinary_best', '普通がいちばん']
];

async function waitForDebug(page) {
  await expect.poll(() => page.evaluate(() => Boolean(globalThis.__TABENAI_DEBUG__))).toBe(true);
}

async function importTransfer(page, payload, targetSlot = 'slot-1') {
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));
  await page.locator('.title-manage > summary').click();
  await page.locator('#titleDataBtn').click();
  await page.locator('#importTargetSlot').selectOption(targetSlot);
  await page.locator('#saveTransferText').fill(JSON.stringify(payload));
  const acceptOverwrite = dialog => dialog.accept();
  page.on('dialog', acceptOverwrite);
  try {
    await Promise.all([
      page.waitForEvent('load'),
      page.locator('#importSaveBtn').click()
    ]);
  } finally {
    page.off('dialog', acceptOverwrite);
  }
  await waitForDebug(page);
}

test.beforeEach(async ({ page }) => {
  await page.goto(DEBUG_URL);
  await waitForDebug(page);
});

test('SURVIVALイベント分類・件数・常時二択・全対象イベントの拒否権を検証する', async ({ page }) => {
  const events = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.survivalEvents());
  const categories = events.reduce((counts, event) => {
    counts[event.category] = (counts[event.category] || 0) + 1;
    return counts;
  }, {});

  expect(Object.keys(categories)).toEqual(expect.arrayContaining([
    'common', 'uncommon', 'rare', 'conditional', 'milestone', 'final'
  ]));
  expect((categories.common || 0) + (categories.uncommon || 0)).toBeGreaterThanOrEqual(16);
  expect(categories.conditional).toBeGreaterThanOrEqual(8);
  expect(categories.rare).toBeGreaterThanOrEqual(6);
  expect(events.every(event => Array.isArray(event.choices) && event.choices.length === 2)).toBe(true);

  const conditionalTitles = events.filter(event => event.category === 'conditional').map(event => event.title);
  const rareTitles = events.filter(event => event.category === 'rare').map(event => event.title);
  expect(conditionalTitles).toEqual(expect.arrayContaining(CONDITIONAL_TITLES));
  expect(rareTitles).toEqual(expect.arrayContaining(RARE_TITLES));

  const protectedTags = ['food', 'drink', 'medicine', 'wait'];
  for (const tag of protectedTags) {
    const matching = events.filter(event => Array.isArray(event.tags) && event.tags.includes(tag));
    expect(matching.length, `${tag}イベントがカタログに存在する`).toBeGreaterThan(0);
    for (const event of matching) {
      expect(
        event.choices.some(choice => choice.kind === 'skip' || choice.refusal === true),
        `${event.id} (${tag}) に拒否選択がある`
      ).toBe(true);
    }
  }

  expect(events.some(event => Number(event.cooldown) > 0)).toBe(true);
  expect(events.some(event => event.oneShot === true)).toBe(true);
  expect(events.some(event => Number.isFinite(event.maxEncounters) && event.maxEncounters > 0)).toBe(true);

  const milestones = events
    .filter(event => event.category === 'milestone')
    .map(event => [event.day, event.title]);
  expect(new Map(milestones)).toEqual(MILESTONES);

  const finalChoiceTitles = events
    .filter(event => event.category === 'final')
    .flatMap(event => event.choices.map(choice => choice.title));
  expect(events).toContainEqual(expect.objectContaining({
    category: 'final',
    day: 50,
    title: '生存者の配膳'
  }));
  expect(finalChoiceTitles).toEqual(expect.arrayContaining([...BOX_NAMES, '開封する', '拒否する']));

  const rareSafety = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const rareIds = api.survivalEvents()
      .filter(event => event.category === 'rare')
      .map(event => event.id);
    const failures = [];
    api.silent(true);
    for (const id of rareIds) {
      for (const choice of [0, 1]) {
        const state = api.fresh(0x45_00_0001 + choice, 'survival');
        state.hp = 1;
        state.hunger = 99;
        state.survival.currentEventId = id;
        state.survival.currentSelection = { eventId: id, naturalHit: true, pityForced: false };
        api.setState(state);
        const after = api.step(choice);
        if (after.ended || after.hp <= 0 || after.hunger >= 100) {
          failures.push({ id, choice, hp: after.hp, hunger: after.hunger, ending: after.ending });
        }
      }
    }
    return failures;
  });
  expect(rareSafety, 'レアイベント単独で不可避の即死を起こさない').toEqual([]);
});

test('同一シードと同一選択列でイベント列・判定・結末を完全再現する', async ({ page }) => {
  const result = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const choices = Array.from({ length: 80 }, (_, index) => ((index * 7 + 3) >>> 1) % 2);
    api.silent(true);

    const run = seed => {
      api.setState(api.fresh(seed, 'survival'));
      const trace = [];
      for (let index = 0; index < choices.length; index += 1) {
        const state = api.snapshot();
        if (state.ended) break;
        const current = api.survivalCurrent();
        const choice = choices[index];
        trace.push({
          day: state.day,
          eventId: current.eventId || current.id,
          category: current.category,
          choice,
          rngState: state.rngState,
          hp: state.hp,
          hunger: state.hunger,
          lastRoll: state.lastRoll
        });
        api.step(choice);
      }
      return { trace, state: api.snapshot() };
    };

    return {
      first: run(0x45_50_0001),
      second: run(0x45_50_0001),
      other: run(0x45_50_0002)
    };
  });

  expect(result.first).toEqual(result.second);
  expect(result.first.state.ended).toBe(true);
  expect(result.first.trace.length).toBeGreaterThan(1);
  expect(result.first.trace.map(item => item.eventId)).not.toEqual(result.other.trace.map(item => item.eventId));
  for (let index = 1; index < result.first.trace.length; index += 1) {
    const previous = result.first.trace[index - 1];
    const current = result.first.trace[index];
    expect(current.day, `${previous.eventId}解決後の日付`).toBe(
      previous.category === 'final' ? previous.day : previous.day + 1
    );
  }
});

test('SURVIVALのイベント決定と結果判定にMath.randomを使用しない', async ({ request }) => {
  const [appSource, engineSource] = await Promise.all([
    request.get('./index.html').then(response => response.text()),
    request.get('./survival-engine.js').then(response => response.text())
  ]);
  expect(appSource).not.toContain('Math.random');
  expect(engineSource).not.toContain('Math.random');
});

test('抽選済みイベントIDをセーブし、再読込で再抽選もPRNG消費もしない', async ({ page }) => {
  const before = await page.evaluate(({ saveKey }) => {
    const api = globalThis.__TABENAI_DEBUG__;
    api.start('survival', 4_500_031);
    api.screen('game');
    const current = api.survivalCurrent();
    return {
      current,
      state: api.snapshot(),
      stored: JSON.parse(localStorage.getItem(saveKey))
    };
  }, { saveKey: SAVE_KEY });

  const beforeId = before.current.eventId || before.current.id;
  expect(beforeId).toBeTruthy();
  expect(JSON.stringify(before.stored)).toContain(beforeId);

  await page.reload();
  await waitForDebug(page);
  const after = await page.evaluate(() => ({
    current: globalThis.__TABENAI_DEBUG__.survivalCurrent(),
    state: globalThis.__TABENAI_DEBUG__.snapshot()
  }));

  expect(after.current.eventId || after.current.id).toBe(beforeId);
  expect(after.state.rngState).toBe(before.state.rngState);
  expect(after.state.survival).toEqual(before.state.survival);
});

test('SURVIVAL run・実績・記録をformatVersion 3で往復し、formatVersion 1／2と旧metaも維持する', async ({ page }) => {
  await page.evaluate(({ metaKey }) => {
    localStorage.setItem(metaKey, JSON.stringify({
      version: 1,
      achievements: { first_bite: { unlockedAt: '2025-01-01T00:00:00.000Z' } },
      endings: { true: { title: '契約腐敗・脱出成功', firstReachedAt: null, count: 1 } },
      stats: { totalChoices: 9, modeClears: { story: 1, hard: 0 } },
      settings: { fontSize: 'large', reducedMotion: false, confirmChoices: false, autoScroll: true }
    }));
  }, { metaKey: META_KEY });
  await page.goto(DEBUG_URL);
  await waitForDebug(page);
  const normalizedOldMeta = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.meta());
  expect(normalizedOldMeta.achievements.first_bite).toBeTruthy();
  expect(normalizedOldMeta.endings.true.count).toBe(1);
  expect(normalizedOldMeta.stats.totalChoices).toBe(9);
  expect(normalizedOldMeta.stats.modeClears).toEqual({ story: 1, hard: 0, survival: 0 });
  expect(normalizedOldMeta.stats.survival).toEqual(expect.objectContaining({
    rareEvents: 0,
    pityEvents: 0,
    boxesOpened: { preserved: 0, living: 0, empty: 0, return: 0 }
  }));
  expect(normalizedOldMeta.settings.fontSize).toBe('large');

  const prepared = await page.evaluate(({ achievementIds }) => {
    const api = globalThis.__TABENAI_DEBUG__;
    api.start('survival', 4_500_042);
    api.screen('game');
    const current = api.survivalCurrent();
    const meta = api.meta();
    for (const id of achievementIds) {
      meta.achievements[id] = { unlockedAt: '2026-07-31T00:00:00.000Z' };
    }
    meta.stats.survival.rareEvents = 7;
    meta.stats.survival.pityEvents = 2;
    meta.stats.survival.boxesOpened.return = 1;
    api.setMeta(meta);
    return { current, payload: api.transfer() };
  }, { achievementIds: SURVIVAL_ACHIEVEMENTS.map(([id]) => id) });

  const currentId = prepared.current.eventId || prepared.current.id;
  expect(prepared.payload.formatVersion).toBe(3);
  expect(prepared.payload.scope).toBe('all');
  expect(prepared.payload.slots).toHaveLength(3);
  expect(prepared.payload.slots.find(slot => slot.id === prepared.payload.activeSlotId).run.mode).toBe('survival');
  expect(prepared.payload.run.mode).toBe('survival');
  expect(JSON.stringify(prepared.payload.run)).toContain(currentId);
  expect(prepared.payload.meta.stats.survival.rareEvents).toBe(7);
  for (const [id] of SURVIVAL_ACHIEVEMENTS) {
    expect(prepared.payload.meta.achievements[id]).toBeTruthy();
  }

  await importTransfer(page, prepared.payload);
  const restored = await page.evaluate(() => ({
    state: globalThis.__TABENAI_DEBUG__.snapshot(),
    current: globalThis.__TABENAI_DEBUG__.survivalCurrent(),
    meta: globalThis.__TABENAI_DEBUG__.meta()
  }));
  expect(restored.state.mode).toBe('survival');
  expect(restored.current.eventId || restored.current.id).toBe(currentId);
  expect(restored.meta.stats.survival.boxesOpened.return).toBe(1);

  const legacyTransfer = {
    format: 'tabenai-save',
    formatVersion: 1,
    appVersion: '4.3.0',
    state: {
      version: 4,
      seed: 4_300_001,
      rngState: 987_654,
      scene: 'meatTrial',
      day: 43,
      hp: 73,
      hunger: 41,
      choiceCount: 22
    }
  };
  await importTransfer(page, legacyTransfer);
  const legacy = await page.evaluate(({ metaKey }) => ({
    state: globalThis.__TABENAI_DEBUG__.snapshot(),
    meta: JSON.parse(localStorage.getItem(metaKey))
  }), { metaKey: META_KEY });
  expect(legacy.state.mode).toBe('story');
  expect(legacy.state.seed).toBe(4_300_001);
  expect(legacy.state.scene).toBe('meatTrial');
  expect(legacy.meta.settings).toBeTruthy();
  expect(legacy.meta.stats.survival).toBeTruthy();
  for (const [id] of SURVIVAL_ACHIEVEMENTS) {
    expect(legacy.meta.achievements[id]).toBeTruthy();
  }

  const legacyV2 = {
    format: 'tabenai-save',
    formatVersion: 2,
    appVersion: '4.7.0',
    exportedAt: '2026-07-31T23:59:59.000Z',
    run: {
      version: 4,
      mode: 'survival',
      seed: 4_700_002,
      rngState: 777_777,
      scene: 'survival',
      day: 17,
      hp: 64,
      hunger: 58,
      choiceCount: 16,
      survival: restored.state.survival
    },
    meta: restored.meta,
    endings: prepared.payload.endings
  };
  await importTransfer(page, legacyV2);
  const restoredV2 = await page.evaluate(() => ({
    state: globalThis.__TABENAI_DEBUG__.snapshot(),
    records: globalThis.__TABENAI_DEBUG__.records()
  }));
  expect(restoredV2.state.mode).toBe('survival');
  expect(restoredV2.state.seed).toBe(4_700_002);
  expect(restoredV2.records.activeSlotId).toBe('slot-1');
  expect(restoredV2.records.slots.find(slot => slot.id === 'slot-1').run.seed).toBe(4_700_002);
  expect(restoredV2.records.slots.find(slot => slot.id === 'slot-2').run).toBeNull();
});

test('追加実績を記録画面へ表示し、再起動後も保持する', async ({ page }) => {
  await page.evaluate(({ achievements }) => {
    const api = globalThis.__TABENAI_DEBUG__;
    const meta = api.meta();
    for (const [id] of achievements) {
      meta.achievements[id] = { unlockedAt: '2026-07-31T00:00:00.000Z' };
    }
    api.setMeta(meta);
  }, { achievements: SURVIVAL_ACHIEVEMENTS });
  await page.reload();
  await waitForDebug(page);
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));
  await page.locator('#recordsBtn').click();

  for (const [id, name] of SURVIVAL_ACHIEVEMENTS) {
    await expect(page.locator(`[data-achievement="${id}"]`)).toContainText(name);
  }
  const achievementCount = await page.locator('[data-achievement]').count();
  expect(achievementCount).toBeGreaterThanOrEqual(33);
});

test('iPhone 390×844で怪食サバイバルを開始し、二択へ短く到達できる', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.locator('#newGameBtn').click();
  await expect(page.locator('#modeSurvivalBtn')).toContainText('怪食サバイバル');
  await page.locator('#modeSurvivalBtn').click();
  await expect(page.locator('#slotScreen')).toBeVisible();
  await Promise.all([
    page.waitForEvent('load'),
    page.locator('[data-slot-start="slot-1"]').click()
  ]);

  await expect(page.locator('#gameScreen')).toBeVisible();
  await expect(page.locator('#modeBadge')).toHaveText('SURVIVAL 50');
  await expect(page.locator('#choices .choice')).toHaveCount(2);
  await expect(page.locator('#choiceA')).toBeVisible();
  await expect(page.locator('#choiceB')).toBeVisible();
  const distanceToSecondChoice = await page.evaluate(() => {
    const rect = document.getElementById('choiceB').getBoundingClientRect();
    return Math.max(0, rect.bottom - window.innerHeight);
  });
  expect(distanceToSecondChoice).toBeLessThanOrEqual(220);
});

test('SURVIVALの抽選済みイベントを初回オンライン起動後のオフライン再起動でも維持する', async ({ browser, page }) => {
  await page.close();
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const onlinePage = await context.newPage();
  await onlinePage.goto('http://127.0.0.1:4173/tabenai-to-shinu/?debug=1');
  await waitForDebug(onlinePage);
  const before = await onlinePage.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    api.start('survival', 4_500_051);
    api.screen('game');
    const current = api.survivalCurrent();
    return { eventId: current.eventId || current.id, state: api.snapshot() };
  });
  await onlinePage.evaluate(async () => { await navigator.serviceWorker.ready; });
  await onlinePage.reload();
  await expect.poll(
    () => onlinePage.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    { timeout: 15_000 }
  ).toBe(true);
  await onlinePage.close();
  await context.setOffline(true);

  const offlinePage = await context.newPage();
  await offlinePage.goto('http://127.0.0.1:4173/tabenai-to-shinu/?debug=1');
  await waitForDebug(offlinePage);
  const after = await offlinePage.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const current = api.survivalCurrent();
    return { eventId: current.eventId || current.id, state: api.snapshot() };
  });
  expect(after.eventId).toBe(before.eventId);
  expect(after.state.rngState).toBe(before.state.rngState);
  expect(after.state.survival).toEqual(before.state.survival);
  await context.close();
});

test('10,000超のシードでデッキ制約・レア率・pity・全到達・複数生還を検証する', async ({ page }) => {
  test.setTimeout(120_000);
  const result = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.simulateSurvivalSeeds(10_001));

  expect(result.seedCount).toBeGreaterThanOrEqual(10_000);
  expect(result.errors).toBe(0);
  expect(result.loops).toBe(0);
  expect(result.invalidValues).toBe(0);
  expect(result.totalEvents).toBeGreaterThan(400_000);

  expect(result.violations).toEqual(expect.objectContaining({
    cooldown: 0,
    oneShot: 0,
    maxEncounters: 0,
    recentThree: 0
  }));
  expect(result.rare.cap).toBe(2);
  expect(result.rare.minBaseChance).toBeCloseTo(0.008, 8);
  expect(result.rare.maxBaseChance).toBeCloseTo(0.015, 8);
  expect(result.rare.maxEffectiveChance).toBeCloseTo(0.04, 8);
  expect(result.rare.pityTriggers).toBeGreaterThan(0);
  expect(result.rare.maxDryStreak).toBeLessThanOrEqual(45);
  expect(result.rare.rateByPeriod.map(bucket => bucket.chance)).toEqual([0.008, 0.01, 0.012, 0.015]);
  for (const bucket of result.rare.rateByPeriod) {
    expect(bucket.draws).toBeGreaterThan(1_000);
    expect(bucket.naturalHits / bucket.draws).toBeGreaterThan(bucket.chance - 0.006);
    expect(bucket.naturalHits / bucket.draws).toBeLessThan(bucket.chance + 0.006);
  }
  expect(result.rare.allRuns.bins.threeOrMore).toBe(0);
  expect(result.rare.clearRuns.bins.threeOrMore).toBe(0);

  const events = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.survivalEvents());
  const conditionalIds = events.filter(event => event.category === 'conditional').map(event => event.id);
  for (const id of conditionalIds) expect(result.conditionalHits[id], id).toBeGreaterThan(0);
  for (const day of MILESTONES.keys()) expect(result.milestoneHits[day], `day ${day}`).toBeGreaterThan(0);
  for (const box of ['preserved', 'living', 'empty', 'return']) {
    expect(result.boxHits[box], box).toBeGreaterThan(0);
  }
  expect(result.finalRefusals).toBeGreaterThan(0);
  for (const ending of [
    'survival_preserved',
    'survival_living',
    'survival_empty',
    'survival_return',
    'survival_refuse'
  ]) {
    expect(result.clearEndings[ending], ending).toBeGreaterThan(0);
  }
  for (const [id] of SURVIVAL_ACHIEVEMENTS) {
    expect(result.achievementHits[id], id).toBeGreaterThan(0);
  }
});
