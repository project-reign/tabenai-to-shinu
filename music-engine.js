(() => {
  'use strict';

  // v4.7 formal music is composed in code and rendered with Web Audio. The
  // patterns below are project-original, deterministic, and contain no samples.
  // This module deliberately never creates an AudioContext: the presentation
  // layer owns the single, gesture-unlocked context and supplies it here.

  const VERSION = '4.7.0';
  const STEPS_PER_BEAT = 4;
  const DEFAULT_VOLUME = 0.45;
  const OUTPUT_GAIN = 0.16;
  const SILENCE = 0.0001;
  const DEFAULT_LOOK_AHEAD = 0.38;
  const DEFAULT_INTERVAL_MS = 90;
  const MAX_ACTIVE_VOICES = 28;
  const CROSSFADE_SECONDS = 0.72;
  const WAVES = new Set(['sine', 'triangle', 'square', 'sawtooth']);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));
  const midiToFrequency = midi => 440 * Math.pow(2, (Number(midi) - 69) / 12);
  const copy = value => JSON.parse(JSON.stringify(value));

  const THEMES = Object.freeze({
    'bgm.title': Object.freeze({
      key: 'bgm.title', label: '空の皿', bpm: 56, bars: 12, loop: true,
      root: 45, progression: [0, 5, 3, -2, 0, 7, 5, 3, 0, -2, 5, 7],
      chord: [0, 3, 7], padWave: 'sine', bassWave: 'triangle', melodyWave: 'sine',
      melody: [12, null, 15, null, 19, null, 17, null, 12, null, 10, null, 7, null, 10, null],
      melodyShift: [0, 0, -2, 0], bassSteps: [0, 8], textureSteps: [6, 14],
      accentSteps: [0], tint: -7
    }),
    'bgm.normal': Object.freeze({
      key: 'bgm.normal', label: '腹の鳴る森', bpm: 68, bars: 16, loop: true,
      root: 41, progression: [0, 3, 5, 2, 0, -2, 3, 5],
      chord: [0, 3, 7], padWave: 'triangle', bassWave: 'sine', melodyWave: 'triangle',
      melody: [12, null, 15, 14, null, 12, null, 10, 7, null, 10, null, 12, 10, null, 7],
      melodyShift: [0, 2, 0, -2], bassSteps: [0, 6, 8, 14], textureSteps: [3, 11],
      accentSteps: [0, 8], tint: 7
    }),
    'bgm.rare': Object.freeze({
      key: 'bgm.rare', label: 'あり得ない一皿', bpm: 72, bars: 12, loop: true,
      root: 43, progression: [0, 6, 1, -3, 0, 8],
      chord: [0, 4, 8], padWave: 'sine', bassWave: 'square', melodyWave: 'sine',
      melody: [12, 13, null, 19, 18, null, 14, null, 8, null, 15, 14, null, 20, null, 13],
      melodyShift: [0, -1, 1, 0], bassSteps: [0, 5, 8, 13], textureSteps: [2, 7, 10, 15],
      accentSteps: [0, 4, 10], tint: 11
    }),
    'bgm.final': Object.freeze({
      key: 'bgm.final', label: '五十日目', bpm: 52, bars: 16, loop: true,
      root: 38, progression: [0, 5, 7, 3, 0, -2, 5, 7],
      chord: [0, 3, 7, 10], padWave: 'sawtooth', bassWave: 'triangle', melodyWave: 'sine',
      melody: [12, null, 12, 15, null, 17, 18, null, 19, null, 17, 15, 12, null, 10, null],
      melodyShift: [0, 0, 2, 3], bassSteps: [0, 4, 8, 12], textureSteps: [7, 15],
      accentSteps: [0, 6, 12], tint: -12
    }),
    'bgm.death': Object.freeze({
      key: 'bgm.death', label: '残された器', bpm: 60, bars: 4, loop: false,
      root: 40, progression: [0, -2, -5, -12],
      chord: [0, 3, 6], padWave: 'sine', bassWave: 'sine', melodyWave: 'triangle',
      melody: [12, null, null, 10, null, null, 7, null, 6, null, null, 3, null, 2, null, 0],
      melodyShift: [0], bassSteps: [0, 8], textureSteps: [11],
      accentSteps: [0], tint: -12
    }),
    'bgm.escape': Object.freeze({
      key: 'bgm.escape', label: '朝食のない朝', bpm: 64, bars: 15, loop: true,
      root: 48, progression: [0, 5, 7, 9, 5],
      chord: [0, 4, 7], padWave: 'sine', bassWave: 'triangle', melodyWave: 'triangle',
      melody: [12, null, 16, null, 19, 21, null, 19, 16, null, 14, null, 12, 14, 16, null],
      melodyShift: [0, 2, 4, 2, 0], bassSteps: [0, 8], textureSteps: [5, 13],
      accentSteps: [0, 8], tint: 12
    })
  });

  function themeDuration(theme) {
    return theme.bars * 4 * 60 / theme.bpm;
  }

  function describeTheme(theme) {
    return {
      key: theme.key,
      label: theme.label,
      durationSeconds: themeDuration(theme),
      loop: theme.loop,
      bpm: theme.bpm,
      bars: theme.bars,
      generation: 'deterministic-web-audio'
    };
  }

  const THEME_DESCRIPTORS = Object.freeze(
    Object.fromEntries(Object.entries(THEMES).map(([key, theme]) => [key, Object.freeze(describeTheme(theme))]))
  );

  function makeEvent(layer, midi, wave, durationSteps, gain, stepDuration, extra = {}) {
    return {
      layer,
      frequency: midiToFrequency(midi),
      wave: WAVES.has(wave) ? wave : 'sine',
      duration: Math.max(0.045, durationSteps * stepDuration),
      gain: clamp(gain, 0.005, 0.5),
      ...extra
    };
  }

  // Pure deterministic score function. absoluteStep is allowed to continue
  // beyond one loop; bar and note choices wrap without consulting any PRNG.
  function eventsAt(theme, absoluteStep, simplified = false) {
    const stepDuration = 60 / theme.bpm / STEPS_PER_BEAT;
    const totalSteps = theme.bars * 4 * STEPS_PER_BEAT;
    const wrappedStep = ((absoluteStep % totalSteps) + totalSteps) % totalSteps;
    const stepInBar = wrappedStep % (4 * STEPS_PER_BEAT);
    const bar = Math.floor(wrappedStep / (4 * STEPS_PER_BEAT));
    const chordRoot = theme.root + theme.progression[bar % theme.progression.length];
    const events = [];

    if (stepInBar === 0) {
      const chord = simplified ? [theme.chord[0], theme.chord.at(-1)] : theme.chord;
      chord.forEach((interval, index) => {
        events.push(makeEvent(
          'pad', chordRoot + 12 + interval, theme.padWave,
          simplified ? 10 : 14, simplified ? 0.075 : 0.09 - index * 0.008,
          stepDuration, { attack: simplified ? 0.16 : 0.28 }
        ));
      });
    }

    const bassAllowed = theme.bassSteps.includes(stepInBar)
      && (!simplified || stepInBar === theme.bassSteps[0]);
    if (bassAllowed) {
      const fifth = stepInBar >= 8 && !simplified ? 7 : 0;
      events.push(makeEvent('bass', chordRoot - 12 + fifth, theme.bassWave, 3.2, 0.15, stepDuration));
    }

    const melodyInterval = theme.melody[stepInBar];
    if (melodyInterval !== null && melodyInterval !== undefined
      && (!simplified || stepInBar % 4 === 0)) {
      const shift = theme.melodyShift[bar % theme.melodyShift.length];
      events.push(makeEvent(
        'melody', chordRoot + melodyInterval + shift, theme.melodyWave,
        simplified ? 2.4 : 1.65, simplified ? 0.105 : 0.13, stepDuration,
        { attack: 0.018 }
      ));
    }

    if (!simplified && theme.textureSteps.includes(stepInBar)) {
      const textureMidi = chordRoot + 24 + theme.tint + ((bar + stepInBar) % 3);
      events.push(makeEvent('texture', textureMidi, 'sine', 4.5, 0.045, stepDuration, { attack: 0.12 }));
    }

    if (!simplified && theme.accentSteps.includes(stepInBar)) {
      events.push(makeEvent('pulse', theme.root - 24, 'sine', 0.8, 0.18, stepDuration, { attack: 0.006 }));
    }

    return events;
  }

  function renderSequence(key, options = {}) {
    const theme = THEMES[key];
    if (!theme) return [];
    const bars = Math.max(1, Math.min(theme.bars, Math.floor(Number(options.bars) || theme.bars)));
    const simplified = options.lightVisuals === true || options.simplified === true;
    const stepDuration = 60 / theme.bpm / STEPS_PER_BEAT;
    const totalSteps = bars * 4 * STEPS_PER_BEAT;
    const sequence = [];
    for (let step = 0; step < totalSteps; step += 1) {
      for (const event of eventsAt(theme, step, simplified)) {
        sequence.push({
          step,
          time: step * stepDuration,
          ...event,
          frequency: Number(event.frequency.toFixed(6)),
          duration: Number(event.duration.toFixed(6)),
          gain: Number(event.gain.toFixed(6))
        });
      }
    }
    return sequence;
  }

  class MusicEngine {
    constructor(options = {}) {
      this.context = null;
      this.destination = null;
      this.masterGain = null;
      this.supported = false;
      this.volume = Number.isFinite(Number(options.volume))
        ? clamp(options.volume, 0, 1)
        : DEFAULT_VOLUME;
      this.muted = options.muted === true;
      this.lightVisuals = options.lightVisuals === true;
      this.visible = options.visible !== false;
      this.lookAheadSeconds = clamp(options.lookAheadSeconds || DEFAULT_LOOK_AHEAD, 0.15, 1);
      this.scheduleIntervalMs = clamp(options.scheduleIntervalMs || DEFAULT_INTERVAL_MS, 30, 250);
      this.maxActiveVoices = Math.floor(clamp(options.maxActiveVoices || MAX_ACTIVE_VOICES, 8, MAX_ACTIVE_VOICES));
      this.onError = typeof options.onError === 'function' ? options.onError : null;
      this.failureCount = 0;
      this.lastError = null;
      this.currentKey = null;
      this.session = null;
      this.voices = new Set();
      this.peakVoices = 0;
      this.scheduledVoices = 0;
      this.skippedVoices = 0;
      this.sessionSerial = 0;
      this.destroyed = false;
      if (options.audioContext) this.attach(options.audioContext, options.destination);
    }

    _report(error) {
      this.failureCount += 1;
      this.lastError = error instanceof Error ? error.message : String(error || 'unknown audio failure');
      if (this.onError) {
        try { this.onError(error); } catch (_) {}
      }
      return false;
    }

    attach(audioContext, destination) {
      if (this.destroyed || !audioContext) return false;
      if (this.context === audioContext && this.supported) return true;
      this._disposeNodes(0);
      this.context = audioContext;
      this.destination = destination || audioContext.destination || null;
      const usable = this.destination
        && typeof audioContext.createGain === 'function'
        && typeof audioContext.createOscillator === 'function';
      if (!usable) {
        this.supported = false;
        return this._report(new Error('Web Audio oscillator/gain support is unavailable'));
      }
      try {
        this.masterGain = audioContext.createGain();
        const now = this._now();
        this.masterGain.gain.setValueAtTime(SILENCE, now);
        this.masterGain.connect(this.destination);
        this.supported = true;
        this._rampMaster(now, 0.02);
        return true;
      } catch (error) {
        this.supported = false;
        this.masterGain = null;
        return this._report(error);
      }
    }

    _now() {
      return this.context && Number.isFinite(Number(this.context.currentTime))
        ? Number(this.context.currentTime)
        : 0;
    }

    _targetGain() {
      return this.muted || !this.visible ? SILENCE : Math.max(SILENCE, this.volume * OUTPUT_GAIN);
    }

    _rampParam(param, target, now, duration) {
      if (!param) return;
      const safeTarget = Math.max(SILENCE, Number(target));
      try {
        if (typeof param.cancelScheduledValues === 'function') param.cancelScheduledValues(now);
        const current = Math.max(SILENCE, Number(param.value) || SILENCE);
        param.setValueAtTime(current, now);
        param.linearRampToValueAtTime(safeTarget, now + Math.max(0.005, duration));
      } catch (_) {
        try { param.value = safeTarget; } catch (_) {}
      }
    }

    _rampMaster(now = this._now(), duration = 0.12) {
      if (!this.masterGain) return;
      this._rampParam(this.masterGain.gain, this._targetGain(), now, duration);
    }

    _unref(timer) {
      if (timer && typeof timer.unref === 'function') timer.unref();
      return timer;
    }

    _clearScheduler(session = this.session) {
      if (session && session.timer !== null) {
        clearInterval(session.timer);
        session.timer = null;
      }
    }

    _startScheduler(session = this.session) {
      if (!session || session.retired || session.finished || this.muted || !this.visible) return;
      if (session.timer !== null) return;
      this._schedule(session);
      session.timer = this._unref(setInterval(() => this._schedule(session), this.scheduleIntervalMs));
    }

    _makeSession(key, startStep = 0) {
      const theme = THEMES[key];
      const now = this._now();
      const bus = this.context.createGain();
      try {
        bus.gain.setValueAtTime(SILENCE, now);
        if (typeof bus.gain.linearRampToValueAtTime === 'function') {
          bus.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS);
        } else {
          bus.gain.value = 1;
        }
      } catch (_) {
        try { bus.gain.value = 1; } catch (_) {}
      }
      bus.connect(this.masterGain);
      return {
        id: ++this.sessionSerial,
        key,
        theme,
        bus,
        cursor: Math.max(0, Math.floor(startStep)),
        nextTime: now + 0.035,
        loopCount: 0,
        timer: null,
        retired: false,
        finished: false,
        state: 'playing'
      };
    }

    play(key) {
      if (this.destroyed || !this.supported || !THEMES[key]) return false;
      if (this.currentKey === key && this.session && !this.session.retired && !this.session.finished) {
        this._rampMaster(this._now(), 0.12);
        this._startScheduler(this.session);
        return true;
      }
      try {
        const previous = this.session;
        const next = this._makeSession(key);
        this.currentKey = key;
        this.session = next;
        if (previous) this._retireSession(previous, CROSSFADE_SECONDS);
        this._rampMaster(this._now(), 0.16);
        this._startScheduler(next);
        return true;
      } catch (error) {
        return this._report(error);
      }
    }

    _schedule(session) {
      if (!session || session !== this.session || session.retired || session.finished
        || this.muted || !this.visible || !this.supported) return;
      try {
        const theme = session.theme;
        const stepDuration = 60 / theme.bpm / STEPS_PER_BEAT;
        const totalSteps = theme.bars * 4 * STEPS_PER_BEAT;
        const horizon = this._now() + this.lookAheadSeconds;
        let guard = 0;
        while (session.nextTime <= horizon && guard < 64) {
          const wrappedStep = session.cursor % totalSteps;
          for (const event of eventsAt(theme, wrappedStep, this.lightVisuals)) {
            this._scheduleVoice(session, event, session.nextTime);
          }
          session.cursor += 1;
          session.nextTime += stepDuration;
          if (session.cursor >= totalSteps) {
            if (!theme.loop) {
              this._finishNonLoop(session, session.nextTime);
              break;
            }
            session.cursor = 0;
            session.loopCount += 1;
          }
          guard += 1;
        }
      } catch (error) {
        this._report(error);
        this._clearScheduler(session);
        session.state = 'failed';
      }
    }

    _scheduleVoice(session, event, startTime) {
      if (this.voices.size >= this.maxActiveVoices) {
        this.skippedVoices += 1;
        return false;
      }
      try {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        const attack = clamp(event.attack || 0.012, 0.005, Math.min(0.35, event.duration / 2));
        const releaseStart = startTime + Math.max(attack + 0.01, event.duration * 0.58);
        const stopTime = startTime + event.duration + 0.025;
        oscillator.type = WAVES.has(event.wave) ? event.wave : 'sine';
        oscillator.frequency.setValueAtTime(clamp(event.frequency, 30, 4800), startTime);
        gain.gain.setValueAtTime(SILENCE, startTime);
        gain.gain.exponentialRampToValueAtTime(Math.max(SILENCE, event.gain), startTime + attack);
        gain.gain.setValueAtTime(Math.max(SILENCE, event.gain * 0.72), releaseStart);
        gain.gain.exponentialRampToValueAtTime(SILENCE, startTime + event.duration);
        oscillator.connect(gain);
        gain.connect(session.bus);
        const voice = { oscillator, gain, sessionId: session.id, layer: event.layer, stopped: false };
        this.voices.add(voice);
        this.scheduledVoices += 1;
        this.peakVoices = Math.max(this.peakVoices, this.voices.size);
        oscillator.onended = () => this._releaseVoice(voice);
        oscillator.start(startTime);
        oscillator.stop(stopTime);
        return true;
      } catch (error) {
        return this._report(error);
      }
    }

    _releaseVoice(voice) {
      if (!voice || !this.voices.has(voice)) return;
      this.voices.delete(voice);
      try { voice.oscillator.disconnect(); } catch (_) {}
      try { voice.gain.disconnect(); } catch (_) {}
    }

    _stopVoice(voice, when = this._now(), fade = 0.04) {
      if (!voice || voice.stopped) return;
      voice.stopped = true;
      this._rampParam(voice.gain && voice.gain.gain, SILENCE, this._now(), fade);
      try { voice.oscillator.stop(when + fade + 0.01); } catch (_) {
        this._releaseVoice(voice);
      }
    }

    _retireSession(session, fade = CROSSFADE_SECONDS) {
      if (!session || session.retired) return;
      session.retired = true;
      session.state = 'retired';
      this._clearScheduler(session);
      const now = this._now();
      this._rampParam(session.bus && session.bus.gain, SILENCE, now, fade);
      for (const voice of [...this.voices]) {
        if (voice.sessionId === session.id) this._stopVoice(voice, now, fade);
      }
      this._unref(setTimeout(() => {
        try { session.bus.disconnect(); } catch (_) {}
      }, Math.ceil((fade + 0.08) * 1000)));
    }

    _finishNonLoop(session, endTime) {
      session.finished = true;
      session.state = 'ending';
      this._clearScheduler(session);
      try {
        session.bus.gain.setValueAtTime(1, Math.max(this._now(), endTime - 0.45));
        session.bus.gain.linearRampToValueAtTime(SILENCE, endTime);
      } catch (_) {}
      const delay = Math.max(0, endTime - this._now()) * 1000;
      this._unref(setTimeout(() => {
        if (this.session === session && !session.retired) session.state = 'ended';
      }, Math.ceil(delay + 30)));
    }

    stop(options = {}) {
      const fade = clamp(options.fadeSeconds ?? 0.22, 0, 2);
      const previous = this.session;
      this.session = null;
      this.currentKey = null;
      if (previous) this._retireSession(previous, fade);
      return Boolean(previous);
    }

    setVolume(value) {
      this.volume = clamp(value, 0, 1);
      this._rampMaster(this._now(), 0.12);
      return this.volume;
    }

    setMuted(value) {
      const next = value === true;
      if (next === this.muted) return this.muted;
      this.muted = next;
      this._rampMaster(this._now(), 0.08);
      if (next) this._clearScheduler();
      else this._resumeScheduling();
      return this.muted;
    }

    setLightVisuals(value) {
      const next = value === true;
      if (next === this.lightVisuals) return this.lightVisuals;
      this.lightVisuals = next;
      if (next) {
        const now = this._now();
        for (const voice of [...this.voices]) {
          if (voice.layer === 'texture' || voice.layer === 'pulse') this._stopVoice(voice, now, 0.09);
        }
      }
      return this.lightVisuals;
    }

    setSettings(settings = {}) {
      if (Object.hasOwn(settings, 'volume')) this.setVolume(settings.volume);
      if (Object.hasOwn(settings, 'bgmVolume')) this.setVolume(settings.bgmVolume);
      if (Object.hasOwn(settings, 'muted')) this.setMuted(settings.muted);
      if (Object.hasOwn(settings, 'bgmMuted')) this.setMuted(settings.bgmMuted);
      if (Object.hasOwn(settings, 'lightVisuals')) this.setLightVisuals(settings.lightVisuals);
      return { volume: this.volume, muted: this.muted, lightVisuals: this.lightVisuals };
    }

    setVisible(value) {
      const next = value !== false;
      if (next === this.visible) return this.visible;
      this.visible = next;
      this._rampMaster(this._now(), next ? 0.18 : 0.06);
      if (!next) this._clearScheduler();
      else this._resumeScheduling();
      return this.visible;
    }

    pause() {
      this.setVisible(false);
      return true;
    }

    resume() {
      this.setVisible(true);
      return this.supported && !this.muted;
    }

    _resumeScheduling() {
      const session = this.session;
      if (!session || session.retired || session.finished || this.muted || !this.visible) return;
      session.nextTime = Math.max(session.nextTime, this._now() + 0.035);
      this._startScheduler(session);
    }

    _disposeNodes(fade = 0.02) {
      if (this.session) this._retireSession(this.session, fade);
      this.session = null;
      this.currentKey = null;
      for (const voice of [...this.voices]) this._stopVoice(voice, this._now(), fade);
      if (this.masterGain) {
        try { this.masterGain.disconnect(); } catch (_) {}
      }
      this.masterGain = null;
      this.supported = false;
    }

    destroy() {
      if (this.destroyed) return;
      this._disposeNodes(0.01);
      this.context = null;
      this.destination = null;
      this.destroyed = true;
    }

    snapshot() {
      const descriptor = this.currentKey ? THEME_DESCRIPTORS[this.currentKey] : null;
      return {
        version: VERSION,
        supported: this.supported,
        currentKey: this.currentKey,
        state: this.session ? this.session.state : 'stopped',
        volume: this.volume,
        muted: this.muted,
        lightVisuals: this.lightVisuals,
        visible: this.visible,
        activeVoices: this.voices.size,
        maxActiveVoices: this.maxActiveVoices,
        peakVoices: this.peakVoices,
        scheduledVoices: this.scheduledVoices,
        skippedVoices: this.skippedVoices,
        loopCount: this.session ? this.session.loopCount : 0,
        failureCount: this.failureCount,
        lastError: this.lastError,
        theme: descriptor ? copy(descriptor) : null
      };
    }
  }

  globalThis.TabenaiMusic = Object.freeze({
    version: VERSION,
    maxActiveVoices: MAX_ACTIVE_VOICES,
    themes: THEME_DESCRIPTORS,
    describe: key => THEME_DESCRIPTORS[key] ? copy(THEME_DESCRIPTORS[key]) : null,
    describeAll: () => Object.values(THEME_DESCRIPTORS).map(copy),
    renderSequence,
    create: options => new MusicEngine(options)
  });
})();
