# 1.0.0-rc.2 iPhone復帰音・ダブルタップHotfix QA報告

実施日: 2026-08-02

対象: `hotfix/release-candidate-v1.0-rc2`

関連: Issue #24、Issue #19

## 判定

自動QAではRC2 hotfixの完了条件を満たしました。ゲーム結果、保存形式、記録、PWAの既存契約は変更していません。正式版1.0.0への昇格前に、末尾の手順でiPhoneホーム画面PWAの実機再確認が必要です。

## Audio lifecycle state machine

| 現在状態 | 入力 | 次状態 | 音声処理 |
| --- | --- | --- | --- |
| 未解禁 | 最初のtrusted操作 | 再生中 | AudioContextを一度だけ生成・resumeし、現在のBGMを開始 |
| 再生中 | `hidden`／`pagehide`／`freeze` | 操作待ち | scheduler停止、BGM／SE voice flush、AudioContext suspend |
| 操作待ち | `visible`／`pageshow`／`resume` | 操作待ち | resumeしない、cueしない |
| 操作待ち | trustedな余白操作 | 再生中 | AudioContext resume、BGMを280 ms fade-in、SE 0 |
| 操作待ち | trustedな選択操作 | 再生中 | 同じgestureでBGM再開後、選択に対応するSEを1回 |

`pointerdown`、`touchend`、`keydown`のlistenerは初期化時に一度だけ登録し、復帰ごとに追加しません。resume処理中は同じgesture系列の二重消費をpromise guardで抑止します。公開版snapshotにはリングログを含めず、`?debug=1`だけが最大64件のlifecycle記録を返します。

## 予約voice flush

非表示化時にscheduler intervalを解除し、BGM engineが保持する全voiceについて、現在時刻以後のgain automationをcancelし、gainを無音へ設定してoscillatorをstop・disconnectします。sessionの`nextTime`を将来の短いleadへ移し、状態を`paused`にします。SE voiceも同様にstop・disconnectし、直前cueの重複防止時刻をclearします。

復帰gestureでは過去の予約時刻を再利用せず、現在時刻から90 ms先へschedulerを再配置します。master gainを280 msで戻すため、suspend前のlook-ahead音がburstしたり、復帰通知だけで単発accentが鳴ったりしません。

## 専用回帰

| 確認 | 結果 |
| --- | --- |
| hidden→visible後、無操作で1秒 | context resume 0、oscillator start 0、cue 0 |
| 復帰後のtrusted余白tap | BGM restart 1、SE 0、fade-in 280 ms |
| 復帰後のtrusted選択tap | actionに対応するSE 1回 |
| persisted pagehide／pageshow 10往復 | listener 8で固定、active scheduler 1以下、voice 8以下 |
| BGM mute／SE mute／両方mute | 各設定を維持し、mute対象は発音0 |
| lifecycle ring log | `?debug=1`だけに表示、通常版はfield自体なし |
| 320×568／390×844／430×932 | 横溢れ・browser warning／error 0 |

## ダブルタップ、scroll、pinch zoom

`html`、`body`、タイトル、カード、ゲーム本文、選択肢、記録、設定、モーダルなどの主要領域へ`touch-action: manipulation`を適用しました。これはpanとpinch zoomを許可しながらダブルタップ拡大を抑止します。

- viewport metaは`width=device-width, initial-scale=1, viewport-fit=cover`のまま
- `user-scalable=no`、`maximum-scale=1`、`touch-action: none`なし
- 320×568、390×844、430×932で連続tap後のviewport scale変化0
- 縦スクロール可能
- range sliderは`touch-action: none`／`user-select: none`ではない
- 入力欄とテキスト選択を抑止するCSS／`preventDefault`なし

## 全検証

