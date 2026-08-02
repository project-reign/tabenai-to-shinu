import { expect, test } from '@playwright/test';

const SAVE_KEY = 'tabenai-to-shinu-50days-v4';
const META_KEY = 'tabenai-to-shinu-meta-v1';
const SLOTS_KEY = 'tabenai-to-shinu-run-slots-v1';
const MIGRATION_KEY = 'tabenai-to-shinu-run-slots-migrated-v1';
const EXISTING_ACHIEVEMENT_IDS = [
  'first_bite', 'skeptical_saved', 'refuse_creed', 'poison_feast', 'parasite_friend',
  'bean_parent', 'white_past', 'red_future', 'gray_present', 'three_soils', 'body_field',
  'final_dinner', 'refuse_final', 'four_dishes', 'party_escape', 'hard_survivor',
  'wild_fifty', 'rare_encounter', 'luck_is_skill', 'solo_survivor', 'refusal_master',
  'as_planned', 'ordinary_best'
];

async function startModeInSlot(page, modeButton, slotId = 'slot-1') {
  await page.locator(modeButton).click();
  await expect(page.locator('#slotScreen')).toBeVisible();
  await expect(page.locator(`[data-slot="${slotId}"]`)).toBeVisible();
  await page.locator(`[data-slot-start="${slotId}"]`).click();
  await expect(page.locator('#gameScreen')).toBeVisible();
}

test('PWA起動時にタイトル導線とプレイ可能・ロードマップの全モードを表示する', async ({ page }) => {
  await page.goto('./');

  await expect(page.locator('#titleScreen')).toBeVisible();
  await expect(page.locator('#titleScreen h1')).toHaveText('食べないと死ぬ');
  await expect(page.locator('.title-version')).toHaveText('v1.0.0-rc.3');
  await expect(page.locator('#continueBtn')).toBeDisabled();
  await expect(page.locator('#newGameBtn')).toHaveText('はじめから');
  await expect(page.locator('#recordsBtn')).toHaveText('記録');
  await expect(page.locator('#settingsBtn')).toHaveText('設定');
  await page.locator('.title-manage > summary').click();
  await page.locator('#titleInstallBtn').click();
  await expect(page.locator('#installModal')).toHaveClass(/open/);
  await page.locator('#closeInstall').click();

  await page.locator('#newGameBtn').click();
  await expect(page.locator('#modeScreen')).toBeVisible();
  await expect(page.locator('#modeStoryBtn')).toContainText('STORY 50');
  await expect(page.locator('#modeHardBtn')).toContainText('HARD 50');
  await expect(page.locator('#modeSurvivalBtn')).toContainText('SURVIVAL 50');
  await expect(page.locator('#modeSurvivalBtn')).toContainText('怪食サバイバル');
  await expect(page.locator('.mode-card.locked')).toHaveCount(2);
  await expect(page.locator('#modeScreen')).toContainText('100 DAYS');
  await expect(page.locator('#modeScreen')).toContainText('ENDLESS');
  await expect(page.locator('#modeScreen')).toContainText('v5.0');
  await expect(page.locator('#modeScreen')).toContainText('v5.1+');
});

test('STORY 50とHARD 50を開始でき、HARDは厳しくても同一シードで再現する', async ({ page }) => {
  await page.goto('./?debug=1');
  const modes = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const story = api.fresh(440, 'story');
    const hard = api.fresh(440, 'hard');
    api.silent(true);
    const run = () => {
      api.setState(api.fresh(0x440, 'hard'));
      for (const choice of [0, 1, 0, 0, 1, 0, 1, 0]) {
        if (api.snapshot().ended) break;
        api.step(choice);
      }
      return api.snapshot();
    };
    const hardFinal = api.fresh(0x441, 'hard');
    hardFinal.scene = 'finalPair';
    hardFinal.day = 50;
    hardFinal.hp = 100;
    hardFinal.hunger = 0;
    api.setState(hardFinal);
    api.step(1);
    api.step(1);
    api.step(0);
    return { story, hard, runs: [run(), run()], meta: api.meta() };
  });

  expect(modes.story.mode).toBe('story');
  expect(modes.story.hp).toBe(100);
  expect(modes.story.hunger).toBe(25);
  expect(modes.hard.mode).toBe('hard');
  expect(modes.hard.hp).toBeLessThan(modes.story.hp);
  expect(modes.hard.hunger).toBeGreaterThan(modes.story.hunger);
  expect(modes.runs[0]).toEqual(modes.runs[1]);
  expect(modes.meta.achievements.hard_survivor).toBeTruthy();
  expect(modes.meta.stats.modeClears.hard).toBe(1);

  await page.goto('./');
  await page.locator('#newGameBtn').click();
  await startModeInSlot(page, '#modeHardBtn');
  await expect(page.locator('#gameScreen')).toBeVisible();
  await expect(page.locator('#modeBadge')).toHaveText('HARD 50');
  await expect(page.locator('#hpValue')).toHaveText('82');
  await expect(page.locator('#hungerValue')).toHaveText('35');
});

