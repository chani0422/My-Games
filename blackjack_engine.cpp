#include <vector>
#include <string>
#include <algorithm>
#include <random>
#include <cstdint>
#include <cstdlib>
#include <cstring>

#include <emscripten/emscripten.h>

using std::string;
using std::vector;

namespace bj {

// ===== Error codes =====
enum Err : int {
  OK = 0,
  INVALID_STATE = 1,
  INSUFFICIENT_FUNDS = 2,
  INVALID_BET = 3,
  NOT_SUPPORTED = 4,
  INTERNAL_ERROR = 5,
};

// ===== Phase =====
enum class Phase : int {
  MENU,
  BETTING,
  OFFER_INSURANCE,
  IN_HAND,
  ROUND_OVER,
  PAUSED,
  SESSION_OVER
};

static const char* phase_str(Phase p) {
  switch (p) {
    case Phase::MENU: return "menu";
    case Phase::BETTING: return "betting";
    case Phase::OFFER_INSURANCE: return "offerInsurance";
    case Phase::IN_HAND: return "inHand";
    case Phase::ROUND_OVER: return "roundOver";
    case Phase::PAUSED: return "paused";
    case Phase::SESSION_OVER: return "sessionOver";
    default: return "menu";
  }
}

// ===== Rules mask bits =====
enum RuleBits : uint32_t {
  RB_ALLOW_DOUBLE      = 1u << 0,
  RB_ALLOW_SPLIT       = 1u << 1,
  RB_ALLOW_SURRENDER   = 1u << 2,
  RB_ALLOW_INSURANCE   = 1u << 3,
  RB_ALLOW_EVEN_MONEY  = 1u << 4,
  RB_ALLOW_DAS         = 1u << 5,
  RB_SPLIT_BJ_AS_BJ    = 1u << 6,
  RB_DEALER_HIT_S17    = 1u << 7, // H17 (soft17 hit)
};

struct Rules {
  bool allowDouble = true;
  bool allowSplit = true;
  bool allowSurrender = true;
  bool allowInsurance = true;
  bool allowEvenMoney = true;
  bool allowDAS = true;
  bool splitBJAsBJ = true;
  bool dealerHitSoft17 = true; // H17 固定
};

struct Card {
  uint8_t rank; // 1..13 (A..K)
  uint8_t suit; // 0..3
};

// 10/J/Q/K は 10扱い、Aは 1（スコア計算で 11化する）
static int point_value(const Card& c) {
  if (c.rank == 1) return 1;
  if (c.rank >= 10) return 10;
  return (int)c.rank;
}

static bool is_blackjack_2cards(const vector<Card>& cards) {
  if (cards.size() != 2) return false;
  bool hasAce = false;
  bool hasTen = false;
  for (auto &c : cards) {
    if (c.rank == 1) hasAce = true;
    if (point_value(c) == 10) hasTen = true;
  }
  return hasAce && hasTen;
}

struct ScoreInfo {
  int total = 0;
  bool soft = false; // Aを11として扱えている状態か
};

static ScoreInfo score_hand(const vector<Card>& cards) {
  int sum = 0;
  int aces = 0;
  for (auto &c : cards) {
    int v = point_value(c);
    sum += v;
    if (c.rank == 1) aces++;
  }
  bool soft = false;
  // Aを 11 化（+10）できる限り 1つだけ適用して soft
  if (aces > 0 && sum + 10 <= 21) {
    sum += 10;
    soft = true;
  }
  return {sum, soft};
}

static const char* SUIT_UTF8[4] = { u8"♠", u8"♥", u8"♦", u8"♣" };

static string rank_str(uint8_t rank) {
  if (rank == 1) return "A";
  if (rank == 11) return "J";
  if (rank == 12) return "Q";
  if (rank == 13) return "K";
  return std::to_string((int)rank);
}

// "A♠" 形式
static string card_str(const Card& c) {
  string r = rank_str(c.rank);
  string s = SUIT_UTF8[c.suit % 4];
  return r + s;
}

// JSON escape（最低限）
static string json_escape(const string& in) {
  string o;
  o.reserve(in.size() + 8);
  for (char ch : in) {
    switch (ch) {
      case '\\': o += "\\\\"; break;
      case '"':  o += "\\\""; break;
      case '\n': o += "\\n"; break;
      case '\r': o += "\\r"; break;
      case '\t': o += "\\t"; break;
      default:   o += ch; break;
    }
  }
  return o;
}

struct HandFlags {
  bool blackjack = false;
  bool bust = false;
  bool doubled = false;
  bool surrendered = false;
  bool finished = false;

  bool fromSplit = false;
  bool splitAces = false; // Aスプリット由来（特殊制約）
};

struct Hand {
  vector<Card> cards;
  int bet = 0;
  HandFlags flags;

  int score = 0;
  bool soft = false;
};

struct InsuranceState {
  bool offered = false;
  bool evenMoneyOffered = false;
  bool evenMoneyTaken = false;
  int max = 0;
  int bet = 0;
};

struct RoundResult {
  int netProfit = 0;
  int bonusPercent = 0;
  int bonusApplied = 0;
  int streak = 0;
};

struct Shoe {
  int decks = 6;
  int cutSize = 78;

  vector<Card> cards;
  std::mt19937 rng;

