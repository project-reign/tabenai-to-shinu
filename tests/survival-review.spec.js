import { expect, test } from '@playwright/test';

const DEBUG_URL = './?debug=1';

async function waitForDebug(page) {
  await expect.poll(() => page.evaluate(() => Boolean(globalThis.__TABENAI_DEBUG__))).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto(DEBUG_URL);
  await waitForDebug(page);
});

test('実ゲームとシミュレーターが共有する死亡・餓死判定と独立ポリシーPRNGを検証する', async ({ page }) => {
  const result = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    api.silent(true);

    const initial = api.fresh(4_500_801, 'survival');
    const current = globalThis.TabenaiSurvival.current(initial);
    const beforeGameRng = initial.rngState;
    const firstDecision = globalThis.TabenaiSurvival.policyDecision(initial, current.id, 'random', 123_456);
    const secondDecision = globalThis.TabenaiSurvival.policyDecision(initial, current.id, 'random', 123_456);

    const death = api.fresh(4_500_802, 'survival');
    death.day = 20;
    death.hp = 1;
    death.hunger = 30;
    death.survival.currentEventId = 'milestone-taxman';
    death.survival.currentSelection = { eventId: 'milestone-taxman' };
    api.setState(death);
    const afterDeath = api.step(1);

    const starve = api.fresh(4_500_803, 'survival');
    starve.hp = 92;
    starve.hunger = 95;
    starve.survival.currentEventId = 'stored-bread';
    starve.survival.currentSelection = { eventId: 'stored-bread' };
    api.setState(starve);
    const afterStarve = api.step(1);

    return {
      terminals: {
        alive: api.survivalTerminal({ hp: 1, hunger: 99 }),
        death: api.survivalTerminal({ hp: 0, hunger: 20 }),
        starve: api.survivalTerminal({ hp: 20, hunger: 100 }),
        both: api.survivalTerminal({ hp: 0, hunger: 100 })
      },
      beforeGameRng,
      afterPolicyGameRng: initial.rngState,
      firstDecision,
      secondDecision,
      deathEnding: afterDeath.ending,
      starveEnding: afterStarve.ending
    };
  });

  expect(result.terminals).toEqual({ alive: null, death: 'death', starve: 'starve', both: 'death' });
  expect(result.afterPolicyGameRng).toBe(result.beforeGameRng);
  expect(result.firstDecision).toEqual(result.secondDecision);
  expect(result.firstDecision.gameRngState).toBe(result.beforeGameRng);
  expect(result.firstDecision.policyRngState).not.toBe(123_456);
  expect(result.deathEnding.code).toBe('death');
  expect(result.starveEnding.code).toBe('starve');
});

test('本人が摂取しない行動は食べた回数と摂取系実績を増やさない', async ({ page }) => {
  const result = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const targets = [
      ['tako-egg-sac', 0],
      ['three-soil-sacks', 0],
      ['shadow-plate', 0],
      ['bean-homecoming', 0],
      ['tako-alive', 0],
      ['jr-hunger', 0],
      ['milestone-taxman', 0]
    ];
    api.silent(true);

    const resetMeta = () => api.setMeta({
      version: 1,
      achievements: {},
      endings: {},
      stats: { totalAte: 0 },
      settings: {}
    });
    const outcomes = [];
    for (const [eventId, choiceIndex] of targets) {
      resetMeta();
      const state = api.fresh(4_500_900 + outcomes.length, 'survival');
      state.flags.poisoned = 1;
      state.stats.ate = 0;
      state.survival.currentEventId = eventId;
      state.survival.currentSelection = { eventId };
      api.setState(state);
      const choice = globalThis.TabenaiSurvival.eventById(eventId).choices[choiceIndex];
      const after = api.step(choiceIndex);
      const meta = api.meta();
      outcomes.push({
        eventId,
        consumedByPlayer: choice.consumedByPlayer,
        ate: after.stats.ate,
        totalAte: meta.stats.totalAte,
        firstBite: !!meta.achievements.first_bite,
        poisonFeast: !!meta.achievements.poison_feast
      });
    }

    resetMeta();
    const positive = api.fresh(4_500_999, 'survival');
    positive.flags.poisoned = 1;
    positive.stats.ate = 0;
    positive.survival.currentEventId = 'stored-bread';
    positive.survival.currentSelection = { eventId: 'stored-bread' };
    api.setState(positive);
    const positiveAfter = api.step(0);
    const positiveMeta = api.meta();

    return {
      outcomes,
      positive: {
        consumedByPlayer: globalThis.TabenaiSurvival.eventById('stored-bread').choices[0].consumedByPlayer,
        ate: positiveAfter.stats.ate,
        totalAte: positiveMeta.stats.totalAte,
        firstBite: !!positiveMeta.achievements.first_bite,
        poisonFeast: !!positiveMeta.achievements.poison_feast
      }
    };
  });

  for (const outcome of result.outcomes) {
    expect(outcome.consumedByPlayer, outcome.eventId).toBe(false);
    expect(outcome.ate, outcome.eventId).toBe(0);
    expect(outcome.totalAte, outcome.eventId).toBe(0);
    expect(outcome.firstBite, outcome.eventId).toBe(false);
    expect(outcome.poisonFeast, outcome.eventId).toBe(false);
  }
  expect(result.positive).toEqual({
    consumedByPlayer: true,
    ate: 1,
    totalAte: 1,
    firstBite: true,
    poisonFeast: true
  });
});

