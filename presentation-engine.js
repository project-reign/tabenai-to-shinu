(() => {
  'use strict';

  const ASSET_TYPES = ['background', 'character', 'art', 'effect', 'bgm', 'se'];
  const KEY_FIELDS = {
    backgroundKey: 'background',
    characterKey: 'character',
    artKey: 'art',
    moodKey: 'effect'
  };
  const DEFAULT_SETTINGS = Object.freeze({
    bgmVolume: 0.45,
    seVolume: 0.65,
    bgmMuted: false,
    seMuted: false,
    haptics: true,
    lightVisuals: false,
    reducedMotion: false
  });
  const EMPTY_MANIFEST = Object.freeze({
    schemaVersion: 1,
    manifestVersion: 'fallback',
    assets: Object.freeze({
      background: Object.freeze({}), character: Object.freeze({}), art: Object.freeze({}),
      effect: Object.freeze({}), bgm: Object.freeze({}), se: Object.freeze({})
    }),
    variants: Object.freeze({ beanCharacters: Object.freeze({}) }),
    assignments: Object.freeze({ screens: {}, scenes: {}, survival: {}, categories: {}, endings: {} }),
    hooks: Object.freeze({}),
    actions: Object.freeze({})
  });
  const HAPTIC_PATTERNS = Object.freeze({
    choice: 8,
    warning: [20, 28, 20],
    rare: [12, 20, 12],
    milestone: [10, 18, 10],
    achievement: [10, 18, 10],
    death: [34, 48, 34],
    escape: [12, 28, 12]
  });
  const CLICKLESS_FADE_SECONDS = 0.032;
  const VOICE_STOP_TAIL_SECONDS = 0.008;
  const CONTEXT_SUSPEND_DELAY_MS = 48;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));
  const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const copy = value => JSON.parse(JSON.stringify(value));

  function normalizeSettings(value) {
    const input = isObject(value) ? value : {};
    return {
      bgmVolume: Number.isFinite(Number(input.bgmVolume)) ? clamp(input.bgmVolume, 0, 1) : DEFAULT_SETTINGS.bgmVolume,
      seVolume: Number.isFinite(Number(input.seVolume)) ? clamp(input.seVolume, 0, 1) : DEFAULT_SETTINGS.seVolume,
      bgmMuted: typeof input.bgmMuted === 'boolean' ? input.bgmMuted : DEFAULT_SETTINGS.bgmMuted,
      seMuted: typeof input.seMuted === 'boolean' ? input.seMuted : DEFAULT_SETTINGS.seMuted,
      haptics: typeof input.haptics === 'boolean' ? input.haptics : DEFAULT_SETTINGS.haptics,
      lightVisuals: typeof input.lightVisuals === 'boolean' ? input.lightVisuals : DEFAULT_SETTINGS.lightVisuals,
      reducedMotion: typeof input.reducedMotion === 'boolean' ? input.reducedMotion : DEFAULT_SETTINGS.reducedMotion
    };
  }

  function normalizeManifest(value) {
    if (!isObject(value) || Number(value.schemaVersion) !== 1) return EMPTY_MANIFEST;
    const normalized = {
      schemaVersion: 1,
      manifestVersion: String(value.manifestVersion || 'unknown'),
      budgets: isObject(value.budgets) ? { ...value.budgets } : {},
      assets: {},
      variants: isObject(value.variants) ? value.variants : {},
      assignments: isObject(value.assignments) ? value.assignments : {},
      hooks: isObject(value.hooks) ? value.hooks : {},
      actions: isObject(value.actions) ? value.actions : {}
    };
    for (const type of ASSET_TYPES) {
      normalized.assets[type] = isObject(value.assets) && isObject(value.assets[type])
        ? value.assets[type]
        : {};
    }
    return normalized;
  }

  class AssetRegistry {
    constructor(manifest = EMPTY_MANIFEST, baseUrl = document.baseURI) {
      this.baseUrl = baseUrl;
      this.setManifest(manifest);
    }

    setManifest(manifest) {
      this.manifest = normalizeManifest(manifest);
    }

    get(type, key) {
      if (!key || !ASSET_TYPES.includes(type)) return null;
      const entry = this.manifest.assets[type] && this.manifest.assets[type][key];
      if (!isObject(entry)) return null;
      let url = null;
      try { url = entry.src ? new URL(entry.src, this.baseUrl).href : null; } catch (_) {}
      return { key, type, ...entry, url };
    }

    beanCharacterKey(context = {}) {
      const variants = this.manifest.variants && this.manifest.variants.beanCharacters;
      if (!isObject(variants)) return null;
      const soil = String(context.beanSoil || '');
      const hasBean = context.beanChild === true
        || context.beanPossessed === true
        || ['white', 'red', 'gray', 'body'].includes(soil);
      if (!hasBean) return null;
      const variant = context.beanPossessed === true || soil === 'body'
        ? 'body'
        : (['white', 'red', 'gray'].includes(soil) ? soil : 'child');
      return typeof variants[variant] === 'string' ? variants[variant] : null;
    }

    assignment(context = {}) {
      const assignments = this.manifest.assignments || {};
      let resolved = {};
      if (context.screen && assignments.screens) {
        resolved = { ...(assignments.screens[context.screen] || {}) };
      } else if (context.endingCode && assignments.endings) {
        const endingKey = Object.hasOwn(assignments.endings, context.endingCode)
          ? context.endingCode
          : (context.endingCode === 'death' || context.endingCode === 'starve'
              ? context.endingCode
              : (context.mode === 'survival' ? 'survival' : 'clear'));
        resolved = { ...(assignments.endings[endingKey] || {}) };
      } else {
        if (context.category && assignments.categories) {
          resolved = { ...(assignments.categories[context.category] || {}) };
        }
        const table = context.mode === 'survival' ? assignments.survival : assignments.scenes;
        if (table && context.sceneId && table[context.sceneId]) {
          resolved = { ...resolved, ...table[context.sceneId] };
        }
        if (!resolved.characterKey) {
          const beanCharacterKey = this.beanCharacterKey(context);
          if (beanCharacterKey) resolved.characterKey = beanCharacterKey;
        }
      }
      for (const field of Object.keys(KEY_FIELDS)) {
        if (Object.hasOwn(context, field) && context[field]) resolved[field] = context[field];
      }
      return resolved;
    }

    resolve(context = {}) {
      const keys = this.assignment(context);
      const assets = {};
      for (const [field, type] of Object.entries(KEY_FIELDS)) {
        const key = keys[field] || null;
        assets[field] = key;
        assets[type] = this.get(type, key);
      }
      return { keys, assets };
    }

    hook(name) {
      const value = this.manifest.hooks && this.manifest.hooks[name];
      return isObject(value) ? value : {};
    }

    action(name) {
      return this.manifest.actions && this.manifest.actions[name] || null;
    }
  }

  class PresentationEngine {
    constructor(options = {}) {
      this.manifestUrl = new URL(options.manifestUrl || './assets/manifest.json', document.baseURI).href;
      this.registry = new AssetRegistry(EMPTY_MANIFEST, document.baseURI);
      this.settings = normalizeSettings(options.settings);
      this.manifestStatus = 'loading';
      this.assetFailures = 0;
      this.audioFailures = 0;
      this.audioUnlocked = false;
      this.audioContext = null;
      this.musicEngine = null;
      this.lifecyclePaused = false;
      this.resumeGestureArmed = false;
      this.gestureOperation = null;
      this.pendingTouchGesture = null;
      this.lastConsumedGestureAt = -Infinity;
      this.lastConsumedGestureType = null;
      this.lifecycleSuspendTimer = null;
      this.debugAudioLifecycle = options.debug === true;
      this.audioLifecycleLog = [];
      this.audioLifecycleSequence = 0;
      this.audioLifecycleListenerCount = 0;
      this.cueCount = 0;
      this.lastCueKey = null;
      this.currentBgm = null;
      this.currentBgmKey = null;
      this.pendingBgmKey = null;
      this.lastHook = null;
      this.lastHookToken = null;
      this.lastContext = null;
      this.lastStatusCueToken = null;
      this.activeSeVoices = new Set();
      this.lastCueAt = new Map();
      this.renderGeneration = 0;
      this.prefersMotionQuery = typeof matchMedia === 'function'
        ? matchMedia('(prefers-reduced-motion: reduce)')
        : null;
      this._boundMotionChange = () => this._applyPreferenceClasses();
      this._boundVisibility = () => this._handleVisibility();
      this._boundGesture = event => this._handleGestureEvent(event);
      this._boundPageHide = event => this._pauseForLifecycle('pagehide', { persisted: event.persisted === true });
      this._boundPageShow = event => this._armGestureResume('pageshow', { persisted: event.persisted === true });
      this._boundFreeze = () => this._pauseForLifecycle('freeze');
      this._boundResume = () => this._armGestureResume('resume');
      this._attachEnvironmentListeners();
      this.setSettings(this.settings);
      this.ready = this._loadManifest();
    }

    _attachEnvironmentListeners() {
      document.addEventListener('pointerdown', this._boundGesture, true);
      document.addEventListener('touchend', this._boundGesture, true);
      document.addEventListener('click', this._boundGesture, true);
      document.addEventListener('keydown', this._boundGesture, true);
      document.addEventListener('visibilitychange', this._boundVisibility);
      window.addEventListener('pagehide', this._boundPageHide);
      window.addEventListener('pageshow', this._boundPageShow);
      document.addEventListener('freeze', this._boundFreeze);
      document.addEventListener('resume', this._boundResume);
      this.audioLifecycleListenerCount = 9;
      if (this.prefersMotionQuery) {
        if (typeof this.prefersMotionQuery.addEventListener === 'function') {
          this.prefersMotionQuery.addEventListener('change', this._boundMotionChange);
        } else if (typeof this.prefersMotionQuery.addListener === 'function') {
          this.prefersMotionQuery.addListener(this._boundMotionChange);
        }
      }
    }

    async _loadManifest() {
      try {
        const response = await fetch(this.manifestUrl, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`asset manifest ${response.status}`);
        const manifest = normalizeManifest(await response.json());
        if (manifest === EMPTY_MANIFEST) throw new Error('invalid asset manifest');
        this.registry.setManifest(manifest);
        this.manifestStatus = 'ready';
      } catch (_) {
        this.registry.setManifest(EMPTY_MANIFEST);
        this.manifestStatus = 'fallback';
        this.assetFailures += 1;
      }
      document.documentElement.dataset.assetManifest = this.manifestStatus;
      if (this.lastContext) this._renderContext(this.lastContext, false);
      return this.snapshot();
    }

    setManifestForTest(manifest) {
      this.registry.setManifest(manifest);
      this.manifestStatus = 'test';
      if (this.lastContext) this._renderContext(this.lastContext, false);
    }

    setSettings(value) {
      this.settings = normalizeSettings({ ...this.settings, ...(isObject(value) ? value : {}) });
      this._applyPreferenceClasses();
      if (this.currentBgm) {
        this.currentBgm.volume = this.settings.bgmMuted ? 0 : this.settings.bgmVolume;
        if (this.settings.bgmMuted) this.currentBgm.pause();
        else if (this.audioUnlocked && !document.hidden && !this.lifecyclePaused && !this.resumeGestureArmed) {
          this.currentBgm.play().catch(() => { this.audioFailures += 1; });
        }
      }
      if (this.musicEngine) this.musicEngine.setSettings(this.settings);
      return { ...this.settings };
    }

    _applyPreferenceClasses() {
      const prefersReduced = !!(this.prefersMotionQuery && this.prefersMotionQuery.matches);
      const reduced = !!this.settings.reducedMotion || prefersReduced;
      document.documentElement.classList.toggle('presentation-reduced-motion', reduced);
      document.documentElement.classList.toggle('presentation-light-visuals', !!this.settings.lightVisuals);
      document.documentElement.dataset.motion = reduced ? 'reduced' : 'full';
      if (this.lastContext) this._renderContext(this.lastContext, false);
    }

    isReducedMotion() {
      return document.documentElement.classList.contains('presentation-reduced-motion');
    }

    _logAudioLifecycle(event, detail = {}) {
      if (!this.debugAudioLifecycle) return;
      this.audioLifecycleLog.push({
        sequence: ++this.audioLifecycleSequence,
        event,
        contextState: this.audioContext ? this.audioContext.state : 'not-created',
        bgmKey: this.currentBgmKey,
        ...detail
      });
      if (this.audioLifecycleLog.length > 64) this.audioLifecycleLog.splice(0, this.audioLifecycleLog.length - 64);
    }

    _handleGestureEvent(event) {
      if (!event || event.isTrusted !== true) return false;
      const eventAt = typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();
      if (event.type === 'pointerdown' && event.pointerType === 'touch') {
        this.pendingTouchGesture = {
          pointerId: Number.isFinite(Number(event.pointerId)) ? Number(event.pointerId) : null,
          at: eventAt
        };
        this._logAudioLifecycle('touch-unlock-candidate');
        return false;
      }
      if (event.type === 'touchend') this.pendingTouchGesture = null;
      if (event.type === 'click' && eventAt - this.lastConsumedGestureAt < 450) return false;
      return this._unlockFromGesture(event, eventAt);
    }

    async _unlockFromGesture(event, eventAt = Date.now()) {
      if (!event || event.isTrusted !== true || this.gestureOperation) return false;
      let operation;
      if (this.resumeGestureArmed) {
        this.resumeGestureArmed = false;
        this._logAudioLifecycle('gesture-resume-consumed', { type: event.type });
        operation = this._resumeAfterGesture();
      } else if (!this.audioUnlocked) {
        if (!document.hidden) this.lifecyclePaused = false;
        operation = this.unlockAudio();
      } else {
        return false;
      }
      this.gestureOperation = operation;
      try {
        const unlocked = await operation;
        if (unlocked) {
          this.lastConsumedGestureAt = eventAt;
          this.lastConsumedGestureType = event.type;
        }
        return unlocked;
      } finally {
        if (this.gestureOperation === operation) this.gestureOperation = null;
      }
    }

    async unlockAudio() {
      if (this.audioUnlocked) return true;
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContextClass) return false;
      try {
        this.audioContext = this.audioContext || new AudioContextClass();
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
          this._logAudioLifecycle('context-resume', { reason: 'initial-gesture' });
        }
        if (!this.musicEngine && globalThis.TabenaiMusic) {
          this.musicEngine = globalThis.TabenaiMusic.create({
            audioContext: this.audioContext,
            bgmVolume: this.settings.bgmVolume,
            bgmMuted: this.settings.bgmMuted,
            lightVisuals: this.settings.lightVisuals,
            visible: !document.hidden && !this.lifecyclePaused,
            onError: () => { this.audioFailures += 1; }
          });
        }
        this.audioUnlocked = true;
        this.lifecyclePaused = false;
        this.resumeGestureArmed = false;
        document.documentElement.dataset.audioUnlocked = 'true';
        this._logAudioLifecycle('audio-unlocked');
        if (this.pendingBgmKey) this.playBgm(this.pendingBgmKey);
        return true;
      } catch (_) {
        this.audioFailures += 1;
        return false;
      }
    }

    _rampAudioParam(param, target, now, duration) {
      if (!param) return false;
      const safeTarget = Math.max(0.0001, Number(target) || 0.0001);
      try {
        if (typeof param.cancelScheduledValues === 'function') param.cancelScheduledValues(now);
        const current = Math.max(0.0001, Number(param.value) || 0.0001);
        param.setValueAtTime(current, now);
        if (typeof param.linearRampToValueAtTime === 'function') {
          param.linearRampToValueAtTime(safeTarget, now + duration);
        } else {
          param.exponentialRampToValueAtTime(safeTarget, now + duration);
        }
        return true;
      } catch (_) {
        return false;
      }
    }

    _releaseSeVoice(voice) {
      if (!voice || voice.released) return false;
      voice.released = true;
      if (voice.releaseTimer !== null) {
        clearTimeout(voice.releaseTimer);
        voice.releaseTimer = null;
      }
      this.activeSeVoices.delete(voice);
      try { voice.oscillator.disconnect(); } catch (_) {}
      try { voice.gain.disconnect(); } catch (_) {}
      return true;
    }

    _stopSeVoice(voice, fadeSeconds = CLICKLESS_FADE_SECONDS) {
      if (!voice || voice.stopped || voice.released || !this.audioContext) return false;
      voice.stopped = true;
      const now = this.audioContext.currentTime;
      const fade = clamp(fadeSeconds, 0.02, 0.04);
      this._rampAudioParam(voice.gain && voice.gain.gain, 0.0001, now, fade);
      try {
        voice.oscillator.stop(now + fade + VOICE_STOP_TAIL_SECONDS);
      } catch (_) {
        voice.releaseTimer = setTimeout(
          () => this._releaseSeVoice(voice),
          Math.ceil((fade + VOICE_STOP_TAIL_SECONDS) * 1000)
        );
      }
      return true;
    }

    _flushSeVoices(fadeSeconds = CLICKLESS_FADE_SECONDS) {
      const count = this.activeSeVoices.size;
      for (const voice of [...this.activeSeVoices]) {
        this._stopSeVoice(voice, fadeSeconds);
      }
      this.lastCueAt.clear();
      return count;
    }

    _clearLifecycleSuspendTimer() {
      if (this.lifecycleSuspendTimer !== null) {
        clearTimeout(this.lifecycleSuspendTimer);
        this.lifecycleSuspendTimer = null;
      }
    }

    _pauseForLifecycle(reason, detail = {}) {
      this._logAudioLifecycle(reason, detail);
      if (this.lifecyclePaused) return false;
      this.lifecyclePaused = true;
      this.resumeGestureArmed = this.audioUnlocked;
      if (this.resumeGestureArmed) this._logAudioLifecycle('gesture-resume-armed', { reason });
      if (this.currentBgm) this.currentBgm.pause();
      this._clearLifecycleSuspendTimer();
      const flushedSe = this._flushSeVoices(CLICKLESS_FADE_SECONDS);
      const flushedBgm = this.musicEngine
        ? this.musicEngine.pause({ flush: true, fadeSeconds: CLICKLESS_FADE_SECONDS })
        : false;
      this._logAudioLifecycle('scheduler-stop-flush', {
        reason, flushedSe, flushedBgm, fadeSeconds: CLICKLESS_FADE_SECONDS
      });
      if (this.audioContext && this.audioContext.state === 'running') {
        this.lifecycleSuspendTimer = setTimeout(() => {
          this.lifecycleSuspendTimer = null;
          if (!this.lifecyclePaused || !this.audioContext || this.audioContext.state !== 'running') return;
          this.audioContext.suspend()
            .then(() => this._logAudioLifecycle('context-suspend', { reason, afterFade: true }))
            .catch(() => { this.audioFailures += 1; });
        }, CONTEXT_SUSPEND_DELAY_MS);
      }
      return true;
    }

    _armGestureResume(reason, detail = {}) {
      this._logAudioLifecycle(reason, detail);
      if (!this.audioUnlocked || !this.lifecyclePaused) return false;
      this.resumeGestureArmed = true;
      this._logAudioLifecycle('gesture-resume-armed', { reason });
      return true;
    }

    async _resumeAfterGesture() {
      if (!this.audioUnlocked || !this.lifecyclePaused || document.hidden) return false;
      this._clearLifecycleSuspendTimer();
      this.lifecyclePaused = false;
      try {
        if (this.audioContext && this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
          this._logAudioLifecycle('context-resume', { reason: 'trusted-gesture' });
        }
        if (this.musicEngine) {
          this.musicEngine.resume({ fadeSeconds: 0.28, leadSeconds: 0.09 });
          this._logAudioLifecycle('scheduler-restart', { fadeSeconds: 0.28 });
        }
        if (this.currentBgm && !this.settings.bgmMuted) {
          await this.currentBgm.play().catch(() => { this.audioFailures += 1; });
        }
        return true;
      } catch (_) {
        this.audioFailures += 1;
        this.lifecyclePaused = true;
        this.resumeGestureArmed = true;
        return false;
      }
    }

    _handleVisibility() {
      if (document.hidden) this._pauseForLifecycle('hidden');
      else this._armGestureResume('visible');
    }

    playBgm(key) {
      this.pendingBgmKey = key || null;
      if (!key || !this.audioUnlocked) return false;
      const entry = this.registry.get('bgm', key);
      this.currentBgmKey = key;
      if (this.musicEngine && entry && entry.generator === 'deterministic-web-audio') {
        if (this.currentBgm) {
          this.currentBgm.pause();
          this.currentBgm = null;
        }
        this.musicEngine.setSettings(this.settings);
        return this.musicEngine.play(key);
      }
      if (this.musicEngine) this.musicEngine.stop();
      if (!entry || !entry.url) {
        if (this.currentBgm) {
          this.currentBgm.pause();
          this.currentBgm = null;
        }
        return false;
      }
      if (!this.currentBgm || this.currentBgm.dataset.assetKey !== key) {
        if (this.currentBgm) this.currentBgm.pause();
        const audio = new Audio();
        audio.preload = 'none';
        audio.loop = entry.loop !== false;
        audio.dataset.assetKey = key;
        audio.src = entry.url;
        audio.addEventListener('error', () => {
          this.audioFailures += 1;
          audio.pause();
        }, { once: true });
        this.currentBgm = audio;
      }
      this.currentBgm.volume = this.settings.bgmMuted ? 0 : this.settings.bgmVolume;
      if (this.settings.bgmMuted || document.hidden || this.lifecyclePaused || this.resumeGestureArmed) return false;
      this.currentBgm.play().catch(() => { this.audioFailures += 1; });
      return true;
    }

    cue(key) {
      if (!key || !this.audioUnlocked || this.lifecyclePaused || this.resumeGestureArmed || document.hidden
        || this.settings.seMuted || this.settings.seVolume <= 0) return false;
      const entry = this.registry.get('se', key);
      if (!entry || !entry.synth || !this.audioContext) return false;
      try {
        const spec = entry.synth;
        const now = this.audioContext.currentTime;
        const lastAt = this.lastCueAt.get(key);
        if (Number.isFinite(lastAt) && now - lastAt < 0.035) return false;
        this.lastCueAt.set(key, now);
        if (this.activeSeVoices.size >= 12) {
          const oldest = this.activeSeVoices.values().next().value;
          this._stopSeVoice(oldest, 0.025);
        }
        const duration = clamp(spec.duration || 0.08, 0.025, 0.5);
        const oscillator = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        oscillator.type = ['sine', 'triangle', 'square', 'sawtooth'].includes(spec.wave) ? spec.wave : 'sine';
        oscillator.frequency.setValueAtTime(clamp(spec.frequency || 440, 40, 4000), now);
        oscillator.frequency.exponentialRampToValueAtTime(clamp(spec.endFrequency || spec.frequency || 440, 40, 4000), now + duration);
        gain.gain.setValueAtTime(Math.max(0.0001, this.settings.seVolume * 0.12), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        oscillator.connect(gain);
        gain.connect(this.audioContext.destination);
        const voice = { oscillator, gain, stopped: false, released: false, releaseTimer: null };
        this.activeSeVoices.add(voice);
        oscillator.onended = () => this._releaseSeVoice(voice);
        oscillator.start(now);
        oscillator.stop(now + duration + 0.01);
        this.cueCount += 1;
        this.lastCueKey = key;
        this._logAudioLifecycle('cue', { cueKey: key });
        return true;
      } catch (_) {
        this.audioFailures += 1;
        return false;
      }
    }

    haptic(name) {
      if (!this.settings.haptics || typeof navigator.vibrate !== 'function') return false;
      const pattern = HAPTIC_PATTERNS[name];
      if (!pattern) return false;
      try { return navigator.vibrate(pattern) === true; } catch (_) { return false; }
    }

    _applyHook(name, token, replay = true) {
      const hook = this.registry.hook(name);
      if (hook.bgmKey) this.playBgm(hook.bgmKey);
      const isNew = replay && `${name}:${token || ''}` !== this.lastHookToken;
      if (isNew) {
        if (hook.seKey) this.cue(hook.seKey);
        if (Object.hasOwn(HAPTIC_PATTERNS, name)) this.haptic(name);
        this.lastHookToken = `${name}:${token || ''}`;
      }
      this.lastHook = name;
      document.documentElement.dataset.presentationHook = name;
      return hook;
    }

    action(kind, options = {}) {
      const action = options.warning
        ? 'warning'
        : (kind === 'menu'
            ? 'menu'
            : (kind === 'skip' ? 'refuse' : (['eat', 'drink', 'medicine'].includes(kind) ? 'consume' : 'choice')));
      const key = this.registry.action(action) || this.registry.action('choice');
      this.cue(key);
      this.haptic(options.warning ? 'warning' : 'choice');
      document.documentElement.dataset.lastPresentationAction = action;
      return action;
    }

    presentScreen(screen) {
      const context = { screen, token: `screen:${screen}` };
      this.lastContext = context;
      this._renderContext(context, true);
    }

    presentScene(context = {}) {
      const status = String(context.status || '');
      const warning = !['rare', 'milestone', 'final'].includes(context.category)
        && /(毒|負傷|疲労|幻覚|衰弱|出血|副作用|酔い|怪物)/.test(status);
      const safeContext = {
        mode: context.mode === 'survival' ? 'survival' : (context.mode || 'story'),
        sceneId: String(context.sceneId || ''),
        category: context.category ? String(context.category) : null,
        token: String(context.token || context.sceneId || ''),
        icon: String(context.icon || '🍽️'),
        title: String(context.title || ''),
        status,
        warning,
        artKey: context.artKey || undefined,
        backgroundKey: context.backgroundKey || undefined,
        characterKey: context.characterKey || undefined,
        beanSoil: context.beanSoil || undefined,
        beanPossessed: context.beanPossessed === true,
        beanChild: context.beanChild === true,
        moodKey: context.moodKey || (warning ? 'mood.warning' : undefined)
      };
      safeContext.statusCue = /(?:毒|中毒)/.test(status)
        ? 'se.poison'
        : (/(?:疲労|衰弱)/.test(status)
            ? 'se.fatigue'
            : (/(?:負傷|裂傷|打撲|出血|重傷|かじられ)/.test(status) ? 'se.injury' : null));
      this.lastContext = safeContext;
      this._renderContext(safeContext, true);
    }

    presentEnding(context = {}) {
      const safeContext = {
        mode: context.mode === 'survival' ? 'survival' : (context.mode || 'story'),
        endingCode: String(context.endingCode || 'end'),
        token: String(context.token || `ending:${context.endingCode || 'end'}`),
        icon: String(context.icon || '🏁'),
        title: String(context.title || '')
      };
      this.lastContext = safeContext;
      this._renderContext(safeContext, true);
    }

    notifyAchievement(achievement = {}) {
      const overlay = document.getElementById('achievementPresentation');
      if (overlay) {
        const icon = overlay.querySelector('[data-achievement-icon]');
        const name = overlay.querySelector('[data-achievement-name]');
        if (icon) icon.textContent = achievement.icon || '🏆';
        if (name) name.textContent = achievement.name || '実績解除';
        overlay.hidden = false;
        overlay.classList.remove('is-showing');
        if (!this.isReducedMotion()) void overlay.offsetWidth;
        overlay.classList.add('is-showing');
        clearTimeout(this.achievementTimer);
        this.achievementTimer = setTimeout(() => {
          overlay.classList.remove('is-showing');
          overlay.hidden = true;
        }, this.isReducedMotion() ? 1400 : 2600);
      }
      this._applyHook('achievement', achievement.id || achievement.name || 'achievement', true);
    }

    _renderContext(context, replayHook) {
      const resolved = this.registry.resolve(context);
      this.renderGeneration += 1;
      const generation = this.renderGeneration;
      if (context.screen) {
        const titleBackdrop = document.getElementById('titleBackdrop');
        if (context.screen === 'title' && titleBackdrop) {
          this._setImage(titleBackdrop, resolved.assets.background, null, generation);
        }
        this._applyHook(context.screen === 'title' ? 'title' : 'normal', context.token, replayHook);
        return;
      }

      const fallbackIcon = document.getElementById('sceneIcon');
      if (fallbackIcon && context.icon) fallbackIcon.textContent = context.icon;
      this._setImage(document.getElementById('sceneBackground'), resolved.assets.background, null, generation);
      this._setImage(document.getElementById('sceneArt'), resolved.assets.art, fallbackIcon, generation);
      this._setCharacter(resolved.assets.character, generation);
      this._setEffect(resolved.assets.effect);

      let hookName = 'normal';
      if (context.endingCode) {
        hookName = context.endingCode === 'death' || context.endingCode === 'starve' ? 'death' : 'escape';
      } else if (context.category === 'rare') hookName = 'rare';
      else if (context.category === 'conditional') hookName = 'conditional';
      else if (context.category === 'milestone') hookName = 'milestone';
      else if (context.category === 'final') hookName = 'final';
      else if (context.warning) hookName = 'warning';
      this._applyHook(hookName, context.token, replayHook);
      const statusCueToken = context.statusCue ? `${context.token}:${context.statusCue}` : null;
      if (replayHook && context.statusCue && statusCueToken !== this.lastStatusCueToken) {
        this.cue(context.statusCue);
        this.lastStatusCueToken = statusCueToken;
        document.documentElement.dataset.lastPresentationStatus = context.statusCue.slice(3);
      }

      const card = document.getElementById('sceneCard');
      if (card) {
        card.dataset.presentation = hookName;
        card.dataset.assetScene = context.sceneId || context.endingCode || '';
        card.classList.remove('presentation-pulse');
        if (replayHook && !this.isReducedMotion()) {
          void card.offsetWidth;
          card.classList.add('presentation-pulse');
        }
      }
    }

    _setImage(element, entry, fallback, generation) {
      if (!element) return;
      element.onload = null;
      element.onerror = null;
      element.removeAttribute('src');
      element.hidden = true;
      element.dataset.assetState = 'fallback';
      if (fallback) fallback.hidden = false;
      if (this.settings.lightVisuals || !entry || !entry.url) return;
      element.alt = entry.alt || '';
      element.loading = entry.cache === 'lazy' ? 'lazy' : 'eager';
      element.decoding = 'async';
      element.onload = () => {
        if (generation !== this.renderGeneration) return;
        element.hidden = false;
        element.dataset.assetState = 'ready';
        if (fallback) fallback.hidden = true;
      };
      element.onerror = () => {
        if (generation !== this.renderGeneration) return;
        element.hidden = true;
        element.dataset.assetState = 'error';
        this.assetFailures += 1;
        if (fallback) fallback.hidden = false;
      };
      element.src = entry.url;
    }

    _setCharacter(entry, generation) {
      const image = document.getElementById('sceneCharacter');
      const fallback = document.getElementById('sceneCharacterFallback');
      if (fallback) {
        fallback.textContent = entry && entry.fallback || '';
        fallback.hidden = !entry || !entry.fallback || this.settings.lightVisuals;
      }
      this._setImage(image, entry, null, generation);
      if (image && entry && entry.url) {
        image.onload = () => {
          if (generation !== this.renderGeneration) return;
          image.hidden = false;
          image.dataset.assetState = 'ready';
          if (fallback) fallback.hidden = true;
        };
        image.onerror = () => {
          if (generation !== this.renderGeneration) return;
          image.hidden = true;
          image.dataset.assetState = 'error';
          this.assetFailures += 1;
          if (fallback) fallback.hidden = !entry.fallback;
        };
      }
    }

    _setEffect(entry) {
      const effect = document.getElementById('sceneEffect');
      if (!effect) return;
      effect.className = 'scene-effect-layer';
      effect.textContent = '';
      effect.setAttribute('aria-label', '');
      if (!entry) return;
      if (entry.className) effect.classList.add(entry.className);
      if (entry.alt) effect.setAttribute('aria-label', entry.alt);
    }

    snapshot() {
      return {
        manifestStatus: this.manifestStatus,
        manifestVersion: this.registry.manifest.manifestVersion,
        audioUnlocked: this.audioUnlocked,
        audioContextState: this.audioContext ? this.audioContext.state : 'not-created',
        lifecyclePaused: this.lifecyclePaused,
        resumeGestureArmed: this.resumeGestureArmed,
        audioLifecycleListenerCount: this.audioLifecycleListenerCount,
        cueCount: this.cueCount,
        lastCueKey: this.lastCueKey,
        currentBgmKey: this.currentBgmKey,
        pendingBgmKey: this.pendingBgmKey,
        reducedMotion: this.isReducedMotion(),
        assetFailures: this.assetFailures,
        audioFailures: this.audioFailures,
        activeSeVoices: this.activeSeVoices.size,
        stoppingSeVoices: [...this.activeSeVoices].filter(voice => voice.stopped && !voice.released).length,
        pendingTouchGesture: !!this.pendingTouchGesture,
        lastConsumedGestureType: this.lastConsumedGestureType,
        music: this.musicEngine ? this.musicEngine.snapshot() : null,
        lastHook: this.lastHook,
        lastHookToken: this.lastHookToken,
        settings: { ...this.settings },
        ...(this.debugAudioLifecycle ? { audioLifecycle: this.audioLifecycleLog.map(entry => ({ ...entry })) } : {})
      };
    }

    debugResolve(context) {
      return copy(this.registry.resolve(context));
    }
  }

  globalThis.TabenaiPresentation = Object.freeze({
    version: '4.7.0',
    defaults: DEFAULT_SETTINGS,
    normalizeSettings,
    normalizeManifest,
    AssetRegistry,
    create: options => new PresentationEngine(options)
  });
})();