  void init(uint64_t seed, int decks_, int cutSize_) {
    decks = decks_;
    cutSize = cutSize_;
    rng.seed((uint32_t)(seed ^ (seed >> 32)));

    rebuild_and_shuffle();
  }

  void rebuild_and_shuffle() {
    cards.clear();
    cards.reserve((size_t)decks * 52);
    for (int d = 0; d < decks; d++) {
      for (int s = 0; s < 4; s++) {
        for (int r = 1; r <= 13; r++) {
          cards.push_back(Card{(uint8_t)r, (uint8_t)s});
        }
      }
    }
    std::shuffle(cards.begin(), cards.end(), rng);
  }

  // 仕様：リシャッフルは「次のdeal開始前」が基本
  // 安全策：空なら再構築して引く（異常回避）
  Card draw() {
    if (cards.empty()) {
      rebuild_and_shuffle();
    }
    Card c = cards.back();
    cards.pop_back();
    return c;
  }

  int size() const { return (int)cards.size(); }
};

struct Engine {
  // 固定
  int schemaVersion = 1;

  // ルール
  Rules rules{};

  // セッション
  int bank = 1000;
  int minBet = 10;
  int baseBet = 10;

  int round = 0;
  int roundLimit = 12;

  int sessionMs = 300000;
  int timeLeftMs = 300000;

  // 6デッキ, cut 25%
  Shoe shoe{};

  // ラウンド
  Phase phase = Phase::MENU;
  Phase phaseBeforePause = Phase::MENU;

  vector<Card> dealer;
  bool dealerHoleKnown = false;
  bool dealerPeekNoBJ = false; // Late Surrender許可の要件に使用（peek後にtrue）

  vector<Hand> hands;
  int activeHandIndex = 0;

  InsuranceState ins{};
  RoundResult rr{};

  // 差分計算用
  int bankAtRoundStart = 1000;

  // エラー
  int lastErrorCode = 0;
  string lastError;

  void clear_error() {
    lastErrorCode = 0;
    lastError.clear();
  }
  int set_error(int code, const string& msg) {
    lastErrorCode = code;
    lastError = msg;
    return code;
  }

  bool session_over() const {
    return (timeLeftMs <= 0) || (round >= roundLimit);
  }

  void set_phase(Phase p) {
    phase = p;
  }

  void apply_rules_mask(uint32_t mask) {
    rules.allowDouble    = (mask & RB_ALLOW_DOUBLE) != 0;
    rules.allowSplit     = (mask & RB_ALLOW_SPLIT) != 0;
    rules.allowSurrender = (mask & RB_ALLOW_SURRENDER) != 0;
    rules.allowInsurance = (mask & RB_ALLOW_INSURANCE) != 0;
    rules.allowEvenMoney = (mask & RB_ALLOW_EVEN_MONEY) != 0;
    rules.allowDAS       = (mask & RB_ALLOW_DAS) != 0;
    rules.splitBJAsBJ    = (mask & RB_SPLIT_BJ_AS_BJ) != 0;
    rules.dealerHitSoft17= (mask & RB_DEALER_HIT_S17) != 0;
  }

  void reset_round_state() {
    dealer.clear();
    dealerHoleKnown = false;
    dealerPeekNoBJ = false;

    hands.clear();
    activeHandIndex = 0;

    ins = InsuranceState{};
    rr.netProfit = 0;
    rr.bonusPercent = 0;
    rr.bonusApplied = 0;

    clear_error();
  }

  void update_hand_cache(Hand& h) {
    ScoreInfo sc = score_hand(h.cards);
    h.score = sc.total;
    h.soft = sc.soft;
    h.flags.bust = (h.score > 21);
    h.flags.blackjack = is_blackjack_2cards(h.cards);
    if (h.flags.bust) h.flags.finished = true;
    // 21に到達したら自動でその手は終了扱い（テンポ重視）
    if (!h.flags.bust && h.score == 21) {
      h.flags.finished = true;
    }
  }

  void update_all_caches() {
    for (auto &h : hands) update_hand_cache(h);
  }

  bool dealer_has_blackjack_now() const {
    return is_blackjack_2cards(dealer);
  }

  // upcardがA or 10値のときだけ peek が意味を持つ
  bool should_peek() const {
    if (dealer.empty()) return false;
    const Card& up = dealer[0];
    int pv = point_value(up);
    return (up.rank == 1) || (pv == 10);
  }

  void dealer_play() {
    dealerHoleKnown = true;
    while (true) {
      ScoreInfo sc = score_hand(dealer);
      bool hit =
        (sc.total < 17) ||
        (sc.total == 17 && sc.soft && rules.dealerHitSoft17);

      if (!hit) break;
      dealer.push_back(shoe.draw());
    }
  }

  // ボーナス：勝ちラウンド（netProfit>0）の「利益」に +5%×k（上限25%）
  // ここでは勝利確定後、profitBeforeBonus を基準に floor で加算
  int apply_streak_bonus_if_needed(int profitBeforeBonus) {
    rr.bonusPercent = 0;
    rr.bonusApplied = 0;

    if (profitBeforeBonus <= 0) return profitBeforeBonus;

    int nextK = rr.streak + 1;             // “この勝利で何連勝目か”
    if (nextK > 5) nextK = 5;              // 5で25%上限
    int percent = 5 * nextK;               // 5%,10%,...,25%

    int bonus = (profitBeforeBonus * percent) / 100; // floor
    if (bonus > 0) bank += bonus;

    rr.bonusPercent = percent;
    rr.bonusApplied = bonus;

    return profitBeforeBonus + bonus;
  }

