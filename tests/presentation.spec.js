import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  APP_URL,
  collectBrowserProblems,
  installMediaSpies,
  openApp,
  runCanonicalGames,
  waitForPresentation
} from './helpers/presentation.mjs';

const META_KEY = 'tabenai-to-shinu-meta-v1';
const EXPECTED_DIGESTS = {
  story: '6d3acaf7',
  hard: '6ce87897'
};

async function filesBelow(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await filesBelow(target));
    else found.push(target);
  }
  return found;
}

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((element, nextValue) => {
    element.value = String(nextValue);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test('asset manifestの全参照・実体・HTTP MIMEが一致し、未使用または未知のキーがない', async ({ request }) => {
  const manifestPath = path.join(process.cwd(), 'assets', 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  expect(manifest.schemaVersion).toBe(1);
  expect(manifest.manifestVersion).toMatch(/^4\.7\.0-/);

  for (const eventId of ['tako-return', 'bean-homecoming', 'shadow-snack', 'moon-mushroom', 'shadow-plate', 'lost-birthday']) {
    expect(manifest.assignments.survival[eventId], `${eventId} must use emoji/character/text fallback`)
      .not.toHaveProperty('artKey');
  }
  for (const eventId of ['stored-bread', 'inverted-rain', 'white-tablet', 'steam-soup', 'bone-biscuit']) {
    expect(manifest.assignments.survival[eventId], `${eventId} must have dedicated matching art`)
      .toHaveProperty('artKey', `art.${eventId}`);
  }
  for (const group of ['scenes', 'survival']) {
    for (const [entryId, assignment] of Object.entries(manifest.assignments[group])) {
      if (!assignment.artKey) continue;
      const art = manifest.assets.art[assignment.artKey];
      expect(assignment.contentSubject, `${group}.${entryId} art subject`).toBe(art.subject);
      expect(art.alt, `${assignment.artKey} alt`).toContain(art.subjectLabel);
    }
  }

  const fieldTypes = {
    backgroundKey: 'background',
    characterKey: 'character',
    artKey: 'art',
    moodKey: 'effect',
    bgmKey: 'bgm',
    seKey: 'se'
  };
  const references = new Map(Object.keys(manifest.assets).map((type) => [type, new Set()]));
  const unknown = [];
  const inspect = (value, location = 'manifest') => {
    if (Array.isArray(value)) {
      value.forEach((child, index) => inspect(child, `${location}[${index}]`));
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [field, child] of Object.entries(value)) {
      const type = fieldTypes[field];
      if (type && typeof child === 'string') {
        if (!Object.hasOwn(manifest.assets[type], child)) unknown.push(`${location}.${field}=${child}`);
        else references.get(type).add(child);
      }
      inspect(child, `${location}.${field}`);
    }
  };
  inspect(manifest.assignments, 'assignments');
  expect(manifest.variants && manifest.variants.beanCharacters).toEqual({
    child: 'character.bean-child',
    white: 'character.bean-past-white',
    red: 'character.bean-future-red',
    gray: 'character.bean-present-gray',
    body: 'character.bean-body'
  });
  for (const [variant, key] of Object.entries(manifest.variants.beanCharacters)) {
    if (!Object.hasOwn(manifest.assets.character, key)) unknown.push(`variants.beanCharacters.${variant}=${key}`);
    else references.get('character').add(key);
  }
  inspect(manifest.hooks, 'hooks');
  for (const [action, key] of Object.entries(manifest.actions)) {
    if (!Object.hasOwn(manifest.assets.se, key)) unknown.push(`actions.${action}=${key}`);
    else references.get('se').add(key);
  }
  expect(unknown).toEqual([]);

  const unused = [];
  const declaredFiles = [];
  for (const [type, entries] of Object.entries(manifest.assets)) {
    for (const [key, entry] of Object.entries(entries)) {
      expect(key, `${type} key prefix`).toMatch(type === 'effect' ? /^mood\./ : new RegExp(`^${type}\\.`));
      expect(entry.licenseId, `${key} licenseId`).toBeTruthy();
      if (!references.get(type).has(key)) unused.push(key);
      if (!entry.src) continue;
      expect(entry.src, `${key} must be subpath-relative`).toMatch(/^\.\/assets\//);
      expect(entry.cache, `${key} cache policy`).toMatch(/^(precache|lazy)$/);
      expect(entry.mime, `${key} MIME declaration`).toBeTruthy();
      declaredFiles.push(entry.src.replace(/^\.\/assets\//, '').replaceAll('\\', '/'));
      const response = await request.get(new URL(entry.src, APP_URL).href);
      expect(response.status(), entry.src).toBe(200);
      expect(response.headers()['content-type'], entry.src).toContain(entry.mime);
    }
  }
  expect(unused).toEqual([]);

  const diskFiles = (await filesBelow(path.join(process.cwd(), 'assets')))
    .map((file) => path.relative(path.join(process.cwd(), 'assets'), file).replaceAll('\\', '/'))
    .filter((file) => file !== 'manifest.json')
    .sort();
  expect([...declaredFiles].sort()).toEqual(diskFiles);
});

test('visual layersと全presentation hookはゲームstate/rngを変更しない', async ({ page }) => {
  await openApp(page);
  await waitForPresentation(page);
  const before = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.snapshot());

  await page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.presentScreen('title'));
  await expect(page.locator('html')).toHaveAttribute('data-presentation-hook', 'title');
  await expect(page.locator('#titleBackdrop')).toHaveAttribute('src', /title-night\.svg/);

  const hooks = [
    ['normal', { mode: 'story', sceneId: 'riceball', category: 'common', token: 'normal:1', icon: '🍙', title: 'normal' }],
    ['warning', { mode: 'story', sceneId: 'redmushroom', category: 'common', status: '毒', token: 'warning:1', icon: '🍄', title: 'warning' }],
    ['rare', { mode: 'survival', sceneId: 'ordinary-meal', category: 'rare', token: 'rare:1', icon: '🍱', title: 'rare' }],
    ['conditional', { mode: 'survival', sceneId: 'tako-return', category: 'conditional', token: 'conditional:1', icon: '🐙', title: 'conditional' }],
    ['milestone', { mode: 'survival', sceneId: 'milestone-stockpile', category: 'milestone', token: 'milestone:1', icon: '📦', title: 'milestone' }],
    ['final', { mode: 'survival', sceneId: 'final-pair', category: 'final', token: 'final:1', icon: '📦', title: 'final' }]
  ];
  for (const [hook, context] of hooks) {
    await page.evaluate((value) => globalThis.__TABENAI_DEBUG__.presentationScene(value), context);
    await expect(page.locator('#sceneCard')).toHaveAttribute('data-presentation', hook);
    expect(await page.evaluate(() => globalThis.__TABENAI_DEBUG__.presentation().lastHook)).toBe(hook);
  }

  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.presentationScene({
    mode: 'survival', sceneId: 'tako-return', category: 'conditional', token: 'character:1', icon: '🐙', title: 'character'
  }));
  await expect(page.locator('#sceneBackground')).toHaveAttribute('src', /forest-day\.svg/);
  await expect(page.locator('#sceneArt')).not.toHaveAttribute('src', /.+/);
  await expect(page.locator('#sceneArt')).toHaveAttribute('data-asset-state', 'fallback');
  await expect(page.locator('#sceneArt')).toBeHidden();
  await expect(page.locator('#sceneIcon')).toBeVisible();
  await expect(page.locator('#sceneIcon')).toHaveText('🐙');
  await expect(page.locator('#sceneCharacter')).toBeVisible();
  await expect(page.locator('#sceneCharacter')).toHaveAttribute('src', /characters\/tako\.svg/);
  await expect(page.locator('#sceneCharacter')).toHaveAttribute('alt', /寄生タコ/);
  await expect(page.locator('#sceneCharacterFallback')).toBeHidden();
  await expect(page.locator('#sceneEffect')).toHaveClass(/mood-normal/);
  await expect(page.locator('#sceneVisual')).toBeVisible();
  await expect(page.locator('#sceneContent')).toBeVisible();

  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.presentationEnding({ endingCode: 'death', token: 'death:1', title: 'death' }));
  await expect(page.locator('#sceneCard')).toHaveAttribute('data-presentation', 'death');
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.presentationEnding({ endingCode: 'clear', token: 'escape:1', title: 'escape' }));
  await expect(page.locator('#sceneCard')).toHaveAttribute('data-presentation', 'escape');

  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.presentationAchievement({ id: 'test', icon: '🏆', name: 'Test Achievement' }));
  await expect(page.locator('#achievementPresentation')).toBeVisible();
  await expect(page.locator('[data-achievement-name]')).toHaveText('Test Achievement');
  expect(await page.evaluate(() => globalThis.__TABENAI_DEBUG__.presentation().lastHook)).toBe('achievement');

  const after = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.snapshot());
  expect(after).toEqual(before);
});

