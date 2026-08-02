import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  APP_URL,
  collectBrowserProblems,
  openApp,
  waitForPresentation
} from './helpers/presentation.mjs';

const VISUAL_INVENTORY = Object.freeze({ background: 8, character: 10, art: 23 });
const VISUAL_DIMENSIONS = Object.freeze({
  background: [1600, 900],
  character: [800, 1200],
  art: [800, 800]
});
const TRACKS = Object.freeze({
  'bgm.title': '空の皿',
  'bgm.normal': '腹の鳴る森',
  'bgm.rare': 'あり得ない一皿',
  'bgm.final': '五十日目',
  'bgm.death': '残された器',
  'bgm.escape': '朝食のない朝'
});

async function filesBelow(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(target));
    else files.push(target);
  }
  return files;
}

function svgDimension(source, name) {
  const match = source.match(new RegExp(`\\b${name}=["'](\\d+)["']`, 'i'));
  return match ? Number(match[1]) : null;
}

function svgText(source, name) {
  const match = source.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? match[1].replace(/<[^>]+>/g, '').trim() : null;
}

function setRange(page, selector, value) {
  return page.locator(selector).evaluate((element, nextValue) => {
    element.value = String(nextValue);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function installWebAudioProbe(context) {
  await context.addInitScript(() => {
    const calls = {
      contexts: 0,
      resumes: 0,
      suspends: 0,
      oscillatorStarts: 0,
      oscillatorStops: 0
    };

    class FakeParam {
      constructor(value = 1) { this.value = value; }
      cancelScheduledValues() {}
      setValueAtTime(value) { this.value = value; }
      linearRampToValueAtTime(value) { this.value = value; }
      exponentialRampToValueAtTime(value) { this.value = value; }
    }

    class FakeNode {
      connect(target) { return target; }
      disconnect() {}
    }

    class FakeGain extends FakeNode {
      constructor() {
        super();
        this.gain = new FakeParam();
      }
    }

    class FakeOscillator extends FakeNode {
      constructor() {
        super();
        this.type = 'sine';
        this.frequency = new FakeParam(440);
        this.onended = null;
      }
      start() { calls.oscillatorStarts += 1; }
      stop() {
        calls.oscillatorStops += 1;
        queueMicrotask(() => { if (this.onended) this.onended(); });
      }
    }

    class FakeAudioContext {
      constructor() {
        calls.contexts += 1;
        this.state = 'suspended';
        this.destination = new FakeNode();
        this.startedAt = performance.now();
      }
      get currentTime() { return (performance.now() - this.startedAt) / 1000; }
      resume() {
        calls.resumes += 1;
        this.state = 'running';
        return Promise.resolve();
      }
      suspend() {
        calls.suspends += 1;
        this.state = 'suspended';
        return Promise.resolve();
      }
      createGain() { return new FakeGain(); }
      createOscillator() { return new FakeOscillator(); }
    }

    Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: FakeAudioContext });
    Object.defineProperty(globalThis, 'webkitAudioContext', { configurable: true, value: FakeAudioContext });

    let hidden = false;
    try {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => hidden ? 'hidden' : 'visible'
      });
    } catch {
      // Chromium permits the instance override used by this integration probe.
    }
    globalThis.__V47_AUDIO_PROBE__ = calls;
    globalThis.__V47_SET_HIDDEN__ = value => {
      hidden = Boolean(value);
      document.dispatchEvent(new Event('visibilitychange'));
    };
  });
}

