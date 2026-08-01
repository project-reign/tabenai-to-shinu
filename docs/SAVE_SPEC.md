# 保存・周回記録仕様

この文書は v4.8.0「食卓の記憶庫」の localStorage、セーブ移行JSON、図鑑、ラン履歴、運命コード、日替わり記録の互換契約です。アプリの表示バージョン、ラン本体、ローカルworkspace、移行JSON、運命コードは独立して版管理します。

## 版の境界

| 層 | 現行版 | 役割 | 互換契約 |
| --- | ---: | --- | --- |
| アプリ | `4.8.0` | 画面と配信物のSemVer | 保存形式とは独立 |
| ラン本体 | `version: 4` | 進行、モード、seed、PRNG、場面、フラグ | v4.2.1から不変。上げない |
| ローカルworkspace | `version: 1` | 3スロットとrecord collectionの正規化 | `records-engine.js` 内部形式 |
| 移行JSON | `formatVersion: 3` | 全体／単一スロットの持ち出し | 1／2／3を読み込む |
| 運命コード | `TABENAI-FATE-1.` | ゲーム版、モード、seed、明示選択列 | preview後に新規開始 |
| 日替わり | `fnv1a32-jst-v1` | JST日付からSURVIVAL seedを生成 | 同じ日付なら全端末同値 |

ラン本体へrecord wrapperを入れたり、`version: 4` をアプリ版に合わせて変更したりしてはいけません。STORY／HARD／SURVIVALの保存PRNGは、記録、ID、共有、日替わり処理から読み取りも消費もしません。

## localStorageキー

| キー | 内容 | 必須動作 |
| --- | --- | --- |
| `tabenai-to-shinu-run-slots-v1` | `slot-1`〜`slot-3`、各slot名、run、作成／更新日時、移行情報 | 3スロットのsource of truth |
| `tabenai-to-shinu-active-slot-v1` | active slot ID | 空slotや不正IDはactiveにしない |
| `tabenai-to-shinu-run-history-v1` | 完了ラン履歴 | run IDで重複排除、最大30件 |
| `tabenai-to-shinu-codex-v1` | 食べ物／イベント／仲間・存在／エンディング図鑑 | committed receiptで冪等更新 |
| `tabenai-to-shinu-daily-v1` | 日付別「今日の献立」記録 | JST日付をキーに永続化 |
| `tabenai-to-shinu-run-slots-migrated-v1` | 旧単一ランの移行済みmarker | `1` なら再コピー禁止 |
| `tabenai-to-shinu-50days-v4` | active slotのラン本体mirror | 旧実装が読めるraw runを維持 |
| `tabenai-to-shinu-meta-v1` | 実績、通算統計、設定 | slot削除やrun置換から独立 |
| `tabenai-to-shinu-endings-v4` | 旧エンディング互換記録 | 読み込み・移行を継続 |

active slotを書き込む時は、そのrunを従来キー `tabenai-to-shinu-50days-v4` にも同じラン本体としてmirrorします。旧キーをworkspace全体で上書きしてはいけません。active slotを変更した時はmirrorも切り替え、active runの自動／手動保存はslotとmirrorの両方へ反映します。

## 3セーブスロット

各slotは次を持ちます。

```json
{
  "id": "slot-1",
  "name": "スロット 1",
  "run": { "version": 4 },
  "createdAt": "2026-08-01T00:00:00.000Z",
  "updatedAt": "2026-08-01T00:10:00.000Z"
}
```

一覧表示は少なくともモード、日数、HP、空腹、seed、現在場面、仲間、最終プレイ日時をrunから要約します。STORY 50、HARD 50、SURVIVAL 50はいずれも任意slotへ保存できます。

- 新規開始は先に保存先を選ぶ。使用中slotなら明示確認後だけ上書きする。
- 再開は選んだslotをactiveにしてから、そのrunを従来キーへmirrorする。
- 名前変更はrunを変えない。
- 複製はrunのJSON内容を別slotへコピーし、ゲームPRNGを進めない。使用中の複製先は明示確認する。
- import／複製時はrun内の `recording.slotId` を実際の格納先へ正規化し、古いslot claimで別slotを上書きしない。
- 削除は対象slotだけを空にする。meta、図鑑、履歴、日替わり記録、他slotは削除しない。
- active slotを削除した場合は、残るrunの最新slotをactiveへ切り替え、削除済みrunを再びmirrorしない。他のrunがなければactiveを解除する。

## 旧単一ランの一度だけの移行

