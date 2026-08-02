import { expect, test } from '@playwright/test';

const DEBUG_URL = './?debug=1';

async function openDebug(page) {
  await page.goto(DEBUG_URL);
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__ && globalThis.TabenaiSurvival));
}

test.beforeEach(async ({ page }) => {
  await openDebug(page);
});

test('true rareは日別基礎率・後半soft pity・2回上限を保証なしで適用する', async ({ page }) => {
  const result = await page.evaluate(() => {
    const engine = globalThis.TabenaiSurvival;
    const api = globalThis.__TABENAI_DEBUG__;
    const makeRun = (day, rareSeen, rareMisses) => {
      const run = api.fresh(4_900_100 + day + rareSeen, 'survival');
      run.day = day;
      run.survival = engine.normalizeState({ rareSeen, rareMisses });
      return run;
    };

    const missedSoftPity = makeRun(49, 0, 45);
    const missValues = [0.9, 0.5];
    const missedEvent = engine.prepare(missedSoftPity, () => missValues.shift());

    const pityHit = makeRun(49, 0, 45);
    const pityValues = [0.02, 0.1];
    const pityEvent = engine.prepare(pityHit, () => pityValues.shift());
    const afterFirstRare = engine.rareChances(49, pityHit.survival);

    const capped = makeRun(49, 2, 0);
    let cappedRandomCalls = 0;
    const cappedEvent = engine.prepare(capped, () => {
      cappedRandomCalls += 1;
      return 0;
    });

    return {
      rates: [1, 19, 20, 34, 35, 44, 45, 49].map(day => [day, engine.rareRate(day)]),
      beforePity: engine.rareChances(34, { rareSeen: 0, rareMisses: 31 }),
      latePity: engine.rareChances(49, { rareSeen: 0, rareMisses: 45 }),
      missed: { category: missedEvent.category, selection: missedSoftPity.survival.currentSelection },
      pity: { category: pityEvent.category, selection: pityHit.survival.currentSelection, state: pityHit.survival },
      afterFirstRare,
      capped: { category: cappedEvent.category, selection: capped.survival.currentSelection, rareSeen: capped.survival.rareSeen, randomCalls: cappedRandomCalls }
    };
  });

  expect(result.rates).toEqual([
    [1, 0.008], [19, 0.008], [20, 0.01], [34, 0.01],
    [35, 0.012], [44, 0.012], [45, 0.015], [49, 0.015]
  ]);
  expect(result.beforePity).toEqual({ baseChance: 0.01, pityBonus: 0, effectiveChance: 0.01 });
  expect(result.latePity).toEqual({ baseChance: 0.015, pityBonus: 0.025, effectiveChance: 0.04 });
  expect(result.missed.category).not.toBe('rare');
  expect(result.missed.selection).toEqual(expect.objectContaining({ naturalHit: false, pityForced: false, rareChance: 0.04 }));
  expect(result.pity.category).toBe('rare');
  expect(result.pity.selection).toEqual(expect.objectContaining({ naturalHit: false, pityForced: true, rarePityBonus: 0.025 }));
  expect(result.pity.state).toEqual(expect.objectContaining({ rareSeen: 1, pityCount: 1 }));
  expect(result.afterFirstRare.pityBonus).toBe(0);
  expect(result.capped.category).not.toBe('rare');
  expect(result.capped.selection).toEqual(expect.objectContaining({ rareCapped: true, rareRoll: null }));
  expect(result.capped.rareSeen).toBe(2);
  expect(result.capped.randomCalls).toBe(1);
});

test('rare 0回でも四箱と最終拒否の5生還ルートへ到達できる', async ({ page }) => {
  const routes = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    api.silent(true);
    return [
      ['preserved', 0, 'survival_preserved'],
      ['living', 0, 'survival_living'],
      ['empty', 0, 'survival_empty'],
      ['return', 0, 'survival_return'],
      ['preserved', 1, 'survival_refuse']
    ].map(([box, choiceIndex, expected], index) => {
      const run = api.fresh(4_900_200 + index, 'survival');
      run.day = 50;
      run.survival.currentEventId = 'final-commit';
      run.survival.currentSelection = { eventId: 'final-commit' };
      run.survival.selectedBox = box;
      run.survival.rareSeen = 0;
      run.survival.naturalRareSeen = 0;
      run.survival.pityCount = 0;
      api.setState(run);
      const after = api.step(choiceIndex);
      return { expected, actual: after.ending.code, rareSeen: after.survival.rareSeen };
    });
  });
  for (const route of routes) {
    expect(route.actual).toBe(route.expected);
    expect(route.rareSeen).toBe(0);
  }
});

test('true rare・因縁／仲間・節目・最終局面は表示と演出hookを分離する', async ({ page }) => {
  const cases = [
    ['ordinary-meal', 'rare', '稀少な遭遇'],
    ['tako-return', 'conditional', '因縁／仲間'],
    ['milestone-stockpile', 'milestone', '節目'],
    ['final-pair', 'final', '最終局面']
  ];
  for (const [eventId, hook, label] of cases) {
    await page.evaluate(({ eventId }) => {
      const api = globalThis.__TABENAI_DEBUG__;
      const run = api.fresh(4_900_300, 'survival');
      const event = globalThis.TabenaiSurvival.eventById(eventId);
      run.day = event.day || (event.category === 'final' ? 50 : 25);
      run.survival.currentEventId = eventId;
      run.survival.currentSelection = { eventId, day: run.day, rareChance: 0.012, rareBaseChance: 0.012, rarePityBonus: 0, rareRoll: 0.001, naturalHit: event.category === 'rare' };
      api.setState(run);
    }, { eventId });
    await expect(page.locator('#statusBadge')).toContainText(label);
    await expect(page.locator('#sceneCard')).toHaveAttribute('data-presentation', hook);
  }
});

test('公開版はrare診断値を隠し、debug版だけが基礎率・soft pity・rollを表示する', async ({ page }) => {
  await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const run = api.fresh(4_900_400, 'survival');
    run.day = 49;
    run.survival.currentEventId = 'ordinary-meal';
    run.survival.currentSelection = {
      eventId: 'ordinary-meal', day: 49, rareChance: 0.04, rareBaseChance: 0.015,
      rarePityBonus: 0.025, rareRoll: 0.02, naturalHit: false, pityForced: true, pityCounter: 45
    };
    let workspace = globalThis.TabenaiRecords.freshWorkspace();
    workspace = globalThis.TabenaiRecords.setSlot(workspace, 'slot-1', run, { timestamp: '2026-08-02T00:00:00.000Z', activate: true });
    api.setRecords(workspace);
  });

  await page.goto('./?resume=1');
  await expect(page.locator('#statusBadge')).toContainText('稀少な遭遇');
  const releaseText = await page.locator('#gameScreen').innerText();
  for (const hidden of ['rareChance', 'rareRoll', 'pity counter', 'baseChance', 'pityBonus', 'ordinary-meal']) {
    expect(releaseText).not.toContain(hidden);
  }

  await page.goto('./?debug=1&resume=1');
  await expect(page.locator('#sceneText')).toContainText('baseChance=0.01500');
  await expect(page.locator('#sceneText')).toContainText('pityBonus=0.02500');
  await expect(page.locator('#sceneText')).toContainText('rareRoll=0.02000');
  await expect(page.locator('#sceneText')).toContainText('pity counter=45');
});
