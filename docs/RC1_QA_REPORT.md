# 1.0.0-rc.1 リリース候補QA報告書

作成日: 2026-08-02

対象: `feature/release-candidate-v1.0`

基準版: v4.9.0 (`4066c05a299a4bec6d262513e2b5bdda79aaa80b`)

## 判定

**Release Candidateとして公開可能**です。ゲーム結果、バランス、保存形式を変更するblockerは検出されませんでした。正式版判定前の既知の制限は、実機固有のホーム画面起動、Safari音声ポリシー、触覚、画面回転をIssue #19の端末スモークテストで再確認することです。

## 実行結果

| 検証 | 結果 |
| --- | --- |
| `npm run validate:assets` | PASS。警告0、エラー0 |
| `npm test -- --workers=1` | PASS。123件 |
| `npm run build` | PASS |
| `npm run report:routes` | PASS |
| `npm run simulate:survival -- 100000` | PASS。100,000 seed×5方針、計500,000ラン |
| ブラウザQA | PASS。通常表示、キーボード、モーダル、公開用語、consoleを確認 |

## STORY 50／HARD 50

全シーンと状態variantを機械列挙しました。詳細な全遷移は [`rc1/STORY_HARD_ROUTE_REPORT.md`](rc1/STORY_HARD_ROUTE_REPORT.md)、機械可読データは [`rc1/story-hard-transition-matrix.json`](rc1/story-hard-transition-matrix.json) にあります。

| モード | シーン | 遷移 | 拒否遷移 | 到達不能 | 循環 | 行き止まり | 二択違反 | canonical digest |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| STORY 50 | 44 | 102 | 34 | 0 | 0 | 0 | 0 | `6d3acaf7` |
| HARD 50 | 44 | 102 | 34 | 0 | 0 | 0 | 0 | `6ce87897` |

canonical digestはv4.9.0と不変です。白い土、赤い土、灰色の土、身体発芽、四皿、最終拒否を含む全分岐を通過できました。

### 全結末

次の14 ending codeをSTORY／HARDの実遷移で到達確認しました。

- `death`
- `starve`
- `ancient`
- `monster_clear`
- `party`
- `true`
- `shield`
- `salad`
- `human_again`
- `regeneration_loop`
- `overgrowth`
- `shadow_exit`
- `blank`
- `refuse`

## SURVIVAL 50 — 500,000ラン

`random`、`allRefuse`、`allConsume`、`omniscientConservative`、`humanLike`を各100,000 seedで実行しました。例外、無限ループ、不正値、cooldown違反、oneShot違反、最大遭遇回数違反、直近3件違反、true rare 3回以上はすべて0件です。

### 全ラン

| 方針 | clear | death | starve | other | 50日目到達率 | 平均生存日数 | rare 0 | rare 1 | rare 2 | 平均rare |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| random | 57,458 | 16,160 | 26,382 | 0 | 57.458% | 43.7884 | 59,631 | 33,510 | 6,859 | 0.4723 |
| allRefuse | 0 | 0 | 100,000 | 0 | 0.000% | 15.9479 | 88,673 | 10,676 | 651 | 0.1198 |
| allConsume | 50,692 | 49,308 | 0 | 0 | 50.692% | 39.0152 | 64,618 | 29,481 | 5,901 | 0.4128 |
| omniscientConservative | 99,328 | 672 | 0 | 0 | 99.328% | 49.8040 | 50,326 | 41,160 | 8,514 | 0.5819 |
| humanLike | 79,812 | 5,134 | 15,054 | 0 | 79.812% | 47.2815 | 54,251 | 37,939 | 7,810 | 0.5356 |

### 完走ランのtrue rare

| 方針 | 完走数 | 0回 | 1回 | 2回 | 3回以上 | 平均 | natural hitラン率 | pity hitラン率 | 2回上限到達率 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| random | 57,458 | 49.816% | 41.004% | 9.181% | 0% | 0.5937 | 37.624% | 13.507% | 9.181% |
| allRefuse | 0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| allConsume | 50,692 | 48.724% | 41.776% | 9.501% | 0% | 0.6078 | 38.663% | 13.566% | 9.501% |
| omniscientConservative | 99,328 | 50.057% | 41.376% | 8.567% | 0% | 0.5851 | 37.158% | 13.668% | 8.567% |
| humanLike | 79,812 | 49.955% | 41.306% | 8.739% | 0% | 0.5878 | 37.206% | 13.722% | 8.739% |

