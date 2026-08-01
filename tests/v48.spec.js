import { expect, test } from '@playwright/test';

const DEBUG_URL = './?debug=1';
const SAVE_KEY = 'tabenai-to-shinu-50days-v4';
const SLOTS_KEY = 'tabenai-to-shinu-run-slots-v1';
const ACTIVE_SLOT_KEY = 'tabenai-to-shinu-active-slot-v1';
const HISTORY_KEY = 'tabenai-to-shinu-run-history-v1';
const CODEX_KEY = 'tabenai-to-shinu-codex-v1';
const DAILY_KEY = 'tabenai-to-shinu-daily-v1';
const MIGRATION_KEY = 'tabenai-to-shinu-run-slots-migrated-v1';
const META_KEY = 'tabenai-to-shinu-meta-v1';
const ENDING_KEY = 'tabenai-to-shinu-endings-v4';
const APP_URL = 'http://127.0.0.1:4173/tabenai-to-shinu/';

async function openDebug(page) {
  await page.goto(DEBUG_URL);
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__ && globalThis.TabenaiRecords));
}

async function seedSlots(page, values) {
  return page.evaluate(items => {
    const api = globalThis.__TABENAI_DEBUG__;
    const records = globalThis.TabenaiRecords;
    let workspace = records.freshWorkspace();
    for (const item of items) {
      const run = api.fresh(item.seed, item.mode);
      run.day = item.day ?? run.day;
      run.hp = item.hp ?? run.hp;
      run.hunger = item.hunger ?? run.hunger;
      run.scene = item.scene ?? run.scene;
      run.lastPlayedAt = item.timestamp;
      if (item.companions) Object.assign(run.companions, item.companions);
      workspace = records.setSlot(workspace, item.slot, run, {
        timestamp: item.timestamp,
        name: item.name,
        activate: item.activate !== false
      });
    }
    return api.setRecords(workspace);
  }, values);
}

async function startStoryInSlot(page, slotId) {
  await page.locator('#newGameBtn').click();
  await page.locator('#modeStoryBtn').click();
  await expect(page.locator('#slotScreen')).toBeVisible();
  await Promise.all([
    page.waitForURL(/\?resume=1$/, { waitUntil: 'domcontentloaded' }),
    page.locator(`[data-slot-start="${slotId}"]`).click()
  ]);
  await expect(page.locator('#gameScreen')).toBeVisible();
}

async function resumeFromTitleIfNeeded(page, slotId = 'slot-1') {
  if (await page.locator('#titleScreen').isVisible()) {
    await page.locator('#continueBtn').click();
    await page.locator(`[data-slot-continue="${slotId}"]`).click();
  }
  await expect(page.locator('#gameScreen')).toBeVisible();
}

async function codexEntry(page, category, id) {
  return page.evaluate(({ category, id }) => {
    const raw = JSON.parse(localStorage.getItem('tabenai-to-shinu-codex-v1') || '{}');
    return raw.categories && raw.categories[category] && raw.categories[category][id] || null;
  }, { category, id });
}

test('旧単一runをslot 1へ初回だけ移行し、markerで重複コピーを防ぐ', async ({ page }) => {
  await openDebug(page);
  const originalSeed = 480_001;
  await page.evaluate(({ saveKey, originalSeed }) => {
    const legacy = globalThis.__TABENAI_DEBUG__.fresh(originalSeed, 'story');
    legacy.day = 12;
    legacy.scene = 'can';
    legacy.lastPlayedAt = '2026-08-01T01:02:03.000Z';
    localStorage.clear();
    localStorage.setItem(saveKey, JSON.stringify(legacy));
  }, { saveKey: SAVE_KEY, originalSeed });
  await page.reload();
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));

  const migrated = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.records());
  expect(migrated.migrations.singleRunToSlot1).toBe(true);
  expect(migrated.slots.map(slot => slot.run && slot.run.seed)).toEqual([originalSeed, null, null]);
  expect(migrated.activeSlotId).toBe('slot-1');
  expect(await page.evaluate(key => localStorage.getItem(key), MIGRATION_KEY)).toBe('1');

  await page.evaluate(saveKey => {
    const replacement = globalThis.__TABENAI_DEBUG__.fresh(480_999, 'hard');
    replacement.lastPlayedAt = '2026-07-31T01:02:03.000Z';
    localStorage.setItem(saveKey, JSON.stringify(replacement));
  }, SAVE_KEY);
  await page.reload();
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));
  const afterSecondBoot = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.records());
  expect(afterSecondBoot.slots.map(slot => slot.run && slot.run.seed)).toEqual([originalSeed, null, null]);
});

test('旧v2/v3キーは初回だけ移行し、最後のslot削除後にrunを復活させない', async ({ page }) => {
  await openDebug(page);
  await page.evaluate(({ saveKey, legacyKey }) => {
    const run = globalThis.__TABENAI_DEBUG__.fresh(480_101, 'story');
    run.version = 3;
    run.lastPlayedAt = '2026-08-01T00:00:00.000Z';
    localStorage.clear();
    localStorage.setItem(saveKey, '{corrupt-v4');
    localStorage.setItem(legacyKey, JSON.stringify(run));
  }, { saveKey: SAVE_KEY, legacyKey: 'tabenai-to-shinu-50days-v3' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));
  let migrated = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.records());
  expect(migrated.slots[0].run).toMatchObject({ seed: 480_101, mode: 'story', version: 4 });
  expect(migrated.migrations.singleRunToSlot1).toBe(true);

  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const records = globalThis.TabenaiRecords;
    api.setRecords(records.deleteSlot(api.records(), 'slot-1'));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));
  migrated = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.records());
  expect(migrated.slots.every(slot => slot.run === null)).toBe(true);
  expect(await page.evaluate(saveKey => localStorage.getItem(saveKey), SAVE_KEY)).toBeNull();
});