test('v4.3以前のrunをSTORY 50へ自動移行し、タイトルから続行して戻れる', async ({ page }) => {
  await page.addInitScript(({ saveKey, slotsKey, migrationKey }) => {
    if (localStorage.getItem(slotsKey) !== null || localStorage.getItem(migrationKey) !== null) return;
    localStorage.setItem(saveKey, JSON.stringify({
      version: 4,
      seed: 430,
      rngState: 98765,
      scene: 'meatTrial',
      day: 43,
      hp: 73,
      hunger: 41,
      status: 'v4.3.0から継続',
      choiceCount: 22,
      flags: { beanSoil: 'red', noFoodTrapClue: true },
      companions: { beanChild: true },
      memories: { birthday: false },
      stats: { skipped: 9 },
      log: ['既存ログ'],
      clues: ['既存の手がかり']
    }));
  }, { saveKey: SAVE_KEY, slotsKey: SLOTS_KEY, migrationKey: MIGRATION_KEY });
  await page.goto('./');

  await expect(page.locator('#titleScreen')).toBeVisible();
  await expect(page.locator('#continueBtn')).toBeEnabled();
  await expect(page.locator('#runSummary')).toContainText('STORY 50');
  await expect(page.locator('#runSummary')).toContainText('第43日');
  await page.locator('#continueBtn').click();
  await expect(page.locator('#slotScreen')).toBeVisible();
  await expect(page.locator('[data-slot="slot-1"]')).toContainText('STORY 50');
  await expect(page.locator('[data-slot="slot-1"]')).toContainText('第43日');
  await page.locator('[data-slot-continue="slot-1"]').click();
  await expect(page.locator('#modeBadge')).toHaveText('STORY 50');
  await expect(page.locator('#sceneTitle')).toHaveText('最後の晩餐・試食② 焦げた肉');

  await page.locator('#appMenu > summary').click();
  await page.locator('#titleBtn').click();
  await expect(page.locator('#titleScreen')).toBeVisible();

  const migration = await page.evaluate(({ saveKey, slotsKey, migrationKey }) => ({
    mirror: JSON.parse(localStorage.getItem(saveKey)),
    slots: JSON.parse(localStorage.getItem(slotsKey)),
    marker: localStorage.getItem(migrationKey)
  }), { saveKey: SAVE_KEY, slotsKey: SLOTS_KEY, migrationKey: MIGRATION_KEY });
  const migrated = migration.mirror;
  const migratedMeta = await page.evaluate(({ metaKey }) => JSON.parse(localStorage.getItem(metaKey)), { metaKey: META_KEY });
  expect(migration.marker).toBe('1');
  expect(migration.slots.slots.filter(slot => slot.run)).toHaveLength(1);
  expect(migration.slots.slots[0].run.seed).toBe(430);
  expect(migrated.version).toBe(4);
  expect(migrated.mode).toBe('story');
  expect(migrated.seed).toBe(430);
  expect(migrated.clues).toContain('既存の手がかり');
  expect(migratedMeta.achievements.skeptical_saved).toBeTruthy();

  // 移行済みマーカー後に旧キーへ別runが現れても、slot 1へ重複コピーしない。
  await page.evaluate(({ saveKey }) => {
    const duplicate = JSON.parse(localStorage.getItem(saveKey));
    duplicate.seed = 999999;
    duplicate.status = '重複移行してはいけない';
    localStorage.setItem(saveKey, JSON.stringify(duplicate));
  }, { saveKey: SAVE_KEY });
  await page.reload();
  const afterReload = await page.evaluate(({ slotsKey }) => JSON.parse(localStorage.getItem(slotsKey)), { slotsKey: SLOTS_KEY });
  expect(afterReload.slots.filter(slot => slot.run)).toHaveLength(1);
  expect(afterReload.slots[0].run.seed).toBe(430);
});

