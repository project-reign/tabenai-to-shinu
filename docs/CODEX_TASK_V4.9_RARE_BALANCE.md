# CODEX TASK — v4.9.0 レアイベント頻度とプレイテンポの最終調整

Repository: `project-reign/tabenai-to-shinu`
Issue: #16
Specification: `docs/V4.9_RARE_BALANCE_SPEC.md`

## 開始

1. `main`を最新化する
2. `feature/rare-balance-v4.9`を作成する
3. Issue #16、仕様書、AGENTS.md、README、CHANGELOG、現行109テストを読む
4. v4.8.0の公開コードと保存互換を基準にする

## 実装

- true rareの0／1／2／3+分布を仕様書の目標へ調整
- true rareは原則2回上限
- 基礎率を約0.8〜1.5%の候補から校正
- 14回未遭遇で強く働く現pityをsoft pityへ変更
- soft pityはrare 0回かつ後半だけ
- 発生保証を行わず、pity hitを基礎率と加算率の差分で記録
- rareが一度出た後はpityを解除
- conditional／milestone／finalの抽選と演出をtrue rareから分離
- rareなしでも全生還ルートを維持

## シミュレーション

校正:

- 10,001 seeds × 5方針

最終:

- 100,000 seeds × 5方針

方針:

- random
- allRefuse
- allConsume
- omniscientConservative
- humanLike

PR本文へ全ランと完走ランを分けて次を掲載:

- clear / death / starve / other
- 50日到達率
- 平均生存日数
- rare 0 / 1 / 2 / 3+
- 平均rare回数
- natural hitラン率
- pity hitラン率
- 2回上限到達率
- longest drought分布
- rare event別遭遇数
- 違反・例外・loop・不正値

## 目標

完走ラン:

- 0回 45〜55%
- 1回 35〜45%
- 2回 5〜10%
- 3回以上 0〜1%
- 平均 0.55〜0.75回

生還バランス:

- random clear 50〜65%
- allConsume clear 45〜75%
- humanLike clear 70〜90%
- allRefuse clear 0〜5%
- randomでdeathとstarveの両方が発生

## テスト

- 既存109件を削除・弱体化しない
- rare上限2
- soft pityはrare 0回の後半だけ
- pity非保証
- rare発生後pity解除
- rareなしで四箱全生還ルートへ到達
- true rare／conditional／milestone／final表示分離
- 通常UIで確率、pity、内部ID非表示
- debug／詳細表示で診断値を確認
- 同一seed＋選択列の再現性
- 3スロット、図鑑、履歴、日替わり、運命コード
- formatVersion 1／2／3
- PWA、明示更新、完全offline
- iPhone 390×844、PC
- browser warning/error 0

## 手動ログ

固定seedで最低10本:

- 0 rare: 3本以上
- 1 rare: 3本以上
- 2 rare: 2本以上
- 3+ rareがある場合は原因説明

## 完了

- Versionをv4.9.0へ更新
- README、AGENTS、CHANGELOGを更新
- Issue #16を参照するDraft PRを作成
- 自動マージしない
- PR URL、head SHA、テスト数、分布表、手動ログ、スクリーンショットを報告