完走方針はすべて0回45〜55%、1回35〜45%、2回5〜10%、3回以上0〜1%、平均0.55〜0.75の範囲内です。全ランのlongest drought分布、各rare event遭遇数、固定seedログは [`v49-rare-balance-playlogs.md`](v49-rare-balance-playlogs.md) に記録済みで、今回の再実行と一致しました。

common、uncommon、conditional、rare、milestone、finalの分類、10／20／30／40／50日目、毒／疲労／負傷、死亡／餓死、soft pity解除、2回上限を確認しました。true rare 0回の固定状態でも保存食、生きている、空、帰還の四箱と最終拒否の5生還ルートへ到達します。

## 保存・記録

| 項目 | 結果 |
| --- | --- |
| v2／v3／v4系単一セーブ | STORY 50として読込PASS |
| 単一セーブからslot 1 | 初回だけ移行、markerによる再コピー0 |
| 3スロット | 分離、名前変更、複製、削除、上書き確認PASS |
| active mirror | 使用中slotだけを従来キーへ生runとして同期 |
| transfer format | 1／2／3のpreview、import、全体／単一slot export PASS |
| v1／v2取込 | 現在の図鑑、履歴、日替わり記録を維持 |
| rollback | 不正payloadのpreview／取込で既存workspaceを維持 |
| 図鑑 | 174件。実ランreceiptのみ解除、再描画・reload重複0 |
| 実績 | 33件。既解除を再加算しない |
| ラン履歴 | runId重複0、最新30件上限 |
| 今日の献立 | JST日付固定、offline開始、attempt／完了receipt維持 |
| 運命コード | preview後に別slot開始、同一入力を再現 |
| 破損／quota | key単位隔離、健全データ維持、古いtimelineから縮約 |
| 終了耐久 | 選択直後にpageを閉じて再起動してもactive slot／legacy mirror一致 |

ラン本体は`version: 4`、workspaceは`version: 1`、移行JSONは`formatVersion: 3`のままです。詳細は [`SAVE_SPEC.md`](SAVE_SPEC.md) にあります。

## 日本語・公開表示

タイトル、モード、遊び方、全STORYシーン、SURVIVALイベント、選択肢、結果、実績、図鑑、結末、詳細リザルト、設定、データ管理、更新／保存／オフライン通知、クレジットを監査しました。

- 通常画面に生の`SEED`、確率、roll、pity、内部ID、cache revision、formatVersion、localStorage、ONLINEを表示しません。
- 診断値は「詳細な判定情報」または`?debug=1`だけで確認できます。
- プレイ可能なモードの`NEW`表記を`PLAYABLE`へ変更しました。
- manifest shortcutを「データ管理」へ統一しました。
- 遊び方の更新版番号を含む一時的な開発文言を除きました。
- Release Candidate表記は「設定 → このゲームについて」のバージョン情報だけにあります。

## 画面サイズ

各viewportでタイトル、モード選択、ゲーム、記録、設定、データ管理と開いたモーダルを検査しました。

| viewport | 横溢れ | 押せない選択肢 | モーダル切れ | 固定要素重なり | console warning／error |
| --- | ---: | ---: | ---: | ---: | ---: |
| 320×568 | 0 | 0 | 0 | 0 | 0／0 |
| 375×667 | 0 | 0 | 0 | 0 | 0／0 |
| 390×844 | 0 | 0 | 0 | 0 | 0／0 |
| 430×932 | 0 | 0 | 0 | 0 | 0／0 |
| 768×1024 | 0 | 0 | 0 | 0 | 0／0 |
| 1280×720 | 0 | 0 | 0 | 0 | 0／0 |
| 1920×1080 | 0 | 0 | 0 | 0 | 0／0 |

## アクセシビリティ

- Tab／Shift+Tabだけでタイトル、モード、記録tab、設定、メニュー、モーダルを操作できます。
- 全操作要素へ高コントラストの`:focus-visible`を追加しました。
- モーダルは開いた時に内部へfocusし、Tabを閉じ込め、Escapeで閉じ、起点へ戻します。
- 画面遷移後は主見出しへfocusし、読み上げの現在位置を明確にします。
- 記録tabへ`role=tab`、`aria-controls`、内容へ`role=tabpanel`を付与しました。
- 画像alt、ボタン名、`aria-live`、文字サイズ、動きを減らす、`prefers-reduced-motion`、軽量モード、BGM／SEミュートを回帰確認しました。
- 最初のtrusted操作前にAudioContextを作らず、音声と触覚を情報の唯一の伝達手段にしません。

## PWA・障害時フォールバック

