/**
 * AudioManager - ブラックジャック用SE管理システム
 */
class AudioManager {
    constructor() {
        this.sounds = {};
        this.unlocked = false;
        this.basePath = "assets/audio/se/";
        this.config = {
            blackjack:     { file: "blackjack.mp3",     vol: 0.8 },
            button_action: { file: "button_action.mp3", vol: 0.4 },
            card_deal:     { file: "card_deal.mp3",     vol: 0.5 },
            card_flip:     { file: "card_flip.mp3",     vol: 0.5 },
            chip_gain:     { file: "chip_gain.mp3",     vol: 0.6 },
            chip_place:    { file: "chip_place.mp3",    vol: 0.4 },
            game_start:    { file: "game_start.mp3",    vol: 0.7 },
            level_up:      { file: "level_up.mp3",      vol: 0.8 },
            lose:          { file: "lose.mp3",          vol: 0.7 },
            push:          { file: "push.mp3",          vol: 0.6 },
            ui_click:      { file: "ui_click.mp3",      vol: 0.3 },
            ui_error:      { file: "ui_error.mp3",      vol: 0.5 },
            win:           { file: "win.mp3",           vol: 0.7 }
        };
    }

    /**
     * 初期化とプリロード
     */
    init() {
        Object.keys(this.config).forEach(name => {
            const item = this.config[name];
            const audio = new Audio();
            audio.src = this.basePath + item.file;
            audio.load();
            this.sounds[name] = audio;
        });
    }

    /**
     * ブラウザの自動再生制御を解除するための処理
     * 初回のユーザー操作（クリック等）で呼び出す
     */
    unlock() {
        if (this.unlocked) return;
        
        // 空のバッファを再生してアンロック
        Object.values(this.sounds).forEach(audio => {
            audio.play().then(() => {
                audio.pause();
                audio.currentTime = 0;
            }).catch(() => {
                // 再生失敗は無視（ユーザー操作前など）
            });
        });

        this.unlocked = true;
        console.log("Audio unlocked successfully");
    }

    /**
     * SEを再生
     * @param {string} name 音源名
     * @param {number} volScale 音量の追加倍率 (オプション)
     */
    play(name, volScale = 1.0) {
        const item = this.config[name];
        const audio = this.sounds[name];

        if (!item || !audio) {
            console.warn(`Sound not found: ${name}. Available:`, Object.keys(this.sounds));
            return;
        }

        // 連続再生（カード配布など）に対応するため、複製して再生
        const clone = audio.cloneNode();
        clone.volume = item.vol * volScale;
        
        const playPromise = clone.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                // 自動再生制限などで失敗した場合はログのみ
                console.debug(`Playback prevented for ${name}:`, error);
            });
        }
        
        // 再生終了後に要素を破棄（メモリリーク防止）
        clone.onended = () => {
            clone.remove();
        };
    }
}

// グローバルインスタンスを作成
window.audioMgr = new AudioManager();
