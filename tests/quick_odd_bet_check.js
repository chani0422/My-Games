// tests/quick_odd_bet_check.js

// ビルドした blackjack.js を読む
const createModule = require("../blackjack.js");

createModule().then((Module) => {
  const start_session = Module.cwrap(
    "start_session",
    "number",
    ["number", "number", "number", "number", "number"]
  );
  const set_bet = Module.cwrap("set_bet", "number", ["number"]);
  const get_state_json = Module.cwrap("get_state_json", "number", []);
  const UTF8ToString = Module.UTF8ToString;

  console.log("start_session:", start_session(1, 0, 0xFFFFFFFF, 300, 12));

  // ★ 奇数ベットの挙動チェック
  const ret = set_bet(11);
  console.log("set_bet(11) ret =", ret);

  const ptr = get_state_json();
  const jsonStr = UTF8ToString(ptr);
  Module._free_ptr(ptr);

  const state = JSON.parse(jsonStr);
  console.log("lastErrorCode =", state.lastErrorCode);
  console.log("lastError =", state.lastError);
});
