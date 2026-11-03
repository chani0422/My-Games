# 表示テキストの反映報告（0.5.0）

PR #8マージ済みのmain `82fdd11` から `chore/star-dodge-display-texts` を作成しました。添付 `star-dodge-display-texts (1).md` を文言一覧として参照し、対応する表示を置き換えています。

コードの置換は計62か所です。内訳はindex.html 7、app.js 47、progression.js 7、SWキャッシュ名1。ゲームの条件式・数値・保存形式・ステージ定義・音量/爆発性能は変更しません。公開番号0.5.0 / versionCode 5、アプリID `com.chani0422.stardodge` と署名設定も維持します。

## 一覧とコードの対応

一覧の用途がある項目はすべて対応先を特定しました。現行と一致するものは書き換えていません。

| 添付の節 | 対応先 | 処理 |
| --- | --- | --- |
| 1 枠・固定表示 | index.html、app.js panel/refreshRecords | 導入・記録注記・ガイドを更新。見出し/HUDの実行時表示はapp.jsに対応 |
| 2 フライト案内/HUD | app.js panel/updateUI | 開始前の案内を更新。HUD・カウント・読み上げは一致のため維持 |
| 3 パネル | app.js panel | タイトル/停止本文/3択/結果見出し/エンドレス再挑戦を更新 |
| 4 通知・描画文字 | app.js effects/draw | 殲滅トーストを更新。アイコン・数値・コンボ等は維持 |
| 5 ホーム | app.js renderHome | 導入、メニュー説明、目標達成時の文、報酬説明を更新 |
| 6 ハブ共通 | app.js renderHub | 見出し・所持コインは一致のため維持 |
| 7 ステージ選択 | app.js renderHub(stages)、stages.js stageLabel | 説明・精算注記を更新。惑星名/ステージ名/解放条件の差込は維持 |
| 8 機体 | app.js renderHub(hangar)、progression.js SHIPS/RETIRED_SHIPS | ハンガー説明、パイオニア/ランス説明を更新。ノヴァは後述の強化後の説明を維持 |
| 9 初期強化 | app.js renderHub(upgrades)、progression.js UPGRADES | ハブ説明を更新。4種の名前/説明は一致のため維持 |
| 10 スキル図鑑 | app.js renderHub(skills)、engine.js FLIGHT_CATEGORIES/FLIGHT_UPGRADES/余剰コア | 図鑑の説明を更新。カテゴリ・8種/余剰コアの名前/説明はすべて一致し、engine.jsは変更なし |
| 11 チャレンジ | app.js renderHub(missions)、progression.js MISSIONS | 5件の名前/説明/報酬/進捗/ボタンは一致のため維持 |
| 12 スキン | app.js renderHub(shop)、progression.js SKINS | ショップ説明と5色の説明を更新。名前/価格/解放条件は維持 |
| 13 ライセンス | app.js renderHub(license)、progression.js licenseFor | 最高ランク・オーロラ案内・説明を更新。ランク名/算出式は維持 |
| 14 フライト記録 | app.js renderHub(stats) | 見出し/空表示/書き出し注記を更新。履歴の値とJSONは維持 |
| 15 遊び方・設定 | app.js renderHub(settings) | 音量説明、遊び方、サウンド注記を更新。操作/保存/ゲインは維持 |
| 16 アカウント | app.js renderHub(account)/accountTask | ゲスト見出し、ログイン説明、接続後説明、復元確認文を更新。認証/保存処理は維持 |
| 17 共有 | app.js renderHub(report/share)/shareText/shareResult | JSON表示の説明を更新。共有文/URL/ボタン/結果メッセージは一致のため維持 |
| 18 更新確認 | app.js reloadWhenSafe/更新ボタンのハンドラー | 新版通知の文を更新。他の結果メッセージは一致のため維持 |
| 19 時間形式 | engine.js formatTime、app.js duration | 一致のため維持。丸め/計算/保存値は変更なし |

## 変更した用途ごとの位置

行番号はこの変更のコードを基準とします。長いHTMLテンプレートでは同じ行に複数の用途があります。

