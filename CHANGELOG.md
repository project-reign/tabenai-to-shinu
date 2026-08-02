# Changelog

## [4.8.0] - 2026-08-01

### Added

- “食卓の記憶庫” three-slot save workspace for STORY 50, HARD 50, and SURVIVAL 50, with mode/day/HP/hunger/seed/scene/companions/last-played summaries plus overwrite confirmation, deletion, duplication, and rename operations.
- A persistent four-tab codex for foods, events, companions/entities, and endings. Committed real-run receipts track first/last encounter, encounter count, modes, A/B choices, player intake, refusals, result IDs, and related asset IDs without render/reload duplication or debug unlocks.
- Detailed completed-run results and a newest-first history capped at 30 unique run IDs, including mode, seed, days, ending/title, HP, hunger, intake/refusals, companions, memories, bean route, rare encounters, milestones, final dish/box, brought-home item, unlocked achievements, explicit choices, and timeline.
- Previewable fate codes containing game version, mode, seed, and ordered explicit choices, with deterministic replay into a selected new slot and no game-PRNG consumption by code or run-ID generation.
- Offline “今日の献立” SURVIVAL 50 attempts using the stable `fnv1a32-jst-v1` hash of the JST date, with persistent attempts, best day, clear state, death reason, and choice count. `2026-08-01` maps to seed `1264873921`.
- At least ten persistent record-system achievements for codex progress, three-slot use, fate replay, daily play/clear, cumulative refusals, and detailed-result storage, while retaining all 23 prior achievements.
- `records-engine.js` as a pure record/storage layer and `docs/SAVE_SPEC.md` as the versioned localStorage, migration, quota, replay, and offline contract.

### Changed

- Updated the displayed application and build metadata to v4.8.0 without changing run schema `version: 4`.
- New save-transfer exports use `formatVersion: 3` and support whole-workspace or single-slot scope. They include slots, active slot, meta, endings, codex, run history, and daily records, and show a content/overwrite preview before import.
- Reorganized the records screen into achievements, codex, endings, run history, and aggregate-statistics tabs, with deferred rendering for large lists and iPhone 390×844-safe wrapping.
- Kept the active slot mirrored as a raw run at `tabenai-to-shinu-50days-v4` while storing the three-slot workspace and record collections under dedicated v4.8 keys.
- Added quota-aware degradation that compacts oldest result timelines and then removes oldest completed results before permitting optional history to endanger active runs or persistent collections.
- Separated the release UI from diagnostics: raw seeds, roll values, exact percentages, internal IDs, online status, cache/save-format details, and daily-hash internals are hidden by default. Release choices use narrative outcomes and Japanese risk labels; explicit diagnostics remain available through the default-off detailed-judgement setting or `?debug=1`.
- Renamed player-facing navigation to “メニュー”, “データ管理”, and “アプリ情報・更新”; moved credits below “設定 → このゲームについて” and removed the development asset gallery from normal navigation.
- Detailed SURVIVAL results now preserve every rare occurrence, including repeated event IDs, day, natural/pity origin, diagnostic chance/roll/counter, totals, and longest drought. Player cards show Japanese event names and counts while raw diagnostics remain opt-in.
- Completed the release-language pass: STORY outcomes describe deterministic memory loss as “同じ運命”, data management names the persistent player records instead of internal meta terminology, aggregate statistics show a plain-language capacity state, and the daily title uses “日本時間”. Exact storage and replay diagnostics remain opt-in.

### Compatibility

- Migrates an existing single `tabenai-to-shinu-50days-v4` run to `slot-1` once and records a migration marker so later startups cannot duplicate it.
- Continues to import `formatVersion: 1` and `formatVersion: 2` single-run backups into `slot-1`, and accepts `formatVersion: 3` whole-workspace and single-slot backups. The record engine itself preserves the current codex, run history, and daily records when applying v1/v2 payloads.
- Preserves `tabenai-to-shinu-meta-v1`, old meta normalization, all prior endings/statistics/settings, and run schema `version: 4`; application SemVer, workspace version, run schema, fate-code version, and transfer format remain independent.
- Does not change `survival-engine.js`, STORY/HARD canonical behavior, or any SURVIVAL seeded event, check, ending, or 50,005-run simulation result. Record IDs, receipts, fate codes, and daily seeds neither use `Math.random()` nor consume the saved game PRNG.
- Preserves exactly two choices, every refusal, white/red/gray/body bean routes, four STORY dishes, four SURVIVAL boxes and final refusal, 41 formal art assets, six BGM themes, thirteen SE cues, fallback play, explicit updates, and fully offline relaunch.

