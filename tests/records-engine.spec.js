import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import '../records-engine.js';

const records = globalThis.TabenaiRecords;
const ISO_A = '2026-08-01T00:00:00.000Z';
const ISO_B = '2026-08-02T00:00:00.000Z';

function run(seed, mode = 'story', overrides = {}) {
  return {
    version: 4,
    mode,
    seed,
    rngState: seed,
    day: 12,
    hp: 76,
    hunger: 44,
    scene: mode === 'survival' ? 'survival' : 'capsule',
    choiceCount: 9,
    ended: false,
    ending: null,
    startedAt: ISO_A,
    lastPlayedAt: ISO_B,
    stats: { ate: 4, skipped: 5 },
    flags: { beanSoil: null, beanPossessed: false, shadowAwake: false },
    companions: { tako: false, jr: false, beanChild: false, clone: false },
    memories: {},
    ...overrides
  };
}

test('記録エンジンは3スロット・formatVersion 3・履歴30件の契約を固定する', () => {
  expect(records.version).toBe('1.0.0-rc.2');
  expect(records.formatVersion).toBe(3);
  expect(records.slotCount).toBe(3);
  expect(records.historyLimit).toBe(30);
  expect(records.storageKeys).toMatchObject({
    slots: 'tabenai-to-shinu-run-slots-v1',
    activeSlot: 'tabenai-to-shinu-active-slot-v1',
    history: 'tabenai-to-shinu-run-history-v1',
    legacyRun: 'tabenai-to-shinu-50days-v4'
  });
  const workspace = records.freshWorkspace();
  expect(workspace.slots.map(slot => [slot.id, slot.name, slot.run])).toEqual([
    ['slot-1', 'スロット 1', null],
    ['slot-2', 'スロット 2', null],
    ['slot-3', 'スロット 3', null]
  ]);
  expect(workspace.activeSlotId).toBeNull();
});

test('3スロットを完全分離し、名前変更・複製・削除・active mirrorを純粋に処理する', () => {
  const original = records.freshWorkspace();
  const story = run(101, 'story');
  const hard = run(202, 'hard', { day: 22 });
  let workspace = records.setSlot(original, 1, story, { timestamp: ISO_A });
  workspace = records.setSlot(workspace, 'slot-2', hard, { timestamp: ISO_B });
  workspace = records.renameSlot(workspace, 2, '慎重な運命');
  workspace = records.duplicateSlot(workspace, 2, 3, { timestamp: ISO_B, activate: true });

  expect(original.slots.every(slot => slot.run === null)).toBe(true);
  expect(workspace.slots[0].run.seed).toBe(101);
  expect(workspace.slots[1].run.seed).toBe(202);
  expect(workspace.slots[2].run).toEqual(workspace.slots[1].run);
  expect(workspace.slots[2].run).not.toBe(workspace.slots[1].run);
  expect(workspace.slots[1].name).toBe('慎重な運命');
  expect(workspace.activeSlotId).toBe('slot-3');
  expect(records.activeMirror(workspace)).toEqual(hard);
  expect(records.slotSummary(workspace.slots[1])).toMatchObject({
    mode: 'hard', day: 22, hp: 76, hunger: 44, seed: 202, scene: 'capsule', ended: false, runVersion: 4
  });

  workspace = records.deleteSlot(workspace, 3);
  expect(workspace.slots[2].run).toBeNull();
  expect(workspace.activeSlotId).toBeNull();
  expect(records.activeMirror(workspace)).toBeNull();
});

test('旧単一runはslot 1へ一度だけ移行し、markerが再コピーを防ぐ', () => {
  const legacy = run(4700, 'story');
  const first = records.migrateLegacyRun(records.freshWorkspace(), legacy, ISO_A);
  expect(first.migrated).toBe(true);
  expect(first.workspace.slots[0].run).toEqual(legacy);
  expect(first.workspace.slots[0].run.version).toBe(4);
  expect(first.workspace.activeSlotId).toBe('slot-1');
  expect(first.workspace.migrations).toEqual({ singleRunToSlot1: true, migratedAt: ISO_A });
  expect(records.activeMirror(first.workspace)).toEqual(legacy);

  const second = records.migrateLegacyRun(first.workspace, run(9999), ISO_B);
  expect(second).toMatchObject({ migrated: false, reason: 'already-migrated' });
  expect(second.workspace.slots[0].run.seed).toBe(4700);
});

