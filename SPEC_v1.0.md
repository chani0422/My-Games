✅ BlackJack WASM 仕様書 v1.0（FIXED）
0. 概要
タイトル：BlackJack（C++→WASM / GitHub Pages）

目標：3〜5分で遊べるセッション制のブラックジャック（将来CrazyGames投稿想定）

設計方針（Authority）

C++（WASM）が真実：ルール・状態・bank・bet・精算・canXXX判定を全て管理

JSはUI/入力/画面遷移/タイマー表示＋C++関数呼び出しのみ

状態は毎回 get_state_json()（フルstate）で描画

エラーは 返り値 int（0=OK）＋ state内 lastError

JSONに schemaVersion を必ず含める


1. 画面（UI）と遷移
1.1 画面
Menu（タイトル）

HowTo（遊び方）

Game（プレイ画面）

Pause Overlay（ゲーム中のみ、右上Menuボタン）

1.2 遷移
Menu → Start → Game（セッション開始）

Menu → HowTo → Menu

Game → Pause（右上Menu）

Pause → Continue → Game

Pause → HowTo → Pause

Pause → Quit to Title → Menu（セッション終了）

1.3 ランキングReset（誤操作防止）
Resetボタンは 1回タップで「Hold to reset」に変化

その後 2秒長押しで実行

指を離す/キャンセルで中断、一定時間で通常表示へ戻る


2. ルール仕様（確定）
2.1 点数
2〜9：数字通り

10 / J / Q / K：10扱い

A：1 または 11（21を超えないなら 11 優先）

2.2 ディーラー規則
Soft17（Aを11扱いできる17）ではHit（H17）

2.3 精算（ベース）
Blackjack配当：3:2

勝ち：+bet

負け：-bet

引き分け：±0

Splitでできた手もBJ扱い（3:2適用）（本仕様）

2.4 Double Down
追加ベット：同額

Double後：1回Hitで強制Stand

DAS（Split後Double）：許可

Aスプリット手：double不可（1枚で終了のため）

2.5 Split
Split条件：同“点数”ならOK（例：10 と K は可）

Split後：Hit無制限

AのSplit：1枚だけ引いて終了（そのハンドはfinished）

Split後Surrender：不可

最大Split回数：3回（最大4ハンド）

Aの再スプリット：不可（安全で一般的寄り）

2.6 Surrender
方式：Late Surrender

ディーラーBJチェック（peek）後にのみ可能

効果：その時点で -bet/2 で降参（ハンド終了）

実行可能：原則「最初の2枚」のみ（split後不可は上で確定）

2.7 Insurance / Even Money
Insurance提示：ディーラー表が A のとき

Insurance上限：bet/2

Insurance配当：ディーラーBJなら 2:1

Even Money：

条件：プレイヤーBJ & ディーラー表A

UI：Even Moneyのみ表示（この場面はInsuranceを出さない）

内部処理：insuranceをbet/2自動購入した扱いで統一


3. セッション仕様（確定）
3.1 セッション
初期チップ：1000

セッション時間：選択式（3分 or 5分）

セッション終了条件：

時間切れ

ラウンド上限：12

ラウンド定義：deal() 1回 = 1ラウンド（splitしても+1のみ）

3.2 ベット
最小：10

最大：bankまで

ボタン刻み：+10 / +50 / +100 / +200

自由入力：可能

偶数制限：ベットは偶数のみ

odd入力時：偶数へ下方向に自動丸め（floor to even）

例：101→100、11→10

ただし minBet 未満になったら INVALID_BET で拒否

3.3 連勝ボーナス（確定）
連勝kのとき、勝利時の「利益」に +5%×k（上限+25%）

streak判定：ラウンド単位

netProfit > 0 → streak++

netProfit < 0 → streak=0

netProfit == 0 → streak維持

3.4 破産救済（広告）
破産時：広告視聴で +100 復活（将来実装）

現段階：コードは用意し、コメントアウト


4. デッキ/シュー仕様（確定）
デッキ数：6デッキ（312枚）

リシャッフル：

残り 25%（78枚）以下になったら交換

タイミング：次のdeal開始前のみ（ラウンド途中は交換しない）

乱数：

本番：JSが crypto.getRandomValues でseed生成→C++に渡す

デバッグ：seed指定で完全再現可能


5. Pause仕様（確定）
右上Menuは セッション終了ではなく Pause

Pause中：

タイマー停止（JS）

入力無効化（JS）

C++側も phase=paused 中はアクションを INVALID_STATE で拒否（安全網）


6. WASM API（確定：方針）
返り値：int（0=OK、非0=エラー）

状態：char* get_state_json()（schemaVersion=1で固定）

6.1 Export関数（必要）
start_session(seedLo, seedHi, rulesMask, sessionSeconds, roundLimit)

reset_session()

set_bet(amount)

deal()

hit()

stand()

double_down()

split()

surrender()

buy_insurance(amount)

take_even_money()

set_paused(paused01)（採用）

set_time_left_ms(ms)（採用：C++がauthorityで残り時間保持）

get_state_json()

free_ptr(p)


7. JSONスキーマ（schemaVersion=1：確定）
phase: "menu" | "betting" | "offerInsurance" | "inHand" | "roundOver" | "paused" | "sessionOver"

can: { deal, hit, stand, double, split, surrender, insurance, evenMoney, nextRound }

player.hands[] と activeHandIndex を必ず含む

lastErrorCode, lastError を必ず含む

roundResult.netProfit, streak, multiplier を含む（ランキングは将来だがセッションに必要）


8. エラーコード（最小）
0 OK

1 INVALID_STATE

2 INSUFFICIENT_FUNDS

3 INVALID_BET

4 NOT_SUPPORTED

5 INTERNAL_ERROR


✅ ステップ1であなたがやること（コードなし）
この仕様書をリポジトリに SPEC_v1.0.md として保存

ブランチ engine-v2 を作って、その仕様書を コミット（「仕様固定」という記録が残る）


次はステップ2（C++エンジン骨格：GameState / Rules / Shoe / Hand / score判定(H17対応)）に入ります。ステップ2では、あなたが貼ってくれた旧C++を置き換える形で“新しいエンジンの土台コード”を私が生成していきます。