test('正式SVG 41点の参照・MIME・寸法・alt・subject・licenseを固定する', async ({ request }) => {
  const manifest = JSON.parse(await readFile(path.join(process.cwd(), 'assets', 'manifest.json'), 'utf8'));
  expect(manifest.manifestVersion).toMatch(/^4\.7\.0-/);

  const declared = [];
  for (const [type, expectedCount] of Object.entries(VISUAL_INVENTORY)) {
    const entries = Object.entries(manifest.assets[type] || {});
    expect(entries, `${type} inventory`).toHaveLength(expectedCount);
    for (const [key, entry] of entries) {
      expect(entry.src, `${key} source`).toMatch(/^\.\/assets\/.+\.svg$/);
      expect(entry.mime, `${key} MIME`).toBe('image/svg+xml');
      expect(entry.cache, `${key} cache`).toMatch(/^(precache|lazy)$/);
      expect(Object.hasOwn(entry, 'alt'), `${key} alt declaration`).toBe(true);
      expect(typeof entry.alt, `${key} alt type`).toBe('string');
      expect(entry.licenseId, `${key} license`).toBe('project-v4.7-original-svg');
      if (type === 'art') {
        expect(entry.subject, `${key} subject`).toMatch(/^[a-z0-9-]+$/);
        expect(entry.subjectLabel, `${key} subject label`).toBeTruthy();
        expect(entry.alt, `${key} semantic alt`).toContain(entry.subjectLabel);
      }
      if (type === 'character') {
        expect(entry.alt, `${key} character alt`).toBeTruthy();
        expect(entry.fallback, `${key} emoji fallback`).toBeTruthy();
      }

      const relative = entry.src.replace(/^\.\/assets\//, '');
      declared.push(relative);
      const source = await readFile(path.join(process.cwd(), 'assets', relative), 'utf8');
      const [width, height] = VISUAL_DIMENSIONS[type];
      expect(svgDimension(source, 'width'), `${key} width`).toBe(width);
      expect(svgDimension(source, 'height'), `${key} height`).toBe(height);
      expect(source, `${key} viewBox`).toMatch(new RegExp(`viewBox=["']0 0 ${width} ${height}["']`, 'i'));
      expect(source, `${key} script/image/foreignObject`).not.toMatch(/<(?:script|image|foreignObject)\b/i);
      expect(source, `${key} external href`).not.toMatch(/(?:href|src)\s*=\s*["'](?:https?:|\/\/|data:)/i);
      expect(source, `${key} external CSS/font`).not.toMatch(/@(?:import|font-face)\b|url\(\s*["']?(?:https?:|\/\/|data:)/i);

      const response = await request.get(new URL(entry.src, APP_URL).href);
      expect(response.status(), key).toBe(200);
      expect(response.headers()['content-type'], key).toContain('image/svg+xml');
    }
  }

  const tako = await readFile(path.join(process.cwd(), 'assets', 'characters', 'tako.svg'), 'utf8');
  const takoTentacles = [...tako.matchAll(/data-tentacle=["'](\d+)["']/g)].map(match => Number(match[1]));
  expect(takoTentacles).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  expect(tako).toContain('id="can-hat"');
  expect(svgText(tako, 'desc')).toBe(manifest.assets.character['character.tako'].alt);
  expect(manifest.assets.character['character.tako'].alt).toContain('缶帽子');
  expect(manifest.assets.character['character.tako'].alt).toContain('八本の触腕');

  expect(manifest.assets.character['character.jr'].alt).toBe('琥珀色の薬鞄を掛けたJr.');
  expect(manifest.assets.character['character.jr'].subjectLabel).toBe('薬鞄を掛けたJr.');

  const fullHeal = await readFile(path.join(process.cwd(), 'assets', 'cards', 'full-heal-drop.svg'), 'utf8');
  const fullHealEntry = manifest.assets.art['art.full-heal-drop'];
  expect(fullHeal).toContain('id="full-heal-drop-candy"');
  expect(svgText(fullHeal, 'title')).toBe('全快ドロップ');
  expect(svgText(fullHeal, 'desc')).toBe(fullHealEntry.alt);
  expect(fullHealEntry).toMatchObject({
    subject: 'full-heal-drop',
    subjectLabel: '全快ドロップ'
  });
  expect(fullHealEntry.alt).toContain('ドロップ飴「全快ドロップ」');

  const generator = await readFile(path.join(process.cwd(), 'scripts', 'generate-v47-assets.mjs'), 'utf8');
  expect([...generator.matchAll(/data-tentacle=["'](\d+)["']/g)].map(match => Number(match[1])))
    .toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  expect(generator).toContain('id="can-hat"');
  expect(generator).toContain('id="full-heal-drop-candy"');

  const diskSvgs = (await filesBelow(path.join(process.cwd(), 'assets')))
    .filter(file => file.toLowerCase().endsWith('.svg'))
    .map(file => path.relative(path.join(process.cwd(), 'assets'), file).replaceAll('\\', '/'))
    .sort();
  expect(declared).toHaveLength(41);
  expect(diskSvgs).toHaveLength(41);
  expect([...declared].sort()).toEqual(diskSvgs);
});

test('正式BGM 6曲のmanifestと決定論的Web Audio scoreが一致する', async ({ page }) => {
  const manifest = JSON.parse(await readFile(path.join(process.cwd(), 'assets', 'manifest.json'), 'utf8'));
  const musicSource = await readFile(path.join(process.cwd(), 'music-engine.js'), 'utf8');
  expect(musicSource).not.toContain('Math.random');
  expect(Object.keys(manifest.assets.bgm)).toEqual(Object.keys(TRACKS));

  await openApp(page);
  await waitForPresentation(page);
  const report = await page.evaluate(() => {
    const digest = value => {
      const text = JSON.stringify(value);
      let hash = 0x811c9dc5;
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }
      return hash.toString(16).padStart(8, '0');
    };
    return {
      version: globalThis.TabenaiMusic.version,
      descriptors: globalThis.TabenaiMusic.describeAll(),
      sequences: globalThis.TabenaiMusic.describeAll().map(track => {
        const first = globalThis.TabenaiMusic.renderSequence(track.key);
        const second = globalThis.TabenaiMusic.renderSequence(track.key);
        return {
          key: track.key,
          notes: first.length,
          first: digest(first),
          second: digest(second),
          finite: first.every(note => Number.isFinite(note.time)
            && Number.isFinite(note.frequency) && Number.isFinite(note.duration))
        };
      })
    };
  });
  expect(report.version).toBe('4.7.0');
  expect(report.descriptors).toHaveLength(6);
  expect(report.sequences.every(item => item.notes > 0 && item.first === item.second && item.finite)).toBe(true);

  for (const descriptor of report.descriptors) {
    const entry = manifest.assets.bgm[descriptor.key];
    expect(entry, descriptor.key).toBeTruthy();
    expect(entry.label).toBe(TRACKS[descriptor.key]);
    expect(entry.src).toBeNull();
    expect(entry.generator).toBe(descriptor.generation);
    expect(entry.bpm).toBe(descriptor.bpm);
    expect(entry.bars).toBe(descriptor.bars);
    expect(entry.loop).toBe(descriptor.loop);
    expect(entry.durationSeconds).toBeCloseTo(descriptor.durationSeconds, 3);
    expect(entry.durationSeconds).toBeGreaterThanOrEqual(15);
    expect(entry.durationSeconds).toBeLessThanOrEqual(90);
    expect(entry.licenseId).toBe('project-v4.7-generated-audio');
  }
  expect(manifest.assets.bgm['bgm.death'].loop).toBe(false);
});

test('クレジット／ライセンス画面と開発ギャラリーから全正式素材を監査できる', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(new URL('?debug=1', APP_URL).href);
  await waitForPresentation(page);
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));
  await expect(page.locator('#titleScreen')).toBeVisible();
  await page.locator('.title-manage > summary').click();
  await page.locator('#titleCreditsBtn').click();
  await expect(page.locator('#creditsScreen')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'いただきますの森' })).toBeVisible();
  await expect(page.getByText('正式アート', { exact: true })).toBeVisible();
  await expect(page.getByText('正式音響', { exact: true })).toBeVisible();
  await expect(page.getByText('project-v4.7-original-svg')).toBeVisible();
  await expect(page.getByText('project-v4.7-generated-audio')).toBeVisible();
  await expect(page.getByText(/軽量モードでは曲・長さ・ループを保ったまま音数と装飾音を減らします/)).toBeVisible();
  await expect(page.getByText(/開発支援：OpenAI ChatGPT \/ Codex/)).toBeVisible();
  await page.locator('#creditsBackBtn').click();
  await expect(page.locator('#titleScreen')).toBeVisible();

  await page.goto(new URL('asset-gallery.html', APP_URL).href);
  await expect(page.locator('#galleryStatus')).toContainText('manifest 4.7.0');
  await expect(page.locator('.asset')).toHaveCount(41);
  for (const [type, count] of Object.entries(VISUAL_INVENTORY)) {
    await expect(page.locator(`.asset[data-type="${type}"]`)).toHaveCount(count);
  }
  await expect(page.locator('.track')).toHaveCount(6);
  for (const label of Object.values(TRACKS)) await expect(page.getByText(label, { exact: true })).toBeVisible();
  await expect.poll(() => page.locator('.asset img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
  await context.close();
});

test('trusted gesture前は無音で、操作後にBGM・音量・mute・visibilityが動作する', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await installWebAudioProbe(context);
  const page = await context.newPage();
  await openApp(page);
  await waitForPresentation(page);
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));

  expect(await page.evaluate(() => globalThis.__V47_AUDIO_PROBE__)).toMatchObject({ contexts: 0, oscillatorStarts: 0 });
  expect(await page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot())).toMatchObject({
    audioUnlocked: false,
    audioContextState: 'not-created',
    music: null
  });

  await page.locator('#settingsBtn').click();
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().audioUnlocked)).toBe(true);
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().music?.currentKey)).toBe('bgm.normal');
  await expect.poll(() => page.evaluate(() => globalThis.__V47_AUDIO_PROBE__.oscillatorStarts)).toBeGreaterThan(0);
  expect(await page.evaluate(() => globalThis.__V47_AUDIO_PROBE__.contexts)).toBe(1);

  await setRange(page, '#bgmVolumeSetting', 24);
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().music?.volume)).toBeCloseTo(0.24, 5);
  await page.locator('#bgmMutedSetting').check();
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().music?.muted)).toBe(true);
  await page.locator('#bgmMutedSetting').uncheck();
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().music?.muted)).toBe(false);

  await page.evaluate(() => globalThis.__V47_SET_HIDDEN__(true));
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().music?.visible)).toBe(false);
  await expect.poll(() => page.evaluate(() => globalThis.__V47_AUDIO_PROBE__.suspends)).toBeGreaterThan(0);
  const resumesWhileHidden = await page.evaluate(() => globalThis.__V47_AUDIO_PROBE__.resumes);
  await page.evaluate(() => globalThis.__V47_SET_HIDDEN__(false));
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => globalThis.__V47_AUDIO_PROBE__.resumes)).toBe(resumesWhileHidden);
  expect(await page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().music?.visible)).toBe(false);
  await page.locator('#settingsScreen .screen-head h1').click();
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().music?.visible)).toBe(true);
  await expect.poll(() => page.evaluate(() => globalThis.__V47_AUDIO_PROBE__.resumes)).toBeGreaterThan(1);
  await context.close();
});