test('実績・エンディング・統計を永続化し、記録画面に表示する', async ({ page }) => {
  await page.goto('./?debug=1');
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    api.start('story', 441);
    api.silent(false);
    api.step(0);
    const finalState = api.fresh(442, 'story');
    finalState.scene = 'finalPair';
    finalState.day = 50;
    finalState.hp = 100;
    finalState.hunger = 0;
    api.setState(finalState);
    api.step(1);
    api.step(1);
    api.step(0);
  });

  const stored = await page.evaluate(({ metaKey }) => JSON.parse(localStorage.getItem(metaKey)), { metaKey: META_KEY });
  expect(stored.achievements.first_bite).toBeTruthy();
  expect(stored.achievements.final_dinner).toBeTruthy();
  expect(stored.endings.true).toBeTruthy();
  expect(stored.stats.totalChoices).toBeGreaterThanOrEqual(4);
  expect(stored.stats.dishesSeen.cake).toBeGreaterThan(0);

  await page.goto('./');
  await page.locator('#recordsBtn').click();
  const achievementIds = await page.locator('[data-achievement]').evaluateAll(cards => cards.map(card => card.dataset.achievement));
  expect(achievementIds.length).toBeGreaterThanOrEqual(33);
  expect(achievementIds).toEqual(expect.arrayContaining(EXISTING_ACHIEVEMENT_IDS));
  await expect(page.locator('[data-achievement="first_bite"]')).toContainText('最初の一口');
  await page.locator('[data-record-tab="endings"]').click();
  await expect(page.locator('[data-ending="true"]')).toContainText('契約腐敗・脱出成功');
  await page.locator('[data-record-tab="stats"]').click();
  await expect(page.locator('#recordsContent')).toContainText('総選択数');
});

test('設定を永続化し、選択確認・自動スクロール・動きと文字サイズを保持する', async ({ page }) => {
  await page.goto('./');
  await page.locator('#settingsBtn').click();
  await page.locator('#fontSizeSetting').selectOption('large');
  await page.locator('#reducedMotionSetting').check();
  await page.locator('#confirmChoicesSetting').check();
  await page.locator('#autoScrollSetting').selectOption('off');
  await page.reload();

  await expect(page.locator('html')).toHaveAttribute('data-font-size', 'large');
  await expect(page.locator('html')).toHaveClass(/reduce-motion/);
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#fontSizeSetting')).toHaveValue('large');
  await expect(page.locator('#reducedMotionSetting')).toBeChecked();
  await expect(page.locator('#confirmChoicesSetting')).toBeChecked();
  await expect(page.locator('#autoScrollSetting')).toHaveValue('off');

  await page.locator('#settingsBackBtn').click();
  await page.locator('#newGameBtn').click();
  await startModeInSlot(page, '#modeStoryBtn');
  page.once('dialog', async dialog => {
    expect(dialog.message()).toContain('食べる');
    await dialog.dismiss();
  });
  await page.locator('#choiceA').click();
  await expect(page.locator('#sceneCountBadge')).toHaveText('選択 0');
});