| コマンド | 結果 |
| --- | --- |
| `npm run validate:assets` | PASS。precache 1,412,241 bytes／5 MiB、正式SVG 41点 106,134 bytes |
| `npm test -- --workers=1` | PASS。130件 |
| `npm run build` | PASS。`dist/`生成 |
| `npm run report:routes` | PASS。44 scenes、102 transitions、34 refusals、unreachable／cycle／dead end 0 |
| `npm run simulate:survival -- 100000` | PASS。100,000 seed×5方針、計500,000ラン |

STORY canonical digestは`6d3acaf7`、HARD canonical digestは`6ce87897`です。ラン`version: 4`、workspace`version: 1`、移行JSON`formatVersion: 3`を維持します。

### SURVIVAL 500,000ラン

| 方針 | clear | death | starve | other | 50日目到達率 | 平均生存日数 | rare 0 | rare 1 | rare 2 | rare 3+ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| random | 57,458 | 16,160 | 26,382 | 0 | 57.458% | 43.7884 | 59,631 | 33,510 | 6,859 | 0 |
| allRefuse | 0 | 0 | 100,000 | 0 | 0.000% | 15.9479 | 88,673 | 10,676 | 651 | 0 |
| allConsume | 50,692 | 49,308 | 0 | 0 | 50.692% | 39.0152 | 64,618 | 29,481 | 5,901 | 0 |
| omniscientConservative | 99,328 | 672 | 0 | 0 | 99.328% | 49.8040 | 50,326 | 41,160 | 8,514 | 0 |
| humanLike | 79,812 | 5,134 | 15,054 | 0 | 79.812% | 47.2815 | 54,251 | 37,939 | 7,810 | 0 |

例外、無限ループ、不正値、cooldown、oneShot、最大遭遇回数、直近3件、true rare上限の違反はすべて0です。完走ランのrare 0／1／2／3+と平均rareもRC1およびv4.9.0の確定値と一致しました。

## オフラインと互換性

既存PWA回帰で初回オンライン起動後の完全オフライン再起動、明示更新、manifest 503、画像404、音声decode失敗時の本文・絵文字・二択フォールバックを維持しました。Service Worker cache revisionだけを`1.0.0-rc.2`へ分離しています。

STORY／HARD／SURVIVAL、常時二択、全拒否権、四土、四皿、四箱、3スロット、図鑑174件、実績33件、履歴、今日の献立、運命コード、formatVersion 1／2／3、正式アート41点、BGM 6曲、SE 13種は回帰130件で維持しました。

## iPhone実機再確認手順

1. RC1をホーム画面PWAとして起動し、3スロット・図鑑・実績・履歴・音量／mute設定が存在することを確認する。
2. RC2の更新を明示適用し、表示版`1.0.0-rc.2`と既存データ保持を確認する。
3. BGM再生中にiPhoneを10秒スリープし、解除後2秒間触らず、復帰音が0であることを確認する。
4. 余白を一度tapし、SEなしでBGMだけが自然にfade-inすることを確認する。
5. 再度スリープし、復帰後の最初の操作を選択肢tapにして、選択SEが1回だけ鳴ることを確認する。
6. 手順3〜5を10回繰り返し、音のburst、単発accent、重複BGM、操作遅延がないことを確認する。
7. BGM mute、SE mute、両方muteで同じ復帰手順を行い、mute対象が鳴らないことを確認する。
8. タイトル背景、カード余白、ゲーム本文、選択肢外、記録、設定、モーダルを素早く2回tapし、拡大しないことを確認する。
9. 各画面で縦スクロール、二本指ピンチズーム、BGM／SE slider、入力欄、テキスト選択が使えることを確認する。
10. アプリ切替、ホーム画面復帰、Safariの戻る／進む（BFCache相当）、画面回転、機内モード再起動でも同じ結果になることを確認する。

実機確認後、[`RC2_RETEST_RESULT_TEMPLATE.md`](RC2_RETEST_RESULT_TEMPLATE.md)へ端末・iOS版・結果を記録し、Issue #18の正式版判定へ進みます。