test('毒・疲労・負傷を専用SEへroutingし、既存SEを含む全定義が発音可能である', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await installWebAudioProbe(context);
  const page = await context.newPage();
  await openApp(page);
  await waitForPresentation(page);
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));
  await page.locator('#settingsBtn').click();
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().audioUnlocked)).toBe(true);

  const report = await page.evaluate(async () => {
    const engine = globalThis.__TABENAI_PRESENTATION__;
    const debug = globalThis.__TABENAI_DEBUG__;
    const manifest = await (await fetch('./assets/manifest.json')).json();
    const seen = [];
    const original = engine.cue.bind(engine);
    engine.cue = key => {
      seen.push(key);
      return original(key);
    };
    debug.presentationScene({ mode: 'survival', sceneId: 'stored-bread', category: 'common', token: 'poison', status: '毒に侵されている' });
    debug.presentationScene({ mode: 'survival', sceneId: 'stored-bread', category: 'common', token: 'fatigue', status: '疲労が蓄積している' });
    debug.presentationScene({ mode: 'survival', sceneId: 'stored-bread', category: 'common', token: 'injury', status: '負傷して出血している' });
    const cueResults = [];
    for (const key of Object.keys(manifest.assets.se)) {
      await new Promise(resolve => setTimeout(resolve, 40));
      cueResults.push([key, original(key)]);
    }
    delete engine.cue;
    return {
      seen,
      cueResults,
      se: manifest.assets.se,
      actions: manifest.actions,
      hooks: manifest.hooks,
      finalStatus: document.documentElement.dataset.lastPresentationStatus,
      starts: globalThis.__V47_AUDIO_PROBE__.oscillatorStarts
    };
  });
  expect(report.seen).toEqual(expect.arrayContaining(['se.poison', 'se.fatigue', 'se.injury']));
  expect(report.finalStatus).toBe('injury');
  for (const key of ['se.choice', 'se.consume', 'se.refuse', 'se.warning', 'se.poison', 'se.fatigue', 'se.injury', 'se.rare', 'se.milestone', 'se.achievement', 'se.death', 'se.escape', 'se.menu']) {
    expect(report.se[key]?.synth, `${key} synth`).toBeTruthy();
    expect(report.se[key]?.licenseId, `${key} license`).toBe('project-v4.7-synth');
  }
  expect(report.cueResults.every(([, played]) => played)).toBe(true);
  expect(report.starts).toBeGreaterThan(0);
  await context.close();
});

