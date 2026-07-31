import { expect, test } from '@playwright/test';

const SAVE_KEY = 'tabenai-to-shinu-50days-v4';
const META_KEY = 'tabenai-to-shinu-meta-v1';

test('PWA起動時にタイトル導線とプレイ可能・ロードマップの全モードを表示する', async ({ page }) => {
  await page.goto('./');

  await expect(page.locator('#titleScreen')).toBeVisible();
  await expect(page.locator('#titleScreen h1')).toHaveText('食べないと死ぬ');
  await expect(page.locator('.title-version')).toHaveText('v4.4.0');
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
  await expect(page.locator('.mode-card.locked')).toHaveCount(3);
  await expect(page.locator('#modeScreen')).toContainText('SURVIVAL 50');
  await expect(page.locator('#modeScreen')).toContainText('100 DAYS');
  await expect(page.locator('#modeScreen')).toContainText('ENDLESS');
  await expect(page.locator('#modeScreen')).toContainText('v4.5');
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
  await page.locator('#modeHardBtn').click();
  await expect(page.locator('#gameScreen')).toBeVisible();
  await expect(page.locator('#modeBadge')).toHaveText('HARD 50');
  await expect(page.locator('#hpValue')).toHaveText('82');
  await expect(page.locator('#hungerValue')).toHaveText('35');
});

test('v4.3以前のrunをSTORY 50へ自動移行し、タイトルから続行して戻れる', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(({ saveKey }) => {
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
  }, { saveKey: SAVE_KEY });
  await page.reload();

  await expect(page.locator('#titleScreen')).toBeVisible();
  await expect(page.locator('#continueBtn')).toBeEnabled();
  await expect(page.locator('#runSummary')).toContainText('STORY 50');
  await expect(page.locator('#runSummary')).toContainText('第43日');
  await page.locator('#continueBtn').click();
  await expect(page.locator('#modeBadge')).toHaveText('STORY 50');
  await expect(page.locator('#sceneTitle')).toHaveText('最後の晩餐・試食② 焦げた肉');

  await page.locator('#appMenu > summary').click();
  await page.locator('#titleBtn').click();
  await expect(page.locator('#titleScreen')).toBeVisible();

  const migrated = await page.evaluate(({ saveKey }) => JSON.parse(localStorage.getItem(saveKey)), { saveKey: SAVE_KEY });
  const migratedMeta = await page.evaluate(({ metaKey }) => JSON.parse(localStorage.getItem(metaKey)), { metaKey: META_KEY });
  expect(migrated.version).toBe(4);
  expect(migrated.mode).toBe('story');
  expect(migrated.seed).toBe(430);
  expect(migrated.clues).toContain('既存の手がかり');
  expect(migratedMeta.achievements.skeptical_saved).toBeTruthy();
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
  await expect(page.locator('[data-achievement]')).toHaveCount(16);
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
  await page.locator('#autoScrollSetting').uncheck();
  await page.reload();

  await expect(page.locator('html')).toHaveAttribute('data-font-size', 'large');
  await expect(page.locator('html')).toHaveClass(/reduce-motion/);
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#fontSizeSetting')).toHaveValue('large');
  await expect(page.locator('#reducedMotionSetting')).toBeChecked();
  await expect(page.locator('#confirmChoicesSetting')).toBeChecked();
  await expect(page.locator('#autoScrollSetting')).not.toBeChecked();

  await page.locator('#settingsBackBtn').click();
  await page.locator('#newGameBtn').click();
  await page.locator('#modeStoryBtn').click();
  page.once('dialog', async dialog => {
    expect(dialog.message()).toContain('食べる');
    await dialog.dismiss();
  });
  await page.locator('#choiceA').click();
  await expect(page.locator('#sceneCountBadge')).toHaveText('選択 0');
});

test('セーブ移行JSONにrunと実績・記録を含め、旧形式も読み込める', async ({ page }) => {
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

  expect(payload.formatVersion).toBe(2);
  expect(payload.run.mode).toBe('hard');
  expect(payload.run.seed).toBe(444);
  expect(payload.meta.achievements.first_bite).toBeTruthy();
  expect(payload.meta.stats.totalChoices).toBe(7);
  expect(payload.state.seed).toBe(444);

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
  await Promise.all([
    page.waitForEvent('load'),
    page.locator('#importSaveBtn').click()
  ]);
  const imported = await page.evaluate(({ saveKey }) => JSON.parse(localStorage.getItem(saveKey)), { saveKey: SAVE_KEY });
  expect(imported.mode).toBe('story');
  expect(imported.seed).toBe(4300);
  expect(imported.status).toBe('旧移行データ');
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