  void finalize_round_and_update_streak(int netProfitAfterBonus) {
    rr.netProfit = netProfitAfterBonus;

    if (netProfitAfterBonus > 0) {
      rr.streak += 1;
      if (rr.streak > 9999) rr.streak = 9999;
    } else if (netProfitAfterBonus < 0) {
      rr.streak = 0;
    } // ==0 は維持
  }

  void settle_all_hands_and_finish_round() {
    dealer_play();
    update_all_caches(); // player

    ScoreInfo dsc = score_hand(dealer);
    bool dealerBust = (dsc.total > 21);
    bool dealerBJ = is_blackjack_2cards(dealer);

    // handごと精算（betはdeal時に bank から引いてある前提）
    for (auto &h : hands) {
      if (h.flags.surrendered) {
        // surrender時に返金済みの設計にする（ここで二重処理しない）
        continue;
      }
      if (h.flags.bust) {
        continue; // 失うだけ
      }

      // BJ優先（split手でもBJ扱い）
      if (h.flags.blackjack) {
        if (dealerBJ) {
          bank += h.bet; // push（掛け金返却）
        } else {
          // 3:2 → 合計 2.5x を返す（betは偶数）
          bank += (h.bet * 5) / 2;
        }
        continue;
      }

      if (dealerBust) {
        bank += h.bet * 2;
        continue;
      }

      int p = h.score;
      int d = dsc.total;

      if (p > d) bank += h.bet * 2;
      else if (p == d) bank += h.bet;
      else continue;
    }

    int profitBeforeBonus = bank - bankAtRoundStart;
    int profitAfterBonus = apply_streak_bonus_if_needed(profitBeforeBonus);
    finalize_round_and_update_streak(profitAfterBonus);

    set_phase(Phase::ROUND_OVER);

    // ラウンド加算：deal() = 1ラウンド
    round += 1;
    if (session_over()) set_phase(Phase::SESSION_OVER);
  }

  // ===== Actions =====

  int start_session(uint64_t seed, uint32_t rulesMask, int sessionSeconds, int roundLimit_) {
    reset_round_state();
    apply_rules_mask(rulesMask);

    round = 0;
    roundLimit = (roundLimit_ > 0 ? roundLimit_ : 12);

    sessionMs = (sessionSeconds > 0 ? sessionSeconds * 1000 : 300000);
    timeLeftMs = sessionMs;

    bank = 1000;
    baseBet = minBet;

    // 6 decks / 25% cut
    shoe.init(seed, 6, 78);

    rr.streak = 0;
    bankAtRoundStart = bank;

    set_phase(Phase::BETTING);
    return OK;
  }

  int reset_session() {
    reset_round_state();
    bank = 1000;
    baseBet = minBet;
    round = 0;
    rr.streak = 0;
    bankAtRoundStart = bank;
    set_phase(Phase::MENU);
    return OK;
  }

  int set_time_left_ms(int ms) {
    if (ms < 0) ms = 0;
    timeLeftMs = ms;
    if (timeLeftMs <= 0) set_phase(Phase::SESSION_OVER);
    return OK;
  }

  int set_paused(int paused01) {
    if (paused01) {
      if (phase == Phase::MENU || phase == Phase::SESSION_OVER) return OK;
      if (phase != Phase::PAUSED) {
        phaseBeforePause = phase;
        set_phase(Phase::PAUSED);
      }
      return OK;
    } else {
      if (phase == Phase::PAUSED) {
        set_phase(phaseBeforePause);
      }
      return OK;
    }
  }

  // 偶数制限：floor to even
  static int floor_to_even(int x) {
    if (x < 0) x = 0;
    return (x / 2) * 2;
  }

  int set_bet(int amount) {
    if (phase == Phase::PAUSED) return set_error(INVALID_STATE, "Paused");
    if (!(phase == Phase::BETTING || phase == Phase::ROUND_OVER)) {
      return set_error(INVALID_STATE, "Not in betting");
    }
    clear_error();

    int a = floor_to_even(amount);
    if (a < minBet) return set_error(INVALID_BET, "Bet < minBet (and must be even)");
    if (a > bank) return set_error(INVALID_BET, "Bet > bank");
    if (a % 2 != 0) return set_error(INVALID_BET, "Bet must be even");

    baseBet = a;
    set_phase(Phase::BETTING);
    return OK;
  }

  // split比較用：同“点数”でOK（10/J/Q/Kは全部10）
  static int split_value(const Card& c) {
    return point_value(c);
  }

  void init_single_hand_bet(int bet, bool fromSplit=false, bool splitAces=false) {
    Hand h;
    h.bet = bet;
    h.flags.fromSplit = fromSplit;
    h.flags.splitAces = splitAces;
    hands.push_back(h);
  }

