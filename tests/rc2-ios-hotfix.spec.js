import { test, expect } from '@playwright/test';
import {
  APP_URL,
  collectBrowserProblems,
  installMediaSpies,
  openApp,
  waitForPresentation
} from './helpers/presentation.mjs';

async function openAudioPage(browser, suffix = '?debug=1') {
  const context = await browser.newContext();
  await installMediaSpies(context);
  const page = await context.newPage();
  const problems = collectBrowserProblems(page);
  await openApp(page, suffix);
  await waitForPresentation(page);
  return { context, page, problems };
}

async function unlockWithoutAction(page, selector = '#sceneContent') {
  await page.locator(selector).click({ position: { x: 4, y: 4 } });
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().audioUnlocked)).toBe(true);
}

async function hideAndShow(page) {
  await page.evaluate(() => globalThis.__setTestVisibility(true));
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().lifecyclePaused)).toBe(true);
  await page.evaluate(() => globalThis.__setTestVisibility(false));
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().resumeGestureArmed)).toBe(true);
}

test('hidden→visibleだけでは1秒後もcue・oscillator・AudioContextを再開しない', async ({ browser }) => {
  const { context, page, problems } = await openAudioPage(browser);
  await unlockWithoutAction(page);
  await page.evaluate(() => globalThis.__setTestVisibility(true));
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().music?.activeVoices)).toBe(0);
  const hidden = await page.evaluate(() => ({
    calls: { ...globalThis.__MEDIA_CALLS__ },
    presentation: globalThis.__TABENAI_PRESENTATION__.snapshot()
  }));
  await page.evaluate(() => globalThis.__setTestVisibility(false));
  await page.waitForTimeout(1000);
  const visible = await page.evaluate(() => ({
    calls: { ...globalThis.__MEDIA_CALLS__ },
    presentation: globalThis.__TABENAI_PRESENTATION__.snapshot()
  }));
  expect(visible.calls.resumes).toBe(hidden.calls.resumes);
  expect(visible.calls.oscillatorStarts).toBe(hidden.calls.oscillatorStarts);
  expect(visible.presentation.cueCount).toBe(hidden.presentation.cueCount);
  expect(visible.presentation).toMatchObject({ lifecyclePaused: true, resumeGestureArmed: true });
  expect(visible.presentation.music.schedulerActive).toBe(false);
  expect(problems.console).toEqual([]);
  expect(problems.pageErrors).toEqual([]);
  await context.close();
});

test('復帰後の最初のtrusted余白tapだけでBGMをfade-in再開し、SEは鳴らさない', async ({ browser }) => {
  const { context, page } = await openAudioPage(browser);
  await unlockWithoutAction(page);
  await hideAndShow(page);
  const before = await page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot());
  await page.locator('.topbar').click({ position: { x: 4, y: 4 } });
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().resumeGestureArmed)).toBe(false);
  const after = await page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot());
  expect(after.lifecyclePaused).toBe(false);
  expect(after.cueCount).toBe(before.cueCount);
  expect(after.music.schedulerActive).toBe(true);
  expect(after.music.lastResumeFadeSeconds).toBe(0.28);
  expect(after.music.schedulerRestarts).toBe(before.music.schedulerRestarts + 1);
  await context.close();
});

test('復帰後の最初のtrusted選択tapはBGM再開と選択SEを一度だけ実行する', async ({ browser }) => {
  const { context, page } = await openAudioPage(browser);
  await unlockWithoutAction(page);
  await hideAndShow(page);
  const before = await page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot());
  await page.locator('#choiceA').click();
  await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().resumeGestureArmed)).toBe(false);
  const after = await page.evaluate(sequence => {
    const engine = globalThis.__TABENAI_PRESENTATION__;
    const snapshot = engine.snapshot();
    const action = document.documentElement.dataset.lastPresentationAction;
    const actionKey = engine.registry.action(action) || engine.registry.action('choice');
    const actionCues = snapshot.audioLifecycle.filter(entry => entry.sequence > sequence && entry.event === 'cue' && entry.cueKey === actionKey);
    return { snapshot, action, actionKey, actionCues };
  }, before.audioLifecycle.at(-1)?.sequence || 0);
  expect(after.action).toBeTruthy();
  expect(after.actionKey).toBeTruthy();
  expect(after.actionCues).toHaveLength(1);
  expect(after.snapshot.music.schedulerRestarts).toBe(before.music.schedulerRestarts + 1);
  await context.close();
});

test('pagehide/pageshow persistedを10回繰り返してもlistener・timer・voiceは増殖しない', async ({ browser }) => {
  const { context, page } = await openAudioPage(browser);
  await unlockWithoutAction(page);
  const initial = await page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot());
  for (let index = 0; index < 10; index += 1) {
    await page.evaluate(() => globalThis.__dispatchPageHide(true));
    await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().music?.activeVoices)).toBe(0);
    await page.evaluate(() => globalThis.__dispatchPageShow(true));
    const waiting = await page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot());
    expect(waiting.music.schedulerActive).toBe(false);
    await page.locator('.topbar').click({ position: { x: 4, y: 4 } });
    await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().resumeGestureArmed)).toBe(false);
  }
  const after = await page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot());
  expect(after.audioLifecycleListenerCount).toBe(initial.audioLifecycleListenerCount);
  expect(after.music.schedulerActive).toBe(true);
  expect(after.music.schedulerRestarts).toBe(initial.music.schedulerRestarts + 10);
  expect(after.music.activeVoices).toBeLessThanOrEqual(after.music.maxActiveVoices);
  expect(after.music.peakVoices).toBeLessThanOrEqual(after.music.maxActiveVoices);
  const events = after.audioLifecycle;
  expect(events.some(entry => entry.event === 'pagehide' && entry.persisted === true)).toBe(true);
  expect(events.some(entry => entry.event === 'pageshow' && entry.persisted === true)).toBe(true);
  await context.close();
});

