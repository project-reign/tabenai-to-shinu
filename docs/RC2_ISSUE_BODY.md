# 1.0.0-rc.2 iPhone復帰音・ダブルタップHotfix

## 実機結果

RC1の主要項目は合格:

- 更新、セーブ保持、3モード、音声、触覚、画面回転、再起動、機内モード、表示

正式版昇格前に次を修正:

1. app終了／sleep後、復帰して最初に操作した時の意図しない短音。
2. 非操作領域double tap時のSafari拡大。

## 要件

- `docs/RC1_IOS_HOTFIX_SPEC.md`
- `docs/CODEX_TASK_RC2_IOS_HOTFIX.md`
- `docs/RC2_RELEASE_CHECKLIST.md`

## 完了条件

- RC2 Draft PR
- 既存123テスト維持
- STORY/HARD digest不変
- SURVIVAL 500,000ラン分布不変
- iPhone再テスト合格後に正式版1.0.0へ昇格