初回起動時、workspaceに移行markerがなく、`tabenai-to-shinu-50days-v4` にrunがあり、`slot-1` が空なら、そのrunを `slot-1` へコピーしてactiveにします。その後はrunの有無や移行成否にかかわらずmarkerを保存します。

slot workspaceが一度作成された後は、旧v2/v3 localStorage keyを再読込しません。最後のslot削除や空workspace復元の後も、旧runを復活させません。破損したv4 mirrorと健全な旧keyが初回移行時に同居する場合はkeyごとに独立してparseし、健全な旧runだけを一度移行します。

| 状態 | 結果 |
| --- | --- |
| markerなし、旧runあり、slot 1空 | slot 1へ一度だけ移行しactive化 |
| markerあり | 旧runを再コピーしない |
| markerなし、旧runなし | 「移行対象なし」を記録し、後日の誤コピーを防ぐ |
| markerなし、slot 1使用中 | 既存slot 1を優先し、旧runで上書きしない |

モードを持たないrunは既存migrationで `mode: "story"` に正規化します。ラン本体の `version: 4`、scene、seed、PRNG、flags、memories、companions、statsは保持します。

## セーブ移行JSON

新規書き出しの共通headerは次です。

```json
{
  "format": "tabenai-save",
  "formatVersion": 3,
  "appVersion": "4.8.0",
  "scope": "all",
  "slots": [],
  "activeSlotId": "slot-1",
  "meta": {},
  "endings": {},
  "codex": {},
  "history": [],
  "dailyRecords": {},
  "run": {},
  "state": {}
}
```

`run` と `state` はactive runの後方互換mirrorです。`scope: "all"` は3slotと全collectionを含み、`scope: "slot"` は選択した一つの非空slotを含みます。どちらもmeta、endings、codex、history、dailyRecordsを含めます。

### 読み込み移行表

| 入力 | 読み込むrun | slot配置 | 永続データ |
| --- | --- | --- | --- |
| `formatVersion`省略／`1` | `run`、なければ`state` | slot 1固定 | 入力に存在するmeta／endingsを移行し、欠落するcodex／history／dailyは現在の記録を保持 |
| `formatVersion: 2` | `run`、なければ`state` | slot 1固定 | 入力に存在するmeta／endingsを移行し、欠落するcodex／history／dailyは現在の記録を保持 |
| `formatVersion: 3`, `scope: "slot"` | 収録された単一slot | previewで選んだ一つ、未指定なら元slot | meta／endings／codex／history／dailyを移行 |
| `formatVersion: 3`, `scope: "all"` | 収録された全slot | 同じslot IDへ全体復元 | active slotと全collectionを復元 |

入力内容は保存前に正規化し、次をpreviewします。

- formatVersion、appVersion、scope
- slot名とモード／日数／HP／空腹／seed／場面／仲間
- active slot
- 上書き対象slot ID
- 図鑑、履歴、日替わり記録の件数

previewはlocalStorageを変更しません。上書き対象がある場合は確認後だけ適用します。不正なformat、未知のformatVersion、不正slot ID、runなしの旧形式、0／1以外の運命選択列は拒否します。

## 永続図鑑

カテゴリは `foods`、`events`、`characters`、`endings` です。各entryは安定IDと次を保持します。

- 初遭遇日時、最終遭遇日時、遭遇回数、遭遇モード
- 選択A／B回数、プレイヤー本人の摂取回数、直接拒否回数
- 到達result ID、関連asset ID
- 表示名、絵文字、hidden状態、discovered状態

実際のランで遭遇または選択をcommitした時だけ更新します。run ID、場面／イベントID、選択番号、処理段階を含む安定receiptを保存し、同じreceiptは再描画、reload、再開で加算しません。debug表示、asset gallery、import preview、運命コードpreviewは解除元になりません。

未発見の通常項目は `???` またはsilhouetteで示します。hidden項目は未発見中、名称、解除条件、画像をすべて伏せます。画像の404やdecode失敗では絵文字と本文へfallbackし、発見状態や進行を変えません。

## 詳細リザルトとラン履歴

完了runは、次の入力から決定論的 `runId` を生成します。

- mode
- seed
- startedAt
- ending code
- ordered explicit choices

`Math.random()`、ゲームPRNG、画像、音声、現在の描画状態は使いません。同じ `runId` は二度登録せず、履歴は新しい順に最大30件です。