test('3スロットを分離し、active slotだけを従来保存キーへmirrorする', async ({ page }) => {
  await openDebug(page);
  const workspace = await seedSlots(page, [
    { slot: 1, seed: 481_001, mode: 'story', day: 9, name: '物語', timestamp: '2026-08-01T00:00:01.000Z' },
    { slot: 2, seed: 481_002, mode: 'hard', day: 17, name: '難路', timestamp: '2026-08-01T00:00:02.000Z' },
    { slot: 3, seed: 481_003, mode: 'survival', day: 31, name: '生存', timestamp: '2026-08-01T00:00:03.000Z' }
  ]);
  expect(workspace.slots.map(slot => ({ seed: slot.run.seed, mode: slot.run.mode, day: slot.run.day }))).toEqual([
    { seed: 481_001, mode: 'story', day: 9 },
    { seed: 481_002, mode: 'hard', day: 17 },
    { seed: 481_003, mode: 'survival', day: 31 }
  ]);
  expect(workspace.activeSlotId).toBe('slot-3');
  const persisted = await page.evaluate(({ saveKey, slotsKey, activeKey }) => ({
    mirror: JSON.parse(localStorage.getItem(saveKey)),
    slots: JSON.parse(localStorage.getItem(slotsKey)),
    active: localStorage.getItem(activeKey)
  }), { saveKey: SAVE_KEY, slotsKey: SLOTS_KEY, activeKey: ACTIVE_SLOT_KEY });
  expect(persisted.mirror).toMatchObject({ seed: 481_003, mode: 'survival', day: 31, version: 4 });
  expect(persisted.slots.slots.map(slot => slot.run.seed)).toEqual([481_001, 481_002, 481_003]);
  expect(persisted.active).toBe('slot-3');

  const switched = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    return api.setRecords(globalThis.TabenaiRecords.setActiveSlot(api.records(), 1));
  });
  expect(switched.activeSlotId).toBe('slot-1');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).seed, SAVE_KEY)).toBe(481_001);
});

test('スロット一覧から名前変更・複製・削除を行い、他スロットを壊さない', async ({ page }) => {
  await openDebug(page);
  await seedSlots(page, [
    { slot: 1, seed: 482_001, mode: 'story', day: 13, timestamp: '2026-08-01T01:00:00.000Z' },
    { slot: 3, seed: 482_003, mode: 'survival', day: 27, timestamp: '2026-08-01T03:00:00.000Z' }
  ]);
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));
  await page.locator('#continueBtn').click();
  await expect(page.locator('.slot-card')).toHaveCount(3);

  page.once('dialog', dialog => dialog.accept('森の記憶'));
  await page.locator('[data-slot-rename="slot-1"]').click();
  await expect(page.locator('[data-slot="slot-1"] h2')).toHaveText('森の記憶');

  page.once('dialog', dialog => dialog.accept('2'));
  await page.locator('[data-slot-copy="slot-1"]').click();
  await expect(page.locator('[data-slot="slot-2"]')).not.toHaveClass(/empty/);
  let records = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.records());
  expect(records.slots.map(slot => slot.run && slot.run.seed)).toEqual([482_001, 482_001, 482_003]);
  expect(records.slots[1].name).toContain('森の記憶');

  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-slot-delete="slot-2"]').click();
  await expect(page.locator('[data-slot="slot-2"]')).toHaveClass(/empty/);
  records = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.records());
  expect(records.slots.map(slot => slot.run && slot.run.seed)).toEqual([482_001, null, 482_003]);
  expect(records.slots[0].name).toBe('森の記憶');
});

test('使用中スロットの新規開始は明示確認なしに上書きしない', async ({ page }) => {
  await openDebug(page);
  await seedSlots(page, [
    { slot: 1, seed: 483_001, mode: 'story', day: 20, timestamp: '2026-08-01T00:00:00.000Z' }
  ]);
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));
  await page.locator('#newGameBtn').click();
  await page.locator('#modeHardBtn').click();
  await expect(page.locator('#slotScreen')).toBeVisible();

  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('[data-slot-start="slot-1"]').click();
  await expect(page.locator('#slotScreen')).toBeVisible();
  expect(await page.evaluate(() => globalThis.__TABENAI_DEBUG__.records().slots[0].run.seed)).toBe(483_001);

  page.once('dialog', dialog => dialog.accept());
  await Promise.all([
    page.waitForURL(/\?resume=1$/, { waitUntil: 'domcontentloaded' }),
    page.locator('[data-slot-start="slot-1"]').click()
  ]);
  const replacement = await page.evaluate(saveKey => JSON.parse(localStorage.getItem(saveKey)), SAVE_KEY);
  expect(replacement.mode).toBe('hard');
  expect(replacement.seed).not.toBe(483_001);
});

test('formatVersion 1／2／3を変更前にpreviewし、previewだけでは保存を変えない', async ({ page }) => {
  await openDebug(page);
  await seedSlots(page, [
    { slot: 1, seed: 484_001, mode: 'story', day: 8, timestamp: '2026-08-01T00:00:00.000Z' }
  ]);
  const payloads = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const legacy1 = api.fresh(484_101, 'story');
    legacy1.version = 1;
    const legacy2 = api.fresh(484_102, 'hard');
    legacy2.version = 2;
    return [
      { format: 'tabenai-save', formatVersion: 1, state: legacy1, exportedAt: '2026-08-01T00:00:00.000Z' },
      { format: 'tabenai-save', formatVersion: 2, run: legacy2, exportedAt: '2026-08-01T00:00:00.000Z' },
      api.transfer('all')
    ];
  });
  const before = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.records());
  await page.evaluate(() => document.querySelector('#dataModal').classList.add('open'));
  for (const [index, payload] of payloads.entries()) {
    await page.locator('#saveTransferText').fill(JSON.stringify(payload));
    await expect(page.locator('#importPreview')).toBeVisible();
    await expect(page.locator('#importPreview')).toContainText(`formatVersion ${index + 1}`);
    if (index < 2) {
      await expect(page.locator('#importPreview')).toContainText('slot-1');
      await expect(page.locator('#importPreview')).toContainText(String(484_101 + index));
    }
    expect(await page.evaluate(() => globalThis.__TABENAI_DEBUG__.records())).toEqual(before);
  }
});

