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
    "_revive"
  ]' \
  -s EXPORTED_RUNTIME_METHODS='["cwrap","UTF8ToString"]' \
  -o blackjack.js


echo "OK: blackjack.js / blackjack.wasm"
