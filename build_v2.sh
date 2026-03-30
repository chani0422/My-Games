#!/bin/bash
set -e

GAME=${1:-BlackJack}   # 引数がなければ BlackJack

echo "=== Building $GAME (v2) -> blackjack.js ==="

./emsdk/upstream/emscripten/emcc ${GAME}.cpp -O2 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=0 \
  -s ENVIRONMENT="web,node" \
  -s EXPORTED_FUNCTIONS='[
    "_start_session",
    "_reset_session",
    "_set_time_left_ms",
    "_set_paused",
    "_set_bet",
    "_deal",
    "_hit",
    "_stand",
    "_double_down",
    "_split",
    "_surrender",
    "_buy_insurance",
    "_take_even_money",
    "_next_round",
    "_get_state_json",
    "_free_ptr",
    "_add_funds",
    "_revive",
    "_debug_deal_ace",
    "_debug_deal_split",
    "_force_shuffle"
  ]' \
  -s EXPORTED_RUNTIME_METHODS='["cwrap","UTF8ToString"]' \
  -o blackjack.js


# ビルド完了の表示
echo "OK: blackjack.js / blackjack.wasm"

# ビルドID（UNIXタイムスタンプ）を生成してキャッシュ対策を行う
BUILD_ID=$(date +%s)
echo "ビルドIDを設定中: $BUILD_ID"

if [ -f index.html ]; then
    # index.html 内の __BUILD_ID__ を現在のビルドIDで置換する
    # sed実行時の安全のため一時ファイルを使用して上書き
    sed "s/__BUILD_ID__/$BUILD_ID/g" index.html > index.html.tmp && mv index.html.tmp index.html
    echo "index.html のビルドIDを更新しました。"
else
    echo "警告: index.html が見つかりません。置換スキップ。"
fi
