# v4.6 アセット仕様

## 目的

v4.6.0「森が目を覚ます」は、画像、音、画面効果、触覚をゲーム本体から分離し、安全に差し替えるための演出基盤です。STORY 50、HARD 50、SURVIVAL 50のイベント、数値、選択肢、拒否権、保存PRNG、シード再現性、結末を変更しません。

この版で同梱する画像はプロジェクト作成の軽量なプレースホルダーです。正式なキャラクター絵、イベント絵、背景、BGMはv4.7で差し替えます。画像・音声・振動が一つも利用できない環境でも、既存の絵文字、本文、状態表示、結果、二択だけで全ゲームを完了できることを必須とします。

## 対象と非対象

対象は次の演出データです。

- 背景画像
- キャラクター画像と絵文字フォールバック
- 食べ物／イベントカード画像
- 状態・雰囲気を示すCSSエフェクト
- BGM差し替えスロット
- Web Audioで合成する効果音
- 対応端末向けの触覚パターン
- 画面、シーン、イベント、結末、演出フックへの割当

次のデータはこの仕様の演出処理から変更してはいけません。

- シーンIDとSURVIVALイベントID
- 保存ランと保存PRNG
- 選択肢、判定、数値、フラグ、実績、結末、統計
- ランスキーマ `version: 4`
- `tabenai-to-shinu-50days-v4` と `tabenai-to-shinu-meta-v1`
- セーブ移行 `formatVersion: 1` と `formatVersion: 2`

## 配置

配信用アセットは次の場所へ置きます。

| 種類 | 配置先 | v4.6.0の内容 |
| --- | --- | --- |
| 台帳 | `assets/manifest.json` | ID、割当、cache tier、fallback、license ID |
| 背景 | `assets/backgrounds/` | 1600×900 SVG 6点 |
| カード | `assets/cards/` | 800×800 SVG 9点 |
| キャラクター | 将来の `assets/characters/` | v4.6.0ではファイルなし、絵文字のみ |
| BGM | 将来の `assets/audio/bgm/` | v4.6.0ではファイルなし、slotのみ |
| 効果音 | ファイルなし | `assets/manifest.json` の値からWeb Audioで合成 |

制作マスター、権利証跡、変換途中のファイルは配信用ディレクトリへ置かず、`dist/` に含めません。

## アセットレジストリ

`assets/manifest.json` を実行時の唯一のアセット台帳とします。

- `schemaVersion`: 台帳構造。v4.6.0は `1`
- `manifestVersion`: アセット集合と割当のキャッシュ版。アプリ版や保存スキーマとは独立
- `budgets`: `precacheBytes`、`presentationPrecacheBytes`、`lazyBytes`
- `assets`: `background`、`character`、`art`、`effect`、`bgm`、`se`
- `assignments`: `screens`、`scenes`、`survival`、`categories`、`endings`
- `hooks`: タイトルや結末などの演出フック
- `actions`: 選択、警告、摂取、拒否、メニューの効果音割当

ファイルを持つ項目は相対 `src`、正しい `mime`、`cache`、代替テキスト、`licenseId` を持ちます。ファイルを持たない差し替え枠は `src: null` とし、キャラクターには表示可能な絵文字 `fallback` を指定できます。

## IDの安定性

アセットIDは小文字ASCIIの名前空間付きIDにします。例は `background.forest.day`、`character.tako`、`art.rice-ball`、`mood.rare`、`bgm.title`、`se.choice` です。

- 表示名、ファイル名、パス、拡張子、codec、cache versionからIDを生成しない
- 一度公開したIDは別の意味へ再利用しない
- パスやSVGから将来の画像形式へ変換してもIDは維持する
- 廃止が必要な場合は、割当を一度に破壊せずaliasまたは互換mappingを先に追加する
- シーンIDとSURVIVALイベントIDはアセット差し替えのために変更しない
- `backgroundKey`、`characterKey`、`artKey`、`moodKey` は任意項目であり、保存ランの成立条件にしない

新規IDは `^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$` に合致させ、種類と名前空間が一致するようにします。

## 割当と解決順

表示時は次の順で割当を解決し、後の項目が前の項目を上書きします。

1. 画面の場合は `assignments.screens`
2. 結末の場合は `assignments.endings`
3. ゲーム中はイベント分類の `assignments.categories`
4. STORY／HARDは `assignments.scenes`、SURVIVALは `assignments.survival`
5. 呼出側が明示した `backgroundKey`、`characterKey`、`artKey`、`moodKey`

解決したIDが存在しない、項目に `src` がない、台帳を取得できない、HTTPエラー、decodeエラーのいずれかが起きた場合は、画像を非表示にして既存の絵文字と本文を表示します。例外をゲーム側へ投げず、選択肢、保存、PRNGを変更しません。

## 四つのvisual layer

ゲーム画面の重なり順は次のとおりです。