test('formatVersion 3全体復元は空slotと永続metaを含む置換対象をpreviewして確認後に復元する', async ({ page }) => {
  await openDebug(page);
  await seedSlots(page, [
    { slot: 1, seed: 484_301, mode: 'story', day: 8, timestamp: '2026-08-01T00:00:00.000Z' },
    { slot: 2, seed: 484_302, mode: 'hard', day: 18, timestamp: '2026-08-01T00:01:00.000Z' },
    { slot: 3, seed: 484_303, mode: 'survival', day: 28, timestamp: '2026-08-01T00:02:00.000Z' }
  ]);
  const payload = await page.evaluate(({ metaKey, endingKey }) => {
    const api = globalThis.__TABENAI_DEBUG__;
    const records = globalThis.TabenaiRecords;
    const currentMeta = api.meta();
    currentMeta.achievements.first_bite = { unlockedAt: '2026-08-01T00:00:00.000Z' };
    api.setMeta(currentMeta);
    localStorage.setItem(endingKey, JSON.stringify({ true: 4 }));
    const empty = records.freshWorkspace();
    return records.makeTransferPayload(empty, {
      appVersion: '4.8.0',
      exportedAt: '2026-08-01T03:00:00.000Z',
      meta: {},
      endings: {}
    });
  }, { metaKey: META_KEY, endingKey: ENDING_KEY });

  await page.evaluate(() => document.querySelector('#dataModal').classList.add('open'));
  await page.locator('#saveTransferText').fill(JSON.stringify(payload));
  await expect(page.locator('#importPreview')).toContainText('保存スロット：すべて空');
  await expect(page.locator('#importPreview')).toContainText('上書き／消去対象：slot-1、slot-2、slot-3');
  await expect(page.locator('#importPreview')).toContainText('永続meta・設定・実績・図鑑・履歴・日替わり記録');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#importSaveBtn').click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => Boolean(globalThis.TabenaiRecords));
  const restored = await page.evaluate(({ slotsKey, metaKey, endingKey }) => ({
    slots: JSON.parse(localStorage.getItem(slotsKey)),
    meta: JSON.parse(localStorage.getItem(metaKey)),
    endings: JSON.parse(localStorage.getItem(endingKey))
  }), { slotsKey: SLOTS_KEY, metaKey: META_KEY, endingKey: ENDING_KEY });
  expect(restored.slots.slots.every(slot => slot.run === null)).toBe(true);
  expect(restored.meta.achievements).toEqual({});
  expect(restored.endings).toEqual({});
});

test('実プレイだけが図鑑を解除し、reload再描画で重複せずA/B・摂取・拒否を別集計する', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('./');
  await page.locator('#recordsBtn').click();
  await page.locator('[data-record-tab="codex"]').click();
  await page.waitForSelector('[data-codex-id="story:riceball"]');
  await expect(page.locator('[data-codex-id="story:riceball"]')).toHaveAttribute('data-discovered', 'false');
  await page.locator('#recordsBackBtn').click();

  await startStoryInSlot(page, 'slot-1');
  expect((await codexEntry(page, 'events', 'story:riceball')).encounterCount).toBe(1);
  await page.reload();
  await resumeFromTitleIfNeeded(page, 'slot-1');
  expect((await codexEntry(page, 'events', 'story:riceball')).encounterCount).toBe(1);
  await page.locator('#choiceA').click();
  await expect.poll(async () => (await codexEntry(page, 'foods', 'story:riceball')).choiceA).toBe(1);

  await page.evaluate(() => document.querySelector('#titleBtn').click());
  await expect(page.locator('#titleScreen')).toBeVisible();
  await startStoryInSlot(page, 'slot-2');
  await page.locator('#choiceB').click();
  await expect.poll(async () => (await codexEntry(page, 'foods', 'story:riceball')).choiceB).toBe(1);

  const food = await codexEntry(page, 'foods', 'story:riceball');
  expect(food).toMatchObject({
    discovered: true,
    encounterCount: 2,
    choiceA: 1,
    choiceB: 1,
    consumedCount: 1,
    refusedCount: 1,
    modes: ['story']
  });
  await page.evaluate(() => document.querySelector('#titleBtn').click());
  await page.locator('#recordsBtn').click();
  await page.locator('[data-record-tab="codex"]').click();
  await page.waitForSelector('[data-codex-id="story:riceball"][data-discovered="true"]');
  await expect(page.locator('[data-codex-id="story:riceball"]')).toContainText('遭遇 2回');
  await expect(page.locator('[data-codex-id="story:riceball"]')).toContainText('摂取 1 ・ 拒否 1');
  await expect(page.locator('[data-codex-id="story:riceball"] img')).toHaveCount(1);
  await page.locator('#recordsBackBtn').click();
  await page.locator('#settingsBtn').click();
  await page.locator('#lightVisualsSetting').check();
  await page.locator('#settingsBackBtn').click();
  await page.locator('#recordsBtn').click();
  await page.locator('[data-record-tab="codex"]').click();
  await page.waitForSelector('[data-codex-id="story:riceball"][data-discovered="true"]');
  await expect(page.locator('[data-codex-id="story:riceball"] img')).toHaveCount(0);
  await expect(page.locator('[data-codex-id="story:riceball"] [data-codex-fallback]')).toBeVisible();
});

test('debug遷移は図鑑を解除しない', async ({ page }) => {
  await openDebug(page);
  const counts = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    api.start('story', 485_001);
    api.step(0);
    api.step(1);
    return globalThis.TabenaiRecords.codexCounts(api.records().codex);
  });
  expect(counts).toEqual({
    total: 0,
    categories: { foods: 0, events: 0, characters: 0, endings: 0 }
  });
});

test('多段階の食物場面も図鑑へ登録し、他者へ与えた物と直接拒否を本人摂取から分離する', async ({ page }) => {
  await openDebug(page);
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const records = globalThis.TabenaiRecords;
    const run = api.fresh(488_381, 'story');
    run.scene = 'shadowRiceBread';
    run.day = 38;
    run.flags.shadowHunger = true;
    run.startedAt = '2026-08-01T00:00:00.000Z';
    run.lastPlayedAt = run.startedAt;
    const workspace = records.setSlot(records.freshWorkspace(), 1, run, {
      timestamp: run.lastPlayedAt,
      activate: true
    });
    api.setRecords(workspace);
  });
  await page.goto('./');
  await page.locator('#continueBtn').click();
  await page.locator('[data-slot-continue="slot-1"]').click();
  await page.locator('#choiceB').click();
  await expect.poll(async () => (await codexEntry(page, 'foods', 'story:shadowRiceBread'))?.choiceB).toBe(1);
  expect(await codexEntry(page, 'foods', 'story:shadowRiceBread')).toMatchObject({
    discovered: true,
    consumedCount: 0,
    refusedCount: 0
  });

  await openDebug(page);
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const records = globalThis.TabenaiRecords;
    const run = api.fresh(488_382, 'story');
    run.scene = 'beanUse';
    run.day = 31;
    run.startedAt = '2026-08-01T01:00:00.000Z';
    run.lastPlayedAt = run.startedAt;
    let workspace = api.records();
    workspace = records.setSlot(workspace, 2, run, {
      timestamp: run.lastPlayedAt,
      activate: true
    });
    api.setRecords(workspace);
  });
  await page.goto('./');
  await page.locator('#continueBtn').click();
  await page.locator('[data-slot-continue="slot-2"]').click();
  await page.locator('#choiceB').click();
  await expect.poll(async () => (await codexEntry(page, 'foods', 'story:beanUse'))?.refusedCount).toBe(1);
  expect(await codexEntry(page, 'foods', 'story:beanUse')).toMatchObject({
    choiceB: 1,
    consumedCount: 0,
    refusedCount: 1
  });
});