test('storage recordの分割・復元・破損JSON縮退を扱い、従来キーへactive runをmirrorする', () => {
  let workspace = records.setSlot(records.freshWorkspace(), 1, run(8101), { timestamp: ISO_A });
  workspace = records.setSlot(workspace, 2, run(8102, 'survival'), { timestamp: ISO_B });
  workspace = records.setActiveSlot(workspace, 1);
  workspace.migrations.singleRunToSlot1 = true;
  const encoded = records.encodeStorage(workspace);
  expect(JSON.parse(encoded[records.storageKeys.legacyRun]).seed).toBe(8101);
  expect(encoded[records.storageKeys.activeSlot]).toBe('slot-1');
  expect(encoded[records.storageKeys.migrationMarker]).toBe('1');

  const decoded = records.decodeStorage(encoded);
  expect(decoded.warnings).toEqual([]);
  expect(decoded.workspace.slots[1].run.seed).toBe(8102);
  expect(decoded.workspace.migrations.singleRunToSlot1).toBe(true);

  const corrupted = records.decodeStorage({
    ...encoded,
    [records.storageKeys.history]: '{broken',
    [records.storageKeys.codex]: 'not-json'
  });
  expect(corrupted.workspace.slots[0].run.seed).toBe(8101);
  expect(corrupted.workspace.history).toEqual([]);
  expect(corrupted.workspace.codex.categories.events).toEqual({});
  expect(corrupted.warnings.map(item => item.key)).toEqual([
    records.storageKeys.history,
    records.storageKeys.codex
  ]);

  const healthyBefore = records.makeRunResult(run(8111), {
    runId: 'healthy-before', completedAt: ISO_A, choices: [0]
  });
  const healthyAfter = records.makeRunResult(run(8112), {
    runId: 'healthy-after', completedAt: ISO_B, choices: [1]
  });
  const semanticCorruption = records.decodeStorage({
    ...encoded,
    [records.storageKeys.history]: JSON.stringify([
      healthyBefore,
      { runId: 'bad-history', choices: [2] },
      healthyAfter
    ]),
    [records.storageKeys.codex]: JSON.stringify({
      categories: { events: { 'story:riceball': { discovered: true, encounterCount: 1 } } }
    }),
    [records.storageKeys.daily]: JSON.stringify({
      '2026-08-01': { attempts: 1, bestDay: 9, choiceCount: 8 }
    })
  });
  expect(semanticCorruption.workspace.slots[1].run.seed).toBe(8102);
  expect(semanticCorruption.workspace.history.map(entry => entry.runId)).toEqual(['healthy-before', 'healthy-after']);
  expect(semanticCorruption.workspace.codex.categories.events['story:riceball'].encounterCount).toBe(1);
  expect(semanticCorruption.workspace.dailyRecords['2026-08-01'].bestDay).toBe(9);
  expect(semanticCorruption.warnings.map(item => item.key)).toEqual([records.storageKeys.history]);
});