### Validation

- Retained all 61 pre-v4.8 Playwright tests without deleting or weakening game, save, simulation, presentation, PWA, offline, failure-injection, and responsive-layout coverage.
- Added deterministic record-engine and browser coverage for one-time legacy migration, three isolated slots and operations, active mirror, transfer formats 1/2/3 and preview, committed-only codex receipts, undiscovered/hidden display, A/B/intake/refusal counts, 30-result cap, fate replay, JST boundaries, offline daily play, storage corruption/quota degradation, release/debug separation across title/settings/game/records/data-management/ending screens, v1/v2 record preservation, repeated rare logs, and iPhone layout, for 109 Playwright tests total.
- Re-runs formal asset validation, the full Playwright suite with one worker, the production build, STORY/HARD canonical digest checks, and all 50,005 SURVIVAL policy simulations.

## [4.7.0] - 2026-08-01

### Added

- “いただきますの森” formal presentation set: eight 1600×900 backgrounds, ten 800×1200 characters, and twenty-three 800×800 food/event cards. The 41 self-contained SVGs total 106,134 bytes and use the project-authored black, dark-brown, gold, deep-red, and amber art direction.
- Japanese `<title>` and `<desc>`, semantic alt text, subject metadata, dimensions, MIME, cache tier, and `project-v4.7-original-svg` license records for every formal SVG. No external images, fonts, scripts, third-party artwork, or artist/style imitation are included.
- Six playable original BGM compositions generated deterministically with Web Audio and no recorded samples: “空の皿” (51.428571 s, loop), “腹の鳴る森” (56.470588 s, loop), “あり得ない一皿” (40 s, loop), “五十日目” (73.846154 s, loop), “残された器” (16 s, non-loop), and “朝食のない朝” (56.25 s, loop).
- Poison, fatigue, and injury cues, expanding the project-authored runtime Web Audio effect set to thirteen distinct SE triggers.
- An in-app credits and asset-license screen plus a development asset gallery and automated registry inventory for reviewing every formal visual and audio entry.
- Formal title, normal, rare, character, four-dish, four-box, death, and escape presentation assignments while keeping emoji/text fallbacks available for every scene.

### Changed

- Updated the displayed application, web app metadata, presentation registry, and Service Worker cache version to 4.7.0.
- Replaced the v4.6 image placeholders and empty character/BGM slots with formal project-created art and deterministic Web Audio sequences while preserving stable asset IDs or explicit compatible additions.
- Added the formal 41-SVG set to best-effort per-file presentation precaching. Core shell install remains independent of the asset manifest and every optional visual/audio asset.
- Replaced the v4.6 “formal BGM arrives in v4.7” notice with working BGM controls and links to credits/license information.
- Connected the white-, red-, gray-, and body-germinated bean portraits to the live STORY/HARD route state through presentation-only manifest variants, while preserving explicit scene characters such as Tako and Jr.
- Corrected Tako to eight tentacles and a can hat, aligned Jr.'s alt with its amber medicine bag, and redrew the full-heal drop as a wrapped golden drop candy.
- Kept audio locked until the first trusted user gesture, pause/resume on visibility changes, independent BGM/SE volume and mute, reduced motion, capability-gated haptics, and an explicitly labelled light mode that omits images and reduces BGM note density without changing the track, duration, or loop.
- Connected the title and in-game management menus to the dedicated `se.menu` cue on trusted open actions, and advanced the internal Service Worker cache revision so the correction remains behind the explicit update operation.

### Compatibility

- Did not change `survival-engine.js`, STORY 50／HARD 50 canonical behavior, or any of the 50,005 SURVIVAL simulation outcomes. Presentation code and asset loading do not consume the saved game PRNG.
- Preserved exactly two choices, every food/drink/medicine/wait refusal, the white/red/gray/body-germination bean routes, all four STORY dishes, all four SURVIVAL boxes and final refusal, 23 achievements, records, statistics, and settings.
- Kept run schema `version: 4`, `tabenai-to-shinu-50days-v4`, `tabenai-to-shinu-meta-v1`, legacy run/meta normalization, and `formatVersion: 1` and `formatVersion: 2` transfer imports.
- Manifest 503, unknown IDs, image/audio 404, image/audio decode failure, unavailable Web Audio, and unavailable haptics continue through the emoji/text interface without an unhandled error, broken choice flow, or changed game result.
- Preserved GitHub Pages subpath-relative URLs, explicit player-controlled updates, and first-online fully offline relaunch. A failed optional response is never cached and cannot reject core Service Worker installation.

