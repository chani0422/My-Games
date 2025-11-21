#include <vector>
#include <string>
#include <algorithm>
#include <random>
#include <cstring>
#include <cstdlib>
#include <emscripten/emscripten.h>

using namespace std;

struct Card { int value; };
static vector<Card> deck;
static vector<Card> player, dealer;
static mt19937 rng(random_device{}());

// デッキ作成
vector<Card> createDeck() {
    vector<Card> d;
    for (int s = 0; s < 4; s++)
        for (int v = 1; v <= 13; v++)
            d.push_back({v});
    return d;
}

// スコア計算
int calcScore(const vector<Card>& hand) {
    int score = 0, aceCnt = 0;
    for (auto &c : hand) {
        if (c.value == 1) { score += 1; aceCnt++; }
        else if (c.value >= 11) score += 10;
        else score += c.value;
    }
    while (aceCnt > 0 && score + 10 <= 21) {
        score += 10;
        aceCnt--;
    }
    return score;
}

// 手札を文字列化
string handToStr(const vector<Card>& h) {
    string s;
    for (auto &c : h) {
        if (c.value == 1) s += "A ";
        else if (c.value == 11) s += "J ";
        else if (c.value == 12) s += "Q ";
        else if (c.value == 13) s += "K ";
        else s += to_string(c.value) + " ";
    }
    return s;
}

extern "C" {

// 初期化
EMSCRIPTEN_KEEPALIVE
void init_game() {
    deck = createDeck();
    shuffle(deck.begin(), deck.end(), rng);

    player.clear();
    dealer.clear();

    player.push_back(deck.back()); deck.pop_back();
    dealer.push_back(deck.back()); deck.pop_back();
    player.push_back(deck.back()); deck.pop_back();
    dealer.push_back(deck.back()); deck.pop_back();
}

// プレイヤーに1枚配る
EMSCRIPTEN_KEEPALIVE
int player_hit() {
    if (deck.empty()) return -1;
    player.push_back(deck.back()); deck.pop_back();
    return calcScore(player);
}

// プレイヤースタンド → ディーラー処理
EMSCRIPTEN_KEEPALIVE
int player_stand_and_dealer() {
    // ディーラーターン：スコアが 17 未満のあいだだけ引く
    while (calcScore(dealer) < 17) {
        if (deck.empty()) {
            // 念のため安全対策：デッキが空ならループを抜ける
            break;
        }
        dealer.push_back(deck.back());
        deck.pop_back();
    }

    int p = calcScore(player);
    int d = calcScore(dealer);

    if (d > 21) return 100 + p;  // dealer bust
    if (p > d)  return 200 + p;  // player win
    if (p < d)  return 300 + d;  // player lose
    return 400 + p;              // draw
}

// 状態を JSON 文字列で返す
EMSCRIPTEN_KEEPALIVE
char* get_state_json() {
    string s = "{";
    s += "\"player\":\"" + handToStr(player) + "\",";
    s += "\"dealer\":\"" + handToStr(dealer) + "\",";
    s += "\"playerScore\":" + to_string(calcScore(player)) + ",";
    s += "\"dealerScore\":" + to_string(calcScore(dealer)) + ",";
    s += "\"deckSize\":" + to_string((int)deck.size());
    s += "}";

    char* buf = (char*)malloc(s.size() + 1);
    memcpy(buf, s.c_str(), s.size() + 1);
    return buf;
}



// メモリ解放
EMSCRIPTEN_KEEPALIVE
void free_ptr(char* p) {
    free(p);
}

} // extern "C"