1. `background`: 場所と時間を示す背景
2. `character`: 同行者・遭遇者。ファイルがない場合は絵文字
3. `art`: 食べ物・器・箱などのイベントカード
4. `effect`: warning、rare、milestoneなどのCSS状態演出

本文、状態値、結果、常時二つの選択肢は四層より前面に置きます。画像のaltや効果のaria labelは補助情報であり、ゲーム上の危険・効果・結果は必ず本文にも記載します。

タイトル画面には同じ背景台帳を使用できます。遅れて読み込んだ旧シーンの画像が新シーンへ表示されないよう、描画generationを照合してから反映します。

## v4.6.0同梱画像

| 分類 | 点数 | 寸法 | 容量 |
| --- | ---: | ---: | ---: |
| 抽象背景 | 6 | 1600×900 | 14,677 bytes |
| 簡易カード | 9 | 800×800 | 15,392 bytes |
| 合計 | 15 | - | 30,069 bytes |

背景は中央の主要構図が9:16の中央クロップに残るよう制作します。SVGは次を満たします。

- 日本語の空でない `<title>` と `<desc>` を各1件含む
- 外部画像、外部CSS、外部フォント、埋込フォント、スクリプトを含まない
- `width`、`height`、`viewBox` が台帳と一致する
- 文字表示に特定フォントを要求しない
- GitHub Pagesのサブパスやオフライン状態に依存しない自己完結データとする

## 演出フック

v4.6.0は次の九つのhookを定義します。

| Hook | 用途 |
| --- | --- |
| `title` | タイトル起動 |
| `normal` | 通常の画面・遭遇 |
| `warning` | 危険状態・高危険選択 |
| `rare` | 低確率遭遇 |
| `milestone` | 10日ごとの節目など |
| `final` | 最終選択 |
| `death` | 死亡・餓死 |
| `escape` | 生還・脱出 |
| `achievement` | 実績解除 |

同じhookとtokenを再描画しただけでは、効果音や触覚を重複再生しません。hookは表示・音・触覚だけを起動し、ゲーム進行の条件や結果には使いません。

## 音声と触覚

効果音10種はWeb Audio oscillatorとgainで実行時に合成します。サンプル音源は同梱しません。BGMは `title`、`normal`、`rare`、`final`、`death`、`escape` の6枠を定義しますが、v4.6.0の `src` はすべて `null` です。

- `event.isTrusted === true` の最初のpointer、touch、keyboard操作後にだけAudioContextを作成・resumeする
- gesture前にBGMを自動再生しない
- BGMファイル追加後も `preload="none"` とし、必要になってから取得する
- documentがhiddenになったらBGMをpauseし、AudioContextをsuspendする
- 再表示時は解禁済み、非mute、ブラウザ許可済みの場合だけresumeする
- 音声失敗は無音へ戻し、本文・選択・ゲーム進行を維持する
- `bgmVolume` と `seVolume` は0〜1へ正規化する
- `bgmMuted` と `seMuted` は独立して保存する
- hapticsは `navigator.vibrate` が存在し、設定が有効な場合だけ実行する

旧metaに新しい設定がない場合は既定値を補い、既存値を削除しません。BGM／SE音量・mute、`haptics`、`lightVisuals` はmetaと移行JSONへ含めます。

## motionとアクセシビリティ

- 明示設定 `reducedMotion` または `prefers-reduced-motion: reduce` のどちらかが有効なら、非本質的なanimationとtransitionを抑制する
- `lightVisuals` が有効なら背景、キャラクター、カード画像を読み込まず、絵文字と本文を使う
- 振動、音、色、動き、画像だけで警告、成功、失敗、選択結果を伝えない
- 画像404、音声非対応、振動非対応を通常の対応環境として扱う
- achievement通知はaria live領域と本文記録を維持する
- iPhone 390×844で本文と二択への到達距離を悪化させない

## キャッシュ階層

Service Workerは用途の異なる三つの配信tierを区別します。物理cacheはversion付きのcoreとpresentationの二つです。presentation precacheとlazy runtimeは同じpresentation cacheを使いますが、install時に取得するか、初回の成功response後に保存するかが異なります。

| Tier | 内容 | 方針 |
| --- | --- | --- |
| core shell | HTML、manifest、Service Worker、ゲーム／演出script、必須icon | core cacheへinstall時に保存し、offline起動に必須 |
| presentation precache | `cache: "precache"` の軽量画像と台帳 | presentation cacheへinstall時に保存。v4.6.0のSVG 15点を含む |
| lazy runtime | 将来のcharacter画像、BGMなど `cache: "lazy"` のファイル | install時には取得せず、初回成功response後にpresentation cacheへ保存 |

app shellの版とasset manifestの版を別に管理します。URLのqueryやパスを使って未来のイベントを先読みしたり、先読みのためにPRNGを消費したりしません。lazy素材がofflineで未取得なら、その場で絵文字・本文へ戻ります。

