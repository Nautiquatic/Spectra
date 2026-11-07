/* ============================================================
   PRISMFALL — Spectra Games
   A neon arena survival shooter. Steer, aim, fire, dash, level up.

   No build step, no dependencies. Open index.html to play.
   ============================================================ */
(() => {
  'use strict';

  // -----------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------
  const TAU = Math.PI * 2;
  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  };
  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return m + ':' + String(r).padStart(2, '0');
  };
  const $ = (id) => document.getElementById(id);

  const C = {
    cyan: '#6ef2ff',
    magenta: '#ff5cc8',
    violet: '#927dff',
    gold: '#ffd166',
    red: '#ff5470',
    green: '#7dffb0',
  };

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  const STORE_BEST = 'prismfall.best';
  const STORE_SOUND = 'prismfall.sound';
  const STORE_FULLSCREEN = 'prismfall.fullscreen';
  const STORE_SKIN = 'prismfall.skin';
  const STORE_VOLUME = 'prismfall.volume';
  const STORE_SHAKE = 'prismfall.shake';

  // ---------- Icon Kit: hull shapes and colours (cosmetic only) ----------
  // Points are in hull space with the nose pointing along +x. `core` is the white light.
  const HULLS = [
    { id: 'arrow', name: 'Arrow', pts: [[20, 0], [-12, -12], [-5, 0], [-12, 12]], core: [4, 0] },
    { id: 'dart', name: 'Dart', pts: [[23, 0], [-9, -8], [-14, 0], [-9, 8]], core: [5, 0] },
    { id: 'delta', name: 'Delta', pts: [[19, 0], [-13, -14], [-13, 14]], core: [0, 0] },
    { id: 'wing', name: 'Wing', pts: [[17, 0], [-3, -6], [-14, -16], [-8, 0], [-14, 16], [-3, 6]], core: [3, 0], unlock: 'level-ten' },
    { id: 'needle', name: 'Needle', pts: [[25, 0], [-5, -5], [-14, -9], [-10, 0], [-14, 9], [-5, 5]], core: [6, 0], unlock: 'rift-sealed' },
  ];
  const COLORS = [
    { id: 'cyan', name: 'Cyan', c: '#6ef2ff' },
    { id: 'magenta', name: 'Magenta', c: '#ff5cc8' },
    { id: 'gold', name: 'Gold', c: '#ffd166' },
    { id: 'green', name: 'Green', c: '#7dffb0' },
    { id: 'violet', name: 'Violet', c: '#927dff' },
    { id: 'red', name: 'Crimson', c: '#ff5470', unlock: 'survive-five' },
    { id: 'orange', name: 'Ember', c: '#ff9f5c', unlock: 'score-five-k' },
    { id: 'white', name: 'Starlight', c: '#eef4ff', unlock: 'first-blood' },
  ];
  const skin = { hull: 'arrow', color: 'cyan' };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_SKIN) || '{}');
    if (HULLS.some((h) => h.id === saved.hull)) skin.hull = saved.hull;
    if (COLORS.some((c) => c.id === saved.color)) skin.color = saved.color;
  } catch (e) { /* keep defaults */ }
  const hullDef = () => HULLS.find((h) => h.id === skin.hull) || HULLS[0];
  const skinColor = () => (COLORS.find((c) => c.id === skin.color) || COLORS[0]).c;
  function lighten(hex, t) {
    const n = parseInt(hex.slice(1), 16);
    const mix = (v) => Math.round(v + (255 - v) * t);
    return 'rgb(' + mix((n >> 16) & 255) + ',' + mix((n >> 8) & 255) + ',' + mix(n & 255) + ')';
  }
  // Draws a hull centred at the current origin, nose along +x.
  function drawHull(g, hull, color, opts) {
    const o = opts || {};
    g.shadowColor = color;
    g.shadowBlur = o.glow == null ? 24 : o.glow;
    g.fillStyle = o.blink ? '#ffffff' : lighten(color, 0.35);
    g.beginPath();
    hull.pts.forEach((pt, i) => (i ? g.lineTo(pt[0], pt[1]) : g.moveTo(pt[0], pt[1])));
    g.closePath();
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(hull.core[0], hull.core[1], 3.2, 0, TAU);
    g.fill();
  }

  // The arena is bigger than the screen; the camera follows the player.
  // Leaving the red border starts a 3 second countdown; OUTER is a hard wall beyond it.
  const ZONE_TIME = 3;
  const FIRST_BOSS_AT = 110; // first Prism Wraith at 1:50
  const BOSS_GAP = 80;       // then 80s after the previous one appears/dies
  const OUTER = 600;
  const CAM_LEAD = 70; // camera looks slightly ahead of the hull
  const arena = { w: 2600, h: 1800 };
  const cam = { x: 1300, y: 900 };
  const inZone = (x, y) => x >= 0 && y >= 0 && x <= arena.w && y <= arena.h;

  // -----------------------------------------------------------
  // Canvas + starfield
  // -----------------------------------------------------------
  const canvas = $('game');
  const ctx = canvas.getContext('2d', { alpha: false });

  let W = window.innerWidth;
  let H = window.innerHeight;
  let DPR = 1;
  let stars = [];
  let game = null;

  function makeStars() {
    stars = [];
    const count = Math.round((W * H) / 15000);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: rand(0, W),
        y: rand(0, H),
        z: rand(0.15, 1),
        s: rand(0.6, 1.9),
      });
    }
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    makeStars();
  }

  // -----------------------------------------------------------
  // Sound (tiny WebAudio synth — no files)
  // -----------------------------------------------------------
  const settings = {
    volume: clamp(Number(localStorage.getItem(STORE_VOLUME) ?? 100) / 100, 0, 1),
    shake: localStorage.getItem(STORE_SHAKE) !== '0',
  };

  const Sfx = {
    ac: null,
    master: null,
    enabled: true,
    lastShoot: 0,
    lastGem: 0,

    init() {
      if (this.ac) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ac = new AC();
      this.master = this.ac.createGain();
      this.master.gain.value = 0.16 * settings.volume;
      this.master.connect(this.ac.destination);
    },

    tone(freq, dur, type, vol, slideTo) {
      if (!this.enabled || !this.ac) return;
      const t = this.ac.currentTime;
      const osc = this.ac.createOscillator();
      const g = this.ac.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
      }
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    },

    play(name) {
      if (!this.enabled || !this.ac) return;
      const now = this.ac.currentTime;
      switch (name) {
        case 'shoot':
          if (now - this.lastShoot < 0.05) return;
          this.lastShoot = now;
          this.tone(760, 0.055, 'square', 0.1, 430);
          break;
        case 'hit':
          this.tone(300, 0.035, 'triangle', 0.09, 170);
          break;
        case 'hurt':
          this.tone(170, 0.28, 'sawtooth', 0.45, 55);
          break;
        case 'gem':
          if (now - this.lastGem < 0.045) return;
          this.lastGem = now;
          this.tone(1250, 0.055, 'sine', 0.12, 1760);
          break;
        case 'kill':
          this.tone(190, 0.07, 'square', 0.07, 95);
          break;
        case 'level':
          this.tone(523, 0.1, 'triangle', 0.22, 523);
          this.tone(784, 0.13, 'triangle', 0.2, 784);
          this.tone(1046, 0.18, 'triangle', 0.2, 1046);
          break;
        case 'dash':
          this.tone(260, 0.16, 'sawtooth', 0.18, 900);
          break;
        case 'boss':
          this.tone(72, 0.9, 'sawtooth', 0.32, 42);
          break;
        case 'bossShot':
          this.tone(210, 0.09, 'square', 0.08, 140);
          break;
        case 'bossDown':
          this.tone(440, 0.5, 'sawtooth', 0.28, 60);
          this.tone(660, 0.6, 'triangle', 0.2, 80);
          break;
        case 'death':
          this.tone(340, 0.7, 'sawtooth', 0.45, 38);
          this.tone(170, 0.9, 'square', 0.25, 30);
          break;
        case 'click':
          this.tone(620, 0.05, 'sine', 0.12);
          break;
        case 'tick':
          this.tone(980, 0.03, 'sine', 0.06);
          break;
        case 'warn':
          this.tone(880, 0.12, 'square', 0.14, 660);
          this.tone(660, 0.18, 'square', 0.1, 440);
          break;
        default:
          break;
      }
    },
  };

  // -----------------------------------------------------------
  // DOM
  // -----------------------------------------------------------
  const hud = $('hud');
  const hpFill = $('hp-fill');
  const hpText = $('hp-text');
  const xpFill = $('xp-fill');
  const levelText = $('level-text');
  const timerEl = $('timer');
  const scoreEl = $('score');
  const killsEl = $('kills');
  const bestEl = $('best');
  const dashFill = $('dash-fill');
  const bossWrap = $('boss-wrap');
  const bossFill = $('boss-fill');
  const announceEl = $('announce');
  const cardsEl = $('cards');
  const achToastEl = $('ach-toast');
  const achNameEl = $('ach-name');
  const achDescEl = $('ach-desc');
  const zoneWarn = $('zone-warn');
  const menuBest = $('menu-best');
  const zoneCount = $('zone-count');

  const screens = {
    start: $('screen-start'),
    levelup: $('screen-levelup'),
    pause: $('screen-pause'),
    gameover: $('screen-gameover'),
  };

  const goTime = $('go-time');
  const goKills = $('go-kills');
  const goLevel = $('go-level');
  const goScore = $('go-score');
  const goBest = $('go-best');
  const goReason = $('go-reason');

  // -----------------------------------------------------------
  // Game state
  // -----------------------------------------------------------
  game = {
    mode: 'start',
    time: 0,
    score: 0,
    kills: 0,
    level: 1,
    xp: 0,
    xpNext: 8,
    pendingLevels: 0,
    player: null,
    enemies: [],
    bullets: [],
    eBullets: [],
    gems: [],
    particles: [],
    texts: [],
    rings: [],
    spawnTimer: 1,
    nextBossAt: FIRST_BOSS_AT,
    boss: null,
    bossCount: 0,
    shake: 0,
    flash: 0,
    flashColor: '255,84,112',
    upgrades: {},
    best: Number(localStorage.getItem(STORE_BEST) || 0),
  };

  if (localStorage.getItem(STORE_SOUND) === '0') Sfx.enabled = false;

  // XP needed for the next level. Level 8 ≈ 32 (was 62), level 15 ≈ 69 (was 172).
  const xpFor = (level) => Math.floor(5 + level * 2.5 + level * level * 0.12);

  // -----------------------------------------------------------
  // Content
  // -----------------------------------------------------------
  const ENEMY_TYPES = {
    wisp: { hp: 16, speed: 64, dmg: 8, r: 13, xp: 1, color: C.magenta, score: 10, shape: 'diamond' },
    runner: { hp: 10, speed: 128, dmg: 6, r: 10, xp: 1, color: C.gold, score: 12, shape: 'tri' },
    seer: { hp: 42, speed: 56, dmg: 9, r: 16, xp: 3, color: C.cyan, score: 25, shape: 'orb', ranged: true },
    brute: { hp: 105, speed: 45, dmg: 18, r: 27, xp: 5, color: C.violet, score: 45, shape: 'hex' },
  };

  // Escalating upgrades: every time you take one again it's stronger than the last.
  // v(n) = base + step * n, where n = times already taken (0 for the first pick).
  // e.g. Thruster gives +8%, then +9%, +10%, +11%...
  const UPGRADES = [
    { id: 'dmg', name: 'Overcharge', icon: '✦', max: 10, base: 20, step: 3, desc: (v) => '+' + v + '% shot damage', apply: (p, v) => { p.damage *= 1 + v / 100; } },
    { id: 'rate', name: 'Rapid Fire', icon: '⟫', max: 8, base: 15, step: 2, desc: (v) => '+' + v + '% fire rate', apply: (p, v) => { p.fireRate *= 1 + v / 100; } },
    { id: 'split', name: 'Split Beam', icon: '⋔', max: 5, base: 1, step: 0, desc: () => '+1 bolt per volley', apply: (p) => { p.bulletCount += 1; } },
    { id: 'pierce', name: 'Piercing Light', icon: '→', max: 4, base: 1, step: 0, desc: () => 'Bolts pierce +1 enemy', apply: (p) => { p.pierce += 1; } },
    { id: 'speed', name: 'Thruster', icon: '➤', max: 6, base: 8, step: 1, desc: (v) => '+' + v + '% move and turn speed', apply: (p, v) => { p.speed *= 1 + v / 100; p.turn *= 1 + v / 100; } },
    { id: 'hp', name: 'Aegis', icon: '✚', max: 6, base: 25, step: 5, desc: (v) => '+' + v + ' max hull, heal ' + v, apply: (p, v) => { p.maxHp += v; p.hp = Math.min(p.maxHp, p.hp + v); } },
    { id: 'magnet', name: 'Magnet Field', icon: '◎', max: 4, base: 30, step: 5, desc: (v) => '+' + v + '% pickup radius', apply: (p, v) => { p.pickup *= 1 + v / 100; } },
    { id: 'crit', name: 'Focus Lens', icon: '✷', max: 5, base: 7, step: 1, desc: (v) => '+' + v + '% crit chance', apply: (p, v) => { p.crit += v / 100; } },
    { id: 'regen', name: 'Regeneration', icon: '♥', max: 5, base: 1.2, step: 0.4, desc: (v) => 'Regenerate +' + v.toFixed(1) + ' hull/s', apply: (p, v) => { p.regen += v; } },
    { id: 'dash', name: 'Dash Core', icon: '»', max: 4, base: 15, step: 2, desc: (v) => '-' + v + '% dash cooldown', apply: (p, v) => { p.dashCd *= 1 - v / 100; } },
    { id: 'siphon', name: 'Siphon', icon: '⤓', max: 4, base: 1.5, step: 0.5, desc: (v) => 'Heal ' + v.toFixed(1) + ' hull per kill', apply: (p, v) => { p.lifesteal += v; } },
    { id: 'seeker', name: 'Seeker Lens', icon: '⌖', max: 5, base: 70, step: 20, desc: (v) => '+' + v + '% bolt homing', apply: (p, v) => { p.homing += 0.9 * v / 100; } },
    { id: 'heavy', name: 'Heavy Light', icon: '●', max: 4, base: 10, step: 3, desc: (v) => '+25% bolt size, +' + v + '% damage', apply: (p, v) => { p.bulletSize *= 1.25; p.damage *= 1 + v / 100; } },
  ];
  const upgradeValue = (u, taken) => Math.round((u.base + u.step * taken) * 10) / 10;

  const CARD_COLORS = [C.cyan, C.magenta, C.gold];

  // -----------------------------------------------------------
  // Achievements (Spectra Launcher contract)
  // The WebView2 host (Prismfall.exe) injects SPECTRA_* variables,
  // receives unlocks over the WebView2 message bridge and appends
  // one id per line to the launcher's achievements file.
  // -----------------------------------------------------------
  const ACHIEVEMENTS = {
    'first-blood': { name: 'First Light', desc: 'Destroy your first hostile.' },
    'level-ten': { name: 'Resonant', desc: 'Reach level 10 in a single run.' },
    'rift-sealed': { name: 'Rift Sealed', desc: 'Defeat a Prism Wraith.' },
    'survive-five': { name: 'Last Light', desc: 'Survive for five minutes.' },
    'score-five-k': { name: 'Overcharge', desc: 'Score 5,000 points in one run.' },
  };
  const STORE_ACHIEVEMENTS = 'prismfall.achievements';
  const ACH_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
  const unlockedAchievements = new Set();
  const achQueue = [];
  let achShowing = false;
  let achTimer = null;

  (function loadAchievements() {
    try {
      const fromHost = window.SPECTRA_UNLOCKED;
      if (Array.isArray(fromHost)) {
        fromHost.forEach((id) => {
          if (typeof id === 'string' && ACH_ID_PATTERN.test(id)) unlockedAchievements.add(id);
        });
      }
      const stored = JSON.parse(localStorage.getItem(STORE_ACHIEVEMENTS) || '[]');
      if (Array.isArray(stored)) {
        stored.forEach((id) => {
          if (typeof id === 'string' && ACH_ID_PATTERN.test(id)) unlockedAchievements.add(id);
        });
      }
    } catch (e) {
      // Corrupt or unavailable storage should never block play.
    }
  })();

  function syncAchievementsToHost() {
    // If the launcher's file is missing entries we already know about (first run after
    // switching from browser play, or a reset launcher), send them back quietly.
    if (!window.chrome || !window.chrome.webview || typeof window.chrome.webview.postMessage !== 'function') return;

    const hostList = Array.isArray(window.SPECTRA_UNLOCKED) ? window.SPECTRA_UNLOCKED : [];
    const hostSet = new Set(hostList);
    unlockedAchievements.forEach((id) => {
      if (hostSet.has(id)) return;
      try {
        window.chrome.webview.postMessage('spectra-unlock|' + id);
      } catch (e) {
        // ignore
      }
    });
  }

  function unlockAchievement(id) {
    if (typeof id !== 'string' || !ACH_ID_PATTERN.test(id) || unlockedAchievements.has(id)) return;

    unlockedAchievements.add(id);
    try {
      localStorage.setItem(STORE_ACHIEVEMENTS, JSON.stringify(Array.from(unlockedAchievements)));
    } catch (e) {
      // ignore
    }

    try {
      if (window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === 'function') {
        window.chrome.webview.postMessage('spectra-unlock|' + id);
      }
    } catch (e) {
      // ignore
    }

    queueAchievementToast(id);
  }

  function queueAchievementToast(id) {
    const def = ACHIEVEMENTS[id];
    achQueue.push({ name: def ? def.name : id, desc: def ? def.desc : '' });
    if (!achShowing) nextAchievementToast();
  }

  function nextAchievementToast() {
    const item = achQueue.shift();
    if (!item) {
      achShowing = false;
      return;
    }

    achShowing = true;
    achNameEl.textContent = item.name;
    achDescEl.textContent = item.desc;
    achToastEl.classList.remove('show');
    void achToastEl.offsetWidth;
    achToastEl.classList.add('show');

    clearTimeout(achTimer);
    achTimer = setTimeout(() => {
      achToastEl.classList.remove('show');
      setTimeout(() => {
        achShowing = false;
        nextAchievementToast();
      }, 400);
    }, 3200);
  }

  // -----------------------------------------------------------
  // Player
  // -----------------------------------------------------------
  function makePlayer() {
    return {
      x: arena.w / 2,
      y: arena.h / 2,
      r: 13,
      speed: 220,
      turn: 4.3, // radians per second
      hp: 120,
      maxHp: 120,
      invuln: 0,
      fireRate: 3.0,
      fireTimer: 0.15,
      damage: 12,
      bulletSpeed: 650,
      bulletSize: 3.4,
      bulletCount: 1,
      pierce: 0,
      crit: 0.06,
      critMult: 2,
      pickup: 105,
      dashCd: 2.8,
      dashLeft: 0,
      dashTime: 0,
      dashX: 0,
      dashY: -1,
      regen: 0,
      lifesteal: 0,
      homing: 0.9, // radians/second a bolt can turn toward a target (small on purpose)
      aim: -Math.PI / 2,
      trail: [],
    };
  }

  // -----------------------------------------------------------
  // Input
  // -----------------------------------------------------------
  // Tank-style controls: W/S thrust forward/back along the hull's heading,
  // A/D rotate it. The cannon fires where the hull points (left click or Space).
  const keys = new Set();
  const pointer = { active: false, x: 0, y: 0 };
  let mouseFiring = false;
  const REVERSE_MULT = 0.6;

  function inputDir() {
    let turn = 0;
    let thrust = 0;
    if (keys.has('d') || keys.has('arrowright')) turn += 1;
    if (keys.has('a') || keys.has('arrowleft')) turn -= 1;
    if (keys.has('w') || keys.has('arrowup')) thrust += 1;
    if (keys.has('s') || keys.has('arrowdown')) thrust -= 1;

    // Touch: steer the hull toward the finger and drive forward.
    if (turn === 0 && thrust === 0 && pointer.active && game.player) {
      const p = game.player;
      const dx = pointer.x + cam.x - W / 2 - p.x;
      const dy = pointer.y + cam.y - H / 2 - p.y;
      if (Math.hypot(dx, dy) > 24) {
        const diff = ((Math.atan2(dy, dx) - p.aim + Math.PI * 3) % TAU) - Math.PI;
        turn = clamp(diff * 3, -1, 1);
        thrust = Math.abs(diff) < 1.2 ? 1 : 0;
      }
    }
    return { turn, thrust };
  }

  function wantsFire() {
    return mouseFiring || keys.has(' ') || pointer.active;
  }

  function tryDash() {
    const p = game.player;
    if (!p || game.mode !== 'playing' || p.dashLeft > 0 || p.dashTime > 0) return;

    // Dash along the heading, or backwards if reversing.
    const back = inputDir().thrust < 0 ? -1 : 1;
    p.dashX = Math.cos(p.aim) * back;
    p.dashY = Math.sin(p.aim) * back;
    p.dashTime = 0.18;
    p.dashLeft = p.dashCd;
    p.invuln = Math.max(p.invuln, 0.3);
    game.shake = Math.max(game.shake, 5);
    Sfx.play('dash');
    const dashCol = skinColor();

    for (let i = 0; i < 14; i++) {
      const a = rand(0, TAU);
      const sp = rand(40, 200);
      game.particles.push({
        x: p.x, y: p.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.2, 0.45), max: 0.45,
        size: rand(2, 5), color: dashCol,
      });
    }
  }

  // -----------------------------------------------------------
  // Flow
  // -----------------------------------------------------------
  function showScreen(name) {
    for (const key in screens) {
      screens[key].classList.toggle('hidden', key !== name);
    }
  }

  function announce(text, color) {
    announceEl.textContent = text;
    announceEl.style.color = color;
    announceEl.style.textShadow = '0 0 28px ' + color;
    announceEl.classList.remove('show');
    void announceEl.offsetWidth;
    announceEl.classList.add('show');
  }

  // Fullscreen. Inside Prismfall.exe the host window does it (borderless, covers the screen);
  // in a browser it uses the Fullscreen API.
  const isHost = () => !!window.SPECTRA_HOST && !!(window.chrome && window.chrome.webview);
  function isFullscreen() {
    return isHost() ? !!window.SPECTRA_FULLSCREEN : !!document.fullscreenElement;
  }
  function setFullscreen(on) {
    localStorage.setItem(STORE_FULLSCREEN, on ? '1' : '0');
    if (isHost()) {
      try { window.chrome.webview.postMessage('spectra-window|fullscreen-' + (on ? 'on' : 'off')); } catch (e) { /* ignore */ }
    } else if (on && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (!on && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setTimeout(updateFullscreenLabels, 50);
  }
  function toggleFullscreen() {
    setFullscreen(!isFullscreen());
  }
  function updateFullscreenLabels() {
    const label = 'FULLSCREEN: ' + (isFullscreen() ? 'ON' : 'OFF');
    document.querySelectorAll('.fs-label').forEach((el) => {
      el.textContent = label;
    });
    if (typeof updateSettingsUI === 'function' && openPanel === 'settings') updateSettingsUI();
  }
  window.addEventListener('spectra-fullscreen', updateFullscreenLabels);
  document.addEventListener('fullscreenchange', updateFullscreenLabels);

  function updateSoundLabels() {
    const label = 'SOUND: ' + (Sfx.enabled ? 'ON' : 'OFF');
    document.querySelectorAll('.sound-label').forEach((el) => {
      el.textContent = label;
    });
    if (typeof updateSettingsUI === 'function' && openPanel === 'settings') updateSettingsUI();
  }

  function toggleSound() {
    Sfx.enabled = !Sfx.enabled;
    localStorage.setItem(STORE_SOUND, Sfx.enabled ? '1' : '0');
    updateSoundLabels();
    if (Sfx.enabled) {
      Sfx.init();
      Sfx.play('click');
    }
  }

  function resetGame() {
    game.time = 0;
    game.score = 0;
    game.kills = 0;
    game.level = 1;
    game.xp = 0;
    game.xpNext = xpFor(1);
    game.pendingLevels = 0;
    arena.w = Math.max(2600, Math.round(W * 1.5));
    arena.h = Math.max(1800, Math.round(H * 1.5));
    game.player = makePlayer();
    game.outTimer = 0;
    cam.x = game.player.x;
    cam.y = game.player.y;
    game.enemies = [];
    game.bullets = [];
    game.eBullets = [];
    game.gems = [];
    game.particles = [];
    game.texts = [];
    game.rings = [];
    game.spawnTimer = 1.1;
    game.nextBossAt = FIRST_BOSS_AT;
    game.boss = null;
    game.bossCount = 0;
    game.shake = 0;
    game.flash = 0;
    game.upgrades = {};
    updateHud();
  }

  // ---------- Main menu ----------
  const menuItems = Array.from(document.querySelectorAll('.menu-item'));
  const panels = { kit: $('panel-kit'), settings: $('panel-settings') };
  let menuSel = 0;
  let openPanel = null;

  function selectMenu(i, silent) {
    const visible = menuItems.filter((b) => !b.classList.contains('hidden'));
    menuSel = (i + visible.length) % visible.length;
    menuItems.forEach((b) => b.classList.toggle('sel', b === visible[menuSel]));
    if (!silent) Sfx.play('tick');
  }

  function setPanel(name) {
    openPanel = name;
    for (const k in panels) panels[k].classList.toggle('hidden', k !== name);
    menuItems.forEach((b) => b.classList.toggle('open', b.dataset.menu === name));
    if (name === 'kit') renderKit();
    if (name === 'settings') updateSettingsUI();
  }

  function activateMenu(action) {
    Sfx.init();
    if (action === 'play') {
      Sfx.play('click');
      setPanel(null);
      startGame();
    } else if (action === 'kit' || action === 'settings') {
      Sfx.play('click');
      setPanel(openPanel === action ? null : action);
    } else if (action === 'exit') {
      exitGame();
    }
  }

  function exitGame() {
    if (isHost()) {
      try { window.chrome.webview.postMessage('spectra-window|exit'); } catch (e) { /* ignore */ }
    } else {
      window.close();
    }
  }

  function goToMenu() {
    game.mode = 'start';
    game.player = null;
    game.boss = null;
    game.bullets = [];
    game.eBullets = [];
    game.gems = [];
    game.texts = [];
    game.rings = [];
    game.outTimer = 0;
    game.enemies = makeAttract();
    mouseFiring = false;
    hud.classList.add('hidden');
    zoneWarn.classList.add('hidden');
    menuBest.textContent = game.best.toLocaleString();
    setPanel(null);
    showScreen('start');
    selectMenu(0, true);
  }

  // ---------- Icon Kit ----------
  const kitHulls = $('kit-hulls');
  const kitColors = $('kit-colors');
  const kitNote = $('kit-note');
  const kitPreview = $('kit-preview');
  const achName = (id) => (ACHIEVEMENTS[id] ? ACHIEVEMENTS[id].name : id);
  const isUnlocked = (item) => !item.unlock || unlockedAchievements.has(item.unlock);

  function renderKit() {
    kitHulls.innerHTML = HULLS.map((h) => '<button class="kit-opt' + (h.id === skin.hull ? ' on' : '') + (isUnlocked(h) ? '' : ' locked') +
      '" data-hull="' + h.id + '" title="' + h.name + (isUnlocked(h) ? '' : ' (unlock: ' + achName(h.unlock) + ')') + '"><canvas width="96" height="96"></canvas></button>').join('');
    kitHulls.querySelectorAll('canvas').forEach((cv, i) => {
      const g = cv.getContext('2d');
      g.translate(48, 50);
      g.rotate(-Math.PI / 2);
      g.scale(1.6, 1.6);
      drawHull(g, HULLS[i], skinColor(), { glow: 10 });
    });
    kitColors.innerHTML = COLORS.map((c) => '<button class="kit-opt' + (c.id === skin.color ? ' on' : '') + (isUnlocked(c) ? '' : ' locked') +
      '" data-color="' + c.id + '" style="--c:' + c.c + '" title="' + c.name + (isUnlocked(c) ? '' : ' (unlock: ' + achName(c.unlock) + ')') + '"><span class="swatch"></span></button>').join('');
    kitNote.textContent = hullDef().name + ' · ' + (COLORS.find((c) => c.id === skin.color) || COLORS[0]).name;
  }

  function pickSkin(kind, id) {
    const list = kind === 'hull' ? HULLS : COLORS;
    const item = list.find((x) => x.id === id);
    if (!item) return;
    if (!isUnlocked(item)) {
      kitNote.textContent = item.name + ' is locked. Unlock it with the "' + achName(item.unlock) + '" achievement (' + ACHIEVEMENTS[item.unlock].desc.replace(/\.$/, '') + ').';
      return;
    }
    skin[kind] = id;
    try { localStorage.setItem(STORE_SKIN, JSON.stringify(skin)); } catch (e) { /* ignore */ }
    Sfx.play('click');
    renderKit();
  }

  function drawKitPreview(now) {
    if (openPanel !== 'kit') return;
    const g = kitPreview.getContext('2d');
    const w = kitPreview.width;
    const h = kitPreview.height;
    g.clearRect(0, 0, w, h);
    const col = skinColor();
    // little trail behind the hull
    for (let i = 8; i > 0; i--) {
      g.fillStyle = rgba(col, 0.03 * (9 - i));
      g.beginPath();
      g.arc(w / 2 - 70 - i * 10, h / 2 + Math.sin(now / 500 - i * 0.25) * 6, 10, 0, TAU);
      g.fill();
    }
    g.save();
    g.translate(w / 2, h / 2 + Math.sin(now / 500) * 6);
    g.rotate(Math.sin(now / 900) * 0.18);
    g.scale(3.2, 3.2);
    drawHull(g, hullDef(), col, { glow: 30 });
    g.restore();
  }

  // ---------- Settings ----------
  function updateSettingsUI() {
    $('set-sound').classList.toggle('on', Sfx.enabled);
    $('set-fullscreen').classList.toggle('on', isFullscreen());
    $('set-shake').classList.toggle('on', settings.shake);
    $('set-volume').value = String(Math.round(settings.volume * 100));
  }

  function startGame() {
    Sfx.init();
    // browsers only allow fullscreen from a click/key press, so enter it when a run starts
    if (!isHost() && localStorage.getItem(STORE_FULLSCREEN) !== '0' && !document.fullscreenElement) setFullscreen(true);
    mouseFiring = false;
    resetGame();
    game.mode = 'playing';
    hud.classList.remove('hidden');
    showScreen(null);
    announce('SURVIVE', C.cyan);
    lastTime = performance.now();
    updateHud();
  }

  function togglePause() {
    if (game.mode === 'playing') {
      game.mode = 'paused';
      showScreen('pause');
    } else if (game.mode === 'paused') {
      game.mode = 'playing';
      showScreen(null);
      lastTime = performance.now();
    }
  }

  function die(cause) {
    const p = game.player;
    game.mode = 'gameover';
    zoneWarn.classList.add('hidden');
    goReason.textContent = cause === 'zone' ? 'LOST OUTSIDE THE ZONE' : 'HULL INTEGRITY LOST';
    game.shake = 26;
    game.flash = 1;
    game.flashColor = '255,84,112';
    Sfx.play('death');

    for (let i = 0; i < 70; i++) {
      const a = rand(0, TAU);
      const sp = rand(40, 420);
      game.particles.push({
        x: p.x, y: p.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.4, 1.1), max: 1.1,
        size: rand(2, 6), color: Math.random() < 0.5 ? skinColor() : C.magenta,
      });
    }

    game.best = Math.max(game.best, game.score);
    localStorage.setItem(STORE_BEST, String(game.best));

    goTime.textContent = fmtTime(game.time);
    goKills.textContent = String(game.kills);
    goLevel.textContent = String(game.level);
    goScore.textContent = game.score.toLocaleString();
    goBest.textContent = game.best.toLocaleString();
    bestEl.textContent = game.best.toLocaleString();

    setTimeout(() => {
      if (game.mode === 'gameover') showScreen('gameover');
    }, 480);
  }

  // -----------------------------------------------------------
  // Upgrades
  // -----------------------------------------------------------
  let currentChoices = [];

  function openLevelUp() {
    if (game.pendingLevels <= 0) return;
    game.pendingLevels -= 1;
    game.mode = 'levelup';
    Sfx.play('level');
    showUpgradeScreen();
  }

  function showUpgradeScreen() {
    const pool = UPGRADES.filter((u) => (game.upgrades[u.id] || 0) < u.max);
    const picks = [];
    while (picks.length < 3 && pool.length > 0) {
      const i = randInt(0, pool.length - 1);
      picks.push(pool.splice(i, 1)[0]);
    }

    if (picks.length === 0) {
      resumeFromLevelUp();
      return;
    }

    currentChoices = picks;
    cardsEl.innerHTML = picks.map((u, i) => {
      const lvl = game.upgrades[u.id] || 0;
      const stack = lvl > 0 ? 'Level ' + (lvl + 1) + ' / ' + u.max : 'New';
      return '<button class="card" data-i="' + i + '" style="--accent:' + CARD_COLORS[i % 3] + '">' +
        '<span class="card-key">' + (i + 1) + '</span>' +
        '<span class="card-icon">' + u.icon + '</span>' +
        '<span class="card-name">' + u.name + '</span>' +
        '<span class="card-desc">' + u.desc(upgradeValue(u, lvl)) + '</span>' +
        '<span class="card-stack">' + stack + '</span>' +
        '</button>';
    }).join('');

    const first = cardsEl.querySelector('.card');
    if (first) first.focus();
    showScreen('levelup');
  }

  function chooseByIndex(i) {
    if (game.mode !== 'levelup') return;
    const u = currentChoices[i];
    if (!u) return;

    const taken = game.upgrades[u.id] || 0;
    u.apply(game.player, upgradeValue(u, taken));
    game.upgrades[u.id] = taken + 1;
    Sfx.play('click');

    const p = game.player;
    for (let k = 0; k < 18; k++) {
      const a = rand(0, TAU);
      const sp = rand(40, 210);
      game.particles.push({
        x: p.x, y: p.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.3, 0.7), max: 0.7,
        size: rand(2, 5), color: CARD_COLORS[i % 3],
      });
    }

    currentChoices = [];
    showScreen(null);

    if (game.pendingLevels > 0) {
      openLevelUp();
    } else {
      resumeFromLevelUp();
    }
  }

  function resumeFromLevelUp() {
    if (game.mode === 'gameover') return;
    game.mode = 'playing';
    showScreen(null);
    lastTime = performance.now();
    updateHud();
  }

  // -----------------------------------------------------------
  // Spawning
  // -----------------------------------------------------------
  function pickType(t) {
    const r = Math.random();
    if (t < 15) return r < 0.62 ? 'wisp' : 'runner';
    if (t < 32) return r < 0.46 ? 'wisp' : r < 0.8 ? 'runner' : 'seer';
    if (t < 58) return r < 0.34 ? 'wisp' : r < 0.64 ? 'runner' : r < 0.86 ? 'seer' : 'brute';
    return r < 0.27 ? 'wisp' : r < 0.57 ? 'runner' : r < 0.8 ? 'seer' : 'brute';
  }

  // Max hostiles alive at once (boss not counted): starts at 10, +1 every 30 seconds.
  const enemyCap = () => 10 + Math.floor(game.time / 30);
  const aliveEnemies = () => {
    let n = 0;
    for (const e of game.enemies) if (!e.dead && !e.boss) n++;
    return n;
  };

  function spawnWave() {
    const t = game.time;
    let count = 1 + Math.floor(t / 45);
    if (Math.random() < 0.35) count += 1;
    count = Math.min(count, 4);
    for (let i = 0; i < count; i++) spawnEnemy(pickType(t));
  }

  // A point just outside the camera view that is still inside the arena.
  function spawnPoint(pad) {
    const vx = cam.x - W / 2;
    const vy = cam.y - H / 2;
    for (let i = 0; i < 12; i++) {
      const edge = randInt(0, 3);
      let x;
      let y;
      if (edge === 0) {
        x = rand(vx - pad, vx + W + pad); y = vy - pad;
      } else if (edge === 1) {
        x = vx + W + pad; y = rand(vy - pad, vy + H + pad);
      } else if (edge === 2) {
        x = rand(vx - pad, vx + W + pad); y = vy + H + pad;
      } else {
        x = vx - pad; y = rand(vy - pad, vy + H + pad);
      }
      if (x >= -30 && y >= -30 && x <= arena.w + 30 && y <= arena.h + 30) return { x, y };
    }
    // The view covers most of the arena: use the far side of it.
    const p = game.player;
    return {
      x: p.x < arena.w / 2 ? rand(arena.w * 0.8, arena.w) : rand(0, arena.w * 0.2),
      y: p.y < arena.h / 2 ? rand(arena.h * 0.8, arena.h) : rand(0, arena.h * 0.2),
    };
  }

  function spawnEnemy(type) {
    if (aliveEnemies() >= enemyCap()) return;
    const def = ENEMY_TYPES[type];
    const t = game.time;
    // Gentle growth: about x2 hull at 2.5 min, x4 at 5 min.
    const hp = def.hp * (1 + t * 0.008 + Math.pow(t, 1.5) * 0.00012);

    const { x, y } = spawnPoint(50);

    game.enemies.push({
      type,
      x, y,
      r: def.r,
      color: def.color,
      shape: def.shape,
      hp,
      maxHp: hp,
      dmg: def.dmg,
      xp: def.xp,
      score: def.score,
      speed: def.speed * (1 + Math.min(t * 0.0008, 0.25)), // max +25%, reached after ~5 min
      ranged: !!def.ranged,
      rot: rand(0, TAU),
      spin: rand(-1.8, 1.8),
      flash: 0,
      shootTimer: rand(0.9, 2.2),
      dead: false,
    });
  }

  function spawnBoss() {
    game.bossCount += 1;
    const hp = Math.round((850 + game.bossCount * 800) * (1 + game.time * 0.003));
    const { x, y } = spawnPoint(90);

    const boss = {
      type: 'boss',
      x, y,
      r: 54,
      color: C.violet,
      shape: 'boss',
      hp,
      maxHp: hp,
      dmg: 22,
      xp: 40,
      score: 750,
      speed: 46,
      ranged: false,
      boss: true,
      rot: 0,
      spin: 0.5,
      flash: 0,
      shootTimer: 2.2,
      minionTimer: 5,
      dead: false,
    };

    game.enemies.push(boss);
    game.boss = boss;
    game.nextBossAt = game.time + BOSS_GAP;
    game.shake = 16;
    announce('RIFT BREACH', C.magenta);
    Sfx.play('boss');
  }

  function fireEnemyBullet(e, angle, speed, dmg, color) {
    game.eBullets.push({
      x: e.x + Math.cos(angle) * (e.r + 6),
      y: e.y + Math.sin(angle) * (e.r + 6),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 6,
      dmg,
      life: 3.6,
      color,
    });
  }

  // -----------------------------------------------------------
  // Combat
  // -----------------------------------------------------------
  function fire() {
    const p = game.player;
    const n = p.bulletCount;
    const spread = 0.09 * (n - 1);

    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1);
      const a = p.aim + off;
      const crit = Math.random() < p.crit;
      game.bullets.push({
        x: p.x + Math.cos(a) * 20,
        y: p.y + Math.sin(a) * 20,
        vx: Math.cos(a) * p.bulletSpeed,
        vy: Math.sin(a) * p.bulletSpeed,
        r: p.bulletSize * (crit ? 1.45 : 1),
        dmg: p.damage * (crit ? p.critMult : 1),
        crit,
        pierceLeft: p.pierce,
        homing: p.homing,
        life: 1.35,
        hit: new Set(),
      });
    }

    Sfx.play('shoot');

    for (let i = 0; i < 3; i++) {
      const a = p.aim + rand(-0.35, 0.35);
      game.particles.push({
        x: p.x + Math.cos(p.aim) * 20,
        y: p.y + Math.sin(p.aim) * 20,
        vx: Math.cos(a) * rand(60, 180),
        vy: Math.sin(a) * rand(60, 180),
        life: rand(0.08, 0.2), max: 0.2,
        size: rand(1.5, 3), color: skinColor(),
      });
    }
  }

  function damageEnemy(e, dmg, crit) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.12;

    for (let i = 0; i < 3; i++) {
      const a = rand(0, TAU);
      const sp = rand(30, 140);
      game.particles.push({
        x: e.x, y: e.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.12, 0.3), max: 0.3,
        size: rand(1.5, 3), color: e.color,
      });
    }

    if (crit && game.texts.length < 24) {
      game.texts.push({
        x: e.x, y: e.y - e.r - 8,
        text: 'CRIT',
        life: 0.5, max: 0.5,
        color: C.gold,
      });
    }

    Sfx.play('hit');

    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true;

    const p = game.player;
    game.kills += 1;
    if (game.kills === 1) unlockAchievement('first-blood');
    game.score += e.score;
    if (game.score >= 5000) unlockAchievement('score-five-k');
    Sfx.play(e.boss ? 'bossDown' : 'kill');

    if (p.lifesteal > 0) {
      p.hp = Math.min(p.maxHp, p.hp + p.lifesteal);
    }

    const gemCount = e.boss ? 26 : e.type === 'brute' ? 5 : e.type === 'seer' ? 2 : 1;
    // Shards get richer the longer you survive (x2 at 3 min, x3 at 6 min).
    const xpMult = 1 + game.time / 180;
    const value = e.boss ? Math.round(8 * xpMult) : Math.max(1, Math.round((e.xp * xpMult) / gemCount));

    for (let i = 0; i < gemCount; i++) {
      const a = rand(0, TAU);
      const sp = rand(30, 170);
      game.gems.push({
        x: e.x, y: e.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        v: value,
        r: e.boss ? 6 : 5,
        color: value >= 4 ? C.gold : C.cyan,
        phase: rand(0, TAU),
      });
    }

    const n = e.boss ? 70 : 12;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = rand(40, e.boss ? 400 : 220);
      game.particles.push({
        x: e.x, y: e.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.25, 0.75), max: 0.75,
        size: rand(2, 5), color: e.color,
      });
    }

    if (e.boss) {
      game.boss = null;
      game.nextBossAt = game.time + BOSS_GAP;
      game.score += 500;
      unlockAchievement('rift-sealed');
      if (game.score >= 5000) unlockAchievement('score-five-k');
      game.shake = 22;
      game.flash = 0.8;
      game.flashColor = '125,255,176';
      game.rings.push({
        x: e.x, y: e.y,
        r: 10, max: Math.max(W, H) * 0.9,
        life: 0.9, maxLife: 0.9,
        color: C.green, width: 6,
      });
      announce('RIFT SEALED', C.green);
    }
  }

  function damagePlayer(dmg) {
    const p = game.player;
    if (!p || game.mode !== 'playing') return;
    if (p.invuln > 0 || p.dashTime > 0) return;

    p.hp -= dmg;
    p.invuln = 1.0;
    game.shake = Math.max(game.shake, 9);
    game.flash = Math.min(1, game.flash + 0.5);
    game.flashColor = '255,84,112';
    Sfx.play('hurt');

    for (let i = 0; i < 12; i++) {
      const a = rand(0, TAU);
      const sp = rand(40, 230);
      game.particles.push({
        x: p.x, y: p.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.2, 0.5), max: 0.5,
        size: rand(2, 4), color: C.red,
      });
    }

    if (p.hp <= 0) {
      p.hp = 0;
      die();
    }
  }

  function addXp(v) {
    game.xp += v;
    while (game.xp >= game.xpNext) {
      game.xp -= game.xpNext;
      game.level += 1;
      if (game.level >= 10) unlockAchievement('level-ten');
      game.xpNext = xpFor(game.level);
      game.pendingLevels += 1;
    }
    if (game.pendingLevels > 0 && game.mode === 'playing') {
      openLevelUp();
    }
  }

  // -----------------------------------------------------------
  // Update
  // -----------------------------------------------------------
  function updatePlayer(dt) {
    const p = game.player;
    p.invuln = Math.max(0, p.invuln - dt);
    p.dashLeft = Math.max(0, p.dashLeft - dt);

    if (p.regen > 0) {
      p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
    }

    const dir = inputDir();

    if (p.dashTime > 0) {
      p.dashTime -= dt;
      p.x += p.dashX * p.speed * 3.4 * dt;
      p.y += p.dashY * p.speed * 3.4 * dt;
      if (Math.random() < 0.8) {
        game.particles.push({
          x: p.x, y: p.y,
          vx: rand(-25, 25), vy: rand(-25, 25),
          life: 0.3, max: 0.3,
          size: rand(4, 9), color: skinColor(),
        });
      }
    } else {
      p.aim += dir.turn * p.turn * dt;
      const sp = p.speed * (dir.thrust < 0 ? REVERSE_MULT : 1) * dir.thrust;
      p.x += Math.cos(p.aim) * sp * dt;
      p.y += Math.sin(p.aim) * sp * dt;
    }

    // Free to cross the red border, but there is a hard wall OUTER px beyond it.
    p.x = clamp(p.x, -OUTER, arena.w + OUTER);
    p.y = clamp(p.y, -OUTER, arena.h + OUTER);

    if (inZone(p.x, p.y)) {
      game.outTimer = 0;
    } else {
      if (game.outTimer === 0) Sfx.play('warn');
      game.outTimer += dt;
      if (game.outTimer >= ZONE_TIME) {
        p.hp = 0;
        die('zone');
        return;
      }
    }

    p.trail.push({ x: p.x, y: p.y, life: 0.35 });
    if (p.trail.length > 16) p.trail.shift();
    for (const t of p.trail) t.life -= dt;
    p.trail = p.trail.filter((t) => t.life > 0);

    // Manual fire: hold left click or Space.
    p.fireTimer -= dt;
    if (wantsFire()) {
      if (p.fireTimer <= 0) {
        fire();
        p.fireTimer += 1 / p.fireRate;
      }
    } else {
      p.fireTimer = Math.max(p.fireTimer, 0);
    }
  }

  // Big slow-drifting hostiles on the right side of the menu.
  function makeAttract() {
    const kinds = ['wisp', 'runner', 'seer', 'brute', 'wisp', 'runner', 'seer'];
    const list = kinds.map((type, i) => {
      const def = ENEMY_TYPES[type];
      return {
        type, shape: def.shape, color: def.color, r: def.r * 2.4,
        hp: 1, maxHp: 1, flash: 0, dead: false,
        sx: rand(0.6, 0.97), sy: (i + 0.5) / kinds.length + rand(-0.05, 0.05),
        vx: rand(-14, 14), vy: rand(-22, -8),
        rot: rand(0, TAU), spin: rand(-0.6, 0.6),
      };
    });
    list.push({
      type: 'boss', shape: 'boss', color: C.violet, r: 54 * 1.5, boss: true,
      hp: 1, maxHp: 1, flash: 0, dead: false, sx: 0.74, sy: 0.5, vx: 0, vy: -6, rot: 0, spin: 0.25,
    });
    return list;
  }

  function updateAttract(dt) {
    cam.x = arena.w / 2;
    cam.y = arena.h / 2;
    const list = game.enemies;
    for (const e of list) {
      e.sx += (e.vx * dt) / W;
      e.sy += (e.vy * dt) / H;
      e.rot += e.spin * dt;
      if (e.sy < -0.12) { e.sy = 1.12; e.sx = rand(0.6, 0.97); }
      if (e.sx < 0.6) e.vx = Math.abs(e.vx);
      if (e.sx > 1.0) e.vx = -Math.abs(e.vx);
    }
    // keep the shapes from overlapping each other (screen space, gentle push)
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = (b.sx - a.sx) * W;
        const dy = (b.sy - a.sy) * H;
        const min = (a.r + b.r) * 1.35;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d >= min) continue;
        const push = Math.min(min - d, 120 * dt) / 2;
        const wa = b.boss ? 1.8 : a.boss ? 0.2 : 1;
        const wb = 2 - wa;
        a.sx -= ((dx / d) * push * wa) / W; a.sy -= ((dy / d) * push * wa) / H;
        b.sx += ((dx / d) * push * wb) / W; b.sy += ((dy / d) * push * wb) / H;
      }
    }
    for (const e of list) {
      e.sx = Math.max(0.56, e.sx);
      e.x = cam.x - W / 2 + e.sx * W;
      e.y = cam.y - H / 2 + e.sy * H;
    }
    updateParticles(dt);
  }

  function updateCamera(dt) {
    const p = game.player;
    const tx = p.x + Math.cos(p.aim) * CAM_LEAD;
    const ty = p.y + Math.sin(p.aim) * CAM_LEAD;
    const k = 1 - Math.exp(-6 * dt);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
  }

  function updateSpawning(dt) {
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      const interval = Math.max(0.32, 1.25 - game.time * 0.0085);
      game.spawnTimer = interval * rand(0.75, 1.25);
      spawnWave();
    }
  }

  function updateEnemies(dt) {
    const p = game.player;

    for (const e of game.enemies) {
      if (e.dead) continue;
      e.rot += e.spin * dt;
      e.flash = Math.max(0, e.flash - dt);

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d;
      const ny = dy / d;

      if (e.boss) {
        e.x += nx * e.speed * dt;
        e.y += ny * e.speed * dt;

        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          const enraged = e.hp / e.maxHp < 0.5;
          e.shootTimer = enraged ? 1.35 : 2.3;
          const count = enraged ? 14 : 10;
          const base = rand(0, TAU);
          for (let i = 0; i < count; i++) {
            fireEnemyBullet(e, base + (i / count) * TAU, 250, 12, C.magenta);
          }
          game.shake = Math.max(game.shake, 4);
          Sfx.play('bossShot');
        }

        e.minionTimer -= dt;
        if (e.minionTimer <= 0) {
          e.minionTimer = e.hp / e.maxHp < 0.5 ? 3.2 : 5.5;
          spawnEnemy('wisp');
          spawnEnemy('wisp');
        }
      } else if (e.ranged) {
        const desired = 245;
        const move = d > desired + 40 ? 1 : d < desired - 55 ? -1 : 0;
        e.x += nx * e.speed * move * dt;
        e.y += ny * e.speed * move * dt;
        e.x += -ny * e.speed * 0.5 * dt;
        e.y += nx * e.speed * 0.5 * dt;

        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && d < 720) {
          e.shootTimer = rand(1.9, 2.9);
          fireEnemyBullet(e, Math.atan2(dy, dx), 235, 10, C.cyan);
        }
      } else {
        e.x += nx * e.speed * dt;
        e.y += ny * e.speed * dt;
      }

      e.x = clamp(e.x, -OUTER - 140, arena.w + OUTER + 140);
      e.y = clamp(e.y, -OUTER - 140, arena.h + OUTER + 140);

      // Hostiles are solid: they hit you on contact but can't sit inside your hull.
      const cx = e.x - p.x;
      const cy = e.y - p.y;
      const cd = Math.hypot(cx, cy) || 0.001;
      const touch = e.r + p.r;
      if (cd < touch) {
        damagePlayer(e.dmg);
        e.x = p.x + (cx / cd) * touch;
        e.y = p.y + (cy / cd) * touch;
      }
    }

    separateEnemies();
  }

  // Push overlapping hostiles apart. Bigger ones (by area) shove smaller ones.
  function separateEnemies() {
    const list = game.enemies;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (a.dead) continue;
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j];
          if (b.dead) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = a.r + b.r;
          const d2v = dx * dx + dy * dy;
          if (d2v >= min * min) continue;
          const d = Math.sqrt(d2v) || 0.001;
          const nx = d2v > 0 ? dx / d : Math.cos(i + j);
          const ny = d2v > 0 ? dy / d : Math.sin(i + j);
          const overlap = min - d;
          const ma = a.r * a.r * (a.boss ? 20 : 1);
          const mb = b.r * b.r * (b.boss ? 20 : 1);
          const ta = mb / (ma + mb);
          a.x -= nx * overlap * ta;
          a.y -= ny * overlap * ta;
          b.x += nx * overlap * (1 - ta);
          b.y += ny * overlap * (1 - ta);
        }
      }
    }
  }

  const offView = (x, y, m) => x < cam.x - W / 2 - m || x > cam.x + W / 2 + m || y < cam.y - H / 2 - m || y > cam.y + H / 2 + m;

  // Gently bend a bolt toward the nearest hostile in front of it (within ~75 degrees and HOMING_RANGE).
  const HOMING_RANGE = 460;
  const HOMING_CONE = Math.cos((75 * Math.PI) / 180);
  function steerBolt(b, dt) {
    if (!(b.homing > 0)) return;
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const fx = b.vx / sp;
    const fy = b.vy / sp;
    let best = null;
    let bestD = HOMING_RANGE * HOMING_RANGE;
    for (const e of game.enemies) {
      if (e.dead || b.hit.has(e)) continue;
      const dx = e.x - b.x;
      const dy = e.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= bestD) continue;
      const d = Math.sqrt(d2) || 1;
      if ((dx * fx + dy * fy) / d < HOMING_CONE) continue;
      best = e;
      bestD = d2;
    }
    if (!best) return;
    const cur = Math.atan2(b.vy, b.vx);
    const want = Math.atan2(best.y - b.y, best.x - b.x);
    const diff = ((want - cur + Math.PI * 3) % TAU) - Math.PI;
    const a = cur + clamp(diff, -b.homing * dt, b.homing * dt);
    b.vx = Math.cos(a) * sp;
    b.vy = Math.sin(a) * sp;
  }

  function updateBullets(dt) {
    for (let i = game.bullets.length - 1; i >= 0; i--) {
      const b = game.bullets[i];
      steerBolt(b, dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      let remove = b.life <= 0 || offView(b.x, b.y, 80);

      if (!remove) {
        for (const e of game.enemies) {
          if (e.dead || b.hit.has(e)) continue;
          const rr = e.r + b.r;
          if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
            b.hit.add(e);
            damageEnemy(e, b.dmg, b.crit);
            if (b.pierceLeft > 0) {
              b.pierceLeft -= 1;
            } else {
              remove = true;
            }
            break;
          }
        }
      }

      if (remove) game.bullets.splice(i, 1);
    }
  }

  function updateEnemyBullets(dt) {
    const p = game.player;
    for (let i = game.eBullets.length - 1; i >= 0; i--) {
      const b = game.eBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      let remove = b.life <= 0 || offView(b.x, b.y, 160);

      if (!remove) {
        const rr = b.r + p.r;
        if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
          damagePlayer(b.dmg);
          remove = true;
        }
      }

      if (remove) game.eBullets.splice(i, 1);
    }
  }

  function updateGems(dt) {
    const p = game.player;
    const pick = p.pickup;
    const pick2 = pick * pick;

    for (let i = game.gems.length - 1; i >= 0; i--) {
      const g = game.gems[i];
      const d2 = dist2(g.x, g.y, p.x, p.y);

      if (d2 < pick2) {
        const d = Math.sqrt(d2) || 1;
        const sp = 420 + 760 * (1 - d / pick);
        g.vx = ((p.x - g.x) / d) * sp;
        g.vy = ((p.y - g.y) / d) * sp;
      }

      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.vx *= Math.exp(-2.2 * dt);
      g.vy *= Math.exp(-2.2 * dt);

      const rr = p.r + 14;
      if (dist2(g.x, g.y, p.x, p.y) < rr * rr) {
        game.gems.splice(i, 1);
        addXp(g.v);
        Sfx.play('gem');
        game.particles.push({
          x: g.x, y: g.y,
          vx: rand(-40, 40), vy: rand(-40, 40),
          life: 0.25, max: 0.25,
          size: 3, color: g.color,
        });
      }
    }
  }

  function updateParticles(dt) {
    if (game.particles.length > 650) {
      game.particles.splice(0, game.particles.length - 650);
    }
    for (const pt of game.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.exp(-2.6 * dt);
      pt.vy *= Math.exp(-2.6 * dt);
      pt.life -= dt;
    }
    game.particles = game.particles.filter((pt) => pt.life > 0);
  }

  function updateTexts(dt) {
    for (const t of game.texts) {
      t.y -= 34 * dt;
      t.life -= dt;
    }
    game.texts = game.texts.filter((t) => t.life > 0);
  }

  function updateRings(dt) {
    for (const r of game.rings) {
      r.life -= dt;
      r.r += (r.max - r.r) * Math.min(1, 2.4 * dt);
    }
    game.rings = game.rings.filter((r) => r.life > 0);
  }

  function update(dt) {
    game.shake *= Math.exp(-7 * dt);
    game.flash = Math.max(0, game.flash - dt * 2.5);

    if (game.mode === 'start') {
      updateAttract(dt);
      return;
    }

    if (game.mode !== 'playing') return;

    game.time += dt;
    if (game.time >= 300) unlockAchievement('survive-five');

    updatePlayer(dt);
    if (game.mode !== 'playing') return;
    updateCamera(dt);
    updateSpawning(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updateEnemyBullets(dt);
    updateGems(dt);
    updateParticles(dt);
    updateTexts(dt);
    updateRings(dt);

    if (game.enemies.some((e) => e.dead)) {
      game.enemies = game.enemies.filter((e) => !e.dead);
    }

    if (!game.boss && game.time >= game.nextBossAt) {
      spawnBoss();
    }

    updateHud();
  }

  // -----------------------------------------------------------
  // HUD
  // -----------------------------------------------------------
  function updateHud() {
    const p = game.player;
    if (!p) return;

    const hpPct = clamp((p.hp / p.maxHp) * 100, 0, 100);
    hpFill.style.width = hpPct + '%';
    hpFill.classList.toggle('low', hpPct < 30);
    hpText.textContent = Math.max(0, Math.ceil(p.hp)) + ' / ' + Math.round(p.maxHp);
    xpFill.style.width = clamp((game.xp / game.xpNext) * 100, 0, 100) + '%';
    levelText.textContent = 'LV ' + game.level;
    timerEl.textContent = fmtTime(game.time);
    scoreEl.textContent = game.score.toLocaleString();
    killsEl.textContent = String(game.kills);
    bestEl.textContent = Math.max(game.best, game.score).toLocaleString();

    const dashPct = (1 - clamp(p.dashLeft / p.dashCd, 0, 1)) * 100;
    dashFill.style.width = dashPct + '%';
    dashFill.classList.toggle('ready', dashPct >= 100);

    const out = game.outTimer > 0 && game.mode === 'playing';
    zoneWarn.classList.toggle('hidden', !out);
    if (out) zoneCount.textContent = Math.max(0, ZONE_TIME - game.outTimer).toFixed(1);

    if (game.boss && !game.boss.dead) {
      bossWrap.classList.remove('hidden');
      bossFill.style.width = clamp((game.boss.hp / game.boss.maxHp) * 100, 0, 100) + '%';
    } else {
      bossWrap.classList.add('hidden');
    }
  }

  // -----------------------------------------------------------
  // Render
  // -----------------------------------------------------------
  function drawBackground() {
    const grd = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.82);
    grd.addColorStop(0, '#0b1024');
    grd.addColorStop(0.55, '#070814');
    grd.addColorStop(1, '#04030a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    const ox = cam.x * 0.12;
    const oy = cam.y * 0.12;

    for (const s of stars) {
      let x = (s.x - ox * s.z) % W;
      if (x < 0) x += W;
      let y = (s.y - oy * s.z) % H;
      if (y < 0) y += H;
      ctx.globalAlpha = 0.22 + s.z * 0.55;
      ctx.fillStyle = s.z > 0.8 ? '#bde9ff' : '#6a7fb5';
      ctx.fillRect(x, y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }

  // Grid floor inside the arena, red-tinted danger area outside it, and the red border.
  function drawArena() {
    const vx = cam.x - W / 2;
    const vy = cam.y - H / 2;
    const grid = 64;

    ctx.strokeStyle = 'rgba(110,242,255,0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const x0 = Math.max(0, Math.floor(vx / grid) * grid);
    const x1 = Math.min(arena.w, vx + W);
    const y0 = Math.max(0, Math.floor(vy / grid) * grid);
    const y1 = Math.min(arena.h, vy + H);
    for (let x = x0; x <= x1; x += grid) {
      ctx.moveTo(x, Math.max(0, vy));
      ctx.lineTo(x, y1);
    }
    for (let y = y0; y <= y1; y += grid) {
      ctx.moveTo(Math.max(0, vx), y);
      ctx.lineTo(x1, y);
    }
    ctx.stroke();

    // outside the zone
    ctx.fillStyle = 'rgba(255,40,70,0.075)';
    ctx.beginPath();
    ctx.rect(vx - 20, vy - 20, W + 40, H + 40);
    ctx.rect(0, 0, arena.w, arena.h);
    ctx.fill('evenodd');

    // hard wall
    ctx.strokeStyle = 'rgba(255,84,112,0.18)';
    ctx.setLineDash([10, 14]);
    ctx.lineWidth = 2;
    ctx.strokeRect(-OUTER, -OUTER, arena.w + OUTER * 2, arena.h + OUTER * 2);
    ctx.setLineDash([]);

    // the red border
    const pulse = 0.75 + Math.sin(performance.now() / 260) * 0.25;
    ctx.save();
    ctx.strokeStyle = C.red;
    ctx.shadowColor = C.red;
    ctx.shadowBlur = 22;
    ctx.globalAlpha = pulse;
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, arena.w, arena.h);
    ctx.restore();
  }

  function drawZoneWarning() {
    if (!(game.outTimer > 0) || game.mode !== 'playing') return;
    const k = clamp(game.outTimer / ZONE_TIME, 0, 1);
    const beat = 0.6 + Math.sin(performance.now() / (120 - k * 60)) * 0.4;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, 'rgba(255,40,70,0)');
    g.addColorStop(1, 'rgba(255,40,70,' + (0.25 + k * 0.45) * beat + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawRings() {
    for (const r of game.rings) {
      ctx.globalAlpha = clamp(r.life / r.maxLife, 0, 1);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawGems() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const t = game.time;
    for (const g of game.gems) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(t * 2.4 + g.phase);
      ctx.shadowColor = g.color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.moveTo(0, -g.r * 1.4);
      ctx.lineTo(g.r, 0);
      ctx.lineTo(0, g.r * 1.4);
      ctx.lineTo(-g.r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(0, 0, g.r * 0.35, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawEnemyBullets() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of game.eBullets) {
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function polygon(sides, radius) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = -Math.PI / 2 + (i / sides) * TAU;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawEnemies() {
    for (const e of game.enemies) {
      if (e.dead) continue;
      const col = e.flash > 0 ? '#ffffff' : e.color;

      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.rot);
      ctx.shadowColor = col;
      ctx.shadowBlur = e.boss ? 30 : 12;
      ctx.lineWidth = e.boss ? 3 : 2;
      ctx.strokeStyle = col;
      ctx.fillStyle = rgba(col, e.flash > 0 ? 0.85 : 0.14);

      if (e.shape === 'orb') {
        ctx.beginPath();
        ctx.arc(0, 0, e.r, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, e.r * 0.5, 0, TAU);
        ctx.stroke();
      } else if (e.shape === 'boss') {
        polygon(6, e.r);
        ctx.fill();
        ctx.stroke();
        ctx.rotate(-e.rot * 2);
        polygon(3, e.r * 0.62);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, e.r * 0.3, 0, TAU);
        ctx.fillStyle = rgba(e.color, 0.55);
        ctx.fill();
      } else {
        const sides = e.shape === 'diamond' ? 4 : e.shape === 'tri' ? 3 : 6;
        polygon(sides, e.r);
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 0.55;
        polygon(sides, e.r * 0.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      if (e.type === 'brute' && e.hp < e.maxHp) {
        const w = e.r * 2;
        const x = e.x - e.r;
        const y = e.y - e.r - 12;
        ctx.fillStyle = 'rgba(10,10,20,0.7)';
        ctx.fillRect(x, y, w, 4);
        ctx.fillStyle = C.violet;
        ctx.fillRect(x, y, w * clamp(e.hp / e.maxHp, 0, 1), 4);
      }
    }
  }

  function drawBullets() {
    const shotCol = skinColor();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const b of game.bullets) {
      const col = b.crit ? (skin.color === 'gold' ? '#ffffff' : C.gold) : shotCol;
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 14;
      ctx.lineWidth = b.r * 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.65, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer() {
    const p = game.player;
    const col = skinColor();

    for (const t of p.trail) {
      const a = (t.life / 0.35) * 0.16;
      ctx.fillStyle = rgba(col, a);
      ctx.beginPath();
      ctx.arc(t.x, t.y, 9, 0, TAU);
      ctx.fill();
    }

    ctx.strokeStyle = rgba(col, 0.07);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.pickup, 0, TAU);
    ctx.stroke();

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aim);
    const blink = p.invuln > 0 && Math.floor(p.invuln * 24) % 2 === 0;
    drawHull(ctx, hullDef(), col, { blink });
    ctx.restore();

    if (p.dashLeft > 0) {
      const ready = 1 - clamp(p.dashLeft / p.dashCd, 0, 1);
      ctx.strokeStyle = 'rgba(255,209,102,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 27, -Math.PI / 2, -Math.PI / 2 + TAU * ready);
      ctx.stroke();
    }
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const pt of game.particles) {
      const a = clamp(pt.life / pt.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (0.5 + a * 0.5), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTexts() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '600 12px "Cascadia Mono", Consolas, monospace';
    for (const t of game.texts) {
      ctx.globalAlpha = clamp(t.life / t.max, 0, 1);
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 10;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }

  function render() {
    drawBackground();

    ctx.save();
    if (game.shake > 0.3 && settings.shake) {
      ctx.translate(rand(-1, 1) * game.shake, rand(-1, 1) * game.shake);
    }
    // world -> screen: centre the camera
    ctx.translate(Math.round(W / 2 - cam.x), Math.round(H / 2 - cam.y));

    drawArena();
    drawRings();
    drawGems();
    drawEnemyBullets();
    drawEnemies();
    drawBullets();
    if (game.player && game.mode !== 'start') drawPlayer();
    drawParticles();
    drawTexts();

    ctx.restore();

    drawZoneWarning();

    if (game.flash > 0) {
      ctx.fillStyle = 'rgba(' + game.flashColor + ',' + (game.flash * 0.32) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  // -----------------------------------------------------------
  // Main loop
  // -----------------------------------------------------------
  let lastTime = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    update(dt);
    render();
    drawKitPreview(now);
    requestAnimationFrame(frame);
  }

  // -----------------------------------------------------------
  // Events
  // -----------------------------------------------------------
  window.addEventListener('resize', resize);

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();

    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
      e.preventDefault();
    }

    keys.add(k);

    if (k === 'f11') {
      e.preventDefault();
      toggleFullscreen();
      return;
    }

    if (game.mode === 'start') {
      if (k === 'escape' && openPanel) { setPanel(null); return; }
      if (k === 'arrowdown' || k === 's') { e.preventDefault(); selectMenu(menuSel + 1); return; }
      if (k === 'arrowup' || k === 'w') { e.preventDefault(); selectMenu(menuSel - 1); return; }
      if (k === 'enter' || k === ' ') {
        e.preventDefault();
        const visible = menuItems.filter((b) => !b.classList.contains('hidden'));
        if (visible[menuSel]) activateMenu(visible[menuSel].dataset.menu);
        return;
      }
    }

    if (game.mode === 'gameover' && (k === 'enter' || k === 'r')) {
      startGame();
      return;
    }

    if (game.mode === 'gameover' && k === 'escape') {
      goToMenu();
      return;
    }

    if (game.mode === 'levelup') {
      if (k === '1' || k === '2' || k === '3') {
        chooseByIndex(Number(k) - 1);
      }
      return;
    }

    if (k === 'escape' || k === 'p') {
      togglePause();
      return;
    }

    if (k === 'm') {
      toggleSound();
      return;
    }

    if (k === 'f11' || k === 'f') {
      e.preventDefault();
      toggleFullscreen();
      return;
    }

    if (game.mode === 'playing' && k === 'shift' && !e.repeat) {
      tryDash();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.key.toLowerCase());
  });

  window.addEventListener('blur', () => {
    keys.clear();
    pointer.active = false;
    mouseFiring = false;
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0 && game.mode === 'playing') mouseFiring = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseFiring = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || game.mode !== 'playing') return;
    pointer.active = true;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointer.active || e.pointerType !== 'touch') return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  });

  const endPointer = () => {
    pointer.active = false;
  };

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  window.addEventListener('pointerup', endPointer);

  cardsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-i]');
    if (!btn) return;
    chooseByIndex(Number(btn.dataset.i));
  });

  menuItems.forEach((b, i) => {
    b.addEventListener('mouseenter', () => { if (!b.classList.contains('sel')) selectMenu(menuItems.filter((x) => !x.classList.contains('hidden')).indexOf(b)); });
    b.addEventListener('click', () => activateMenu(b.dataset.menu));
  });
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { Sfx.play('click'); setPanel(null); }));
  document.querySelectorAll('.btn-menu').forEach((b) => b.addEventListener('click', () => { Sfx.play('click'); goToMenu(); }));
  kitHulls.addEventListener('click', (e) => { const b = e.target.closest('[data-hull]'); if (b) pickSkin('hull', b.dataset.hull); });
  kitColors.addEventListener('click', (e) => { const b = e.target.closest('[data-color]'); if (b) pickSkin('color', b.dataset.color); });
  $('set-sound').addEventListener('click', () => { Sfx.init(); toggleSound(); updateSettingsUI(); });
  $('set-fullscreen').addEventListener('click', () => { toggleFullscreen(); setTimeout(updateSettingsUI, 120); });
  $('set-shake').addEventListener('click', () => {
    settings.shake = !settings.shake;
    try { localStorage.setItem(STORE_SHAKE, settings.shake ? '1' : '0'); } catch (e) { /* ignore */ }
    Sfx.play('click');
    updateSettingsUI();
  });
  $('set-volume').addEventListener('input', (e) => {
    settings.volume = clamp(Number(e.target.value) / 100, 0, 1);
    try { localStorage.setItem(STORE_VOLUME, String(Math.round(settings.volume * 100))); } catch (err) { /* ignore */ }
    Sfx.init();
    if (Sfx.master) Sfx.master.gain.value = 0.16 * settings.volume;
  });
  $('set-volume').addEventListener('change', () => Sfx.play('tick'));

  $('btn-restart').addEventListener('click', () => {
    Sfx.init();
    startGame();
  });

  $('btn-resume').addEventListener('click', () => {
    togglePause();
  });

  document.querySelectorAll('.btn-fullscreen').forEach((b) => b.addEventListener('click', toggleFullscreen));
  $('btn-sound-pause').addEventListener('click', toggleSound);
  $('btn-dash').addEventListener('click', () => {
    tryDash();
  });

  // -----------------------------------------------------------
  // Boot
  // -----------------------------------------------------------
  resize();
  updateSoundLabels();
  // the exe starts fullscreen; respect a player who turned it off
  if (isHost() && localStorage.getItem(STORE_FULLSCREEN) === '0' && window.SPECTRA_FULLSCREEN) setFullscreen(false);
  updateFullscreenLabels();
  bestEl.textContent = game.best.toLocaleString();
  // Exit only makes sense inside Prismfall.exe; a browser tab can't close itself
  if (!isHost()) $('menu-exit').classList.add('hidden');
  goToMenu();

  window.SpectraAchievements = {
    gameId: window.SPECTRA_GAME_ID || 'prismfall',
    unlock: function (id) {
      unlockAchievement(String(id));
    },
    isUnlocked: function (id) {
      return unlockedAchievements.has(String(id));
    },
    unlocked: function () {
      return Array.from(unlockedAchievements);
    },
  };

  syncAchievementsToHost();

  requestAnimationFrame(frame);
})();
