
const RESOURCES = {
  en: {
    // Top bar
    "ui.booting": "booting…",
    "ui.loading": "LOADING",
    "ui.ready": "ready.",
    "ui.engine_ready": "Engine ready!",
    "ui.engine_not_ready": "engine not ready",
    
    // Stats & Menu
    "stats.bank": "Bank",
    "stats.round": "Round",
    "stats.time": "Time",
    "menu.menu": "MENU",
    "menu.history": "History",
    "menu.reset": "Reset",
    "menu.ranking": "Ranking",
    
    // Titles & Home
    "title.payout": "🎰 BLACKJACK PAYS 3 TO 2 • INSURANCE PAYS 2 TO 1",
    "title.main": "Blackjack",
    "title.sub": "Aim for a personal best in the ranking!!",
    "title.deal_start": "DEAL / START",
    "title.how": "How to Play",
    "title.bet_hint": "Bet (Even number recommended to avoid fractional insurance)",
    "title.options": "Options (Toggle ON/OFF)",
    "title.tips": "Tips: Reset is executed by 'Tap once to arm → Hold 2s'",
    "title.marking": "Markings/Controls",
    
    // Options
    "opt.double": "Double Down",
    "opt.split": "Split",
    "opt.surrender": "Surrender (Late)",
    "opt.insurance": "Insurance",
    "opt.even_money": "Even Money",
    "opt.das": "DAS",
    "opt.split_bj": "Split BJ as BJ",
    "opt.h17": "Dealer hits Soft 17",
    
    // Game Screen
    "game.garage": "CASINO TABLE",
    "game.bet_info": "BET / INFO",
    "game.bet": "Bet",
    "game.set": "SET",
    "game.dock_hint": "Main actions are in DOCK",
    "game.more": "MORE",
    "game.more_title": "More actions",
    "game.more_hint": "※Functions only when available.",
    
    // Side Panel commands
    "cmd.double": "Double",
    "cmd.split": "Split",
    "cmd.surrender": "Surrender",
    "cmd.even_money": "Even Money",
    
    // Insurance Side
    "ins.insurance": "Insurance",
    "ins.max": "MAX",
    "ins.dock_hint": "Select YES / NO in DOCK below",
    "ins.yes": "YES",
    "ins.no": "NO",
    
    // DOCK
    "dock.deal": "DEAL",
    "dock.hit": "HIT",
    "dock.stand": "STAND",
    
    // Overlays
    "so.session_over": "SESSION OVER",
    "so.calculating": "Calculating…",
    "so.wait": "Please wait…",
    "so.sponsored": "Sponsored",
    "so.to_title": "To Title",
    "so.retry": "EARN 5000 & RETRY",
    "so.revive": "📺 Watch Ad to Revive (+500)",
    
    "pause.title": "PAUSED",
    "pause.close": "Close",
    "pause.msg": "Session will not end. 'Continue' to return, 'Quit' to title.",
    "pause.continue": "Continue",
    "pause.quit": "Quit to Title",
    
    "how.title": "HOW TO PLAY",
    "how.close": "Close",
    "how.goal": "Goal: Get close to 21 (Over 21 is Bust)",
    "how.cards": "10/J/Q/K are all 10, A is 1 or 11",
    "how.deal": "DEAL to start (Next round during RoundOver)",
    "how.double": "Double: Add equal bet -> Force Stand after 1 Hit",
    "how.split": "Split: Same 'value' OK. Ace split ends after 1 card",
    "how.surrender": "Surrender: First 2 cards only. Half bet returned (Late/after peek)",
    "how.insurance": "Insurance: Only when Dealer shows A. Max bet/2",
    "how.even_money": "Even Money: Offered on Player BJ",
    "how.note": "※State.can is truth. Buttons disable automatically.",
    
    "hist.title": "HISTORY",
    "hist.close": "Close",
    "hist.msg": "Recording recent round results (Max 100). Saved in browser.",
    "hist.none": "No history yet.",
    
    "rank.title": "RANKING",
    "rank.close": "Close",
    "rank.msg": "Saving session results (by Profit) (Max 50).",
    "rank.name": "Name (Optional)",
    "rank.none": "No ranking yet.",
    "rank.saved": "Saved Ranking: ",
    
    // Debug/Toasts
    "toast.good_luck": "Good luck!",
    "toast.bet_adjusted": "Bet adjusted to Bank",
    "toast.reset_hold": "Hold 2s to reset",
    "toast.holding": "Holding…",
    "toast.reset_done": "Reset!",
    "toast.ranking_cleared": "Ranking cleared",
    
    // Dynamic parts
    "dyn.win": "WIN",
    "dyn.lose": "LOSE",
    "dyn.push": "PUSH",
    "dyn.streak": "streak",
    "dyn.bonus": "bonus",
    "dyn.input": "Input",
    "dyn.even": "Even",
    "dyn.hole_open": "hole open",
    "dyn.hole_hidden": "hole hidden",
    "dyn.playing": "playing",
    "dyn.max": "max",
    
    // JS dynamic
    "js.result_showing": "Showing results…",
    "js.ad_waiting": "Waiting for ad…",
    "js.selectable": "Selectable",
    "js.holding": "Holding…",
  },
  
  ja: {
    // Top bar
    "ui.booting": "起動中…",
    "ui.loading": "LOADING",
    "ui.ready": "ready.",
    "ui.engine_ready": "Engine ready!",
    "ui.engine_not_ready": "準備中...",
    
    // Stats & Menu
    "stats.bank": "Bank",
    "stats.round": "Round",
    "stats.time": "Time",
    "menu.menu": "MENU",
    "menu.history": "履歴",
    "menu.reset": "Reset",
    "menu.ranking": "Rank",
    
    // Titles & Home
    "title.payout": "🎰 BLACKJACK PAYS 3 TO 2 • INSURANCE PAYS 2 TO 1",
    "title.main": "Blackjack",
    "title.sub": "ランキングで自己ベスト更新を目指せ！！",
    "title.deal_start": "DEAL / START",
    "title.how": "遊び方",
    "title.bet_hint": "Bet（偶数推奨：Insurance = bet/2 で端数回避）",
    "title.options": "Options（タイトルでON/OFF）",
    "title.tips": "Tips：Reset は「1回タップで武装 → 2秒長押し」で実行",
    "title.marking": "マーキング/操作",
    
    // Options
    "opt.double": "Double Down",
    "opt.split": "Split",
    "opt.surrender": "Surrender (Late)",
    "opt.insurance": "Insurance",
    "opt.even_money": "Even Money",
    "opt.das": "DAS",
    "opt.split_bj": "Split BJ as BJ",
    "opt.h17": "Dealer hits Soft 17",
    
    // Game Screen
    "game.garage": "CASINO TABLE",
    "game.bet_info": "BET / INFO",
    "game.bet": "Bet",
    "game.set": "SET",
    "game.dock_hint": "Main actions are in DOCK",
    "game.more": "MORE",
    "game.more_title": "More actions",
    "game.more_hint": "※押せる場合に限り機能します。",
    
    // Side Panel commands
    "cmd.double": "Double",
    "cmd.split": "Split",
    "cmd.surrender": "Surrender",
    "cmd.even_money": "Even Money",
    
    // Insurance Side
    "ins.insurance": "Insurance",
    "ins.max": "MAX",
    "ins.dock_hint": "下のDOCKで YES / NO を選択",
    "ins.yes": "YES",
    "ins.no": "NO",
    
    // DOCK
    "dock.deal": "DEAL",
    "dock.hit": "HIT",
    "dock.stand": "STAND",
    
    // Overlays
    "so.session_over": "SESSION OVER!!", // JA uses !!
    "so.calculating": "集計中…",
    "so.wait": "Please wait…",
    "so.sponsored": "Sponsored",
    "so.to_title": "タイトルへ",
    "so.retry": "EARN 5000 & RETRY",
    "so.revive": "📺 広告を見て復活 (+500)",
    
    "pause.title": "PAUSED",
    "pause.close": "閉じる",
    "pause.msg": "セッションは終了しません。<b>Continue</b>で復帰、<b>Quit</b>でタイトルに戻れます。",
    "pause.continue": "Continue",
    "pause.quit": "Quit to Title",
    
    "how.title": "遊び方",
    "how.close": "閉じる",
    "how.goal": "目標：<b>21に近づける</b>（21超えはBust）",
    "how.cards": "10/J/Q/Kは<b>全部10扱い</b>、Aは<b>1 or 11</b>",
    "how.deal": "<b>DEAL</b>で開始（RoundOver中は次ラウンドに進む）",
    "how.double": "<b>Double</b>：同額追加→1回Hitで強制終了",
    "how.split": "<b>Split</b>：同“点数”ならOK。Aスプリットは1枚で終了",
    "how.surrender": "<b>Surrender</b>：最初の2枚のみ。掛け金の半分が返る（Late／peek後）",
    "how.insurance": "<b>Insurance</b>：ディーラー表がAの時のみ。最大 bet/2",
    "how.even_money": "<b>Even Money</b>：プレイヤーBJ時に提示",
    "how.note": "※操作可否はC++が返す <b>state.can</b> が真実。ボタンは自動で無効化されます。",
    
    "hist.title": "HISTORY",
    "hist.close": "閉じる",
    "hist.msg": "直近のラウンド結果を記録しています（最大 100 件）。ページを閉じてもブラウザに保存されます。",
    "hist.none": "まだ履歴がありません。",
    
    "rank.title": "RANKING",
    "rank.close": "閉じる",
    "rank.msg": "セッション結果（Profit順）を保存しています（最大 50 件）。",
    "rank.name": "Name（任意）",
    "rank.none": "まだランキングがありません。",
    "rank.saved": "Saved Ranking: ",
    
    // Debug/Toasts
    "toast.good_luck": "Good luck!",
    "toast.bet_adjusted": "Bet adjusted to Bank",
    "toast.reset_hold": "2秒長押しでリセット",
    "toast.holding": "Holding…",
    "toast.reset_done": "Reset!",
    "toast.ranking_cleared": "Ranking cleared",
    
    // Dynamic parts
    "dyn.win": "WIN",
    "dyn.lose": "LOSE",
    "dyn.push": "PUSH",
    "dyn.streak": "streak",
    "dyn.bonus": "bonus",
    "dyn.input": "入力",
    "dyn.even": "偶数化",
    "dyn.hole_open": "hole open",
    "dyn.hole_hidden": "hole hidden",
    "dyn.playing": "playing",
    "dyn.max": "max",
    
    // JS dynamic
    "js.result_showing": "結果表示中…",
    "js.ad_waiting": "広告の終了を待っています…",
    "js.selectable": "選択できます",
    "js.holding": "Holding…",
  }
};

