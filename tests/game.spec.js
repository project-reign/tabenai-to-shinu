import { expect, test } from '@playwright/test';

const GAME_URL = './?debug=1';
const SAVE_KEY = 'tabenai-to-shinu-50days-v4';
const LEGACY_V3_KEY = 'tabenai-to-shinu-50days-v3';
const LEGACY_V2_KEY = 'tabenai-to-shinu-50days-v2';

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
  await expect.poll(() => page.evaluate(() => Boolean(globalThis.__TABENAI_DEBUG__))).toBe(true);
});

test('iPhone縦画面でヘッダーと管理操作を圧縮し、二択へ短いスクロールで届く', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();

  await expect(page.locator('#choiceA')).toBeVisible();
  await expect(page.locator('#choiceB')).toBeVisible();
  await expect(page.locator('#choices .choice')).toHaveCount(2);
  await expect(page.locator('#rulesBtn')).toBeHidden();

  const distanceToSecondChoice = await page.evaluate(() => {
    const rect = document.getElementById('choiceB').getBoundingClientRect();
    return Math.max(0, rect.bottom - window.innerHeight);
  });
  expect(distanceToSecondChoice).toBeLessThanOrEqual(220);

  await page.locator('#appMenu > summary').click();
  await expect(page.locator('#rulesBtn')).toBeVisible();
  await expect(page.locator('#saveBtn')).toBeVisible();
});

test('全シーンの全遷移は常に二択で実行でき、全拒否選択も到達可能', async ({ page }) => {
  const result = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    const sceneNames = api.scenes();
    const failures = [];
    let transitionCount = 0;
    let refusalCount = 0;
    api.silent(true);

    const variantsFor = scene => {
      const variants = [{ name: 'default', patch: {} }];
      if (scene === 'finalDish') {
        variants[0].patch.flags = { selectedPair: ['salad', 'meat'] };
      }
      if (scene === 'finalCommit') {
        variants[0].patch.flags = {
          selectedPair: ['salad', 'meat'],
          selectedAppearance: 'salad',
          selectedTrueDish: 'salad'
        };
      }
      if (scene === 'shadow') {
        variants.push({ name: 'hungry', patch: { flags: { shadowHunger: true } } });
        variants.push({ name: 'bean', patch: { flags: { beanCarried: true } } });
        variants.push({ name: 'hungry-bean', patch: { flags: { shadowHunger: true, beanCarried: true } } });
      }
      if (scene === 'shadowFoodType' || scene === 'shadowRiceBread') {
        variants.push({ name: 'bean', patch: { flags: { beanCarried: true } } });
      }
      if (scene === 'collapse' || scene === 'collapseAction') {
        variants.push({ name: 'jr-egg', patch: { flags: { jrEgg: true, extraLife: true } } });
      }
      return variants;
    };

    for (const scene of sceneNames) {
      for (const variant of variantsFor(scene)) {
        const base = api.fresh(0x43_00_21);
        base.scene = scene;
        base.hp = 100;
        base.hunger = 0;
        Object.assign(base, Object.fromEntries(
          Object.entries(variant.patch).filter(([key]) => key !== 'flags')
        ));
        if (variant.patch.flags) Object.assign(base.flags, variant.patch.flags);

        for (const index of [0, 1]) {
          try {
            api.setState(base);
            const choices = api.choices();
            if (choices.length !== 2) {
              failures.push(`${scene}/${variant.name}: ${choices.length} choices`);
              continue;
            }
            const choice = choices[index];
            const before = api.snapshot();
            const after = api.step(index);
            transitionCount += 1;
            if (choice.kind === 'skip') {
              refusalCount += 1;
              if (after.stats.skipped !== before.stats.skipped + 1) {
                failures.push(`${scene}/${variant.name}/${index}: refusal counter`);
              }
            }
            if (!after.ended && !sceneNames.includes(after.scene)) {
              failures.push(`${scene}/${variant.name}/${index}: unknown ${after.scene}`);
            }
          } catch (error) {
            failures.push(`${scene}/${variant.name}/${index}: ${error.message}`);
          }
        }
      }
    }

    return { sceneCount: sceneNames.length, transitionCount, refusalCount, failures };
  });

  expect(result.sceneCount).toBe(44);
  expect(result.transitionCount).toBeGreaterThanOrEqual(102);
  expect(result.refusalCount).toBeGreaterThanOrEqual(25);
  expect(result.failures).toEqual([]);
});

