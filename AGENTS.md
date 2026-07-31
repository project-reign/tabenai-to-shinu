# AGENTS.md

## Product invariants

- Every playable scene must expose exactly two choices.
- Preserve a refusal path for food, drink, medicine, and wait/do-nothing encounters.
- Preserve the white-soil, red-soil, gray-soil, and body-germination bean routes.
- Keep all four final dishes reachable through two successive binary choices.
- Keep all four SURVIVAL final boxes reachable through two binary stages followed by open or refuse.
- Preserve all 23 existing achievements, ending records, aggregate statistics, and settings.
- All random decisions must use the saved seeded PRNG. Do not use `Math.random()` for game outcomes.
- Presentation assets, audio, animation, haptics, and their load timing must never read, consume, or change the game PRNG or game state.

## Save compatibility

- `tabenai-to-shinu-50days-v4` is the canonical save key.
- State schema `version: 4` is shared with v4.2.1 and must remain readable.
- Saves without a mode must normalize to `mode: "story"`; STORY 50 must retain v4.3.0 behavior.
- `tabenai-to-shinu-meta-v1` stores persistent achievements, endings, aggregate statistics, and settings independently of the active run.
- Resetting or replacing a run must never erase the meta save.
- Save-transfer JSON must include both the active run and meta save, while continuing to accept `formatVersion: 1` and `formatVersion: 2`.
- App SemVer and save schema version are separate concepts.
- Add migrations before removing or renaming scenes, flags, memories, companions, or statistics.
- Never clear localStorage during an app update.

## PWA and GitHub Pages

- All public asset URLs, manifest URLs, start URLs, and Service Worker scope must remain relative.
- Test from `/tabenai-to-shinu/`, not only from `/`.
- New Service Workers must wait until the player explicitly applies the update.
- A first online load followed by a fully offline relaunch is a release requirement.
- Keep three delivery tiers explicit: core shell, presentation precache, and lazy runtime. The current Service Worker uses two physical versioned caches, core and presentation; lazy responses enter the presentation cache only after a successful runtime fetch.
- Core-shell precaching is the only mandatory install step. Fetch the asset manifest best-effort, fetch presentation precache entries independently, cache only HTTP 200 responses, and never let a manifest failure or one presentation failure reject the Service Worker install. Never cache a 404 response.
- Precache only the application shell and the small assets marked `precache` in `assets/manifest.json`. A missing presentation or lazy asset must fall back without interrupting play.
- Treat cache activation as an application update: clean obsolete caches only when the explicitly accepted worker activates.

## Presentation invariants

- v4.6.0 “森が目を覚ます” is presentation infrastructure only. Do not change STORY 50, HARD 50, or SURVIVAL 50 scene logic, balance, seeded results, choices, refusals, bean routes, dishes, boxes, achievements, or endings while working on presentation.
- The four visual layers, back to front, are background, character, food/event art, and status/mood effect. Text, status values, results, and the two choices remain the canonical game UI above those layers.
- Resolve optional `backgroundKey`, `characterKey`, `artKey`, and `moodKey` through `assets/manifest.json`. Unknown keys, an unavailable manifest, HTTP errors, and decode errors must degrade to the existing emoji and text without an unhandled exception or broken choice flow. An intentionally injected HTTP failure may still be reported by the browser's network console; normal and fully offline cached launches must remain warning/error-free.
- Keep title, normal, warning, rare, milestone, final, death, escape, and achievement hooks available. A hook may trigger presentation only; it must not become a game-state transition.
- Do not autoplay. Create or resume Web Audio only after a trusted first pointer, touch, or keyboard gesture. Pause audio when the document becomes hidden and resume only when permitted and unmuted.
- Keep BGM and sound-effect volume and mute controls independent. Normalize absent legacy settings to safe defaults and persist them with haptics and light-visual mode in `tabenai-to-shinu-meta-v1` and transfer JSON.
- Haptics are best-effort and capability-gated. Never require vibration support and never use vibration, sound, motion, image, or color as the only carrier of information.
- Respect both the explicit reduced-motion setting and `prefers-reduced-motion`. Light-visual mode must skip presentation images and retain the existing emoji/text experience.
- The six v4.6 BGM entries and six character entries are slots, not bundled formal assets. Formal artwork and BGM are a v4.7 replacement and must use the stable IDs or an explicit compatibility mapping.

