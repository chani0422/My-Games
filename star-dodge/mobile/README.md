# STAR DODGE Android / Capacitor 8

ブラウザ版と同じゲームを同梱するAndroidプロジェクトです。バックエンドの起動や外部サイトの読み込みは不要です。認証は接続設定をした場合だけネットワークを利用します。

## 検証済み

- Node.js 24 / Capacitor CLI・Core・Android 8.5.3、App plugin 8.1.2。
- ロックファイルからの `npm ci`、ゲームのパッケージ化、`cap add android`、`cap sync android` が成功。
- ゲーム用のランチャーアイコン、縦画面指定、起動色を設定。
- `App` プラグインのアプリ非アクティブ時の停止と、Androidの戻る操作の処理を用意。実機のコールバックは未検証。

JDK 21・Android SDKを導入し、`assembleDebug bundleRelease` が成功しました（274タスク実行）。デバッグAPKの署名とゲームファイルの同梱、未署名AABの構造を検証済みです。エミュレーター・実機、公開用の署名、Play Console提出は未実施です。

クラウドの成果物は `/workspace/artifacts/star-dodge-0.4-debug.apk` と `/workspace/artifacts/star-dodge-0.4-unsigned.aab` にあります。AABは未署名のため、そのままストア提出するものではありません。

## 手元で開く

Node.js、JDK 21、Android StudioとAndroid SDK（このテンプレートのcompile/targetはAPI 36）を用意します。SDK・ストア要件の最新版も確認してください。

```sh
cd star-dodge/mobile
npm ci
npm run sync
npm run open
```

CLIでのビルドは `npm run android:debug` / `npm run android:bundle`。出力は `android/app/build/outputs/` 以下です。ビルド補助スクリプトは、このクラウドでは `/workspace/toolchains/` のSDK・JDK・Gradleキャッシュと既存のHTTPSプロキシを再利用します。TLS検証を維持し、Gradle配布物のSHA256も固定しています。

Android StudioでSDKパスを設定し、デバイスまたはエミュレーターで実行します。Web側を変更したら `npm run sync` を再実行してください。

`www/` と `android/app/src/main/assets/public/` は生成物です。ゲームの原本を編集し、生成物を直接変更しないでください。

## 公開前

- 仮ID `dev.stardodge.app` を正式な一意のIDに確定。変更する場合は `capacitor.config.json`、Androidのnamespace/applicationId、JavaパッケージをAndroid StudioのRefactor等で一致させます。
- `versionCode` をリリースごとに増やします。
- Android Studioで署名付きAABを生成し、Play Consoleの内部テストへ。署名鍵はGit管理しません。
- バックグラウンド、戻る、画面ロック、音、オフライン、データ更新、低スペック端末を実機確認。
- 認証・広告・決済を有効にする際は [接続ガイド](../docs/RELEASE.md) を参照し、実サービスで検証。
- プライバシーポリシー、削除導線、ストア画像、年齢/データ申告などを完成させます。

この段階のアプリにはAdMob・Play Billingは入っていません。実際の収益化にはプロバイダーとサーバー側の検証・権利管理が必要です。

0.4.0 / versionCode 4には10ステージ・可視判定・コインの初回クリア報酬を同梱しています。Webを更新してもインストール済みAPKの内容は自動更新されません。同じID・同じ署名の新版を上書きインストールして確認してください。アンインストールは端末内の育成を削除します。
