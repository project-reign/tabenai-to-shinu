import { expect } from '@playwright/test';

export const APP_URL = 'http://127.0.0.1:4173/tabenai-to-shinu/';

export async function openApp(page, suffix = '?debug=1') {
  await page.goto(`${APP_URL}${suffix}`);
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));
}

export async function waitForPresentation(page, expectedStatus = 'ready') {
  await expect
    .poll(async () => page.evaluate(async () => {
      const engine = globalThis.__TABENAI_PRESENTATION__;
      if (!engine) return null;
      await engine.ready;
      return engine.snapshot().manifestStatus;
    }))
    .toBe(expectedStatus);
}

export function collectBrowserProblems(page) {
  const problems = {
    console: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: []
  };

  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') {
      problems.console.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => problems.pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    problems.requestFailures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) problems.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return problems;
}

export async function installMediaSpies(context) {
  await context.addInitScript(() => {
    const calls = {
      contexts: 0,
      resumes: 0,
      suspends: 0,
      oscillatorStarts: 0,
      oscillatorStops: 0,
      oscillatorStopTimes: [],
      audioPlay: 0,
      audioPause: 0,
      audioSources: [],
      gains: [],
      gainEvents: [],
      disconnects: 0,
      vibrations: []
    };

    class FakeAudioContext {
      constructor() {
        calls.contexts += 1;
        this.state = 'suspended';
        this.currentTime = 0;
        this.destination = {};
      }

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

      createOscillator() {
        const context = this;
        const oscillator = {
          type: 'sine',
          onended: null,
          frequency: {
            setValueAtTime() {},
            exponentialRampToValueAtTime() {}
          },
          connect() {},
          start() { calls.oscillatorStarts += 1; },
          stop(when = 0) {
            calls.oscillatorStops += 1;
            calls.oscillatorStopTimes.push(when);
            const delay = Math.max(0, (Number(when) - context.currentTime) * 1000);
            setTimeout(() => { if (typeof oscillator.onended === 'function') oscillator.onended(); }, delay);
          },
          disconnect() { calls.disconnects += 1; }
        };
        return oscillator;
      }

      createGain() {
        return {
          gain: {
            value: 1,
            setValueAtTime(value, time) { this.value = value; calls.gains.push(value); calls.gainEvents.push(['set', value, time]); },
            exponentialRampToValueAtTime(value, time) { this.value = value; calls.gainEvents.push(['exponential', value, time]); },
            linearRampToValueAtTime(value, time) { this.value = value; calls.gainEvents.push(['linear', value, time]); },
            cancelScheduledValues(time) { calls.gainEvents.push(['cancel', time]); }
          },
          connect() {},
          disconnect() { calls.disconnects += 1; }
        };
      }
    }

    class FakeAudio extends EventTarget {
      constructor() {
        super();
        this.dataset = {};
        this.loop = false;
        this.preload = 'none';
        this.volume = 1;
        this._src = '';
      }

      set src(value) {
        this._src = value;
        calls.audioSources.push(value);
      }

      get src() {
        return this._src;
      }

      play() {
        calls.audioPlay += 1;
        return Promise.resolve();
      }

      pause() {
        calls.audioPause += 1;
      }
    }

    Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: FakeAudioContext });
    Object.defineProperty(globalThis, 'webkitAudioContext', { configurable: true, value: FakeAudioContext });
    Object.defineProperty(globalThis, 'Audio', { configurable: true, value: FakeAudio });
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value(pattern) {
        calls.vibrations.push(pattern);
        return true;
      }
    });

    let hidden = false;
    try {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => hidden ? 'hidden' : 'visible'
      });
    } catch {
      // Chromium normally permits these instance-level test overrides.
    }

    globalThis.__MEDIA_CALLS__ = calls;
    globalThis.__setTestVisibility = (value) => {
      hidden = Boolean(value);
      document.dispatchEvent(new Event('visibilitychange'));
    };
    const lifecycleEvent = (type, persisted = false) => {
      const event = new Event(type);
      Object.defineProperty(event, 'persisted', { configurable: true, value: Boolean(persisted) });
      return event;
    };
    globalThis.__dispatchPageHide = persisted => window.dispatchEvent(lifecycleEvent('pagehide', persisted));
    globalThis.__dispatchPageShow = persisted => window.dispatchEvent(lifecycleEvent('pageshow', persisted));
    globalThis.__dispatchFreeze = () => document.dispatchEvent(new Event('freeze'));
    globalThis.__dispatchResume = () => document.dispatchEvent(new Event('resume'));
  });
}

export async function runCanonicalGames(page) {
  const cases = {
    story: { mode: 'story', seed: 0x5eed430, choices: [0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0] },
    hard: { mode: 'hard', seed: 0x440, choices: [0, 1, 0, 0, 1, 0, 1, 0] }
  };
  const results = {};
  let first = true;

  for (const [name, game] of Object.entries(cases)) {
    if (!first) {
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));
    }
    first = false;
    results[name] = await page.evaluate(({ mode, seed, choices }) => {
      const api = globalThis.__TABENAI_DEBUG__;
      const projection = (snapshot) => ({
        version: snapshot.version,
        mode: snapshot.mode,
        seed: snapshot.seed,
        rngState: snapshot.rngState,
        scene: snapshot.scene,
        day: snapshot.day,
        hp: snapshot.hp,
        hunger: snapshot.hunger,
        status: snapshot.status,
        choiceCount: snapshot.choiceCount,
        ended: snapshot.ended,
        ending: snapshot.ending,
        flags: snapshot.flags,
        companions: snapshot.companions,
        memories: snapshot.memories,
        stats: snapshot.stats,
        clues: snapshot.clues,
        log: snapshot.log
      });
      const digest = (value) => {
        const text = JSON.stringify(value);
        let hash = 0x811c9dc5;
        for (let index = 0; index < text.length; index += 1) {
          hash ^= text.charCodeAt(index);
          hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        return hash.toString(16).padStart(8, '0');
      };
      api.silent(true);
      api.setState(api.fresh(seed, mode));
      for (const choice of choices) api.step(choice);
      return digest(projection(api.snapshot()));
    }, game);
  }
  return { story: results.story, hard: results.hard };
}
