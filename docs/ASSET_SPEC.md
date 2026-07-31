# v4.7 アセット仕様

## 目的

v4.6.0「森が目を覚ます」で画像、音、画面効果、触覚をゲーム本体から分離し、v4.7.0「いただきますの森」で正式なオリジナルSVGと決定論的Web Audio音楽をその演出基盤へ登録します。`survival-engine.js`、STORY 50、HARD 50、SURVIVAL 50のイベント、数値、選択肢、拒否権、保存PRNG、シード再現性、結末は変更しません。

この版はproject-reignがリポジトリ用に制作した正式背景8点、キャラクター10点、食べ物／イベントカード23点と、サンプル音源を使わないBGM 6曲、SE 13種を同梱します。画像・音声・振動が一つも利用できない環境でも、既存の絵文字、本文、状態表示、結果、二択だけで全ゲームを完了できることを必須とします。

## 対象と非対象

対象は次の演出データです。

- 背景画像
- キャラクター画像と絵文字フォールバック
- 食べ物／イベントカード画像
- 状態・雰囲気を示すCSSエフェクト
- 決定論的Web Audio BGMシーケンス
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

| 種類 | 配置先 | v4.7.0の内容 |
| --- | --- | --- |
| 台帳 | `assets/manifest.json` | ID、割当、cache tier、fallback、license ID |
| 背景 | `assets/backgrounds/` | 1600×900 SVG 8点 |
| カード | `assets/cards/` | 800×800 SVG 23点 |
| キャラクター | `assets/characters/` | 800×1200 SVG 10点＋絵文字fallback |
| BGM | `music-engine.js` | 6曲を固定シーケンスからWeb Audioで合成。音声ファイルなし |
| 効果音 | `assets/manifest.json`／`presentation-engine.js` | 13種をWeb Audioで合成。音声ファイルなし |
| ギャラリー | `asset-gallery.html`／`asset-gallery.js` | 台帳を読み込む開発用自動一覧 |

制作マスター、権利証跡、変換途中のファイルは配信用ディレクトリへ置かず、`dist/` に含めません。

## アセットレジストリ

`assets/manifest.json` を実行時の唯一のアセット台帳とします。

- `schemaVersion`: 台帳構造。v4.7.0は `1`
- `manifestVersion`: アセット集合と割当のキャッシュ版。アプリ版や保存スキーマとは独立
- `budgets`: `precacheBytes`、`presentationPrecacheBytes`、`lazyBytes`
- `assets`: `background`、`character`、`art`、`effect`、`bgm`、`se`
- `assignments`: `screens`、`scenes`、`survival`、`categories`、`endings`
- `hooks`: タイトルや結末などの演出フック
- `actions`: 選択、警告、摂取、拒否、メニューの効果音割当

ファイルを持つ項目は相対 `src`、正しい `mime`、`cache`、代替テキスト、`licenseId` を持ちます。キャラクターには画像失敗時も表示可能な絵文字 `fallback` を指定します。カード画像はさらに安定した意味ID `subject` と、日本語の対象名 `subjectLabel` を持ち、`alt` はその対象名を含めます。BGMは音声ファイルの `src` ではなく、`music-engine.js` の固定テーマID、duration、loop、BPM／bar情報へ解決します。

## IDの安定性

アセットIDは小文字ASCIIの名前空間付きIDにします。例は `background.forest.day`、`character.tako`、`art.rice-ball`、`mood.rare`、`bgm.title`、`se.choice` です。

- 表示名、ファイル名、パス、拡張子、codec、cache versionからIDを生成しない
- 一度公開したIDは別の意味へ再利用しない
- パスやSVGから将来の画像形式へ変換してもIDは維持する
- 廃止が必要な場合は、割当を一度に破壊せずaliasまたは互換mappingを先に追加する
- シーンIDとSURVIVALイベントIDはアセット差し替えのために変更しない
- `backgroundKey`、`characterKey`、`artKey`、`moodKey` は任意項目であり、保存ランの成立条件にしない
- `artKey` を指定する割当は、イベント本文が扱う対象を `contentSubject` で宣言し、参照先カードの `subject` と一致させる
- 内容に合うカードがない場合は別内容のカードを流用せず、`artKey` を省略して絵文字・キャラクター・本文へフォールバックする

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

## v4.7.0正式画像

