const createModule = require("../blackjack_test.js");

function assert(cond, msg){
  if(!cond) throw new Error("ASSERT: " + msg);
}

(async () => {
  const Module = await createModule();

  const api = {
    start_session: Module.cwrap('start_session', 'number', ['number','number','number','number','number']),
    set_bet: Module.cwrap('set_bet', 'number', ['number']),
    deal: Module.cwrap('deal', 'number', []),
    hit: Module.cwrap('hit', 'number', []),
    stand: Module.cwrap('stand', 'number', []),
    double_down: Module.cwrap('double_down', 'number', []),
    split: Module.cwrap('split', 'number', []),
    surrender: Module.cwrap('surrender', 'number', []),
    buy_insurance: Module.cwrap('buy_insurance', 'number', ['number']),
    take_even_money: Module.cwrap('take_even_money', 'number', []),

    get_state_json: Module.cwrap('get_state_json', 'number', []),
    free_ptr: Module.cwrap('free_ptr', null, ['number']),

    debug_set_shoe: Module.cwrap('debug_set_shoe', 'number', ['string']),
  };

  function state(){
    const p = api.get_state_json();
    const s = Module.UTF8ToString(p);
    api.free_ptr(p);
    return JSON.parse(s);
  }

  function start(){
    const seedLo = 1, seedHi = 2;
    const rulesMask = 255;      // 全ON
    const sessionSeconds = 300;
    const roundLimit = 12;
    api.start_session(seedLo, seedHi, rulesMask, sessionSeconds, roundLimit);
    return state();
  }

  // --- TEST 0: start_session -> betting
  let st = start();
  assert(st.phase === "betting", "phase should be betting");

  // --- TEST 1: odd bet should fail (must be even)
  let rc = api.set_bet(101);
  st = state();
  assert(rc !== 0 && st.lastErrorCode !== 0, "odd bet must error");

  // --- TEST 2: surrender (late) w/ dealer up Ace -> insurance -> surrender => -bet/2
  start();
  api.set_bet(100);
  // deal順: P1, Dup, P2, Dhole, (以降ヒット等)
  // 例: player 8+5=13 / dealer A + 9 (BJじゃない)
  api.debug_set_shoe("8C,AH,5D,9S");
  rc = api.deal();
  st = state();
  assert(st.phase === "offerInsurance", "should offer insurance on Ace");
  api.buy_insurance(0); // peekしてBJじゃないのを確定
  st = state();
  assert(st.phase === "inHand", "should continue to inHand");
  rc = api.surrender();
  st = state();
  assert(st.phase === "roundOver", "surrender ends round");
  assert(st.roundResult.netProfit === -50, "surrender netProfit should be -bet/2");

  // --- TEST 3: double_down -> 1枚引いて強制終了 + 勝ちで+200
  start();
  api.set_bet(100);
  // player: 5+6=11 / dealer: 6 + Q = 16 / double card: 10 / dealer hit: 2 (->18)
  api.debug_set_shoe("5C,6D,6H,QS,10C,2S");
  api.deal();
  rc = api.double_down();
  st = state();
  assert(st.phase === "roundOver", "double should finish round (single hand)");
  assert(st.bank === 1200, "bank should be 1200 after double win (net +200)");
  assert(st.roundResult.netProfit === 200, "netProfit should be +200");

  // --- TEST 4: split creates 2 hands and disables surrender
  start();
  api.set_bet(100);
  // player 8,8 / dealer 6,9 / split draw: 2,3
  api.debug_set_shoe("8C,6D,8H,9S,2C,3D");
  api.deal();
  rc = api.split();
  st = state();
  assert(rc === 0, "split should succeed");
  assert(st.player.hands.length === 2, "hands length should be 2 after split");
  assert(st.can.surrender === false, "no surrender after split (spec)");

  console.log("ALL TESTS OK");
})().catch(e => {
  console.error(e);
  process.exit(1);
});