test('完了履歴を重複なし・新しい順・最大30件で表示し、詳細と運命コードを保持する', async ({ page }) => {
  await openDebug(page);
  const result = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const records = globalThis.TabenaiRecords;
    let workspace = records.freshWorkspace();
    for (let index = 0; index < 35; index += 1) {
      const run = api.fresh(486_000 + index, index % 3 === 0 ? 'survival' : 'story');
      run.ended = true;
      run.day = 50;
      run.hp = 50 + (index % 20);
      run.hunger = 20 + (index % 30);
      run.stats.ate = 10 + index;
      run.stats.skipped = 5 + index;
      run.ending = { code: 'true', title: `記憶の結末 ${index}` };
      const completedAt = new Date(Date.UTC(2026, 7, 1, 0, 0, index)).toISOString();
      const item = records.makeRunResult(run, {
        gameVersion: '4.8.0',
        completedAt,
        choices: [0, 1, index % 2],
        timeline: [{ order: 1, day: 1, sceneId: 'story:riceball', title: '少し温かいおにぎり', choiceIndex: 0, choice: '食べる', hpBefore: 100, hpAfter: 100, hungerBefore: 25, hungerAfter: 0 }],
        unlockedAchievements: index === 34 ? ['result_saved'] : []
      });
      workspace.history = records.addRunHistory(workspace.history, item).history;
      workspace.history = records.addRunHistory(workspace.history, item).history;
    }
    api.setRecords(workspace);
    api.screen('records');
    return { count: workspace.history.length, newestSeed: workspace.history[0].seed };
  });
  expect(result).toEqual({ count: 30, newestSeed: 486_034 });
  await page.locator('[data-record-tab="history"]').click();
  await expect(page.locator('.history-card')).toHaveCount(30);
  const first = page.locator('.history-card').first();
  await expect(first).toContainText('SEED 486034');
  await expect(first).toContainText('摂取 44');
  await expect(first.locator('.fate-code')).toHaveValue(/^TABENAI-FATE-1\./);
  await first.locator('details').open?.();
  await expect(first.locator('details')).toContainText('少し温かいおにぎり');
  await expect(first.locator('[data-share-result]')).toHaveCount(1);
});

test('同じ運命コードは同じseed・明示選択列から同じイベント列と判定を再現する', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('./');
  const choices = [0, 1, 0, 1, 0];
  const code = await page.evaluate(choices => globalThis.TabenaiRecords.encodeFateCode({
    gameVersion: '4.8.0', mode: 'story', seed: 487_001, choices
  }), choices);

  const replay = async () => {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.locator('#newGameBtn').click();
    await page.locator('#fateOpenBtn').click();
    await page.locator('#fateCodeText').fill(code);
    await page.locator('#fatePreviewBtn').click();
    await expect(page.locator('#fatePreview')).toContainText('SEED 487001');
    await expect(page.locator('#fatePreview')).toContainText('明示選択 5回');
    await page.locator('#fateStartBtn').click();
    await expect(page.locator('#slotScreen')).toBeVisible();
    await Promise.all([
      page.waitForURL(/\?resume=1$/, { waitUntil: 'domcontentloaded' }),
      page.locator('[data-slot-start="slot-1"]').click()
    ]);
    for (let index = 0; index < choices.length; index += 1) {
      await page.locator(choices[index] === 0 ? '#choiceA' : '#choiceB').click();
      await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)).choiceCount, SAVE_KEY)).toBe(index + 1);
      // The UI intentionally locks choices for 180ms to prevent accidental double taps.
      await page.waitForTimeout(220);
    }
    return page.evaluate(key => {
      const run = JSON.parse(localStorage.getItem(key));
      return {
        seed: run.seed,
        scene: run.scene,
        day: run.day,
        hp: run.hp,
        hunger: run.hunger,
        rngState: run.rngState,
        lastRoll: run.lastRoll,
        flags: run.flags,
        companions: run.companions,
        choices: run.recording.choices,
        expectedChoices: run.recording.expectedChoices,
        fateReplay: run.recording.fateReplay
      };
    }, SAVE_KEY);
  };

  const first = await replay();
  await page.evaluate(() => localStorage.clear());
  const second = await replay();
  expect(second).toEqual(first);
  expect(first).toMatchObject({ seed: 487_001, choices, expectedChoices: choices, fateReplay: true });
});

test('JST日付境界を固定し、今日の献立を初回オンライン後にオフライン再起動できる', async ({ page, context }) => {
  test.setTimeout(90_000);
  await page.goto('./');
  const boundary = await page.evaluate(() => ({
    before: globalThis.TabenaiRecords.dailyInfo('2026-07-31T14:59:59.999Z'),
    after: globalThis.TabenaiRecords.dailyInfo('2026-07-31T15:00:00.000Z'),
    fixed: globalThis.TabenaiRecords.dailyInfo('2026-08-01')
  }));
  expect(boundary.before.date).toBe('2026-07-31');
  expect(boundary.after).toEqual(boundary.fixed);
  expect(boundary.fixed.seed).toBe(1_264_873_921);

  await page.evaluate(() => navigator.serviceWorker.ready);
  const daily = await page.evaluate(() => ({
    date: document.querySelector('#dailyStartBtn').dataset.dailyDate,
    seed: Number(document.querySelector('#dailyStartBtn').dataset.dailySeed)
  }));
  await page.locator('#dailyStartBtn').click();
  await expect(page.locator('#slotContext')).toContainText(`今日の献立 ${daily.date}`);
  await Promise.all([
    page.waitForURL(/\?resume=1$/, { waitUntil: 'domcontentloaded' }),
    page.locator('[data-slot-start="slot-1"]').click()
  ]);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const online = await page.evaluate(({ saveKey, dailyKey, date }) => ({
    run: JSON.parse(localStorage.getItem(saveKey)),
    daily: JSON.parse(localStorage.getItem(dailyKey))[date]
  }), { saveKey: SAVE_KEY, dailyKey: DAILY_KEY, date: daily.date });
  expect(online.run).toMatchObject({ mode: 'survival', seed: daily.seed });
  expect(online.run.recording.dailyDate).toBe(daily.date);
  expect(online.daily).toMatchObject({ attempts: 1, bestDay: 1, cleared: false });

  try {
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await resumeFromTitleIfNeeded(page, 'slot-1');
    const offline = await page.evaluate(({ saveKey, dailyKey, date }) => ({
      seed: JSON.parse(localStorage.getItem(saveKey)).seed,
      attempts: JSON.parse(localStorage.getItem(dailyKey))[date].attempts
    }), { saveKey: SAVE_KEY, dailyKey: DAILY_KEY, date: daily.date });
    expect(offline).toEqual({ seed: daily.seed, attempts: 1 });
  } finally {
    await context.setOffline(false);
  }
});