test('白・赤・灰・身体豆の正式立ち絵を成立直後と後続シーンへ表示し、明示キャラクターを優先する', async ({ page }) => {
  await openApp(page);
  await waitForPresentation(page);

  const routes = [
    { name: 'white', scene: 'soilColor', choice: 0, asset: 'bean-past-white.svg', alt: '過去' },
    { name: 'red', scene: 'soilColor', choice: 1, asset: 'bean-future-red.svg', alt: '未来' },
    { name: 'gray', scene: 'graySoil', choice: 0, asset: 'bean-present-gray.svg', alt: '現在' },
    { name: 'body', scene: 'beanDeadlineAction', choice: 1, asset: 'bean-body.svg', alt: '身体' }
  ];

  for (const route of routes) {
    const immediate = await page.evaluate(({ scene, choice }) => {
      const api = globalThis.__TABENAI_DEBUG__;
      const run = api.fresh(4700, 'story');
      run.scene = scene;
      run.hp = 100;
      run.hunger = 0;
      run.flags.beanCarried = true;
      api.setState(run);
      return api.step(choice);
    }, route);
    expect(immediate.flags.beanSoil, `${route.name} soil`).toBe(route.name);
    expect(immediate.companions.beanChild, `${route.name} companion`).toBe(true);
    await expect(page.locator('#sceneCharacter'), `${route.name} immediately`).toHaveAttribute('src', new RegExp(route.asset));
    await expect(page.locator('#sceneCharacter')).toHaveAttribute('alt', new RegExp(route.alt));
    await expect(page.locator('#sceneCharacter')).toHaveAttribute('data-asset-state', 'ready');

    await page.evaluate(() => {
      const api = globalThis.__TABENAI_DEBUG__;
      const later = api.snapshot();
      later.scene = 'moss';
      api.setState(later);
    });
    await expect(page.locator('#sceneCharacter'), `${route.name} later`).toHaveAttribute('src', new RegExp(route.asset));
    await expect(page.locator('#sceneCharacter')).toHaveAttribute('alt', new RegExp(route.alt));
    await expect(page.locator('#sceneCharacter')).toHaveAttribute('data-asset-state', 'ready');
  }

  const precedence = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const context = {
      mode: 'survival', sceneId: 'tako-return', category: 'conditional', token: 'bean-priority',
      icon: '🐙', title: '寄生タコの帰還', beanSoil: 'red', beanChild: true
    };
    api.presentationScene(context);
    return api.presentationResolve(context).assets.character.key;
  });
  expect(precedence).toBe('character.tako');
  await expect(page.locator('#sceneCharacter')).toHaveAttribute('src', /characters\/tako\.svg/);

  const child = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.presentationResolve({
    mode: 'story', sceneId: 'moss', beanChild: true
  }).assets.character.key);
  expect(child).toBe('character.bean-child');
});

