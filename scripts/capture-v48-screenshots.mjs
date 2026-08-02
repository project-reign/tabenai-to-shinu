import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const appUrl = 'http://127.0.0.1:4173/tabenai-to-shinu/';
const outputDir = resolve('docs/screenshots/v4.8');
const fixedNow = new Date('2026-08-01T12:00:00+09:00');

async function serverIsReady() {
  try {
    const response = await fetch(appUrl);
    return response.ok;
  } catch (_) {
    return false;
  }
}

async function waitForServer(timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await serverIsReady()) return;
    await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Screenshot server did not become ready: ${appUrl}`);
}

async function ensureServer() {
  if (await serverIsReady()) return null;
  const server = spawn(process.execPath, ['tests/server.mjs'], {
    cwd: resolve('.'),
    stdio: 'ignore',
    windowsHide: true
  });
  await waitForServer();
  return server;
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

async function seedShowcase(page) {
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const records = globalThis.TabenaiRecords;
    const timestamps = [
      '2026-08-01T00:30:00.000Z',
      '2026-08-01T01:15:00.000Z',
      '2026-08-01T02:45:00.000Z'
    ];
    const slotDefinitions = [
      {
        id: 'slot-1', name: '夜明け前の食卓', mode: 'story', seed: 480_801,
        day: 18, hp: 83, hunger: 46, scene: '影を飼う皿',
        companions: { tako: true, beanChild: true }
      },
      {
        id: 'slot-2', name: '赤い土の記憶', mode: 'hard', seed: 480_802,
        day: 27, hp: 61, hunger: 72, scene: '三色の土嚢と黒豆',
        companions: { jr: true, beanChild: true }
      },
      {
        id: 'slot-3', name: '今日を生きる席', mode: 'survival', seed: 1_264_873_921,
        day: 41, hp: 48, hunger: 78, scene: '最後の献立表',
        companions: { tako: true, jr: true }
      }
    ];

    let workspace = records.freshWorkspace();
    slotDefinitions.forEach((definition, index) => {
      const run = api.fresh(definition.seed, definition.mode);
      Object.assign(run, {
        day: definition.day,
        hp: definition.hp,
        hunger: definition.hunger,
        scene: definition.scene,
        startedAt: '2026-07-31T15:00:00.000Z',
        lastPlayedAt: timestamps[index]
      });
      Object.assign(run.companions, definition.companions);
      workspace = records.setSlot(workspace, definition.id, run, {
        timestamp: timestamps[index],
        name: definition.name,
        activate: true
      });
    });

    const observedAt = '2026-08-01T02:30:00.000Z';
    const discover = (category, definition, mode, index) => {
      const common = {
        source: 'play', committed: true, category, id: definition.id,
        occurredAt: observedAt, mode, name: definition.name,
        hidden: definition.hidden, emoji: definition.emoji,
        assetId: definition.assetId
      };
      const encounter = records.recordCodex(workspace.codex, {
        ...common,
        phase: 'encounter',
        token: `screenshot|${category}|${definition.id}|encounter`
      });
      workspace.codex = encounter.codex;
      if (category === 'foods' || category === 'events') {
        const choiceIndex = index % 2;
        const choice = records.recordCodex(workspace.codex, {
          ...common,
          phase: 'choice',
          token: `screenshot|${category}|${definition.id}|choice`,
          choiceIndex,
          consumedByPlayer: category === 'foods' && choiceIndex === 0,
          refused: choiceIndex === 1,
          choiceKind: choiceIndex === 1 ? 'skip' : 'eat',
          resultId: `${definition.id}:showcase`
        });
        workspace.codex = choice.codex;
      }
    };

    api.catalog('foods').slice(0, 10).forEach((definition, index) => {
      discover('foods', definition, index > 6 ? 'survival' : 'story', index);
    });
    api.catalog('events').slice(0, 12).forEach((definition, index) => {
      discover('events', definition, definition.mode || 'story', index);
    });
    api.catalog('characters').slice(0, 6).forEach((definition, index) => {
      discover('characters', definition, index > 3 ? 'survival' : 'story', index);
    });

    const completed = api.fresh(480_850, 'survival');
    Object.assign(completed, {
      ended: true,
      day: 50,
      hp: 64,
      hunger: 31,
      choiceCount: 50,
      startedAt: '2026-07-30T15:00:00.000Z',
      lastPlayedAt: '2026-08-01T02:55:00.000Z',
      ending: { code: 'survival_preserved', title: '保存食を抱く生還者' }
    });
    completed.stats.ate = 22;
    completed.stats.skipped = 13;
    Object.assign(completed.companions, { tako: true, jr: true, beanChild: true });
    completed.memories = { tako: true, birthday: true, entryReason: true, fakeChef: false, lastLost: null };
    Object.assign(completed.flags, { beanSoil: 'red', selectedTrueDish: 'soup' });
    if (completed.survival) {
      completed.survival.finalBox = 'preserved';
      completed.survival.broughtHome = '森の保存食と未来の献立表';
    }
    const choices = Array.from({ length: 50 }, (_, index) => index % 3 === 0 ? 1 : 0);
    const timeline = [
      ['保存庫の固いパン', '少しだけ食べる', 100, 96, 25, 14],
      ['逆さに降る雨', '瓶に集める', 96, 96, 14, 9],
      ['寄生タコの帰還', '席を空ける', 96, 94, 9, 17],
      ['完全に普通の定食', 'いただく', 94, 100, 17, 0],
      ['最後の献立表', '未来の欄を残す', 72, 70, 51, 55],
      ['生存者の配膳', '保存食の箱を開ける', 64, 64, 31, 31]
    ].map(([title, choice, hpBefore, hpAfter, hungerBefore, hungerAfter], index) => ({
      order: index + 1,
      day: [1, 7, 16, 25, 40, 50][index],
      sceneId: `showcase:${index + 1}`,
      title,
      choiceIndex: choices[index],
      choice,
      hpBefore,
      hpAfter,
      hungerBefore,
      hungerAfter
    }));
    const result = records.makeRunResult(completed, {
      gameVersion: '4.8.0',
      completedAt: '2026-08-01T03:00:00.000Z',
      choices,
      timeline,
      rareEncounters: ['ordinary-meal', 'forest-manager'],
      rareEncounterLog: [
        { eventId: 'ordinary-meal', day: 25, naturalHit: true, pityForced: false, rareChance: 0.05, rareRoll: 0.0123, pityCounter: 5 },
        { eventId: 'forest-manager', day: 37, naturalHit: false, pityForced: true, rareChance: 0.06, rareRoll: 0.7345, pityCounter: 14 }
      ],
      rareTotal: 2,
      naturalTotal: 1,
      pityTotal: 1,
      longestRareDrought: 14,
      milestones: { day10: true, day20: true, day30: true, day40: true },
      finalDish: 'soup',
      finalBox: 'preserved',
      broughtHome: '森の保存食と未来の献立表',
      unlockedAchievements: ['wild_fifty', 'result_saved']
    });
    workspace.history = records.addRunHistory(workspace.history, result).history;
    workspace.dailyRecords = records.updateDailyRecord(workspace.dailyRecords, {
      date: '2026-08-01',
      started: true,
      attemptId: 'daily-showcase-2026-08-01',
      playedAt: observedAt,
      day: 41,
      choiceCount: 40,
      deathReason: null
    }).records;
    api.setRecords(workspace);
    api.screen('title');
  });
}

async function capture(page, name) {
  await page.waitForTimeout(80);
  await waitForImages(page);
  await page.screenshot({ path: resolve(outputDir, name), fullPage: false });
}

async function openRelease(page) {
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
}

const server = await ensureServer();
const browser = await chromium.launch({ headless: true });

try {
  await mkdir(outputDir, { recursive: true });
  const context = await browser.newContext({
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    reducedMotion: 'reduce',
    colorScheme: 'dark',
    serviceWorkers: 'block',
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(fixedNow);
  await page.goto(`${appUrl}?debug=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__ && globalThis.TabenaiRecords));
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await seedShowcase(page);
  const showcase = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const records = globalThis.TabenaiRecords;
    const workspace = api.records();
    return {
      catalog: Object.fromEntries(['foods', 'events', 'characters', 'endings']
        .map(category => [category, api.catalog(category).length])),
      discovered: records.codexCounts(workspace.codex),
      history: workspace.history.length,
      storageBytes: records.estimateStorageBytes(records.encodeStorage(workspace))
    };
  });
  await openRelease(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, 'title.png');

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.locator('#continueBtn').click();
  await page.locator('.slot-card').first().waitFor({ state: 'visible' });
  await capture(page, 'slots.png');

  await page.setViewportSize({ width: 390, height: 844 });
  await openRelease(page);
  await page.locator('#recordsBtn').click();
  await page.locator('[data-record-tab="codex"]').click();
  await page.waitForFunction(() => Number(document.querySelector('#codexGrid')?.dataset.renderedCount || 0) >= 20);
  await capture(page, 'codex.png');

  await page.setViewportSize({ width: 1440, height: 960 });
  await openRelease(page);
  await page.locator('#recordsBtn').click();
  await page.locator('[data-record-tab="history"]').click();
  await page.locator('.history-card').waitFor({ state: 'visible' });
  await page.locator('.history-card details').evaluate(element => { element.open = true; });
  await capture(page, 'detailed-result.png');

  await openRelease(page);
  await page.locator('#dailyStartBtn').click();
  await page.locator('.slot-card').first().waitFor({ state: 'visible' });
  await capture(page, 'daily-menu.png');

  await page.setViewportSize({ width: 390, height: 844 });
  await openRelease(page);
  await page.locator('#newGameBtn').click();
  await page.locator('#fateOpenBtn').click();
  const fateCode = await page.evaluate(() => globalThis.TabenaiRecords.encodeFateCode({
    gameVersion: '4.8.0',
    mode: 'survival',
    seed: 1_264_873_921,
    choices: [0, 1, 0, 0, 1, 0, 1, 1, 0, 0]
  }));
  await page.locator('#fateCodeText').fill(fateCode);
  await page.locator('#fatePreviewBtn').click();
  await page.locator('#fatePreview').waitFor({ state: 'visible' });
  await capture(page, 'fate-code.png');

  process.stdout.write(`Showcase records: ${JSON.stringify(showcase)}\n`);

  await context.close();
} finally {
  await browser.close();
  if (server) server.kill();
}

process.stdout.write(`Captured v4.8 screenshots in ${outputDir}\n`);