初回オンライン起動、Service Worker登録、待機workerの明示更新、更新前後の保存維持、サブパス起動、完全offline再起動、offlineでの今日の献立を確認しました。asset manifest 503、SVG 404、音声decode失敗でもcore installが成立し、本文、絵文字、状態、二択で進行できます。失敗responseはcacheされません。

Service Worker cache revisionは`1.0.0-rc.1`へ分離しました。旧cache-first workerが新しいHTMLへ古いengineを返す混在も再現し、RC1 HTMLのengine／manifest参照を版付きURLへ固定することで、古いunversioned cacheを残した状態でも正常起動することを確認しました。現行workerはその版付きURLをprecacheします。配布ZIPは`dist/`の中身をrootへ置く構成で、`index.html`、各engine、manifest、Service Worker、gallery、`assets/`、`icons/`を含みます。

## 性能・容量

| 項目 | 実測 | 上限／方針 |
| --- | ---: | --- |
| core shell | 1,298,719 bytes | offline起動に必須 |
| presentation precache | 106,134 bytes | 2 MiB以下 |
| 全precache | 1,404,853 bytes | 5 MiB以下 |
| 5 MiBまでの余裕 | 3,838,027 bytes | PASS |
| 正式SVG | 41点 | 8背景＋10キャラクター＋23カード |

図鑑は初回20件だけを描画し、「さらに20件表示」で次のbatchを明示的に読み込みます。ブラウザのidle timingに関係なく起動時の一括描画を防ぎます。履歴は選択tabで描画し、最大30件です。イベント委譲とpresentation tokenにより再描画時のlistener、音声、演出、保存の重複を防ぎます。

## 修正した不具合・仕上げ

1. キーボードfocusがブラウザ既定に依存していたため、明示的なfocus ringを追加。
2. モーダルがfocusを受けず背景へTab移動できたため、focus trap、Escape、focus restorationを追加。
3. 画面遷移後の読み上げ位置が不明瞭だったため、主見出しへfocus。
4. 記録tabのARIA関係が不足していたため、tab／tabpanel構造を追加。
5. プレイ可能なモードに`NEW`が残っていたため、`PLAYABLE`へ変更。
6. PWA shortcutに旧名称「セーブを移行」が残っていたため、「データ管理」へ統一。
7. RC版、package、records engine、Service Workerのversion表記を同期。
8. 旧Service Workerのcache-first scriptとRC1 HTMLが混在する起動不良を、版付き配信URLと専用回帰テストで修正。
9. 高速なCI環境でidle callbackが連続実行され図鑑全件を初期描画する不安定さを、20件ずつの明示読込へ変更して修正。

ゲーム結果変更を伴う不具合は検出しておらず、`survival-engine.js`は変更していません。

## 既知の制限

- Issue #19の実機スモークテストで、iPhone Safariのホーム画面追加後起動、端末固有のAudioContext復帰、触覚、回転を最終確認する必要があります。自動化した同寸法Safari相当レイアウトとtrusted gesture契約はPASSです。
- 100 DAYSとENDLESSは従来どおりロードマップ表示で、RC1の完成版対象は三つの50日モードです。
- オンラインランキング、クラウド同期、外部APIは意図的に実装していません。

## スクリーンショット

| 画面 | 証跡 |
| --- | --- |
| タイトル | [`screenshots/rc1/title.png`](screenshots/rc1/title.png) |
| モード選択 | [`screenshots/rc1/modes.png`](screenshots/rc1/modes.png) |
| STORY 50 | [`screenshots/rc1/story-50.png`](screenshots/rc1/story-50.png) |
| HARD 50 | [`screenshots/rc1/hard-50.png`](screenshots/rc1/hard-50.png) |
| SURVIVAL 50 | [`screenshots/rc1/survival-50.png`](screenshots/rc1/survival-50.png) |
| STORY四皿 | [`screenshots/rc1/four-dishes.png`](screenshots/rc1/four-dishes.png) |
| SURVIVAL四箱 | [`screenshots/rc1/four-boxes.png`](screenshots/rc1/four-boxes.png) |
| 図鑑 | [`screenshots/rc1/codex.png`](screenshots/rc1/codex.png) |
| 履歴 | [`screenshots/rc1/history.png`](screenshots/rc1/history.png) |
| 設定 | [`screenshots/rc1/settings.png`](screenshots/rc1/settings.png) |
| データ管理 | [`screenshots/rc1/data-management.png`](screenshots/rc1/data-management.png) |
| 完全offline再起動 | [`screenshots/rc1/offline.png`](screenshots/rc1/offline.png) |