test('未知キーと画像404ではemoji/text/two choicesへ安全にfallbackする（SWを遮断）', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  let image404s = 0;
  await page.route('**/assets/cards/rice-ball.svg', async (route) => {
    image404s += 1;
    await route.fulfill({ status: 404, contentType: 'image/svg+xml', body: '' });
  });
  await openApp(page);
  await waitForPresentation(page);
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.presentationScene({
    mode: 'story', sceneId: 'riceball', category: 'common', token: '404:1', icon: '🍙', title: 'fallback'
  }));
  await expect(page.locator('#sceneArt')).toHaveAttribute('data-asset-state', 'error');
  await expect(page.locator('#sceneIcon')).toBeVisible();
  await expect(page.locator('#sceneIcon')).toHaveText('🍙');
  expect(image404s).toBeGreaterThan(0);

  const unknown = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    api.presentationScene({
      mode: 'story', sceneId: 'not-in-manifest', category: 'common', token: 'unknown:1',
      icon: '❓', title: 'Unknown', backgroundKey: 'background.unknown', artKey: 'art.unknown',
      characterKey: 'character.unknown', moodKey: 'mood.unknown'
    });
    return api.presentationResolve({
      mode: 'story', sceneId: 'not-in-manifest', category: 'common',
      backgroundKey: 'background.unknown', artKey: 'art.unknown',
      characterKey: 'character.unknown', moodKey: 'mood.unknown'
    });
  });
  expect(unknown.assets.background).toBeNull();
  expect(unknown.assets.art).toBeNull();
  await expect(page.locator('#sceneIcon')).toHaveText('❓');
  await expect(page.locator('#sceneTitle')).not.toBeEmpty();
  await expect(page.locator('#sceneText')).not.toBeEmpty();
  await expect(page.locator('#choices .choice')).toHaveCount(2);
  await expect(page.locator('#choiceA')).toBeVisible();
  await expect(page.locator('#choiceB')).toBeVisible();

  const beforeChoice = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.snapshot().choiceCount);
  await page.locator('#choiceA').click();
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_DEBUG__.snapshot().choiceCount)).toBe(beforeChoice + 1);
  await context.close();
});

