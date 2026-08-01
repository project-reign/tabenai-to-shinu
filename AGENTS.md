# AGENTS.md

## Product invariants

- Every playable scene must expose exactly two choices.
- Preserve a refusal path for food, drink, medicine, and wait/do-nothing encounters.
- Preserve the white-soil, red-soil, gray-soil, and body-germination bean routes.
- Keep all four final dishes reachable through two successive binary choices.
- Keep all four SURVIVAL final boxes reachable through two binary stages followed by open or refuse.
- Preserve all 23 pre-v4.8 achievements, ending records, aggregate statistics, settings, and every v4.8 record-system addition.
- All random decisions must use the saved seeded PRNG. Do not use `Math.random()` for game outcomes.
- Presentation assets, audio, animation, haptics, and their load timing must never read, consume, or change the game PRNG or game state.

## Save compatibility

- `tabenai-to-shinu-run-slots-v1` is the three-slot workspace store. Keep exactly `slot-1`, `slot-2`, and `slot-3`; all modes may occupy any slot.
- `tabenai-to-shinu-50days-v4` remains the canonical legacy compatibility key and must mirror the active slot. Existing consumers must never see a record-only wrapper in place of the run object.
- State schema `version: 4` is shared with v4.2.1 and must remain readable.
- Saves without a mode must normalize to `mode: "story"`; STORY 50 must retain v4.3.0 behavior.
- `tabenai-to-shinu-meta-v1` stores persistent achievements, endings, aggregate statistics, and settings independently of the active run.
- Resetting or replacing a run must never erase the meta save.
- Migrate a pre-v4.8 single run to `slot-1` once only. Persist `tabenai-to-shinu-run-slots-migrated-v1`; never duplicate the run on a later startup.
- Once the slot workspace exists, legacy v2/v3 localStorage keys are historical input only. Never resurrect them after the last slot is deleted or an empty workspace is restored.
- Save-transfer exports use `formatVersion: 3` and include slots, active slot, meta, endings, codex, run history, and daily records. Whole-workspace and single-slot exports are both required.
- Continue accepting `formatVersion: 1` and `formatVersion: 2`; import their single run into `slot-1` exactly once. Accept `formatVersion: 3` without dropping its record collections.
- Preview every import before writing it and identify every slot that will be overwritten. Do not mutate storage during preview.
- Keep `tabenai-to-shinu-active-slot-v1`, `tabenai-to-shinu-run-history-v1`, `tabenai-to-shinu-codex-v1`, and `tabenai-to-shinu-daily-v1` synchronized with the slot workspace.
- Normalize `recording.slotId` to the containing slot after imports and copies; stale embedded slot claims must not overwrite another slot during mirror recovery.
- App SemVer and save schema version are separate concepts.
- Add migrations before removing or renaming scenes, flags, memories, companions, or statistics.
- Never clear localStorage during an app update.

## Records and replay invariants

- Codex categories are `foods`, `events`, `characters`, and `endings`. Unlock only from a committed real-run encounter or choice; debug rendering, previews, reloads, and repeated rendering must not discover or increment an entry.
- Persist first and last encounter time, encounter count, encountered modes, A/B counts, player-consumption count, refusal count, result IDs, and related asset IDs. Hidden undiscovered entries must not reveal their name, condition, or image.
- Use stable receipts to make encounter, choice, daily-attempt, and daily-completion writes idempotent.
- Keep at most 30 completed-run results and reject a duplicate `runId`. A run result must retain mode, seed, days, ending, title, HP, hunger, intake/refusal totals, companions, memories, bean route, rare encounters, milestones, final dish or box, brought-home item, newly unlocked achievements, explicit choices, and the choice timeline.
- Generate `runId`, record receipts, fate codes, and daily seeds without `Math.random()` and without reading or consuming the saved game PRNG.
- Fate codes must contain game version, mode, seed, and the explicit ordered 0/1 choices. Preview before starting, start in a newly selected slot, and preserve equal-code event, check, and ending reproducibility.
- “今日の献立” uses SURVIVAL 50 and `fnv1a32-jst-v1` over the JST `YYYY-MM-DD`. It must work without a server, external API, current network access, or the game PRNG. The same JST date must yield the same seed on every device.
- Keep daily first-start time, attempts, best day, clear state, latest death reason, choice count, and stable attempt/completion receipts.
- Treat storage corruption per key: keep readable records, normalize invalid data to safe defaults, and surface a warning without clearing unrelated data.
- On quota pressure, compact oldest completed-run timelines first and then remove oldest completed-run records. Never sacrifice active slot runs, meta, codex, daily records, settings, or the legacy active-slot mirror to preserve optional history detail.
- Keep the complete storage contract in `docs/SAVE_SPEC.md` synchronized with code and tests.

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