test('formatVersion 1/2をslot 1へ移行し、formatVersion 3を全体・単一slotで往復する', () => {
  for (const formatVersion of [1, 2]) {
    const payload = {
      format: 'tabenai-save',
      formatVersion,
      exportedAt: ISO_A,
      [formatVersion === 1 ? 'state' : 'run']: run(1000 + formatVersion, 'story', { version: formatVersion }),
      meta: { achievements: { old: { unlockedAt: ISO_A } } }
    };
    const imported = records.normalizeTransfer(payload);
    expect(imported.scope).toBe('legacy-single');
    expect(imported.workspace.slots[0].run.seed).toBe(1000 + formatVersion);
    expect(imported.workspace.activeSlotId).toBe('slot-1');
    expect(imported.workspace.migrations.singleRunToSlot1).toBe(true);
    expect(imported.meta.achievements.old).toBeTruthy();
    let occupied = records.setSlot(records.freshWorkspace(), 1, run(9001), { timestamp: ISO_A });
    occupied = records.setSlot(occupied, 3, run(9003), { timestamp: ISO_A });
    const forcedSlotOne = records.applyTransfer(occupied, payload, { targetSlotId: 'slot-3' });
    expect(forcedSlotOne.workspace.slots[0].run.seed).toBe(1000 + formatVersion);
    expect(forcedSlotOne.workspace.slots[2].run.seed).toBe(9003);
  }

  let workspace = records.setSlot(records.freshWorkspace(), 1, run(3001), { timestamp: ISO_A });
  workspace = records.setSlot(workspace, 2, run(3002, 'survival'), { timestamp: ISO_B });
  const encounter = records.recordCodex(workspace.codex, {
    source: 'play', committed: true, phase: 'encounter', category: 'event', id: 'stored-bread',
    token: 'run-3002:event:1', occurredAt: ISO_B, mode: 'survival'
  });
  workspace.codex = encounter.codex;
  workspace.dailyRecords = records.updateDailyRecord({}, {
    date: '2026-08-01', started: true, attemptId: 'daily-1', startedAt: ISO_A
  }).records;
  const allPayload = records.makeTransferPayload(workspace, {
    appVersion: '4.8.0', exportedAt: ISO_B, meta: { settings: { reducedMotion: true } }, endings: { true: 1 }
  });
  expect(allPayload.formatVersion).toBe(3);
  expect(allPayload.scope).toBe('all');
  expect(allPayload.slots).toHaveLength(3);
  expect(allPayload.run.seed).toBe(3002);
  const roundTrip = records.normalizeTransfer(allPayload);
  expect(roundTrip.workspace.slots[0].run.seed).toBe(3001);
  expect(roundTrip.workspace.codex.categories.events['stored-bread'].encounterCount).toBe(1);
  expect(roundTrip.workspace.dailyRecords['2026-08-01'].attempts).toBe(1);

  let occupied = records.setSlot(records.freshWorkspace(), 1, run(3901), { timestamp: ISO_A });
  occupied = records.setSlot(occupied, 2, run(3902), { timestamp: ISO_A });
  occupied = records.setSlot(occupied, 3, run(3903), { timestamp: ISO_A });
  const allPreview = records.previewTransfer(allPayload, { currentWorkspace: occupied });
  expect(allPreview.overwriteSlotIds).toEqual(['slot-1', 'slot-2', 'slot-3']);

  const singlePayload = records.makeTransferPayload(workspace, { slotId: 1, exportedAt: ISO_B });
  expect(singlePayload.scope).toBe('slot');
  expect(singlePayload.slots).toHaveLength(1);
  const preview = records.previewTransfer(singlePayload, {
    currentWorkspace: records.setSlot(records.freshWorkspace(), 3, run(7777), { timestamp: ISO_A }),
    targetSlotId: 3
  });
  expect(preview).toMatchObject({ valid: true, formatVersion: 3, targetSlotId: 'slot-3', overwriteSlotIds: ['slot-3'] });
  expect(preview.slots[0].seed).toBe(3001);
});

test('formatVersion 1/2のapplyTransferは既存codex・history・dailyRecordsをエンジン内で保護する', () => {
  let current = records.setSlot(records.freshWorkspace(), 2, run(3299, 'hard'), { timestamp: ISO_A });
  current.codex = records.recordCodex(current.codex, {
    source: 'play', committed: true, phase: 'encounter', category: 'events', id: 'story:riceball',
    token: 'protected-codex', occurredAt: ISO_A, mode: 'story'
  }).codex;
  current.history = [records.makeRunResult(run(3298, 'survival', {
    ended: true, ending: { code: 'survival_return', title: '帰還' }
  }), { runId: 'protected-history', completedAt: ISO_B, choices: [0, 1] })];
  current.dailyRecords = records.updateDailyRecord({}, {
    date: '2026-08-01', started: true, attemptId: 'protected-daily', startedAt: ISO_A, day: 18
  }).records;
  const expected = {
    codex: structuredClone(current.codex),
    history: structuredClone(current.history),
    dailyRecords: structuredClone(current.dailyRecords)
  };

  for (const formatVersion of [1, 2]) {
    const payload = {
      format: 'tabenai-save', formatVersion, exportedAt: ISO_B,
      [formatVersion === 1 ? 'state' : 'run']: run(3200 + formatVersion, 'story', { version: formatVersion })
    };
    const applied = records.applyTransfer(current, payload, { targetSlotId: 'slot-3' });
    expect(applied.workspace.slots[0].run.seed).toBe(3200 + formatVersion);
    expect(applied.workspace.slots[1].run.seed).toBe(3299);
    expect(applied.workspace.codex).toEqual(expected.codex);
    expect(applied.workspace.history).toEqual(expected.history);
    expect(applied.workspace.dailyRecords).toEqual(expected.dailyRecords);
  }
});

