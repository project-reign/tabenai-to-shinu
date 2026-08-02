# RC2 implementation notes

- Do not automatically resume AudioContext/BGM on visibilitychange alone.
- Re-arm trusted gesture resume after foregrounding.
- Flush scheduled future BGM voices on hide/pagehide.
- Resume BGM with fade-in and no synthetic resume cue.
- Apply touch-action: manipulation while preserving scroll and pinch zoom.