test('復帰時もBGM mute・SE mute・両方muteをそれぞれ維持する', async ({ browser }) => {
  for (const settings of [
    { bgmMuted: true, seMuted: false },
    { bgmMuted: false, seMuted: true },
    { bgmMuted: true, seMuted: true }
  ]) {
    const { context, page } = await openAudioPage(browser);
    await unlockWithoutAction(page);
    await page.evaluate(value => globalThis.__TABENAI_PRESENTATION__.setSettings(value), settings);
    await hideAndShow(page);
    const before = await page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot());
    await page.locator('#choiceA').click();
    await expect.poll(() => page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot().resumeGestureArmed)).toBe(false);
    const after = await page.evaluate(sequence => {
      const engine = globalThis.__TABENAI_PRESENTATION__;
      const snapshot = engine.snapshot();
      const action = document.documentElement.dataset.lastPresentationAction;
      const actionKey = engine.registry.action(action) || engine.registry.action('choice');
      return {
        snapshot,
        actionCues: snapshot.audioLifecycle.filter(entry => entry.sequence > sequence && entry.event === 'cue' && entry.cueKey === actionKey)
      };
    }, before.audioLifecycle.at(-1)?.sequence || 0);
    expect(after.snapshot.settings.bgmMuted).toBe(settings.bgmMuted);
    expect(after.snapshot.settings.seMuted).toBe(settings.seMuted);
    expect(after.snapshot.music.schedulerActive).toBe(!settings.bgmMuted);
    expect(after.actionCues).toHaveLength(settings.seMuted ? 0 : 1);
    await context.close();
  }
});

test('audio lifecycle ring logはdebug=1だけに公開する', async ({ browser }) => {
  const debug = await openAudioPage(browser);
  await unlockWithoutAction(debug.page);
  await hideAndShow(debug.page);
  const debugSnapshot = await debug.page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot());
  expect(Array.isArray(debugSnapshot.audioLifecycle)).toBe(true);
  expect(debugSnapshot.audioLifecycle.some(entry => entry.event === 'hidden')).toBe(true);
  await debug.context.close();

  const context = await browser.newContext({ serviceWorkers: 'block' });
  await installMediaSpies(context);
  const page = await context.newPage();
  await page.goto(APP_URL);
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_PRESENTATION__));
  await waitForPresentation(page);
  const publicSnapshot = await page.evaluate(() => globalThis.__TABENAI_PRESENTATION__.snapshot());
  expect(Object.hasOwn(publicSnapshot, 'audioLifecycle')).toBe(false);
  await context.close();
});

test('touch-action manipulationは3画面幅の主要領域で有効で、scroll・pinch zoom契約を保つ', async ({ browser }) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 430, height: 932 }
  ]) {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const problems = collectBrowserProblems(page);
    await openApp(page);
    await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('records'));
    await expect(page.locator('.record-item').first()).toBeAttached();
    const styles = await page.evaluate(() => {
      const selectors = ['html', 'body', '.title-hero', '.title-card', '.screen-card', '.record-item', '.setting-row', '.scene-content', '.choice', '.modal', '.modal-box'];
      return Object.fromEntries(selectors.map(selector => {
        const element = document.querySelector(selector);
        return [selector, element ? getComputedStyle(element).touchAction : null];
      }));
    });
    for (const value of Object.values(styles)) expect(value).toBe('manipulation');
    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewportMeta).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);
    const css = await page.locator('style').first().textContent();
    expect(css).not.toMatch(/touch-action\s*:\s*none/i);

    await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('settings'));
    const scroll = await page.evaluate(() => {
      const before = scrollY;
      scrollTo(0, document.documentElement.scrollHeight);
      return { before, after: scrollY, height: document.documentElement.scrollHeight, client: innerHeight };
    });
    expect(scroll.height).toBeGreaterThan(scroll.client);
    expect(scroll.after).toBeGreaterThan(scroll.before);
    const slider = await page.locator('#bgmVolumeSetting').evaluate(element => ({
      touchAction: getComputedStyle(element).touchAction,
      userSelect: getComputedStyle(element).userSelect
    }));
    expect(slider.touchAction).not.toBe('none');
    expect(slider.userSelect).not.toBe('none');

    await page.evaluate(() => globalThis.__TABENAI_DEBUG__.screen('title'));
    await page.evaluate(() => scrollTo(0, 0));
    const scaleBefore = await page.evaluate(() => visualViewport?.scale ?? 1);
    await page.touchscreen.tap(8, Math.max(8, viewport.height - 8));
    await page.touchscreen.tap(8, Math.max(8, viewport.height - 8));
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => visualViewport?.scale ?? 1)).toBe(scaleBefore);
    expect(problems.console).toEqual([]);
    expect(problems.pageErrors).toEqual([]);
    await context.close();
  }
});
