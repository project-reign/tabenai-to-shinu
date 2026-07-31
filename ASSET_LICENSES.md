# Asset licenses

## Scope and permission status

This file inventories visual, audio, and documentation assets shipped or referenced by `project-reign/tabenai-to-shinu` as of v4.6.0. It records provenance and the permission state known to the repository; it is not itself a general license grant.

The repository has no root `LICENSE` file and no separate formal reuse license for the project-created media at the time of this inventory. Unless a row states otherwise, the recorded use is:

- creator／repository source: project-reign
- allowed project use: inclusion in this repository's application build, tests, release package, and documentation
- third-party standalone redistribution, modification, or reuse: no formal terms specified
- attribution text: no separate public attribution wording specified

Do not infer an SPDX identifier or open-source／Creative Commons license from repository access. When a formal license or permission record is adopted, update this file and `assets/manifest.json` together.

## License IDs

| License ID | Covered material | Creator／source | Production method | Permission status |
| --- | --- | --- | --- | --- |
| `project-v4.6-placeholders` | v4.6 SVG backgrounds and cards | project-reign | SVG geometry authored directly for this repository; no external images, fonts, or scripts | Repository project use; no separate formal reuse license specified |
| `project-v4.6-css` | CSS mood and transition effects | project-reign | CSS gradients, borders, opacity, and animation authored in project source | Repository project use; no separate formal reuse license specified |
| `project-v4.6-synth` | Web Audio effect specifications | project-reign | Oscillator frequency, waveform, duration, and gain data authored in `assets/manifest.json`; no recorded sample audio | Repository project use; no separate formal reuse license specified |
| `slot-only` | Empty character and BGM replacement slots | project-reign | Registry metadata only; no image or audio file is bundled | No external asset to license; future file requires its own provenance record |
| `legacy-project-icons` | Existing PNG launcher and favicon assets | project-reign repository | Existing raster files; original master, tool, and detailed production record are not present | Repository project use; no separate formal reuse license specified |
| `inline-launcher-fallback` | Two identical embedded PNG fallback payloads in `index.html` | project-reign repository | Existing 180×180 PNG payload embedded as base64; original master and tool are not recorded | Repository project use; no separate formal reuse license specified |
| `project-screenshots-v4.5` | v4.5 documentation screenshots | project-reign | PNG captures of this project's browser UI; exact capture environment is not recorded in the files | Repository documentation and release reporting; no separate formal reuse license specified |
| `project-screenshots-v4.6` | v4.6 documentation screenshots | project-reign application | PNG captures made with the Codex in-app Browser during v4.6 QA on 2026-07-31; no external artwork was added | Repository documentation and release reporting; no separate formal reuse license specified |

## v4.6 project-created SVG backgrounds

All files in this section use `project-v4.6-placeholders`. They were created for v4.6.0 as abstract placeholders with project-authored SVG shapes and gradients. The repository files contain no external image URL, embedded font, script, or third-party artwork.

| Asset ID | Path | Dimensions | Bytes | Purpose | Creator | External source／reference | Modification status | Permission status |
| --- | --- | ---: | ---: | --- | --- | --- | --- | --- |
| `background.forest.day` | `assets/backgrounds/forest-day.svg` | 1600×900 | 2,330 | Day forest background | project-reign | None incorporated | Original v4.6 placeholder | Repository project use; formal reuse license not specified |
| `background.forest.night` | `assets/backgrounds/forest-night.svg` | 1600×900 | 2,531 | Night forest background | project-reign | None incorporated | Original v4.6 placeholder | Repository project use; formal reuse license not specified |
| `background.abandoned-diner` | `assets/backgrounds/abandoned-diner.svg` | 1600×900 | 2,539 | Abandoned diner background | project-reign | None incorporated | Original v4.6 placeholder | Repository project use; formal reuse license not specified |
| `background.shrine` | `assets/backgrounds/shrine.svg` | 1600×900 | 2,147 | Shrine background | project-reign | None incorporated | Original v4.6 placeholder | Repository project use; formal reuse license not specified |
| `background.final-dining-room` | `assets/backgrounds/final-dining-room.svg` | 1600×900 | 2,522 | Final dining-room background | project-reign | None incorporated | Original v4.6 placeholder | Repository project use; formal reuse license not specified |
| `background.survivor-banquet` | `assets/backgrounds/survivor-banquet.svg` | 1600×900 | 2,608 | SURVIVAL banquet background | project-reign | None incorporated | Original v4.6 placeholder | Repository project use; formal reuse license not specified |