test('破損した分割storageを安全に縮退し、従来runを失わない', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await openDebug(page);
  await page.evaluate(({ saveKey, slotsKey, historyKey, codexKey, dailyKey, migrationKey }) => {
    const run = globalThis.__TABENAI_DEBUG__.fresh(488_001, 'story');
    run.lastPlayedAt = '2026-08-01T00:00:00.000Z';
    localStorage.clear();
    localStorage.setItem(saveKey, JSON.stringify(run));
    localStorage.setItem(slotsKey, '{broken');
    localStorage.setItem(historyKey, 'not-json');
    localStorage.setItem(codexKey, '{');
    localStorage.setItem(dailyKey, '[bad');
    localStorage.setItem(migrationKey, '1');
  }, { saveKey: SAVE_KEY, slotsKey: SLOTS_KEY, historyKey: HISTORY_KEY, codexKey: CODEX_KEY, dailyKey: DAILY_KEY, migrationKey: MIGRATION_KEY });
  await page.reload();
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));
  const restored = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.records());
  expect(restored.slots[0].run.seed).toBe(488_001);
  expect(restored.history).toEqual([]);
  expect(restored.codex.categories.events).toEqual({});
  expect(restored.dailyRecords).toEqual({});
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));
  await expect(page.locator('#runSummary')).toContainText('記録の破損または容量不足を検出しました');
  expect(errors).toEqual([]);
});

test('容量不足時もactive runの従来mirrorを先に退避して進行を継続する', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openDebug(page);
  const result = await page.evaluate(saveKey => {
    const api = globalThis.__TABENAI_DEBUG__;
    const records = globalThis.TabenaiRecords;
    const original = Storage.prototype.setItem;
    const run = api.fresh(489_001, 'story');
    run.lastPlayedAt = '2026-08-01T00:00:00.000Z';
    let workspace = records.setSlot(records.freshWorkspace(), 1, run, { timestamp: run.lastPlayedAt });
    const historyItem = records.makeRunResult({ ...run, ended: true, ending: { code: 'true', title: '生還' } }, {
      gameVersion: '4.8.0', completedAt: '2026-08-01T01:00:00.000Z', choices: [0, 1], timeline: Array.from({ length: 80 }, (_, index) => ({ order: index, text: 'x'.repeat(200) }))
    });
    workspace.history = records.addRunHistory([], historyItem).history;
    Storage.prototype.setItem = function patched(key, value) {
      if (key.includes('run-history') || key.includes('codex')) throw new DOMException('quota', 'QuotaExceededError');
      return original.call(this, key, value);
    };
    try { api.setRecords(workspace); } finally { Storage.prototype.setItem = original; }
    return {
      mirror: JSON.parse(localStorage.getItem(saveKey)),
      liveSeed: api.records().slots[0].run.seed
    };
  }, SAVE_KEY);
  expect(result).toMatchObject({ mirror: { seed: 489_001, version: 4 }, liveSeed: 489_001 });
  expect(errors).toEqual([]);
});

test('単一slot取込も永続記録の置換を明示し、後段storage失敗時は全キーを原子的に復元する', async ({ page }) => {
  await openDebug(page);
  await seedSlots(page, [
    { slot: 1, seed: 489_501, mode: 'story', day: 12, timestamp: '2026-08-01T00:00:00.000Z' },
    { slot: 2, seed: 489_502, mode: 'hard', day: 18, timestamp: '2026-08-01T00:01:00.000Z' }
  ]);
  const setup = await page.evaluate(({ endingKey }) => {
    const api = globalThis.__TABENAI_DEBUG__;
    const records = globalThis.TabenaiRecords;
    localStorage.setItem(endingKey, JSON.stringify({ true: 2 }));
    const currentMeta = api.meta();
    currentMeta.achievements.first_bite = { unlockedAt: '2026-08-01T00:00:00.000Z' };
    api.setMeta(currentMeta);
    const incomingRun = api.fresh(489_599, 'survival');
    incomingRun.lastPlayedAt = '2026-08-02T00:00:00.000Z';
    let incoming = records.setSlot(records.freshWorkspace(), 1, incomingRun, {
      timestamp: incomingRun.lastPlayedAt,
      activate: true
    });
    const payload = records.makeTransferPayload(incoming, {
      slotId: 'slot-1',
      appVersion: '4.8.0',
      exportedAt: '2026-08-02T00:00:00.000Z',
      meta: {},
      endings: {}
    });
    const keys = [...new Set([
      'tabenai-to-shinu-50days-v4',
      'tabenai-to-shinu-meta-v1',
      endingKey,
      ...Object.values(records.storageKeys)
    ])];
    return {
      payload,
      keys,
      before: Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]))
    };
  }, { endingKey: ENDING_KEY });

  await page.evaluate(() => document.querySelector('#dataModal').classList.add('open'));
  await page.locator('#saveTransferText').fill(JSON.stringify(setup.payload));
  await expect(page.locator('#importPreview')).toContainText('永続meta・設定・実績・図鑑・履歴・日替わり記録');
  await page.evaluate(endingKey => {
    const original = Storage.prototype.setItem;
    globalThis.__restoreStorageSetItem = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function patched(key, value) {
      if (key === endingKey) throw new DOMException('quota', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  }, ENDING_KEY);
  const dialogs = [];
  const acceptDialogs = async dialog => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    await dialog.accept();
  };
  page.on('dialog', acceptDialogs);
  try {
    await page.locator('#importSaveBtn').click();
    await expect.poll(() => dialogs.some(item => item.type === 'alert' && item.message.includes('読み込みに失敗'))).toBe(true);
  } finally {
    page.off('dialog', acceptDialogs);
    await page.evaluate(() => globalThis.__restoreStorageSetItem());
  }
  const after = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), setup.keys);
  expect(after).toEqual(setup.before);
  const live = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.records());
  expect(live.slots[0].run.seed).toBe(489_501);
  expect(live.slots[1].run.seed).toBe(489_502);
});

