import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const appUrl = 'http://127.0.0.1:4173/tabenai-to-shinu/';
const outputDir = resolve('docs/screenshots/v4.9');

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

async function capture(page, name) {
  await waitForImages(page);
  await page.screenshot({ path: resolve(outputDir, name), fullPage: false });
}

async function stageEncounter(page, eventId, day, selection = {}) {
  await page.goto(`${appUrl}?debug=1`);
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__ && globalThis.TabenaiRecords));
  await page.evaluate(({ eventId, day, selection }) => {
    const api = globalThis.__TABENAI_DEBUG__;
    const run = api.fresh(4_900_700 + day, 'survival');
    run.day = day;
    run.hp = 74;
    run.hunger = 61;
    run.status = '森の気配を読む';
    run.companions.tako = true;
    run.survival.currentEventId = eventId;
    run.survival.currentSelection = { eventId, day, ...selection };
    let workspace = globalThis.TabenaiRecords.freshWorkspace();
    workspace = globalThis.TabenaiRecords.setSlot(workspace, 'slot-1', run, {
      timestamp: '2026-08-02T12:00:00.000+09:00', activate: true
    });
    api.setRecords(workspace);
  }, { eventId, day, selection });
  await page.goto(`${appUrl}?resume=1`);
  await page.locator('#gameScreen').waitFor({ state: 'visible' });
}

await mkdir(outputDir, { recursive: true });
const server = await ensureServer();
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    serviceWorkers: 'block'
  });
  const page = await context.newPage();

  await page.goto(appUrl);
  await page.locator('#titleScreen').waitFor({ state: 'visible' });
  await capture(page, 'title.png');

  const rareSelection = {
    rareChance: 0.04, rareBaseChance: 0.015, rarePityBonus: 0.025,
    rareRoll: 0.02, naturalHit: false, pityForced: true, pityCounter: 45
  };
  await stageEncounter(page, 'ordinary-meal', 49, rareSelection);
  await capture(page, 'true-rare.png');

  await page.goto(`${appUrl}?debug=1&resume=1`);
  await page.locator('#gameScreen').waitFor({ state: 'visible' });
  await capture(page, 'soft-pity-debug.png');

  await stageEncounter(page, 'tako-return', 35);
  await capture(page, 'conditional.png');

  await stageEncounter(page, 'milestone-stockpile', 10);
  await capture(page, 'milestone.png');

  await stageEncounter(page, 'final-pair', 50);
  await capture(page, 'final.png');

  await context.close();
} finally {
  await browser.close();
  if (server) server.kill();
}

process.stdout.write(`Captured v4.9 screenshots in ${outputDir}\n`);
