# AGENTS.md

## Product invariants

- Every playable scene must expose exactly two choices.
- Preserve a refusal path for food, drink, medicine, and wait/do-nothing encounters.
- Preserve the white-soil, red-soil, gray-soil, and body-germination bean routes.
- Keep all four final dishes reachable through two successive binary choices.
- All random decisions must use the saved seeded PRNG. Do not use `Math.random()` for game outcomes.

## Save compatibility

- `tabenai-to-shinu-50days-v4` is the canonical save key.
- State schema `version: 4` is shared with v4.2.1 and must remain readable.
- Saves without a mode must normalize to `mode: "story"`; STORY 50 must retain v4.3.0 behavior.
- `tabenai-to-shinu-meta-v1` stores persistent achievements, endings, aggregate statistics, and settings independently of the active run.
- Resetting or replacing a run must never erase the meta save.
- Save-transfer JSON must include both the active run and meta save, while continuing to accept `formatVersion: 1`.
- App SemVer and save schema version are separate concepts.
- Add migrations before removing or renaming scenes, flags, memories, companions, or statistics.
- Never clear localStorage during an app update.

## PWA and GitHub Pages

- All public asset URLs, manifest URLs, start URLs, and Service Worker scope must remain relative.
- Test from `/tabenai-to-shinu/`, not only from `/`.
- New Service Workers must wait until the player explicitly applies the update.
- A first online load followed by a fully offline relaunch is a release requirement.

## Modes and title flow

- Normal PWA startup opens the title screen; `?new=1`, `?data=1`, and `?resume=1` must remain subpath-safe shortcuts.
- STORY 50 is the v4.3.0 game. HARD 50 may change difficulty modifiers, but not scene availability, refusal rights, binary choices, soil routes, dishes, or seeded determinism.
- SURVIVAL 50 “怪食サバイバル” is playable. 100 DAYS and ENDLESS remain locked roadmap entries until their planned releases.
- The in-game management menu must provide a non-destructive return to the title screen.

## SURVIVAL 50 engine

- Never change STORY 50 or HARD 50 content, state transitions, or seeded outcomes while extending the survival engine.
- Survival event kinds are `common`, `uncommon`, `rare`, `conditional`, `milestone`, and `final`. Keep at least 16 normal events, 8 conditional events, and 6 rare events available.
- One resolved event advances one day unless a scene explicitly documents a multi-step choice on the same day.
- Days 10, 20, 30, 40, and 50 must select their fixed milestone/final encounters instead of the daily deck.
- The rare base chance is 3%; danger tiers may raise it monotonically to no more than 7%. Keep deterministic pity protection for long rare droughts.
- Event definitions may declare cooldown, one-shot behavior, and maximum encounter counts. Enforce those limits before weighted selection.
- Exclude the three most recent eligible normal events when alternatives exist. A bounded deterministic fallback must prevent an empty-deck loop.
- Persist the selected event ID as soon as the encounter is chosen. Reloading must resume that event and must not advance or reroll the PRNG.
- Use only the saved seeded PRNG for deck order, weighted selection, checks, and endings. `Math.random()` is forbidden for every game-affecting survival decision.
- Equal seeds plus equal ordered choices must reproduce the complete event sequence, checks, and ending.
- Use the shared SURVIVAL terminal predicate after each resolved event: HP at or below zero is death and hunger at or above 100 is starvation. Simulations must stop at the same point as the browser game.
- Simulation policies must use a deterministic PRNG separate from the run's saved game PRNG. Validate `random`, `allRefuse`, `allConsume`, `omniscientConservative`, and `humanLike` independently.
- `humanLike` may read only visible risk/benefit text, current HP and hunger, companions, public flags, and its independent policy PRNG. It must not inspect exact effects, success probabilities, or future results.
- Resolve SURVIVAL-only toxin, fatigue, injury, and late-run exposure through one shared daily processor used by both browser play and simulation. Normalize new fields so older runs remain readable.
- Keep a mix of intake-favored, refusal-favored, and state-dependent encounters. At least six encounters must reverse their recommended choice according to HP, hunger, companions, or public flags.
- Keep event `kind` separate from `consumedByPlayer`. Only direct player intake may increment `state.stats.ate`, `meta.stats.totalAte`, or intake achievements.
- Every persisted SURVIVAL preparation flag must affect a later condition, final response, ending assessment, record, or achievement. It must not remain write-only.
- Every survival encounter must expose exactly two choices. Food, drink, and medicine encounters must retain a direct refusal, and passive encounters must retain a wait/do-nothing option.
- A rare event alone must never cause unavoidable instant death; both choices require a survivable outcome or a prior player-controlled risk.
- Day 50 must select 保存食の箱, 生きている箱, 空の箱, or 帰還の箱 through two binary stages, followed by exactly two choices: open or refuse.
- Survival additions must not rename or remove existing achievements, endings, statistics, settings, bean routes, or final dishes.

## Required validation

Run before submitting:

```bash
npm ci
npx playwright install chromium
npm test
npm run build
npm run simulate:survival
```

The survival validation suite must retain all pre-v4.5 tests and cover binary choices, refusal rights, deterministic decks, reload locking, cooldown/one-shot/recent suppression, rare rates and pity, every conditional event, all milestones and final boxes, multiple clear paths, save transfer, offline relaunch, and iPhone 390×844 layout. Run at least 10,001 seeds for each required policy, classify clear/death/starve/other, and require zero exceptions, infinite loops, and non-finite or out-of-range state values. Require random clear 50–65%, all-consume clear 45–75%, human-like clear 70–90%, all-refuse clear 0–5%, random death 5–25%, and random starvation 15–40%. Regenerate all policy tables and the three fixed-seed play logs after changing a balance constant.

Update `CHANGELOG.md` and README behavior notes for user-visible changes.
