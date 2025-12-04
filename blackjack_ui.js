// ========= Global =========
let Engine = null;
let bjApi = null;
let state = null;
let engineReady = false;

//const $ = (id)=>document.getElementById(id);

// ========= Load WASM =========
// blackjack_v2.js exports Module() (async)
Module().then(mod => {
  Engine = mod;
  engineReady = true;

  bjApi = {
    start_session: Engine.cwrap('start_session', 'number', ['number','number','number','number','number']),
    reset_session: Engine.cwrap('reset_session', 'number', []),
    set_time_left_ms: Engine.cwrap('set_time_left_ms', 'number', ['number']),
    set_paused: Engine.cwrap('set_paused', 'number', ['number']),
    set_bet: Engine.cwrap('set_bet', 'number', ['number']),
    deal: Engine.cwrap('deal', 'number', []),
    hit: Engine.cwrap('hit', 'number', []),
    stand: Engine.cwrap('stand', 'number', []),
    double_down: Engine.cwrap('double_down', 'number', []),
    split: Engine.cwrap('split', 'number', []),
    surrender: Engine.cwrap('surrender', 'number', []),
    buy_insurance: Engine.cwrap('buy_insurance', 'number', ['number']),
    take_even_money: Engine.cwrap('take_even_money', 'number', []),
    get_state_json: Engine.cwrap('get_state_json', 'number', []),
    free_ptr: Engine.cwrap('free_ptr', null, ['number']),
  };

  $("subLine").textContent = "ready.";
  toast("Engine ready");
  refresh(); // 初回反映
});