  int deal() {
    if (phase == Phase::PAUSED) return set_error(INVALID_STATE, "Paused");
    if (!(phase == Phase::BETTING || phase == Phase::ROUND_OVER)) {
      return set_error(INVALID_STATE, "Not ready to deal");
    }
    clear_error();

    if (session_over()) {
      set_phase(Phase::SESSION_OVER);
      return set_error(INVALID_STATE, "Session over");
    }
    if (baseBet < minBet) return set_error(INVALID_BET, "baseBet < minBet");
    if (baseBet % 2 != 0) return set_error(INVALID_BET, "baseBet must be even");
    if (bank < baseBet) return set_error(INSUFFICIENT_FUNDS, "Not enough bank for bet");

    // cut card：次のdeal前にだけ交換（仕様）
    if (shoe.size() <= shoe.cutSize) {
      shoe.rebuild_and_shuffle();
    }

    reset_round_state();
    bankAtRoundStart = bank;

    // 1ハンド作成＆ベット差し引き
    bank -= baseBet;
    init_single_hand_bet(baseBet, false, false);

    // 初期配り
    hands[0].cards.push_back(shoe.draw());
    dealer.push_back(shoe.draw());
    hands[0].cards.push_back(shoe.draw());
    dealer.push_back(shoe.draw());

    update_all_caches();

    // peek条件
    bool peek = should_peek();
    bool upIsAce = (!dealer.empty() && dealer[0].rank == 1);
    bool upIsTen = (!dealer.empty() && point_value(dealer[0]) == 10);

    // upcardがAなら insurance提示（ONなら）
    if (upIsAce && rules.allowInsurance) {
      ins.offered = true;
      ins.max = baseBet / 2; // baseBetは偶数
      ins.bet = 0;
      ins.evenMoneyOffered = (rules.allowEvenMoney && hands[0].flags.blackjack);
      ins.evenMoneyTaken = false;

      dealerHoleKnown = false;
      dealerPeekNoBJ = false; // peekはこの後（選択後）

      set_phase(Phase::OFFER_INSURANCE);
      return OK;
    }

    // A以外：10値なら即peekしてBJなら即終了（保険は出さない）
    if (upIsTen && peek && dealer_has_blackjack_now()) {
      dealerHoleKnown = true;
      // プレイヤーBJならpush、それ以外は負け
      if (hands[0].flags.blackjack) {
        bank += hands[0].bet;
      }
      int profitBeforeBonus = bank - bankAtRoundStart;
      int profitAfterBonus = apply_streak_bonus_if_needed(profitBeforeBonus);
      finalize_round_and_update_streak(profitAfterBonus);
      set_phase(Phase::ROUND_OVER);
      round += 1;
      if (session_over()) set_phase(Phase::SESSION_OVER);
      return OK;
    }

    dealerPeekNoBJ = true; // upcardがA/10でないならBJは成立しないので “peek済み扱い”

    // プレイヤーBJなら即精算（ディーラーBJは上のpeekで否定済み）
    if (hands[0].flags.blackjack) {
      dealerHoleKnown = false;
      bank += (hands[0].bet * 5) / 2; // 3:2
      int profitBeforeBonus = bank - bankAtRoundStart;
      int profitAfterBonus = apply_streak_bonus_if_needed(profitBeforeBonus);
      finalize_round_and_update_streak(profitAfterBonus);
      set_phase(Phase::ROUND_OVER);
      round += 1;
      if (session_over()) set_phase(Phase::SESSION_OVER);
      return OK;
    }

    set_phase(Phase::IN_HAND);
    return OK;
  }

  // OFFER_INSURANCE を確定し、peek→必要なら即終了
  int resolve_insurance_and_continue(bool evenMoneyTaken) {
    // dealer peek
    bool dealerBJ = dealer_has_blackjack_now();
    dealerHoleKnown = dealerBJ; // BJなら公開
    dealerPeekNoBJ = !dealerBJ;

    // Insurance精算（betは買った時点でbankから引いてある）
    if (dealerBJ && ins.bet > 0) {
      bank += ins.bet * 3; // 2:1 + bet返却 => 合計3倍
    }
    // dealerBJならメイン精算して終了
    if (dealerBJ) {
      // player BJならpush、それ以外は負け（betは既に引いてあるので戻すだけ）
      if (!hands.empty() && hands[0].flags.blackjack) {
        bank += hands[0].bet;
      }
      int profitBeforeBonus = bank - bankAtRoundStart;
      int profitAfterBonus = apply_streak_bonus_if_needed(profitBeforeBonus);
      finalize_round_and_update_streak(profitAfterBonus);
      set_phase(Phase::ROUND_OVER);
      round += 1;
      if (session_over()) set_phase(Phase::SESSION_OVER);
      return OK;
    }

    // dealerがBJでないなら、player BJはここで即精算して終了
    if (!hands.empty() && hands[0].flags.blackjack) {
      // Even Money を取っても、内部は insurance(bet/2) 購入扱いなので
      // (BJ 3:2) - (insurance) = net +bet になり自然に一致
      bank += (hands[0].bet * 5) / 2;
      int profitBeforeBonus = bank - bankAtRoundStart;
      int profitAfterBonus = apply_streak_bonus_if_needed(profitBeforeBonus);
      finalize_round_and_update_streak(profitAfterBonus);
      set_phase(Phase::ROUND_OVER);
      round += 1;
      if (session_over()) set_phase(Phase::SESSION_OVER);
      return OK;
    }

    set_phase(Phase::IN_HAND);
    return OK;
  }

