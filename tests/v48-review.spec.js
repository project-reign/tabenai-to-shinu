import { expect, test } from '@playwright/test';

const DEBUG_URL = './?debug=1';

async function openDebug(page) {
  await page.goto(DEBUG_URL);
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__ && globalThis.TabenaiRecords));
}

test('release表示は開発情報を隠し、debug=1だけが判定・通信・日替わり内部値を表示する', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#titleScreen')).toBeVisible();
  await expect(page.locator('#networkStatus')).toBeHidden();
  await expect(page.locator('#titleCreditsBtn')).toBeHidden();
  await expect(page.locator('.title-manage > summary')).toHaveText('メニュー');
  await expect(page.locator('#titleInstallBtn')).toHaveText('アプリ情報・更新');
  await expect(page.locator('#titleDataBtn')).toHaveText('データ管理');
  const releaseText = await page.locator('body').innerText();
  expect(releaseText).not.toContain('ONLINE');
  expect(releaseText).not.toContain('fnv1a32-jst-v1');
  expect(releaseText).not.toContain('formatVersion');
  expect(releaseText).not.toContain('SEED');

  await page.locator('#settingsBtn').click();
  await expect(page.locator('#settingsCreditsBtn')).toHaveText('このゲームについて');
  await expect(page.locator('#detailedJudgementSetting')).not.toBeChecked();
  await page.locator('#settingsCreditsBtn').click();
  await expect(page.locator('#creditsScreen')).toBeVisible();
  await expect(page.locator('#technicalCredits')).toBeHidden();
  await expect(page.getByRole('link', { name: '開発用アセットギャラリー' })).toBeHidden();
  await page.locator('#creditsBackBtn').click();
  await expect(page.locator('#settingsScreen')).toBeVisible();

  await openDebug(page);
  await expect(page.locator('#seedBadge')).toBeVisible();
  await expect(page.locator('#seedBadge')).toContainText('SEED');
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));
  await expect(page.locator('#networkStatus')).toHaveText('● ONLINE');
  await expect(page.locator('#dailySummary')).toContainText('fnv1a32-jst-v1');
  await page.locator('.title-manage > summary').click();
  await expect(page.locator('#titleCreditsBtn')).toBeVisible();
});

test('releaseの運命判定は百分率と生ロールを出さず物語表現だけを返す', async ({ page }) => {
  await openDebug(page);
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const run = api.fresh(4_817_200, 'story');
    run.scene = 'collapseAction';
    run.day = 28;
    run.startedAt = '2026-08-02T00:00:00.000Z';
    run.lastPlayedAt = run.startedAt;
    let workspace = globalThis.TabenaiRecords.freshWorkspace();
    workspace = globalThis.TabenaiRecords.setSlot(workspace, 'slot-1', run, {
      timestamp: run.lastPlayedAt, activate: true
    });
    api.setRecords(workspace);
  });

  await page.goto('./?resume=1');
  await expect(page.locator('#gameScreen')).toBeVisible();
  await expect(page.locator('#seedBadge')).toBeHidden();
  await expect(page.locator('#choiceBDesc')).not.toContainText('72％');
  await expect(page.locator('#choiceBDesc')).toContainText('失敗すれば大きく負傷');
  let playerText = await page.locator('#gameScreen').innerText();
  expect(playerText).not.toContain('SEED');
  expect(playerText).not.toContain('collapseAction');
  expect(playerText).not.toMatch(/成功率\s*\d+％/);

  await page.locator('#choiceB').click();
  await expect(page.locator('#resultBox')).toContainText(/運命が味方した|どうにか切り抜けた|運命に見放された/);
  expect(await page.locator('#resultBox').innerText()).not.toMatch(/\d+％|ロール\s*[0-9.]+/);
});

test('rare履歴は重複発生を日本語で表示し、内部判定はdebug表示だけに分離する', async ({ page }) => {
  await openDebug(page);
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const run = api.fresh(4_818_800, 'survival');
    run.ended = true;
    run.day = 50;
    run.ending = { code: 'survival_return', title: '帰還の配膳', text: '帰還した。', icon: '🚪' };
    const result = globalThis.TabenaiRecords.makeRunResult(run, {
      runId: 'rare-review-run',
      completedAt: '2026-08-02T01:00:00.000Z',
      choices: [0, 1, 0],
      rareEncounterLog: [
        { eventId: 'ordinary-meal', day: 12, naturalHit: true, pityForced: false, rareChance: 0.04, rareRoll: 0.0123, pityCounter: 4 },
        { eventId: 'ordinary-meal', day: 37, naturalHit: false, pityForced: true, rareChance: 0.06, rareRoll: 0.82, pityCounter: 14 },
        { eventId: 'second-player', day: 44, naturalHit: true, pityForced: false, rareChance: 0.07, rareRoll: 0.03, pityCounter: 6 }
      ],
      rareTotal: 3,
      naturalTotal: 2,
      pityTotal: 1,
      longestRareDrought: 14
    });
    const workspace = api.records();
    workspace.history = [result];
    api.setRecords(workspace);
  });

  await page.goto('./');
  await page.locator('#recordsBtn').click();
  await page.locator('[data-record-tab="history"]').click();
  const releaseHistory = page.locator('.history-card');
  await expect(releaseHistory).toContainText('レア遭遇 3回');
  await expect(releaseHistory).toContainText('完全に普通の定食（第12日）');
  await expect(releaseHistory).toContainText('完全に普通の定食（第37日）');
  await expect(releaseHistory).toContainText('二人目のプレイヤー（第44日）');
  const releaseText = await releaseHistory.innerText();
  for (const internal of ['ordinary-meal', 'second-player', 'eventId=', 'rareChance=', 'rareRoll=', 'pity counter=', 'SEED']) {
    expect(releaseText).not.toContain(internal);
  }

  await openDebug(page);
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('records'));
  await page.locator('[data-record-tab="history"]').click();
  const debugHistory = page.locator('.history-card');
  await expect(debugHistory).toContainText('eventId=ordinary-meal');
  await expect(debugHistory).toContainText('natural総数 2');
  await expect(debugHistory).toContainText('pity総数 1');
  await expect(debugHistory).toContainText('rareChance=0.04');
  await expect(debugHistory).toContainText('rareRoll=0.82');
  await expect(debugHistory).toContainText('pity counter=14');
});

test('release UIはiPhone 390x844で横溢れせず設定と記録を操作できる', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await expect(page.locator('#titleScreen')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#detailedJudgementSetting')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('#settingsBackBtn').click();
  await page.locator('#recordsBtn').click();
  await expect(page.locator('.record-tabs')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