test('formatVersion 3に全スロットと記録を含め、formatVersion 1／2も読み込める', async ({ page }) => {
  await page.goto('./?debug=1');
  const payload = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    api.start('hard', 444);
    const currentMeta = api.meta();
    currentMeta.achievements.first_bite = { unlockedAt: '2026-07-31T00:00:00.000Z' };
    currentMeta.stats.totalChoices = 7;
    api.setMeta(currentMeta);
    return api.transfer();
  });

  expect(payload.formatVersion).toBe(3);
  expect(payload.scope).toBe('all');
  expect(payload.slots).toHaveLength(3);
  expect(payload.slots.find(slot => slot.id === payload.activeSlotId).run.mode).toBe('hard');
  expect(payload.run.mode).toBe('hard');
  expect(payload.run.seed).toBe(444);
  expect(payload.meta.achievements.first_bite).toBeTruthy();
  expect(payload.meta.stats.totalChoices).toBe(7);
  expect(payload.state.seed).toBe(444);
  expect(payload.codex).toBeTruthy();
  expect(payload.history).toEqual(expect.any(Array));
  expect(payload.dailyRecords).toBeTruthy();

  const legacyTransfer = {
    format: 'tabenai-save',
    formatVersion: 1,
    appVersion: '4.3.0',
    state: {
      version: 4,
      seed: 4300,
      rngState: 4300,
      scene: 'riceball',
      day: 1,
      hp: 91,
      hunger: 29,
      status: '旧移行データ',
      choiceCount: 3
    },
    endings: { true: 1 }
  };
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));
  await page.locator('.title-manage > summary').click();
  await page.locator('#titleDataBtn').click();
  await page.locator('#saveTransferText').fill(JSON.stringify(legacyTransfer));
  page.once('dialog', dialog => dialog.accept());
  await Promise.all([
    page.waitForEvent('load'),
    page.locator('#importSaveBtn').click()
  ]);
  const imported = await page.evaluate(({ saveKey }) => JSON.parse(localStorage.getItem(saveKey)), { saveKey: SAVE_KEY });
  expect(imported.mode).toBe('story');
  expect(imported.seed).toBe(4300);
  expect(imported.status).toBe('旧移行データ');

  const legacyV2 = {
    format: 'tabenai-save',
    formatVersion: 2,
    appVersion: '4.7.0',
    exportedAt: '2026-07-31T12:34:56.000Z',
    run: {
      version: 4,
      mode: 'hard',
      seed: 4702,
      rngState: 4702,
      scene: 'gel',
      day: 2,
      hp: 80,
      hunger: 39,
      status: 'formatVersion 2から移行',
      choiceCount: 1
    },
    meta: payload.meta,
    endings: payload.endings
  };
  if (await page.locator('#titleScreen').isVisible()) {
    await page.locator('.title-manage > summary').click();
    await page.locator('#titleDataBtn').click();
  } else {
    await page.locator('#appMenu > summary').click();
    await page.locator('#dataBtn').click();
  }
  await page.locator('#saveTransferText').fill(JSON.stringify(legacyV2));
  await expect(page.locator('#importPreview')).toContainText('formatVersion 2');
  await expect(page.locator('#importPreview')).toContainText('読込先：slot-1');
  page.once('dialog', dialog => dialog.accept());
  await Promise.all([
    page.waitForEvent('load'),
    page.locator('#importSaveBtn').click()
  ]);
  const importedV2 = await page.evaluate(({ saveKey, slotsKey }) => ({
    mirror: JSON.parse(localStorage.getItem(saveKey)),
    slots: JSON.parse(localStorage.getItem(slotsKey)).slots
  }), { saveKey: SAVE_KEY, slotsKey: SLOTS_KEY });
  expect(importedV2.mirror.mode).toBe('hard');
  expect(importedV2.mirror.seed).toBe(4702);
  expect(importedV2.slots.find(slot => slot.id === 'slot-1').run.seed).toBe(4702);
  expect(importedV2.slots.find(slot => slot.id === 'slot-2').run).toBeNull();
});

test('HARD 50は通常の開始地点から生還可能な選択列を持つ', async ({ page }) => {
  await page.goto('./?debug=1');
  const result = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    api.silent(true);
    const choices = [1, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0];
    api.setState(api.fresh(440, 'hard'));
    for (const choice of choices) api.step(choice);
    return api.snapshot();
  });
  expect(result.ended).toBe(true);
  expect(result.ending.code).toBe('shield');
  expect(result.mode).toBe('hard');
  expect(result.day).toBe(50);
});
