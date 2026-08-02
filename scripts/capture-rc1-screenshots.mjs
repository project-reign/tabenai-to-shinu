import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const appUrl = 'http://127.0.0.1:4173/tabenai-to-shinu/';
const outputDir = resolve('docs/screenshots/rc1');

async function serverIsReady() {
  try { return (await fetch(appUrl)).ok; } catch (_) { return false; }
}

async function ensureServer() {
  if (await serverIsReady()) return null;
  const server = spawn(process.execPath, ['tests/server.mjs'], {
    cwd: resolve('.'), stdio: 'ignore', windowsHide: true
  });
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await serverIsReady()) return server;
    await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
  }
  server.kill();
  throw new Error(`Screenshot server did not become ready: ${appUrl}`);
}

async function waitForImages(page) {
  await page.evaluate(() => Promise.all(Array.from(document.images, image => {
    if (image.complete) return undefined;
    return new Promise(resolveImage => {
      image.addEventListener('load', resolveImage, { once: true });
      image.addEventListener('error', resolveImage, { once: true });
    });
  })));
}

async function capture(page, name, viewport = { width: 390, height: 844 }, fullPage = false) {
  await page.setViewportSize(viewport);
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await page.waitForTimeout(80);
  await waitForImages(page);
  await page.screenshot({ path: resolve(outputDir, name), fullPage });
}

