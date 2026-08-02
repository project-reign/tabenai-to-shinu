import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import '../music-engine.js';

class FakeParam {
  constructor(value = 1) {
    this.value = value;
    this.events = [];
  }

  cancelScheduledValues(time) { this.events.push(['cancel', time]); }
  setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); }
  linearRampToValueAtTime(value, time) { this.value = value; this.events.push(['linear', value, time]); }
  exponentialRampToValueAtTime(value, time) { this.value = value; this.events.push(['exponential', value, time]); }
}

class FakeNode {
  constructor() {
    this.connections = [];
    this.disconnected = false;
  }

  connect(target) { this.connections.push(target); return target; }
  disconnect() { this.disconnected = true; }
}

class FakeGain extends FakeNode {
  constructor() {
    super();
    this.gain = new FakeParam();
  }
}

class FakeOscillator extends FakeNode {
  constructor(context) {
    super();
    this.context = context;
    this.type = 'sine';
    this.frequency = new FakeParam(440);
    this.starts = [];
    this.stops = [];
    this.onended = null;
  }

  start(time) { this.starts.push(time); this.context.starts += 1; }
  stop(time) { this.stops.push(time); this.context.stops += 1; }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.destination = new FakeNode();
    this.gains = [];
    this.oscillators = [];
    this.starts = 0;
    this.stops = 0;
  }

  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }

  createOscillator() {
    const oscillator = new FakeOscillator(this);
    this.oscillators.push(oscillator);
    return oscillator;
  }
}

