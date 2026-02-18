
const RESOURCES = {
  en: {
    // トップバー
    "ui.booting": "booting…",
    "ui.loading": "LOADING",
    "ui.ready": "ready.",
    "ui.engine_ready": "Engine ready!",
    "ui.engine_not_ready": "engine not ready",
    
    // 統計 & メニュー
    "stats.bank": "Bank",
    "stats.round": "Round",
    "stats.time": "Time",
    "menu.menu": "MENU",
    "menu.history": "History",
    "menu.ranking": "Ranking",
    
    // タイトル & ホーム
    "title.payout": "🎰 BLACKJACK PAYS 3 TO 2 • INSURANCE PAYS 2 TO 1",
    "title.main": "Blackjack",
    "title.sub": "Aim for a personal best in the ranking!!",
    "title.deal_start": "DEAL / START",
    "title.how": "How to Play",
    "title.bet_hint": "Bet (Even number recommended to avoid fractional insurance)",
    "title.options": "Options (Toggle ON/OFF)",

    "title.marking": "Markings/Controls",
    
    // オプション
    "opt.double": "Double Down",
    "opt.split": "Split",
    "opt.surrender": "Surrender (Late)",
    "opt.insurance": "Insurance",
    "opt.even_money": "Even Money",
    "opt.das": "DAS",
    "opt.split_bj": "Split BJ as BJ",
    "opt.h17": "Dealer hits Soft 17",
    
    // ゲーム画面
    "game.garage": "CASINO TABLE",
    "game.bet_info": "BET / INFO",
    "game.bet": "Bet",
    "game.set": "SET",
    "game.dock_hint": "Main actions are in DOCK",
    "game.more": "MORE",
    "game.more_title": "More actions",
    "game.more_hint": "※Functions only when available.",
    
    // サイドパネルコマンド
    "cmd.double": "Double",
    "cmd.split": "Split",
    "cmd.surrender": "Surrender",
    "cmd.even_money": "Even Money",
    
    // インシュランス (サイド)
    "ins.insurance": "Insurance",
    "ins.max": "MAX",
    "ins.dock_hint": "Select YES / NO in DOCK below",
    "ins.yes": "YES",
    "ins.no": "NO",
    
    // ドック (DOCK)
    "dock.deal": "DEAL",
    "dock.hit": "HIT",
    "dock.stand": "STAND",
    
    // オーバーレイ
    "so.session_over": "SESSION OVER",
    "so.calculating": "Calculating…",
    "so.wait": "Please wait…",
    "so.sponsored": "Sponsored",
    "so.to_title": "To Title",
    "so.retry": "EARN 5000 & RETRY",
    "so.revive": "📺 Watch Ad to Revive (+500)",
    "so.delay": "Add Delay Before Session Over",
    
    "pause.title": "PAUSED",
    "pause.close": "Close",
    "pause.msg": "Session will not end. 'Continue' to return, 'Quit' to title.",
    "pause.continue": "Continue",
    "pause.quit": "Quit to Title",
    
    "how.title": "HOW TO PLAY",
    "how.close": "Close",
    
    "how.goal_title": "GOAL",
    "how.goal_text": "Beat the dealer's hand without going over 21.",
    
    "how.val_title": "CARD VALUES",
    "how.val_text": "<b>2-10</b> = Face Value<br><b>J, Q, K</b> = 10<br><b>Ace</b> = 1 or 11",
    
    "how.act_title": "ACTIONS",
    "how.act_hit": "<b>HIT</b>: Take another card.",
    "how.act_stand": "<b>STAND</b>: End turn.",
    "how.act_double": "<b>DOUBLE</b>: Double bet, take exactly 1 card.",
    "how.act_split": "<b>SPLIT</b>: Split pair into two hands (bet x2).",
    "how.act_surrender": "<b>SURRENDER</b>: Give up half bet (Late).",
    "how.act_insurance": "<b>INSURANCE</b>: Bet half if Dealer shows Ace.",
    
    "how.dlr_title": "DEALER RULES",
    "how.dlr_text": "Dealer must draw to 16 and stand on 17.",
    
    "how.pay_title": "PAYOUTS",
    "how.pay_bj": "Blackjack: 3 to 2",
    "how.pay_win": "Win: 1 to 1",
    "how.pay_ins": "Insurance: 2 to 1",
    
    "how.note": "※Buttons disable automatically when actions are not available.",
    
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
    
    // デバッグ/トースト
    "toast.good_luck": "Good luck!",
    "toast.bet_adjusted": "Bet adjusted to Bank",
    "toast.ranking_cleared": "Ranking cleared",
    
    // 動的パーツ
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
    
    // JS動的メッセージ
    "js.result_showing": "Showing results…",
    "js.ad_waiting": "Waiting for ad…",
    "js.selectable": "Selectable",

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
    "menu.ranking": "Rank",
    
    // Titles & Home
    "title.payout": "🎰 BLACKJACK PAYS 3 TO 2 • INSURANCE PAYS 2 TO 1",
    "title.main": "Blackjack",
    "title.sub": "ランキングで自己ベスト更新を目指せ！！",
    "title.deal_start": "DEAL / START",
    "title.how": "遊び方",
    "title.bet_hint": "Bet（偶数推奨：Insurance = bet/2 で端数回避）",
    "title.options": "Options（タイトルでON/OFF）",

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
    "so.delay": "セッション終了まで少しお待ちください",
    
    "pause.title": "PAUSED",
    "pause.close": "閉じる",
    "pause.msg": "セッションは終了しません。<b>Continue</b>で復帰、<b>Quit</b>でタイトルに戻れます。",
    "pause.continue": "Continue",
    "pause.quit": "Quit to Title",
    
    "how.title": "遊び方",
    "how.close": "閉じる",
    
    "how.goal_title": "目標",
    "how.goal_text": "ディーラーより21に近づけること（21を超えたら負け）。",
    
    "how.val_title": "カードの点数",
    "how.val_text": "<b>2-10</b> = そのまま<br><b>J, Q, K</b> = 10<br><b>Ace</b> = 1 または 11",
    
    "how.act_title": "アクション",
    "how.act_hit": "<b>HIT</b>：カードをもう1枚引く",
    "how.act_stand": "<b>STAND</b>：現在の点数で勝負する",
    "how.act_double": "<b>DOUBLE</b>：賭け金を倍にして、残り1枚だけ引く",
    "how.act_split": "<b>SPLIT</b>：ペアを分割して2つの手にする（賭け金倍）",
    "how.act_surrender": "<b>SURRENDER</b>：勝てる見込みがない時に降りる（半額返金）",
    "how.act_insurance": "<b>INSURANCE</b>：ディーラーのAに対して保険をかける（最大bet半額）",
    
    "how.dlr_title": "ディーラーのルール",
    "how.dlr_text": "ディーラーは16以下なら引き続け、17以上で止まります。",
    
    "how.pay_title": "配当",
    "how.pay_bj": "Blackjack: 3 to 2 (1.5倍)",
    "how.pay_win": "Win: 1 to 1 (等倍)",
    "how.pay_ins": "Insurance: 2 to 1 (2倍)",
    
    "how.note": "※ボタンはルール上可能な場合のみ押せるようになります。",
    
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
    "js.result_showing": "読み込み中…",
    "js.ad_waiting": "広告の終了を待っています…",
    "js.selectable": "選択できます",

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
    // If not set/valid, default to english (or user logic)
    const saved = localStorage.getItem('bj_lang');
    if (!saved) {
      const navLang = (navigator.language || navigator.userLanguage || "en").toLowerCase();
      if (navLang.startsWith("ja")) {
        currentLang = "ja";
      } else if (RESOURCES[navLang.slice(0,2)]) {
        currentLang = navLang.slice(0,2);
      }
    }
    setLanguage(currentLang);