  int buy_insurance(int amount) {
    if (phase == Phase::PAUSED) return set_error(INVALID_STATE, "Paused");
    if (phase != Phase::OFFER_INSURANCE) return set_error(INVALID_STATE, "Not offering insurance");
    clear_error();

    if (!ins.offered) return set_error(INVALID_STATE, "Insurance not offered");
    if (amount < 0) amount = 0;
    if (amount > ins.max) return set_error(INVALID_BET, "Insurance > max");
    if (bank < amount) return set_error(INSUFFICIENT_FUNDS, "Not enough bank for insurance");

    ins.bet = amount;
    if (amount > 0) bank -= amount;

    // amount=0 は「保険を買わない」
    ins.evenMoneyTaken = false;
    return resolve_insurance_and_continue(false);
  }

  int take_even_money() {
    if (phase == Phase::PAUSED) return set_error(INVALID_STATE, "Paused");
    if (phase != Phase::OFFER_INSURANCE) return set_error(INVALID_STATE, "Not offering insurance");
    clear_error();

    if (!ins.evenMoneyOffered) return set_error(NOT_SUPPORTED, "Even Money not offered");
    int amount = ins.max; // bet/2
    if (bank < amount) return set_error(INSUFFICIENT_FUNDS, "Not enough bank for even money");
    ins.bet = amount;
    bank -= amount;
    ins.evenMoneyTaken = true;
    return resolve_insurance_and_continue(true);
  }

  Hand* active_hand() {
    if (hands.empty()) return nullptr;
    if (activeHandIndex < 0 || activeHandIndex >= (int)hands.size()) return nullptr;
    return &hands[(size_t)activeHandIndex];
  }

  bool all_hands_finished() const {
    for (auto &h : hands) if (!h.flags.finished) return false;
    return true;
  }

  void advance_to_next_hand_or_settle() {
    // 次の未finishedへ
    for (int i = activeHandIndex + 1; i < (int)hands.size(); i++) {
      if (!hands[(size_t)i].flags.finished) {
        activeHandIndex = i;
        return;
      }
    }
    // 前方にも未finishedがあるかもしれない（安全）
    for (int i = 0; i < (int)hands.size(); i++) {
      if (!hands[(size_t)i].flags.finished) {
        activeHandIndex = i;
        return;
      }
    }
    // 全部終わってたら精算
    settle_all_hands_and_finish_round();
  }

  int hit() {
    if (phase == Phase::PAUSED) return set_error(INVALID_STATE, "Paused");
    if (phase != Phase::IN_HAND) return set_error(INVALID_STATE, "Not in hand");
    clear_error();

    Hand* h = active_hand();
    if (!h) return set_error(INTERNAL_ERROR, "No active hand");
    update_hand_cache(*h);

    if (h->flags.finished || h->flags.surrendered || h->flags.blackjack) {
      return set_error(INVALID_STATE, "Cannot hit now");
    }

    h->cards.push_back(shoe.draw());
    update_hand_cache(*h);

    if (h->flags.finished) {
      advance_to_next_hand_or_settle();
    }
    return OK;
  }

  int stand() {
    if (phase == Phase::PAUSED) return set_error(INVALID_STATE, "Paused");
    if (phase != Phase::IN_HAND) return set_error(INVALID_STATE, "Not in hand");
    clear_error();

    Hand* h = active_hand();
    if (!h) return set_error(INTERNAL_ERROR, "No active hand");

    update_hand_cache(*h);
    h->flags.finished = true;

    advance_to_next_hand_or_settle();
    return OK;
  }

  int surrender() {
    if (phase == Phase::PAUSED) return set_error(INVALID_STATE, "Paused");
    if (phase != Phase::IN_HAND) return set_error(INVALID_STATE, "Not in hand");
    clear_error();

    if (!rules.allowSurrender) return set_error(NOT_SUPPORTED, "Surrender is off");
    if (!dealerPeekNoBJ) return set_error(INVALID_STATE, "Surrender allowed only after peek/no-BJ");

    Hand* h = active_hand();
    if (!h) return set_error(INTERNAL_ERROR, "No active hand");

    // split後は不可
    if (h->flags.fromSplit) return set_error(INVALID_STATE, "No surrender after split");
    // 最初の2枚のみ
    if (h->cards.size() != 2) return set_error(INVALID_STATE, "Surrender only on first 2 cards");
    if (h->flags.blackjack) return set_error(INVALID_STATE, "Already blackjack");

    h->flags.surrendered = true;
    h->flags.finished = true;

    // bet は既に引いてあるので、半分返す
    bank += h->bet / 2;

    advance_to_next_hand_or_settle();
    return OK;
  }

  int double_down() {
    if (phase == Phase::PAUSED) return set_error(INVALID_STATE, "Paused");
    if (phase != Phase::IN_HAND) return set_error(INVALID_STATE, "Not in hand");
    clear_error();

    if (!rules.allowDouble) return set_error(NOT_SUPPORTED, "Double is off");

    Hand* h = active_hand();
    if (!h) return set_error(INTERNAL_ERROR, "No active hand");
    update_hand_cache(*h);

    if (h->flags.finished || h->flags.blackjack || h->flags.surrendered) return set_error(INVALID_STATE, "Cannot double now");
    if (h->cards.size() != 2) return set_error(INVALID_STATE, "Double only on first 2 cards");
    if (h->flags.splitAces) return set_error(INVALID_STATE, "No double on split aces hand");

    if (h->flags.fromSplit && !rules.allowDAS) return set_error(NOT_SUPPORTED, "DAS is off");

    if (bank < h->bet) return set_error(INSUFFICIENT_FUNDS, "Not enough bank for double");
    bank -= h->bet;
    h->bet += h->bet; // 同額追加
    h->flags.doubled = true;

    // 1枚だけ引いて強制終了
    h->cards.push_back(shoe.draw());
    update_hand_cache(*h);
    h->flags.finished = true;

    advance_to_next_hand_or_settle();
    return OK;
  }