test('白・赤・灰色の土と身体発芽の四ルートを維持する', async ({ page }) => {
  const routes = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    api.silent(true);
    const run = (scene, choice) => {
      const state = api.fresh(430);
      state.scene = scene;
      state.hp = 100;
      state.hunger = 0;
      state.flags.beanCarried = true;
      api.setState(state);
      return api.step(choice);
    };
    return {
      white: run('soilColor', 0),
      red: run('soilColor', 1),
      gray: run('graySoil', 0),
      body: run('beanDeadlineAction', 1)
    };
  });

  expect(routes.white.flags.beanSoil).toBe('white');
  expect(routes.red.flags.beanSoil).toBe('red');
  expect(routes.gray.flags.beanSoil).toBe('gray');
  expect(routes.body.flags.beanSoil).toBe('body');
  for (const state of Object.values(routes)) {
    expect(state.companions.beanChild).toBe(true);
  }
});

test('最後の晩餐の四皿と最後の拒否を二段階の二択で実行できる', async ({ page }) => {
  const outcomes = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    api.silent(true);
    const playDish = (pairIndex, dishIndex, commitIndex = 0) => {
      const state = api.fresh(430);
      state.scene = 'finalPair';
      state.hp = 100;
      state.hunger = 0;
      api.setState(state);
      api.step(pairIndex);
      api.step(dishIndex);
      return api.step(commitIndex);
    };
    return {
      salad: playDish(0, 0),
      meat: playDish(0, 1),
      soup: playDish(1, 0),
      cake: playDish(1, 1),
      refuse: playDish(1, 1, 1)
    };
  });

  expect(outcomes.salad.flags.selectedTrueDish).toBe('salad');
  expect(outcomes.meat.flags.selectedTrueDish).toBe('meat');
  expect(outcomes.soup.flags.selectedTrueDish).toBe('soup');
  expect(outcomes.cake.flags.selectedTrueDish).toBe('cake');
  expect(outcomes.refuse.ending.code).toBe('refuse');
  for (const key of ['salad', 'meat', 'soup', 'cake']) {
    expect(outcomes[key].ended).toBe(true);
  }
});

test('同一シードと同一選択列は乱数を含めて同一結果になる', async ({ page }) => {
  const result = await page.evaluate(() => {
    const api = globalThis.__TABENAI_DEBUG__;
    api.silent(true);
    const sequence = [0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0];
    const run = () => {
      api.setState(api.fresh(0x5eed_430));
      for (const choice of sequence) {
        const current = api.snapshot();
        if (current.ended) break;
        api.step(choice);
      }
      return api.snapshot();
    };
    return [run(), run()];
  });

  expect(result[0]).toEqual(result[1]);
  expect(result[0].stats.randomChecks).toBeGreaterThan(0);
});

test('v4.2.1現行セーブとv2/v3セーブを同じlocalStorage上で移行する', async ({ page }) => {
  await page.evaluate(({ saveKey }) => {
    localStorage.clear();
    localStorage.setItem(saveKey, JSON.stringify({
      version: 4,
      seed: 421,
      rngState: 987654,
      scene: 'meatTrial',
      day: 43,
      hp: 73,
      hunger: 41,
      status: 'v4.2.1から継続',
      choiceCount: 22,
      flags: { beanSoil: 'red', noFoodTrapClue: true },
      companions: { beanChild: true },
      memories: { birthday: false },
      stats: { skipped: 9 },
      log: ['既存ログ'],
      clues: ['既存の手がかり']
    }));
  }, { saveKey: SAVE_KEY });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(globalThis.__TABENAI_DEBUG__))).toBe(true);
  const loaded = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.snapshot());
  expect(loaded.scene).toBe('meatTrial');
  expect(loaded.seed).toBe(421);
  expect(loaded.rngState).toBe(987654);
  expect(loaded.status).toBe('v4.2.1から継続');
  expect(loaded.flags.beanSoil).toBe('red');
  expect(loaded.companions.beanChild).toBe(true);
  expect(loaded.version).toBe(4);

  await page.evaluate(({ key }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify({
      version: 3,
      seed: 303,
      scene: 'finalSelect',
      hp: 62,
      hunger: 54,
      flags: {},
      stats: {},
      companions: {},
      memories: {}
    }));
  }, { key: LEGACY_V3_KEY });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(globalThis.__TABENAI_DEBUG__))).toBe(true);
  const v3 = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.snapshot());
  expect(v3.version).toBe(4);
  expect(v3.scene).toBe('finalPair');
  expect(v3.seed).toBe(303);

  await page.evaluate(({ key }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify({
      version: 2,
      seed: 202,
      scene: 'soilColorOld',
      hp: 81,
      hunger: 33,
      flags: { takoMemory: true, swapped: true },
      stats: {},
      companions: {}
    }));
  }, { key: LEGACY_V2_KEY });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(globalThis.__TABENAI_DEBUG__))).toBe(true);
  const v2 = await page.evaluate(() => globalThis.__TABENAI_DEBUG__.snapshot());
  expect(v2.version).toBe(4);
  expect(v2.scene).toBe('soil');
  expect(v2.memories.tako).toBe(true);
  expect(v2.flags.dishMap.salad).toBe('cake');
  expect(v2.flags.dishMap.cake).toBe('salad');
});
