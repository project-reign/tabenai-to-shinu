import { expect, test } from '@playwright/test';

const DEBUG_URL = './?debug=1';

async function waitForDebug(page) {
  await expect.poll(() => page.evaluate(() => Boolean(globalThis.__TABENAI_DEBUG__))).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto(DEBUG_URL);
  await waitForDebug(page);
});

test('humanLikeは公開情報だけを使い、7イベントで状態に応じて推奨を反転する', async ({ page }) => {
  const result = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const survival = globalThis.TabenaiSurvival;
    const makeRun = changes => {
      const run = api.fresh(4_502_000, 'survival');
      run.hp = 92;
      run.hunger = 28;
      run.flags.hallucination = false;
      run.flags.shadowMerged = false;
      run.companions.tako = false;
      Object.assign(run, changes || {});
      return run;
    };
    const cases = [
      ['stored-bread', makeRun({ hunger: 20 }), makeRun({ hunger: 65 }), 1, 0],
      ['inverted-rain', makeRun({ hunger: 20 }), makeRun({ hunger: 65 }), 1, 0],
      ['white-tablet', makeRun({ hp: 95 }), makeRun({ hp: 45 }), 1, 0],
      ['whisper-can', makeRun({ hunger: 60 }), makeRun({ hunger: 60, companions: { tako: true } }), 1, 0],
      ['moon-mushroom', makeRun({ hunger: 70 }), makeRun({ hunger: 70, flags: { hallucination: true } }), 0, 1],
      ['shadow-snack', makeRun({ hunger: 60 }), makeRun({ hunger: 60, flags: { shadowMerged: true } }), 1, 0],
      ['forgotten-kit', makeRun({ hp: 90 }), makeRun({ hp: 45 }), 1, 0]
    ].map(([eventId, first, second, firstExpected, secondExpected]) => ({
      eventId,
      firstExpected,
      secondExpected,
      first: survival.humanLikeRecommendation(first, eventId),
      second: survival.humanLikeRecommendation(second, eventId),
      firstPublic: survival.publicChoiceInfo(first, eventId, 0),
      secondPublic: survival.publicChoiceInfo(second, eventId, 0)
    }));

    const policyRun = makeRun({ hunger: 65 });
    const gameRngBefore = policyRun.rngState;
    const decisionA = survival.policyDecision(policyRun, 'stored-bread', 'humanLike', 987_654_321);
    const decisionB = survival.policyDecision(policyRun, 'stored-bread', 'humanLike', 987_654_321);
    const hiddenChoice = survival.eventById('stored-bread').choices[0];
    const hiddenEffect = hiddenChoice.effect;
    const visibleBefore = survival.publicChoiceInfo(policyRun, 'stored-bread', 0);
    const recommendationBefore = survival.humanLikeRecommendation(policyRun, 'stored-bread');
    let visibleAfter;
    let recommendationAfter;
    try {
      hiddenChoice.effect = {
        hp: -999,
        hunger: 999,
        chance: {
          probability: 1,
          success: { hp: -999, hunger: 999 },
          failure: { hp: 999, hunger: -999 }
        }
      };
      visibleAfter = survival.publicChoiceInfo(policyRun, 'stored-bread', 0);
      recommendationAfter = survival.humanLikeRecommendation(policyRun, 'stored-bread');
    } finally {
      hiddenChoice.effect = hiddenEffect;
    }
    return {
      policies: survival.policyNames(),
      cases,
      gameRngBefore,
      gameRngAfter: policyRun.rngState,
      decisionA,
      decisionB,
      hiddenEffectInvariant: {
        visibleBefore,
        visibleAfter,
        recommendationBefore,
        recommendationAfter
      }
    };
  });

  expect(result.policies).toEqual([
    'random',
    'allRefuse',
    'allConsume',
    'omniscientConservative',
    'humanLike'
  ]);
  for (const item of result.cases) {
    expect(item.first, `${item.eventId} first`).toBe(item.firstExpected);
    expect(item.second, `${item.eventId} second`).toBe(item.secondExpected);
    expect(['safe', 'low', 'medium', 'high']).toContain(item.firstPublic.risk);
    expect(['safe', 'low', 'medium', 'high']).toContain(item.secondPublic.risk);
  }
  expect(result.gameRngAfter).toBe(result.gameRngBefore);
  expect(result.decisionA).toEqual(result.decisionB);
  expect(result.decisionA.policyRngState).not.toBe(987_654_321);
  expect(result.hiddenEffectInvariant.visibleAfter).toEqual(result.hiddenEffectInvariant.visibleBefore);
  expect(result.hiddenEffectInvariant.recommendationAfter)
    .toBe(result.hiddenEffectInvariant.recommendationBefore);
});