async function openDebug(page) {
  await page.goto(`${appUrl}?debug=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__ && globalThis.TabenaiRecords));
}

async function persistAndOpenRelease(page) {
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const records = globalThis.TabenaiRecords;
    let workspace = api.records();
    workspace = records.setSlot(workspace, workspace.activeSlotId || 'slot-1', api.snapshot(), {
      timestamp: '2026-08-02T06:00:00.000Z', activate: true
    });
    api.setRecords(workspace);
  });
  await page.goto(`${appUrl}?resume=1`, { waitUntil: 'networkidle' });
}

async function setStoryScene(page, mode, scene, seed) {
  await openDebug(page);
  await page.evaluate(({ mode, scene, seed }) => {
    const api = globalThis.__TABENAI_DEBUG__;
    const run = api.fresh(seed, mode);
    run.scene = scene;
    run.day = mode === 'story' ? 1 : 2;
    run.hp = mode === 'story' ? 100 : 68;
    run.hunger = mode === 'story' ? 0 : 26;
    api.setState(run);
  }, { mode, scene, seed });
  await persistAndOpenRelease(page);
}

async function seedRecords(page) {
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const records = globalThis.TabenaiRecords;
    const timestamp = '2026-08-02T06:00:00.000Z';
    let workspace = records.freshWorkspace();
    const slots = [
      ['slot-1', '晩餐の記憶', 'story', 1_000_101, 42, 'saladTrial'],
      ['slot-2', '飢餓の森', 'hard', 1_000_102, 28, 'shadow'],
      ['slot-3', '怪食サバイバル', 'survival', 1_000_103, 37, 'stored-bread']
    ];
    for (const [slotId, name, mode, seed, day, scene] of slots) {
      const run = api.fresh(seed, mode);
      Object.assign(run, { day, scene, hp: 74, hunger: 53, startedAt: timestamp, lastPlayedAt: timestamp });
      workspace = records.setSlot(workspace, slotId, run, { timestamp, name, activate: true });
    }
    const definitions = [
      ...api.catalog('foods').slice(0, 8).map(item => ['foods', item]),
      ...api.catalog('events').slice(0, 8).map(item => ['events', item]),
      ...api.catalog('characters').slice(0, 4).map(item => ['characters', item])
    ];
    definitions.forEach(([category, definition], index) => {
      const common = {
        source: 'play', committed: true, category, id: definition.id, occurredAt: timestamp,
        mode: index > 10 ? 'survival' : 'story', name: definition.name, hidden: definition.hidden,
        emoji: definition.emoji, assetId: definition.assetId
      };
      workspace.codex = records.recordCodex(workspace.codex, {
        ...common, phase: 'encounter', token: `rc1:${category}:${definition.id}:encounter`
      }).codex;
      if (category !== 'characters') workspace.codex = records.recordCodex(workspace.codex, {
        ...common, phase: 'choice', token: `rc1:${category}:${definition.id}:choice`,
        choiceIndex: index % 2, consumedByPlayer: category === 'foods' && index % 2 === 0,
        refused: index % 2 === 1, choiceKind: index % 2 === 1 ? 'skip' : 'eat'
      }).codex;
    });
    const completed = api.fresh(1_000_150, 'survival');
    Object.assign(completed, {
      ended: true, day: 50, hp: 66, hunger: 29, choiceCount: 50,
      startedAt: '2026-08-01T06:00:00.000Z', lastPlayedAt: timestamp,
      ending: { code: 'survival_return', title: '帰還の配膳' }
    });
    completed.stats.ate = 18;
    completed.stats.skipped = 21;
    completed.survival.finalBox = 'return';
    completed.survival.broughtHome = '未来の献立表';
    const choices = Array.from({ length: 50 }, (_, index) => index % 2);
    const result = records.makeRunResult(completed, {
      gameVersion: '1.0.0-rc.1', completedAt: timestamp, choices,
      timeline: choices.slice(0, 8).map((choiceIndex, index) => ({
        order: index + 1, day: index + 1, sceneId: `rc1:${index + 1}`,
        title: `第${index + 1}日の食卓`, choiceIndex, choice: choiceIndex ? '拒否する' : '受け入れる',
        hpBefore: 90 - index, hpAfter: 89 - index, hungerBefore: 20 + index, hungerAfter: 21 + index
      })),
      rareEncounterLog: [{
        eventId: 'ordinary-meal', day: 35, naturalHit: true, pityForced: false,
        rareChance: 0.012, rareRoll: 0.004, pityCounter: 0
      }],
      rareTotal: 1, naturalTotal: 1, pityTotal: 0, longestRareDrought: 34,
      milestones: { day10: true, day20: true, day30: true, day40: true },
      finalBox: 'return', broughtHome: '未来の献立表', unlockedAchievements: ['wild_fifty', 'result_saved']
    });
    workspace.history = records.addRunHistory(workspace.history, result).history;
    api.setRecords(workspace);
    api.screen('title');
  });
}

const server = await ensureServer();
const browser = await chromium.launch({ headless: true });

try {
  await mkdir(outputDir, { recursive: true });
  const context = await browser.newContext({
    locale: 'ja-JP', timezoneId: 'Asia/Tokyo', colorScheme: 'dark',
    reducedMotion: 'reduce', serviceWorkers: 'allow', viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();
  await openDebug(page);
  await seedRecords(page);

  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await capture(page, 'title.png');
  await page.goto(`${appUrl}?new=1`, { waitUntil: 'networkidle' });
  await capture(page, 'modes.png', { width: 1280, height: 720 });

  await setStoryScene(page, 'story', 'riceball', 1_000_201);
  await capture(page, 'story-50.png', { width: 390, height: 844 }, true);
  await setStoryScene(page, 'hard', 'gel', 1_000_202);
  await capture(page, 'hard-50.png', { width: 390, height: 844 }, true);
  await openDebug(page);
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const run = api.fresh(1_000_203, 'survival');
    run.day = 23;
    run.survival.currentEventId = 'stored-bread';
    run.survival.currentSelection = { eventId: 'stored-bread', day: 23 };
    api.setState(run);
  });
  await persistAndOpenRelease(page);
  await capture(page, 'survival-50.png', { width: 390, height: 844 }, true);

  await openDebug(page);
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const run = api.fresh(1_000_204, 'story');
    run.scene = 'finalPair'; run.day = 50; run.hp = 82; run.hunger = 55;
    api.setState(run);
  });
  await persistAndOpenRelease(page);
  await capture(page, 'four-dishes.png', { width: 390, height: 844 }, true);
  await openDebug(page);
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const run = api.fresh(1_000_205, 'survival');
    run.day = 50; run.hp = 71; run.hunger = 47;
    run.survival.currentEventId = 'final-pair';
    run.survival.currentSelection = { eventId: 'final-pair', day: 50 };
    api.setState(run);
  });
  await persistAndOpenRelease(page);
  await capture(page, 'four-boxes.png', { width: 390, height: 844 }, true);

  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.locator('#recordsBtn').click();
  await page.locator('[data-record-tab="codex"]').click();
  await page.waitForFunction(() => Number(document.querySelector('#codexGrid')?.dataset.renderedCount || 0) >= 20);
  await capture(page, 'codex.png');
  await page.locator('[data-record-tab="history"]').click();
  await capture(page, 'history.png', { width: 1280, height: 720 });
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.locator('#settingsBtn').click();
  await capture(page, 'settings.png', { width: 390, height: 844 }, true);
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.locator('.title-manage > summary').click();
  await page.locator('#titleDataBtn').click();
  await capture(page, 'data-management.png');
  await page.keyboard.press('Escape');

  await page.goto(appUrl);
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
  });
  const offlinePage = await context.newPage();
  await offlinePage.goto(appUrl);
  await offlinePage.evaluate(() => dispatchEvent(new Event('offline')));
  await offlinePage.locator('#networkStatus').waitFor({ state: 'visible' });
  await offlinePage.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await capture(offlinePage, 'offline.png');
  await context.setOffline(false);
  await context.close();
} finally {
  await browser.close();
  if (server) server.kill();
}

process.stdout.write(`Captured RC1 screenshots in ${outputDir}\n`);