test('タイトルとゲーム内の管理メニューは実操作で専用SEを発音する', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await installWebAudioProbe(context);
  const page = await context.newPage();
  await openApp(page);
  await waitForPresentation(page);
  await page.evaluate(() => {
    globalThis.__TABENAI_DEBUG__.screen('title');
    const engine = globalThis.__TABENAI_PRESENTATION__;
    const original = engine.cue.bind(engine);
    globalThis.__V47_MENU_CUES__ = [];
    engine.cue = key => {
      globalThis.__V47_MENU_CUES__.push(key);
      return original(key);
    };
  });

  expect(await page.evaluate(() => globalThis.__V47_AUDIO_PROBE__.contexts)).toBe(0);
  await page.locator('.title-manage > summary').click();
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().audioUnlocked)).toBe(true);
  await expect.poll(() => page.evaluate(() => globalThis.__V47_MENU_CUES__)).toEqual(['se.menu']);
  await expect(page.locator('html')).toHaveAttribute('data-last-presentation-action', 'menu');
  const titleStarts = await page.evaluate(() => globalThis.__V47_AUDIO_PROBE__.oscillatorStarts);
  expect(titleStarts).toBeGreaterThan(0);

  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('game'));
  await page.waitForTimeout(50);
  await page.locator('#appMenu > summary').click();
  await expect.poll(() => page.evaluate(() => globalThis.__V47_MENU_CUES__)).toEqual(['se.menu', 'se.menu']);
  await expect.poll(() => page.evaluate(() => globalThis.__V47_AUDIO_PROBE__.oscillatorStarts)).toBeGreaterThan(titleStarts);
  await expect(page.locator('html')).toHaveAttribute('data-last-presentation-action', 'menu');
  await context.close();
});