test('AudioContextは最初のtrusted action後だけ生成され、reload後は再操作を要求する', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await installMediaSpies(context);
  const page = await context.newPage();
  await openApp(page);
  await waitForPresentation(page);
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));

  expect(await page.evaluate(() => globalThis.__MEDIA_CALLS__.contexts)).toBe(0);
  expect(await page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().audioContextState)).toBe('not-created');
  await page.locator('#newGameBtn').click();
  await expect.poll(() => page.evaluate(() => globalThis.__MEDIA_CALLS__.contexts)).toBe(1);
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().audioUnlocked)).toBe(true);

  await page.reload();
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));
  await waitForPresentation(page);
  expect(await page.evaluate(() => globalThis.__MEDIA_CALLS__.contexts)).toBe(0);
  expect(await page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().audioUnlocked)).toBe(false);

  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => globalThis.__MEDIA_CALLS__.contexts)).toBe(1);
  await context.close();
});

test('BGM/SE・mute・haptics・lightVisualsをmeta/reload/formatVersion 3に保持し、旧meta/v1をdefault補完する', async ({ page }) => {
  await openApp(page);
  await waitForPresentation(page);
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('settings'));
  await expect(page.locator('#settingsScreen')).toBeVisible();
  await expect(page.getByText('オリジナル6曲。最初のユーザー操作後にのみ再生')).toBeVisible();
  await expect(page.getByText('軽量モード（画像とBGM編成を簡略化）', { exact: true })).toBeVisible();
  await expect(page.getByText('画像を絵文字と本文へ切り替え、BGMの音数を減らします', { exact: true })).toBeVisible();

  await setRange(page, '#bgmVolumeSetting', 23);
  await setRange(page, '#seVolumeSetting', 71);
  await page.locator('#bgmMutedSetting').check();
  await page.locator('#seMutedSetting').check();
  await page.locator('#hapticsSetting').uncheck();
  await page.locator('#lightVisualsSetting').check();

  const expected = {
    bgmVolume: 0.23,
    seVolume: 0.71,
    bgmMuted: true,
    seMuted: true,
    haptics: false,
    lightVisuals: true
  };
  const saved = await page.evaluate(({ metaKey }) => JSON.parse(localStorage.getItem(metaKey)).settings, { metaKey: META_KEY });
  expect(saved).toMatchObject(expected);
  const transfer = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.transfer());
  expect(transfer.formatVersion).toBe(3);
  expect(transfer.slots).toHaveLength(3);
  expect(transfer.codex).toBeTruthy();
  expect(transfer.history).toEqual(expect.any(Array));
  expect(transfer.dailyRecords).toBeTruthy();
  expect(transfer.meta.settings).toMatchObject(expected);

  await page.reload();
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('settings'));
  expect(await page.locator('#bgmVolumeSetting').inputValue()).toBe('23');
  expect(await page.locator('#seVolumeSetting').inputValue()).toBe('71');
  await expect(page.locator('#bgmMutedSetting')).toBeChecked();
  await expect(page.locator('#seMutedSetting')).toBeChecked();
  await expect(page.locator('#hapticsSetting')).not.toBeChecked();
  await expect(page.locator('#lightVisualsSetting')).toBeChecked();

  await page.evaluate(({ metaKey }) => {
    localStorage.setItem(metaKey, JSON.stringify({
      version: 1,
      achievements: {},
      endings: {},
      stats: {},
      settings: { fontSize: 'large', bgmVolume: 'invalid', haptics: 'invalid' }
    }));
  }, { metaKey: META_KEY });
  await page.reload();
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));
  const legacyMeta = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.meta());
  expect(legacyMeta.settings).toMatchObject({
    fontSize: 'large', bgmVolume: 0.45, seVolume: 0.65,
    bgmMuted: false, seMuted: false, haptics: true, lightVisuals: false
  });

  const legacyTransfer = {
    format: 'tabenai-save',
    formatVersion: 1,
    appVersion: '4.3.0',
    state: {
      version: 4,
      seed: 4601,
      rngState: 4601,
      scene: 'riceball',
      day: 1,
      hp: 94,
      hunger: 26,
      status: 'legacy presentation defaults',
      choiceCount: 2
    },
    endings: {}
  };
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));
  await page.locator('.title-manage > summary').click();
  await page.locator('#titleDataBtn').click();
  await page.locator('#saveTransferText').fill(JSON.stringify(legacyTransfer));
  await Promise.all([
    page.waitForEvent('load'),
    page.locator('#importSaveBtn').click()
  ]);
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));
  const afterV1 = await page.evaluate(() => ({
    run: globalThis.__TABENAI_DEBUG__.snapshot(),
    settings: globalThis.__TABENAI_DEBUG__.meta().settings
  }));
  expect(afterV1.run.mode).toBe('story');
  expect(afterV1.run.seed).toBe(4601);
  expect(afterV1.settings).toMatchObject({
    bgmVolume: 0.45, seVolume: 0.65,
    bgmMuted: false, seMuted: false, haptics: true, lightVisuals: false
  });
});

