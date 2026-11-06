/* ============================================================
   PRISMFALL — Spectra Games
   A neon arena survival shooter. Auto-fire, dash, level up.

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
    if (game && game.player) {
      game.player.x = clamp(game.player.x, 30, W - 30);
      game.player.y = clamp(game.player.y, 30, H - 30);
    }
  }

  // -----------------------------------------------------------
  // Sound (tiny WebAudio synth — no files)
  // -----------------------------------------------------------
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
      this.master.gain.value = 0.16;
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
    nextBossAt: 75,
    boss: null,
    bossCount: 0,
    shake: 0,
    flash: 0,
    flashColor: '255,84,112',
    upgrades: {},
    best: Number(localStorage.getItem(STORE_BEST) || 0),
  };

  if (localStorage.getItem(STORE_SOUND) === '0') Sfx.enabled = false;

  const xpFor = (level) => Math.floor(3 + level * 3 + level * level * 0.55);

  // -----------------------------------------------------------
  // Content
  // -----------------------------------------------------------
  const ENEMY_TYPES = {
    wisp: { hp: 16, speed: 64, dmg: 8, r: 13, xp: 1, color: C.magenta, score: 10, shape: 'diamond' },
    runner: { hp: 10, speed: 142, dmg: 6, r: 10, xp: 1, color: C.gold, score: 12, shape: 'tri' },
    seer: { hp: 42, speed: 56, dmg: 9, r: 16, xp: 3, color: C.cyan, score: 25, shape: 'orb', ranged: true },
    brute: { hp: 105, speed: 45, dmg: 18, r: 27, xp: 5, color: C.violet, score: 45, shape: 'hex' },
  };

  const UPGRADES = [
    { id: 'dmg', name: 'Overcharge', icon: '✦', max: 7, desc: '+22% shot damage', apply: (p) => { p.damage *= 1.22; } },
    { id: 'rate', name: 'Rapid Fire', icon: '⟫', max: 7, desc: '+18% fire rate', apply: (p) => { p.fireRate *= 1.18; } },
    { id: 'split', name: 'Split Beam', icon: '⋔', max: 5, desc: '+1 bolt per volley', apply: (p) => { p.bulletCount += 1; } },
    { id: 'pierce', name: 'Piercing Light', icon: '→', max: 4, desc: 'Bolts pierce +1 enemy', apply: (p) => { p.pierce += 1; } },
    { id: 'speed', name: 'Thruster', icon: '➤', max: 5, desc: '+8% move speed', apply: (p) => { p.speed *= 1.08; } },
    { id: 'hp', name: 'Aegis', icon: '✚', max: 5, desc: '+25 max hull, heal 25', apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); } },
    { id: 'magnet', name: 'Magnet Field', icon: '◎', max: 4, desc: '+35% pickup radius', apply: (p) => { p.pickup *= 1.35; } },
    { id: 'crit', name: 'Focus Lens', icon: '✷', max: 5, desc: '+7% crit chance', apply: (p) => { p.crit += 0.07; } },
    { id: 'regen', name: 'Regeneration', icon: '♥', max: 4, desc: 'Regenerate +1.2 hull/s', apply: (p) => { p.regen += 1.2; } },
    { id: 'dash', name: 'Dash Core', icon: '»', max: 3, desc: '-18% dash cooldown', apply: (p) => { p.dashCd *= 0.82; } },
    { id: 'siphon', name: 'Siphon', icon: '⤓', max: 4, desc: 'Heal 1.5 hull per kill', apply: (p) => { p.lifesteal += 1.5; } },
    { id: 'heavy', name: 'Heavy Light', icon: '●', max: 3, desc: '+25% bolt size, +10% damage', apply: (p) => { p.bulletSize *= 1.25; p.damage *= 1.1; } },
  ];

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
      x: W / 2,
      y: H / 2,
      r: 13,
      speed: 220,
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
      aim: -Math.PI / 2,
      trail: [],
    };
  }

  // -----------------------------------------------------------
  // Input
  // -----------------------------------------------------------
  const keys = new Set();
  const pointer = { active: false, x: 0, y: 0 };

  function inputDir() {
    let mx = 0;
    let my = 0;
    if (keys.has('d') || keys.has('arrowright')) mx += 1;
    if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
    if (keys.has('s') || keys.has('arrowdown')) my += 1;
    if (keys.has('w') || keys.has('arrowup')) my -= 1;

    if (mx === 0 && my === 0 && pointer.active && game.player) {
      const p = game.player;
      const dx = pointer.x - p.x;
      const dy = pointer.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 14) {
        mx = dx / d;
        my = dy / d;
      }
    }

    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    return { mx, my };
  }

  function tryDash() {
    const p = game.player;
    if (!p || game.mode !== 'playing' || p.dashLeft > 0 || p.dashTime > 0) return;

    const dir = inputDir();
    let mx = dir.mx;
    let my = dir.my;
    if (mx === 0 && my === 0) {
      mx = Math.cos(p.aim);
      my = Math.sin(p.aim);
    }
    p.dashX = mx;
    p.dashY = my;
    p.dashTime = 0.18;
    p.dashLeft = p.dashCd;
    p.invuln = Math.max(p.invuln, 0.3);
    game.shake = Math.max(game.shake, 5);
    Sfx.play('dash');

    for (let i = 0; i < 14; i++) {
      const a = rand(0, TAU);
      const sp = rand(40, 200);
      game.particles.push({
        x: p.x, y: p.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.2, 0.45), max: 0.45,
        size: rand(2, 5), color: C.cyan,
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

  function updateSoundLabels() {
    const label = 'SOUND: ' + (Sfx.enabled ? 'ON' : 'OFF');
    document.querySelectorAll('.sound-label').forEach((el) => {
      el.textContent = label;
    });
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
    game.player = makePlayer();
    game.enemies = [];
    game.bullets = [];
    game.eBullets = [];
    game.gems = [];
    game.particles = [];
    game.texts = [];
    game.rings = [];
    game.spawnTimer = 1.1;
    game.nextBossAt = 75;
    game.boss = null;
    game.bossCount = 0;
    game.shake = 0;
    game.flash = 0;
    game.upgrades = {};
    updateHud();
  }

  function startGame() {
    Sfx.init();
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

  function die() {
    const p = game.player;
    game.mode = 'gameover';
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
        size: rand(2, 6), color: Math.random() < 0.5 ? C.cyan : C.magenta,
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
        '<span class="card-desc">' + u.desc + '</span>' +
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

    game.upgrades[u.id] = (game.upgrades[u.id] || 0) + 1;
    u.apply(game.player);
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

  function spawnWave() {
    const t = game.time;
    let count = 1 + Math.floor(t / 45);
    if (Math.random() < 0.35) count += 1;
    count = Math.min(count, 4);
    for (let i = 0; i < count; i++) spawnEnemy(pickType(t));
  }

  function spawnEnemy(type) {
    if (game.enemies.length > 170) return;
    const def = ENEMY_TYPES[type];
    const t = game.time;
    const hp = def.hp * (1 + t * 0.025 + Math.pow(t, 1.65) * 0.0008);

    const edge = randInt(0, 3);
    const pad = 50;
    let x;
    let y;
    if (edge === 0) {
      x = rand(-pad, W + pad); y = -pad;
    } else if (edge === 1) {
      x = W + pad; y = rand(-pad, H + pad);
    } else if (edge === 2) {
      x = rand(-pad, W + pad); y = H + pad;
    } else {
      x = -pad; y = rand(-pad, H + pad);
    }

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
      speed: def.speed * (1 + Math.min(t * 0.0035, 0.55)),
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
    const edge = randInt(0, 3);
    let x;
    let y;
    if (edge === 0) {
      x = rand(0, W); y = -80;
    } else if (edge === 1) {
      x = W + 80; y = rand(0, H);
    } else if (edge === 2) {
      x = rand(0, W); y = H + 80;
    } else {
      x = -80; y = rand(0, H);
    }

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
    game.nextBossAt = game.time + 70;
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
        size: rand(1.5, 3), color: C.cyan,
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
    const value = e.boss ? 8 : Math.max(1, Math.round(e.xp / gemCount));

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
      game.nextBossAt = game.time + 70;
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
          size: rand(4, 9), color: C.cyan,
        });
      }
    } else {
      p.x += dir.mx * p.speed * dt;
      p.y += dir.my * p.speed * dt;
    }

    p.x = clamp(p.x, p.r + 4, W - p.r - 4);
    p.y = clamp(p.y, p.r + 4, H - p.r - 4);

    p.trail.push({ x: p.x, y: p.y, life: 0.35 });
    if (p.trail.length > 16) p.trail.shift();
    for (const t of p.trail) t.life -= dt;
    p.trail = p.trail.filter((t) => t.life > 0);

    let target = null;
    let best = Infinity;
    for (const e of game.enemies) {
      if (e.dead) continue;
      const d = dist2(p.x, p.y, e.x, e.y);
      if (d < best) {
        best = d;
        target = e;
      }
    }

    if (target) {
      const desired = Math.atan2(target.y - p.y, target.x - p.x);
      let diff = ((desired - p.aim + Math.PI * 3) % TAU) - Math.PI;
      p.aim += clamp(diff, -12 * dt, 12 * dt);

      p.fireTimer -= dt;
      if (p.fireTimer <= 0) {
        fire();
        p.fireTimer += 1 / p.fireRate;
      }
    } else {
      if (dir.mx !== 0 || dir.my !== 0) {
        const desired = Math.atan2(dir.my, dir.mx);
        let diff = ((desired - p.aim + Math.PI * 3) % TAU) - Math.PI;
        p.aim += clamp(diff, -8 * dt, 8 * dt);
      }
      p.fireTimer = Math.min(p.fireTimer, 0.1);
    }
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

      e.x = clamp(e.x, -140, W + 140);
      e.y = clamp(e.y, -140, H + 140);

      if (d < e.r + p.r - 2) {
        damagePlayer(e.dmg);
      }
    }
  }

  function updateBullets(dt) {
    for (let i = game.bullets.length - 1; i >= 0; i--) {
      const b = game.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      let remove = b.life <= 0 || b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40;

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

      let remove = b.life <= 0 || b.x < -60 || b.x > W + 60 || b.y < -60 || b.y > H + 60;

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

    if (game.mode !== 'playing') return;

    game.time += dt;
    if (game.time >= 300) unlockAchievement('survive-five');

    updatePlayer(dt);
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

    const p = game.player;
    const px = p ? p.x : W / 2;
    const py = p ? p.y : H / 2;
    const ox = (px - W / 2) * 0.12;
    const oy = (py - H / 2) * 0.12;

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

    const grid = 64;
    const gox = (px * 0.2) % grid;
    const goy = (py * 0.2) % grid;
    ctx.strokeStyle = 'rgba(110,242,255,0.035)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -gox; x < W; x += grid) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = -goy; y < H; y += grid) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
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
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const b of game.bullets) {
      const col = b.crit ? C.gold : C.cyan;
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

    for (const t of p.trail) {
      const a = (t.life / 0.35) * 0.16;
      ctx.fillStyle = 'rgba(110,242,255,' + a + ')';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 9, 0, TAU);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(110,242,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.pickup, 0, TAU);
    ctx.stroke();

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aim);

    const blink = p.invuln > 0 && Math.floor(p.invuln * 24) % 2 === 0;
    ctx.shadowColor = C.cyan;
    ctx.shadowBlur = 24;
    ctx.fillStyle = blink ? '#ffffff' : '#8ff8ff';
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-12, -12);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-12, 12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(4, 0, 3.2, 0, TAU);
    ctx.fill();
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
    if (game.shake > 0.3) {
      ctx.translate(rand(-1, 1) * game.shake, rand(-1, 1) * game.shake);
    }

    drawRings();
    drawGems();
    drawEnemyBullets();
    drawEnemies();
    drawBullets();
    if (game.player && game.mode !== 'start') drawPlayer();
    drawParticles();
    drawTexts();

    ctx.restore();

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

    if (game.mode === 'start' && (k === 'enter' || k === ' ')) {
      startGame();
      return;
    }

    if (game.mode === 'gameover' && (k === 'enter' || k === 'r')) {
      startGame();
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

    if (game.mode === 'playing' && (k === ' ' || k === 'shift') && !e.repeat) {
      tryDash();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.key.toLowerCase());
  });

  window.addEventListener('blur', () => {
    keys.clear();
    pointer.active = false;
  });

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

  $('btn-play').addEventListener('click', () => {
    Sfx.init();
    Sfx.play('click');
    startGame();
  });

  $('btn-restart').addEventListener('click', () => {
    Sfx.init();
    startGame();
  });

  $('btn-resume').addEventListener('click', () => {
    togglePause();
  });

  $('btn-sound').addEventListener('click', toggleSound);
  $('btn-sound-pause').addEventListener('click', toggleSound);
  $('btn-dash').addEventListener('click', () => {
    tryDash();
  });

  // -----------------------------------------------------------
  // Boot
  // -----------------------------------------------------------
  resize();
  updateSoundLabels();
  bestEl.textContent = game.best.toLocaleString();
  showScreen('start');

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