test('単一slot transferを指定slotへ適用して他slotを維持する', () => {
  const sourceRun = run(4001, 'story', {
    recording: { runId: 'recorded-4001', slotId: 'slot-1', choices: [0] }
  });
  let source = records.setSlot(records.freshWorkspace(), 1, sourceRun, { timestamp: ISO_A });
  const payload = records.makeTransferPayload(source, { slotId: 1, exportedAt: ISO_B, meta: { value: 1 } });
  let target = records.setSlot(records.freshWorkspace(), 1, run(4991), { timestamp: ISO_A });
  target = records.setSlot(target, 2, run(4992), { timestamp: ISO_A });
  const applied = records.applyTransfer(target, payload, { targetSlotId: 3 });
  expect(applied.workspace.slots.map(slot => slot.run && slot.run.seed)).toEqual([4991, 4992, 4001]);
  expect(applied.workspace.activeSlotId).toBe('slot-3');
  expect(applied.workspace.slots[2].run.recording.slotId).toBe('slot-3');
  expect(applied.meta).toEqual({ value: 1 });
});

test('図鑑はcommittedな実ランだけを解除し、debug・再描画・reload tokenを加算しない', () => {
  const observation = {
    phase: 'encounter', category: 'food', id: 'riceball', token: 'run-a:riceball:0',
    occurredAt: ISO_A, mode: 'story', name: 'おにぎり', assetId: 'art.rice-ball'
  };
  const debug = records.recordCodex(records.freshCodex(), { ...observation, source: 'debug', committed: true });
  expect(debug.recorded).toBe(false);
  expect(records.codexCounts(debug.codex).total).toBe(0);

  const first = records.recordCodex(debug.codex, { ...observation, source: 'play', committed: true });
  expect(first.recorded).toBe(true);
  const rerender = records.recordCodex(first.codex, { ...observation, source: 'play', committed: true });
  expect(rerender).toMatchObject({ recorded: false, reason: 'duplicate' });
  const reloaded = records.normalizeCodex(JSON.parse(JSON.stringify(rerender.codex)));
  const duplicateAfterReload = records.recordCodex(reloaded, { ...observation, source: 'play', committed: true });
  expect(duplicateAfterReload.recorded).toBe(false);
  expect(duplicateAfterReload.codex.categories.foods.riceball).toMatchObject({
    discovered: true,
    encounterCount: 1,
    modes: ['story'],
    assetIds: ['art.rice-ball']
  });
});

test('図鑑はA/B・本人摂取・拒否・結果を別集計し、未発見と発見表示を分ける', () => {
  let codex = records.recordCodex(records.freshCodex(), {
    source: 'play', committed: true, phase: 'encounter', category: 'event', id: 'stored-bread',
    token: 'run-b:event:1', occurredAt: ISO_A, mode: 'survival', hidden: true
  }).codex;
  codex = records.recordCodex(codex, {
    source: 'play', committed: true, phase: 'choice', category: 'event', id: 'stored-bread',
    token: 'run-b:choice:1', occurredAt: ISO_A, mode: 'survival', choiceIndex: 0,
    consumedByPlayer: true, refused: false, resultId: 'bread-eaten', assetId: 'art.stored-bread'
  }).codex;
  codex = records.recordCodex(codex, {
    source: 'play', committed: true, phase: 'choice', category: 'event', id: 'stored-bread',
    token: 'run-c:choice:1', occurredAt: ISO_B, mode: 'survival', choiceIndex: 1,
    consumedByPlayer: false, choiceKind: 'skip', resultId: 'bread-refused'
  }).codex;
  expect(codex.categories.events['stored-bread']).toMatchObject({
    encounterCount: 1,
    choiceA: 1,
    choiceB: 1,
    consumedCount: 1,
    refusedCount: 1,
    resultIds: ['bread-eaten', 'bread-refused'],
    assetIds: ['art.stored-bread']
  });
  const definition = { id: 'stored-bread', hidden: true, name: 'ひび割れた保存パン', condition: '森で発見', assetId: 'art.stored-bread', emoji: '🍞' };
  expect(records.describeCodexEntry(definition, null)).toMatchObject({
    discovered: false, hidden: true, name: '???', condition: null, assetId: null, silhouette: true
  });
  expect(records.describeCodexEntry(definition, codex.categories.events['stored-bread'])).toMatchObject({
    discovered: true, name: 'ひび割れた保存パン', condition: '森で発見', assetId: 'art.stored-bread', silhouette: false
  });
});