### Validation

- Retained all 46 pre-v4.7 Playwright tests without deleting or weakening game, save, simulation, PWA, offline, update, failure-injection, and iPhone coverage, and added 15 v4.7 tests for 61 total.
- Added exhaustive formal-asset reference, MIME, dimensions, Japanese accessibility metadata, semantic alt/subject, license, orphan-file, external-resource, and encoded-byte-budget validation.
- Added six-theme playback, loop/non-loop, volume, mute, first-gesture, visibility, offline, and synthesis/decode failure coverage, plus all thirteen SE trigger checks.
- Added credits, gallery, reduced-motion, bean-route portrait, light-mode image/BGM, iPhone 390×844, desktop, manifest 503, visual/audio 404, decode-failure, complete-offline, and zero normal-launch browser warning/error coverage.
- Re-ran STORY/HARD canonical digest and all 50,005 SURVIVAL policy simulations to confirm presentation-only changes leave deterministic results unchanged.

## [4.6.0] - 2026-07-31

### Added

- “森が目を覚ます” presentation foundation with four independent visual layers: background, character, food/event art, and status/mood effect.
- Stable `assets/manifest.json` registry for screen, STORY/HARD scene, SURVIVAL event/category, ending, action, and presentation-hook assignments.
- Six project-created 1600×900 abstract SVG backgrounds and nine 800×800 event-card SVGs, totaling 30,069 bytes. Every SVG includes Japanese `<title>` and `<desc>` metadata and has no external resources, embedded fonts, or scripts.
- Title, normal, warning, rare, milestone, final, death, escape, and achievement presentation hooks.
- Ten short sound effects synthesized at runtime with Web Audio, optional capability-gated haptic patterns, and six silent BGM replacement slots.
- Independent persistent BGM/SE volume and mute controls, haptic control, and light-visual mode. These settings are included in meta storage and save-transfer JSON.
- `docs/ASSET_SPEC.md` for stable IDs, fallback behavior, cache tiers, capacity budgets, accessibility, audio policy, build validation, and v4.7 replacement rules.
- `ASSET_LICENSES.md` inventory for project-created presentation assets, generated CSS/Web Audio effects, empty replacement slots, existing icons, and documentation screenshots.

### Changed

- Updated the displayed application, manifest, presentation registry, and Service Worker cache version to 4.6.0.
- Added supplementary artwork to title and game screens while keeping text, status, results, and the two choices as the canonical interface.
- Deferred all audio context creation and playback until a trusted first user gesture; audio pauses while the document is hidden.
- Combined the explicit reduced-motion setting with `prefers-reduced-motion`, and added a light-visual option that keeps only the existing emoji and text presentation.
- Split Service Worker delivery into core-shell, presentation-precache, and lazy-runtime tiers while retaining explicit player-controlled updates. Core install no longer depends on the asset manifest or presentation files; presentation files are fetched independently and only HTTP 200 responses are cached. Core and presentation are the two physical caches; successful lazy responses enter the presentation cache at runtime.
- Removed contradictory event-card assignments from `stored-bread`, `inverted-rain`, `tako-return`, `bean-homecoming`, and `shadow-snack`; these encounters now use their matching emoji, character, and text fallback until dedicated cards exist.
- Added semantic art-subject and alt-text validation alongside stable IDs, relative paths, MIME/dimensions, SVG accessibility metadata, license records, orphan files, and the 5 MiB precache, 2 MiB v4.6 presentation, and 25 MiB lazy budgets.
- Clarified in settings that the six silent BGM slots receive formal music in v4.7.

### Compatibility

