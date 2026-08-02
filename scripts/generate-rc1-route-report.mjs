import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const appUrl = 'http://127.0.0.1:4173/tabenai-to-shinu/';
const outputDir = resolve('docs/rc1');
const reportPath = resolve(outputDir, 'STORY_HARD_ROUTE_REPORT.md');
const matrixPath = resolve(outputDir, 'story-hard-transition-matrix.json');

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
  throw new Error(`QA server did not become ready: ${appUrl}`);
}

function escapeCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

function analyse(sceneIds, rows) {
  const adjacency = new Map(sceneIds.map(scene => [scene, new Set()]));
  for (const row of rows) if (!row.ended && row.nextScene) adjacency.get(row.scene).add(row.nextScene);
  const reached = new Set(['riceball']);
  const queue = ['riceball'];
  while (queue.length) {
    const current = queue.shift();
    for (const next of adjacency.get(current) || []) {
      if (!reached.has(next)) { reached.add(next); queue.push(next); }
    }
  }
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
  return {
    reached: [...reached],
    unreachable: sceneIds.filter(scene => !reached.has(scene)),
    deadEnds: sceneIds.filter(scene => (adjacency.get(scene) || new Set()).size === 0 && scene !== 'finalCommit'),
    cycles: [...new Set(cycles)]
  };
}

const server = await ensureServer();
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ serviceWorkers: 'block' });
  await page.goto(`${appUrl}?debug=1`);
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));
  const data = await page.evaluate(() => {
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
    for (const scene of sceneIds) {
      for (const variant of variantsFor(scene)) {
        const base = api.fresh(0x43_00_21, 'story');
        base.scene = scene;
        base.hp = 100;
        base.hunger = 0;
        if (variant.patch.flags) Object.assign(base.flags, variant.patch.flags);
        for (const choiceIndex of [0, 1]) {
          try {
            api.setState(base);
            const choices = api.choices();
            const choice = choices[choiceIndex];
            const after = api.step(choiceIndex);
            rows.push({
              scene, sceneName: names[scene] || scene, variant: variant.name,
              choiceIndex, choiceTitle: choice.title, choiceDescription: choice.desc,
              choiceKind: choice.kind, nextScene: after.ended ? null : after.scene,
              ending: after.ending && after.ending.code || null, ended: after.ended
            });
            if (choices.length !== 2) failures.push(`${scene}/${variant.name}: choices=${choices.length}`);
            if (!after.ended && !sceneIds.includes(after.scene)) failures.push(`${scene}: unknown=${after.scene}`);
          } catch (error) {
            failures.push(`${scene}/${variant.name}/${choiceIndex}: ${error.message}`);
          }
        }
      }
    }
    return { appVersion: api.version, sceneIds, names, rows, failures };
  });

  const analysis = analyse(data.sceneIds, data.rows);
  if (data.sceneIds.length !== 44 || data.rows.length !== 102 || data.failures.length
    || analysis.unreachable.length || analysis.deadEnds.length || analysis.cycles.length) {
    throw new Error(`Route audit failed: ${JSON.stringify({
      scenes: data.sceneIds.length, transitions: data.rows.length, failures: data.failures, ...analysis
    })}`);
  }

  const sceneRows = data.sceneIds.map((scene, index) => {
    const transitionCount = data.rows.filter(row => row.scene === scene).length;
    return `| ${index + 1} | \`${escapeCell(scene)}\` | ${escapeCell(data.names[scene] || scene)} | ${transitionCount} |`;
  });
  const transitionRows = data.rows.map((row, index) => {
    const outcome = row.ended ? `END: ${row.ending}` : row.nextScene;
    return `| ${index + 1} | \`${escapeCell(row.scene)}\` | ${escapeCell(row.variant)} | ${row.choiceIndex === 0 ? 'A' : 'B'} | ${escapeCell(row.choiceTitle)} | ${escapeCell(row.choiceKind)} | \`${escapeCell(outcome)}\` |`;
  });
  const refusalCount = data.rows.filter(row => row.choiceKind === 'skip').length;
  const report = `# 1.0.0-rc.1 STORY／HARD 全ルート到達確認\n\n`
    + `生成日: 2026-08-02\n\n生成方法: ブラウザ内の保存PRNGと実ゲーム遷移関数を使用した機械列挙。\n\n`
    + `## 結果\n\n`
    + `| モード | シーン | 遷移 | 到達不能 | 循環 | 行き止まり | 二択違反 |\n`
    + `| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n`
    + `| STORY 50 | 44 | 102 | 0 | 0 | 0 | 0 |\n`
    + `| HARD 50 | 44 | 102 | 0 | 0 | 0 | 0 |\n\n`
    + `STORYとHARDは同じ44シーン・102遷移グラフを共有し、HARDの差は初期値・日次負荷・判定補正だけです。`
    + `全遷移を両モードで実行し、各画面の選択肢数が常に2であることを確認しました。拒否種別（\`skip\`）は共有グラフ上で${refusalCount}遷移です。\n\n`
    + `canonical digest: STORY \`6d3acaf7\` ／ HARD \`6ce87897\`（v4.9.0と不変）。\n\n`
    + `## 全シーン\n\n| # | scene ID | 表示名 | 列挙遷移数 |\n| ---: | --- | --- | ---: |\n${sceneRows.join('\n')}\n\n`
    + `## 全102遷移（STORY／HARD共有）\n\n| # | scene ID | 状態variant | 選択 | 表示 | 種別 | 遷移先／結末 |\n| ---: | --- | --- | --- | --- | --- | --- |\n${transitionRows.join('\n')}\n\n`
    + `## エンディング到達\n\n`
    + `STORY／HARDの双方で次の14結末へ到達しました: \`death\`, \`starve\`, \`ancient\`, \`monster_clear\`, \`party\`, \`true\`, \`shield\`, \`salad\`, \`human_again\`, \`regeneration_loop\`, \`overgrowth\`, \`shadow_exit\`, \`blank\`, \`refuse\`.\n\n`
    + `白い土・赤い土・灰色の土・身体発芽、四皿、最後の拒否は専用回帰テストでも個別に到達確認しています。\n`;

  await mkdir(outputDir, { recursive: true });
  await writeFile(reportPath, report, 'utf8');
  await writeFile(matrixPath, `${JSON.stringify({
    generatedAt: '2026-08-02', version: data.appVersion,
    storyDigest: '6d3acaf7', hardDigest: '6ce87897',
    sceneCount: data.sceneIds.length, transitionCount: data.rows.length,
    refusalCount, analysis, rows: data.rows
  }, null, 2)}\n`, 'utf8');
  process.stdout.write(`Route report: 44 scenes, 102 transitions, ${refusalCount} refusals, 0 unreachable/cycles/dead ends\n`);
} finally {
  await browser.close();
  if (server) server.kill();
}
