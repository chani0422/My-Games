#!/bin/bash
set -e

# 設定
GAME_NAME="Blackjack"
ZIP_NAME="blackjack_cg_submission.zip"
DIST_DIR="dist"

# 含めるファイル
FILES=(
  "index.html"
  "blackjack.js"
  "blackjack.wasm"
  "blackjack_ui.js"
  "loc.js"
)

# 1. ビルド (任意ですが推奨)
if [ -f "./build_v2.sh" ]; then
  echo "🔨 最新版をビルド中..."
  ./build_v2.sh
else
  echo "⚠️ build_v2.sh が見つかりません。ビルド手順をスキップします。"
fi

# 2. クリーン & Dist ディレクトリ準備
echo "🧹 dist ディレクトリを清掃中..."
rm -rf "$DIST_DIR" "$ZIP_NAME"
mkdir -p "$DIST_DIR"

# 3. ファイルコピー
echo "📂 ファイルをコピー中..."
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    cp "$file" "$DIST_DIR/"
  else
    echo "❌ エラー: 必須ファイル '$file' が見つかりません！"
    exit 1
  fi
done

# 4. Zip 圧縮
echo "📦 Zip 圧縮中..."
cd "$DIST_DIR"

if command -v zip >/dev/null 2>&1; then
  zip -r "../$ZIP_NAME" ./*
else
  echo "⚠️ 'zip' コマンドが見つかりません。Pythonを使用します..."
  # shutil.make_archive は勝手に拡張子 .zip をつけるので、ファイル名からは除く
  python3 -c "import shutil; shutil.make_archive('../blackjack_cg_submission', 'zip', '.')"
fi

cd ..

# 5. 後片付け
# rm -rf "$DIST_DIR" # 任意: 確認用に残しておく

echo "✅ 完了！ $ZIP_NAME が作成されました。"
echo "   このファイルを CrazyGames に提出してください。"