  int split() {
    if (phase == Phase::PAUSED) return set_error(INVALID_STATE, "Paused");
    if (phase != Phase::IN_HAND) return set_error(INVALID_STATE, "Not in hand");
    clear_error();

    if (!rules.allowSplit) return set_error(NOT_SUPPORTED, "Split is off");
    if ((int)hands.size() >= 4) return set_error(INVALID_STATE, "Max hands reached (4)");

    Hand* h = active_hand();
    if (!h) return set_error(INTERNAL_ERROR, "No active hand");
    update_hand_cache(*h);

    if (h->flags.finished || h->flags.blackjack || h->flags.surrendered) return set_error(INVALID_STATE, "Cannot split now");
    if (h->cards.size() != 2) return set_error(INVALID_STATE, "Split only on first 2 cards");

    // Aの再スプリット不可：splitAces由来の手ならさらにsplit不可
    if (h->flags.splitAces) return set_error(INVALID_STATE, "No resplit aces");

    int v0 = split_value(h->cards[0]);
    int v1 = split_value(h->cards[1]);
    if (v0 != v1) return set_error(INVALID_STATE, "Cards not same value");

    // 追加ベットが必要
    if (bank < h->bet) return set_error(INSUFFICIENT_FUNDS, "Not enough bank for split");
    bank -= h->bet;

    // 2枚目を新ハンドへ移動
    Card second = h->cards[1];
    h->cards.pop_back();

    bool splittingAces = (h->cards[0].rank == 1 && second.rank == 1);

    // 新ハンド作成
    Hand h2;
    h2.bet = h->bet;
    h2.flags.fromSplit = true;
    h2.flags.splitAces = splittingAces;

    // もともとの手も split扱い
    h->flags.fromSplit = true;
    h->flags.splitAces = splittingAces;

    h2.cards.push_back(second);

    // split後は各手に1枚ずつ配る（テンポ良＆UI簡単）
    h->cards.push_back(shoe.draw());
    h2.cards.push_back(shoe.draw());

    // Aスプリットは「1枚で終了」
    if (splittingAces) {
      h->flags.finished = true;
      h2.flags.finished = true;
    }

    // handsに挿入（activeの次に置く）
    hands.insert(hands.begin() + (activeHandIndex + 1), h2);

    // 캐ッシュ更新
    update_all_caches();

    // ブラックジャック扱い：2枚で21ならBJとして終了（splitBJAsBJ=true想定）
    for (auto &hh : hands) {
      update_hand_cache(hh);
      if (rules.splitBJAsBJ && hh.flags.fromSplit && hh.flags.blackjack) {
        hh.flags.finished = true;
      }
    }

    // もしアクティブがすでにfinishedなら次へ
    if (active_hand() && active_hand()->flags.finished) {
      advance_to_next_hand_or_settle();
    }

    return OK;
  }

  // ===== JSON =====
  string json_bool(bool v) const { return v ? "true" : "false"; }

  string json_cards_array(const vector<Card>& cards, bool hideHole) const {
    string s = "[";
    for (size_t i = 0; i < cards.size(); i++) {
      if (i) s += ",";
      if (hideHole && i == 1) {
        s += "\"?\"";
      } else {
        s += "\"";
        s += card_str(cards[i]);
        s += "\"";
      }
    }
    s += "]";
    return s;
  }

  // canXXX は毎回ここで計算する（C++が真実）
  bool can_deal() const {
    if (phase == Phase::PAUSED) return false;
    if (!(phase == Phase::BETTING || phase == Phase::ROUND_OVER)) return false;
    if (session_over()) return false;
    if (baseBet < minBet) return false;
    if (baseBet % 2 != 0) return false;
    if (bank < baseBet) return false;
    return true;
  }

  bool can_hit() const {
    if (phase != Phase::IN_HAND) return false;
    if (phase == Phase::PAUSED) return false;
    if (hands.empty()) return false;
    if (activeHandIndex < 0 || activeHandIndex >= (int)hands.size()) return false;
    const Hand& h = hands[(size_t)activeHandIndex];
    if (h.flags.finished || h.flags.surrendered || h.flags.blackjack) return false;
    return true;
  }

  bool can_stand() const {
    if (phase != Phase::IN_HAND) return false;
    if (hands.empty()) return false;
    const Hand& h = hands[(size_t)activeHandIndex];
    if (h.flags.finished || h.flags.surrendered) return false;
    return true;
  }

  bool can_double() const {
    if (phase != Phase::IN_HAND) return false;
    if (!rules.allowDouble) return false;
    if (hands.empty()) return false;
    const Hand& h = hands[(size_t)activeHandIndex];
    if (h.flags.finished || h.flags.surrendered || h.flags.blackjack) return false;
    if (h.cards.size() != 2) return false;
    if (h.flags.splitAces) return false;
    if (h.flags.fromSplit && !rules.allowDAS) return false;
    if (bank < h.bet) return false;
    return true;
  }

