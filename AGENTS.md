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
- App SemVer and save schema version are separate concepts.
- Add migrations before removing or renaming scenes, flags, memories, companions, or statistics.
- Never clear localStorage during an app update.

## PWA and GitHub Pages

- All public asset URLs, manifest URLs, start URLs, and Service Worker scope must remain relative.
- Test from `/tabenai-to-shinu/`, not only from `/`.
- New Service Workers must wait until the player explicitly applies the update.
- A first online load followed by a fully offline relaunch is a release requirement.

## Required validation

Run before submitting:

```bash
npm ci
npx playwright install chromium
npm test
npm run build
```

Update `CHANGELOG.md` and README behavior notes for user-visible changes.