結果はmode、seed、日数、ending、title、HP、hunger、選択数、摂取、拒否、companions、memories、白／赤／灰／身体豆route、rare encounters、milestones、final dish、final box、brought-home item、解除実績、明示選択列、timelineを保持します。結果カードの共有文と運命コードはこの保存済み結果から作ります。

## 運命コード

運命コードは `TABENAI-FATE-1.` にbase64url化した安定JSONを続けます。

```json
{
  "format": "tabenai-fate",
  "formatVersion": 1,
  "gameVersion": "4.8.0",
  "mode": "survival",
  "seed": 1264873921,
  "choices": [0, 1, 0]
}
```

読み込み時はコードをdecodeし、gameVersion、mode、seed、選択数をpreviewしてから新しいslotへ開始します。各選択は0または1だけです。同じgameVersion、mode、seed、ordered choicesを適用すれば、イベント列、判定、結末を再現します。コード生成、decode、previewはゲーム保存PRNGを消費しません。

## 今日の献立

端末の現在時刻をJSTへ変換し、`YYYY-MM-DD` を確定します。seedは32-bit FNV-1aで次をhashします。

```text
tabenai-daily:fnv1a32-jst-v1:YYYY-MM-DD
```

固定例:

| JST日付 | seed |
| --- | ---: |
| `2026-08-01` | `1264873921` |
| `2026-08-02` | `1214541064` |
| `2027-01-01` | `1456818755` |

モードは常にSURVIVAL 50です。同じ日付の再挑戦も同じseedを使います。日付別に初回開始日時、最終プレイ日時、挑戦数、最高到達日、クリア状態、最後の死亡理由、選択数を保存します。attempt IDとrun IDを使ったreceiptで、reloadによる挑戦／完了の重複加算を防ぎます。

サーバー、外部API、時刻配信、オンラインランキングを使いません。初回オンライン起動でcore shellを取得した後は、日替わりseed生成、開始、保存、再起動を完全オフラインで行えます。

## 破損と容量不足

各split keyは個別にJSON parseします。一つのkeyが壊れていても、他の読み取り可能なslot、meta、codex、history、dailyを消去しません。history内の一項目だけが不正な場合はその項目だけを隔離し、前後の健全な履歴を保持します。壊れた部分は安全な空構造へ正規化し、warningを表示できる形で返します。

書き込み前後の概算は、keyとUTF-8 JSON valueのbyte数を合計します。空のworkspaceは実装テスト時点で約614 bytes（runとmetaを除く）です。実使用量は図鑑entry、3 run、history timelineによって増え、ブラウザのlocalStorage quotaは固定値として仮定しません。

quota超過時は次の順で縮退します。

1. 古い完了runからtimeline本文を外し、選択数と縮退markerを残す。
2. まだ収まらなければ、最も古い完了runから履歴を削る。
3. active／inactive slotのrun、active mirror、meta、codex、daily、settingsは削らない。
4. それでも保存できなければ、進行を失ったと偽装せず、保存失敗を利用者へ通知する。

任意履歴の縮退はゲーム状態、seed、PRNG、分岐結果を変更しません。

## オフラインとPWA

`records-engine.js` はcore shellに含め、GitHub Pagesのサブパス相対URLで取得します。record collectionと日替わりseedはlocalStorageだけで完結します。asset manifest 503、画像／音響404、decode失敗でも保存画面、本文、絵文字、状態、二択を利用でき、最初のオンライン起動後は完全オフライン再起動できます。

Service Workerの更新は従来どおり利用者の明示操作で適用します。更新時にlocalStorageをclearしてはいけません。core installは任意の演出assetから独立し、失敗responseをcacheしません。

## 絶対不変条件

- `survival-engine.js` を変更しない。
- STORY／HARDのcanonical digestとSURVIVAL 50,005 runの結果を変えない。
- すべてのplayable sceneは常に二択とし、食べない／飲まない／服用しない／何もしない拒否権を維持する。
- 白、赤、灰、身体発芽の豆routeを維持する。
- STORYの四皿、SURVIVALの四箱と最終拒否を維持する。
- v4.8以前の23実績、ending、statistics、settingsを維持し、解除を重複登録しない。
- 正式art 41点、BGM 6曲、SE 13種と、画像／音響なしのfallbackを維持する。
- 旧run、旧meta、run `version: 4`、transfer `formatVersion: 1`／`2`／`3` を読める。
- ゲーム結果、record ID、receipt、運命コード、日替わりseedへ `Math.random()` を使わない。
- GitHub Pagesサブパス、明示更新、初回オンライン後の完全オフライン再起動を維持する。
