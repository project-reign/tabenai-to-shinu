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

    assignment(context = {}) {
      const assignments = this.manifest.assignments || {};
      let resolved = {};
      if (context.screen && assignments.screens) {
        resolved = { ...(assignments.screens[context.screen] || {}) };
      } else if (context.endingCode && assignments.endings) {
        const endingKey = context.endingCode === 'death' || context.endingCode === 'starve'
          ? context.endingCode
          : (context.mode === 'survival' ? 'survival' : 'clear');
        resolved = { ...(assignments.endings[endingKey] || {}) };
      } else {
        if (context.category && assignments.categories) {
          resolved = { ...(assignments.categories[context.category] || {}) };
        }
        const table = context.mode === 'survival' ? assignments.survival : assignments.scenes;
        if (table && context.sceneId && table[context.sceneId]) {
          resolved = { ...resolved, ...table[context.sceneId] };
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
      this.currentBgm = null;
      this.currentBgmKey = null;
      this.pendingBgmKey = null;
      this.lastHook = null;
      this.lastHookToken = null;
      this.lastContext = null;
      this.renderGeneration = 0;
      this.prefersMotionQuery = typeof matchMedia === 'function'
        ? matchMedia('(prefers-reduced-motion: reduce)')
        : null;
      this._boundMotionChange = () => this._applyPreferenceClasses();
      this._boundVisibility = () => this._handleVisibility();
      this._boundGesture = event => this._unlockFromGesture(event);
      this._attachEnvironmentListeners();
      this.setSettings(this.settings);
      this.ready = this._loadManifest();
    }

    _attachEnvironmentListeners() {
      document.addEventListener('pointerdown', this._boundGesture, true);
      document.addEventListener('touchend', this._boundGesture, true);
      document.addEventListener('keydown', this._boundGesture, true);
      document.addEventListener('visibilitychange', this._boundVisibility);
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
        else if (this.audioUnlocked && !document.hidden) this.currentBgm.play().catch(() => { this.audioFailures += 1; });
      }
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

    async _unlockFromGesture(event) {
      if (!event || event.isTrusted !== true || this.audioUnlocked) return false;
      const unlocked = await this.unlockAudio();
      if (unlocked) {
        document.removeEventListener('pointerdown', this._boundGesture, true);
        document.removeEventListener('touchend', this._boundGesture, true);
        document.removeEventListener('keydown', this._boundGesture, true);
      }
      return unlocked;
    }

    async unlockAudio() {
      if (this.audioUnlocked) return true;
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContextClass) return false;
      try {
        this.audioContext = this.audioContext || new AudioContextClass();
        if (this.audioContext.state === 'suspended') await this.audioContext.resume();
        this.audioUnlocked = true;
        document.documentElement.dataset.audioUnlocked = 'true';
        if (this.pendingBgmKey) this.playBgm(this.pendingBgmKey);
        return true;
      } catch (_) {
        this.audioFailures += 1;
        return false;
      }
    }

    _handleVisibility() {
      if (document.hidden) {
        if (this.currentBgm) this.currentBgm.pause();
        if (this.audioContext && this.audioContext.state === 'running') {
          this.audioContext.suspend().catch(() => { this.audioFailures += 1; });
        }
        return;
      }
      if (!this.audioUnlocked) return;
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => { this.audioFailures += 1; });
      }
      if (this.currentBgm && !this.settings.bgmMuted) {
        this.currentBgm.play().catch(() => { this.audioFailures += 1; });
      }
    }

    playBgm(key) {
      this.pendingBgmKey = key || null;
      if (!key || !this.audioUnlocked) return false;
      const entry = this.registry.get('bgm', key);
      this.currentBgmKey = key;
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
      if (this.settings.bgmMuted || document.hidden) return false;
      this.currentBgm.play().catch(() => { this.audioFailures += 1; });
      return true;
    }

    cue(key) {
      if (!key || !this.audioUnlocked || this.settings.seMuted || this.settings.seVolume <= 0) return false;
      const entry = this.registry.get('se', key);
      if (!entry || !entry.synth || !this.audioContext) return false;
      try {
        const spec = entry.synth;
        const now = this.audioContext.currentTime;
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
        oscillator.start(now);
        oscillator.stop(now + duration + 0.01);
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
        : (kind === 'skip' ? 'refuse' : (['eat', 'drink', 'medicine'].includes(kind) ? 'consume' : 'choice'));
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
        moodKey: context.moodKey || (warning ? 'mood.warning' : undefined)
      };
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
      else if (context.category === 'milestone') hookName = 'milestone';
      else if (context.category === 'final') hookName = 'final';
      else if (context.warning) hookName = 'warning';
      this._applyHook(hookName, context.token, replayHook);

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
        currentBgmKey: this.currentBgmKey,
        pendingBgmKey: this.pendingBgmKey,
        reducedMotion: this.isReducedMotion(),
        assetFailures: this.assetFailures,
        audioFailures: this.audioFailures,
        lastHook: this.lastHook,
        lastHookToken: this.lastHookToken,
        settings: { ...this.settings }
      };
    }

    debugResolve(context) {
      return copy(this.registry.resolve(context));
    }
  }

  globalThis.TabenaiPresentation = Object.freeze({
    version: '4.6.0',
    defaults: DEFAULT_SETTINGS,
    normalizeSettings,
    normalizeManifest,
    AssetRegistry,
    create: options => new PresentationEngine(options)
  });
})();