test('画像404とSVG decode失敗でも本文・絵文字・常時二択で進行できる', async ({ browser }) => {
  for (const failure of ['404', 'decode']) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.route('**/assets/cards/rice-ball.svg', route => failure === '404'
      ? route.fulfill({ status: 404, contentType: 'image/svg+xml', body: '' })
      : route.fulfill({ status: 200, contentType: 'image/svg+xml', body: 'not an SVG image' }));
    await openApp(page);
    await waitForPresentation(page);
    await page.evaluate(token => globalThis.__TABENAI_DEBUG__.presentationScene({
      mode: 'story', sceneId: 'riceball', category: 'common', token, icon: '🍙', title: '少し温かいおにぎり'
    }), `asset-${failure}`);
    await expect(page.locator('#sceneArt')).toHaveAttribute('data-asset-state', 'error');
    await expect(page.locator('#sceneArt')).toBeHidden();
    await expect(page.locator('#sceneIcon')).toBeVisible();
    await expect(page.locator('#sceneIcon')).toHaveText('🍙');
    await expect(page.locator('#sceneTitle')).not.toBeEmpty();
    await expect(page.locator('#sceneText')).not.toBeEmpty();
    await expect(page.locator('#choices .choice')).toHaveCount(2);
    await expect(page.locator('#choiceA')).toBeVisible();
    await expect(page.locator('#choiceB')).toBeVisible();
    await context.close();
  }
});

