# Changelog

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
