# 1.0.0-rc.3 操作感Hotfix QA報告

実施日: 2026-08-03

対象: `hotfix/release-candidate-v1.0-rc3`

関連: Issue #26、Issue #18、Issue #19、Issue #24、PR #25

## 判定

自動QAではRC3 hotfixの完了条件を満たしました。`survival-engine.js`、ゲーム結果、保存形式、記録、PWAの既存契約は変更していません。正式版1.0.0への昇格前に、末尾の表でiPhoneホーム画面PWAの終了音・初回音声・連打・スクロールを実機再確認します。

## 終了時のclickless fade

BGM／SE voiceは次の順で停止します。

1. AudioParamの現在値を保持する。
2. `cancelScheduledValues(now)`を行う。
3. 現在値を`setValueAtTime`し直す。
4. 32 msの`linearRampToValueAtTime`で`0.0001`へ移す。
5. fade完了の8 ms後にoscillatorを停止する。
6. `onended`だけがnodeをdisconnectし、管理Setから除去する。

BGM master busも同じ32 msで無音へ移します。AudioContextのsuspendは48 ms後なので、master／voiceのfade完了前にcontextを止めません。voiceは`stopped`／`released`で保護し、同じvoiceの二重stop・disconnectを拒否します。`oscillator.stop(now)`、同時刻のgain急落、stop直後のdisconnectはありません。

OfflineAudioContext回帰では終了波形の最大サンプル不連続を閾値`0.08`未満に保ちました。`hidden`、`pagehide`、`freeze`で同じ経路を使い、10回の反復後もlistener、scheduler timer、BGM／SE voiceは増殖しません。mute対象の音声nodeを復帰のためだけに再開しません。

## 初回音声とゲーム開始経路

touch由来の`pointerdown`は候補記録だけを行います。iPhoneでAudioContextの解除／resumeを実行するイベントは`touchend`で、必要な場合だけ後続`click`が再試行します。mouse／penは`pointerdown`、キーボードは`keydown`を使用します。gesture operationと450 msの同一系列抑止により、同じtouchから二重解除しません。

| 経路 | document | audioUnlocked | ゲームBGM | scheduler | メニューtap |
| --- | --- | --- | --- | --- | --- |
| タイトル → はじめから → スロット → ゲーム | 同一 | true | `bgm.normal` | active | 不要 |
| タイトル → つづきから → ゲーム | 同一 | true | `bgm.normal` | active | 不要 |
| 今日の献立 → スロット → ゲーム | 同一 | true | `bgm.normal` | active | 不要 |
| エンディング → 新しい運命 → スロット → ゲーム | 同一 | true | `bgm.normal` | active | 不要 |
| 運命コード → スロット → ゲーム | 同一 | true | `bgm.normal` | active | 不要 |

ゲーム開始時の`location.assign`を除き、保存済みstateの初期化と画面切替を同じdocumentで行います。5経路すべてAudioContext生成は1個、lifecycle listenerは9個で固定、対応する画面SEは最大1回です。BGM／SEの個別muteと両方muteを維持します。

## 二重選択防止

各renderはscene／event／day／choice countを含む一回限りのtokenをA／Bへ発行します。最初のpointer、click、またはkeyboard入力でtransactionを開始し、tokenを失効させ、A／Bのnative `disabled`と`aria-disabled`を同時に有効にします。同じtoken、古い座標、別ボタン、確認dialogの重複入力は処理しません。

次のsceneをrenderしても、最初の入力から最低350 msはlockedのままです。350 ms後に新tokenを有効化します。運命コードの不一致または確認cancelでは同じsceneへ新tokenを発行します。

| 回帰 | 結果 |
| --- | --- |
| 同一座標を80 ms間隔で2回tap | day／choiceCountは1だけ増加 |
| recording timeline | 1件だけ追加 |
| slot保存receipt | 1件だけ追加 |
| 操作SE | 1回だけ発音 |
| 50回click／keyboard連打 | 一操作一遷移 |
| 選択確認ONの二重click | dialog 1個、遷移1回 |
| STORY／HARD／SURVIVAL／四皿／四箱 | すべて同じtransaction契約 |

## 余白double tap

同一位置から24 px以内、360 ms以内、移動12 px以内の単一touchだけをdouble tap候補とします。二度目の`touchend`と対応するsynthetic clickを抑止し、tap前のscrollYを復元します。

選択肢、button、link、input、range slider、textarea、select、summary、contenteditable、ピンチ、スクロール、テキスト選択は対象外です。`user-scalable=no`、`maximum-scale=1`、`touch-action:none`は使用しません。

390×844でタイトル、ゲーム本文、記録、設定、モーダルの余白を検証し、全箇所でdouble tap前後のscrollY差は0、viewport scaleは1のままでした。画面間のgesture系列を分離して各面を独立検証しています。

## 選択後の画面移動

| 保存値 | 表示名 | 動作 |
| --- | --- | --- |
| `context` | 次の出来事へ | 第○日、HP、空腹、イベント名が入る最小位置。既に見えていれば移動しない |
| `choices` | 選択肢へ | A／Bをviewportへ入れ、収まる場合は小型状態表示も残す |
| `off` | 自動で移動しない | scrollYを変更しない |

旧`true`は`context`、旧`false`は`off`、欠損は`context`へ正規化します。320×568、375×667、390×844、430×932で確認し、contextは状態と見出し、choicesはA／Bをviewport内へ収め、offはscrollY差0でした。移動先をdocumentの上下端へ固定せず、手動pointer／touch／wheelで進行中のanimationを取り消すため、連続選択でscroll処理が蓄積しません。

## 全検証

| コマンド | 結果 |
| --- | --- |
| `npm run validate:assets` | PASS。precache 1,430,077 bytes／5 MiB、正式SVG 41点 106,134 bytes |
| `npm test -- --workers=1` | PASS。140件 |
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

完走ランのtrue rare分布はrandom `49.816%／41.004%／9.181%／0%`、allConsume `48.724%／41.776%／9.501%／0%`、omniscientConservative `50.057%／41.376%／8.567%／0%`、humanLike `49.955%／41.306%／8.739%／0%`で、平均は`0.5937／0.6078／0.5851／0.5878`です。例外、無限ループ、不正値、cooldown、oneShot、最大遭遇回数、直近3件、true rare上限の違反はすべて0です。

## オフラインと互換性

初回オンライン起動後の完全オフライン再起動、オフラインの今日の献立、明示更新、manifest 503、画像404、音声decode失敗時の本文・絵文字・二択フォールバックを維持しました。Service Worker cache revisionだけを`1.0.0-rc.3`へ分離しています。

STORY／HARD／SURVIVAL、常時二択、全拒否権、四土、四皿、四箱、3スロット、図鑑174件、実績33件、履歴、今日の献立、運命コード、formatVersion 1／2／3、正式アート41点、BGM 6曲、SE 13種は回帰140件で維持しました。

## 実機判定

自動QAはPASSです。iPhone実機で終了／スリープへ入る瞬間のclick、初回音声、5開始経路、連打、余白double tap、3種の画面移動を再確認後、Issue #18の正式版判定へ進みます。手順は[`RC3_IPHONE_RETEST_CHECKLIST.md`](RC3_IPHONE_RETEST_CHECKLIST.md)を使用します。