  bool can_split() const {
    if (phase != Phase::IN_HAND) return false;
    if (!rules.allowSplit) return false;
    if ((int)hands.size() >= 4) return false;
    if (hands.empty()) return false;
    const Hand& h = hands[(size_t)activeHandIndex];
    if (h.flags.finished || h.flags.surrendered || h.flags.blackjack) return false;
    if (h.cards.size() != 2) return false;
    if (h.flags.splitAces) return false; // resplit acesなし
    if (bank < h.bet) return false;
    int v0 = split_value(h.cards[0]);
    int v1 = split_value(h.cards[1]);
    return v0 == v1;
  }

  bool can_surrender() const {
    if (phase != Phase::IN_HAND) return false;
    if (!rules.allowSurrender) return false;
    if (!dealerPeekNoBJ) return false; // Late
    if (hands.empty()) return false;
    const Hand& h = hands[(size_t)activeHandIndex];
    if (h.flags.fromSplit) return false;
    if (h.flags.finished || h.flags.surrendered || h.flags.blackjack) return false;
    if (h.cards.size() != 2) return false;
    return true;
  }

  string get_state_json() {
    update_all_caches();

    // dealer score
    ScoreInfo dsc = score_hand(dealer);

    // 表示用：hole隠しなら2枚目は "?"
    bool hideHole = (!dealerHoleKnown && dealer.size() >= 2 && (phase == Phase::IN_HAND || phase == Phase::OFFER_INSURANCE));
    int shownScore = 0;
    if (!dealer.empty()) {
      vector<Card> upOnly{dealer[0]};
      shownScore = score_hand(upOnly).total;
    }

    // player hands JSON
    string handsJson = "[";
    for (size_t i = 0; i < hands.size(); i++) {
      if (i) handsJson += ",";
      const Hand& h = hands[i];
      handsJson += "{";
      handsJson += "\"cards\":[";
      for (size_t j = 0; j < h.cards.size(); j++) {
        if (j) handsJson += ",";
        handsJson += "\"";
        handsJson += card_str(h.cards[j]);
        handsJson += "\"";
      }
      handsJson += "],";
      handsJson += "\"score\":" + std::to_string(h.score) + ",";
      handsJson += "\"bet\":" + std::to_string(h.bet) + ",";
      handsJson += "\"flags\":{";
      handsJson += "\"blackjack\":" + json_bool(h.flags.blackjack) + ",";
      handsJson += "\"bust\":" + json_bool(h.flags.bust) + ",";
      handsJson += "\"doubled\":" + json_bool(h.flags.doubled) + ",";
      handsJson += "\"surrendered\":" + json_bool(h.flags.surrendered) + ",";
      handsJson += "\"finished\":" + json_bool(h.flags.finished) + ",";
      handsJson += "\"fromSplit\":" + json_bool(h.flags.fromSplit) + ",";
      handsJson += "\"splitAces\":" + json_bool(h.flags.splitAces);
      handsJson += "}";
      handsJson += "}";
    }
    handsJson += "]";

    // rules JSON（UIがトグル状態を復元できるように）
    string rulesJson = "{";
    rulesJson += "\"allowDouble\":" + json_bool(rules.allowDouble) + ",";
    rulesJson += "\"allowSplit\":" + json_bool(rules.allowSplit) + ",";
    rulesJson += "\"allowSurrender\":" + json_bool(rules.allowSurrender) + ",";
    rulesJson += "\"allowInsurance\":" + json_bool(rules.allowInsurance) + ",";
    rulesJson += "\"allowEvenMoney\":" + json_bool(rules.allowEvenMoney) + ",";
    rulesJson += "\"allowDAS\":" + json_bool(rules.allowDAS) + ",";
    rulesJson += "\"splitBJAsBJ\":" + json_bool(rules.splitBJAsBJ) + ",";
    rulesJson += "\"dealerHitSoft17\":" + json_bool(rules.dealerHitSoft17);
    rulesJson += "}";

    string canJson = "{";
    canJson += "\"deal\":" + json_bool(can_deal()) + ",";
    canJson += "\"hit\":" + json_bool(can_hit()) + ",";
    canJson += "\"stand\":" + json_bool(can_stand()) + ",";
    canJson += "\"double\":" + json_bool(can_double()) + ",";
    canJson += "\"split\":" + json_bool(can_split()) + ",";
    canJson += "\"surrender\":" + json_bool(can_surrender()) + ",";
    canJson += "\"insurance\":" + json_bool(phase == Phase::OFFER_INSURANCE && ins.offered) + ",";
    canJson += "\"evenMoney\":" + json_bool(phase == Phase::OFFER_INSURANCE && ins.evenMoneyOffered) + ",";
    canJson += "\"nextRound\":" + json_bool(phase == Phase::ROUND_OVER && !session_over());
    canJson += "}";

    // roundResult
    string rrJson = "{";
    rrJson += "\"netProfit\":" + std::to_string(rr.netProfit) + ",";
    rrJson += "\"streak\":" + std::to_string(rr.streak) + ",";
    rrJson += "\"bonusPercent\":" + std::to_string(rr.bonusPercent) + ",";
    rrJson += "\"bonusApplied\":" + std::to_string(rr.bonusApplied);
    rrJson += "}";

    string insJson = "{";
    insJson += "\"offered\":" + json_bool(phase == Phase::OFFER_INSURANCE && ins.offered) + ",";
    insJson += "\"max\":" + std::to_string(ins.max) + ",";
    insJson += "\"bet\":" + std::to_string(ins.bet) + ",";
    insJson += "\"evenMoneyOffered\":" + json_bool(phase == Phase::OFFER_INSURANCE && ins.evenMoneyOffered);
    insJson += "}";

    // shoe
    string shoeJson = "{";
    shoeJson += "\"decks\":" + std::to_string(shoe.decks) + ",";
    shoeJson += "\"deckSize\":" + std::to_string(shoe.size()) + ",";
    shoeJson += "\"cutSize\":" + std::to_string(shoe.cutSize) + ",";
    shoeJson += "\"reshuffleSoon\":" + json_bool(shoe.size() <= shoe.cutSize);
    shoeJson += "}";

    // session
    string sessJson = "{";
    sessJson += "\"round\":" + std::to_string(round) + ",";
    sessJson += "\"roundLimit\":" + std::to_string(roundLimit) + ",";
    sessJson += "\"timeLeftMs\":" + std::to_string(timeLeftMs);
    sessJson += "}";

    string dealerJson = "{";
    dealerJson += "\"cards\":" + json_cards_array(dealer, hideHole) + ",";
    dealerJson += "\"score\":" + std::to_string(dsc.total) + ",";
    dealerJson += "\"scoreShown\":" + std::to_string(shownScore) + ",";
    dealerJson += "\"upcard\":\"" + (dealer.empty() ? string("") : card_str(dealer[0])) + "\",";
    dealerJson += "\"holeKnown\":" + json_bool(dealerHoleKnown);
    dealerJson += "}";

    string playerJson = "{";
    playerJson += "\"activeHandIndex\":" + std::to_string(activeHandIndex) + ",";
    playerJson += "\"hands\":" + handsJson;
    playerJson += "}";

    string s = "{";
    s += "\"schemaVersion\":1,";
    s += "\"phase\":\""; s += phase_str(phase); s += "\",";
    s += "\"rules\":" + rulesJson + ",";
    s += "\"bank\":" + std::to_string(bank) + ",";
    s += "\"baseBet\":" + std::to_string(baseBet) + ",";
    s += "\"minBet\":" + std::to_string(minBet) + ",";
    s += "\"maxBet\":" + std::to_string(bank) + ","; // maxはbankまで
    s += "\"session\":" + sessJson + ",";
    s += "\"shoe\":" + shoeJson + ",";
    s += "\"dealer\":" + dealerJson + ",";
    s += "\"player\":" + playerJson + ",";
    s += "\"insurance\":" + insJson + ",";
    s += "\"can\":" + canJson + ",";
    s += "\"roundResult\":" + rrJson + ",";
    s += "\"lastErrorCode\":" + std::to_string(lastErrorCode) + ",";
    s += "\"lastError\":\"" + json_escape(lastError) + "\"";
    s += "}";

    return s;
  }
};

static Engine g;

} // namespace bj