- Kept all STORY 50, HARD 50, and SURVIVAL 50 scenes, balance values, seeded event/result sequences, choices, and endings unchanged.
- Preserved exactly two choices, all eat/drink/medicine/wait refusal rights, the white/red/gray/body-germination bean routes, four final dishes, and four SURVIVAL final boxes.
- Preserved all 23 achievements, ending records, aggregate statistics, and existing settings.
- Kept run schema `version: 4`, `tabenai-to-shinu-50days-v4`, `tabenai-to-shinu-meta-v1`, legacy meta normalization, and `formatVersion: 1` and `formatVersion: 2` transfer imports.
- Missing manifests, unknown asset IDs, 404 responses, decode failures, unavailable audio, and unavailable haptics fall back to the existing emoji/text game without changing state or consuming the saved PRNG.
- An asset-manifest failure or an individual presentation 404 no longer blocks Service Worker activation; failed and non-200 presentation responses are not cached.
- Kept relative GitHub Pages paths, first-online offline relaunch, and explicit player-controlled Service Worker updates.
- Formal character/event artwork and BGM remain deferred to v4.7 and can replace the v4.6 slots without changing game or asset IDs.

### Validation

- Retained all 32 v4.5 Playwright tests without deleting or weakening their game, save, simulation, PWA, offline, and iPhone coverage, then added 14 v4.6 tests for a total of 46.
- Added asset-registry resolution, four-layer rendering, and all nine presentation-hook checks.
- Added unknown-key, manifest failure, image 404, and offline fallback checks requiring the emoji/text game and exactly two choices to remain usable.
- Added trusted-gesture audio unlock, independent BGM/SE persistence, visibility pause, optional haptics, light-visual mode, explicit reduced motion, and `prefers-reduced-motion` coverage.
- Added shell/precache/lazy Service Worker, budget, GitHub Pages subpath, offline relaunch, explicit update, iPhone 390×844, and zero browser warning/error coverage.
- Added first-install fault tests proving that an asset-manifest 503 or one precache SVG 404 still activates the core shell and relaunches offline with text, emoji, and exactly two choices; the 404 response is not cached.
- Added deterministic asset validation with missing-file, malformed-ID, path-escape, MIME, dimension, missing-license, external-SVG-resource, script, orphan, budget-overrun, and art subject/alt mismatch failures.

## [4.5.0] - 2026-07-31

### Added

- Playable SURVIVAL 50 “怪食サバイバル” mode with a deterministic daily event deck and one-day progression for each resolved encounter.
- `common`, `uncommon`, `rare`, `conditional`, `milestone`, and `final` event categories, with at least 16 normal, 8 conditional, and 6 rare events.
- Deterministic 3% base rare chance that rises by danger tier to at most 7%, plus pity protection after a long rare-event drought.
- Per-event cooldown, one-shot, maximum-encounter, and recent-three suppression rules; selected event IDs are saved immediately to prevent reload rerolls.
- Fixed encounters on days 10, 20, 30, and 40, followed by day 50 “生存者の配膳”.
- Four day-50 boxes—保存食の箱, 生きている箱, 空の箱, and 帰還の箱—selected through two binary stages, followed by an open-or-refuse choice.
- Seven persistent achievements: 野生の50日, 稀少遭遇, 運も実力, 孤独な生還, 拒否の達人, 全ては予定通り, and the hidden 普通がいちばん.

### Changed

- Unlocked SURVIVAL 50 on the title mode screen; 100 DAYS and ENDLESS remain locked roadmap modes.
- Updated the displayed application, manifest, and Service Worker cache version to 4.5.0.
- Extended run and meta records with deterministic SURVIVAL encounter, rare/pity, milestone, final-box, achievement, ending, and statistics data.
- Added a shared HP/death and hunger/starvation terminal predicate used by both the browser game and simulator, plus a SURVIVAL-only daily processor for hunger, cumulative toxin, fatigue, injury, and late-run exposure.
- Added visible `safe`／`low`／`medium`／`high` risk and food／heal／clue／companion／none benefit metadata. Seven encounters now reverse their recommended choice according to HP, hunger, companions, or public flags.
- Rebalanced common and uncommon intake so consuming and refusing are each advantageous in different encounters; rare encounters remain unable to cause unavoidable instant death by themselves.
- Separated event kind from `consumedByPlayer` so protecting, carrying, sharing, returning, or sending food does not increment player-intake statistics or achievements.
- Made milestone preparation, companions, refusal count, and all persisted SURVIVAL preparation flags affect the day-50 title, carried item, text, or additional assessment without gating a clear.

### Compatibility

- Kept STORY 50 and HARD 50 scenes, values, choices, seeded results, four bean routes, and four final dishes unchanged.
- Preserved exactly two visible choices and the eat/drink/medicine/wait refusal rights throughout every playable mode.
- Kept run schema `version: 4`, `tabenai-to-shinu-50days-v4`, `tabenai-to-shinu-meta-v1`, legacy meta normalization, and `formatVersion: 1` and `formatVersion: 2` transfer imports.
- Kept relative GitHub Pages PWA paths, first-online offline relaunch, and explicit player-controlled Service Worker updates.
- Rare encounters do not cause unavoidable instant death by themselves.

