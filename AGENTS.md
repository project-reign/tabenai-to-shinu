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
- SURVIVAL 50, 100 DAYS, and ENDLESS are locked roadmap entries until their planned releases.
- The in-game management menu must provide a non-destructive return to the title screen.

## Required validation

Run before submitting:

```bash
npm ci
npx playwright install chromium
npm test
npm run build
```

Update `CHANGELOG.md` and README behavior notes for user-visible changes.