test('BGM/SE音量・mute・haptics・lightVisualsを実際の出力へ反映する', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await installMediaSpies(context);
  const page = await context.newPage();
  await openApp(page);
  await waitForPresentation(page);
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));
  await page.locator('#newGameBtn').click();
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().audioUnlocked)).toBe(true);

  const enabled = await page.evaluate(async () => {
    const engine = globalThis.__TABENAI_PRESENTATION__;
    const manifest = await (await fetch('./assets/manifest.json')).json();
    manifest.assets.bgm['bgm.test-volume'] = {
      src: 'data:audio/wav;base64,UklGRg==', mime: 'audio/wav', cache: 'lazy', loop: true, licenseId: 'test-only'
    };
    engine.setManifestForTest(manifest);
    engine.setSettings({
      bgmVolume: 0.23, seVolume: 0.71,
      bgmMuted: false, seMuted: false,
      haptics: true, lightVisuals: false
    });
    const bgmPlayed = engine.playBgm('bgm.test-volume');
    const action = engine.action('eat');
    return {
      bgmPlayed,
      action,
      bgmVolume: engine.currentBgm && engine.currentBgm.volume,
      calls: structuredClone(globalThis.__MEDIA_CALLS__)
    };
  });
  expect(enabled.bgmPlayed).toBe(true);
  expect(enabled.action).toBe('consume');
  expect(enabled.bgmVolume).toBeCloseTo(0.23, 6);
  expect(enabled.calls.audioPlay).toBeGreaterThan(0);
  expect(enabled.calls.oscillatorStarts).toBeGreaterThan(0);
  expect(enabled.calls.gains.at(-1)).toBeCloseTo(0.71 * 0.12, 6);
  expect(enabled.calls.vibrations.length).toBeGreaterThan(0);

  const disabled = await page.evaluate(() => {
    const engine = globalThis.__TABENAI_PRESENTATION__;
    const before = structuredClone(globalThis.__MEDIA_CALLS__);
    engine.setSettings({
      bgmMuted: true, seMuted: true,
      haptics: false, lightVisuals: true
    });
    const bgmPlayed = engine.playBgm('bgm.test-volume');
    const action = engine.action('eat');
    const bgmVolume = engine.currentBgm && engine.currentBgm.volume;
    engine.presentScene({
      mode: 'story', sceneId: 'riceball', category: 'common', token: 'light-visuals', icon: '🍙'
    });
    return {
      before,
      after: structuredClone(globalThis.__MEDIA_CALLS__),
      bgmPlayed,
      action,
      bgmVolume,
      lightClass: document.documentElement.classList.contains('presentation-light-visuals'),
      musicLightVisuals: engine.snapshot().music && engine.snapshot().music.lightVisuals,
      artSrc: document.getElementById('sceneArt').getAttribute('src'),
      artHidden: document.getElementById('sceneArt').hidden,
      fallbackHidden: document.getElementById('sceneIcon').hidden
    };
  });
  expect(disabled.bgmPlayed).toBe(false);
  expect(disabled.action).toBe('consume');
  expect(disabled.bgmVolume).toBe(0);
  expect(disabled.after.audioPause).toBeGreaterThan(disabled.before.audioPause);
  expect(disabled.after.audioPlay).toBe(disabled.before.audioPlay);
  expect(disabled.after.oscillatorStarts).toBe(disabled.before.oscillatorStarts);
  expect(disabled.after.vibrations).toEqual(disabled.before.vibrations);
  expect(disabled.lightClass).toBe(true);
  expect(disabled.musicLightVisuals).toBe(true);
  expect(disabled.artSrc).toBeNull();
  expect(disabled.artHidden).toBe(true);
  expect(disabled.fallbackHidden).toBe(false);
  await context.close();
});

