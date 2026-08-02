# 1.0.0-rc.1 STORY／HARD 全ルート到達確認

生成日: 2026-08-02

生成方法: ブラウザ内の保存PRNGと実ゲーム遷移関数を使用した機械列挙。

## 結果

| モード | シーン | 遷移 | 到達不能 | 循環 | 行き止まり | 二択違反 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| STORY 50 | 44 | 102 | 0 | 0 | 0 | 0 |
| HARD 50 | 44 | 102 | 0 | 0 | 0 | 0 |

STORYとHARDは同じ44シーン・102遷移グラフを共有し、HARDの差は初期値・日次負荷・判定補正だけです。全遷移を両モードで実行し、各画面の選択肢数が常に2であることを確認しました。拒否種別（`skip`）は共有グラフ上で34遷移です。

canonical digest: STORY `6d3acaf7` ／ HARD `6ce87897`（v4.9.0と不変）。

## 全シーン

| # | scene ID | 表示名 | 列挙遷移数 |
| ---: | --- | --- | ---: |
| 1 | `riceball` | 少し温かいおにぎり | 2 |
| 2 | `gel` | 青白く光るゼリー | 2 |
| 3 | `mushroom` | 「焼けば美味」の赤キノコ | 2 |
| 4 | `can` | 「たすけて」と聞こえる缶詰 | 2 |
| 5 | `soap` | イチゴの香りのピンク石けん | 2 |
| 6 | `apple` | 願いを叶える黄金のリンゴ | 2 |
| 7 | `chocolate` | 三日間空腹にならない黒チョコ | 2 |
| 8 | `memoryJuice` | 「思い出味」の透明ジュース | 2 |
| 9 | `potato` | 「絶対に安全」と書かれたジャガイモ | 2 |
| 10 | `capsule` | 赤と青のカプセル | 2 |
| 11 | `capsuleSelect` | 飲むカプセルを選べ | 2 |
| 12 | `poisonCake` | 猛毒を食べる紫色ケーキ | 2 |
| 13 | `timeNoodle` | 昨日に戻るカップ麺 | 2 |
| 14 | `loopCake` | 二周目の紫色ケーキ | 2 |
| 15 | `pizza` | 食べた人が二人になるピザ | 2 |
| 16 | `clonePudding` | 本物判定の黒プリン | 2 |
| 17 | `clonePuddingWho` | 誰が黒プリンを食べる？ | 2 |
| 18 | `cookie` | 一度だけ死なないクッキー | 2 |
| 19 | `collapse` | 崩れ落ちる石柱 | 4 |
| 20 | `collapseAction` | 石柱への対処 | 4 |
| 21 | `jrEgg` | 解毒寄生虫の卵 | 2 |
| 22 | `jrEggUse` | 卵をどうする？ | 2 |
| 23 | `bean` | 鼓動する黒豆 | 2 |
| 24 | `beanUse` | 黒豆との関わり方 | 2 |
| 25 | `soil` | 白い土と赤い土 | 2 |
| 26 | `soilColor` | どちらの土へ埋める？ | 2 |
| 27 | `sandwich` | 半分だけ存在するサンドイッチ | 2 |
| 28 | `shadow` | 空腹になった影 | 8 |
| 29 | `shadowFoodType` | 影へ何を使う？ | 4 |
| 30 | `shadowRiceBread` | ご飯か黒いパンか | 4 |
| 31 | `beanDeadline` | 40日目直前の黒い根 | 2 |
| 32 | `beanDeadlineAction` | 黒い根への対処 | 2 |
| 33 | `graySoil` | 三つ目の灰色の土 | 2 |
| 34 | `futureLunch` | 未来の自分が作った弁当 | 2 |
| 35 | `moss` | 最古のものを知る石碑の苔 | 2 |
| 36 | `saladTrial` | 最後の晩餐・試食① 新鮮なサラダ | 2 |
| 37 | `meatTrial` | 最後の晩餐・試食② 焦げた肉 | 2 |
| 38 | `soupTrial` | 最後の晩餐・試食③ 空のスープ | 2 |
| 39 | `cakeTrial` | 最後の晩餐・試食④ 腐りかけのケーキ | 2 |
| 40 | `restoreDrop` | 全快ドロップ | 2 |
| 41 | `eveRice` | 前夜のおにぎり | 2 |
| 42 | `finalPair` | 最後の晩餐――二つの列 | 2 |
| 43 | `finalDish` | 最後の晩餐――一皿を選べ | 2 |
| 44 | `finalCommit` | 最後の一口 | 2 |

## 全102遷移（STORY／HARD共有）