Background subtotal: 6 files, 14,677 bytes.

## v4.6 project-created SVG cards

All files in this section use `project-v4.6-placeholders` and the same production and permission status as the backgrounds.

| Asset ID | Path | Dimensions | Bytes | Purpose | Creator | External source／reference | Modification status | Permission status |
| --- | --- | ---: | ---: | --- | --- | --- | --- | --- |
| `art.rice-ball` | `assets/cards/rice-ball.svg` | 800×800 | 1,498 | Rice-ball event card | project-reign | None incorporated | Original v4.6 placeholder | Repository project use; formal reuse license not specified |
| `art.blue-gel` | `assets/cards/blue-gel.svg` | 800×800 | 1,355 | Blue-gel event card | project-reign | None incorporated | Original v4.6 placeholder | Repository project use; formal reuse license not specified |
| `art.red-mushroom` | `assets/cards/red-mushroom.svg` | 800×800 | 1,598 | Red-mushroom event card | project-reign | None incorporated | Original v4.6 placeholder | Repository project use; formal reuse license not specified |
| `art.whisper-can` | `assets/cards/whisper-can.svg` | 800×800 | 1,664 | Whispering-can event card | project-reign | None incorporated | Original v4.6 placeholder | Repository project use; formal reuse license not specified |
| `art.golden-apple` | `assets/cards/golden-apple.svg` | 800×800 | 1,688 | Golden-apple event card | project-reign | None incorporated | Original v4.6 placeholder | Repository project use; formal reuse license not specified |
| `art.ordinary-meal` | `assets/cards/ordinary-meal.svg` | 800×800 | 1,966 | Ordinary-meal rare event card | project-reign | None incorporated | Original v4.6 placeholder | Repository project use; formal reuse license not specified |
| `art.empty-soup` | `assets/cards/empty-soup.svg` | 800×800 | 1,646 | Empty-soup event card | project-reign | None incorporated | Original v4.6 placeholder | Repository project use; formal reuse license not specified |
| `art.rotten-cake` | `assets/cards/rotten-cake.svg` | 800×800 | 1,830 | Rotten-cake event card | project-reign | None incorporated | Original v4.6 placeholder | Repository project use; formal reuse license not specified |
| `art.four-boxes` | `assets/cards/four-boxes.svg` | 800×800 | 2,147 | Four SURVIVAL final boxes card | project-reign | None incorporated | Original v4.6 placeholder | Repository project use; formal reuse license not specified |

Card subtotal: 9 files, 15,392 bytes. Combined v4.6 SVG total: 15 files, 30,069 bytes.

## CSS effects and synthesized sound

These entries do not contain downloaded artwork or sampled audio.

| License ID | IDs／paths | Creator | Production method | External material | Permission status |
| --- | --- | --- | --- | --- | --- |
| `project-v4.6-css` | `mood.title`, `mood.normal`, `mood.rare`, `mood.milestone`, `mood.warning`, `mood.death`, `mood.escape`, `mood.achievement`; CSS in `index.html` | project-reign | Project-authored CSS gradients, borders, shadows, opacity, and keyframe animation | None incorporated | Repository project use; formal reuse license not specified |
| `project-v4.6-synth` | `se.choice`, `se.warning`, `se.rare`, `se.milestone`, `se.consume`, `se.refuse`, `se.achievement`, `se.death`, `se.escape`, `se.menu`; specifications in `assets/manifest.json`, synthesis in `presentation-engine.js` | project-reign | Runtime Web Audio oscillators and gain envelopes; no sound recording or sample file | None incorporated | Repository project use; formal reuse license not specified |