test('音声decode失敗でも無音へfallbackしゲームを継続できる', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await openApp(page);
  await waitForPresentation(page);
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));
  await page.locator('#settingsBtn').click();
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().audioUnlocked)).toBe(true);
  const result = await page.evaluate(async () => {
    const engine = globalThis.__TABENAI_PRESENTATION__;
    const manifest = await (await fetch('./assets/manifest.json')).json();
    manifest.assets.bgm['bgm.test-decode'] = {
      src: 'data:audio/wav;base64,bm90LWF1ZGlv', mime: 'audio/wav', cache: 'lazy',
      loop: false, label: 'decode failure fixture', licenseId: 'test-only'
    };
    engine.setManifestForTest(manifest);
    const before = engine.snapshot().audioFailures;
    engine.playBgm('bgm.test-decode');
    await new Promise(resolve => setTimeout(resolve, 250));
    return { before, after: engine.snapshot().audioFailures };
  });
  expect(result.after).toBeGreaterThan(result.before);
  expect(pageErrors).toEqual([]);
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('game'));
  await expect(page.locator('#sceneTitle')).not.toBeEmpty();
  await expect(page.locator('#sceneText')).not.toBeEmpty();
  await expect(page.locator('#choices .choice')).toHaveCount(2);
  await context.close();
});

test('iPhone 390×844とPC 1440×900で横溢れ・browser warning/errorがない', async ({ browser }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({
      viewport,
      isMobile: viewport.width === 390,
      hasTouch: viewport.width === 390,
      serviceWorkers: 'allow'
    });
    const page = await context.newPage();
    const problems = collectBrowserProblems(page);
    await openApp(page);
    await waitForPresentation(page);
    await expect(page.locator('#sceneVisual')).toBeVisible();
    await expect(page.locator('#choices .choice')).toHaveCount(2);
    await expect.poll(() => page.locator('#sceneArt').getAttribute('data-asset-state')).toBe('ready');
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      visual: document.getElementById('sceneVisual').getBoundingClientRect().toJSON(),
      viewport: { width: innerWidth, height: innerHeight }
    }));
    expect(layout.overflow).toBeLessThanOrEqual(0);
    expect(layout.visual.x).toBeGreaterThanOrEqual(0);
    expect(layout.visual.x + layout.visual.width).toBeLessThanOrEqual(layout.viewport.width + 0.5);
    await page.waitForTimeout(100);
    expect(problems).toEqual({ console: [], pageErrors: [], requestFailures: [], httpErrors: [] });
    await context.close();
  }
});
