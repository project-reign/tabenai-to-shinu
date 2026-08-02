# CODEX TASK — 1.0.0-rc.2 iPhone復帰音・ダブルタップHotfix

Repository: `project-reign/tabenai-to-shinu`
Base: latest `main`
Related: Issue #19, `docs/RC1_IOS_HOTFIX_SPEC.md`

## 開始

1. `main`を最新化する。
2. `hotfix/release-candidate-v1.0-rc2`を作成する。
3. RC1 Hotfix仕様、Issue #19、AGENTS、RC1 QA報告、音響／PWAテストを読む。

## 実装

### Audio lifecycle

- hidden/pagehideでBGM scheduler停止、将来予約voiceをflush。
- visible/pageshowのみではAudioContext／BGMを再開しない。
- 復帰後の最初のtrusted gestureだけで再開。
- 復帰処理自体はSEを鳴らさない。
- 同じgestureの本来のaction SEは1回だけ。
- BGMを短くfade-inし、burst／単発accentを防止。
- muted状態を尊重。
- lifecycle listener／timer／voiceの増殖を防止。
- debug時のみaudio lifecycle ring logを確認可能にしてよい。

### Double tap

- 適切な祖先／操作領域へ`touch-action: manipulation`を追加。
- double-tap zoomを抑止し、縦scrollとpinch zoomを維持。
- `user-scalable=no`、`maximum-scale=1`、全面`touch-action:none`は禁止。

## Version

- 表示、package、records metadata、Service Worker cache revisionを`1.0.0-rc.2`へ更新。
- 保存run version 4、transfer formatVersion 3は変更しない。

## 回帰

- 既存123テストを削除・弱体化しない。
- STORY/HARD digest不変。
- SURVIVAL 100,000 seeds × 5 policies不変。
- 3 slots、codex 174、achievements 33、history、daily、fate codeを維持。
- offline、explicit update、asset/audio failure fallbackを維持。

## 追加テスト

RC1 Hotfix仕様のテストをすべて追加する。
特に:

- hidden→visibleだけでcue／oscillator 0
- first trusted tapでBGM復帰
- action SE重複0
- 余白tapでSE 0
- 10回resumeでtimer／voice／listener増殖0
- muted combinations
- BFCache相当pagehide/pageshow
- touch-action computed style
- vertical scroll／pinch zoomを禁止するmeta・CSSがない
- 7 viewport、browser warning/error 0

## 完了

- `npm run validate:assets`
- `npm test -- --workers=1`
- `npm run build`
- `npm run report:routes`
- `npm run simulate:survival -- 100000`
- iPhone 390×844相当の証跡

Issue #19を参照するDraft PRを作成し、自動マージせず停止する。
PR URL、head SHA、テスト数、audio state machine、double-tap対策、回帰結果、実機再確認手順を報告する。
