import '../survival-engine.js';

const requested = Number(process.argv[2] || 10_001);
const seedCount = Math.max(1, Math.floor(Number.isFinite(requested) ? requested : 10_001));
const matrix = globalThis.TabenaiSurvival.simulatePolicies(seedCount);

const report = {
  seedCount: matrix.seedCount,
  totalRuns: matrix.seedCount * Object.keys(matrix.policies).length,
  policies: Object.fromEntries(Object.entries(matrix.policies).map(([name, result]) => [name, {
    outcomes: result.outcomes,
    day50Reached: result.day50Reached,
    day50ReachRate: result.day50ReachRate,
    averageSurvivalDays: result.averageSurvivalDays,
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
  }]))
};

console.log(JSON.stringify(report, null, 2));