The `achievement` hook reuses the project CSS presentation and the `se.achievement` synthesizer. The `final` hook reuses the milestone mood presentation. No additional media file is implied by those hook names.

## Empty replacement slots

The following records use `slot-only`. They contain labels, assignments, and emoji fallbacks only. They are not evidence that a formal image or BGM file has been licensed.

### Character slots

| Asset ID | Current file | Current fallback | Label | Creator of registry entry | Permission status |
| --- | --- | --- | --- | --- | --- |
| `character.tako` | None | 🐙 | 寄生タコ | project-reign | Slot metadata only; future image requires a new license record |
| `character.jr` | None | 🪱 | 解毒寄生虫Jr. | project-reign | Slot metadata only; future image requires a new license record |
| `character.bean-child` | None | 🌱 | 黒豆の幼体 | project-reign | Slot metadata only; future image requires a new license record |
| `character.shadow` | None | 🌑 | 自我を持つ影 | project-reign | Slot metadata only; future image requires a new license record |
| `character.invisible-cleaner` | None | 🧹 | 透明清掃員 | project-reign | Slot metadata only; future image requires a new license record |
| `character.forest-manager` | None | 🦌 | 森の管理者 | project-reign | Slot metadata only; future image requires a new license record |

### BGM slots

| Asset ID | Current file | Label | Creator of registry entry | Permission status |
| --- | --- | --- | --- | --- |
| `bgm.title` | None | 空の皿 | project-reign | Slot metadata only; future recording requires a new license record |
| `bgm.normal` | None | 腹の鳴る森 | project-reign | Slot metadata only; future recording requires a new license record |
| `bgm.rare` | None | あり得ない一皿 | project-reign | Slot metadata only; future recording requires a new license record |
| `bgm.final` | None | 五十日目 | project-reign | Slot metadata only; future recording requires a new license record |
| `bgm.death` | None | 残された器 | project-reign | Slot metadata only; future recording requires a new license record |
| `bgm.escape` | None | 朝食のない朝 | project-reign | Slot metadata only; future recording requires a new license record |

Formal character artwork and BGM are planned as v4.7 replacements. Before assigning a non-null `src`, register the creator/rightsholder, exact source or production method, license or permission evidence, attribution, modifications, and review date in this file.

## Existing application icons

The following PNG files predate v4.6.0 and are retained unchanged. Repository history attributes their addition and maintenance to project-reign. The original editable master, creation tool, third-party source record, and formal standalone reuse license are not present, so this inventory does not invent them.

| Path | Dimensions | Bytes | Creator／source record | Production method | Permission status |
| --- | ---: | ---: | --- | --- | --- |
| `icons/favicon-32.png` | 32×32 | 1,963 | project-reign repository | Existing raster icon; master and tool not recorded | Repository project use; formal reuse license not specified |
| `icons/apple-touch-icon.png` | 180×180 | 44,659 | project-reign repository | Existing raster icon; master and tool not recorded | Repository project use; formal reuse license not specified |
| `icons/icon-192.png` | 192×192 | 50,490 | project-reign repository | Existing raster icon; master and tool not recorded | Repository project use; formal reuse license not specified |
| `icons/icon-512.png` | 512×512 | 362,615 | project-reign repository | Existing raster icon; master and tool not recorded | Repository project use; formal reuse license not specified |
| `icons/icon-maskable-512.png` | 512×512 | 362,615 | project-reign repository | Existing raster icon; byte-identical to `icon-512.png` in this inventory | Repository project use; formal reuse license not specified |
| `icons/icon-1024.png` | 1024×1024 | 1,539,383 | project-reign repository | Existing raster icon; master and tool not recorded | Repository project use; formal reuse license not specified |