test('run IDと詳細リザルトは決定論的で、重複なし・新しい順・最大30件を守る', () => {
  const completed = run(5501, 'survival', {
    ended: true,
    day: 50,
    hp: 12,
    hunger: 81,
    ending: { code: 'survival_return', title: '帰還' },
    companions: { tako: true, jr: false, beanChild: false, clone: false }
  });
  const details = { gameVersion: '4.8.0', completedAt: ISO_B, choices: [0, 1, 1, 0], unlockedAchievements: ['wild_fifty'], timeline: [{ day: 1, choice: 0 }] };
  const first = records.makeRunResult(completed, details);
  const second = records.makeRunResult(completed, details);
  expect(first).toEqual(second);
  expect(first.runId).toMatch(/^run-[0-9a-f]{16}$/);
  expect(first.fateCode).toMatch(/^TABENAI-FATE-1\./);
  expect(first).toMatchObject({
    mode: 'survival', seed: 5501, day: 50, endingCode: 'survival_return', hp: 12, hunger: 81,
    unlockedAchievements: ['wild_fifty']
  });

  let history = records.addRunHistory([], first).history;
  const duplicate = records.addRunHistory(history, first);
  expect(duplicate.added).toBe(false);
  expect(duplicate.history).toHaveLength(1);
  for (let index = 0; index < 35; index += 1) {
    const result = records.makeRunResult(run(6000 + index, 'story', { ended: true, ending: { code: 'true' } }), {
      gameVersion: '4.8.0', completedAt: ISO_B, choices: [index % 2]
    });
    history = records.addRunHistory(history, result).history;
  }
  expect(history).toHaveLength(30);
  expect(history[0].seed).toBe(6034);
  expect(history.at(-1).seed).toBe(6005);
  expect(new Set(history.map(item => item.runId)).size).toBe(30);
});

test('詳細リザルトは同じrareの複数発生を重複除去せず判定ログと集計を保持する', () => {
  const completed = run(5511, 'survival', {
    ended: true, day: 50, ending: { code: 'survival_empty', title: '空箱の余白' }
  });
  const rareEncounterLog = [
    { eventId: 'ordinary-meal', day: 12, naturalHit: true, pityForced: false, rareChance: 0.04, rareRoll: 0.0123, pityCounter: 4 },
    { eventId: 'ordinary-meal', day: 37, naturalHit: false, pityForced: true, rareChance: 0.06, rareRoll: 0.82, pityCounter: 14 },
    { eventId: 'second-player', day: 44, naturalHit: true, pityForced: false, rareChance: 0.07, rareRoll: 0.03, pityCounter: 6 }
  ];
  const result = records.makeRunResult(completed, {
    completedAt: ISO_B, choices: [0, 1, 0], rareEncounterLog,
    rareTotal: 3, naturalTotal: 2, pityTotal: 1, longestRareDrought: 14
  });
  expect(result.rareEncounterLog).toHaveLength(3);
  expect(result.rareEncounterLog.filter(item => item.eventId === 'ordinary-meal')).toHaveLength(2);
  expect(result.rareEncounterLog).toEqual(rareEncounterLog);
  expect(result).toMatchObject({
    rareEncounters: ['ordinary-meal', 'second-player'],
    rareTotal: 3,
    naturalTotal: 2,
    pityTotal: 1,
    longestRareDrought: 14
  });
  expect(records.normalizeHistory(JSON.parse(JSON.stringify([result])))[0].rareEncounterLog).toEqual(rareEncounterLog);
});

test('運命コードはgame version・mode・seed・明示選択列を決定論的に往復する', () => {
  const input = { gameVersion: '4.8.0', mode: 'hard', seed: 0xfedcba98, choices: [0, 1, 1, 0, 1] };
  const first = records.encodeFateCode(input);
  const second = records.encodeFateCode(input);
  expect(first).toBe(second);
  expect(records.decodeFateCode(first)).toEqual({
    format: 'tabenai-fate', formatVersion: 1, ...input
  });
  expect(records.previewFateCode(first)).toEqual({
    valid: true, gameVersion: '4.8.0', mode: 'hard', seed: 0xfedcba98, choiceCount: 5, choices: [0, 1, 1, 0, 1]
  });
  expect(() => records.encodeFateCode({ ...input, choices: [0, 2] })).toThrow(/0 or 1/);
  expect(() => records.decodeFateCode('TABENAI-FATE-1.bad!')).toThrow(/decode|encoding/i);
});