| # | scene ID | 状態variant | 選択 | 表示 | 種別 | 遷移先／結末 |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `riceball` | default | A | 食べる | eat | `gel` |
| 2 | `riceball` | default | B | 食べない | skip | `gel` |
| 3 | `gel` | default | A | 食べる | eat | `mushroom` |
| 4 | `gel` | default | B | 食べない | skip | `mushroom` |
| 5 | `mushroom` | default | A | 焼いて食べる | eat | `can` |
| 6 | `mushroom` | default | B | 食べない | skip | `can` |
| 7 | `can` | default | A | 開けて食べる | eat | `soap` |
| 8 | `can` | default | B | 食べない | skip | `soap` |
| 9 | `soap` | default | A | 食べる | eat | `apple` |
| 10 | `soap` | default | B | 食べない | skip | `apple` |
| 11 | `apple` | default | A | 食べる | eat | `chocolate` |
| 12 | `apple` | default | B | 食べない | skip | `chocolate` |
| 13 | `chocolate` | default | A | 食べる | eat | `memoryJuice` |
| 14 | `chocolate` | default | B | 食べない | skip | `memoryJuice` |
| 15 | `memoryJuice` | default | A | 飲む | eat | `potato` |
| 16 | `memoryJuice` | default | B | 飲まない | skip | `potato` |
| 17 | `potato` | default | A | 食べる | eat | `capsule` |
| 18 | `potato` | default | B | 食べない | skip | `capsule` |
| 19 | `capsule` | default | A | どちらかを飲む |  | `capsuleSelect` |
| 20 | `capsule` | default | B | どちらも飲まない | skip | `poisonCake` |
| 21 | `capsuleSelect` | default | A | 赤を飲む | eat | `poisonCake` |
| 22 | `capsuleSelect` | default | B | 青を飲む | eat | `poisonCake` |
| 23 | `poisonCake` | default | A | 先に食べる | eat | `timeNoodle` |
| 24 | `poisonCake` | default | B | 食べない | skip | `timeNoodle` |
| 25 | `timeNoodle` | default | A | 食べる | eat | `loopCake` |
| 26 | `timeNoodle` | default | B | 食べない | skip | `pizza` |
| 27 | `loopCake` | default | A | 食べる | eat | `pizza` |
| 28 | `loopCake` | default | B | 逃げる | skip | `pizza` |
| 29 | `pizza` | default | A | 食べる | eat | `clonePudding` |
| 30 | `pizza` | default | B | 食べない | skip | `cookie` |
| 31 | `clonePudding` | default | A | プリンで判定する |  | `clonePuddingWho` |
| 32 | `clonePudding` | default | B | 誰にも食べさせない | skip | `cookie` |
| 33 | `clonePuddingWho` | default | A | 自分が食べる | eat | `cookie` |
| 34 | `clonePuddingWho` | default | B | もう一人に食べさせる | eat | `cookie` |
| 35 | `cookie` | default | A | 食べる | eat | `collapse` |
| 36 | `cookie` | default | B | 食べない | skip | `collapse` |
| 37 | `collapse` | default | A | 何かする |  | `collapseAction` |
| 38 | `collapse` | default | B | 何もしない |  | `END: death` |
| 39 | `collapse` | jr-egg | A | 何かする |  | `collapseAction` |
| 40 | `collapse` | jr-egg | B | 何もしない |  | `jrEgg` |
| 41 | `collapseAction` | default | A | 仲間を庇う |  | `END: death` |
| 42 | `collapseAction` | default | B | 全力で避ける |  | `bean` |
| 43 | `collapseAction` | jr-egg | A | 仲間を庇う |  | `jrEgg` |
| 44 | `collapseAction` | jr-egg | B | 全力で避ける |  | `jrEgg` |
| 45 | `jrEgg` | default | A | 卵に手を出す |  | `jrEggUse` |
| 46 | `jrEgg` | default | B | 何もしない | skip | `bean` |
| 47 | `jrEggUse` | default | A | 卵を食べる | eat | `bean` |
| 48 | `jrEggUse` | default | B | 食料を与えて育てる |  | `bean` |
| 49 | `bean` | default | A | 黒豆に関わる |  | `beanUse` |
| 50 | `bean` | default | B | 何もせず置いていく | skip | `sandwich` |
| 51 | `beanUse` | default | A | 食べる | eat | `soil` |
| 52 | `beanUse` | default | B | 食べずに持つ |  | `soil` |
| 53 | `soil` | default | A | どちらかの土へ埋める |  | `soilColor` |
| 54 | `soil` | default | B | まだ埋めない |  | `sandwich` |
| 55 | `soilColor` | default | A | 白い土へ埋める |  | `sandwich` |
| 56 | `soilColor` | default | B | 赤い土へ埋める |  | `sandwich` |
| 57 | `sandwich` | default | A | 食べる | eat | `shadow` |
| 58 | `sandwich` | default | B | 食べない | skip | `shadow` |
| 59 | `shadow` | default | A | 白いご飯を食べる | eat | `futureLunch` |
| 60 | `shadow` | default | B | 何も食べずに進む | skip | `futureLunch` |
| 61 | `shadow` | hungry | A | 食べ物を使う |  | `shadowFoodType` |
| 62 | `shadow` | hungry | B | 何もしない | skip | `futureLunch` |
| 63 | `shadow` | bean | A | 白いご飯を食べる | eat | `beanDeadline` |
| 64 | `shadow` | bean | B | 何も食べずに進む | skip | `beanDeadline` |
| 65 | `shadow` | hungry-bean | A | 食べ物を使う |  | `shadowFoodType` |
| 66 | `shadow` | hungry-bean | B | 何もしない | skip | `beanDeadline` |
| 67 | `shadowFoodType` | default | A | ご飯か黒いパンを使う |  | `shadowRiceBread` |
| 68 | `shadowFoodType` | default | B | 食べられるろうそくを食べる | eat | `futureLunch` |
| 69 | `shadowFoodType` | bean | A | ご飯か黒いパンを使う |  | `shadowRiceBread` |
| 70 | `shadowFoodType` | bean | B | 食べられるろうそくを食べる | eat | `beanDeadline` |
| 71 | `shadowRiceBread` | default | A | 白いご飯を自分で食べる | eat | `futureLunch` |
| 72 | `shadowRiceBread` | default | B | 黒いパンを影に与える | eat | `futureLunch` |
| 73 | `shadowRiceBread` | bean | A | 白いご飯を自分で食べる | eat | `beanDeadline` |
| 74 | `shadowRiceBread` | bean | B | 黒いパンを影に与える | eat | `beanDeadline` |
| 75 | `beanDeadline` | default | A | 今すぐ対処する |  | `beanDeadlineAction` |
| 76 | `beanDeadline` | default | B | 何もしない | skip | `graySoil` |
| 77 | `beanDeadlineAction` | default | A | 根を引き抜く |  | `futureLunch` |
| 78 | `beanDeadlineAction` | default | B | 発芽を受け入れる |  | `futureLunch` |
| 79 | `graySoil` | default | A | 灰色の土へ埋める |  | `futureLunch` |
| 80 | `graySoil` | default | B | ここでも何もしない | skip | `futureLunch` |
| 81 | `futureLunch` | default | A | 食べる | eat | `moss` |
| 82 | `futureLunch` | default | B | 食べない | skip | `moss` |
| 83 | `moss` | default | A | 苔を食べる | eat | `saladTrial` |
| 84 | `moss` | default | B | 食べない | skip | `saladTrial` |
| 85 | `saladTrial` | default | A | ひと口食べる | eat | `meatTrial` |
| 86 | `saladTrial` | default | B | 食べない | skip | `meatTrial` |
| 87 | `meatTrial` | default | A | 食べる | eat | `soupTrial` |
| 88 | `meatTrial` | default | B | 食べない | skip | `soupTrial` |
| 89 | `soupTrial` | default | A | 食べる | eat | `cakeTrial` |
| 90 | `soupTrial` | default | B | 食べない | skip | `cakeTrial` |
| 91 | `cakeTrial` | default | A | 食べる | eat | `restoreDrop` |
| 92 | `cakeTrial` | default | B | 食べない | skip | `restoreDrop` |
| 93 | `restoreDrop` | default | A | 食べる | eat | `eveRice` |
| 94 | `restoreDrop` | default | B | 食べない | skip | `eveRice` |
| 95 | `eveRice` | default | A | 食べる | eat | `finalPair` |
| 96 | `eveRice` | default | B | 食べない | skip | `finalPair` |
| 97 | `finalPair` | default | A | 上段の二皿から選ぶ |  | `finalDish` |
| 98 | `finalPair` | default | B | 下段の二皿から選ぶ |  | `finalDish` |
| 99 | `finalDish` | default | A | 🥗 新鮮なサラダに見える皿 |  | `finalCommit` |
| 100 | `finalDish` | default | B | 🍖 焦げた肉に見える皿 |  | `finalCommit` |
| 101 | `finalCommit` | default | A | 食べる | eat | `END: salad` |
| 102 | `finalCommit` | default | B | 食べない | skip | `END: refuse` |

## エンディング到達

STORY／HARDの双方で次の14結末へ到達しました: `death`, `starve`, `ancient`, `monster_clear`, `party`, `true`, `shield`, `salad`, `human_again`, `regeneration_loop`, `overgrowth`, `shadow_exit`, `blank`, `refuse`.

白い土・赤い土・灰色の土・身体発芽、四皿、最後の拒否は専用回帰テストでも個別に到達確認しています。