## Asset registry, delivery, and licensing

- Asset IDs are lower-case, ASCII, namespaced identifiers such as `background.forest.day` and `art.rice-ball`. They are independent of display labels, paths, file formats, and cache versions.
- IDs and existing event/scene IDs are append-only. Never reuse an ID for different content. If an ID must be retired, keep an alias or compatibility mapping before changing assignments or persisted diagnostics.
- `assets/manifest.json` is the runtime source of truth for asset paths, MIME types, cache tiers, fallback labels, assignments, hooks, and license IDs. Keep every URL relative and GitHub Pages subpath-safe.
- Every art asset must declare a stable semantic `subject` and Japanese `subjectLabel`; its alt must name that subject. An assignment with `artKey` must declare the matching `contentSubject`. If no semantically matching card exists, omit `artKey` and keep the emoji, character, and text fallback instead of reusing a contradictory image.
- Enforce the manifest budgets: total precache no more than 5 MiB, v4.6 presentation precache no more than 2 MiB, and lazy assets no more than 25 MiB. Count encoded delivery bytes, not source-master sizes.
- Do not ship source masters, evidence files, or conversion workspaces in `dist/`. Only validated delivery assets and the registry belong in the public build.
- Every shipped asset must have a matching entry in `ASSET_LICENSES.md` before merge. Record creator/rightsholder, production method, source or tool where known, modification status, and the exact permission state. “No formal license specified” is preferable to inventing a license.
- Project-created SVGs must contain a non-empty Japanese `<title>` and `<desc>`, use no external resources, embedded fonts, or scripts, and retain the documented dimensions. Formal v4.7 replacements must preserve accessible alternatives.
- Keep `docs/ASSET_SPEC.md`, `ASSET_LICENSES.md`, and manifest entries synchronized whenever an asset, assignment, cache tier, budget, or provenance record changes.

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
npm run validate:assets
npm test
npm run build
npm run simulate:survival
```

The survival validation suite must retain all pre-v4.5 tests and cover binary choices, refusal rights, deterministic decks, reload locking, cooldown/one-shot/recent suppression, rare rates and pity, every conditional event, all milestones and final boxes, multiple clear paths, save transfer, offline relaunch, and iPhone 390×844 layout. Run at least 10,001 seeds for each required policy, classify clear/death/starve/other, and require zero exceptions, infinite loops, and non-finite or out-of-range state values. Require random clear 50–65%, all-consume clear 45–75%, human-like clear 70–90%, all-refuse clear 0–5%, random death 5–25%, and random starvation 15–40%. Regenerate all policy tables and the three fixed-seed play logs after changing a balance constant.

The presentation validation suite must retain all 32 v4.5 tests and cover stable asset resolution, all four layers and nine hooks, manifest and image failure fallbacks, trusted-gesture audio unlock, independent BGM/SE settings, visibility pause, optional haptics, explicit and system reduced motion, light-visual mode, cache tiers and budgets, fully offline relaunch, explicit updates, iPhone 390×844 layout, and zero browser warnings or errors. It must also prove that an initial asset-manifest 503 and one precache-image 404 still activate the core shell, do not cache the failed response, and relaunch offline with text, emoji, and two choices. Asset validation must reject missing files, duplicate or malformed IDs, absolute or escaping paths, wrong MIME/extensions or dimensions, missing license IDs, orphan delivery files, missing SVG accessibility metadata, external SVG resources, scripts, budget overruns, and art subject/alt mismatches.

Update `CHANGELOG.md` and README behavior notes for user-visible changes.