function digest(value) {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

test('6曲の正式テーマID・曲名・尺・loop契約を固定する', () => {
  expect(globalThis.TabenaiMusic.version).toBe('4.7.0');
  expect(globalThis.TabenaiMusic.describeAll()).toEqual([
    { key: 'bgm.title', label: '空の皿', durationSeconds: 51.42857142857143, loop: true, bpm: 56, bars: 12, generation: 'deterministic-web-audio' },
    { key: 'bgm.normal', label: '腹の鳴る森', durationSeconds: 56.470588235294116, loop: true, bpm: 68, bars: 16, generation: 'deterministic-web-audio' },
    { key: 'bgm.rare', label: 'あり得ない一皿', durationSeconds: 40, loop: true, bpm: 72, bars: 12, generation: 'deterministic-web-audio' },
    { key: 'bgm.final', label: '五十日目', durationSeconds: 73.84615384615384, loop: true, bpm: 52, bars: 16, generation: 'deterministic-web-audio' },
    { key: 'bgm.death', label: '残された器', durationSeconds: 16, loop: false, bpm: 60, bars: 4, generation: 'deterministic-web-audio' },
    { key: 'bgm.escape', label: '朝食のない朝', durationSeconds: 56.25, loop: true, bpm: 64, bars: 15, generation: 'deterministic-web-audio' }
  ]);
});

test('全シーケンスは決定論的で、lightVisualsは同じ曲の簡易編成になる', async () => {
  const expected = {
    'bgm.title': ['e9d95c33', 192, 84],
    'bgm.normal': ['8ec13ed0', 336, 96],
    'bgm.rare': ['7b81b84b', 288, 72],
    'bgm.final': ['b95250e0', 368, 96],
    'bgm.death': ['dd4bb0fb', 56, 20],
    'bgm.escape': ['74b5241d', 285, 105]
  };
  for (const [key, [hash, fullCount, lightCount]] of Object.entries(expected)) {
    const full = globalThis.TabenaiMusic.renderSequence(key);
    const again = globalThis.TabenaiMusic.renderSequence(key);
    const light = globalThis.TabenaiMusic.renderSequence(key, { lightVisuals: true });
    expect(full).toEqual(again);
    expect(digest(full)).toBe(hash);
    expect(full).toHaveLength(fullCount);
    expect(light).toHaveLength(lightCount);
    expect(light.length).toBeLessThan(full.length);
    expect(full.every(note => Number.isFinite(note.time) && Number.isFinite(note.frequency))).toBe(true);
  }
  expect(await readFile(new URL('../music-engine.js', import.meta.url), 'utf8')).not.toContain('Math.random');
});

test('共有AudioContextで再生し、crossfadeと最大voice数を守る', () => {
  const context = new FakeAudioContext();
  const music = globalThis.TabenaiMusic.create({
    audioContext: context,
    volume: 0.4,
    scheduleIntervalMs: 250,
    lookAheadSeconds: 1,
    maxActiveVoices: 8
  });
  expect(music.snapshot()).toMatchObject({ supported: true, state: 'stopped', maxActiveVoices: 8 });
  expect(music.play('bgm.normal')).toBe(true);
  expect(music.snapshot().currentKey).toBe('bgm.normal');
  expect(music.snapshot().activeVoices).toBeLessThanOrEqual(8);
  expect(context.starts).toBeGreaterThan(0);
  const oldBus = music.session.bus;
  expect(music.play('bgm.rare')).toBe(true);
  expect(music.snapshot().currentKey).toBe('bgm.rare');
  expect(music.snapshot().activeVoices).toBeLessThanOrEqual(8);
  expect(music.snapshot().skippedVoices).toBeGreaterThan(0);
  expect(oldBus.gain.events.some(event => event[0] === 'linear' && event[1] === 0.0001)).toBe(true);
  music.destroy();
});

test('volume・mute・visibility・lightVisualsを出力とschedulerへ反映する', () => {
  const context = new FakeAudioContext();
  const music = globalThis.TabenaiMusic.create({ audioContext: context, scheduleIntervalMs: 250 });
  music.play('bgm.title');
  expect(music.session.timer).not.toBeNull();
  expect(music.setSettings({ bgmVolume: 0.23, bgmMuted: true, lightVisuals: true })).toEqual({
    volume: 0.23, muted: true, lightVisuals: true
  });
  expect(music.session.timer).toBeNull();
  expect(music.setMuted(false)).toBe(false);
  expect(music.session.timer).not.toBeNull();
  expect(music.setVisible(false)).toBe(false);
  expect(music.session.timer).toBeNull();
  expect(music.resume()).toBe(true);
  expect(music.session.timer).not.toBeNull();
  expect(music.snapshot()).toMatchObject({ volume: 0.23, muted: false, visible: true, lightVisuals: true });
  music.destroy();
});

test('未対応・壊れたWeb Audio環境でも例外を漏らさない', () => {
  const failures = [];
  const music = globalThis.TabenaiMusic.create({
    audioContext: { destination: {} },
    onError: error => failures.push(String(error && error.message || error))
  });
  expect(music.snapshot()).toMatchObject({ supported: false, failureCount: 1 });
  expect(music.play('bgm.title')).toBe(false);
  expect(music.play('bgm.unknown')).toBe(false);
  expect(music.stop()).toBe(false);
  expect(failures).toHaveLength(1);
  expect(() => music.destroy()).not.toThrow();
});

test('visibility flushは現在値を保持して32ms fade後にだけvoiceを停止する', () => {
  const context = new FakeAudioContext();
  const music = globalThis.TabenaiMusic.create({
    audioContext: context,
    scheduleIntervalMs: 250,
    lookAheadSeconds: 0.8,
    maxActiveVoices: 12
  });
  music.play('bgm.normal');
  const voices = [...music.voices];
  expect(voices.length).toBeGreaterThan(0);
  context.currentTime = 2;
  const stopCounts = voices.map(voice => voice.oscillator.stops.length);
  music.pause({ flush: true, fadeSeconds: 0.032 });

  voices.forEach((voice, index) => {
    expect(voice.oscillator.stops.length).toBe(stopCounts[index] + 1);
    expect(voice.oscillator.stops.at(-1)).toBeGreaterThanOrEqual(2.04);
    expect(voice.oscillator.stops).not.toContain(2);
    expect(voice.gain.gain.events).toEqual(expect.arrayContaining([
      ['cancel', 2],
      ['linear', 0.0001, 2.032]
    ]));
    expect(voice.oscillator.disconnected).toBe(false);
    expect(voice.gain.disconnected).toBe(false);
  });
  expect(music.masterGain.gain.events).toContainEqual(['linear', 0.0001, 2.032]);
  expect(music.snapshot()).toMatchObject({ schedulerActive: false, stoppingVoices: voices.length });
  music.destroy();
});

test('OfflineAudioContextでclickless fade後の最大サンプル不連続を抑える', async ({ page }) => {
  await page.goto('./');
  const result = await page.evaluate(async () => {
    const sampleRate = 48_000;
    const context = new OfflineAudioContext(1, sampleRate / 2, sampleRate);
    const music = globalThis.TabenaiMusic.create({
      audioContext: context,
      scheduleIntervalMs: 250,
      lookAheadSeconds: 0.4,
      maxActiveVoices: 12
    });
    music.play('bgm.normal');
    music.pause({ flush: true, fadeSeconds: 0.032 });
    const buffer = await context.startRendering();
    const samples = buffer.getChannelData(0);
    let maximumDelta = 0;
    for (let index = 1; index < samples.length; index += 1) {
      maximumDelta = Math.max(maximumDelta, Math.abs(samples[index] - samples[index - 1]));
    }
    return { maximumDelta, sampleCount: samples.length };
  });
  expect(result.sampleCount).toBe(24_000);
  expect(result.maximumDelta).toBeLessThan(0.08);
});