test('SURVIVAL準備フラグを最終評価へ反映し、四箱と最終拒否の5ルートを維持する', async ({ page }) => {
  const result = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const flagNames = [
      'sawSecondTracks',
      'ancientHeard',
      'ancientCalmed',
      'futurePlan',
      'managerApproved',
      'sawDay51'
    ];
    api.silent(true);

    const base = api.fresh(4_501_001, 'survival');
    base.day = 50;
    base.survival.selectedBox = 'preserved';
    base.stats.skipped = 0;
    for (const name of flagNames) base.survival[name] = false;
    const baseline = api.survivalAssessment(base);
    const flagAssessments = Object.fromEntries(flagNames.map(name => {
      const state = structuredClone(base);
      state.survival[name] = true;
      return [name, api.survivalAssessment(state)];
    }));

    const routes = [
      ['preserved', 0, 'survival_preserved'],
      ['living', 0, 'survival_living'],
      ['empty', 0, 'survival_empty'],
      ['return', 0, 'survival_return'],
      ['preserved', 1, 'survival_refuse']
    ].map(([box, choiceIndex, expectedCode], index) => {
      const state = api.fresh(4_501_100 + index, 'survival');
      state.day = 50;
      state.stats.skipped = 21;
      state.survival.currentEventId = 'final-commit';
      state.survival.currentSelection = { eventId: 'final-commit' };
      state.survival.selectedBox = box;
      state.survival.milestoneSuccess = { 10: true, 20: true, 30: true, 40: true };
      state.survival.futurePlan = true;
      state.survival.managerApproved = true;
      state.survival.sawDay51 = true;
      state.companions.tako = true;
      api.setState(state);
      const after = api.step(choiceIndex);
      return {
        expectedCode,
        code: after.ending.code,
        title: after.ending.title,
        text: after.ending.text,
        assessment: after.survival.finalAssessment
      };
    });
    return { baseline, flagAssessments, routes };
  });

  for (const [name, assessment] of Object.entries(result.flagAssessments)) {
    expect(assessment.score, name).toBeGreaterThan(result.baseline.score);
    expect(assessment.signals.length, name).toBe(1);
    expect(assessment.text, name).not.toBe(result.baseline.text);
  }
  for (const route of result.routes) {
    expect(route.code).toBe(route.expectedCode);
    expect(route.title).toContain('生還者');
    expect(route.text).toContain('持ち帰る物');
    expect(route.assessment).toEqual(expect.objectContaining({
      rank: expect.any(String),
      carried: expect.any(String),
      milestoneCount: 4
    }));
    expect(route.assessment.refusals).toBe(route.code === 'survival_refuse' ? 22 : 21);
  }
});