test('遅延状態の日次処理と同一seed＋明示選択列を完全再現する', async ({ page }) => {
  const result = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const survival = globalThis.TabenaiSurvival;
    api.silent(true);

    const game = api.fresh(4_502_101, 'survival');
    game.hp = 92;
    game.hunger = 20;
    game.survival.currentEventId = 'stored-bread';
    game.survival.currentSelection = { eventId: 'stored-bread' };
    api.setState(game);
    const afterRisk = api.step(0);

    const explicitChoices = [
      0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1,
      0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0,
      1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1,
      0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1,
      0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1
    ];
    const first = survival.playSeed(4_502_102, { choices: explicitChoices });
    const second = survival.playSeed(4_502_102, { choices: explicitChoices });
    return {
      afterRisk: {
        hp: afterRisk.hp,
        hunger: afterRisk.hunger,
        ailments: afterRisk.survival.ailments,
        dailyDamageTaken: afterRisk.survival.dailyDamageTaken
      },
      sameReplay: JSON.stringify(first) === JSON.stringify(second),
      replay: {
        outcome: first.outcome,
        failure: first.failure,
        traceLength: first.trace.length,
        choicesUsed: first.explicitChoices.length,
        gameRng: first.gameRng,
        terminalDay: first.terminalDay
      }
    };
  });

  expect(result.afterRisk.dailyDamageTaken).toBeGreaterThan(0);
  expect(result.afterRisk.ailments.toxin).toBeGreaterThan(0);
  expect(result.afterRisk.hp).toBeLessThan(92);
  expect(result.sameReplay).toBe(true);
  expect(result.replay.failure).toBeNull();
  expect(['clear', 'death', 'starve']).toContain(result.replay.outcome);
  expect(result.replay.traceLength).toBe(result.replay.choicesUsed);
  expect(result.replay.gameRng.end).not.toBe(result.replay.gameRng.start);
});

test('固定seedの全摂取・慎重・バランス3プレイログを決定論的に生成する', async ({ page, request }) => {
  const logs = await page.evaluate(() => {
    const survival = globalThis.TabenaiSurvival;
    return [
      [4_500_101, 'allConsume'],
      [4_500_202, 'cautiousVisible'],
      [4_500_303, 'humanLike']
    ].map(([seed, policy]) => {
      const first = survival.playSeed(seed, { policy });
      const second = survival.playSeed(seed, { policy });
      return {
        seed,
        policy,
        deterministic: JSON.stringify(first) === JSON.stringify(second),
        outcome: first.outcome,
        terminalDay: first.terminalDay,
        endingCode: first.ending && first.ending.code,
        traceLength: first.trace.length,
        gameRng: first.gameRng,
        policyRng: first.policyRng,
        traceDigest: first.traceDigest,
        rare: first.rare,
        firstStep: first.trace[0],
        lastStep: first.trace.at(-1)
      };
    });
  });

  expect(logs.map(log => log.policy)).toEqual(['allConsume', 'cautiousVisible', 'humanLike']);
  expect(logs.map(({ seed, policy, deterministic, outcome, terminalDay, endingCode, traceLength,
    gameRng, policyRng, traceDigest }) => ({
    seed,
    policy,
    deterministic,
    outcome,
    terminalDay,
    endingCode,
    traceLength,
    gameRng,
    policyRng,
    traceDigest
  }))).toEqual([
    {
      seed: 4_500_101,
      policy: 'allConsume',
      deterministic: true,
      outcome: 'clear',
      terminalDay: 50,
      endingCode: 'survival_preserved',
      traceLength: 52,
      gameRng: { start: 4_500_101, end: 372_994_683 },
      policyRng: { start: 2_783_047_903, end: 2_783_047_903 },
      traceDigest: '14cd7df8'
    },
    {
      seed: 4_500_202,
      policy: 'cautiousVisible',
      deterministic: true,
      outcome: 'clear',
      terminalDay: 50,
      endingCode: 'survival_refuse',
      traceLength: 52,
      gameRng: { start: 4_500_202, end: 1_004_830_454 },
      policyRng: { start: 2_783_047_856, end: 2_783_047_856 },
      traceDigest: '6f9dee5f'
    },
    {
      seed: 4_500_303,
      policy: 'humanLike',
      deterministic: true,
      outcome: 'clear',
      terminalDay: 50,
      endingCode: 'survival_refuse',
      traceLength: 52,
      gameRng: { start: 4_500_303, end: 1_004_830_555 },
      policyRng: { start: 2_783_047_957, end: 3_535_189_721 },
      traceDigest: 'bf1cf4e9'
    }
  ]);
  for (const log of logs) {
    expect(log.deterministic, `${log.seed}/${log.policy}`).toBe(true);
    expect(['clear', 'death', 'starve'], `${log.seed}/${log.policy}`).toContain(log.outcome);
    expect(log.traceLength, `${log.seed}/${log.policy}`).toBeGreaterThan(0);
    expect(log.firstStep.step).toBe(1);
    expect(log.lastStep.terminal).toBe(log.outcome);
    expect(log.rare.longestDrought).toBeLessThanOrEqual(45);
  }

  const documented = await (await request.get('./docs/survival-balance-playlogs.md')).text();
  for (const log of logs) {
    expect(documented).toContain(`- seed: ${log.seed}`);
    expect(documented).toContain(`- policy: ${log.policy}`);
    expect(documented).toContain(`- outcome: ${log.outcome} / day ${log.terminalDay} / ${log.endingCode}`);
    expect(documented).toContain(`- trace digest: ${log.traceDigest}`);
  }
});
