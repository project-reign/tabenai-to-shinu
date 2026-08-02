import '../survival-engine.js';

const requested = Number(process.argv[2] || 10_001);
const seedCount = Math.max(1, Math.floor(Number.isFinite(requested) ? requested : 10_001));
const matrix = globalThis.TabenaiSurvival.simulatePolicies(seedCount);

function withRates(distribution) {
  const runs = Math.max(1, Number(distribution.runs) || 0);
  return {
    ...distribution,
    rates: Object.fromEntries(Object.entries(distribution.bins).map(([key, value]) => [key, value / runs]))
  };
}

const fixedLogTargets = [
  { label: '0 rare／全摂取 1', seed: 4_900_001, policy: 'allConsume', rare: 0 },
  { label: '0 rare／慎重 1', seed: 4_900_002, policy: 'cautiousVisible', rare: 0 },
  { label: '0 rare／人間らしい判断 1', seed: 4_900_004, policy: 'humanLike', rare: 0 },
  { label: '1 rare／全摂取 1', seed: 4_900_005, policy: 'allConsume', rare: 1 },
  { label: '1 rare／慎重 1', seed: 4_900_003, policy: 'cautiousVisible', rare: 1 },
  { label: '1 rare／人間らしい判断 1', seed: 4_900_007, policy: 'humanLike', rare: 1 },
  { label: '2 rare／全摂取 1', seed: 4_900_030, policy: 'allConsume', rare: 2 },
  { label: '2 rare／慎重 1', seed: 4_900_018, policy: 'cautiousVisible', rare: 2 },
  { label: '0 rare／バランス 2', seed: 4_900_008, policy: 'humanLike', rare: 0 },
  { label: '1 rare／バランス 2', seed: 4_900_009, policy: 'humanLike', rare: 1 }
];

function selectFixedPlayLogs() {
  return fixedLogTargets.map(target => {
    const played = globalThis.TabenaiSurvival.playSeed(target.seed, { policy: target.policy });
    if (played.outcome !== 'clear' || played.rare.seen !== target.rare) {
      throw new Error(`固定プレイログが変化: ${target.label} seed=${target.seed}`);
    }
    return { target, seed: target.seed, played };
  });
}

const fixedPlayLogs = selectFixedPlayLogs().map(({ target, seed, played }) => ({
  label: target.label,
  seed,
  policy: target.policy,
  outcome: played.outcome,
  terminalDay: played.terminalDay,
  endingCode: played.ending && played.ending.code,
  gameRng: played.gameRng,
  policyRng: played.policyRng,
  traceDigest: played.traceDigest,
  rare: played.rare,
  specialPacing: {
    conditional: played.trace.filter(step => step.category === 'conditional').map(step => ({ day: step.day, eventId: step.eventId })),
    milestone: played.trace.filter(step => step.category === 'milestone').map(step => ({ day: step.day, eventId: step.eventId }))
  },
  trace: played.trace.map(step => ({
    step: step.step,
    day: step.day,
    eventId: step.eventId,
    category: step.category,
    choiceIndex: step.choiceIndex,
    choiceTitle: step.choiceTitle,
    visibleRisk: step.visible.risk,
    hp: step.hp,
    hunger: step.hunger,
    ailments: step.ailments,
    rare: step.rare,
    terminal: step.terminal
  }))
}));

const report = {
  seedCount: matrix.seedCount,
  totalRuns: matrix.seedCount * Object.keys(matrix.policies).length,
  generatedAt: null,
  policies: Object.fromEntries(Object.entries(matrix.policies).map(([name, result]) => [name, {
    outcomes: result.outcomes,
    day50Reached: result.day50Reached,
    day50ReachRate: result.day50ReachRate,
    averageSurvivalDays: result.averageSurvivalDays,
    choiceCounts: result.choiceCounts,
    averageDailyDamage: result.averageDailyDamage,
    deathDayDistribution: result.deathDayDistribution,
    totalEvents: result.totalEvents,
    errors: result.errors,
    loops: result.loops,
    invalidValues: result.invalidValues,
    violations: result.violations,
    rare: {
      cap: result.rare.cap,
      minBaseChance: result.rare.minBaseChance,
      maxBaseChance: result.rare.maxBaseChance,
      maxEffectiveChance: result.rare.maxEffectiveChance,
      naturalDraws: result.rare.naturalDraws,
      naturalHits: result.rare.naturalHits,
      naturalRate: result.rare.naturalRate,
      observed: result.rare.observed,
      pityTriggers: result.rare.pityTriggers,
      maxDryStreak: result.rare.maxDryStreak,
      softPityStartDay: result.rare.softPityStartDay,
      softPityStartMisses: result.rare.pityLimit,
      rateByPeriod: result.rare.rateByPeriod,
      allRuns: withRates(result.rare.allRuns),
      clearRuns: withRates(result.rare.clearRuns)
    },
    conditionalHits: result.conditionalHits,
    milestoneHits: result.milestoneHits,
    boxHits: result.boxHits,
    finalRefusals: result.finalRefusals,
    clearEndings: result.clearEndings,
    achievementHits: result.achievementHits
  }])),
  fixedPlayLogs
};

console.log(JSON.stringify(report, null, 2));