### Validation

- Retained all 16 pre-v4.5 Playwright tests without weakening them and added SURVIVAL coverage for every event's binary choices and every food, drink, and medicine refusal.
- Added deterministic deck/result and reload-lock tests, plus cooldown, one-shot, encounter-cap, recent-three, rare-rate, and pity tests.
- Added reachability coverage for all conditional events, 10-day milestones, all four boxes and refusal, multiple survival endings, save/transfer migration, offline relaunch, and iPhone 390×844 layout.
- Added simulations over at least 10,000 seeds requiring zero exceptions, infinite loops, and invalid or non-finite state values.
- Added five-policy simulations—random, all-refuse, all-consume, omniscient conservative, and human-like—over 10,001 seeds each with independent policy randomness, clear/death/starve/other counts, day-50 reach rate, death-day distribution, and average survival days.
- Added a human-like policy that reads only visible danger/benefit descriptions, current HP and hunger, companions, and public flags; it never reads exact effects, probabilities, or future results.
- Added three deterministic fixed-seed play logs covering near-total intake, visible-risk refusal, and balanced HP/hunger play.
- Locked the 10,001-seed balance ranges at random 50–65%, all-consume 45–75%, human-like 70–90%, all-refuse 0–5%, with random death 5–25% and starvation 15–40%.
- Added regression tests for non-player intake accounting, the shared terminal predicate, policy PRNG isolation, preparation-flag consumers, personalized five-route endings, and flaky-test rejection in CI.
- Expanded the Playwright suite to 32 tests without deleting the existing 29.

## [4.4.0] - 2026-07-31

### Added

- PWA title screen with Continue, New Game, Records, Settings, connection status, and current-run summary.
- STORY 50 and deterministic HARD 50 modes; locked roadmap cards for SURVIVAL 50, 100 DAYS, and ENDLESS.
- Sixteen persistent achievements with unlock timestamps, hidden discoveries, and in-game unlock notifications.
- Persistent ending archive and aggregate run, choice, refusal, day, mode-clear, soil-route, and final-dish statistics.
- Persistent font-size, reduced-motion, choice-confirmation, and auto-scroll settings.
- In-game “Return to title” action.
- Playwright coverage for title navigation, modes, achievements, records, settings, v4.3 save migration, and run-plus-meta transfer data.

### Changed

- Existing saves without a mode are normalized to STORY 50 without changing save key or schema version.
- Save transfer `formatVersion: 2` includes both the active run and `tabenai-to-shinu-meta-v1`; v1 transfer imports remain supported.
- Updated the displayed application and Service Worker cache version to 4.4.0.

### Compatibility

- STORY 50 preserves the complete v4.3.0 scene graph, two-choice rule, refusal choices, four bean routes, four final dishes, and seeded outcomes.
- Kept run schema `version: 4`, `tabenai-to-shinu-50days-v4`, legacy ending data, and v2/v3 migration support.
- Kept relative PWA paths, offline relaunch, and explicit player-controlled Service Worker updates.

## [4.3.0] - 2026-07-31

### Added

- Installable manifest, versioned Service Worker, launcher icons, Apple touch icon, and maskable icon.
- First-online-load caching and offline relaunch from the GitHub Pages repository subpath.
- New-version detection with an explicit player-controlled update action.
- Playwright coverage for all scene transitions, refusal choices, the four final dishes, four bean routes, seeded reproducibility, save migration, mobile layout, and PWA offline behavior.
- GitHub Actions testing, static build, and GitHub Pages deployment.

### Changed

- Compacted the iPhone portrait header, status cards, scene spacing, and initial choice distance.
- Moved management controls into the header menu.
- Updated the displayed application version to 4.3.0.

### Compatibility

- Kept save schema `version: 4`.
- Kept `tabenai-to-shinu-50days-v4` and the existing ending key unchanged.
- Continued migration support for v2 and v3 saves.
- Preserved all binary-choice, refusal, bean-route, four-dish, and seeded-randomness behavior.

## [4.2.1]

- Single-file public build with automatic saving, save transfer, sharing, deterministic seeds, and the complete 50-day route set.
