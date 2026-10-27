# 公開・接続ガイド

## おすすめの公開順

1. **GitHub Pages / PWAで試遊**: 今あるURLで手軽に遊んでもらい、30〜90秒の体験、報酬量、強化の楽しさを調整。
2. **CapacitorでAndroid化し、Google Playの内部テストへ**: 同じゲームを同梱でき、後からAdMobやPlay Billingを接続しやすい構成。
3. ログインと保存を実サービスへ接続し、必要なクローズドテスト・実機試験・ストア申告を完了して正式公開。
4. 継続して遊ばれることを確認してから、スキン等の購入と任意の短いリワード広告を導入。

PWAをTWAとしてPlayに載せる選択肢もありますが、今回は将来のネイティブ広告・課金を考え、Capacitorを採用しました。収益・継続率は現時点では測定していません。App Store対応は後工程です。

## あなたが用意するもの

- Google Play Consoleの開発者アカウントと本人確認。登録費用・アカウントごとのテスト要件は登録画面の最新案内で確認。
- 正式なアプリ名・一意のパッケージIDは `com.chani0422.stardodge` に確定済み。登録後のID変更は別アプリになるため、最初のアップロード前に確定しています。
- Android Studio / Android SDK、署名鍵、署名付きAndroid App Bundle（AAB）。署名鍵やパスワードはリポジトリやチャットに貼らず、Play App Signingと安全な保管を使用。
- ストア説明文、スクリーンショット、問い合わせ先、公開プライバシーポリシー、年齢対象・コンテンツレーティング・データセーフティ等の申告。
- ログインを有効にするならSupabaseプロジェクトと送信用SMTP。将来広告を有効にするならAdMob、課金を有効にするならPlay側の商品設定・テストユーザー。

デバッグAPKと未署名AABのビルドまで成功しています。実機確認、正式ID、公開用の署名、ストア申告を終えた提出物ではありません。

## Supabase接続

1. 自分のSupabaseプロジェクトを作成。
2. `backend/schema.sql` を確認し、SQLエディターで実行。RLSは各ユーザー自身の行だけに制限しています。別々の2アカウントで他人のバックアップを読めないことも実サービスで検証してください。
3. メールOTPを有効にし、パスワードレス認証のメールテンプレートに `{{ .Token }}` を含めます。標準のリンクだけではこの画面で入力するコードが届きません。送信元とカスタムSMTPを設定し、実際のユーザーへメールが届くことを確認してください。
4. `backend/functions/delete-account/index.ts` をSupabase Edge Function `delete-account` として配置。Function内ではユーザーJWTを確認して、そのユーザー自身だけを管理APIで削除します。`SUPABASE_SERVICE_ROLE_KEY` はFunction側のみに置きます。関連するバックアップはDBの外部キーで削除されます。
5. `config.js` にプロジェクトURLと publishable（またはanon）**公開キー**を設定。service_role/secretキーは入れないでください。
6. `sw.js` のキャッシュバージョンを更新して再配信。Androidなら `npm run sync` で再同梱。
7. 実メールでログイン→バックアップ保存→別のブラウザで復元→ログアウト→アカウント削除を確認。これまでは通信をモックした確認のみです。

バックアップは手動保存・手動復元で、複数端末間の自動マージはしません。ローカル育成と記録を誤って上書きしないよう、復元前に確認画面を表示します。セッションはsessionStorageでタブ内保持。ネイティブ本番で長期ログインを提供する際は、安全なトークン保管と更新を追加してください。

このバックアップはプレイ報酬の試作データです。競争ランキングや有料通貨の真正性を保証しません。

## アカウント削除

アプリ内のアカウント画面から二段階確認後に削除できます。Webからの入口として `account-delete.html` も用意しました。ログイン後に同じ削除処理を使用します。ストア申告には、このページを実際に公開して接続・削除できる状態で使ってください。未設定の現在は削除サービス自体が未接続です。

## 広告・課金の拡張点

`services.js` の `Monetization` は、次のインターフェースを受け取ります。

```js
new Monetization({
  ads: { showRewarded: async ({ placement, runId }) => providerResult },
  billing: { purchase: async ({ productId }) => providerResult },
  verify: async ({ kind, transactionId, receipt, payload }) => serverResult,
});
```

- プロバイダー結果は `status: 'completed'` / `'cancelled'`、完了時には `transactionId` と検証材料の `receipt` を返します。
- `verify` はサーバーへ接続し、確認後に `verified: true` と `grantId` を返す契約です。SDKの画面が閉じただけでは付与しません。
- このクラスはローカルコインを増やしません。利用可能判定、キャンセル、処理中の多重要求、同じセッション内の重複を扱う骨組みです。
- 本番ではサーバー側の取引ID一意制約・購入権利/残高の台帳・払い戻し/購入復元・承認/消費・広告SSVを実装してください。クライアントの重複防止だけでは不十分です。
- Playでのデジタル商品の販売は、対象地域・プログラムの例外を含む最新のGoogle Play決済ポリシーに従ってPlay Billing等を選定してください。
- リワード広告は終了画面から任意に開始する構成を想定。プレイ中に突然出す配線はありません。SDKのテスト広告から検証し、必要な同意処理を接続してから本番広告へ切り替えます。

現在は広告SDK・Billing SDK・決済サーバー・実商品を接続していません。`config.js` の予定フラグだけをtrueにしても広告/課金が有効になることはありません。プレミアム商品と動画ボタンは準備中のままです。コインで解放する無料ゲーム内スキンショップは利用できます。

## プライバシーポリシー

[雛形](PRIVACY_TEMPLATE.md) に、運営者・連絡先・対象年齢・実際に使うサービスと保存/削除方針を記入してから、Webに公開してください。未記入の雛形は完成した公開ポリシーではありません。広告・課金を有効にした場合には取得データとSDKに合わせて更新が必要です。

## 公式資料

- [Capacitor Android](https://capacitorjs.com/docs/android)
- [Google Play Console](https://play.google.com/console/)
- [Google Playへのアプリ公開](https://support.google.com/googleplay/android-developer/answer/9858738)
- [Google Play Billing](https://developer.android.com/google/play/billing)
- [AdMob](https://admob.google.com/)
- [Supabase メールのパスワードレス認証](https://supabase.com/docs/guides/auth/auth-email-passwordless)

この環境からこれらの公式文書を取得する操作は通信制限403になりました。費用、必要テスト人数・期間、必須APIレベルなど変更される数値は断定していません。提出時には公式の最新要件を確認してください。