`index.html` also contains two byte-identical base64 PNG payloads used as early favicon and Apple touch fallbacks. Each decoded payload is 1,725 bytes, 180×180, SHA-256 `c08bf4212635e4c9b500e494a4b1ec5a9d1d1ebd9e61af21f35af97862ede32b`. They use `inline-launcher-fallback`; their original master and production tool are not recorded.

## Documentation screenshots

These PNGs are documentation-only and are not loaded by the game or Service Worker. They show the project-reign application UI. The v4.5 captures use `project-screenshots-v4.5`; the v4.6 captures use `project-screenshots-v4.6`.

| Path | Dimensions | Bytes | Creator／source | Production method | Permission status |
| --- | ---: | ---: | --- | --- | --- |
| `docs/screenshots/v4.5/title.png` | 1265×712 | 35,281 | project-reign application | Browser UI capture; exact environment not recorded | Repository documentation; formal reuse license not specified |
| `docs/screenshots/v4.5/modes.png` | 1265×712 | 40,547 | project-reign application | Browser UI capture; exact environment not recorded | Repository documentation; formal reuse license not specified |
| `docs/screenshots/v4.5/normal-event.png` | 1265×712 | 54,442 | project-reign application | Browser UI capture; exact environment not recorded | Repository documentation; formal reuse license not specified |
| `docs/screenshots/v4.5/rare-event.png` | 1265×712 | 56,538 | project-reign application | Browser UI capture; exact environment not recorded | Repository documentation; formal reuse license not specified |
| `docs/screenshots/v4.5/day-50.png` | 1265×712 | 54,332 | project-reign application | Browser UI capture; exact environment not recorded | Repository documentation; formal reuse license not specified |

### v4.6 QA captures

| Path | Dimensions | Bytes | Creator/source | Production method | Permission status |
| --- | ---: | ---: | --- | --- | --- |
| `docs/screenshots/v4.6/title.png` | 390×844 | 26,110 | project-reign application | Codex in-app Browser capture; iPhone portrait QA viewport | Repository documentation; formal reuse license not specified |
| `docs/screenshots/v4.6/normal-event.png` | 375×812 | 37,365 | project-reign application | Codex in-app Browser capture; compact mobile viewport | Repository documentation; formal reuse license not specified |
| `docs/screenshots/v4.6/rare-event.png` | 1265×712 | 62,653 | project-reign application | Codex in-app Browser capture of the deterministic `ordinary-meal` QA state | Repository documentation; formal reuse license not specified |
| `docs/screenshots/v4.6/achievement.png` | 1265×712 | 61,882 | project-reign application | Codex in-app Browser capture immediately after unlocking `ordinary_best` | Repository documentation; formal reuse license not specified |
| `docs/screenshots/v4.6/settings.png` | 375×1050 | 38,196 | project-reign application | Codex in-app Browser full-page capture of presentation settings | Repository documentation; formal reuse license not specified |

## Platform-provided emoji

Emoji characters used by the fallback UI are Unicode text. This repository does not bundle an emoji font or platform glyph artwork. Their rendered appearance is supplied by the user's operating system or browser and can differ by platform. The corresponding platform font license is not redistributed by this project.

The character slot fallbacks currently include 🐙, 🪱, 🌱, 🌑, 🧹, and 🦌. Other existing scene emoji follow the same rule. Emoji remain supplemental to Japanese text and are not the only source of gameplay information.

## Review and future additions

For each new or replacement asset, record before merge:

- stable asset ID and delivery path
- creator and rightsholder
- original／generated／commissioned／third-party production method
- tool, model, and version where applicable
- source URL or permission evidence
- input and reference rights
- modifications and derived-from relationship
- exact license or permission scope and required attribution
- commercial, redistribution, and derivative status
- added and reviewed dates

If any fact is unavailable, write “not recorded” or “not specified”; do not substitute an assumed license. See [`docs/ASSET_SPEC.md`](docs/ASSET_SPEC.md) for delivery, cache, accessibility, and validation requirements.