test('visibilityで音をpause/resumeし、存在しない音源でも例外を漏らさない', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await installMediaSpies(context);
  const page = await context.newPage();
  const problems = collectBrowserProblems(page);
  await openApp(page);
  await waitForPresentation(page);
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));
  await page.locator('#newGameBtn').click();
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().audioUnlocked)).toBe(true);

  const missingStatus = await page.evaluate(async () => (await fetch('./assets/audio/not-found.ogg')).status);
  expect(missingStatus).toBe(404);
  const audioResult = await page.evaluate(async () => {
    const engine = globalThis.__TABENAI_PRESENTATION__;
    const manifest = await (await fetch('./assets/manifest.json')).json();
    manifest.assets.bgm['bgm.test-404'] = {
      src: './assets/audio/not-found.ogg', mime: 'audio/ogg', cache: 'lazy', loop: true, licenseId: 'test-only'
    };
    engine.setManifestForTest(manifest);
    const beforeFailures = engine.snapshot().audioFailures;
    const played = engine.playBgm('bgm.test-404');
    engine.currentBgm.dispatchEvent(new Event('error'));
    await Promise.resolve();
    return { played, beforeFailures, afterFailures: engine.snapshot().audioFailures };
  });
  expect(audioResult.played).toBe(true);
  expect(audioResult.afterFailures).toBe(audioResult.beforeFailures + 1);

  const beforeVisibility = await page.evaluate(() => ({ ...globalThis.__MEDIA_CALLS__ }));
  await page.evaluate(() => globalThis.__setTestVisibility(true));
  await expect.poll(() => page.evaluate(() => globalThis.__MEDIA_CALLS__.suspends)).toBeGreaterThan(beforeVisibility.suspends);
  await expect.poll(() => page.evaluate(() => globalThis.__MEDIA_CALLS__.audioPause)).toBeGreaterThan(beforeVisibility.audioPause);
  await page.evaluate(() => globalThis.__setTestVisibility(false));
  await expect.poll(() => page.evaluate(() => globalThis.__MEDIA_CALLS__.resumes)).toBeGreaterThan(beforeVisibility.resumes);
  await expect.poll(() => page.evaluate(() => globalThis.__MEDIA_CALLS__.audioPlay)).toBeGreaterThan(beforeVisibility.audioPlay);

  expect(problems.pageErrors).toEqual([]);
  expect(problems.requestFailures).toEqual([]);
  await context.close();
});