新しいService Workerは待機し、プレイヤーが「更新する」を選ぶまで現在のworkerとcacheを維持します。古いcacheの削除は、明示的に受け入れたworkerのactivate時だけ行います。

## 容量予算

容量は圧縮前のソースマスターではなく、リポジトリから配信するencoded bytesで集計します。

| 予算 | 上限 | 対象 |
| --- | ---: | --- |
| 全precache | 5 MiB（5,242,880 bytes） | app shellとpresentation precacheの合計 |
| v4.6 presentation precache | 2 MiB（2,097,152 bytes） | 台帳でprecache指定した演出素材 |
| lazy assets | 25 MiB（26,214,400 bytes） | 台帳でlazy指定した実ファイルの合計 |

いずれかの上限を超えたbuildは失敗させます。v4.6.0のプレースホルダー15点は30,069 bytesで、presentation上限の約1.4%です。正式素材へ差し替える際は、個別ファイルだけでなく三階層ごとの合計を確認します。

## GitHub Pagesサブパス

すべての `src`、manifest URL、fetch URL、Service Workerのprecache URLは `./` から始まる相対URLまたは同等のsubpath-safe URLにします。

- `/assets/...` のようなorigin root固定URLを使わない
- `..` で公開root外へ出ない
- `http:`、`https:`、protocol-relative URLを台帳へ入れない
- `/tabenai-to-shinu/` から取得・offline再起動をテストする
- local root `/` だけで成功してもrelease条件を満たさない

## 制作と差し替え

v4.6.0のSVGはproject-reignがリポジトリ内で直接制作した抽象プレースホルダーで、外部素材を組み込んでいません。正式素材はv4.7で制作・選定します。

新しい素材を追加するときは次を記録します。

1. 安定IDと用途
2. creator／rightsholder
3. 制作方法、使用toolとversion
4. source URLまたは権利証跡
5. 元素材・referenceの権利
6. 変換、crop、色調整などの改変内容
7. 正確なlicense、許諾範囲、attribution
8. 配信path、MIME、寸法またはduration、cache tier
9. 追加日とreview日

AI生成素材を採用する場合はprovider、model、version、生成日、operator、promptまたはprompt記録、seedがある場合はseed、入力referenceの権利、手動編集、利用条件reviewも記録します。第三者素材を無断で取得してはいけません。正式な許諾が未指定の場合は「未指定」と記録し、推測でopen-source licenseを付与しません。

画像形式、path、圧縮率を変えても同じ内容・役割ならIDを維持します。派生variantは親素材のlicense IDと変換内容を記録します。差し替え後も古いcache、404、decode失敗を想定した絵文字・本文fallbackを削除しません。

## ライセンス台帳

実ファイル、CSS効果、Web Audio合成仕様、slot、既存icon、documentation screenshotは [`../ASSET_LICENSES.md`](../ASSET_LICENSES.md) で管理します。

- `licenseId` は台帳の見出しまたは行と一致させる
- ファイルがないslotも、非同梱であることを記録する
- platform emojiはglyphやfontを同梱していないことを記録する
- root `LICENSE` が存在しない限り、この台帳を一般的な再利用許諾と解釈しない
- package依存関係のlicenseはアセット台帳とは別に管理する

## Build検証

release前に次を実行します。

```bash
npm run validate:assets
npm test
npm run build
```

`validate:assets` は少なくとも次を検査します。

- schemaとmanifest version
- 重複、形式不正、種類不一致のID
- missing file、absolute URL、path escape
- 拡張子とMIME
- 背景1600×900、カード800×800
- SVGの日本語 `<title>`／`<desc>`
- SVGの外部resource、font、script
- 存在しないlicense ID
- manifestにない配信用orphan file
- 各cache tierと全precacheの容量
- fallbackに必要な既存emoji・本文UI

Playwrightではunknown ID、manifest取得失敗、画像404、offline、trusted gesture前後、visibility change、mute、volume、haptics非対応、明示reduced motion、`prefers-reduced-motion`、light visuals、GitHub Pagesサブパス、明示更新、iPhone 390×844を検証します。通常起動と完全オフライン再起動ではブラウザwarning／errorを0件にし、意図的なHTTP失敗ではブラウザがnetwork errorを記録しても、未処理例外とゲーム中断を0件にします。

## v4.7への引継ぎ

v4.7で正式素材を入れる際も、ゲームロジックと保存形式は変更しません。

- 既存IDを維持し `src`、`mime`、cache tier、alt、license IDだけを必要に応じて更新する
- characterとBGMの `src: null` slotへ正式ファイルを割り当てる
- 全正式素材を `ASSET_LICENSES.md` へ登録する
- 容量上限内へ最適化し、lazy素材を不用意にprecacheへ移さない
- 画像・音声を取得できない状態のfallback testを残す
- 同一seed・同一選択のイベント列、判定、結末がv4.6.0以前と一致することを回帰テストする
