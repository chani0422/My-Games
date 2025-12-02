#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# emsdk_env.sh を自動で探す
ENV=""
if [ -f "./emsdk/emsdk_env.sh" ]; then ENV="./emsdk/emsdk_env.sh"
elif [ -f "../emsdk/emsdk_env.sh" ]; then ENV="../emsdk/emsdk_env.sh"
elif [ -f "../../emsdk/emsdk_env.sh" ]; then ENV="../../emsdk/emsdk_env.sh"
else
  echo "emsdk_env.sh not found. edit build_v2.sh" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV"

emcc blackjack_engine.cpp -O2 \
  -s WASM=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString"]' \
  -o blackjack_v2.js

echo "OK: blackjack_v2.js / blackjack_v2.wasm"
