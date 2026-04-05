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
    "title.bet_hint":
      "Bet (Even number recommended to avoid fractional insurance)",
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
    "so.sponsored": "",
    "so.to_title": "To Title",
    "so.retry": "",
    "so.revive": "",
    "so.delay": "Add Delay Before Session Over",

    "pause.title": "PAUSED",
    "pause.close": "Close",
    "pause.msg": "Session will not end. 'Continue' to return, 'Quit' to title.",
    "pause.continue": "Continue",
    "pause.quit": "Quit to Title",

    "how.title": "HOW TO PLAY",
    "how.close": "Close",

    // Compact summary
    "how.summary_title": "QUICK SUMMARY",
    "how.summary_goal":
      "Goal: Get closer to 21 than the dealer (22+ is a bust/loss).",
    "how.summary_val":
      "Values: 2-10 face value / JQK=10 / A=1 or 11 (auto-best).",
    "how.summary_act": "Actions: HIT to draw / STAND to end turn.",
    "how.summary_pay": "Payouts: Win 1:1 / BJ 3:2 / Insurance 2:1 / Push 0",

    // Details (Accordion keys)
    "how.det_action_title": "Action Details",
    "how.det_action_text":
      "<b>Hit</b>: Draw another card to increase your total score. You can hit as many times as you like until you reach 21 or bust (go over 21).<br><b>Stand</b>: Keep your current hand and end your turn. The dealer will then play their hand.<br><b>Double Down</b>: Double your original bet in exchange for receiving exactly one more card and then standing. Best used on totals of 9, 10, or 11.<br><b>Split</b>: If your first two cards have the same rank (e.g., two 8s), you can split them into two separate hands by adding an identical bet. Each hand is played independently.<br><b>Surrender (Late)</b>: If offered, you can give up half of your bet and end your hand before drawing any cards (after the dealer checks for Blackjack).<br><b>Insurance</b>: A side bet offered when the dealer's upcard is an Ace. You bet up to half of your original bet; if the dealer has Blackjack, it pays 2:1.<br><b>Even Money</b>: A special form of insurance for when you have Blackjack and the dealer shows an Ace. You can choose to take a guaranteed 1:1 payout immediately.",

    "how.det_dealer_title": "Dealer Rules",
    "how.det_dealer_text":
      "Dealer hits on 16 or less and stands on 17 or more.<br><b>Soft 17</b>: Depending on settings, dealer may hit or stand when holding an Ace worth 11 and a total of 17.",

    "how.det_table_title": "Table Rules",
    "how.det_table_text":
      "6 decks are used.<br>The shoe is reshuffled when the cut card is reached.<br>Maximum of 3 hands per round (Split limit).<br><b>Split Aces</b>: Each hand receives only one card and then stands.<br>Blackjack (3:2) is only on the first two cards. Split 21 is a regular win (1:1).",

    "how.det_terms_title": "Terms",
    "how.det_terms_text":
      "<b>Blackjack</b>: An Ace and any 10-value card (10/J/Q/K) as your first two cards.<br><b>Soft</b>: A hand where an Ace can be counted as 11 without busting.<br><b>Hard</b>: A hand without an Ace, or where all Aces must be counted as 1.",

    "how.det_payout_title": "Payouts",
    "how.det_payout_text":
      "<b>Standard Win</b>: +Original Bet amount (= 1:1)<br><b>Blackjack</b>: +1.5x Bet amount (= 3:2)<br><b>Insurance</b>: +2x Insurance Bet amount (= 2:1)<br><b>Push (Tie)</b>: No profit/loss (±0)",

    "how.note": "※Buttons are only shown when the action is available.",

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

    // Options Subtext
    "opt_sub.double": "Double bet, draw 1 card",
    "opt_sub.split": "Split matching ranks into 2 hands",
    "opt_sub.surrender": "Early exit for 50% refund (Late)",
    "opt_sub.insurance": "Insurance vs Dealer Ace (Max bet/2)",
    "opt_sub.even_money": "Instant 1:1 if you have BJ vs Dealer Ace",
    "opt_sub.das": "Allow Double Down after Splitting",
    "opt_sub.h17": "Dealer draws on Soft 17",
    "opt_sub.haptic": "Vibration feedback on/off",

    // 銀行・破産
    "bank.bankruptcy": "YOU ARE BANKRUPT",
    "bank.revive_hint": "Chips are gone.<br>Restart the session?",
    "ad.load_fail": "Ad failed to load. Please try again.",

    // JS dynamic
    "js.result_showing": "Showing results…",
    "js.ad_waiting": "Waiting for ad…",
    "js.selectable": "Selectable",

    "mode.challenge": "CHALLENGE",
    "mode.challenge_desc": "Ranking mode (5 mins).",
    "mode.normal": "NORMAL",
    "mode.normal_desc": "Session progress is auto-saved.",
    "mode.practice": "PRACTICE",
    "prac.desc": "Practice mode (24 rounds).",
    "prac.free_left": "Daily Free: ",
    "prac.ticket_left": "Tickets: ",
    "prac.start_free": "Start (Free)",
    "prac.start_ticket": "Start (1 Ticket)",
    "prac.watch_ad": "No tickets",
    "prac.ad_again": "Play Again",
    "prac.no_ticket": "No tickets. Watch Ad to play.",
    "prac.session_over": "Practice Over",
    "prac.retry_free": "Retry (Free)",
    "prac.retry_ticket": "Retry (1 Ticket)",
    "prac.time_up": "Practice Over!",
    "prac.confirm_ad": "Out of tickets.",

    // JS localizable
    "js.ins_hint": "💰 Insurance: {0} (bet/2)",
    "js.xp_gain": "+{0} XP",
    "js.reset_lvl_conf":
      "Reset level to 1?\nXP and rewards history will also be reset.",
    "js.lvl_reset_done": "Level reset complete",
    "js.ticket_get": "Ticket +1 Get!",
    "js.revive_done": "Revived! +50000",
    "js.engine_not_ready": "Engine not ready!",
    "js.session_start_err": "Error starting session",
    "js.bet_hint_full": "Input={0} -> Even={1}",

    // Mode Help
    "mode.help_normal_tooltip":
      "Basic mode to play freely while carrying over chips",
    "mode.help_challenge_tooltip":
      "Score attack mode to see how much you can increase chips within time limit",
    "mode.help_practice_tooltip": "Practice mode with no chip fluctuations",
    "mode.help_normal_detail":
      "<b>Normal Mode</b><br>• No time limit<br>• Bank (chips) carrying over<br>• Level up possible<br>• Restart possible on bankruptcy",
    "mode.help_challenge_detail":
      "<b>Challenge Mode</b><br>• Time limit: 5:00<br>• Fixed starting Bank (50K)<br>• Score attack mode<br>• Score tracked for ranking",
    "mode.help_practice_detail":
      "<b>Practice Mode</b><br>• Training only mode (24 rounds/play)<br>• No Bank fluctuation<br>• No impact on history/stats<br>• Insurance OFF<br>• Limited rounds per day",

    "prac.no_ticket_basic": "No tickets left.",
    "mode.practice_desc_basic": "Training mode.",
    "bank.restart": "RESTART",
    "bank.revive_hint_basic": "Chips are gone. Restart the session?",
    "js.revive_done_basic": "Restarted! +50000",
    "bank.revive_free_hint": "+50000 (Free)",

    "name.welcome": "WELCOME!",
    "name.input_hint": "Please enter your name for the ranking.",
    "name.start": "START GAME",
    "name.error_empty": "Please enter a name.",
    "ui.feedback": "Feedback / Bugs",
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
    "menu.ranking": "Ranking",

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
    "so.session_over": "SESSION OVER", // Match EN
    "so.calculating": "集計中…",
    "so.wait": "Please wait…",
    "so.sponsored": "",
    "so.to_title": "タイトルへ",
    "so.retry": "",
    "so.revive": "",
    "so.delay": "セッション終了まで少しお待ちください",

    "pause.title": "PAUSED",
    "pause.close": "閉じる",
    "pause.msg":
      "セッションは終了しません。<b>Continue</b>で復帰、<b>Quit</b>でタイトルに戻れます。",
    "pause.continue": "Continue",
    "pause.quit": "Quit to Title",

    "how.title": "遊び方",
    "how.close": "閉じる",

    // 超要約
    "how.summary_title": "概要（クイックガイド）",
    "how.summary_goal": "目標：21に近い方が勝ち（22以上は負け）",
    "how.summary_val":
      "点数：2-10はそのまま / JQK=10 / A=1 or 11（有利な方を自動）",
    "how.summary_act": "操作：HIT=1枚引く / STAND=引かずに終了",
    "how.summary_pay": "配当：勝ち1:1 / BJ 3:2 / 保険2:1 / 引き分け0",

    // 詳細（アコーディオン）
    "how.det_action_title": "アクション詳細",
    "how.det_action_text":
      "<b>ヒット (Hit)</b>：カードを1枚追加します。21を超える（バースト）まで何度でも引けます。<br><b>スタンド (Stand)</b>：現在の点数で確定し、ターンを終了します。<br><b>ダブルダウン (Double)</b>：賭け金を2倍にし、カードを「あと1枚だけ」引いて強制的にスタンドします。9〜11点の時に有効な戦略です。<br><b>スプリット (Split)</b>：最初に出た2枚が同じランク（8のペアなど）の場合、追加の賭け金を払ってそれらを2つの独立した手に分割できます。<br><b>サレンダー (Surrender)</b>：不利な状況の際、賭け金の半分を放棄してそのラウンドを降ります（ディーラーのBJチェック後に行う「レイト」形式です）。<br><b>保険 (Insurance)</b>：ディーラーの表カードがAの時のサイドベット。元の賭け金の半分まで賭けられ、ディーラーがBJなら2:1の配当を得ます。<br><b>イーブンマネー (Even Money)</b>：自分がBJ、ディーラーがAの時に選べます。ディーラーの結果に関わらず、即座に1:1（等倍）の配当を得て終了します。",

    "how.det_dealer_title": "ディーラーのルール",
    "how.det_dealer_text":
      "ディーラーは16以下なら引き続け、17以上で止まります。<br><b>Soft 17</b>：Aを11として数える計17の場合、設定によりヒットかスタンドが変わります。",

    "how.det_table_title": "テーブルルール",
    "how.det_table_text":
      "6デッキ（312枚）を使用します。<br>カードの残りが少なくなると、再シャッフルが行われます。<br>最大3ハンドまで分割可能です。<br><b>Split Aces</b>：Aのスプリット後は各手1枚のみ配られ、強制スタンドとなります。<br>Blackjack(3:2)は最初の2枚のみ。スプリット後の21は通常勝ち(1:1)です。",

    "how.det_terms_title": "用語の解説",
    "how.det_terms_text":
      "<b>ブラックジャック</b>：最初の2枚が「Ace + 10点札(10/J/Q/K)」の組み合わせ。<br><b>ソフト</b>：Aceを11として数えても合計が21を超えない状態の手。<br><b>ハード</b>：Aceを含まない、またはAceを1としてしか数えられない状態の手。",

    "how.det_payout_title": "配当について",
    "how.det_payout_text":
      "<b>通常勝ち</b>：+ベットと同額（= 1:1）<br><b>ブラックジャック</b>：+ベットの1.5倍（= 3:2）<br><b>保険</b>：+保険ベットの2倍（= 2:1）<br><b>引き分け</b>：増減なし（Push）",

    "how.note": "※ボタンは状況に応じて、ルール上可能なものだけが表示されます。",

    "hist.title": "HISTORY",
    "hist.close": "閉じる",
    "hist.msg":
      "直近のラウンド結果を記録しています（最大 100 件）。ページを閉じてもブラウザに保存されます。",
    "hist.none": "まだ履歴がありません。",

    "rank.title": "RANKING",
    "rank.close": "閉じる",
    "rank.msg": "セッション結果（Profit順）を保存しています（最大 50 件）。",
    "rank.name": "Name",
    "rank.none": "まだランキングがありません。",
    "rank.saved": "ランキングを保存しました: ",

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
    "dyn.hole_open": "ホールカード公開",
    "dyn.hole_hidden": "ホールカード非公開",
    "dyn.playing": "プレイ中",
    "dyn.max": "最大",

    // Options Subtext
    "opt_sub.double": "Bet2倍で1枚引いて終了",
    "opt_sub.split": "同ランク2枚を分割し2ハンド化",
    "opt_sub.surrender": "降りて半額負け（レイト）",
    "opt_sub.insurance": "ディーラーAで保険（最大半額）",
    "opt_sub.even_money": "自分BJ＆ディーラーAで確定1:1",
    "opt_sub.das": "スプリット後のダブルを許可",
    "opt_sub.h17": "Soft17ならディーラーも引く",
    "opt_sub.haptic": "操作時の振動フィードバック",

    // 銀行・破産
    "bank.bankruptcy": "破産しました",
    "bank.revive_hint": "チップがなくなりました。<br>はじめからやり直しますか？",
    "ad.load_fail": "広告の読み込みに失敗しました。もう一度お試しください。",

    // JS dynamic
    "js.result_showing": "結果を表示中…",
    "js.ad_waiting": "広告の終了を待っています…",
    "js.selectable": "選択できます",

    "mode.challenge": "チャレンジ",
    "mode.challenge_desc": "5分間の集中ランキングモードです。",
    "mode.normal": "ノーマル",
    "mode.normal_desc": "所持金が保存される通常モードです。",
    "mode.practice": "練習モード",
    "prac.desc": "24ラウンドの練習モードです。Bankは変動しません。",
    "prac.free_left": "本日の無料枠: ",
    "prac.ticket_left": "所持チケット: ",
    "prac.start_free": "スタート（無料）",
    "prac.start_ticket": "スタート（チケット消費）",
    "prac.watch_ad": "チケット不足",
    "prac.ad_again": "もう一度プレイ",
    "prac.no_ticket": "チケットが足りません。広告を見て入手してください。",
    "prac.session_over": "練習終了",
    "prac.retry_free": "もう一度（無料）",
    "prac.retry_ticket": "もう一度（チケット消費）",
    "prac.time_up": "24ラウンド終了！",
    "prac.confirm_ad": "チケットがありません。",

    // JS localizable
    "js.ins_hint": "💰 保険: {0} (ベットの半分)",
    "js.xp_gain": "+{0} XP",
    "js.reset_lvl_conf":
      "レベルを1にリセットしますか？\nXPと報酬付与履歴もリセットされます。",
    "js.lvl_reset_done": "レベルをリセットしました",
    "js.ticket_get": "チケットを1枚獲得しました！",
    "js.revive_done": "復活しました！ +50000",
    "js.engine_not_ready": "エンジンの準備ができていません",
    "js.session_start_err": "セッション開始エラー",
    "js.bet_hint_full": "入力={0} → 偶数化={1}",

    // モードヘルプ
    "mode.help_normal_tooltip": "チップを引き継いで自由に遊べる基本モード",
    "mode.help_challenge_tooltip":
      "制限時間内にどれだけ増やせるか挑戦するモード",
    "mode.help_practice_tooltip": "チップ変動なしで練習できるモード",
    "mode.help_normal_detail":
      "<b>Normal Mode</b><br>・時間制限なし<br>・Bank（チップ）引き継ぎ<br>・レベルアップ可能<br>・破産時に「復活スタート」が可能",
    "mode.help_challenge_detail":
      "<b>Challenge Mode</b><br>・制限時間あり（5:00）<br>・初期Bank固定（50K）<br>・スコアアタックモード<br>・ランキング用スコア計測",
    "mode.help_practice_detail":
      "<b>Practice Mode</b><br>・練習専用モード（1プレイ24ラウンド）<br>・Bank変動なし<br>・履歴 / 統計に影響しない<br>・インシュランスOFF<br>・プレイ回数制限あり",

    "prac.no_ticket_basic": "チケットがありません。",
    "mode.practice_desc_basic": "練習モードです。",
    "bank.restart": "復活スタート",
    "bank.revive_hint_basic": "チップがなくなりました。はじめからやり直しますか？",
    "js.revive_done_basic": "再開しました！ +50000",
    "bank.revive_free_hint": "+50000 (無料)",

    "name.welcome": "WELCOME!",
    "name.input_hint": "ランキングに使用する名前を入力してください。",
    "name.start": "ゲーム開始",
    "name.error_empty": "名前を入力してください。",
    "ui.feedback": "ご意見・不具合",
  },
};