| 分類 | 点数 | 寸法 | 容量 |
| --- | ---: | ---: | ---: |
| 正式背景 | 8 | 1600×900 | 23,740 bytes |
| 正式キャラクター | 10 | 800×1200 | 21,554 bytes |
| 正式カード | 23 | 800×800 | 59,753 bytes |
| 合計 | 41 | - | 105,047 bytes |

背景は中央の主要構図が9:16の中央クロップに残るよう制作します。すべての正式SVGは次を満たします。

- 日本語の空でない `<title>` と `<desc>` を各1件含む
- 外部画像、外部CSS、外部フォント、埋込フォント、スクリプトを含まない
- `width`、`height`、`viewBox` が台帳と一致する
- 文字表示に特定フォントを要求しない
- GitHub Pagesのサブパスやオフライン状態に依存しない自己完結データとする
- 特定作品、既存IP、作家固有の画風を模倣せず、外部画像・無断素材を取り込まない
- 黒、焦茶、金、深紅、琥珀を基調に、暗い食卓、異常だが美味しそうな料理、少し可愛い人外、静かな不気味さを共有する

## 演出フック

v4.6.0から継承した次の九つのhookを使用します。

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

BGM 6曲と効果音13種はWeb Audio oscillator、gain、固定ノート列から実行時に合成します。録音、外部楽曲、外部サンプル、無許諾素材、ゲーム保存PRNG、`Math.random()` は使いません。

| ID | 曲名 | duration | loop | License ID |
| --- | --- | ---: | --- | --- |
| `bgm.title` | 空の皿 | 51.428571秒 | true | `project-v4.7-generated-audio` |
| `bgm.normal` | 腹の鳴る森 | 56.470588秒 | true | `project-v4.7-generated-audio` |
| `bgm.rare` | あり得ない一皿 | 40秒 | true | `project-v4.7-generated-audio` |
| `bgm.final` | 五十日目 | 73.846154秒 | true | `project-v4.7-generated-audio` |
| `bgm.death` | 残された器 | 16秒 | false | `project-v4.7-generated-audio` |
| `bgm.escape` | 朝食のない朝 | 56.25秒 | true | `project-v4.7-generated-audio` |

SEは `choice`、`warning`、`rare`、`milestone`、`consume`、`refuse`、`achievement`、`death`、`escape`、`menu`、`poison`、`fatigue`、`injury` を区別し、`project-v4.7-synth` で管理します。同じhook/tokenの連続発火を抑え、同時voice数へ上限を設けます。

- `event.isTrusted === true` の最初のpointer、touch、keyboard操作後にだけAudioContextを作成・resumeする
- gesture前にBGMを自動再生しない
- BGMは現在の画面／hookに必要な固定テーマだけをscheduleする
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
| core shell | HTML、web app manifest、ゲーム／演出script、必須icon | core cacheへinstall時に一括保存し、offline起動に必須 |
| asset manifest | `assets/manifest.json` | best-effortで取得し、HTTP 200かつ有効JSONの場合だけcore cacheへ保存 |
| presentation precache | `cache: "precache"` の軽量画像 | 台帳取得後に一件ずつ取得し、HTTP 200だけpresentation cacheへ保存。v4.7.0のSVG 41点を含む |
| lazy runtime | 将来追加する大容量画像・音声など `cache: "lazy"` の実ファイル | install時には取得せず、初回成功response後にpresentation cacheへ保存 |

core shellの一括保存だけを必須install処理とします。asset manifestの通信失敗、503、JSON不正、または個別演出素材の404・通信失敗はinstallをrejectしません。非200 responseは保存せず、一件の失敗後も残りの演出素材を個別に取得します。このため初回installで台帳が503でもcoreだけでoffline再起動でき、一枚のSVGが404でも本文・絵文字・二択で進行できます。

app shellの版とasset manifestの版を別に管理します。URLのqueryやパスを使って未来のイベントを先読みしたり、先読みのためにPRNGを消費したりしません。presentationまたはlazy素材がofflineで未取得なら、その場で絵文字・本文へ戻ります。

新しいService Workerは待機し、プレイヤーが「更新する」を選ぶまで現在のworkerとcacheを維持します。古いcacheの削除は、明示的に受け入れたworkerのactivate時だけ行います。

## 容量予算

容量は圧縮前のソースマスターではなく、リポジトリから配信するencoded bytesで集計します。