test('5ポリシーを各10,001シードで実ゲーム同等に集計し最終バランスを守る', async ({ page }) => {
  test.setTimeout(300_000);
  const matrix = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.simulateSurvivalPolicies(10_001));

  expect(matrix.seedCount).toBe(10_001);
  expect(Object.keys(matrix.policies)).toEqual([
    'random',
    'allRefuse',
    'allConsume',
    'omniscientConservative',
    'humanLike'
  ]);
  for (const [name, result] of Object.entries(matrix.policies)) {
    expect(Object.values(result.outcomes).reduce((sum, count) => sum + count, 0), name).toBe(10_001);
    expect(result.errors, name).toBe(0);
    expect(result.loops, name).toBe(0);
    expect(result.invalidValues, name).toBe(0);
    expect(result.outcomes.other, name).toBe(0);
    expect(result.violations, name).toEqual({ cooldown: 0, oneShot: 0, maxEncounters: 0, recentThree: 0 });
    expect(result.day50ReachRate, name).toBeCloseTo(result.day50Reached / 10_001, 12);
    expect(result.averageSurvivalDays, name).toBeGreaterThanOrEqual(1);
    expect(result.averageSurvivalDays, name).toBeLessThanOrEqual(50);
    expect(Object.values(result.deathDayDistribution.death).reduce((sum, count) => sum + count, 0), name)
      .toBe(result.outcomes.death);
    expect(Object.values(result.deathDayDistribution.starve).reduce((sum, count) => sum + count, 0), name)
      .toBe(result.outcomes.starve);
    expect(result.rare.cap, name).toBe(2);
    expect(result.rare.minBaseChance, name).toBeCloseTo(0.008, 8);
    expect(result.rare.maxBaseChance, name).toBeCloseTo(0.015, 8);
    expect(result.rare.maxEffectiveChance, name).toBeCloseTo(0.04, 8);
    expect(result.rare.maxDryStreak, name).toBeLessThanOrEqual(45);
    expect(result.rare.naturalRate, name).toBeGreaterThan(0.005);
    expect(result.rare.naturalRate, name).toBeLessThan(0.02);
    expect(result.rare.allRuns.bins.threeOrMore, name).toBe(0);
    if (name === 'allRefuse') {
      expect(result.rare.pityTriggers, name).toBe(0);
      expect(result.rare.clearRuns.runs, name).toBe(0);
    } else {
      expect(result.rare.pityTriggers, name).toBeGreaterThan(0);
      expect(result.rare.clearRuns.runs, name).toBe(result.outcomes.clear);
      expect(result.rare.clearRuns.bins.zero / result.rare.clearRuns.runs, name).toBeGreaterThanOrEqual(0.45);
      expect(result.rare.clearRuns.bins.zero / result.rare.clearRuns.runs, name).toBeLessThanOrEqual(0.55);
      expect(result.rare.clearRuns.bins.one / result.rare.clearRuns.runs, name).toBeGreaterThanOrEqual(0.35);
      expect(result.rare.clearRuns.bins.one / result.rare.clearRuns.runs, name).toBeLessThanOrEqual(0.45);
      expect(result.rare.clearRuns.bins.two / result.rare.clearRuns.runs, name).toBeGreaterThanOrEqual(0.05);
      expect(result.rare.clearRuns.bins.two / result.rare.clearRuns.runs, name).toBeLessThanOrEqual(0.10);
      expect(result.rare.clearRuns.bins.threeOrMore, name).toBe(0);
      expect(result.rare.clearRuns.averageRarePerRun, name).toBeGreaterThanOrEqual(0.55);
      expect(result.rare.clearRuns.averageRarePerRun, name).toBeLessThanOrEqual(0.75);
    }
  }

  const random = matrix.policies.random;
  const randomClearRate = random.outcomes.clear / random.totalRuns;
  expect(randomClearRate).toBeGreaterThanOrEqual(0.50);
  expect(randomClearRate).toBeLessThanOrEqual(0.65);
  expect(random.outcomes.death / random.totalRuns).toBeGreaterThanOrEqual(0.05);
  expect(random.outcomes.death / random.totalRuns).toBeLessThanOrEqual(0.25);
  expect(random.outcomes.starve / random.totalRuns).toBeGreaterThanOrEqual(0.15);
  expect(random.outcomes.starve / random.totalRuns).toBeLessThanOrEqual(0.40);
  expect(random.day50Reached).toBe(random.outcomes.clear);

  const allRefuseRate = matrix.policies.allRefuse.outcomes.clear / 10_001;
  expect(allRefuseRate).toBeGreaterThanOrEqual(0);
  expect(allRefuseRate).toBeLessThanOrEqual(0.05);
  expect(matrix.policies.allRefuse.outcomes.starve).toBe(10_001);

  const allConsumeRate = matrix.policies.allConsume.outcomes.clear / 10_001;
  expect(allConsumeRate).toBeGreaterThanOrEqual(0.45);
  expect(allConsumeRate).toBeLessThanOrEqual(0.75);
  expect(matrix.policies.allConsume.outcomes.death).toBeGreaterThan(0);

  expect(matrix.policies.omniscientConservative.outcomes.clear).toBeGreaterThan(9_000);

  const humanLikeRate = matrix.policies.humanLike.outcomes.clear / 10_001;
  expect(humanLikeRate).toBeGreaterThanOrEqual(0.70);
  expect(humanLikeRate).toBeLessThanOrEqual(0.90);
  expect(matrix.policies.humanLike.choiceCounts.consumed).toBeGreaterThan(0);
  expect(matrix.policies.humanLike.choiceCounts.refused).toBeGreaterThan(0);
});
