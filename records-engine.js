(() => {
  'use strict';

  // v4.8 records are deliberately isolated from the game engines. Every API
  // below is pure: callers supply timestamps and storage contents, and receive
  // JSON-safe values back. No game PRNG state, wall clock, or browser storage is
  // read here.
  const VERSION = '4.8.0';
  const FORMAT = 'tabenai-save';
  const FORMAT_VERSION = 3;
  const WORKSPACE_VERSION = 1;
  const SLOT_COUNT = 3;
  const HISTORY_LIMIT = 30;
  const FATE_FORMAT = 'tabenai-fate';
  const FATE_VERSION = 1;
  const FATE_PREFIX = 'TABENAI-FATE-1.';
  const DAILY_ALGORITHM = 'fnv1a32-jst-v1';
  const MODES = Object.freeze(['story', 'hard', 'survival']);
  const MODE_ORDER = new Map(MODES.map((mode, index) => [mode, index]));
  const SLOT_NAME_LIMIT = 40;
  const ID_LIMIT = 160;
  const TOKEN_LIMIT = 600;

  const STORAGE_KEYS = Object.freeze({
    slots: 'tabenai-to-shinu-run-slots-v1',
    activeSlot: 'tabenai-to-shinu-active-slot-v1',
    history: 'tabenai-to-shinu-run-history-v1',
    codex: 'tabenai-to-shinu-codex-v1',
    daily: 'tabenai-to-shinu-daily-v1',
    migrationMarker: 'tabenai-to-shinu-run-slots-migrated-v1',
    legacyRun: 'tabenai-to-shinu-50days-v4',
    meta: 'tabenai-to-shinu-meta-v1',
    endings: 'tabenai-to-shinu-endings-v4'
  });

  const CODEX_CATEGORIES = Object.freeze(['foods', 'events', 'characters', 'endings']);
  const CATEGORY_ALIASES = Object.freeze({
    food: 'foods', foods: 'foods',
    event: 'events', events: 'events',
    character: 'characters', characters: 'characters', companion: 'characters', companions: 'characters',
    ending: 'endings', endings: 'endings'
  });
  const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const hasOwn = (value, key) => isObject(value) && Object.prototype.hasOwnProperty.call(value, key);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const nonNegativeInteger = value => Math.max(0, Math.floor(Number.isFinite(Number(value)) ? Number(value) : 0));
  const finiteNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const safeText = (value, limit = ID_LIMIT) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
  const safeIdentifier = (value, limit = ID_LIMIT) => {
    const text = safeText(value, limit);
    return ['__proto__', 'constructor', 'prototype'].includes(text) ? '' : text;
  };
  const validTimestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
  const uniqueStrings = (values, limit = 500) => Array.from(new Set((Array.isArray(values) ? values : [])
    .map(value => safeText(value))
    .filter(Boolean))).sort().slice(0, limit);
  const normalizeMode = value => MODES.includes(value) ? value : 'story';
  const normalizeSeed = value => (Number.isFinite(Number(value)) ? Number(value) : 0) >>> 0;

  function stableObject(value) {
    if (Array.isArray(value)) return value.map(stableObject);
    if (!isObject(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableObject(value[key])]));
  }

  function stableStringify(value) {
    return JSON.stringify(stableObject(value));
  }

  function fnv1a32(value, offset = 0x811c9dc5) {
    const text = String(value);
    let hash = offset >>> 0;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
  }

  function hashToken(value) {
    const text = String(value);
    const first = fnv1a32(text, 0x811c9dc5).toString(16).padStart(8, '0');
    const second = fnv1a32(text, 0x9e3779b9).toString(16).padStart(8, '0');
    return `${first}${second}`;
  }

  function normalizeSlotId(value) {
    const match = String(value === null || value === undefined ? '' : value).match(/^(?:slot-)?([1-3])$/);
    return match ? `slot-${match[1]}` : null;
  }

  function defaultSlotName(index) {
    return `スロット ${index}`;
  }

  function freshSlot(index) {
    return {
      id: `slot-${index}`,
      name: defaultSlotName(index),
      run: null,
      createdAt: null,
      updatedAt: null
    };
  }

  function normalizeSlot(raw, index) {
    const base = freshSlot(index);
    const input = isObject(raw) ? raw : {};
    const run = isObject(input.run) ? clone(input.run) : null;
    if (run && isObject(run.recording)) run.recording.slotId = base.id;
    return {
      id: base.id,
      name: safeText(input.name, SLOT_NAME_LIMIT) || base.name,
      run,
      createdAt: validTimestamp(input.createdAt),
      updatedAt: validTimestamp(input.updatedAt) || (run ? validTimestamp(run.lastPlayedAt) : null)
    };
  }

  function freshCodex() {
    return {
      version: 1,
      categories: {
        foods: {},
        events: {},
        characters: {},
        endings: {}
      },
      receipts: {}
    };
  }

  function normalizeCodexEntry(raw, id) {
    const input = isObject(raw) ? raw : {};
    const modes = uniqueStrings(input.modes).filter(mode => MODES.includes(mode))
      .sort((left, right) => MODE_ORDER.get(left) - MODE_ORDER.get(right));
    return {
      id,
      name: safeText(input.name, 120) || null,
      hidden: !!input.hidden,
      emoji: safeText(input.emoji, 16) || null,
      discovered: input.discovered === true || nonNegativeInteger(input.encounterCount) > 0
        || nonNegativeInteger(input.choiceA) > 0 || nonNegativeInteger(input.choiceB) > 0,
      firstEncounteredAt: validTimestamp(input.firstEncounteredAt),
      lastEncounteredAt: validTimestamp(input.lastEncounteredAt),
      encounterCount: nonNegativeInteger(input.encounterCount),
      modes,
      choiceA: nonNegativeInteger(input.choiceA),
      choiceB: nonNegativeInteger(input.choiceB),
      consumedCount: nonNegativeInteger(input.consumedCount),
      refusedCount: nonNegativeInteger(input.refusedCount),
      resultIds: uniqueStrings(input.resultIds),
      assetIds: uniqueStrings(input.assetIds)
    };
  }

  function normalizeCodex(raw) {
    const base = freshCodex();
    const input = isObject(raw) ? raw : {};
    const sourceCategories = isObject(input.categories) ? input.categories : input;
    for (const category of CODEX_CATEGORIES) {
      const source = isObject(sourceCategories[category]) ? sourceCategories[category] : {};
      for (const [rawId, entry] of Object.entries(source)) {
        const id = safeIdentifier(rawId);
        if (!id) continue;
        base.categories[category][id] = normalizeCodexEntry(entry, id);
      }
    }
    const receipts = isObject(input.receipts) ? input.receipts : {};
    for (const [hash, receipt] of Object.entries(receipts)) {
      const key = safeText(hash, 40);
      const value = safeText(receipt, TOKEN_LIMIT);
      if (key && value) base.receipts[key] = value;
    }
    return base;
  }

  function normalizeHistoryEntry(raw) {
    if (!isObject(raw)) return null;
    const input = clone(raw);
    const mode = normalizeMode(input.mode);
    const seed = normalizeSeed(input.seed);
    const choices = normalizeChoices(input.choices || input.choiceSequence || []);
    const endingCode = safeText(input.endingCode || (isObject(input.ending) && input.ending.code), 120) || null;
    const runId = safeText(input.runId, 80) || makeRunId({
      mode,
      seed,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      endingCode,
      choices
    });
    input.runId = runId;
    input.mode = mode;
    input.seed = seed;
    input.day = clamp(nonNegativeInteger(input.day || input.days || 1), 0, 9999);
    input.hp = finiteNumber(input.hp, 0);
    input.hunger = finiteNumber(input.hunger, 0);
    input.choices = choices;
    input.endingCode = endingCode;
    input.gameVersion = safeText(input.gameVersion, 40) || VERSION;
    input.title = safeText(input.title || (isObject(input.ending) && input.ending.title), 160) || null;
    input.totalChoices = Math.max(nonNegativeInteger(input.totalChoices), choices.length);
    input.consumed = nonNegativeInteger(input.consumed);
    input.refused = nonNegativeInteger(input.refused);
    input.beanRoute = safeText(input.beanRoute, 40) || null;
    input.rareEncounters = uniqueStrings(input.rareEncounters);
    input.finalDish = safeText(input.finalDish, 80) || null;
    input.finalBox = safeText(input.finalBox, 80) || null;
    input.broughtHome = safeText(input.broughtHome, 160) || null;
    input.unlockedAchievements = uniqueStrings(input.unlockedAchievements);
    input.startedAt = validTimestamp(input.startedAt);
    input.completedAt = validTimestamp(input.completedAt);
    input.savedAt = validTimestamp(input.savedAt);
    input.timeline = (Array.isArray(input.timeline) ? input.timeline : []).slice(0, 10000)
      .filter(isObject)
      .map((item, index) => ({
        order: nonNegativeInteger(item.order) || index + 1,
        day: clamp(nonNegativeInteger(item.day), 0, 9999),
        sceneId: safeText(item.sceneId, 160) || null,
        title: safeText(item.title, 160) || null,
        choiceIndex: Number(item.choiceIndex) === 0 ? 0 : (Number(item.choiceIndex) === 1 ? 1 : null),
        choice: safeText(item.choice, 300) || null,
        kind: safeText(item.kind, 40) || null,
        consumedByPlayer: item.consumedByPlayer === true,
        refused: item.refused === true,
        hpBefore: finiteNumber(item.hpBefore, 0),
        hpAfter: finiteNumber(item.hpAfter, 0),
        hungerBefore: finiteNumber(item.hungerBefore, 0),
        hungerAfter: finiteNumber(item.hungerAfter, 0),
        result: safeText(item.result, 1000) || null,
        resultId: safeText(item.resultId, 160) || null
      }));
    input.timelineCompacted = input.timelineCompacted === true;
    input.timelineChoiceCount = Math.max(nonNegativeInteger(input.timelineChoiceCount), input.totalChoices);
    input.fateCode = encodeFateCode({
      gameVersion: input.gameVersion,
      mode: input.mode,
      seed: input.seed,
      choices: input.choices
    });
    return input;
  }

  function normalizeHistory(raw) {
    const input = Array.isArray(raw) ? raw : [];
    const seen = new Set();
    const output = [];
    for (const item of input) {
      const entry = normalizeHistoryEntry(item);
      if (!entry || seen.has(entry.runId)) continue;
      seen.add(entry.runId);
      output.push(entry);
      if (output.length === HISTORY_LIMIT) break;
    }
    return output;
  }

  function normalizeDailyRecord(raw, date) {
    const input = isObject(raw) ? raw : {};
    const attemptReceipts = isObject(input.attemptReceipts) ? input.attemptReceipts : {};
    const completionReceipts = isObject(input.completionReceipts) ? input.completionReceipts : {};
    return {
      date,
      seed: dailySeed(date),
      firstStartedAt: validTimestamp(input.firstStartedAt),
      lastPlayedAt: validTimestamp(input.lastPlayedAt),
      attempts: nonNegativeInteger(input.attempts),
      bestDay: clamp(nonNegativeInteger(input.bestDay), 0, 50),
      cleared: !!input.cleared,
      deathReason: safeText(input.deathReason, 120) || null,
      choiceCount: nonNegativeInteger(input.choiceCount),
      attemptReceipts: Object.fromEntries(Object.entries(attemptReceipts)
        .map(([key, value]) => [safeText(key, 40), safeText(value, TOKEN_LIMIT)])
        .filter(([key, value]) => key && value)),
      completionReceipts: Object.fromEntries(Object.entries(completionReceipts)
        .map(([key, value]) => [safeText(key, 40), safeText(value, TOKEN_LIMIT)])
        .filter(([key, value]) => key && value))
    };
  }

  function normalizeDailyRecords(raw) {
    const input = isObject(raw) ? raw : {};
    const output = {};
    for (const [rawDate, record] of Object.entries(input)) {
      try {
        const date = normalizeDateString(rawDate);
        output[date] = normalizeDailyRecord(record, date);
      } catch (_) {}
    }
    return output;
  }

  function freshWorkspace() {
    return {
      version: WORKSPACE_VERSION,
      slots: Array.from({ length: SLOT_COUNT }, (_, index) => freshSlot(index + 1)),
      activeSlotId: null,
      migrations: { singleRunToSlot1: false, migratedAt: null },
      codex: freshCodex(),
      history: [],
      dailyRecords: {}
    };
  }

  function slotsFromInput(rawSlots) {
    const byId = new Map();
    if (Array.isArray(rawSlots)) {
      for (const value of rawSlots) {
        if (!isObject(value)) continue;
        const id = normalizeSlotId(value.id);
        if (id) byId.set(id, value);
      }
    } else if (isObject(rawSlots)) {
      for (const [key, value] of Object.entries(rawSlots)) {
        const id = normalizeSlotId(key) || (isObject(value) && normalizeSlotId(value.id));
        if (id) byId.set(id, value);
      }
    }
    return Array.from({ length: SLOT_COUNT }, (_, index) => {
      const id = `slot-${index + 1}`;
      return normalizeSlot(byId.get(id), index + 1);
    });
  }

  function normalizeWorkspace(raw) {
    const input = isObject(raw) ? raw : {};
    const migrations = isObject(input.migrations) ? input.migrations : {};
    const output = {
      version: WORKSPACE_VERSION,
      slots: slotsFromInput(input.slots),
      activeSlotId: normalizeSlotId(input.activeSlotId || input.activeSlot),
      migrations: {
        singleRunToSlot1: migrations.singleRunToSlot1 === true || input.legacyMigrated === true,
        migratedAt: validTimestamp(migrations.migratedAt)
      },
      codex: normalizeCodex(input.codex || input.compendium),
      history: normalizeHistory(input.history || input.runHistory),
      dailyRecords: normalizeDailyRecords(input.dailyRecords || input.daily)
    };
    if (output.activeSlotId && !output.slots.find(slot => slot.id === output.activeSlotId && slot.run)) {
      output.activeSlotId = null;
    }
    return output;
  }

  function slotIndex(workspace, id) {
    const normalizedId = normalizeSlotId(id);
    if (!normalizedId) throw new Error('Unknown save slot');
    const index = workspace.slots.findIndex(slot => slot.id === normalizedId);
    if (index < 0) throw new Error('Unknown save slot');
    return index;
  }

  function setSlot(rawWorkspace, id, run, options = {}) {
    if (!isObject(run)) throw new Error('A save slot requires a run object');
    const workspace = normalizeWorkspace(rawWorkspace);
    const index = slotIndex(workspace, id);
    const previous = workspace.slots[index];
    const timestamp = validTimestamp(options.timestamp) || validTimestamp(run.lastPlayedAt);
    const storedRun = clone(run);
    if (isObject(storedRun.recording)) storedRun.recording.slotId = previous.id;
    workspace.slots[index] = {
      id: previous.id,
      name: safeText(options.name, SLOT_NAME_LIMIT) || previous.name,
      run: storedRun,
      createdAt: previous.createdAt || timestamp,
      updatedAt: timestamp
    };
    if (options.activate !== false) workspace.activeSlotId = previous.id;
    return workspace;
  }

  function renameSlot(rawWorkspace, id, name) {
    const workspace = normalizeWorkspace(rawWorkspace);
    const index = slotIndex(workspace, id);
    const normalizedName = safeText(name, SLOT_NAME_LIMIT);
    if (!normalizedName) throw new Error('Slot name must not be empty');
    workspace.slots[index].name = normalizedName;
    return workspace;
  }

  function deleteSlot(rawWorkspace, id) {
    const workspace = normalizeWorkspace(rawWorkspace);
    const index = slotIndex(workspace, id);
    const previous = workspace.slots[index];
    workspace.slots[index] = {
      ...freshSlot(index + 1),
      name: previous.name
    };
    if (workspace.activeSlotId === previous.id) workspace.activeSlotId = null;
    return workspace;
  }

  function duplicateSlot(rawWorkspace, sourceId, targetId, options = {}) {
    const workspace = normalizeWorkspace(rawWorkspace);
    const sourceIndex = slotIndex(workspace, sourceId);
    const targetIndex = slotIndex(workspace, targetId);
    const source = workspace.slots[sourceIndex];
    if (!source.run) throw new Error('The source slot is empty');
    const target = workspace.slots[targetIndex];
    const timestamp = validTimestamp(options.timestamp) || source.updatedAt;
    const copiedRun = clone(source.run);
    if (isObject(copiedRun.recording)) copiedRun.recording.slotId = target.id;
    workspace.slots[targetIndex] = {
      id: target.id,
      name: safeText(options.name, SLOT_NAME_LIMIT) || `${source.name} の複製`.slice(0, SLOT_NAME_LIMIT),
      run: copiedRun,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    if (options.activate === true) workspace.activeSlotId = target.id;
    return workspace;
  }

  function setActiveSlot(rawWorkspace, id) {
    const workspace = normalizeWorkspace(rawWorkspace);
    if (id === null || id === undefined || id === '') {
      workspace.activeSlotId = null;
      return workspace;
    }
    const index = slotIndex(workspace, id);
    if (!workspace.slots[index].run) throw new Error('The active slot is empty');
    workspace.activeSlotId = workspace.slots[index].id;
    return workspace;
  }

  function activeMirror(rawWorkspace) {
    const workspace = normalizeWorkspace(rawWorkspace);
    if (!workspace.activeSlotId) return null;
    const slot = workspace.slots.find(item => item.id === workspace.activeSlotId);
    return slot && slot.run ? clone(slot.run) : null;
  }

  function companionNames(run) {
    const companions = isObject(run && run.companions) ? run.companions : {};
    const labels = { tako: '寄生タコ', jr: 'Jr.', beanChild: '黒豆', clone: 'もう一人' };
    const output = Object.keys(labels).filter(key => companions[key]).map(key => labels[key]);
    if (run && run.flags && run.flags.shadowAwake) output.push('影');
    return output;
  }

  function slotSummary(rawSlot) {
    const id = normalizeSlotId(rawSlot && rawSlot.id) || 'slot-1';
    const index = Number(id.slice(-1));
    const slot = normalizeSlot(rawSlot, index);
    if (!slot.run) return { id: slot.id, name: slot.name, empty: true };
    const run = slot.run;
    return {
      id: slot.id,
      name: slot.name,
      empty: false,
      mode: normalizeMode(run.mode),
      day: clamp(nonNegativeInteger(run.day || 1), 0, 9999),
      hp: finiteNumber(run.hp, 0),
      hunger: finiteNumber(run.hunger, 0),
      seed: normalizeSeed(run.seed),
      scene: safeText(isObject(run.survival) && run.survival.currentEventId || run.scene, 160) || null,
      companions: companionNames(run),
      lastPlayedAt: slot.updatedAt || validTimestamp(run.lastPlayedAt),
      ended: !!run.ended,
      runVersion: nonNegativeInteger(run.version)
    };
  }

  function migrateLegacyRun(rawWorkspace, legacyRun, timestamp = null) {
    const workspace = normalizeWorkspace(rawWorkspace);
    if (workspace.migrations.singleRunToSlot1) return { workspace, migrated: false, reason: 'already-migrated' };
    workspace.migrations.singleRunToSlot1 = true;
    workspace.migrations.migratedAt = validTimestamp(timestamp);
    if (!isObject(legacyRun)) return { workspace, migrated: false, reason: 'no-run' };
    if (workspace.slots[0].run) return { workspace, migrated: false, reason: 'slot-1-occupied' };
    const migrated = setSlot(workspace, 'slot-1', legacyRun, { timestamp, activate: true });
    migrated.migrations = clone(workspace.migrations);
    return { workspace: migrated, migrated: true, reason: 'migrated' };
  }

  function normalizeChoices(raw) {
    if (!Array.isArray(raw)) return [];
    if (raw.length > 10000) throw new Error('Choice sequence is too long');
    return raw.map(value => {
      const number = Number(value);
      if (number !== 0 && number !== 1) throw new Error('Every explicit choice must be 0 or 1');
      return number;
    });
  }

  function makeRunId(raw) {
    const input = isObject(raw) ? raw : {};
    const identity = {
      mode: normalizeMode(input.mode),
      seed: normalizeSeed(input.seed),
      startedAt: validTimestamp(input.startedAt),
      endingCode: safeText(input.endingCode || (isObject(input.ending) && input.ending.code), 120) || null,
      choices: normalizeChoices(input.choices || input.choiceSequence || [])
    };
    return `run-${hashToken(stableStringify(identity))}`;
  }

  function makeRunResult(run, details = {}) {
    if (!isObject(run)) throw new Error('A completed run is required');
    const choices = normalizeChoices(details.choices || details.choiceSequence || []);
    const ending = isObject(run.ending) ? clone(run.ending) : null;
    const endingCode = safeText(details.endingCode || (ending && ending.code), 120) || null;
    const completedAt = validTimestamp(details.completedAt);
    const base = {
      gameVersion: safeText(details.gameVersion || VERSION, 40),
      mode: normalizeMode(run.mode),
      seed: normalizeSeed(run.seed),
      startedAt: validTimestamp(run.startedAt),
      completedAt,
      savedAt: validTimestamp(details.savedAt) || completedAt,
      day: clamp(nonNegativeInteger(run.day || 1), 0, 9999),
      ending,
      endingCode,
      title: safeText(details.title || (ending && ending.title), 160) || null,
      hp: finiteNumber(run.hp, 0),
      hunger: finiteNumber(run.hunger, 0),
      totalChoices: nonNegativeInteger(run.choiceCount || choices.length),
      consumed: nonNegativeInteger(run.stats && run.stats.ate),
      refused: nonNegativeInteger(run.stats && run.stats.skipped),
      companions: clone(isObject(run.companions) ? run.companions : {}),
      memories: clone(isObject(run.memories) ? run.memories : {}),
      beanRoute: run.flags && run.flags.beanPossessed ? 'body' : (safeText(run.flags && run.flags.beanSoil, 20) || null),
      rareEncounters: clone(Array.isArray(details.rareEncounters) ? details.rareEncounters : []),
      milestones: clone(details.milestones || (run.survival && run.survival.milestoneSuccess) || {}),
      finalDish: safeText(details.finalDish || (run.flags && run.flags.selectedTrueDish), 80) || null,
      finalBox: safeText(details.finalBox || (run.survival && run.survival.finalBox), 80) || null,
      broughtHome: safeText(details.broughtHome || (run.survival && run.survival.broughtHome), 160) || null,
      unlockedAchievements: uniqueStrings(details.unlockedAchievements),
      choices,
      timeline: clone(Array.isArray(details.timeline) ? details.timeline : [])
    };
    base.runId = safeText(details.runId, 80) || makeRunId(base);
    base.fateCode = encodeFateCode({
      gameVersion: base.gameVersion,
      mode: base.mode,
      seed: base.seed,
      choices: base.choices
    });
    return normalizeHistoryEntry(base);
  }

  function addRunHistory(rawHistory, rawResult) {
    const history = normalizeHistory(rawHistory);
    const result = normalizeHistoryEntry(rawResult);
    if (!result) throw new Error('A run result is required');
    if (history.some(entry => entry.runId === result.runId)) {
      return { history, added: false, runId: result.runId };
    }
    return {
      history: [result, ...history].slice(0, HISTORY_LIMIT),
      added: true,
      runId: result.runId
    };
  }

  function categoryName(value) {
    return CATEGORY_ALIASES[value] || null;
  }

  function findReceipt(receipts, value) {
    const base = hashToken(value);
    if (!hasOwn(receipts, base) || receipts[base] === value) return base;
    let suffix = 1;
    while (hasOwn(receipts, `${base}-${suffix}`) && receipts[`${base}-${suffix}`] !== value) suffix += 1;
    return `${base}-${suffix}`;
  }

  function recordCodex(rawCodex, observation) {
    const codex = normalizeCodex(rawCodex);
    const input = isObject(observation) ? observation : {};
    if (input.source !== 'play' || input.committed !== true) {
      return { codex, recorded: false, reason: 'not-committed-play' };
    }
    const category = categoryName(input.category);
    const id = safeIdentifier(input.id);
    const phase = input.phase === 'choice' ? 'choice' : (input.phase === 'encounter' ? 'encounter' : null);
    const token = safeText(input.token, TOKEN_LIMIT);
    if (!category || !id || !phase || !token) return { codex, recorded: false, reason: 'invalid-observation' };
    const receipt = `${phase}|${category}|${id}|${token}`;
    const receiptKey = findReceipt(codex.receipts, receipt);
    if (codex.receipts[receiptKey] === receipt) return { codex, recorded: false, reason: 'duplicate' };

    const existing = codex.categories[category][id] || normalizeCodexEntry({}, id);
    const entry = normalizeCodexEntry(existing, id);
    const occurredAt = validTimestamp(input.occurredAt);
    entry.discovered = true;
    entry.name = safeText(input.name, 120) || entry.name;
    entry.hidden = typeof input.hidden === 'boolean' ? input.hidden : entry.hidden;
    entry.emoji = safeText(input.emoji, 16) || entry.emoji;
    if (occurredAt) {
      if (!entry.firstEncounteredAt || Date.parse(occurredAt) < Date.parse(entry.firstEncounteredAt)) entry.firstEncounteredAt = occurredAt;
      if (!entry.lastEncounteredAt || Date.parse(occurredAt) > Date.parse(entry.lastEncounteredAt)) entry.lastEncounteredAt = occurredAt;
    }
    if (MODES.includes(input.mode) && !entry.modes.includes(input.mode)) {
      entry.modes.push(input.mode);
      entry.modes.sort((left, right) => MODE_ORDER.get(left) - MODE_ORDER.get(right));
    }
    const assetIds = Array.isArray(input.assetIds) ? input.assetIds : [input.assetId];
    entry.assetIds = uniqueStrings([...entry.assetIds, ...assetIds]);
    const resultIds = Array.isArray(input.resultIds) ? input.resultIds : [input.resultId];
    entry.resultIds = uniqueStrings([...entry.resultIds, ...resultIds]);
    if (phase === 'encounter') entry.encounterCount += 1;
    if (phase === 'choice') {
      if (Number(input.choiceIndex) === 0) entry.choiceA += 1;
      else if (Number(input.choiceIndex) === 1) entry.choiceB += 1;
      if (input.consumedByPlayer === true) entry.consumedCount += 1;
      if (input.refused === true || input.choiceKind === 'skip') entry.refusedCount += 1;
    }
    codex.categories[category][id] = entry;
    codex.receipts[receiptKey] = receipt;
    return { codex, recorded: true, reason: 'recorded', category, id };
  }

  function codexCounts(rawCodex) {
    const codex = normalizeCodex(rawCodex);
    const categories = {};
    let total = 0;
    for (const category of CODEX_CATEGORIES) {
      const discovered = Object.values(codex.categories[category]).filter(entry => entry.discovered).length;
      categories[category] = discovered;
      total += discovered;
    }
    return { total, categories };
  }

  function describeCodexEntry(definition, rawRecord) {
    const item = isObject(definition) ? definition : {};
    const id = safeIdentifier(item.id);
    const record = rawRecord ? normalizeCodexEntry(rawRecord, id) : null;
    const discovered = !!(record && record.discovered);
    if (!discovered) {
      return {
        id,
        discovered: false,
        hidden: !!item.hidden,
        name: '???',
        description: '???',
        condition: null,
        assetId: null,
        emoji: '❔',
        silhouette: true,
        record: null
      };
    }
    return {
      id,
      discovered: true,
      hidden: !!item.hidden,
      name: safeText(item.name, 120) || record.name || id,
      description: safeText(item.description, 500),
      condition: safeText(item.condition, 300) || null,
      assetId: safeText(item.assetId) || record.assetIds[0] || null,
      emoji: safeText(item.emoji, 16) || record.emoji || '📖',
      silhouette: false,
      record
    };
  }

  function utf8Bytes(text) {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(text);
    const encoded = unescape(encodeURIComponent(text));
    return Uint8Array.from(encoded, character => character.charCodeAt(0));
  }

  function utf8Text(bytes) {
    if (typeof TextDecoder === 'function') return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    let encoded = '';
    for (const value of bytes) encoded += String.fromCharCode(value);
    return decodeURIComponent(escape(encoded));
  }

  function bytesToBase64Url(bytes) {
    let output = '';
    for (let index = 0; index < bytes.length; index += 3) {
      const first = bytes[index];
      const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
      const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
      output += BASE64URL_ALPHABET[first >>> 2];
      output += BASE64URL_ALPHABET[((first & 3) << 4) | (second >>> 4)];
      if (index + 1 < bytes.length) output += BASE64URL_ALPHABET[((second & 15) << 2) | (third >>> 6)];
      if (index + 2 < bytes.length) output += BASE64URL_ALPHABET[third & 63];
    }
    return output;
  }

  function base64UrlToBytes(text) {
    const value = String(text || '');
    if (!value || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) throw new Error('Invalid fate code encoding');
    const bytes = [];
    let buffer = 0;
    let bits = 0;
    for (const character of value) {
      const index = BASE64URL_ALPHABET.indexOf(character);
      if (index < 0) throw new Error('Invalid fate code encoding');
      buffer = (buffer << 6) | index;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        bytes.push((buffer >>> bits) & 0xff);
      }
    }
    return Uint8Array.from(bytes);
  }

  function normalizeFatePayload(raw) {
    const input = isObject(raw) ? raw : {};
    if (input.format && input.format !== FATE_FORMAT) throw new Error('Unknown fate code format');
    if (input.formatVersion !== undefined && Number(input.formatVersion) !== FATE_VERSION) throw new Error('Unsupported fate code version');
    if (!MODES.includes(input.mode)) throw new Error('Unknown game mode in fate code');
    const gameVersion = safeText(input.gameVersion || input.appVersion, 40);
    if (!gameVersion) throw new Error('Fate code requires a game version');
    const seedNumber = Number(input.seed);
    if (!Number.isInteger(seedNumber) || seedNumber < 0 || seedNumber > 0xffffffff) throw new Error('Fate code requires a uint32 seed');
    return {
      format: FATE_FORMAT,
      formatVersion: FATE_VERSION,
      gameVersion,
      mode: input.mode,
      seed: seedNumber >>> 0,
      choices: normalizeChoices(input.choices || input.choiceSequence || [])
    };
  }

  function encodeFateCode(raw) {
    const payload = normalizeFatePayload(raw);
    return `${FATE_PREFIX}${bytesToBase64Url(utf8Bytes(stableStringify(payload)))}`;
  }

  function decodeFateCode(code) {
    const text = String(code || '').trim();
    if (!text.startsWith(FATE_PREFIX)) throw new Error('This is not a supported fate code');
    let parsed;
    try {
      parsed = JSON.parse(utf8Text(base64UrlToBytes(text.slice(FATE_PREFIX.length))));
    } catch (error) {
      throw new Error(`Could not decode fate code: ${error && error.message ? error.message : error}`);
    }
    return normalizeFatePayload(parsed);
  }

  function previewFateCode(code) {
    const value = decodeFateCode(code);
    return {
      valid: true,
      gameVersion: value.gameVersion,
      mode: value.mode,
      seed: value.seed,
      choiceCount: value.choices.length,
      choices: value.choices.slice()
    };
  }

  function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function normalizeDateString(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) throw new Error('Daily date must use YYYY-MM-DD');
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) throw new Error('Daily date is invalid');
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  function jstDateString(instant) {
    if (typeof instant === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(instant)) return normalizeDateString(instant);
    const milliseconds = instant instanceof Date ? instant.getTime() : (typeof instant === 'number' ? instant : Date.parse(instant));
    if (!Number.isFinite(milliseconds)) throw new Error('A valid instant is required');
    const jst = new Date(milliseconds + 9 * 60 * 60 * 1000);
    const year = String(jst.getUTCFullYear()).padStart(4, '0');
    const month = String(jst.getUTCMonth() + 1).padStart(2, '0');
    const day = String(jst.getUTCDate()).padStart(2, '0');
    return normalizeDateString(`${year}-${month}-${day}`);
  }

  function dailySeed(dateOrInstant) {
    const date = typeof dateOrInstant === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOrInstant)
      ? normalizeDateString(dateOrInstant)
      : jstDateString(dateOrInstant);
    const seed = fnv1a32(`tabenai-daily:${DAILY_ALGORITHM}:${date}`);
    return seed || 0x6d2b79f5;
  }

  function dailyInfo(dateOrInstant) {
    const date = typeof dateOrInstant === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOrInstant)
      ? normalizeDateString(dateOrInstant)
      : jstDateString(dateOrInstant);
    return { date, seed: dailySeed(date), mode: 'survival', algorithm: DAILY_ALGORITHM };
  }

  function updateDailyRecord(rawRecords, update) {
    const records = normalizeDailyRecords(rawRecords);
    const input = isObject(update) ? update : {};
    const date = input.date ? normalizeDateString(input.date) : jstDateString(input.instant);
    const record = records[date] || normalizeDailyRecord({}, date);
    let updated = false;
    let duplicate = false;
    const playedAt = validTimestamp(input.playedAt || input.startedAt || input.completedAt);
    const attemptId = safeText(input.attemptId, TOKEN_LIMIT);
    if (input.started === true) {
      if (!attemptId) throw new Error('A daily attempt requires a stable attemptId');
      const receipt = `attempt|${date}|${attemptId}`;
      const receiptKey = findReceipt(record.attemptReceipts, receipt);
      if (record.attemptReceipts[receiptKey] === receipt) duplicate = true;
      else {
        record.attemptReceipts[receiptKey] = receipt;
        record.attempts += 1;
        record.firstStartedAt = record.firstStartedAt || playedAt;
        updated = true;
      }
    }
    if (Number.isFinite(Number(input.day))) {
      const bestDay = clamp(nonNegativeInteger(input.day), 0, 50);
      if (bestDay > record.bestDay) { record.bestDay = bestDay; updated = true; }
    }
    if (Number.isFinite(Number(input.choiceCount))) {
      const choiceCount = nonNegativeInteger(input.choiceCount);
      if (choiceCount > record.choiceCount) { record.choiceCount = choiceCount; updated = true; }
    }
    if (input.completed === true) {
      const runId = safeText(input.runId, TOKEN_LIMIT);
      if (!runId) throw new Error('A completed daily attempt requires a runId');
      const receipt = `complete|${date}|${runId}`;
      const receiptKey = findReceipt(record.completionReceipts, receipt);
      if (record.completionReceipts[receiptKey] === receipt) duplicate = true;
      else {
        record.completionReceipts[receiptKey] = receipt;
        if (input.cleared === true) record.cleared = true;
        const reason = safeText(input.deathReason, 120);
        if (reason) record.deathReason = reason;
        updated = true;
      }
    }
    if (playedAt && playedAt !== record.lastPlayedAt) { record.lastPlayedAt = playedAt; updated = true; }
    records[date] = record;
    return { records, record: clone(record), updated, duplicate };
  }

  function normalizeTransfer(payload) {
    if (!isObject(payload) || payload.format !== FORMAT) throw new Error('This is not a tabenai save');
    const formatVersion = payload.formatVersion === undefined ? 1 : Number(payload.formatVersion);
    if (![1, 2, 3].includes(formatVersion)) throw new Error('Unsupported save transfer version');
    const persistent = {
      meta: clone(isObject(payload.meta) ? payload.meta : {}),
      endings: clone(isObject(payload.endings) ? payload.endings : {})
    };
    if (formatVersion < 3) {
      const run = isObject(payload.run) ? payload.run : (isObject(payload.state) ? payload.state : null);
      if (!run) throw new Error('Legacy save has no run');
      let workspace = freshWorkspace();
      workspace = setSlot(workspace, 'slot-1', run, {
        timestamp: validTimestamp(run.lastPlayedAt) || validTimestamp(payload.exportedAt),
        activate: true
      });
      workspace.migrations.singleRunToSlot1 = true;
      workspace.migrations.migratedAt = validTimestamp(payload.exportedAt);
      return {
        formatVersion,
        appVersion: safeText(payload.appVersion, 40) || null,
        exportedAt: validTimestamp(payload.exportedAt),
        scope: 'legacy-single',
        workspace,
        ...persistent
      };
    }
    const workspaceSource = isObject(payload.workspace) ? payload.workspace : {
      slots: payload.slots,
      activeSlotId: payload.activeSlotId || payload.activeSlot,
      migrations: payload.migrations,
      codex: payload.codex || payload.compendium,
      history: payload.history || payload.runHistory,
      dailyRecords: payload.dailyRecords || payload.daily
    };
    const workspace = normalizeWorkspace(workspaceSource);
    if (!workspace.slots.some(slot => slot.run) && isObject(payload.run || payload.state)) {
      const fallbackId = normalizeSlotId(payload.activeSlotId) || 'slot-1';
      const repaired = setSlot(workspace, fallbackId, payload.run || payload.state, {
        timestamp: validTimestamp(payload.exportedAt),
        activate: true
      });
      return {
        formatVersion,
        appVersion: safeText(payload.appVersion, 40) || null,
        exportedAt: validTimestamp(payload.exportedAt),
        scope: payload.scope === 'slot' ? 'slot' : 'all',
        workspace: repaired,
        ...persistent
      };
    }
    return {
      formatVersion,
      appVersion: safeText(payload.appVersion, 40) || null,
      exportedAt: validTimestamp(payload.exportedAt),
      scope: payload.scope === 'slot' ? 'slot' : 'all',
      workspace,
      ...persistent
    };
  }

  function makeTransferPayload(rawWorkspace, options = {}) {
    const workspace = normalizeWorkspace(rawWorkspace);
    const requestedSlot = options.slotId ? normalizeSlotId(options.slotId) : null;
    if (options.slotId && !requestedSlot) throw new Error('Unknown save slot');
    const scope = requestedSlot ? 'slot' : 'all';
    const slots = requestedSlot
      ? workspace.slots.filter(slot => slot.id === requestedSlot && slot.run)
      : workspace.slots;
    if (requestedSlot && slots.length === 0) throw new Error('The selected slot is empty');
    const activeSlotId = requestedSlot || workspace.activeSlotId;
    const mirrorSlot = slots.find(slot => slot.id === activeSlotId) || slots.find(slot => slot.run);
    const mirror = mirrorSlot && mirrorSlot.run ? clone(mirrorSlot.run) : null;
    return {
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      appVersion: safeText(options.appVersion || VERSION, 40),
      exportedAt: validTimestamp(options.exportedAt),
      scope,
      slots: clone(slots),
      activeSlotId: activeSlotId || null,
      migrations: clone(workspace.migrations),
      meta: clone(isObject(options.meta) ? options.meta : {}),
      endings: clone(isObject(options.endings) ? options.endings : {}),
      codex: clone(workspace.codex),
      history: clone(workspace.history),
      dailyRecords: clone(workspace.dailyRecords),
      run: mirror,
      state: mirror
    };
  }

  function previewTransfer(payload, options = {}) {
    const normalized = normalizeTransfer(payload);
    const current = normalizeWorkspace(options.currentWorkspace);
    const targetSlotId = normalized.formatVersion < 3 ? 'slot-1' : normalizeSlotId(options.targetSlotId);
    const sourceSlots = normalized.workspace.slots.filter(slot => slot.run);
    const targets = [];
    if (targetSlotId && sourceSlots.length === 1) targets.push(targetSlotId);
    else if (normalized.scope === 'all') targets.push(...normalized.workspace.slots.map(slot => slot.id));
    else for (const slot of sourceSlots) targets.push(slot.id);
    const overwriteSlotIds = targets.filter(id => {
      const slot = current.slots.find(item => item.id === id);
      return !!(slot && slot.run);
    });
    return {
      valid: true,
      formatVersion: normalized.formatVersion,
      appVersion: normalized.appVersion,
      scope: normalized.scope,
      slots: sourceSlots.map(slotSummary),
      activeSlotId: normalized.workspace.activeSlotId,
      targetSlotId: targetSlotId || null,
      overwriteSlotIds,
      codexCount: codexCounts(normalized.workspace.codex).total,
      historyCount: normalized.workspace.history.length,
      dailyCount: Object.keys(normalized.workspace.dailyRecords).length
    };
  }

  function applyTransfer(rawWorkspace, payload, options = {}) {
    const current = normalizeWorkspace(rawWorkspace);
    const imported = normalizeTransfer(payload);
    const sourceSlots = imported.workspace.slots.filter(slot => slot.run);
    const targetSlotId = imported.formatVersion < 3 ? 'slot-1' : normalizeSlotId(options.targetSlotId);
    if (targetSlotId) {
      if (sourceSlots.length !== 1) throw new Error('A target slot requires a single-slot transfer');
      const source = sourceSlots[0];
      const timestamp = source.updatedAt || imported.exportedAt;
      let workspace = setSlot(current, targetSlotId, source.run, {
        timestamp,
        name: options.keepTargetName ? undefined : source.name,
        activate: true
      });
      workspace.codex = imported.workspace.codex;
      workspace.history = imported.workspace.history;
      workspace.dailyRecords = imported.workspace.dailyRecords;
      return { workspace, meta: imported.meta, endings: imported.endings, formatVersion: imported.formatVersion };
    }
    return { workspace: imported.workspace, meta: imported.meta, endings: imported.endings, formatVersion: imported.formatVersion };
  }

  function parseStoredJson(text, fallback) {
    if (typeof text !== 'string' || !text.trim()) return { value: clone(fallback), valid: true, empty: true, error: null };
    try {
      return { value: JSON.parse(text), valid: true, empty: false, error: null };
    } catch (error) {
      return { value: clone(fallback), valid: false, empty: false, error: error && error.message ? error.message : String(error) };
    }
  }

  function encodeStorage(rawWorkspace) {
    const workspace = normalizeWorkspace(rawWorkspace);
    const slotsStore = {
      version: WORKSPACE_VERSION,
      slots: workspace.slots,
      migrations: workspace.migrations
    };
    const mirror = activeMirror(workspace);
    return {
      [STORAGE_KEYS.slots]: JSON.stringify(slotsStore),
      [STORAGE_KEYS.activeSlot]: workspace.activeSlotId || '',
      [STORAGE_KEYS.history]: JSON.stringify(workspace.history),
      [STORAGE_KEYS.codex]: JSON.stringify(workspace.codex),
      [STORAGE_KEYS.daily]: JSON.stringify(workspace.dailyRecords),
      [STORAGE_KEYS.migrationMarker]: workspace.migrations.singleRunToSlot1 ? '1' : '0',
      [STORAGE_KEYS.legacyRun]: mirror ? JSON.stringify(mirror) : null
    };
  }

  function decodeStorage(records) {
    const input = isObject(records) ? records : {};
    const warnings = [];
    const read = (key, fallback) => {
      const parsed = parseStoredJson(input[key], fallback);
      if (!parsed.valid) warnings.push({ key, error: parsed.error });
      return parsed.value;
    };
    const slotsStore = read(STORAGE_KEYS.slots, {});
    const history = read(STORAGE_KEYS.history, []);
    const codex = read(STORAGE_KEYS.codex, freshCodex());
    const dailyRecords = read(STORAGE_KEYS.daily, {});
    const marker = input[STORAGE_KEYS.migrationMarker] === '1'
      || (isObject(slotsStore.migrations) && slotsStore.migrations.singleRunToSlot1 === true);
    const normalizePart = (key, operation, fallback) => {
      try {
        return operation();
      } catch (error) {
        warnings.push({
          key,
          error: error && error.message ? `invalid data: ${error.message}` : 'invalid data'
        });
        return clone(fallback);
      }
    };
    // Each collection is an independent recovery boundary. A semantically corrupt
    // history entry, for example, must not discard healthy slots, codex, or daily data.
    const fallback = freshWorkspace();
    const normalizedSlots = normalizePart(STORAGE_KEYS.slots, () => slotsFromInput(slotsStore.slots), fallback.slots);
    const normalizedCodex = normalizePart(STORAGE_KEYS.codex, () => normalizeCodex(codex), fallback.codex);
    const normalizedHistory = (() => {
      const inputHistory = Array.isArray(history) ? history : [];
      const seen = new Set();
      const output = [];
      let invalidEntries = 0;
      for (const item of inputHistory) {
        try {
          const entry = normalizeHistoryEntry(item);
          if (!entry || seen.has(entry.runId)) continue;
          seen.add(entry.runId);
          output.push(entry);
          if (output.length === HISTORY_LIMIT) break;
        } catch (_) {
          invalidEntries += 1;
        }
      }
      if (invalidEntries) warnings.push({
        key: STORAGE_KEYS.history,
        error: `${invalidEntries} invalid history entr${invalidEntries === 1 ? 'y' : 'ies'} skipped`
      });
      return output;
    })();
    const normalizedDaily = normalizePart(STORAGE_KEYS.daily, () => normalizeDailyRecords(dailyRecords), fallback.dailyRecords);
    const activeSlotId = normalizeSlotId(input[STORAGE_KEYS.activeSlot]);
    const workspace = {
      version: WORKSPACE_VERSION,
      slots: normalizedSlots,
      activeSlotId: activeSlotId && normalizedSlots.some(slot => slot.id === activeSlotId && slot.run) ? activeSlotId : null,
      migrations: {
        singleRunToSlot1: marker,
        migratedAt: validTimestamp(isObject(slotsStore.migrations) && slotsStore.migrations.migratedAt)
      },
      codex: normalizedCodex,
      history: normalizedHistory,
      dailyRecords: normalizedDaily
    };
    return { workspace, warnings };
  }

  function estimateBytes(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).byteLength;
    return unescape(encodeURIComponent(text)).length;
  }

  function estimateStorageBytes(records) {
    const input = isObject(records) ? records : {};
    return Object.entries(input).reduce((total, [key, value]) => {
      if (value === null || value === undefined) return total;
      return total + estimateBytes(key) + estimateBytes(String(value));
    }, 0);
  }

  function compactForQuota(rawWorkspace, maxBytes) {
    const limit = Math.max(0, Math.floor(Number(maxBytes) || 0));
    const workspace = normalizeWorkspace(rawWorkspace);
    let bytes = estimateStorageBytes(encodeStorage(workspace));
    if (bytes <= limit) return { workspace, fits: true, stage: 'none', bytes, compactedTimelines: 0, removedHistory: 0 };
    let compactedTimelines = 0;
    for (let index = workspace.history.length - 1; index >= 0 && bytes > limit; index -= 1) {
      const entry = workspace.history[index];
      const count = Array.isArray(entry.timeline) ? entry.timeline.length : 0;
      if (!count && !Array.isArray(entry.choiceTimeline) && !Array.isArray(entry.log)) continue;
      entry.timeline = [];
      delete entry.choiceTimeline;
      delete entry.log;
      entry.timelineCompacted = true;
      entry.timelineChoiceCount = Math.max(nonNegativeInteger(entry.totalChoices), count);
      compactedTimelines += 1;
      bytes = estimateStorageBytes(encodeStorage(workspace));
    }
    let removedHistory = 0;
    while (workspace.history.length && bytes > limit) {
      workspace.history.pop();
      removedHistory += 1;
      bytes = estimateStorageBytes(encodeStorage(workspace));
    }
    return {
      workspace,
      fits: bytes <= limit,
      stage: removedHistory ? 'history-trimmed' : (compactedTimelines ? 'timelines-compacted' : 'unresolved'),
      bytes,
      compactedTimelines,
      removedHistory
    };
  }

  globalThis.TabenaiRecords = Object.freeze({
    version: VERSION,
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    workspaceVersion: WORKSPACE_VERSION,
    slotCount: SLOT_COUNT,
    historyLimit: HISTORY_LIMIT,
    storageKeys: STORAGE_KEYS,
    codexCategories: CODEX_CATEGORIES.slice(),
    dailyAlgorithm: DAILY_ALGORITHM,
    clone,
    stableStringify,
    fnv1a32,
    normalizeSlotId,
    freshWorkspace,
    normalizeWorkspace,
    setSlot,
    renameSlot,
    deleteSlot,
    duplicateSlot,
    setActiveSlot,
    activeMirror,
    slotSummary,
    migrateLegacyRun,
    freshCodex,
    normalizeCodex,
    recordCodex,
    codexCounts,
    describeCodexEntry,
    normalizeHistory,
    makeRunId,
    makeRunResult,
    addRunHistory,
    encodeFateCode,
    decodeFateCode,
    previewFateCode,
    jstDateString,
    dailySeed,
    dailyInfo,
    normalizeDailyRecords,
    updateDailyRecord,
    normalizeTransfer,
    makeTransferPayload,
    previewTransfer,
    applyTransfer,
    parseStoredJson,
    encodeStorage,
    decodeStorage,
    estimateBytes,
    estimateStorageBytes,
    compactForQuota
  });
})();