test('OS指定と明示設定のreduced motionを尊重する', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page);
  await waitForPresentation(page);
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  expect(await page.evaluate(() => globalThis.__TABENAI_DEBUG__.presentation().reducedMotion)).toBe(true);
  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.presentationScene({
    mode: 'story', sceneId: 'riceball', category: 'common', token: 'os-reduced', icon: '🍙'
  }));
  await expect(page.locator('#sceneCard')).not.toHaveClass(/presentation-pulse/);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_DEBUG__.presentation().reducedMotion)).toBe(false);
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const meta = api.meta();
    meta.settings.reducedMotion = true;
    api.setMeta(meta);
    api.presentationScene({ mode: 'story', sceneId: 'riceball', category: 'common', token: 'explicit-reduced', icon: '🍙' });
  });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await expect(page.locator('#sceneCard')).not.toHaveClass(/presentation-pulse/);

  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const meta = api.meta();
    meta.settings.reducedMotion = false;
    api.setMeta(meta);
    api.presentationScene({ mode: 'story', sceneId: 'riceball', category: 'common', token: 'full-motion', icon: '🍙' });
  });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  await expect(page.locator('#sceneCard')).toHaveClass(/presentation-pulse/);
});

test('presentation主要assetをService Workerへprecacheし完全offlineで再起動できる', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  await installMediaSpies(context);
  const page = await context.newPage();
  await openApp(page);
  await waitForPresentation(page);
  const expectedAssets = await page.evaluate(async () => {
    const manifestUrl = './assets/manifest.json?v=1.0.0-rc.1';
    const manifest = await (await fetch(manifestUrl)).json();
    return [
      './music-engine.js?v=1.0.0-rc.1',
      './presentation-engine.js?v=1.0.0-rc.1',
      manifestUrl,
      ...Object.values(manifest.assets)
        .flatMap((group) => Object.values(group))
        .filter((entry) => entry.src && entry.cache === 'precache')
        .map((entry) => entry.src)
    ];
  });

  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));
  await waitForPresentation(page);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  const cachedPaths = await page.evaluate(async () => {
    const paths = [];
    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      for (const request of await cache.keys()) paths.push(new URL(request.url).pathname);
    }
    return [...new Set(paths)];
  });
  const expectedPaths = expectedAssets.map((asset) => new URL(asset, APP_URL).pathname);
  expect(cachedPaths).toEqual(expect.arrayContaining(expectedPaths));

  await context.setOffline(true);
  const offlinePage = await context.newPage();
  await openApp(offlinePage);
  await waitForPresentation(offlinePage);
  await expect(offlinePage.locator('#sceneTitle')).not.toBeEmpty();
  await expect(offlinePage.locator('#choices .choice')).toHaveCount(2);
  const offlineResponses = await offlinePage.evaluate(async (assets) => Promise.all(assets.map(async (asset) => {
    const response = await fetch(asset, { cache: 'reload' });
    return { asset, ok: response.ok, status: response.status };
  })), expectedAssets);
  expect(offlineResponses.every((item) => item.ok && item.status === 200), JSON.stringify(offlineResponses, null, 2)).toBe(true);
  expect(await offlinePage.evaluate(() => globalThis.TabenaiMusic.describeAll())).toHaveLength(6);
  await offlinePage.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));
  await offlinePage.locator('#settingsBtn').click();
  await expect.poll(() => offlinePage.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().music?.currentKey)).toBe('bgm.normal');
  await expect.poll(() => offlinePage.evaluate(() => globalThis.__MEDIA_CALLS__.oscillatorStarts)).toBeGreaterThan(0);
  await context.close();
});

