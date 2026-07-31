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
```

The survival validation suite must retain all pre-v4.5 tests and cover binary choices, refusal rights, deterministic decks, reload locking, cooldown/one-shot/recent suppression, rare rates and pity, every conditional event, all milestones and final boxes, multiple clear paths, save transfer, offline relaunch, and iPhone 390×844 layout. Run at least 10,000 seeded simulations and require zero exceptions, infinite loops, and non-finite or out-of-range state values.

Update `CHANGELOG.md` and README behavior notes for user-visible changes.