let currentLang = localStorage.getItem("bj_lang") || "en";

// For console access
window.LOC = {
  get lang() {
    return currentLang;
  },
  set lang(v) {
    setLanguage(v);
  },
};

function t(key, ...args) {
  const dict = RESOURCES[currentLang] || RESOURCES.en;
  let s = dict[key] || key;
  if (args.length > 0) {
    args.forEach((val, i) => {
      s = s.replace(`{${i}}`, val);
    });
  }
  return s;
}

function updateDOM() {
  // 1. data-i18n
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key) {
      // If it contains HTML tags in resource, use innerHTML
      const val = t(key);
      if (val.includes("<") && val.includes(">")) {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    }
  });

  // 2. Placeholders
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    const key = el.getAttribute("data-i18n-ph");
    if (key) {
      el.placeholder = t(key);
    }
  });

  // 3. Titles (tooltips)
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    if (key) {
      el.title = t(key);
    }
  });
}

function setLanguage(lang) {
  if (!RESOURCES[lang]) {
    console.warn("Unknown lang:", lang);
    return;
  }
  currentLang = lang;
  localStorage.setItem("bj_lang", lang);

  const apply = () => {
    document.documentElement.lang = lang;
    updateDOM();
    window.dispatchEvent(
      new CustomEvent("languageChanged", { detail: { lang } }),
    );
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply, { once: true });
  } else {
    apply();
  }
}

// デフォルトは英語（保存されている設定がない場合）
const saved = localStorage.getItem("bj_lang");
if (!saved) {
  currentLang = "en";
}
setLanguage(currentLang);