test('iPhone 390×844で横溢れなく二択へ短く届き、設定を操作できる', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block'
  });
  const page = await context.newPage();
  await openApp(page);
  await waitForPresentation(page);
  await expect(page.locator('#sceneVisual')).toBeVisible();
  await expect(page.locator('#choices .choice')).toHaveCount(2);
  await expect(page.locator('#choiceA')).toBeVisible();
  await expect(page.locator('#choiceB')).toBeVisible();
  const layout = await page.evaluate(() => {
    const secondChoice = document.getElementById('choiceB').getBoundingClientRect();
    const visual = document.getElementById('sceneVisual').getBoundingClientRect();
    return {
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      choiceDistance: Math.max(0, secondChoice.bottom - window.innerHeight),
      visualLeft: visual.left,
      visualRight: visual.right,
      viewportWidth: window.innerWidth
    };
  });
  expect(layout.horizontalOverflow).toBeLessThanOrEqual(0);
  expect(layout.choiceDistance).toBeLessThanOrEqual(220);
  expect(layout.visualLeft).toBeGreaterThanOrEqual(0);
  expect(layout.visualRight).toBeLessThanOrEqual(layout.viewportWidth);

  await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('settings'));
  await expect(page.locator('#settingsScreen')).toBeVisible();
  await setRange(page, '#bgmVolumeSetting', 31);
  await setRange(page, '#seVolumeSetting', 62);
  await page.locator('#hapticsSetting').uncheck();
  await page.locator('#lightVisualsSetting').check();
  const mobileSettings = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.meta().settings);
  expect(mobileSettings).toMatchObject({ bgmVolume: 0.31, seVolume: 0.62, haptics: false, lightVisuals: true });
  await context.close();
});

test('正常系はconsole warning/error・pageerror・requestfailed・HTTP errorが0件', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  const problems = collectBrowserProblems(page);
  await openApp(page);
  await waitForPresentation(page);
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    api.presentationScene({ mode: 'story', sceneId: 'riceball', category: 'common', token: 'healthy-normal', icon: '🍙' });
    api.presentationScene({ mode: 'survival', sceneId: 'ordinary-meal', category: 'rare', token: 'healthy-rare', icon: '🍱' });
    api.presentationScene({ mode: 'survival', sceneId: 'milestone-stockpile', category: 'milestone', token: 'healthy-milestone', icon: '📦' });
    api.presentationEnding({ endingCode: 'clear', token: 'healthy-escape', icon: '🌅' });
    api.presentationAchievement({ id: 'healthy', icon: '🏆', name: 'Healthy' });
  });
  await expect(page.locator('#achievementPresentation')).toBeVisible();
  await page.waitForTimeout(150);
  expect(problems).toEqual({ console: [], pageErrors: [], requestFailures: [], httpErrors: [] });
  await context.close();
});

test('STORY/HARDのcanonical digestはpresentation正常時・manifest失敗時とも不変', async ({ browser }) => {
  const normalContext = await browser.newContext({ serviceWorkers: 'block' });
  const normalPage = await normalContext.newPage();
  await openApp(normalPage);
  await waitForPresentation(normalPage);
  const normal = await runCanonicalGames(normalPage);
  expect(normal).toEqual(EXPECTED_DIGESTS);
  await normalContext.close();

  const failedContext = await browser.newContext({ serviceWorkers: 'block' });
  const failedPage = await failedContext.newPage();
  await failedPage.route('**/assets/manifest.json*', (route) => route.fulfill({ status: 503, body: 'unavailable' }));
  await openApp(failedPage);
  await waitForPresentation(failedPage, 'fallback');
  const fallback = await runCanonicalGames(failedPage);
  expect(fallback).toEqual(EXPECTED_DIGESTS);
  expect(fallback).toEqual(normal);
  await failedContext.close();
});