test('JST日付境界と日替わりSURVIVAL seedを端末・通信非依存で固定する', () => {
  expect(records.jstDateString('2026-07-31T14:59:59.999Z')).toBe('2026-07-31');
  expect(records.jstDateString('2026-07-31T15:00:00.000Z')).toBe('2026-08-01');
  expect(records.jstDateString(new Date('2026-12-31T15:00:00.000Z'))).toBe('2027-01-01');
  expect(records.dailyInfo('2026-08-01')).toEqual({
    date: '2026-08-01', seed: 1264873921, mode: 'survival', algorithm: 'fnv1a32-jst-v1'
  });
  expect(records.dailySeed('2026-08-01')).toBe(records.dailySeed('2026-07-31T15:00:00.000Z'));
  expect(records.dailySeed('2026-08-01')).not.toBe(records.dailySeed('2026-08-02'));
  expect(() => records.dailySeed('2026-02-29')).toThrow(/invalid/);
});

test('今日の献立は初回・最高日・clear・死亡理由・選択数を永続化しattempt/run単位で重複しない', () => {
  const started = records.updateDailyRecord({}, {
    date: '2026-08-01', started: true, attemptId: 'attempt-a', startedAt: ISO_A, day: 1
  });
  expect(started).toMatchObject({ updated: true, duplicate: false });
  expect(started.record).toMatchObject({ attempts: 1, firstStartedAt: ISO_A, bestDay: 1, cleared: false });
  const duplicateStart = records.updateDailyRecord(started.records, {
    date: '2026-08-01', started: true, attemptId: 'attempt-a', startedAt: ISO_A, day: 20, choiceCount: 19
  });
  expect(duplicateStart.duplicate).toBe(true);
  expect(duplicateStart.record).toMatchObject({ attempts: 1, bestDay: 20, choiceCount: 19 });
  const completed = records.updateDailyRecord(duplicateStart.records, {
    date: '2026-08-01', completed: true, runId: 'daily-run-a', completedAt: ISO_B,
    day: 50, choiceCount: 53, cleared: true, deathReason: 'none'
  });
  expect(completed.record).toMatchObject({ attempts: 1, bestDay: 50, choiceCount: 53, cleared: true, deathReason: 'none' });
  const duplicateFinish = records.updateDailyRecord(completed.records, {
    date: '2026-08-01', completed: true, runId: 'daily-run-a', completedAt: ISO_B, cleared: true
  });
  expect(duplicateFinish.duplicate).toBe(true);
  expect(duplicateFinish.record.attempts).toBe(1);
});

test('容量不足時はactive runと図鑑を保護し、古い履歴timelineから決定論的に縮約する', () => {
  let workspace = records.setSlot(records.freshWorkspace(), 1, run(8801), { timestamp: ISO_A });
  workspace.codex = records.recordCodex(workspace.codex, {
    source: 'play', committed: true, phase: 'encounter', category: 'event', id: 'large-log',
    token: 'run-8801:event:1', occurredAt: ISO_A, mode: 'story'
  }).codex;
  for (let index = 0; index < 6; index += 1) {
    const result = records.makeRunResult(run(8900 + index, 'story', { ended: true, ending: { code: 'true' } }), {
      gameVersion: '4.8.0', completedAt: ISO_B, choices: [0, 1],
      timeline: Array.from({ length: 80 }, (_, item) => ({ day: item, text: `長い記録-${index}-${item}-${'x'.repeat(40)}` }))
    });
    workspace.history = records.addRunHistory(workspace.history, result).history;
  }
  const fullBytes = records.estimateStorageBytes(records.encodeStorage(workspace));
  const compacted = records.compactForQuota(workspace, Math.floor(fullBytes * 0.45));
  expect(compacted.fits).toBe(true);
  expect(compacted.stage).toMatch(/compacted|trimmed/);
  expect(compacted.compactedTimelines).toBeGreaterThan(0);
  expect(compacted.bytes).toBeLessThan(fullBytes);
  expect(compacted.workspace.slots[0].run).toEqual(workspace.slots[0].run);
  expect(compacted.workspace.codex).toEqual(workspace.codex);
  expect(workspace.history.every(item => item.timeline.length === 80)).toBe(true);
});

test('記録エンジンは乱数・wall clock・localStorageへ直接依存しない', async () => {
  const source = await readFile(new URL('../records-engine.js', import.meta.url), 'utf8');
  expect(source).not.toContain('Math.random');
  expect(source).not.toContain('Date.now');
  expect(source).not.toContain('localStorage');
  expect(source).not.toContain('crypto.getRandomValues');
});