test('自動保存がmirrorと縮約の両方で失敗した時も利用者へ明示通知する', async ({ page }) => {
  await openDebug(page);
  await seedSlots(page, [
    { slot: 1, seed: 489_601, mode: 'story', day: 10, timestamp: '2026-08-01T00:00:00.000Z' }
  ]);
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const records = globalThis.TabenaiRecords;
    const nextRun = api.fresh(489_602, 'hard');
    nextRun.lastPlayedAt = '2026-08-02T00:00:00.000Z';
    const next = records.setSlot(api.records(), 1, nextRun, {
      timestamp: nextRun.lastPlayedAt,
      activate: true
    });
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function unavailable() {
      throw new DOMException('quota', 'QuotaExceededError');
    };
    try { api.setRecords(next); } finally { Storage.prototype.setItem = original; }
  });
  await expect(page.locator('#toast')).toContainText('保存に失敗しました');
  await expect(page.locator('#toast')).toContainText('全体バックアップ');
});

test('meta単独保存の失敗も成功を偽装せず利用者へ通知する', async ({ page }) => {
  await openDebug(page);
  const result = await page.evaluate(metaKey => {
    const api = globalThis.__TABENAI_DEBUG__;
    const before = localStorage.getItem(metaKey);
    const next = api.meta();
    next.settings.fontSize = 'large';
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function metaUnavailable(key, value) {
      if (key === metaKey) throw new DOMException('quota', 'QuotaExceededError');
      return original.call(this, key, value);
    };
    try { api.setMeta(next); } finally { Storage.prototype.setItem = original; }
    return {
      before,
      after: localStorage.getItem(metaKey),
      liveFontSize: api.meta().settings.fontSize
    };
  }, META_KEY);
  expect(result.after).toBe(result.before);
  expect(result.liveFontSize).toBe('large');
  await expect(page.locator('#toast')).toContainText('保存に失敗しました');
});

test('iPhone 390×844でタイトル・スロット・図鑑・運命コードに横溢れがない', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await openDebug(page);
  await seedSlots(page, [
    { slot: 1, seed: 490_001, mode: 'story', day: 9, timestamp: '2026-08-01T00:00:00.000Z' },
    { slot: 2, seed: 490_002, mode: 'hard', day: 19, timestamp: '2026-08-01T00:00:01.000Z' },
    { slot: 3, seed: 490_003, mode: 'survival', day: 29, timestamp: '2026-08-01T00:00:02.000Z' }
  ]);
  const assertNoOverflow = async selector => {
    const dimensions = await page.locator(selector).evaluate(element => ({
      elementScroll: element.scrollWidth,
      elementClient: element.clientWidth,
      documentScroll: document.documentElement.scrollWidth,
      documentClient: document.documentElement.clientWidth
    }));
    expect(dimensions.elementScroll).toBeLessThanOrEqual(dimensions.elementClient + 1);
    expect(dimensions.documentScroll).toBeLessThanOrEqual(dimensions.documentClient + 1);
  };

  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));
  await assertNoOverflow('#titleScreen');
  const titleHeight = await page.locator('#titleScreen').evaluate(element => element.scrollHeight);
  expect(titleHeight).toBeLessThanOrEqual(1_050);
  await page.locator('#continueBtn').click();
  await assertNoOverflow('#slotScreen');
  await page.locator('#slotBackBtn').click();
  await page.locator('#recordsBtn').click();
  await page.locator('[data-record-tab="codex"]').click();
  await page.waitForFunction(() => Number(document.querySelector('#codexGrid')?.dataset.renderedCount || 0) > 0);
  await assertNoOverflow('#recordsScreen');
  await page.locator('#recordsBackBtn').click();
  await page.locator('#newGameBtn').click();
  await page.locator('#fateOpenBtn').click();
  await expect(page.locator('#fateModal')).toHaveClass(/open/);
  await assertNoOverflow('#fateModal .modal-box');
  expect(errors).toEqual([]);
});

test('formatVersion 3の取込履歴は悪性HTMLを実行せずnumeric timelineを正規化する', async ({ page }) => {
  await openDebug(page);
  const malicious = '<img src=x onerror="globalThis.__storedXss=(globalThis.__storedXss||0)+1">';
  const normalized = await page.evaluate(maliciousValue => {
    globalThis.__storedXss = 0;
    const api = globalThis.__TABENAI_DEBUG__;
    const run = api.fresh(492_001, 'story');
    const payload = {
      format: 'tabenai-save',
      formatVersion: 3,
      appVersion: '4.8.0',
      exportedAt: '2026-08-01T00:00:00.000Z',
      scope: 'all',
      slots: [],
      activeSlotId: null,
      history: [{
        runId: 'run-import-xss',
        gameVersion: '4.8.0',
        mode: 'invalid-mode',
        seed: run.seed,
        day: -42,
        hp: 'not-a-number',
        hunger: 'Infinity',
        ending: { code: 'true', title: maliciousValue },
        title: maliciousValue,
        choices: [0, 1],
        timeline: [
          31337,
          null,
          {
            order: -9,
            day: 99_999,
            title: maliciousValue,
            choice: 31337,
            choiceIndex: 8,
            hpBefore: 'NaN',
            hpAfter: 'Infinity',
            hungerBefore: -4,
            hungerAfter: '12.5'
          }
        ]
      }],
      codex: {},
      dailyRecords: {},
      meta: {},
      endings: {}
    };
    const imported = globalThis.TabenaiRecords.normalizeTransfer(payload);
    api.setRecords(imported.workspace);
    api.screen('records');
    return imported.workspace.history[0];
  }, malicious);

  expect(normalized).toMatchObject({ mode: 'story', day: 0, hp: 0, hunger: 0 });
  expect(normalized.timeline).toHaveLength(1);
  expect(normalized.timeline[0]).toMatchObject({
    order: 1,
    day: 9_999,
    choice: null,
    choiceIndex: null,
    hpBefore: 0,
    hpAfter: 0,
    hungerBefore: -4,
    hungerAfter: 12.5
  });

  await page.locator('[data-record-tab="history"]').click();
  await expect(page.locator('.history-card')).toHaveCount(1);
  await expect(page.locator('.history-card')).toContainText(malicious);
  await expect(page.locator('.history-card img[src="x"], .history-card script, .history-card svg')).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.__storedXss)).toBe(0);
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key))[0], HISTORY_KEY);
  expect(stored.timeline).toHaveLength(1);
  expect(stored.timeline[0].choice).toBeNull();
});

