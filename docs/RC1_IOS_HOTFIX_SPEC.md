# 1.0.0-rc.1 iPhone実機Hotfix仕様

## 背景

RC1のiPhoneホーム画面PWA実機スモークテストでは、更新、セーブ保持、3モード、音声、触覚、画面回転、再起動復帰、機内モード、表示崩れの全項目が合格した。

ただし、正式版昇格前に次の2点を修正・再確認する。

1. アプリ終了／iPhoneスリープ後、復帰して最初に操作した時に意図しない短い音が鳴ることがある。
2. 選択肢以外の場所をダブルタップするとSafariのダブルタップ拡大が起きる。

## 1. 復帰時の意図しない音

### 現状候補

`presentation-engine.js`は`visibilitychange`で非表示時にBGMを停止・AudioContextをsuspendし、表示復帰時にAudioContextとBGM schedulerを自動再開する。

実機では、suspend前にlook-aheadで予約されたvoice、復帰時のscheduler再同期、AudioContextの自動resumeが組み合わさり、最初の操作付近でSEのような短音に聞こえる可能性がある。

### 要件

- `hidden/pagehide`でBGM schedulerを停止し、将来予約済みのBGM voiceを安全にflushする。
- `visible/pageshow`だけではAudioContextやBGMを自動再開しない。
- 復帰後の最初のtrustedな`pointerdown`／`touchend`／`keydown`でのみ再開する。
- 再開処理そのものはSEを鳴らさない。
- 同じ操作で本来鳴る選択／メニューSEは1回だけ鳴る。
- BGMは短いfade-inで復帰し、予約音のburstや先頭accentの不自然な単発音を出さない。
- BGM／SEミュート中は無音を維持する。
- 画面復帰だけ、フォーカス復帰だけ、OSのロック解除だけでは発音しない。
- `visibilitychange`、`pagehide`、`pageshow`、`freeze`／`resume`が利用可能な環境で重複処理しない。
- ゲームPRNG、ゲーム状態、保存形式を変更しない。

### 診断

開発表示だけに、リングバッファ形式のaudio lifecycle logを追加可能。

- hidden / visible
- pagehide / pageshow
- context suspend / resume
- gesture resume armed / consumed
- bgm scheduler stop / flush / restart
- cue key

公開画面には表示しない。

## 2. ダブルタップ拡大

### 方針

- ページの操作領域に`touch-action: manipulation`を適用し、ダブルタップ拡大を抑止する。
- 縦スクロールとピンチズームは維持する。
- `user-scalable=no`、`maximum-scale=1`、全面`touch-action:none`は使用しない。
- 選択肢、カード余白、タイトル画面、記録、設定、モーダルで確認する。
- テキスト選択、フォーム入力、スライダー、スクロールを壊さない。

## テスト

- 復帰直後、無操作で1秒待ってもoscillator／cue開始0。
- hidden→visible→最初のtapでBGM復帰、resume専用SE 0。
- 最初のtapが選択肢なら選択SEは1回。
- 最初のtapが非操作余白ならSE 0、BGMだけfade-in。
- 10回のsleep／wake相当反復でactive voice、timer、listenerが増殖しない。
- BGM muted／SE muted／両方mutedの各状態。
- pagehide/pageshow persisted true（BFCache相当）。
- 320×568、390×844、430×932でdouble tapによるviewport scale変化なし。
- ピンチズーム可能、縦スクロール可能。
- 既存123テストを維持し追加テストを行う。
- STORY/HARD digest、SURVIVAL 500,000ラン結果、保存互換を維持。

## 完了条件

- Draft hotfix PRを作成し自動マージしない。
- RC版は`1.0.0-rc.2`へ更新する。
- iPhone実機で再確認後に正式版1.0.0昇格を判定する。