// ===== Export C API =====
extern "C" {

EMSCRIPTEN_KEEPALIVE
int start_session(uint32_t seedLo, uint32_t seedHi, uint32_t rulesMask, int sessionSeconds, int roundLimit) {
  uint64_t seed = (uint64_t(seedHi) << 32) | uint64_t(seedLo);
  return bj::g.start_session(seed, rulesMask, sessionSeconds, roundLimit);
}

EMSCRIPTEN_KEEPALIVE
int reset_session() {
  return bj::g.reset_session();
}

EMSCRIPTEN_KEEPALIVE
int set_time_left_ms(int ms) {
  return bj::g.set_time_left_ms(ms);
}

EMSCRIPTEN_KEEPALIVE
int set_paused(int paused01) {
  return bj::g.set_paused(paused01);
}

EMSCRIPTEN_KEEPALIVE
int set_bet(int amount) {
  return bj::g.set_bet(amount);
}

EMSCRIPTEN_KEEPALIVE
int deal() {
  return bj::g.deal();
}

EMSCRIPTEN_KEEPALIVE
int hit() {
  return bj::g.hit();
}

EMSCRIPTEN_KEEPALIVE
int stand() {
  return bj::g.stand();
}

EMSCRIPTEN_KEEPALIVE
int double_down() {
  return bj::g.double_down();
}

EMSCRIPTEN_KEEPALIVE
int split() {
  return bj::g.split();
}

EMSCRIPTEN_KEEPALIVE
int surrender() {
  return bj::g.surrender();
}

EMSCRIPTEN_KEEPALIVE
int buy_insurance(int amount) {
  return bj::g.buy_insurance(amount);
}

EMSCRIPTEN_KEEPALIVE
int take_even_money() {
  return bj::g.take_even_money();
}

EMSCRIPTEN_KEEPALIVE
char* get_state_json() {
  string s = bj::g.get_state_json();
  char* buf = (char*)std::malloc(s.size() + 1);
  std::memcpy(buf, s.c_str(), s.size() + 1);
  return buf;
}

EMSCRIPTEN_KEEPALIVE
void free_ptr(char* p) {
  std::free(p);
}

} // extern "C"