test('日替わり同seed再挑戦だけdailyDateを維持し、運命コードとリセットは解除する', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('./');
  const daily = await page.evaluate(() => ({
    date: document.querySelector('#dailyStartBtn').dataset.dailyDate,
    seed: Number(document.querySelector('#dailyStartBtn').dataset.dailySeed)
  }));
  await page.locator('#dailyStartBtn').click();
  await Promise.all([
    page.waitForURL(/\?resume=1$/, { waitUntil: 'domcontentloaded' }),
    page.locator('[data-slot-start="slot-1"]').click()
  ]);

  await page.goto(DEBUG_URL);
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const ended = api.snapshot();
    ended.ended = true;
    ended.ending = { code: 'true', title: '生還' };
    api.setState(ended);
  });
  await Promise.all([
    page.waitForURL(/\?resume=1$/, { waitUntil: 'domcontentloaded' }),
    page.locator('#sameSeedRestart').click()
  ]);
  let run = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  expect(run.seed).toBe(daily.seed);
  expect(run.recording.dailyDate).toBe(daily.date);

  await page.evaluate(() => document.querySelector('#titleBtn').click());
  await page.locator('#newGameBtn').click();
  const fateCode = await page.evaluate(() => globalThis.TabenaiRecords.encodeFateCode({
    gameVersion: '4.8.0', mode: 'story', seed: 492_102, choices: [0]
  }));
  await page.locator('#fateOpenBtn').click();
  await page.locator('#fateCodeText').fill(fateCode);
  await page.locator('#fatePreviewBtn').click();
  await page.locator('#fateStartBtn').click();
  await Promise.all([
    page.waitForURL(/\?resume=1$/, { waitUntil: 'domcontentloaded' }),
    page.locator('[data-slot-start="slot-2"]').click()
  ]);
  run = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  expect(run).toMatchObject({ seed: 492_102, recording: { dailyDate: null, fateReplay: true } });

  await page.evaluate(() => document.querySelector('#titleBtn').click());
  await page.locator('#continueBtn').click();
  await page.locator('[data-slot-continue="slot-1"]').click();
  page.once('dialog', dialog => dialog.accept());
  await Promise.all([
    page.waitForEvent('framenavigated'),
    page.evaluate(() => document.querySelector('#resetBtn').click())
  ]);
  await page.waitForLoadState('domcontentloaded');
  run = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  expect(run.recording.dailyDate).toBeNull();
  expect(run.recording.fateReplay).toBe(false);
});

test('運命コードは不一致入力で状態を消費せずseed 0をreload後も保持する', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('./');
  const fateCode = await page.evaluate(() => globalThis.TabenaiRecords.encodeFateCode({
    gameVersion: '4.8.0', mode: 'story', seed: 0, choices: [0, 1]
  }));
  await page.locator('#newGameBtn').click();
  await page.locator('#fateOpenBtn').click();
  await page.locator('#fateCodeText').fill(fateCode);
  await page.locator('#fatePreviewBtn').click();
  await page.locator('#fateStartBtn').click();
  await Promise.all([
    page.waitForURL(/\?resume=1$/, { waitUntil: 'domcontentloaded' }),
    page.locator('[data-slot-start="slot-1"]').click()
  ]);

  const snapshot = () => page.evaluate(key => {
    const run = JSON.parse(localStorage.getItem(key));
    return {
      seed: run.seed,
      rngState: run.rngState,
      choiceCount: run.choiceCount,
      day: run.day,
      scene: run.scene,
      lastRoll: run.lastRoll,
      choices: run.recording.choices
    };
  }, SAVE_KEY);
  const before = await snapshot();
  await page.locator('#choiceB').click();
  expect(await snapshot()).toEqual(before);

  await page.locator('#choiceA').click();
  await expect.poll(async () => (await snapshot()).choiceCount).toBe(1);
  await page.reload({ waitUntil: 'domcontentloaded' });
  expect((await snapshot()).seed).toBe(0);
  if (await page.locator('#titleScreen').isVisible()) {
    await page.locator('#continueBtn').click();
    await page.locator('[data-slot-continue="slot-1"]').click();
  }
  await expect(page.locator('#gameScreen')).toBeVisible();
  const afterReload = await snapshot();
  expect(afterReload.seed).toBe(0);
  const beforeSecondMismatch = await snapshot();
  await page.locator('#choiceA').click();
  expect(await snapshot()).toEqual(beforeSecondMismatch);
});

test('完了slotを複製して再表示しても同一runIdの履歴を重複登録しない', async ({ page }) => {
  await openDebug(page);
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const records = globalThis.TabenaiRecords;
    const run = api.fresh(492_201, 'story');
    run.ended = true;
    run.ending = { code: 'true', title: '生還' };
    run.day = 50;
    run.startedAt = '2026-08-01T00:00:00.000Z';
    run.lastPlayedAt = '2026-08-01T01:00:00.000Z';
    run.recording = {
      runId: 'run-completed-duplicate',
      slotId: 'slot-1',
      choices: [0],
      timeline: [],
      encounterTokens: [],
      dailyDate: null,
      fateReplay: false,
      expectedChoices: [],
      achievementIdsAtStart: []
    };
    let workspace = records.setSlot(records.freshWorkspace(), 1, run, {
      timestamp: run.lastPlayedAt,
      activate: true
    });
    const result = records.makeRunResult(run, {
      runId: run.recording.runId,
      gameVersion: '4.8.0',
      completedAt: run.lastPlayedAt,
      choices: run.recording.choices
    });
    workspace.history = records.addRunHistory([], result).history;
    api.setRecords(workspace);
  });
  await page.goto('./');
  await page.locator('#continueBtn').click();
  page.once('dialog', dialog => dialog.accept('2'));
  await page.locator('[data-slot-copy="slot-1"]').click();
  await page.locator('[data-slot-continue="slot-2"]').click();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).length, HISTORY_KEY)).toBe(1);
  await page.reload({ waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).length, HISTORY_KEY)).toBe(1);
  const records = await page.evaluate(({ slotsKey, historyKey }) => ({
    slots: JSON.parse(localStorage.getItem(slotsKey)),
    history: JSON.parse(localStorage.getItem(historyKey))
  }), { slotsKey: SLOTS_KEY, historyKey: HISTORY_KEY });
  expect(records.slots.slots[1].run.recording.runId).toBe('run-completed-duplicate');
  expect(records.slots.slots[1].run.recording.slotId).toBe('slot-2');
  expect(records.history[0].runId).toBe('run-completed-duplicate');
});

