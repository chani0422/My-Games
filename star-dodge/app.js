/* Canvas presentation and browser controls. No external dependencies. */
(() => {
  "use strict";
  const { Game, Records, CONFIG: c, formatTime } = StarDodge,
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
  let runId = "",
    runReward = 0;
  const records = new Records(storage),
    game = new Game(),
    canvas = $("game"),
    ctx = canvas.getContext("2d"),
    reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let last = performance.now(),
    uiState = "",
    keys = new Set(),
    pointer = null,
    particles = [],
    toastUntil = 0,
    newBest = false,
    audio = null,
    activeSounds = new Set(),
    displayState = "";
  const stars = Array.from({ length: 90 }, (_, i) => ({
    x: ((((Math.sin(i * 127.1) * 43758.5453) % 1) + 1) % 1) * c.width,
    y: ((((Math.sin(i * 311.7) * 19491.451) % 1) + 1) % 1) * c.height,
    r: i % 9 === 0 ? 1.4 : 0.65,
    speed: 5 + (i % 13),
  }));
  const colors = { speed: "#71f3e0", multi: "#ffca75", sub: "#c4a0ff" },
    names = { speed: "SPEED", multi: "MULTI", sub: "SUB" },
    icons = { speed: "↑", multi: "⋮", sub: "✧" };
  function unlockAudio() {
    if (!records.data.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume().catch(() => {});
    } catch {}
  }
  function silence() {
    for (const oscillator of activeSounds) {
      try {
        oscillator.stop();
      } catch {}
    }
    activeSounds.clear();
  }
  function sound(type) {
    if (
      !records.data.sound ||
      !audio ||
      audio.state !== "running" ||
      game.state === "paused"
    )
      return;
    try {
      const o = audio.createOscillator(),
        gain = audio.createGain(),
        now = audio.currentTime;
      const tones = {
        hit: [170, 110, 0.035],
        destroy: [100, 35, 0.13],
        damage: [140, 45, 0.2],
        upgrade: [520, 1040, 0.22],
        gameover: [170, 45, 0.4],
      };
      const [from, to, len] = tones[type] || tones.hit;
      o.type = type === "upgrade" ? "sine" : "triangle";
      o.frequency.setValueAtTime(from, now);
      o.frequency.exponentialRampToValueAtTime(to, now + len);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + len);
      o.connect(gain);
      gain.connect(audio.destination);
      activeSounds.add(o);
      o.onended = () => {
        activeSounds.delete(o);
        o.disconnect();
        gain.disconnect();
      };
      o.start();
      o.stop(now + len);
    } catch {}
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
    silence();
    clearControls();
    game.start(progress.loadout());
    runId =
      globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    runReward = 0;
    particles = [];
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
    particles = [];
    toastUntil = 0;
  }
  function panel() {
    const state = game.state;
    $("home").hidden = state !== "title";
    $("flight-layout").hidden = state === "title";
    if (state === uiState) return;
    uiState = state;
    const overlay = $("overlay");
    overlay.hidden = state === "playing" || state === "countdown";
    $("count").hidden = state !== "countdown";
    $("pause").disabled = !["playing", "countdown", "paused"].includes(state);
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
    if (state === "result")
      $("panel").innerHTML =
        `<span class="overline">FLIGHT COMPLETE</span><h2>次は、もう1秒先へ。</h2><div class="result-time">${formatTime(game.time * 1000)}<small> SEC</small></div><span class="best-badge">${newBest ? "✦ NEW PERSONAL BEST" : "SURVIVAL RECORD"}</span><p>自己ベスト ${formatTime(records.data.best)} 秒</p><p class="flight-reward">+${runReward} CR <small>フライト報酬</small></p><div class="result-grid">破壊した隕石 <strong>${game.destroyed}</strong> 個<br>SPEED <strong>Lv.${game.levels.speed}</strong>　MULTI <strong>${c.main.angles[game.levels.multi - 1].length}発</strong>　SUB <strong>Lv.${game.levels.sub}</strong></div><button class="primary" data-action="start">もう一度フライト ↗</button><button class="secondary" data-action="title">ホームへ</button><button class="secondary ad-placeholder" disabled>短い動画で追加報酬 · 準備中</button>`;

    if (state === "paused" || state === "result")
      document.querySelector("#panel .primary")?.focus({ preventScroll: true });
  }
  function updateUI() {
    panel();
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
        runReward = progress.finish(runId, e.ms, game.destroyed).credits;
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
      sound(e.type);
      if (
        !reduced &&
        ["hit", "destroy", "damage", "upgrade"].includes(e.type)
      ) {
        const n = e.type === "hit" ? 3 : 14;
        for (let i = 0; i < n && particles.length < c.particles; i++) {
          const a = Math.random() * Math.PI * 2,
            s = 20 + Math.random() * 95;
          particles.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * s,
            vy: Math.sin(a) * s,
            life: e.type === "hit" ? 0.16 : 0.5,
            max: e.type === "hit" ? 0.16 : 0.5,
            color:
              e.type === "damage"
                ? "#ff7b89"
                : e.type === "upgrade"
                  ? colors[e.kind]
                  : e.type === "destroy"
                    ? "#dfb98c"
                    : "#71f3e0",
          });
        }
      }
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
    ctx.shadowColor = "#71f3e0";
    ctx.shadowBlur = reduced ? 0 : 12;
    ctx.fillStyle = drone ? "#71f3e0" : game.player.color || "#71f3e0";
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.lineTo(17, 14);
    ctx.lineTo(7, 10);
    ctx.lineTo(0, 16);
    ctx.lineTo(-7, 10);
    ctx.lineTo(-17, 14);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
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
    glow.addColorStop(0, "#1c465c30");
    glow.addColorStop(1, "#101a2800");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, c.width, c.height);
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
      rockGrad.addColorStop(0, "#62606b");
      rockGrad.addColorStop(1, "#292e41");
      ctx.fillStyle = rockGrad;
      ctx.fill();
      ctx.strokeStyle = "#a8a0a575";
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
    for (const b of game.bullets) {
      ctx.fillStyle = b.sub ? "#c4a0ff" : "#9cfff0";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = reduced ? 0 : 8;
      ctx.beginPath();
      ctx.roundRect(b.x - 2, b.y - 7, 4, 13, 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    for (const item of game.items) {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.fillStyle = "#111f32";
      ctx.strokeStyle = colors[item.type];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-21, -21, 42, 42, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = colors[item.type];
      ctx.textAlign = "center";
      ctx.font = "bold 23px system-ui";
      ctx.fillText(icons[item.type], 0, 4);
      ctx.font = "bold 7px system-ui";
      ctx.fillText(names[item.type], 0, 15);
      ctx.restore();
    }
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
      ship(p.x, p.y);
      ctx.restore();
      if (game.levels.sub) {
        ship(p.x + 28, p.y, 0.43, true);
        if (game.levels.sub >= 2) ship(p.x - 28, p.y, 0.43, true);
      }
    }
    for (const p of particles) {
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#8eaac13b";
    ctx.font = "8px ui-monospace,monospace";
    ctx.textAlign = "left";
    ctx.fillText("SECTOR 001 / DEEP SPACE", 17, c.height - 16);
    ctx.textAlign = "right";
    ctx.fillText("480 : 720", c.width - 17, c.height - 16);
  }
  function frame(now) {
    const elapsed = Math.max(0, (now - last) / 1000);
    last = now;
    const before = game.time;
    game.advance(elapsed);
    const dt = game.time - before;
    if (dt > 0) {
      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      particles = particles.filter((p) => p.life > 0);
    }
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
      if (["playing", "countdown"].includes(game.state)) pause();
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
    if (records.data.sound) unlockAudio();
    else silence();
    refreshRecords();
  });
  window.addEventListener("blur", () => {
    pause();
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
  function renderHome() {
    const ship = StarProgress.SHIPS.find(
        (s) => s.id === progress.data.selectedShip,
      ),
      load = progress.loadout();
    const mission = StarProgress.MISSIONS.find(
      (m) => !progress.data.claimed.includes(m.id),
    );
    $("home").innerHTML =
      `<div class="home-bar"><span class="eyebrow"><span class="live-dot"></span> PILOT HEADQUARTERS</span><span class="pilot-status">${account.user ? "アカウント接続中" : "ゲストパイロット"} <b>${progress.data.credits.toLocaleString()} <small>CR</small></b></span></div>
    <div class="home-grid"><div class="home-hero"><span class="eyebrow">YOUR NEXT FLIGHT STARTS HERE</span><h1>STAR<br><span>DODGE</span><b>✦</b></h1><p class="intro">ひとつのフライトが、次の力になる。<br>育てた相棒で、まだ見ぬ記録へ。</p><div class="hangar-art" style="--ship-color:${ship.color}" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><svg viewBox="0 0 160 180"><path d="M80 8 145 143 105 130 80 157 55 130 15 143Z" fill="currentColor"/><path d="M80 35 97 113 63 113Z" fill="#e9fffa"/><path d="M73 87h14v45H73z" fill="#153747"/><path d="m67 151 13 27 13-27" fill="#66bfff"/></svg><span>${ship.tag} / ${escapeHTML(ship.name)}</span></div><div class="home-best"><span>PERSONAL BEST</span><strong>${formatTime(records.data.best)}<small> SEC</small></strong></div><button class="primary launch" data-action="start">フライト開始 ↗</button><p class="home-controls">WASD・矢印キー / スマホはドラッグ · 射撃は自動</p></div>
    <div class="home-dashboard"><div class="pilot-card"><div><span class="eyebrow">CURRENT LOADOUT</span><h2>${escapeHTML(ship.name)}</h2><p>HP ${load.hp} · SPEED Lv.${load.levels.speed} · ${c.main.angles[load.levels.multi - 1].length}発 · SUB Lv.${load.levels.sub}</p></div><span class="pilot-emblem" style="color:${ship.color}">⟐</span></div><nav class="home-nav" aria-label="パイロットメニュー"><button data-hub="hangar"><i>⟐</i><span>機体ハンガー<small>3種類の機体を解放・選択</small></span><b>↗</b></button><button data-hub="upgrades"><i>↑</i><span>初期スキル強化<small>フライトのスタートを強くする</small></span><b>↗</b></button><button data-hub="missions"><i>◎</i><span>チャレンジ<small>目標を達成して報酬を受け取る</small></span><b>↗</b></button><button data-hub="account"><i>☁</i><span>アカウント・保存<small>${account.user ? "クラウドに育成をバックアップ" : "ゲストのままでもプレイできます"}</small></span><b>↗</b></button><button data-hub="shop"><i>✦</i><span>ショップ<small>スキンなどを準備中</small></span><b>↗</b></button></nav>${mission ? `<div class="next-goal"><span class="eyebrow">NEXT CHALLENGE</span><h3>${mission.name}</h3><p>${mission.description} <b>+${mission.reward} CR</b></p><progress value="${Math.min(progress.data[mission.field], mission.goal)}" max="${mission.goal}"></progress></div>` : '<div class="next-goal"><span class="eyebrow">ALL CHALLENGES COMPLETE</span><h3>次は、自己ベストのその先へ。</h3></div>'}<p class="earned-note">CR はフライトで獲得。育成は何度でも次の挑戦に引き継がれます。</p></div></div>`;
    refreshRecords();
  }
  let hubPage = "",
    hubBusy = false,
    pendingBackup = null;
  function showHub(page) {
    hubPage = page;
    pendingBackup = null;
    renderHub();
    if (!$("hub").open) $("hub").showModal();
  }
  function renderHub() {
    const titles = {
      hangar: "機体ハンガー",
      upgrades: "初期スキル強化",
      missions: "チャレンジ",
      account: "アカウント・保存",
      shop: "ショップ",
    };
    $("hub-title").textContent = titles[hubPage];
    $("hub-message").textContent = "";
    const balance = `<div class="hub-balance">所持クレジット <b>${progress.data.credits.toLocaleString()} CR</b></div>`;
    if (hubPage === "hangar")
      $("hub-content").innerHTML =
        balance +
        StarProgress.SHIPS.map((ship) => {
          const owned = progress.data.unlocked.includes(ship.id),
            selected = progress.data.selectedShip === ship.id;
          return `<article class="upgrade-card"><span class="ship-mini" style="color:${ship.color}">⟐</span><div><span class="eyebrow">${ship.tag}</span><h3>${ship.name}</h3><p>${ship.description}</p><small>基本HP ${ship.hp} / 移動速度 ${ship.speed}</small></div><button class="secondary" data-ship="${ship.id}" ${selected || (!owned && progress.data.credits < ship.cost) ? "disabled" : ""}>${selected ? "選択中" : owned ? "この機体を選ぶ" : `${ship.cost} CR で解放`}</button></article>`;
        }).join("");
    if (hubPage === "upgrades")
      $("hub-content").innerHTML =
        balance +
        '<p class="hub-intro">強化は次のフライトからずっと有効です。飛行中に拾うアイテムでも、さらに成長できます。</p>' +
        StarProgress.UPGRADES.map((up) => {
          const level = progress.data.upgrades[up.id],
            cost = up.costs[level];
          return `<article class="upgrade-card"><span class="ship-mini">${up.icon}</span><div><h3>${up.name} <small>Lv.${level} / ${up.costs.length}</small></h3><p>${up.description}</p></div><button class="secondary" data-upgrade="${up.id}" ${cost === undefined || progress.data.credits < cost ? "disabled" : ""}>${cost === undefined ? "最大まで強化済み" : `${cost} CR で強化`}</button></article>`;
        }).join("");
    if (hubPage === "missions")
      $("hub-content").innerHTML =
        balance +
        StarProgress.MISSIONS.map((m) => {
          const claimed = progress.data.claimed.includes(m.id),
            done = progress.data[m.field] >= m.goal;
          const current = Math.min(progress.data[m.field], m.goal);
          return `<article class="mission-card"><h3>${m.name}<span>+${m.reward} CR</span></h3><p>${m.description}</p><progress value="${current}" max="${m.goal}"></progress><small>${m.field === "bestMs" ? formatTime(current) + " / " + formatTime(m.goal) + "秒" : current + " / " + m.goal}</small><button class="secondary" data-claim="${m.id}" ${claimed || !done ? "disabled" : ""}>${claimed ? "受取済み" : done ? "報酬を受け取る" : "挑戦中"}</button></article>`;
        }).join("");
    if (hubPage === "shop")
      $("hub-content").innerHTML =
        '<div class="coming-soon"><span>✦</span><h3>自分らしい機体で、宇宙へ。</h3><p>機体スキンやサポーターパックを準備中です。<br>今は購入や支払いはできません。</p><button class="secondary" disabled>ショップ · 準備中</button><p>短い動画を見て追加報酬を受け取る機能も、今後追加する予定です。広告の配信はまだありません。</p></div>';
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
          `<p class="hub-intro">バックアップを読み込むと、この端末の育成を置き換えます。</p><p>${StarProgress.sanitize(pendingBackup.pilot).credits} CR / ${StarProgress.sanitize(pendingBackup.pilot).flights} フライト</p><button class="primary" data-account="restore">このバックアップで復元</button><button class="secondary" data-hub="account">やめる</button>`;
        message = "内容を確認してから復元してください。";
      }
      if (action === "restore") {
        if (!pendingBackup) throw Error("バックアップを選んでください。");
        progress.restore(pendingBackup.pilot);
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
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    if (button.dataset.hub) {
      if (!hubBusy) showHub(button.dataset.hub);
      return;
    }
    if (button.dataset.ship) {
      if (progress.selectShip(button.dataset.ship)) {
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
  if ("serviceWorker" in navigator && !window.Capacitor)
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });

  if (window.Capacitor?.isNativePlatform?.()) {
    const nativeApp = window.Capacitor.registerPlugin("App");
    nativeApp
      .addListener("appStateChange", ({ isActive }) => {
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
        if (["playing", "countdown"].includes(game.state)) pause();
        else if (["paused", "result"].includes(game.state)) title();
        else nativeApp.minimizeApp().catch(() => {});
        updateUI();
      })
      .catch(() => {});
  }
  window.addEventListener("resize", resize);
  refreshRecords();
  renderHome();
  if (new URLSearchParams(location.search).get("screen") === "account")
    showHub("account");
  resize();
  updateUI();
  requestAnimationFrame(frame);
})();
