/* Canvas presentation and browser controls. No external dependencies. */
(() => {
  "use strict";
  const APP_VERSION = "0.5.0";
  const { PLANETS, STAGES, getStage, getPlanet, stageLabel } = StarStages;
  const {
      Game,
      Records,
      CONFIG: c,
      formatTime,
      FLIGHT_CATEGORIES,
      FLIGHT_UPGRADES,
    } = StarDodge,
    $ = (id) => document.getElementById(id);
  let storage;
  try {
    storage = window.localStorage;
  } catch {}
  const progress = new StarProgress.Progress(storage);
  let sessionStorage;
  try {
    sessionStorage = window.sessionStorage;
  } catch {}
  const account = new StarServices.Account(window.STAR_DODGE_CONFIG, {
    storage: sessionStorage,
  });
  const monetization = new StarServices.Monetization();
  let runLoadout,
    runId = "",
    runUnlocks = [],
    runReward = StarProgress.calculateFlightReward(0, 0);
  const records = new Records(storage),
    game = new Game(),
    canvas = $("game"),
    ctx = canvas.getContext("2d"),
    systemMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const synth = new StarAudio.Synth(),
    fx = new StarEffects.Effects({ particleLimit: c.particles });
  synth.setVolume(records.data.volume);
  synth.setEnabled(records.data.sound);
  let choiceCursor = 0,
    hasFocus = document.hasFocus(),
    nativeActive = true;
  let reduced = systemMotion.matches || progress.data.reduceEffects;
  function applyMotion() {
    reduced = systemMotion.matches || progress.data.reduceEffects;
    document.documentElement.classList.toggle("reduce-effects", reduced);
    if (reduced) fx.clear();
  }
  let last = performance.now(),
    uiState = "",
    keys = new Set(),
    pointer = null,
    toastUntil = 0,
    newBest = false,
    displayState = "";
  const stars = Array.from({ length: 90 }, (_, i) => ({
    x: ((((Math.sin(i * 127.1) * 43758.5453) % 1) + 1) % 1) * c.width,
    y: ((((Math.sin(i * 311.7) * 19491.451) % 1) + 1) % 1) * c.height,
    r: i % 9 === 0 ? 1.4 : 0.65,
    speed: 5 + (i % 13),
  }));
  const colors = Object.fromEntries(
      FLIGHT_UPGRADES.map((up) => [up.id, up.color]),
    ),
    names = { speed: "SPEED", multi: "MULTI", sub: "SUB" },
    icons = { speed: "↑", multi: "⋮", sub: "✧" };
  function unlockAudio() {
    synth.setVolume(records.data.volume);
    synth.setEnabled(records.data.sound);
    synth.unlock();
  }
  function silence() {
    synth.stop();
  }
  function sound(type, data = {}) {
    synth.effect(type, data);
  }
  function refreshRecords() {
    $("side-best").textContent = formatTime(records.data.best);
    $("live-best").textContent = `BEST ${formatTime(records.data.best)} SEC`;
    $("storage-note").textContent =
      records.tabOnly || progress.tabOnly ? "記録はこのタブ内のみ保持" : "";
    $("sound").textContent = records.data.sound ? "SOUND ON" : "SOUND OFF";
    $("sound").setAttribute("aria-pressed", String(records.data.sound));
  }
  function clearControls() {
    keys.clear();
    game.input = { x: 0, y: 0 };
    if (pointer !== null) {
      try {
        canvas.releasePointerCapture(pointer.id);
      } catch {}
      pointer = null;
    }
  }
  function start() {
    reloadForUpdate = false;
    silence();
    clearControls();
    runLoadout = progress.loadout();
    game.start(runLoadout);
    runId =
      globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    runReward = StarProgress.calculateFlightReward(0, 0);
    runUnlocks = [];
    fx.clear();
    toastUntil = 0;
    newBest = false;
    last = performance.now();
    unlockAudio();
    canvas.focus({ preventScroll: true });
  }
  function pause() {
    game.pause();
    clearControls();
    silence();
  }
  function resume() {
    clearControls();
    game.resume();
    last = performance.now();
    unlockAudio();
    canvas.focus({ preventScroll: true });
  }
  function title() {
    silence();
    clearControls();
    game.title();
    renderHome();
    fx.clear();
    toastUntil = 0;
  }
  function panel() {
    const state = game.state;
    $("home").hidden = state !== "title";
    $("flight-layout").hidden = state === "title";
    if (state === uiState) return;
    uiState = state;
    if (state === "title" || state === "countdown") window.scrollTo(0, 0);
    document.querySelector(".brief .eyebrow").textContent = game.stage
      ? "8 PLANETS / 40 STAGES"
      : "ENDLESS SPACE SURVIVAL";
    document.querySelector(".brief .intro").textContent = game.stage
      ? `通し番号 ${game.stage.id} / ${STAGES.length} · ${stageLabel(game.stage.id)} · 30秒後は残敵を撃破。中央の白い円が当たり判定。`
      : "制限時間なしで記録に挑戦。中央の白い円が当たり判定。";
    $("panel").classList.toggle("choice-panel", state === "upgrade");
    $("panel").classList.toggle("result-panel", state === "result");
    const overlay = $("overlay");
    overlay.hidden = state === "playing" || state === "countdown";
    $("count").hidden = state !== "countdown";
    $("check-update").disabled =
      !["title", "result"].includes(state) || !!window.Capacitor;
    $("pause").disabled = ![
      "playing",
      "countdown",
      "paused",
      "upgrade",
    ].includes(state);
    $("pause").textContent = state === "paused" ? "▶" : "Ⅱ";
    $("pause").setAttribute(
      "aria-label",
      state === "paused" ? "再開" : "一時停止",
    );
    if (state === "title")
      $("panel").innerHTML =
        `<span class="overline">READY FOR TAKEOFF</span><div class="ship-symbol" aria-hidden="true">⟐</div><h2>限界の、その先へ。</h2><p>迫る隕石をよけ、機体を強化。<br>あなたは何秒、生き残れる？</p><p class="title-best">自己ベスト ${formatTime(records.data.best)} 秒</p><button class="primary" data-action="start">フライト開始 <span aria-hidden="true">↗</span></button><p class="tip">WASD / 矢印キー またはドラッグで移動<br>射撃は自動。制限時間なし。</p>`;
    if (state === "paused")
      $("panel").innerHTML =
        '<span class="overline">FLIGHT ON HOLD</span><h2>一時停止</h2><p>ひと息ついたら、もう一度宇宙へ。</p><button class="primary" data-action="resume">フライトを再開</button><button class="secondary" data-action="start">最初から</button><button class="secondary" data-action="title">タイトルへ</button>';
    if (state === "upgrade") {
      clearControls();
      choiceCursor = 0;
      $("panel").innerHTML =
        `<span class="overline">UPGRADE CORE ACQUIRED</span><h2>次の一手を、選ぼう。</h2><p>フライトは停止中 · この回だけの強化</p><div class="upgrade-choices" role="group" aria-label="フライト強化を選択">${game.choices.map((up, i) => `<button class="flight-choice" data-choice="${i}" style="--choice-color:${up.color}"><span class="choice-icon">${up.icon}</span><span><b>${up.name}</b><small>${up.description}</small><em>${up.id === "coins" ? "余剰コア" : `次の段階 ${game.upgradeLevel(up.id) + 1} / ${up.max}`}</em></span><kbd>${i + 1}</kbd></button>`).join("")}</div><p class="choice-help">タップ / 1–3 / 矢印＋Enter で決定</p>`;
      $("panel").querySelector("button")?.focus({ preventScroll: true });
    }
    if (state === "result")
      $("panel").innerHTML =
        `<span class="overline">${game.outcome === "cleared" ? (game.elimination ? "ELIMINATION COMPLETE" : "STAGE CLEAR") : "FLIGHT COMPLETE"}</span><h2>${game.outcome === "cleared" ? (game.stage.id === STAGES.length ? `全${STAGES.length}ステージ、制覇！` : `${stageLabel(game.stage.id)} クリア！`) : "次は、もう1秒先へ。"}</h2>${runUnlocks.map((ship) => `<p class="ship-unlock" role="status">✦ 新機体「${ship.name}」解放！<small>ホームの機体ハンガーで選択できます</small></p>`).join("")}<div class="result-time">${formatTime(game.time * 1000)}<small> SEC</small></div><span class="best-badge">${newBest ? "✦ NEW PERSONAL BEST" : "SURVIVAL RECORD"}</span><p>自己ベスト ${formatTime(records.data.best)} 秒</p><p class="flight-reward">+${runReward.totalCoins} コイン <small>フライト報酬</small></p><dl class="reward-breakdown" aria-label="コインの内訳"><div><dt>生存報酬</dt><dd>${runReward.survivalCoins} コイン</dd></div><div><dt>到達ボーナス</dt><dd>${runReward.milestoneCoins} コイン</dd></div><div><dt>破壊ボーナス</dt><dd>${runReward.destructionCoins} コイン</dd></div>${runReward.coreCoins ? `<div class="first-clear-reward"><dt>余剰コア</dt><dd>+${runReward.coreCoins} コイン</dd></div>` : ""}${runReward.firstClearCoins ? `<div class="first-clear-reward"><dt>初回クリア報酬</dt><dd>+${runReward.firstClearCoins} コイン</dd></div>` : ""}</dl><div class="result-grid">破壊した隕石 <strong>${game.destroyed}</strong> 個<br>SPEED <strong>Lv.${game.levels.speed}</strong>　MULTI <strong>${c.main.angles[game.levels.multi - 1].length}発</strong>　SUB <strong>Lv.${game.levels.sub}</strong><br><small>連射Lv.${game.skills.rapid} · 弾威力${1 + game.skills.damage} · 吸引Lv.${game.skills.magnet}</small></div><button class="primary" data-action="${game.outcome === "cleared" && game.stage.id < STAGES.length ? "next-stage" : "retry"}">${game.outcome === "cleared" && game.stage.id < STAGES.length ? `${stageLabel(game.stage.id + 1)}へ進む ↗` : game.stage ? "同じステージに挑戦 ↗" : "もう一度フライト ↗"}</button><div class="result-actions"><button class="secondary" data-action="title">ホームへ</button><button class="secondary" data-action="share">記録を共有 ↗</button></div><p id="share-status" class="share-status" role="status"></p><button class="secondary ad-placeholder" disabled>短い動画で追加報酬 · 準備中</button>`;

    if (state === "paused" || state === "result")
      document.querySelector("#panel .primary")?.focus({ preventScroll: true });
  }
  function updateUI() {
    panel();
    $("flight-label").textContent = game.stage
      ? game.elimination
        ? `${stageLabel(game.stage.id)} · 殲滅 残り ${game.remainingRocks}`
        : `${stageLabel(game.stage.id)} · 出現30秒`
      : "ENDLESS / 生存時間";
    const s = `${Math.floor(game.time * 10)}|${game.player.hp}|${game.levels.speed}|${game.levels.multi}|${game.levels.sub}`;
    if (s !== displayState) {
      displayState = s;
      $("time").innerHTML =
        formatTime(game.time * 1000) + "<small> SEC</small>";
      $("hp").textContent =
        "♥ ".repeat(game.player.hp) +
        "♡ ".repeat((game.player.maxHp || c.player.hp) - game.player.hp);
      $("hp").setAttribute("aria-label", `残りHP ${game.player.hp}`);
      $("speed-level").innerHTML =
        `Lv. ${game.levels.speed} <small>/ ${c.main.speeds.length}</small>`;
      $("multi-level").innerHTML =
        `${c.main.angles[game.levels.multi - 1].length} 発 <small>/ ${c.main.angles.at(-1).length}</small>`;
      $("sub-level").innerHTML =
        `Lv. ${game.levels.sub} <small>/ ${c.sub.max}</small>`;
    }
    if (game.state === "countdown")
      $("count").innerHTML =
        Math.max(1, Math.ceil(game.countdown)) + "<small>GET READY</small>";
    $("toast").classList.toggle(
      "active",
      game.state === "playing" && game.time < toastUntil,
    );
  }
  function effects() {
    for (const e of game.events) {
      if (e.type === "gameover") {
        newBest = records.finish(e.ms);
        const previousShips = new Set(progress.data.unlocked);
        runReward =
          progress.finish(runId, e.ms, game.destroyed, {
            coreCoins: game.coreCoins,
            stage: game.stage?.id ?? null,
            cleared: e.cleared === true,
            ship: runLoadout.ship,
            skin: runLoadout.skin,
            initialLevels: runLoadout.levels,
            endLevels: { ...game.levels },
          }).reward || StarProgress.calculateFlightReward(0, 0);
        runUnlocks = StarProgress.SHIPS.filter(
          (ship) =>
            !previousShips.has(ship.id) && progress.isShipUnlocked(ship.id),
        );
        renderHome();
        refreshRecords();
        clearControls();
      }
      if (e.type === "upgrade") {
        $("toast").textContent =
          `${icons[e.kind]} ${names[e.kind]} → Lv. ${e.level}`;
        $("toast").style.borderColor = colors[e.kind];
        toastUntil = game.time + 2;
      }
      if (e.type === "event") {
        $("toast").textContent =
          e.kind === "rush"
            ? "METEOR RUSH · 隕石ラッシュ"
            : "ELITE SIGNAL · エリート出現";
        $("toast").style.borderColor =
          e.kind === "rush" ? "#ff9fac" : "#ffd47d";
        toastUntil = game.time + 2.8;
      }
      if (e.type === "elimination") {
        $("toast").textContent = "TIME UP — 残りの隕石を殲滅せよ";
        $("toast").style.borderColor = "#ffd47d";
        toastUntil = game.time + 3;
      }
      sound(
        e.type === "explosion"
          ? "destroy"
          : e.type === "elimination"
            ? "event"
            : e.type === "gameover" && e.cleared
              ? "clear"
              : e.type,
        e,
      );
      fx.add(e, reduced);
    }
    game.events.length = 0;
  }
  function resize() {
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = c.width * scale;
    canvas.height = c.height * scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }
  function ship(x, y, scale = 1, drone = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.shadowColor = drone ? "#71f3e0" : game.player.color || "#71f3e0";
    ctx.shadowBlur = reduced ? 0 : 12;
    ctx.fillStyle = drone ? "#71f3e0" : game.player.color || "#71f3e0";
    ctx.beginPath();
    const points =
      !drone && game.player.ship === "lance"
        ? [
            [0, -28],
            [8, -2],
            [12, 17],
            [0, 10],
            [-12, 17],
            [-8, -2],
          ]
        : !drone && game.player.ship === "nova"
          ? [
              [0, -21],
              [9, -5],
              [18, -1],
              [18, 14],
              [7, 11],
              [0, 16],
              [-7, 11],
              [-18, 14],
              [-18, -1],
              [-9, -5],
            ]
          : !drone && game.player.ship === "seeker"
            ? [
                [0, -22],
                [8, -9],
                [19, -5],
                [11, 8],
                [16, 16],
                [0, 10],
                [-16, 16],
                [-11, 8],
                [-19, -5],
                [-8, -9],
              ]
            : [
                [0, -21],
                [17, 14],
                [7, 10],
                [0, 16],
                [-7, 10],
                [-17, 14],
              ];
    points.forEach(([px, py], i) =>
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py),
    );
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    if (!drone && game.player.armor) {
      ctx.fillStyle = game.player.armor > 1 ? "#c2d5eb" : "#758fa8";
      ctx.fillRect(-15, 4, 6, 9);
      ctx.fillRect(9, 4, 6, 9);
      if (game.player.armor > 1) {
        ctx.fillRect(-12, -2, 5, 5);
        ctx.fillRect(7, -2, 5, 5);
      }
    }
    if (drone && game.player.droneStyle) {
      ctx.strokeStyle = "#f3c2ff";
      ctx.lineWidth = 3;
      ctx.strokeRect(-13, -8, 26, 22);
    }
    ctx.fillStyle = "#d8fff8";
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(5, 5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#264c65";
    ctx.fillRect(-2, -4, 4, 12);
    if (game.state === "playing" || drone) {
      ctx.fillStyle = "#63cffb";
      ctx.beginPath();
      ctx.moveTo(-4, 15);
      ctx.lineTo(0, reduced ? 25 : 23 + Math.sin(game.time * 32) * 5);
      ctx.lineTo(4, 15);
      ctx.fill();
    }
    ctx.restore();
  }
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    const bg = ctx.createLinearGradient(0, 0, c.width, c.height);
    bg.addColorStop(0, "#080e20");
    bg.addColorStop(0.5, "#101c30");
    bg.addColorStop(1, "#080e1b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
    const glow = ctx.createRadialGradient(370, 230, 20, 370, 230, 300);
    glow.addColorStop(0, game.stage ? `${game.stage.color}15` : "#1c465c30");
    glow.addColorStop(1, "#101a2800");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.save();
    const shake = fx.offset(
      reduced || ["paused", "upgrade", "result"].includes(game.state),
    );
    ctx.translate(shake.x, shake.y);
    ctx.strokeStyle = "#75a3c406";
    ctx.lineWidth = 1;
    for (let x = 0; x < c.width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, c.height);
      ctx.stroke();
    }
    for (let y = 0; y < c.height; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(c.width, y);
      ctx.stroke();
    }
    for (const star of stars) {
      ctx.fillStyle = star.r > 1 ? "#d0e6ee99" : "#aec5d744";
      ctx.beginPath();
      ctx.arc(
        star.x,
        (star.y + (reduced ? 0 : game.time * star.speed)) % c.height,
        star.r,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    if (game.stage) {
      ctx.fillStyle = "#ffffff18";
      ctx.fillRect(0, 0, c.width, 3);
      ctx.fillStyle = game.stage.color;
      ctx.fillRect(
        0,
        0,
        c.width * Math.min(1, game.time / game.stage.duration),
        3,
      );
    }
    for (const r of game.rocks) {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.rotation);
      ctx.beginPath();
      r.shape.forEach((length, i) => {
        const a = (i / r.shape.length) * Math.PI * 2,
          x = Math.cos(a) * r.radius * length,
          y = Math.sin(a) * r.radius * length;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      const rockGrad = ctx.createLinearGradient(
        -r.radius,
        -r.radius,
        r.radius,
        r.radius,
      );
      const palette =
        r.type === "elite"
          ? ["#c98d55", "#443056"]
          : r.type === "charger"
            ? ["#bd6685", "#472c49"]
            : r.type === "gunner"
              ? ["#8b6dbc", "#263f5d"]
              : r.type === "weaver"
                ? ["#4b9199", "#263b53"]
                : ["#62606b", "#292e41"];
      rockGrad.addColorStop(0, palette[0]);
      rockGrad.addColorStop(1, palette[1]);
      ctx.fillStyle =
        !reduced && r.flashUntil > game.time ? "#fff8df" : rockGrad;
      ctx.fill();
      ctx.strokeStyle =
        r.type === "elite"
          ? "#ffd47d"
          : r.phase === "warning"
            ? "#ffcf91"
            : "#a8a0a575";
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.fillStyle = "#19243566";
      ctx.beginPath();
      ctx.arc(
        -r.radius * 0.2,
        -r.radius * 0.15,
        r.radius * 0.22,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.beginPath();
      ctx.arc(r.radius * 0.35, r.radius * 0.3, r.radius * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (r.type === "elite") {
        ctx.strokeStyle = "#ffd47d";
        ctx.lineWidth = 2;
        ctx.strokeRect(
          r.x - r.radius - 4,
          r.y - r.radius - 4,
          (r.radius + 4) * 2,
          (r.radius + 4) * 2,
        );
      }
      if (r.phase === "warning") {
        ctx.save();
        ctx.strokeStyle = "#ff9fac";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.targetX, c.height);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = "#ffd47d";
        ctx.font = "bold 16px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("!", r.x, r.y - r.radius - 8);
      }
      if (r.type === "gunner") {
        ctx.fillStyle = "#ffa0bd";
        ctx.fillRect(r.x - 4, r.y + r.radius * 0.5, 8, 12);
      }
      if (r.hp < r.maxHp) {
        ctx.fillStyle = "#293a4e";
        ctx.fillRect(
          r.x - r.radius * 0.6,
          r.y - r.radius - 7,
          r.radius * 1.2,
          2,
        );
        ctx.fillStyle = "#ffca75";
        ctx.fillRect(
          r.x - r.radius * 0.6,
          r.y - r.radius - 7,
          (r.radius * 1.2 * r.hp) / r.maxHp,
          2,
        );
      }
    }
    for (const b of game.enemyBullets) {
      ctx.fillStyle = "#ff9fac";
      ctx.strokeStyle = "#ffe7ef";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    for (const b of game.bullets) {
      const bulletColor = b.sub
        ? "#c4a0ff"
        : { piercing: "#ffd47d", explosive: "#ff7c99", homing: "#7abfff" }[
            b.weapon
          ] || "#9cfff0";
      if (game.player.trails && !reduced) {
        ctx.strokeStyle = `${bulletColor}55`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 0.04, b.y - b.vy * 0.04);
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.atan2(b.vx, -b.vy));
      ctx.fillStyle = bulletColor;
      ctx.shadowColor = bulletColor;
      ctx.shadowBlur = reduced ? 0 : 8;
      ctx.beginPath();
      ctx.roundRect(-2, -7, 4, 13, 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
    for (const item of game.items) {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.fillStyle = "#111f32";
      ctx.strokeStyle = item.type === "core" ? "#e4b7ff" : colors[item.type];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-21, -21, 42, 42, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = item.type === "core" ? "#e4b7ff" : colors[item.type];
      ctx.textAlign = "center";
      ctx.font = "bold 23px system-ui";
      ctx.fillText(item.type === "core" ? "✦" : icons[item.type], 0, 4);
      ctx.font = "bold 7px system-ui";
      ctx.fillText(item.type === "core" ? "CORE" : names[item.type], 0, 15);
      ctx.restore();
    }
    fx.draw(ctx, reduced);
    if (game.state !== "result") {
      const p = game.player;
      ctx.save();
      if (p.invincible > 0) {
        if (!reduced)
          ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(game.time * 19));
        ctx.strokeStyle = "#71f3e0";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 27, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (game.shield) {
        ctx.strokeStyle = "#91d7ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 24, 0, Math.PI * 2);
        ctx.stroke();
      }
      ship(p.x, p.y);
      ctx.restore();
      // Match the actual collision radius. Draw after the blink so it stays visible.
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius - 0.75, 0, Math.PI * 2);
      ctx.fillStyle = "#071320e6";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = p.invincible > 0 ? "#ffd77a" : "#ffffff";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
      ctx.restore();
      if (game.levels.sub) {
        ship(p.x + 28, p.y, 0.43, true);
        if (game.levels.sub >= 2) ship(p.x - 28, p.y, 0.43, true);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#8eaac13b";
    ctx.font = "8px ui-monospace,monospace";
    ctx.textAlign = "left";
    ctx.fillText(
      game.stage ? stageLabel(game.stage.id) : "ENDLESS / DEEP SPACE",
      17,
      c.height - 16,
    );
    ctx.textAlign = "right";
    ctx.fillText("480 : 720", c.width - 17, c.height - 16);
    if (game.combo >= 2) {
      ctx.textAlign = "left";
      ctx.font = "bold 15px ui-monospace,monospace";
      ctx.fillStyle = "#ffd47d";
      ctx.fillText(`${game.combo} COMBO`, 17, 29);
    }
    ctx.restore();
  }
  function frame(now) {
    const elapsed = Math.max(0, (now - last) / 1000);
    last = now;
    const before = game.time;
    game.advance(elapsed);
    const dt = game.time - before;
    fx.advance(dt, reduced);
    const intense =
      game.stage?.id >= 7 ||
      (game.eventState && game.time < game.eventState.until);
    synth.sync(
      document.hidden || !hasFocus || !nativeActive ? "background" : game.state,
      !!intense,
    );
    effects();
    updateUI();
    draw();
    requestAnimationFrame(frame);
  }
  const movement = new Set([
    "arrowleft",
    "arrowright",
    "arrowup",
    "arrowdown",
    "w",
    "a",
    "s",
    "d",
  ]);
  function syncInput() {
    game.input.x =
      (keys.has("arrowright") || keys.has("d") ? 1 : 0) -
      (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
    game.input.y =
      (keys.has("arrowdown") || keys.has("s") ? 1 : 0) -
      (keys.has("arrowup") || keys.has("w") ? 1 : 0);
  }
  window.addEventListener("keydown", (event) => {
    if ($("hub").open || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))
      return;
    const key = event.key.toLowerCase();
    if (game.state === "upgrade") {
      if (event.repeat) return;
      if (["1", "2", "3"].includes(key)) {
        event.preventDefault();
        chooseFlight(Number(key) - 1);
        return;
      }
      if (["arrowleft", "arrowup", "arrowright", "arrowdown"].includes(key)) {
        event.preventDefault();
        choiceCursor =
          (choiceCursor +
            (["arrowleft", "arrowup"].includes(key) ? -1 : 1) +
            game.choices.length) %
          game.choices.length;
        $("panel")
          .querySelectorAll("[data-choice]")
          [choiceCursor]?.focus({ preventScroll: true });
        return;
      }
      if (key === "enter" || key === " ") {
        event.preventDefault();
        chooseFlight(choiceCursor);
        return;
      }
      if (key === "p" || key === "escape") {
        event.preventDefault();
        pause();
        updateUI();
      }
      return;
    }

    if (
      movement.has(key) &&
      ["playing", "countdown", "paused"].includes(game.state)
    ) {
      event.preventDefault();
      if (game.state === "playing") {
        keys.add(key);
        syncInput();
      }
    }
    if ((key === "p" || key === "escape") && !event.repeat) {
      if (["playing", "countdown", "upgrade"].includes(game.state)) pause();
      else if (game.state === "paused") resume();
      updateUI();
    }
  });
  window.addEventListener("keyup", (event) => {
    keys.delete(event.key.toLowerCase());
    syncInput();
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (game.state !== "playing" || pointer !== null) return;
    event.preventDefault();
    unlockAudio();
    canvas.setPointerCapture(event.pointerId);
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!pointer || pointer.id !== event.pointerId || game.state !== "playing")
      return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    game.moveBy(
      ((event.clientX - pointer.x) * c.width) / rect.width,
      ((event.clientY - pointer.y) * c.height) / rect.height,
    );
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });
  for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"])
    canvas.addEventListener(eventName, (event) => {
      if (pointer?.id === event.pointerId) pointer = null;
    });
  $("pause").addEventListener("click", () => {
    if (game.state === "paused") resume();
    else pause();
    updateUI();
  });
  $("sound").addEventListener("click", () => {
    records.sound(!records.data.sound);
    synth.setVolume(records.data.volume);
    synth.setEnabled(records.data.sound);
    if (records.data.sound) unlockAudio();
    else silence();
    refreshRecords();
  });
  window.addEventListener("focus", () => {
    hasFocus = true;
  });
  window.addEventListener("blur", () => {
    hasFocus = false;
    pause();
    synth.sync("background");
    updateUI();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pause();
      updateUI();
    }
  });
  const escapeHTML = (text) =>
    String(text).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function shipSVG(shipId, color, visuals = progress.data.upgrades) {
    const path =
      {
        lance: "M80 2 112 92 128 157 80 133 32 157 48 92Z",
        nova: "M80 8 111 65 145 78 145 143 105 132 80 157 55 132 15 143 15 78 49 65Z",
        seeker:
          "M80 8 102 48 145 62 121 107 139 158 80 130 21 158 39 107 15 62 58 48Z",
      }[shipId] || "M80 8 145 143 105 130 80 157 55 130 15 143Z";
    return `<svg viewBox="0 0 160 180" aria-hidden="true" style="color:${color}"><path d="${path}" fill="currentColor"/><path d="M80 35 97 113 63 113Z" fill="#e9fffa"/><path d="M73 87h14v45H73z" fill="#153747"/><path d="m67 151 13 27 13-27" fill="#66bfff"/>${visuals.hull ? `<path d="M40 104h17v31H40zm63 0h17v31h-17z" fill="${visuals.hull > 1 ? "#d4deed" : "#829cb5"}"/>` : ""}${visuals.speed ? '<path d="M59 161v15m42-15v15" stroke="#71f3e0" stroke-width="4"/>' : ""}${visuals.sub ? '<path d="m17 83 10 12-10 12L7 95zm126 0 10 12-10 12-10-12z" fill="#c4a0ff"/>' : ""}</svg>`;
  }
  const duration = (ms) =>
    `${Math.floor(ms / 60000)}分${Math.floor((ms % 60000) / 1000)}秒`;
  function renderHome() {
    const ship = StarProgress.SHIPS.find(
        (s) => s.id === progress.data.selectedShip,
      ),
      load = progress.loadout(),
      license = StarProgress.licenseFor(progress.data.totalMs);
    const mission = StarProgress.MISSIONS.find(
      (m) => !progress.data.claimed.includes(m.id),
    );
    $("home").innerHTML =
      `<div class="home-bar"><span class="eyebrow"><span class="live-dot"></span> PILOT HEADQUARTERS</span><span class="pilot-status">${account.user ? "アカウント接続中" : "ゲストパイロット"} <b>${progress.data.credits.toLocaleString()} <small>コイン</small></b></span></div>
    <div class="home-grid"><div class="home-hero"><span class="eyebrow">YOUR NEXT FLIGHT STARTS HERE</span><h1>STAR<br><span>DODGE</span><b>✦</b></h1><p class="intro">ひとつのフライトが、次の力になる。<br>育てた相棒で、${progress.data.flightMode === "endless" ? "まだ見ぬ記録へ。" : `8つの惑星、全${STAGES.length}ステージを突破しよう。`}</p><div class="hangar-art" style="--ship-color:${load.color}" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>${shipSVG(ship.id, load.color)}<span>${ship.tag} / ${escapeHTML(ship.name)}</span></div><div class="home-best"><span>PERSONAL BEST</span><strong>${formatTime(records.data.best)}<small> SEC</small></strong></div><button class="primary launch" data-action="start">フライト開始 ↗</button><p class="home-controls">WASD・矢印キー / スマホはドラッグ · 射撃は自動</p></div>
    <div class="home-dashboard"><button class="stage-summary" data-hub="stages"><span class="eyebrow">${progress.data.flightMode === "endless" ? "ENDLESS FLIGHT" : `STAGE ${String(progress.data.selectedStage).padStart(2, "0")} / ${STAGES.length}`}</span><strong>${progress.data.flightMode === "endless" ? "限界の、その先へ" : stageLabel(progress.data.selectedStage)}</strong><span>${progress.data.flightMode === "endless" ? "制限時間なし" : `出現30秒＋殲滅 · ${progress.data.clearedStages.length} / ${STAGES.length} クリア`} <b>ステージを選ぶ ↗</b></span></button><div class="pilot-card"><div><span class="eyebrow">CURRENT LOADOUT</span><h2>${escapeHTML(ship.name)}</h2><p>HP ${load.hp} · SPEED Lv.${load.levels.speed} · ${c.main.angles[load.levels.multi - 1].length}発 · SUB Lv.${load.levels.sub}</p></div><span class="pilot-emblem" style="color:${load.color}">⟐</span></div><button class="license-summary" data-hub="license"><span>LICENSE <b>RANK ${license.rank}</b> · ${license.name}</span><span>詳細 ↗</span><progress aria-label="次のランクへの進捗" value="${license.progress}" max="1"></progress></button><nav class="home-nav" aria-label="パイロットメニュー"><button data-hub="hangar"><i>⟐</i><span>機体ハンガー<small>4種類の弾と機体を確認・選択</small></span><b>↗</b></button><button data-hub="upgrades"><i>↑</i><span>初期スキル強化<small>フライトのスタートを強くする</small></span><b>↗</b></button><button data-hub="skills"><i>✦</i><span>スキル図鑑<small>フライトと初期強化を確認</small></span><b>↗</b></button><button data-hub="missions"><i>◎</i><span>チャレンジ<small>目標を達成して報酬を受け取る</small></span><b>↗</b></button><button data-hub="account"><i>☁</i><span>アカウント・保存<small>${account.user ? "クラウドに育成をバックアップ" : "ゲストのままでもプレイできます"}</small></span><b>↗</b></button><button data-hub="shop"><i>✦</i><span>ショップ<small>コインで機体をカラーリング</small></span><b>↗</b></button><button data-hub="license"><i>◇</i><span>ライセンス<small>累計フライトでランクアップ</small></span><b>↗</b></button><button data-hub="stats"><i>▥</i><span>フライト記録<small>最近20回の結果と成長を確認</small></span><b>↗</b></button><button data-hub="settings"><i>⚙</i><span>遊び方・設定<small>操作と演出をカスタマイズ</small></span><b>↗</b></button></nav>${mission ? `<div class="next-goal"><span class="eyebrow">NEXT CHALLENGE</span><h3>${mission.name}</h3><p>${mission.description} <b>+${mission.reward} コイン</b></p><progress value="${Math.min(progress.data[mission.field], mission.goal)}" max="${mission.goal}"></progress></div>` : '<div class="next-goal"><span class="eyebrow">ALL CHALLENGES COMPLETE</span><h3>次は、自己ベストのその先へ。</h3></div>'}<p class="earned-note">5秒ごとに1コイン＋30秒ごとの到達ボーナス。隕石の破壊で追加報酬（生存・到達報酬の20%まで）。育成は次の挑戦に引き継がれます。</p></div></div>`;
    refreshRecords();
  }
  let hubPage = "",
    hubBusy = false,
    hubPlanet = 0,
    pendingBackup = null;
  function showHub(page) {
    hubPage = page;
    if (page === "stages") hubPlanet = 0;
    pendingBackup = null;
    renderHub();
    if (!$("hub").open) $("hub").showModal();
  }
  function renderHub() {
    const titles = {
      stages: "ステージ選択",
      hangar: "機体ハンガー",
      upgrades: "初期スキル強化",
      skills: "スキル図鑑",
      missions: "チャレンジ",
      account: "アカウント・保存",
      shop: "スキンショップ",
      license: "パイロットライセンス",
      stats: "フライト記録",
      settings: "遊び方・設定",
      share: "記録を共有",
      report: "プレイ記録のJSON",
    };
    $("hub-title").textContent = titles[hubPage];
    $("hub-message").textContent = "";
    const balance = `<div class="hub-balance">所持コイン <b>${progress.data.credits.toLocaleString()} コイン</b></div>`;
    if (hubPage === "stages") {
      const unlocked = Math.min(
          STAGES.length,
          progress.data.clearedStages.length + 1,
        ),
        planet = getPlanet(hubPlanet);
      $("hub-title").textContent = planet
        ? `${planet.name} · ステージ選択`
        : "惑星を選ぶ";
      const campaign = planet
        ? `<button class="secondary planet-back" data-planet="0">← 惑星リストへ</button><h3 class="planet-heading" style="--stage-color:${planet.color}">${planet.name}<small>通し番号 ${planet.firstStage}–${planet.lastStage} / ${STAGES.length}</small></h3><div class="stage-grid">` +
          STAGES.filter((stage) => stage.planetId === planet.id)
            .map((stage) => {
              const cleared = progress.data.clearedStages.includes(stage.id),
                locked = stage.id > unlocked,
                selected =
                  progress.data.flightMode === "stages" &&
                  progress.data.selectedStage === stage.id;
              return `<article class="stage-card ${selected ? "selected" : ""}" style="--stage-color:${stage.color}"><span>STAGE ${String(stage.id).padStart(2, "0")} ${cleared ? "✓ CLEAR" : locked ? "LOCKED" : ""}</span><h3>${stage.name}</h3><p>出現30秒＋殲滅<br>初回クリア +${stage.firstClearCoins} コイン</p><button class="secondary" data-stage="${stage.id}" ${locked || selected ? "disabled" : ""}>${selected ? "選択中" : locked ? `${stageLabel(stage.id - 1)}クリアで解放` : "このステージを選ぶ"}</button></article>`;
            })
            .join("") +
          "</div>"
        : '<div class="planet-grid" aria-label="惑星リスト">' +
          PLANETS.map((p) => {
            const cleared = progress.data.clearedStages.filter(
                (id) => id >= p.firstStage && id <= p.lastStage,
              ).length,
              locked = p.firstStage > unlocked,
              current =
                progress.data.flightMode === "stages" &&
                getStage(progress.data.selectedStage).planetId === p.id;
            return `<button class="planet-card ${current ? "selected" : ""}" data-planet="${p.id}" style="--stage-color:${p.color}"><span class="planet-orb planet-orb-${p.id}" aria-hidden="true"></span><span class="planet-number">CHAPTER ${String(p.id).padStart(2, "0")} ${cleared === 5 ? "✓ CLEAR" : locked ? "LOCKED" : current ? "CURRENT" : ""}</span><strong>${p.name}</strong><span>${cleared} / 5 クリア · ${locked ? "未解放・閲覧のみ" : "ステージを選ぶ ↗"}</span></button>`;
          }).join("") +
          "</div>";
      $("hub-content").innerHTML =
        '<p class="hub-intro">8つの惑星を巡る全40ステージ。各ステージは出現30秒後、残った隕石をすべて破壊してクリア。順番に解放されます。機体・初期強化は引き継ぎ、HPとフライト中の強化は毎回リセットします。</p>' +
        campaign +
        '<article class="mission-card"><h3>エンドレス</h3><p>制限時間なしで生存記録に挑戦できます。</p><button class="secondary" data-mode="endless" ' +
        (progress.data.flightMode === "endless" ? "disabled" : "") +
        ">" +
        (progress.data.flightMode === "endless"
          ? "選択中"
          : "エンドレスを選ぶ") +
        '</button></article><p class="hub-intro">初回クリア報酬は各ステージ1回限り。フライト終了時に一度だけ精算します。</p>';
    }
    if (hubPage === "hangar")
      $("hub-content").innerHTML =
        '<p class="hub-intro">弾の種類で相棒を選ぼう。全機体の基本HPは3、移動速度は300。装甲などの初期強化は共通です。機体はステージクリアで解放され、コインは使いません。</p>' +
        StarProgress.SHIPS.map((ship) => {
          const owned = progress.isShipUnlocked(ship.id),
            selected = progress.data.selectedShip === ship.id;
          const condition = ship.unlockStage
            ? `${stageLabel(ship.unlockStage)}（通し番号${ship.unlockStage}）クリアで解放`
            : "最初から使用可能";
          return `<article class="upgrade-card ship-card" data-hangar-ship="${ship.id}"><span class="ship-mini hangar-preview">${shipSVG(ship.id, ship.color)}</span><div><span class="eyebrow">${ship.tag}</span><h3>${ship.name}</h3><p>${ship.description}</p><small>基本HP ${ship.hp} / 移動速度 ${ship.speed}</small><p class="ship-condition">${owned && ship.unlockStage ? "解放済み · " : ""}${condition}</p></div><button class="secondary" data-ship="${ship.id}" ${selected || !owned ? "disabled" : ""}>${selected ? "選択中" : owned ? "この機体を選ぶ" : condition}</button></article>`;
        }).join("");
    if (hubPage === "upgrades")
      $("hub-content").innerHTML =
        balance +
        '<p class="hub-intro">強化は次のフライトからずっと有効です。飛行中に強化コアを拾うと、その回だけの強化を最大3択で選べます。</p>' +
        StarProgress.UPGRADES.map((up) => {
          const level = progress.data.upgrades[up.id],
            cost = up.costs[level];
          return `<article class="upgrade-card"><span class="ship-mini">${up.icon}</span><div><h3>${up.name} <small>Lv.${level} / ${up.costs.length}</small></h3><p>${up.description}</p></div><button class="secondary" data-upgrade="${up.id}" ${cost === undefined || progress.data.credits < cost ? "disabled" : ""}>${cost === undefined ? "最大まで強化済み" : `${cost} コインで強化`}</button></article>`;
        }).join("");
    if (hubPage === "skills") {
      $("hub-content").innerHTML =
        '<p class="hub-intro">フライト中の強化はその回だけ有効です。強化コアの3択と同じスキルを、ジャンルごとに確認できます。</p>' +
        FLIGHT_CATEGORIES.map(
          (category) =>
            `<section class="skill-category" data-category="${category.id}" aria-labelledby="skills-${category.id}"><h3 id="skills-${category.id}">${category.name}</h3><div class="skill-grid">${FLIGHT_UPGRADES.filter(
              (up) => up.category === category.id,
            )
              .map(
                (up) =>
                  `<article class="skill-card" data-skill="${up.id}" style="--skill-color:${up.color}"><span class="skill-icon" aria-hidden="true">${up.icon}</span><div><h4>${up.name}</h4><span class="skill-level">最大 Lv.${up.max}</span><p>${up.description}</p></div></article>`,
              )
              .join("")}</div></section>`,
        ).join("") +
        '<section class="skill-category" aria-labelledby="initial-skills-title"><h3 id="initial-skills-title">初期スキル強化</h3><p class="hub-intro">所持レベルは次のフライトに引き継がれます。購入はホームの「初期スキル強化」から行えます。</p><div class="skill-grid">' +
        StarProgress.UPGRADES.map(
          (up) =>
            `<article class="skill-card initial-skill" data-initial-skill="${up.id}"><span class="skill-icon" aria-hidden="true">${up.icon}</span><div><h4>${up.name}</h4><span class="skill-level">所持 Lv.${progress.data.upgrades[up.id]} / ${up.costs.length}</span><p>${up.description}</p></div></article>`,
        ).join("") +
        "</div></section>";
    }
    if (hubPage === "missions")
      $("hub-content").innerHTML =
        balance +
        StarProgress.MISSIONS.map((m) => {
          const claimed = progress.data.claimed.includes(m.id),
            done = progress.data[m.field] >= m.goal;
          const current = Math.min(progress.data[m.field], m.goal);
          return `<article class="mission-card"><h3>${m.name}<span>+${m.reward} コイン</span></h3><p>${m.description}</p><progress value="${current}" max="${m.goal}"></progress><small>${m.field === "bestMs" ? formatTime(current) + " / " + formatTime(m.goal) + "秒" : current + " / " + m.goal}</small><button class="secondary" data-claim="${m.id}" ${claimed || !done ? "disabled" : ""}>${claimed ? "受取済み" : done ? "報酬を受け取る" : "挑戦中"}</button></article>`;
        }).join("");
    if (hubPage === "shop") {
      $("hub-content").innerHTML =
        balance +
        '<p class="hub-intro">フライトで集めたコインで、相棒を自分の色に。すべての機体に使えます。色を変えても性能や当たり判定は同じです。</p><div class="skin-grid">' +
        StarProgress.SKINS.map((skin) => {
          const owned = progress.isSkinUnlocked(skin.id),
            selected = progress.data.selectedSkin === skin.id;
          const label = selected
            ? "選択中"
            : owned
              ? "このスキンを使う"
              : skin.unlockRank
                ? `ランク${skin.unlockRank}で解放`
                : `${skin.cost} コインで解放`;
          const disabled =
            selected ||
            (!owned && (skin.unlockRank || progress.data.credits < skin.cost));
          return `<article class="skin-card ${selected ? "selected" : ""}"><div class="skin-preview">${shipSVG(progress.data.selectedShip, skin.color || StarProgress.SHIPS.find((s) => s.id === progress.data.selectedShip).color)}</div><h3>${skin.name}</h3><p>${skin.description}</p><button class="secondary" data-skin="${skin.id}" ${disabled ? "disabled" : ""}>${label}</button></article>`;
        }).join("") +
        '</div><p class="hub-intro">プレミアム商品・動画広告は準備中です。現在は実際の支払いや広告配信はありません。</p><button class="secondary" disabled>プレミアム商品 · 準備中</button>';
    }
    if (hubPage === "license") {
      const l = StarProgress.licenseFor(progress.data.totalMs);
      $("hub-content").innerHTML =
        `<div class="license-card"><span class="eyebrow">PILOT LICENSE</span><strong>RANK ${l.rank}</strong><h3>${l.name}</h3><progress aria-label="次のランクへの進捗" value="${l.progress}" max="1"></progress><p>累計フライト ${duration(progress.data.totalMs)}</p><p>${l.nextMs === null ? "最高ランクに到達しました。次は自己ベストへ！" : `次のランクまで ${duration(l.nextMs - progress.data.totalMs)}`}</p></div><article class="mission-card"><h3>ランク3でオーロラを解放</h3><p>累計4分のフライトで、特別な機体カラーが使えます。</p><button class="secondary" data-hub="shop">スキンを見る ↗</button></article><p class="hub-intro">ランクは終了したフライトの生存時間で成長します。ホームや一時停止中の時間は含みません。ランクは最大20。ランクによる機体性能の変化はありません。</p>`;
    }
    if (hubPage === "stats") {
      const d = progress.data;
      $("hub-content").innerHTML =
        `<div class="career-stats"><div><small>フライト数</small><strong>${d.flights.toLocaleString()} 回</strong></div><div><small>累計生存時間</small><strong>${duration(d.totalMs)}</strong></div><div><small>平均生存時間</small><strong>${formatTime(d.flights ? d.totalMs / d.flights : 0)} 秒</strong></div><div><small>破壊した隕石</small><strong>${d.totalDestroyed.toLocaleString()} 個</strong></div></div><h3 class="history-title">最近のフライト <small>最大20回</small></h3>` +
        (d.recentRuns.length
          ? d.recentRuns
              .map((r) => {
                const ship = StarProgress.shipDetails(r.ship),
                  skin = StarProgress.SKINS.find((s) => s.id === r.skin);
                return `<article class="history-card"><span>${r.endedAt ? new Date(r.endedAt).toLocaleString("ja-JP") : "日時未記録"}</span><h3>${formatTime(r.ms)} <small>秒</small><b>+${r.coins} コイン</b></h3><p>${r.stage ? `${stageLabel(r.stage)} · ${r.cleared ? "CLEAR" : "未クリア"}` : "ENDLESS"} / ${ship.name} · ${skin.name} / 隕石 ${r.destroyed}個</p><p>開始 → 終了　SPEED ${r.initialLevels.speed} → ${r.endLevels.speed} · MULTI ${r.initialLevels.multi} → ${r.endLevels.multi} · SUB ${r.initialLevels.sub} → ${r.endLevels.sub}</p></article>`;
              })
              .join("")
          : '<p class="hub-intro">フライトが終わると、ここに記録されます。以前のバージョンの個別記録はありません。</p>') +
        `<button class="secondary" data-action="export-report">${window.Capacitor?.isNativePlatform?.() ? "記録をJSONで表示" : "記録をJSONでダウンロード"}</button><p class="hub-intro">記録は端末内に保存され、運営へ自動送信されません。ダウンロードにメール・ログイン情報・所持コインは含めません。</p>`;
    }
    if (hubPage === "settings") {
      $("hub-content").innerHTML =
        `<section class="volume-setting" aria-labelledby="volume-title"><h3 id="volume-title">サウンド音量</h3><div class="volume-label"><label for="audio-volume">マスター音量</label><output id="volume-value" for="audio-volume">${Math.round(records.data.volume * 100)}%</output></div><input id="audio-volume" type="range" min="0" max="100" step="1" value="${Math.round(records.data.volume * 100)}" aria-valuetext="${Math.round(records.data.volume * 100)}%" aria-describedby="volume-help"><p id="volume-help">BGMと効果音をまとめて調整します。SOUND OFFでも音量は記憶されます。SOUND ON時は操作を終えると確認音が鳴ります。</p></section><div class="play-guide"><h3>よける。育てる。もう一度。</h3><p>PCはWASD / 矢印キー、スマホは画面上のドラッグで移動。射撃は自動です。右上のボタン、または P / Esc で一時停止できます。</p><p>機体の中央に表示される白い円が当たり判定です。翼には当たりません。被弾後の無敵中は円が黄色になります。アイテムを拾う範囲は以前と同じです。</p><p>ステージモードは30秒経過後に残った隕石をすべて破壊してクリアし、地球から海王星まで8惑星・全40ステージを順に解放。殲滅中は新たな敵・敵弾・コアが出現せず、隕石は下へ抜けても上から再出現します。衝突やシールド防御でも隕石は残るため、射撃で破壊してください。すでに飛んでいる敵弾は残りますが、殲滅の対象外です。エンドレスは制限時間なしです。隕石に当たるとHPが減り、HPが0になると終了。ステージが進むほど隕石は増え、速く、硬くなります。エンドレスでは時間とともに難しくなります。強化コアは12秒ごとに出現し、機体に追従します（ステージは最初の30秒のみ）。取得すると時間が止まり、最大3つの候補から強化を選べます。連射・威力・シールド・修理などを組み合わせましょう。選択はタップ、1–3、矢印＋Enterに対応します。</p><p>5秒ごとに1コイン、30秒ごとに到達ボーナス。隕石の破壊は追加ボーナスになります。報酬はフライト終了時に一度だけ受け取ります。途中でホームや最初からを選ぶと、その回の報酬はありません。</p><p>コインは初期スキル強化とスキンに使えます。機体はステージクリアで解放されます。選んだ内容は次のフライトから有効です。</p></div><label class="setting-toggle"><input id="reduce-effects" type="checkbox" ${progress.data.reduceEffects ? "checked" : ""}><span>演出を控えめにする<small>粒子・点滅・背景の動きを抑えます。端末の「視差効果を減らす」設定も優先します。</small></span></label><p class="hub-intro">サウンドは画面上部の SOUND ボタンで切り替えられます。はじめはオンです。ブラウザの仕様により、最初のタップやボタン操作から音が始まります。ひと休みを取りながら、自分のペースでお楽しみください。</p>`;
    }
    if (hubPage === "report") {
      $("hub-content").innerHTML =
        `<p class="hub-intro">文章を長押し・選択してコピーできます。PCブラウザ版ではファイルとしてダウンロードできます。</p><label class="share-label" for="report-text">プレイ記録</label><textarea id="report-text" class="share-textarea" rows="12" readonly>${escapeHTML(JSON.stringify(progress.report(), null, 2))}</textarea>`;
    }
    if (hubPage === "share") {
      $("hub-content").innerHTML =
        `<p class="hub-intro">下の文章をコピーして共有できます。</p><label class="share-label" for="share-text">共有する記録</label><textarea class="share-textarea" id="share-text" rows="5" readonly>${escapeHTML(shareText())}</textarea><button class="secondary" data-action="copy-result">記録をコピー</button>`;
    }
    if (hubPage === "account") {
      if (!account.enabled)
        $("hub-content").innerHTML =
          '<div class="coming-soon"><span>☁</span><h3>いまは、ゲストで自由に。</h3><p>アカウント接続は準備中です。育成と記録はこのブラウザに保存されます。ブラウザのデータを消すと失われます。</p><button class="secondary" disabled>メールでログイン · 準備中</button></div>';
      else if (!account.user)
        $("hub-content").innerHTML =
          '<p class="hub-intro">メールに届く確認コードでログイン。パスワードは不要です。ログイン後に、育成と記録をクラウドへバックアップできます。</p><form id="login-form"><label>メールアドレス<input type="email" name="email" autocomplete="email" required maxlength="254" placeholder="you@example.com"></label><button class="secondary" type="submit" name="step" value="send">確認コードを送る</button><label>確認コード<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10" placeholder="メールに届いたコード"></label><button class="primary" type="submit" name="step" value="verify">ログイン</button></form><p class="hub-intro">ログインはこのタブで維持されます。メール送信の扱いは公開時のプライバシーポリシーに記載します。</p>';
      else
        $("hub-content").innerHTML =
          `<p class="hub-intro">${escapeHTML(account.user.email || "パイロット")} として接続中</p><p class="hub-intro">自動で上書きせず、好きなタイミングで育成と記録を保存・復元できます。</p><button class="primary" data-account="save">クラウドにバックアップ</button><button class="secondary" data-account="load">バックアップを確認する</button><button class="secondary" data-account="logout">ログアウト</button><details class="account-danger"><summary>アカウントの削除</summary><p>アカウントとクラウドのバックアップを削除します。この操作は取り消せません。この端末の育成はゲストとして残ります。</p><button class="secondary" data-account="confirm-delete">削除の確認へ</button></details>`;
    }
  }
  async function accountTask(action) {
    if (hubBusy) return;
    hubBusy = true;
    let message = "";
    try {
      $("hub-message").textContent = "接続中…";
      if (action === "save") {
        await account.saveBackup({
          version: 1,
          pilot: progress.snapshot(),
          records: { best: records.data.best, last: records.data.last },
        });
        message = "育成と記録をクラウドに保存しました。";
      }
      if (action === "load") {
        const backup = await account.loadBackup();
        if (!backup?.progress?.pilot || backup.progress.version !== 1)
          throw Error("利用できるバックアップがありません。");
        pendingBackup = backup.progress;
        $("hub-content").innerHTML =
          `<p class="hub-intro">バックアップを読み込むと、この端末の育成を置き換えます。</p><p>${StarProgress.sanitize(pendingBackup.pilot).credits} コイン / ${StarProgress.sanitize(pendingBackup.pilot).flights} フライト</p><button class="primary" data-account="restore">このバックアップで復元</button><button class="secondary" data-hub="account">やめる</button>`;
        message = "内容を確認してから復元してください。";
      }
      if (action === "restore") {
        if (!pendingBackup) throw Error("バックアップを選んでください。");
        progress.restore(pendingBackup.pilot);
        applyMotion();
        const best = pendingBackup.records?.best;
        const last = pendingBackup.records?.last;
        if (Number.isFinite(best) && best >= 0)
          records.data.best = Math.max(records.data.best, best);
        if (Number.isFinite(last) && last >= 0) records.data.last = last;
        records.save();
        renderHome();
        renderHub();
        message = "育成と記録を復元しました。";
      }
      if (action === "logout") {
        await account.logout();
        renderHome();
        renderHub();
        message = "ログアウトしました。";
      }
      if (action === "confirm-delete") {
        $("hub-content").innerHTML =
          '<p class="hub-intro">アカウントとクラウドデータを完全に削除しますか？</p><button class="secondary" data-account="delete">アカウントを完全に削除する</button><button class="primary" data-hub="account">やめる</button>';
      }
      if (action === "delete") {
        await account.deleteAccount();
        renderHome();
        renderHub();
        message = "アカウントとクラウドデータを削除しました。";
      }
    } catch (error) {
      message =
        error instanceof TypeError
          ? "ネットワークに接続できませんでした。端末の育成はそのままです。"
          : error.message;
    } finally {
      hubBusy = false;
      $("hub-message").textContent = message;
    }
  }
  function shareText() {
    const ship =
      StarProgress.SHIPS.find((s) => s.id === runLoadout?.ship) ||
      StarProgress.SHIPS[0];
    return `STAR DODGE ${game.stage ? `${stageLabel(game.stage.id)}${game.outcome === "cleared" ? "クリア！" : ""}` : "エンドレス"}で ${formatTime(game.time * 1000)}秒生存！ 隕石${game.destroyed}個を破壊。機体：${ship.name}。
https://chani0422.github.io/My-Games/star-dodge/`;
  }
  async function shareResult(copyOnly = false) {
    const text = shareText();
    if (!copyOnly && navigator.share) {
      try {
        await navigator.share({ title: "STAR DODGE", text });
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    }
    try {
      if (!navigator.clipboard?.writeText) throw Error();
      await navigator.clipboard.writeText(text);
      const status = $("share-status");
      if (status) status.textContent = "記録をコピーしました。";
      if ($("hub").open)
        $("hub-message").textContent = "記録をコピーしました。";
    } catch {
      showHub("share");
      $("share-text").focus();
      $("share-text").select();
      if (copyOnly)
        $("hub-message").textContent =
          "自動コピーが使えません。文章を選択してコピーしてください。";
    }
  }
  function exportReport() {
    if (window.Capacitor?.isNativePlatform?.()) {
      showHub("report");
      return;
    }
    const blob = new Blob([JSON.stringify(progress.report(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = "star-dodge-play-records.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function updateVolume(input) {
    const value = Number(input.value) / 100;
    if (value !== records.data.volume) records.setVolume(value);
    synth.setVolume(records.data.volume);
    const percent = `${Math.round(records.data.volume * 100)}%`;
    $("volume-value").textContent = percent;
    input.setAttribute("aria-valuetext", percent);
  }
  document.addEventListener("input", (event) => {
    if (event.target.id === "audio-volume") updateVolume(event.target);
  });
  document.addEventListener("change", (event) => {
    if (event.target.id === "audio-volume") {
      updateVolume(event.target);
      unlockAudio();
      sound("ui");
      return;
    }
    if (event.target.id !== "reduce-effects") return;
    progress.setReducedEffects(event.target.checked);
    applyMotion();
  });
  function chooseFlight(index) {
    if (!game.chooseUpgrade(index)) return;
    clearControls();
    last = performance.now();
    unlockAudio();
    updateUI();
    canvas.focus({ preventScroll: true });
  }
  document.addEventListener(
    "pointerdown",
    () => {
      unlockAudio();
    },
    { passive: true },
  );
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    unlockAudio();
    sound("ui");
    if (button.dataset.choice !== undefined) {
      chooseFlight(Number(button.dataset.choice));
      return;
    }
    if (button.dataset.hub) {
      if (!hubBusy) showHub(button.dataset.hub);
      return;
    }
    if (button.dataset.planet !== undefined && hubPage === "stages") {
      const id = Number(button.dataset.planet);
      if (id === 0 || getPlanet(id)) {
        hubPlanet = id;
        renderHub();
        $("hub-content").scrollTop = 0;
        $("hub-content")
          .querySelector("button")
          ?.focus({ preventScroll: true });
      }
      return;
    }
    if (button.dataset.stage) {
      if (progress.selectStage(Number(button.dataset.stage))) {
        renderHome();
        renderHub();
      }
      return;
    }
    if (button.dataset.mode) {
      if (progress.selectMode(button.dataset.mode)) {
        renderHome();
        renderHub();
      }
      return;
    }
    if (button.dataset.ship) {
      if (progress.selectShip(button.dataset.ship)) {
        renderHome();
        renderHub();
      }
      return;
    }
    if (button.dataset.skin) {
      if (progress.selectSkin(button.dataset.skin)) {
        renderHome();
        renderHub();
      }
      return;
    }
    if (button.dataset.upgrade) {
      if (progress.purchaseUpgrade(button.dataset.upgrade)) {
        renderHome();
        renderHub();
      }
      return;
    }
    if (button.dataset.claim) {
      if (progress.claim(button.dataset.claim)) {
        renderHome();
        renderHub();
      }
      return;
    }
    if (button.dataset.account) {
      accountTask(button.dataset.account);
      return;
    }
    const action = button.dataset.action;
    if (action === "start") {
      if ($("hub").open) $("hub").close();
      start();
    }
    if (
      action === "next-stage" &&
      game.outcome === "cleared" &&
      game.stage?.id < STAGES.length
    ) {
      if (progress.selectStage(game.stage.id + 1)) start();
    }
    if (action === "retry") {
      if (game.stage) progress.selectStage(game.stage.id);
      else progress.selectMode("endless");
      start();
    }
    if (action === "share") shareResult();
    if (action === "copy-result") shareResult(true);
    if (action === "export-report") exportReport();
    if (action === "resume") resume();
    if (action === "title") title();
    if (action) updateUI();
  });
  $("hub-close").addEventListener("click", () => {
    if (!hubBusy) $("hub").close();
  });
  $("hub").addEventListener("cancel", (event) => {
    if (hubBusy) event.preventDefault();
  });
  $("hub").addEventListener("submit", async (event) => {
    if (event.target.id !== "login-form") return;
    event.preventDefault();
    if (hubBusy) return;
    const form = event.target,
      email = form.elements.email.value.trim(),
      code = form.elements.code.value.trim(),
      action = event.submitter?.value;
    if (action === "verify" && !code) {
      $("hub-message").textContent =
        "メールに届いた確認コードを入力してください。";
      return;
    }
    hubBusy = true;
    const button = event.submitter;
    button.disabled = true;
    $("hub-message").textContent = "接続中…";
    try {
      if (action === "send") {
        await account.sendCode(email);
        $("hub-message").textContent =
          "確認コードを送信しました。メールをご確認ください。";
        form.elements.code.focus();
      } else {
        await account.verifyCode(email, code);
        renderHome();
        renderHub();
        $("hub-message").textContent = "ログインしました。";
      }
    } catch (error) {
      $("hub-message").textContent =
        error instanceof TypeError
          ? "接続できませんでした。もう一度お試しください。"
          : error.message;
    } finally {
      hubBusy = false;
      if (button.isConnected) button.disabled = false;
    }
  });
  let reloadForUpdate = false,
    checkingUpdate = false;
  function reloadWhenSafe() {
    if (!["title", "result"].includes(game.state)) {
      reloadForUpdate = false;
      $("update-status").textContent =
        "新しい版を確認しました。フライト終了後にもう一度「最新版を確認」を押してください。";
      return;
    }
    location.reload();
  }
  if ("serviceWorker" in navigator && !window.Capacitor) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadForUpdate) reloadWhenSafe();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("sw.js", { updateViaCache: "none" })
        .catch(() => {});
    });
  }
  $("check-update").addEventListener("click", async () => {
    if (
      checkingUpdate ||
      !["title", "result"].includes(game.state) ||
      window.Capacitor
    )
      return;
    checkingUpdate = true;
    $("check-update").disabled = true;
    $("update-status").textContent = "最新版を確認中…";
    try {
      const response = await fetch("version.json", {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw Error();
      const release = await response.json();
      if (
        typeof release.version !== "string" ||
        !/^\d+\.\d+\.\d+$/.test(release.version)
      )
        throw Error();
      if (release.version === APP_VERSION)
        $("update-status").textContent = `最新版です（${APP_VERSION}）`;
      else {
        $("update-status").textContent =
          `${release.version}へ更新中… 育成とコインは引き継がれます。`;
        const registration =
          "serviceWorker" in navigator
            ? await navigator.serviceWorker.getRegistration()
            : null;
        reloadForUpdate = true;
        if (registration) await registration.update();
        if (registration?.waiting)
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        if (!registration?.installing && !registration?.waiting)
          reloadWhenSafe();
      }
    } catch {
      reloadForUpdate = false;
      $("update-status").textContent =
        `確認できませんでした。通信を確認してください（現在 ${APP_VERSION}）。`;
    } finally {
      checkingUpdate = false;
      $("check-update").disabled =
        !["title", "result"].includes(game.state) || !!window.Capacitor;
    }
  });

  if (window.Capacitor?.isNativePlatform?.()) {
    const nativeApp = window.Capacitor.registerPlugin("App");
    nativeApp
      .addListener("appStateChange", ({ isActive }) => {
        nativeActive = isActive;
        if (!isActive) {
          pause();
          updateUI();
        }
      })
      .catch(() => {});
    nativeApp
      .addListener("backButton", () => {
        if ($("hub").open) {
          if (!hubBusy) $("hub").close();
          return;
        }
        if (["playing", "countdown", "upgrade"].includes(game.state)) pause();
        else if (["paused", "result"].includes(game.state)) title();
        else nativeApp.minimizeApp().catch(() => {});
        updateUI();
      })
      .catch(() => {});
  }
  systemMotion.addEventListener("change", applyMotion);
  applyMotion();
  window.addEventListener("resize", resize);
  refreshRecords();
  renderHome();
  if (new URLSearchParams(location.search).get("screen") === "account")
    showHub("account");
  resize();
  updateUI();
  requestAnimationFrame(frame);
})();