| 添付の節 | 用途 | コード |
| ---: | --- | --- |
| 1 | 導入文（エンドレス） | [index.html:35](../index.html#L35) |
| 1 | 記録カードの注記 | [index.html:41](../index.html#L41) |
| 1 | ガイド1 | [index.html:49](../index.html#L49) |
| 1 | ガイド2・見出し | [index.html:57](../index.html#L57) |
| 1 | ガイド2・補足 | [index.html:58](../index.html#L58) |
| 1 | ガイド3・見出し | [index.html:65](../index.html#L65) |
| 1 | ガイド3・補足 | [index.html:66](../index.html#L66) |
| 2 | ステージ開始前の案内 | [app.js:145](../app.js#L145) |
| 2 | エンドレス開始前の案内 | [app.js:146](../app.js#L146) |
| 3 | 開始前パネル・見出し | [app.js:167](../app.js#L167) |
| 3 | 開始前パネル・本文 | [app.js:167](../app.js#L167) |
| 3 | 一時停止パネル・本文 | [app.js:170](../app.js#L170) |
| 3 | 強化コア3択・見出し | [app.js:175](../app.js#L175) |
| 3 | 結果・全ステージ制覇 | [app.js:180](../app.js#L180) |
| 3 | 結果・ステージクリア | [app.js:180](../app.js#L180) |
| 3 | 結果・ゲームオーバー | [app.js:180](../app.js#L180) |
| 3 | 結果・エンドレス再挑戦 | [app.js:180](../app.js#L180) |
| 4 | 30秒経過（殲滅開始） | [app.js:255](../app.js#L255) |
| 5 | 導入文の前半 | [app.js:819](../app.js#L819) |
| 5 | 導入文・エンドレス | [app.js:819](../app.js#L819) |
| 5 | 導入文・ステージ | [app.js:819](../app.js#L819) |
| 5 | ステージ要約・エンドレス見出し | [app.js:820](../app.js#L820) |
| 5 | 目標達成済みの文 | [app.js:820](../app.js#L820) |
| 5 | 画面下の報酬説明 | [app.js:820](../app.js#L820) |
| 5 | ホームメニュー・初期スキル強化 | [app.js:820](../app.js#L820) |
| 5 | ホームメニュー・スキル図鑑 | [app.js:820](../app.js#L820) |
| 5 | ホームメニュー・ショップ | [app.js:820](../app.js#L820) |
| 5 | ホームメニュー・遊び方・設定 | [app.js:820](../app.js#L820) |
| 7 | 説明文 | [app.js:887](../app.js#L887) |
| 7 | 下部の注記 | [app.js:895](../app.js#L895) |
| 8 | 説明文 | [app.js:899](../app.js#L899) |
| 8 | パイオニア説明 | [progression.js:18](../progression.js#L18) |
| 8 | ランス説明 | [progression.js:29](../progression.js#L29) |
| 9 | 説明文 | [app.js:911](../app.js#L911) |
| 10 | 説明文 | [app.js:919](../app.js#L919) |
| 10 | 初期強化セクションの説明 | [app.js:931](../app.js#L931) |
| 12 | 説明文 | [app.js:950](../app.js#L950) |
| 12 | オーロラ説明 | [progression.js:122](../progression.js#L122) |
| 12 | ゴールド説明 | [progression.js:130](../progression.js#L130) |
| 12 | ネビュラ説明 | [progression.js:137](../progression.js#L137) |
| 12 | フロスト説明 | [progression.js:144](../progression.js#L144) |
| 12 | ローズフレア説明 | [progression.js:151](../progression.js#L151) |
| 13 | 最高ランク時 | [app.js:971](../app.js#L971) |
| 13 | オーロラ案内本文 | [app.js:971](../app.js#L971) |
| 13 | 下部の説明 | [app.js:971](../app.js#L971) |
| 14 | 履歴見出し | [app.js:976](../app.js#L976) |
| 14 | 履歴が空のとき | [app.js:985](../app.js#L985) |
| 14 | 書き出しの注記 | [app.js:986](../app.js#L986) |
| 15 | 音量・説明 | [app.js:990](../app.js#L990) |
| 15 | 遊び方・見出し | [app.js:990](../app.js#L990) |
| 15 | 遊び方・段落1 | [app.js:990](../app.js#L990) |
| 15 | 遊び方・段落2 | [app.js:990](../app.js#L990) |
| 15 | 遊び方・段落3 | [app.js:990](../app.js#L990) |
| 15 | 遊び方・段落4 | [app.js:990](../app.js#L990) |
| 15 | 演出設定・下部の注記 | [app.js:990](../app.js#L990) |
| 16 | 準備中・見出し | [app.js:1003](../app.js#L1003) |
| 16 | ログイン・説明 | [app.js:1006](../app.js#L1006) |
| 16 | ログイン後・説明 | [app.js:1009](../app.js#L1009) |
| 16 | 復元説明 | [app.js:1032](../app.js#L1032) |
| 17 | 記録JSONハブの説明 | [app.js:994](../app.js#L994) |
| 18 | 新しいバージョンの通知 | [app.js:1306](../app.js#L1306) |
| 共通 | キャッシュ識別子 | [sw.js:3](../sw.js#L3) |

## 個別の扱い・対応できなかった行

- **添付第1節の表に、用途・テキストが両方空の行が2行あります。** 対応先を特定できないため、削除や置換は推測せず行っていません。一覧にないフッター右側の標語や「最新版を確認」ボタンの文言も現行を維持します。
- 第3節「一時停止パネル」の本文は、用途が明記されていて本文だけが空なので、既存の段落要素を残してテキストを空にしました。
- ノヴァ強化PR #8はマージ済みです。一覧にある旧「半径70・固定1・連鎖なし」は適用せず、mainの「半径120・弾と同じダメージ（上限3）・連鎖1段・発射間隔115%」の説明をそのまま維持しました。
- 結果見出しだけは指定の「地球 Stage1 Clear！」にするため、既存の `stageLabel(game.stage.id)` の戻り値を表示上で `ステージ → Stage` と変換します。差込元・ステージ番号・条件分岐は維持し、他のステージ表示は日本語のままです。
- 各種アイコン、HTML要素、属性、ボタンのaction/id、一覧にないアクセシビリティ属性は維持します。添付の「補足」は元のsmall要素などへ対応させています。

用途のある行で対応先が不明だったものはありません。

## 文言だけであることの確認

- app.js/progression.js/sw.jsの構文木をmainと比較。文字列・テンプレートの文字部分・上記結果見出しの表示変換を除き、条件式・呼び出し・数値・アクションに差分がないことを確認しました。
- index.htmlはDOMの要素構造と全属性がmainと一致し、テキストノードだけが異なります。
- engine.js、stages.js、audio.js、effects.js、services.js、config.jsはmainとバイト単位で一致。機体/初期強化/スキン/チャレンジの表示名・説明を除くデータも一致します。
- バージョン、AndroidのアプリID/署名/ビルド設定をmainと照合。保存形式・価格・報酬・性能の変更はありません。

SWのキャッシュ名だけ `star-dodge-shell-v0-5-0-display-texts` にし、同じ0.5.0でも新しい表示一式を配信します。READMEと音量ガイドの現行キャッシュ名も合わせています。過去の実装報告書は書き換えていません。

## テスト・同期

- Node全127件が成功（失敗0、スキップ0）。新しいテストの追加・既存テストの削除はありません。
- 既存ブラウザ12本がすべて成功。PC1440×1000、390×844、360×640を含みます。
- 文言の期待値を更新したのはstages.browser.test.cjs/elimination.browser.test.cjsのクリア見出し・全クリア見出し・殲滅通知、キャッシュ名の期待値を更新したのはupdates.browser.test.cjs/planets-cache.browser.test.cjsです。アサートの削除はありません。
- 別途3サイズでホーム/全ハブ/設定/ゲスト表示/停止本文/結果を確認し、遊び方の5段落が添付と完全一致すること、ダイアログに横方向のはみ出しがないことを確認しました。
- `cd star-dodge/mobile && npm run sync` が成功。wwwとAndroid publicへ13アセットを同期し、ソースと一致することを確認しました（index.htmlのネイティブ読込差を考慮）。

新しい表示の目印はホームの「機体を強化して」、3択の「スキルを選択」、クリア時の「地球 Stage1 Clear！」などです。マージ後、フライト終了とワーカー更新後にWebを再読み込みして確認してください。公開番号の表示は0.5.0のままです。
