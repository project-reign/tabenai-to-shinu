import '../survival-engine.js';

const requested = Number(process.argv[2] || 10_001);
const seedCount = Math.max(1, Math.floor(Number.isFinite(requested) ? requested : 10_001));
const matrix = globalThis.TabenaiSurvival.simulatePolicies(seedCount);
const fixedPlayLogs = [
  { label: '食べられる物をほぼ全部食べる', seed: 4_500_101, policy: 'allConsume' },
  { label: '危険そうな物を拒否する慎重プレイ', seed: 4_500_202, policy: 'cautiousVisible' },
  { label: 'HPと空腹を見ながら判断するバランスプレイ', seed: 4_500_303, policy: 'humanLike' }
].map(config => {
  const played = globalThis.TabenaiSurvival.playSeed(config.seed, { policy: config.policy });
  return {
    ...config,
    outcome: played.outcome,
    terminalDay: played.terminalDay,
    endingCode: played.ending && played.ending.code,
    gameRng: played.gameRng,
    policyRng: played.policyRng,
    traceDigest: played.traceDigest,
    rare: played.rare,
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
  };
});

const report = {
  seedCount: matrix.seedCount,
  totalRuns: matrix.seedCount * Object.keys(matrix.policies).length,
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
      naturalDraws: result.rare.naturalDraws,
      naturalHits: result.rare.naturalHits,
      naturalRate: result.rare.naturalRate,
      observed: result.rare.observed,
      pityTriggers: result.rare.pityTriggers,
      maxDryStreak: result.rare.maxDryStreak,
      pityLimit: result.rare.pityLimit,
      rateByDanger: result.rare.rateByDanger
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