| 予算 | 上限 | 対象 |
| --- | ---: | --- |
| 全precache | 5 MiB（5,242,880 bytes） | app shellとpresentation precacheの合計 |
| presentation precache | 2 MiB（2,097,152 bytes） | 台帳でprecache指定した演出素材 |
| lazy assets | 25 MiB（26,214,400 bytes） | 台帳でlazy指定した実ファイルの合計 |

いずれかの上限を超えたbuildは失敗させます。v4.7.0の正式SVG 41点は105,047 bytesで、presentation上限の約5.0%です。BGMとSEは実行時合成のため音声delivery bytesを追加しません。個別ファイルだけでなく三階層ごとの合計を毎回確認します。

## GitHub Pagesサブパス

すべての `src`、manifest URL、fetch URL、Service Workerのprecache URLは `./` から始まる相対URLまたは同等のsubpath-safe URLにします。

- `/assets/...` のようなorigin root固定URLを使わない
- `..` で公開root外へ出ない
- `http:`、`https:`、protocol-relative URLを台帳へ入れない
- `/tabenai-to-shinu/` から取得・offline再起動をテストする
- local root `/` だけで成功してもrelease条件を満たさない

## 制作と差し替え

v4.7.0の正式SVGはproject-reignがリポジトリ内の決定論的生成スクリプトと手動レビューで制作し、外部素材、外部フォント、既存作品や作家固有の画風を組み込んでいません。BGMとSEもプロジェクト作成の固定シーケンス／合成値だけを使い、外部楽曲、録音、サンプルを含みません。

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

実ファイル、CSS効果、Web Audio合成仕様、既存icon、asset gallery、documentation screenshotは [`../ASSET_LICENSES.md`](../ASSET_LICENSES.md) で管理します。

- `licenseId` は台帳の見出しまたは行と一致させる
- ファイルを持たない生成音響も、制作方法、duration、loop、権利状態を記録する
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
- 背景1600×900、キャラクター800×1200、カード800×800
- SVGの日本語 `<title>`／`<desc>`
- カードの `subject`／`subjectLabel`、割当の `contentSubject`、画像altの意味整合
- SVGの外部resource、font、script
- BGM 6曲の固定ID、duration、loop、生成定義と、SE 13種のtrigger
- 存在しないlicense ID
- manifestにない配信用orphan file
- 各cache tierと全precacheの容量
- fallbackに必要な既存emoji・本文UI

Playwrightではunknown ID、manifest取得失敗、画像／音源404、画像／音声decode失敗、全BGMとSE、offline、trusted gesture前後、visibility change、mute、volume、credits、gallery、haptics非対応、明示reduced motion、`prefers-reduced-motion`、light visuals、GitHub Pagesサブパス、明示更新、iPhone 390×844とPC表示を検証します。初回Service Worker install時のasset manifest 503とprecache SVG一枚の404も個別に注入し、coreのactivate、404非cache、完全offlineでの本文・絵文字・二択を確認します。通常起動と完全オフライン再起動ではブラウザwarning／errorを0件にし、意図的なHTTP失敗ではブラウザがnetwork errorを記録しても、未処理例外とゲーム中断を0件にします。

## v4.7.0リリース契約

- `survival-engine.js` を変更せず、STORY／HARDのcanonical digestとSURVIVAL 50,005ランの結果をv4.6.0以前と一致させる
- 既存IDを維持し、新規IDは名前空間規則に従って追加する
- 全41正式SVG、BGM 6曲、SE 13種、gallery、creditsを `ASSET_LICENSES.md` へ登録する
- 容量上限内へ最適化し、任意素材をcore shellのinstall条件にしない
- 画像・音声・manifestを取得／decodeできない状態のfallback testを残す
- 完全offline、明示更新、GitHub Pagesサブパス、旧run／meta／transfer JSON互換を維持する
- 同一seed・同一選択のイベント列、判定、結末がv4.6.0以前と一致することを回帰テストする

## v4.6.0基盤履歴

v4.6.0では正式差し替え前の抽象背景6点と簡易カード9点、合計30,069 bytesを配信し、キャラクター6枠とBGM 6枠は `src: null` でした。v4.7.0はその四層、九hook、設定、安定ID、フォールバック、三cache tier契約を保ったまま正式素材へ置き換えます。v4.6.0時点の個別来歴は [`../ASSET_LICENSES.md`](../ASSET_LICENSES.md) に履歴として残します。