test('mirror成功後のslots Quota失敗はreload時に新しいmirrorから復旧する', async ({ page }) => {
  await openDebug(page);
  await seedSlots(page, [{
    slot: 1,
    seed: 492_301,
    mode: 'story',
    day: 8,
    timestamp: '2026-08-01T00:00:00.000Z'
  }]);
  const interrupted = await page.evaluate(({ saveKey, slotsKey }) => {
    const api = globalThis.__TABENAI_DEBUG__;
    const records = globalThis.TabenaiRecords;
    const original = Storage.prototype.setItem;
    const replacement = api.fresh(492_302, 'hard');
    replacement.day = 24;
    replacement.lastPlayedAt = '2026-08-02T00:00:00.000Z';
    const next = records.setSlot(api.records(), 1, replacement, {
      timestamp: replacement.lastPlayedAt,
      activate: true
    });
    Storage.prototype.setItem = function patched(key, value) {
      if (key === slotsKey) throw new DOMException('quota', 'QuotaExceededError');
      return original.call(this, key, value);
    };
    try { api.setRecords(next); } finally { Storage.prototype.setItem = original; }
    return {
      mirrorSeed: JSON.parse(localStorage.getItem(saveKey)).seed,
      splitSeed: JSON.parse(localStorage.getItem(slotsKey)).slots[0].run.seed
    };
  }, { saveKey: SAVE_KEY, slotsKey: SLOTS_KEY });
  expect(interrupted).toEqual({ mirrorSeed: 492_302, splitSeed: 492_301 });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));
  const recovered = await page.evaluate(({ saveKey, slotsKey }) => ({
    live: globalThis.__TABENAI_DEBUG__.records().slots[0].run,
    mirror: JSON.parse(localStorage.getItem(saveKey)),
    split: JSON.parse(localStorage.getItem(slotsKey)).slots[0].run
  }), { saveKey: SAVE_KEY, slotsKey: SLOTS_KEY });
  expect(recovered.live).toMatchObject({ seed: 492_302, mode: 'hard', day: 24 });
  expect(recovered.mirror).toMatchObject({ seed: 492_302, mode: 'hard', day: 24 });
  expect(recovered.split).toMatchObject({ seed: 492_302, mode: 'hard', day: 24 });
});

test('同一runを複製した旧saveでも新しいactive mirrorを元のactive slotへ復旧する', async ({ page }) => {
  await openDebug(page);
  await page.evaluate(saveKey => {
    const api = globalThis.__TABENAI_DEBUG__;
    const records = globalThis.TabenaiRecords;
    const run = api.fresh(492_401, 'story');
    run.startedAt = '2026-08-01T00:00:00.000Z';
    run.lastPlayedAt = '2026-08-01T01:00:00.000Z';
    run.day = 9;
    delete run.recording;
    let workspace = records.setSlot(records.freshWorkspace(), 1, run, {
      timestamp: run.lastPlayedAt,
      activate: false
    });
    workspace = records.setSlot(workspace, 2, run, {
      timestamp: run.lastPlayedAt,
      activate: true
    });
    api.setRecords(workspace);
    const newerMirror = structuredClone(run);
    newerMirror.day = 24;
    newerMirror.scene = 'timeNoodle';
    newerMirror.lastPlayedAt = '2026-08-02T01:00:00.000Z';
    localStorage.setItem(saveKey, JSON.stringify(newerMirror));
  }, SAVE_KEY);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));
  const restored = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.records());
  expect(restored.activeSlotId).toBe('slot-2');
  expect(restored.slots[0].run).toMatchObject({ seed: 492_401, day: 9 });
  expect(restored.slots[1].run).toMatchObject({ seed: 492_401, day: 24, scene: 'timeNoodle' });
});

test('active runの古いrecording.slotIdを信頼して別slotを上書きしない', async ({ page }) => {
  await openDebug(page);
  await page.evaluate(({ saveKey, slotsKey }) => {
    const api = globalThis.__TABENAI_DEBUG__;
    const records = globalThis.TabenaiRecords;
    const first = api.fresh(492_501, 'story');
    first.startedAt = '2026-08-01T00:00:00.000Z';
    first.lastPlayedAt = '2026-08-01T01:00:00.000Z';
    const active = api.fresh(492_503, 'survival');
    active.startedAt = '2026-08-02T00:00:00.000Z';
    active.lastPlayedAt = '2026-08-02T01:00:00.000Z';
    active.recording = {
      runId: 'completed-stale-slot-claim',
      slotId: 'slot-1',
      choices: [0],
      timeline: [],
      encounterTokens: []
    };
    let workspace = records.setSlot(records.freshWorkspace(), 1, first, {
      timestamp: first.lastPlayedAt,
      activate: false
    });
    workspace = records.setSlot(workspace, 3, active, {
      timestamp: active.lastPlayedAt,
      activate: true
    });
    api.setRecords(workspace);
    const storedSlots = JSON.parse(localStorage.getItem(slotsKey));
    storedSlots.slots[2].run.recording.slotId = 'slot-1';
    localStorage.setItem(slotsKey, JSON.stringify(storedSlots));
    const mirror = JSON.parse(localStorage.getItem(saveKey));
    mirror.recording.slotId = 'slot-1';
    localStorage.setItem(saveKey, JSON.stringify(mirror));
  }, { saveKey: SAVE_KEY, slotsKey: SLOTS_KEY });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));
  const restored = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.records());
  expect(restored.activeSlotId).toBe('slot-3');
  expect(restored.slots[0].run.seed).toBe(492_501);
  expect(restored.slots[2].run.seed).toBe(492_503);
  expect(restored.slots[2].run.recording.slotId).toBe('slot-3');
});

test('PC表示でもスロット・図鑑・詳細履歴を読みやすく表示しbrowser errorを出さない', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 960 });
  await openDebug(page);
  await seedSlots(page, [
    { slot: 1, seed: 491_001, mode: 'story', day: 11, timestamp: '2026-08-01T00:00:00.000Z' },
    { slot: 2, seed: 491_002, mode: 'hard', day: 22, timestamp: '2026-08-01T00:00:01.000Z' },
    { slot: 3, seed: 491_003, mode: 'survival', day: 33, timestamp: '2026-08-01T00:00:02.000Z' }
  ]);
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));
  await page.locator('#continueBtn').click();
  await expect(page.locator('.slot-card')).toHaveCount(3);
  const slotColumns = await page.locator('#slotList').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  expect(slotColumns).toBeGreaterThanOrEqual(3);
  await page.locator('#slotBackBtn').click();
  await page.locator('#recordsBtn').click();
  await page.locator('[data-record-tab="codex"]').click();
  await page.waitForFunction(() => Number(document.querySelector('#codexGrid')?.dataset.renderedCount || 0) >= 20);
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    rendered: Number(document.querySelector('#codexGrid').dataset.renderedCount),
    total: Number(document.querySelector('#codexGrid').dataset.totalCount)
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  expect(widths.rendered).toBeGreaterThan(0);
  expect(widths.total).toBeGreaterThan(widths.rendered);
  expect(errors).toEqual([]);
});
