# Changelog

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
- Added a shared HP/death and hunger/starvation terminal predicate used by both the browser game and simulator, plus a SURVIVAL-only daily hunger cost of 2 to keep random-play clears within the reviewed 15–85% range.
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
- Added four-policy simulations—random, all-refuse, all-consume, and conservative—over 10,001 seeds each with independent policy randomness, clear/death/starve/other counts, day-50 reach rate, death-day distribution, and average survival days.
- Added regression tests for non-player intake accounting, the shared terminal predicate, policy PRNG isolation, preparation-flag consumers, personalized five-route endings, and flaky-test rejection in CI.

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