let currentLang = localStorage.getItem('bj_lang') || 'en';

// For console access
window.LOC = {
  get lang(){ return currentLang; },
  set lang(v){ setLanguage(v); }
};

function t(key){
  const dict = RESOURCES[currentLang] || RESOURCES.en;
  return dict[key] || key;
}

function updateDOM(){
  // 1. data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      // If it contains HTML tags in resource, use innerHTML
      const val = t(key);
      if (val.includes('<') && val.includes('>')) {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    }
  });

  // 2. Placeholders
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    if (key) {
      el.placeholder = t(key);
    }
  });

  // 3. Titles (tooltips)
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) {
      el.title = t(key);
    }
  });
}

function setLanguage(lang){
  if (!RESOURCES[lang]) {
    console.warn("Unknown lang:", lang);
    return;
  }
  currentLang = lang;
  localStorage.setItem('bj_lang', lang);
  
  // Set html lang attribute
  document.documentElement.lang = lang;
  
  updateDOM();
  
  // Trigger custom event if needed
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
}

// Auto init
window.addEventListener('DOMContentLoaded', () => {
    // If not set/valid, default to english (or user logic)
    /*
    const saved = localStorage.getItem('bj_lang');
    if (!saved) {
      const navLang = (navigator.language || navigator.userLanguage || "en").slice(0,2);
      if (RESOURCES[navLang]) currentLang = navLang;
    }
    */
    setLanguage(currentLang);
});