- v4.6.0 “森が目を覚ます” established presentation infrastructure; v4.7.0 “いただきますの森” supplies formal art and audio only. Do not change `survival-engine.js`, STORY 50, HARD 50, or SURVIVAL 50 scene logic, balance, seeded results, choices, refusals, bean routes, dishes, boxes, achievements, records, settings, or endings while working on these assets.
- The four visual layers, back to front, are background, character, food/event art, and status/mood effect. Text, status values, results, and the two choices remain the canonical game UI above those layers.
- Resolve optional `backgroundKey`, `characterKey`, `artKey`, and `moodKey` through `assets/manifest.json`. Unknown keys, an unavailable manifest, HTTP errors, and decode errors must degrade to the existing emoji and text without an unhandled exception or broken choice flow. An intentionally injected HTTP failure may still be reported by the browser's network console; normal and fully offline cached launches must remain warning/error-free.
- Keep title, normal, warning, rare, milestone, final, death, escape, and achievement hooks available. A hook may trigger presentation only; it must not become a game-state transition.
- Do not autoplay. Create or resume Web Audio only after a trusted first pointer, touch, or keyboard gesture. Pause audio when the document becomes hidden and resume only when permitted and unmuted.
- Keep BGM and sound-effect volume and mute controls independent. Normalize absent legacy settings to safe defaults and persist them with haptics and light-visual mode in `tabenai-to-shinu-meta-v1` and transfer JSON.
- Haptics are best-effort and capability-gated. Never require vibration support and never use vibration, sound, motion, image, or color as the only carrier of information.
- Respect both the explicit reduced-motion setting and `prefers-reduced-motion`. Light mode must skip presentation images, retain the existing emoji/text experience, and use the documented reduced-note BGM arrangement without changing track identity, duration, loop behavior, or game state.
- The v4.7 formal delivery consists of 8 backgrounds, 10 character portraits, and 23 food/event cards under `project-v4.7-original-svg`. Preserve their stable registry IDs, 1600×900／800×1200／800×800 delivery dimensions, semantic alt and subject metadata, and emoji/text fallbacks.
- The six BGM IDs are deterministic Web Audio compositions implemented without recorded samples, external music, or game PRNG consumption. Keep their published duration and loop contracts stable. The 13 synthesized SE IDs must continue to distinguish poison, fatigue, and injury as well as the existing action and outcome cues.
- Audio generation, scheduling, policy timing, presentation selection, and gallery enumeration must never use `Math.random()` or consume the saved game PRNG. `Date`, timers, and the AudioContext clock may schedule presentation, but must not influence game results.

## Asset registry, delivery, and licensing

- Asset IDs are lower-case, ASCII, namespaced identifiers such as `background.forest.day` and `art.rice-ball`. They are independent of display labels, paths, file formats, and cache versions.
- IDs and existing event/scene IDs are append-only. Never reuse an ID for different content. If an ID must be retired, keep an alias or compatibility mapping before changing assignments or persisted diagnostics.
- `assets/manifest.json` is the runtime source of truth for asset paths, MIME types, cache tiers, fallback labels, assignments, hooks, and license IDs. Keep every URL relative and GitHub Pages subpath-safe.
- Every art asset must declare a stable semantic `subject` and Japanese `subjectLabel`; its alt must name that subject. An assignment with `artKey` must declare the matching `contentSubject`. If no semantically matching card exists, omit `artKey` and keep the emoji, character, and text fallback instead of reusing a contradictory image.
- Enforce the manifest budgets: total precache no more than 5 MiB, presentation precache no more than 2 MiB, and lazy assets no more than 25 MiB. Count encoded delivery bytes, not source-master sizes. The 41 v4.7 formal SVGs total 106,134 bytes.
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

The presentation validation suite must retain all 46 pre-v4.7 tests and cover stable asset resolution, all four layers and nine hooks, the credits screen and asset gallery, manifest/image/audio/decode failure fallbacks, trusted-gesture audio unlock, all six playable BGM themes and 13 SE triggers, independent BGM/SE settings, loop/non-loop behavior, visibility pause, optional haptics, explicit and system reduced motion, light mode with image omission and reduced-note BGM arrangements, cache tiers and budgets, fully offline relaunch, explicit updates, iPhone 390×844 and desktop layouts, and zero browser warnings or errors. It must also prove that an initial asset-manifest 503, one precache-image 404, and unavailable or failing audio still activate the core shell, do not cache failed responses, and relaunch offline with text, emoji, and two choices. Asset validation must reject missing files, duplicate or malformed IDs, absolute or escaping paths, wrong MIME/extensions or dimensions, missing license IDs, orphan delivery files, missing SVG accessibility metadata, external SVG resources, fonts or scripts, budget overruns, and art subject/alt mismatches.

Update `CHANGELOG.md` and README behavior notes for user-visible changes.
