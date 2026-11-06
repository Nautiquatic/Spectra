/* Spectra Launcher — UI */
(function () {
  const api = window.spectra;
  const CONFIG = window.SPECTRA_CONFIG || {};
  // The catalogue is downloaded from the game server at startup (see catalog.js)
  let CAT = { news: [], games: [] };
  let GAMES = [];
  let byId = {};
  function setCatalog(c) {
    const games = (Array.isArray(c?.games) ? c.games : []).filter((g) => g && /^[a-z0-9-]+$/i.test(g.id || '')).map((g) => ({
      title: g.id, tagline: '', description: '', status: 'available', version: '', genres: [], platforms: ['Windows'],
      features: [], achievements: [], patchNotes: [], art: { from: '#2a1458', to: '#0b0b1a', glow: '#927dff', motif: 'prism' },
      ...g,
    }));
    games.forEach((g) => { if (!STATUS[g.status]) g.status = 'available'; });
    CAT = { news: Array.isArray(c?.news) ? c.news : [], games };
    GAMES = games;
    byId = Object.fromEntries(GAMES.map((g) => [g.id, g]));
  }
  const $ = (s, el = document) => el.querySelector(s);
  const main = $('#main');

  // ---------------- helpers ----------------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtBytes = (b) => {
    if (!b) return '—';
    const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return `${b.toFixed(i < 2 || b >= 100 ? 0 : b >= 10 ? 1 : 2)} ${u[i]}`;
  };
  const fmtTime = (s) => {
    if (!s) return '—';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m`;
    return `${s}s`;
  };
  const fmtAgo = (t) => {
    if (!t) return 'Never';
    const d = (Date.now() - t) / 1000;
    if (d < 60) return 'Just now';
    if (d < 3600) return `${Math.floor(d / 60)} min ago`;
    if (d < 86400) return `${Math.floor(d / 3600)} h ago`;
    if (d < 86400 * 7) return `${Math.floor(d / 86400)} d ago`;
    return new Date(t).toLocaleDateString();
  };
  const fmtDate = (s) => (s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBA');
  const STATUS = {
    available: { label: 'Available', cls: 'ok' },
    'early-access': { label: 'Early Access', cls: 'ea' },
    'coming-soon': { label: 'Coming Soon', cls: 'soon' },
    'in-development': { label: 'In Development', cls: 'dev' },
  };
  const playable = (g) => g.status === 'available' || g.status === 'early-access';
  const icon = {
    play: '<svg viewBox="0 0 24 24" class="fill"><path d="M7 4.5v15l13-7.5z"/></svg>',
    dl: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 19h14"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.8z"/></svg>',
    more: '<svg viewBox="0 0 24 24" class="fill"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
    stop: '<svg viewBox="0 0 24 24" class="fill"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    grid: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
    list: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" class="fill"/><circle cx="4.5" cy="12" r="1" class="fill"/><circle cx="4.5" cy="18" r="1" class="fill"/></svg>',
    pause: '<svg viewBox="0 0 24 24" class="fill"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
    trophy: '<svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 20h8M9.5 17h5"/></svg>',
    refresh: '<svg viewBox="0 0 24 24"><path d="M19 8a7.5 7.5 0 00-13.5 1M5 16a7.5 7.5 0 0013.5-1"/><path d="M19 4v4h-4M5 20v-4h4"/></svg>',
    folder: '<svg viewBox="0 0 24 24"><path d="M3.5 7a2 2 0 012-2H10l2 2h6.5a2 2 0 012 2v8a2 2 0 01-2 2h-13a2 2 0 01-2-2z"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>',
    chevron: '<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg>',
  };

  // ---------------- state ----------------
  const DEFAULT = {
    profile: { name: 'Player' },
    settings: { installRoot: '', catalogUrl: '', accent: '#927dff', minimizeOnLaunch: true, reduceMotion: false },
    owned: [],
    installed: {},
    favorites: [],
    wishlist: [],
    playtime: {},
    lastPlayed: {},
    completed: [],
    achievements: {},
    catalogCache: null,
    notifications: [{ text: 'Welcome to Spectra Launcher! Spectra games will show up in the Store as they release.', at: Date.now(), read: false }],
    ui: { libView: 'list', libSort: 'recent', libTab: 'all' },
  };
  let state;
  let saveTimer;
  const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => api.saveState(state), 150); };

  const rt = {
    route: { name: 'home' },
    back: [], fwd: [],
    queue: [], // { id, received, total, speed, paused, real }
    running: new Set(),
    heroIdx: 0,
    gameTab: 'overview',
    libFilter: { q: '', installed: false, genres: new Set() },
  };

  const owned = (id) => state.owned.includes(id);
  const installed = (id) => !!state.installed[id];
  const dlOf = (id) => rt.queue.find((d) => d.id === id);
  // state.achievements[gameId] = { achievementId: unlockedAt (ms) }
  const achMap = (id) => { const m = state.achievements?.[id]; return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; };
  const achUnlocked = (id) => Object.keys(achMap(id));
  // only counts achievements that exist in the catalogue
  const achCount = (g) => g.achievements.filter((a) => achMap(g.id)[a.id]).length;
  const totalAch = () => GAMES.reduce((n, g) => n + achCount(g), 0);

  // Merge achievement ids reported by a game (via its achievements file) into the launcher's record.
  function mergeAchievements(gameId, ids, { live = false } = {}) {
    if (!Array.isArray(ids) || !ids.length) return 0;
    state.achievements = state.achievements || {};
    const map = { ...achMap(gameId) };
    const g = byId[gameId];
    const fresh = ids.filter((aid) => !map[aid]);
    if (!fresh.length) return 0;
    const now = Date.now();
    fresh.forEach((aid) => (map[aid] = now));
    state.achievements[gameId] = map;
    const named = g ? fresh.map((aid) => g.achievements.find((a) => a.id === aid)).filter(Boolean) : [];
    named.forEach((a) => {
      if (live) {
        toast(`🏆 Achievement unlocked: ${a.name}`, 'ok');
        // the launcher is usually minimised while a game runs, so also show a Windows notification
        if (!document.hasFocus() && 'Notification' in window) {
          try { new Notification(`🏆 ${a.name}`, { body: `${g.title} · ${a.desc || 'Achievement unlocked'}`, icon: '../Assets/icon.png', silent: false }); } catch {}
        }
      }
      notify(`${g.title}: unlocked “${a.name}”`);
    });
    if (!live && named.length > 1) toast(`🏆 ${named.length} new achievements unlocked`, 'ok');
    else if (!live && named.length === 1) toast(`🏆 Achievement unlocked: ${named[0].name}`, 'ok');
    save();
    return fresh.length;
  }
  const totalPlay = () => Object.values(state.playtime).reduce((a, b) => a + b, 0);

  // ---------------- art ----------------
  // Uses the game's cover/banner image from the server; falls back to generated art if missing or broken.
  const cover = (g, cls = '') => `<div class="art cover ${cls}">${g.cover ? `<img src="${esc(g.cover)}" alt="" data-fb="${g.id}" data-fb-kind="cover">` : SpectraArt.svg(g, { w: 300, h: 400 })}</div>`;
  const banner = (g, seed = '', cls = '') => `<div class="art banner ${cls}">${g.banner ? `<img src="${esc(g.banner)}" alt="" data-fb="${g.id}" data-fb-kind="banner">` : SpectraArt.svg(g, { w: 1280, h: 560, seed })}</div>`;
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG' || !img.dataset.fb || !byId[img.dataset.fb]) return;
    const g = byId[img.dataset.fb];
    img.outerHTML = img.dataset.fbKind === 'banner' ? SpectraArt.svg(g, { w: 1280, h: 560 }) : SpectraArt.svg(g, { w: 300, h: 400 });
  }, true);
  const statusPill = (g) => `<span class="pill ${STATUS[g.status].cls}">${STATUS[g.status].label}</span>`;

  // ---------------- primary button ----------------
  function primaryBtn(g, size = '') {
    const d = dlOf(g.id);
    if (rt.running.has(g.id)) return `<button class="btn running ${size}" data-action="stop" data-id="${g.id}">${icon.stop}<span>Running</span></button>`;
    if (d) {
      const pct = d.total ? Math.floor((d.received / d.total) * 100) : 0;
      return `<button class="btn progress ${size}" data-route="downloads" style="--p:${pct}%"><span>${d.paused ? 'Paused' : d.started ? 'Installing' : 'Queued'} ${d.started ? pct + '%' : ''}</span></button>`;
    }
    if (installed(g.id)) return `<button class="btn primary ${size}" data-action="play" data-id="${g.id}">${icon.play}<span>Play</span></button>`;
    if (!playable(g)) {
      const w = state.wishlist.includes(g.id);
      return `<button class="btn ${w ? 'ghost on' : 'secondary'} ${size}" data-action="wishlist" data-id="${g.id}">${w ? icon.check : icon.plus}<span>${w ? 'Wishlisted' : 'Add to Wishlist'}</span></button>`;
    }
    if (!owned(g.id)) return `<button class="btn primary ${size}" data-action="get" data-id="${g.id}"><span>Get</span><em>Free</em></button>`;
    return `<button class="btn primary ${size}" data-action="install" data-id="${g.id}">${icon.dl}<span>Install</span></button>`;
  }

  // ---------------- views ----------------
  const views = {};

  const catalogUrl = () => state.settings.catalogUrl || CONFIG.catalogUrl || '';
  const noGamesHero = () => `
      <div class="hero welcome">
        <div class="welcome-art"><img src="../Assets/spectra-logo.svg" alt=""></div>
        <div class="hero-body">
          <div class="eyebrow"><span>Spectra Launcher</span></div>
          <h1>Every frame, refracted.</h1>
          <p class="tagline">${rt.catalogError ? "Couldn't reach the game server. Check your connection or the server address in Settings." : catalogUrl() ? 'No games have been released yet. They will appear here the moment they go live.' : 'No game server set yet. Add your catalogue URL in Settings to load Spectra games.'}</p>
          <div class="row gap">${rt.catalogError || !catalogUrl() ? '<button class="btn primary lg" data-route="settings">Open settings</button>' : '<button class="btn secondary lg" data-action="refresh">Check again</button>'}</div>
        </div>
      </div>`;

  views.home = () => {
    let featured = GAMES.filter((g) => g.featured);
    if (!featured.length) featured = GAMES.slice(0, 3);
    const g = featured[rt.heroIdx % featured.length];
    const recent = state.owned.map((id) => byId[id]).filter(Boolean).sort((a, b) => (state.lastPlayed[b.id] || 0) - (state.lastPlayed[a.id] || 0));
    const last = recent.find((x) => state.lastPlayed[x.id]);
    const soon = GAMES.filter((x) => !playable(x));
    return `
    <section class="home-top">
      ${!g ? noGamesHero() : `
      <div class="hero" data-game="${g.id}">
        ${banner(g)}
        <div class="hero-shade"></div>
        <div class="hero-body">
          <div class="eyebrow">${statusPill(g)} <span>${g.genres.join(' · ')}</span></div>
          <h1>${esc(g.title)}</h1>
          <p class="tagline">${esc(g.tagline)}</p>
          <div class="row gap">
            ${primaryBtn(g, 'lg')}
            <button class="btn secondary lg" data-game="${g.id}">View game</button>
          </div>
        </div>
        <div class="hero-dots">${featured.length > 1 ? featured.map((f, i) => `<button class="${i === rt.heroIdx % featured.length ? 'on' : ''}" data-action="hero" data-i="${i}" title="${esc(f.title)}"></button>`).join('') : ''}</div>
      </div>`}
      <div class="card setup">
        <h3>Your setup</h3>
        <dl>
          <div><dt>Account</dt><dd>${esc(state.profile.name)}</dd></div>
          <div><dt>Games owned</dt><dd>${state.owned.length}</dd></div>
          <div><dt>Installed</dt><dd>${Object.keys(state.installed).length}</dd></div>
          <div><dt>Total playtime</dt><dd>${fmtTime(totalPlay()) === '—' ? '0 minutes' : fmtTime(totalPlay())}</dd></div>
          <div><dt>Last played</dt><dd>${last ? esc(last.title) : 'Not played yet'}</dd></div>
          <div><dt>Achievements</dt><dd>${totalAch()}</dd></div>
          <div><dt>Launcher</dt><dd class="accent-text">v0.1 · Beta</dd></div>
        </dl>
        <button class="btn secondary block" data-route="${GAMES.length ? 'library' : 'store'}">${GAMES.length ? 'Open library' : 'Browse store'}</button>
      </div>
    </section>

    ${recent.length ? `
    <section>
      <div class="sec-head"><h2>${last ? 'Continue playing' : 'Your games'}</h2><a data-route="library">View library</a></div>
      <div class="shelf">${recent.slice(0, 6).map((x) => tile(x)).join('')}</div>
    </section>` : ''}

    ${CAT.news.length || soon.length ? `<section class="split ${CAT.news.length && soon.length ? '' : 'single'}">
      ${CAT.news.length ? `<div>
        <div class="sec-head"><h2>What's new</h2></div>
        <div class="news">${CAT.news.map((n) => `
          <article class="news-item" ${byId[n.game] ? `data-game="${n.game}"` : ''}>
            <div class="news-art">${n.image ? `<img src="${esc(n.image)}" alt="">` : byId[n.game] ? (byId[n.game].banner ? `<img src="${esc(byId[n.game].banner)}" alt="" data-fb="${n.game}" data-fb-kind="banner">` : SpectraArt.svg(byId[n.game], { w: 200, h: 120, seed: 'n' })) : `<img src="../Assets/spectra-logo-dark.png" alt="">`}</div>
            <div><span class="pill info">${esc(n.tag)}</span><h4>${esc(n.title)}</h4><p>${esc(n.body)}</p><time>${fmtDate(n.date)}</time></div>
          </article>`).join('')}
        </div>
      </div>` : ''}
      ${soon.length ? `<div>
        <div class="sec-head"><h2>Coming to Spectra</h2><a data-route="store">Store</a></div>
        <div class="soon-list">${soon.map((x) => `
          <div class="soon-item" data-game="${x.id}">
            ${cover(x, 'sm')}
            <div><h4>${esc(x.title)}</h4><p>${esc(x.tagline)}</p>${statusPill(x)}</div>
          </div>`).join('')}
        </div>
      </div>` : ''}
    </section>` : ''}`;
  };

  function tile(g) {
    const d = dlOf(g.id);
    const pct = d && d.total ? (d.received / d.total) * 100 : 0;
    return `<div class="tile" data-game="${g.id}">
      ${cover(g)}
      ${d ? `<div class="tile-bar"><i style="width:${pct}%"></i></div>` : ''}
      <div class="tile-hover">${installed(g.id) && !rt.running.has(g.id) ? `<button class="round-play" data-action="play" data-id="${g.id}">${icon.play}</button>` : ''}</div>
      <div class="tile-meta"><b>${esc(g.title)}</b><span>${rt.running.has(g.id) ? '<i class="live"></i>Running' : installed(g.id) ? fmtTime(state.playtime[g.id]) === '—' ? 'Ready to play' : fmtTime(state.playtime[g.id]) + ' played' : d ? 'Installing…' : owned(g.id) ? 'Not installed' : STATUS[g.status].label}</span></div>
    </div>`;
  }

  views.store = () => {
    const genres = [...new Set(GAMES.flatMap((g) => g.genres))];
    const sel = rt.storeGenre || 'All';
    const list = GAMES.filter((g) => sel === 'All' || g.genres.includes(sel));
    const play = list.filter(playable), soon = list.filter((g) => !playable(g));
    const f = GAMES.find((g) => g.featured && !owned(g.id)) || GAMES[0];
    if (!f) return `
    <div class="page-head"><h1>Store</h1><p class="muted">Every game made by Spectra.</p></div>
    <div class="empty-state">${icon.grid}<h3>${rt.catalogError ? "Couldn't reach the game server" : 'No games yet'}</h3>
      <p class="muted">${rt.catalogError ? esc(rt.catalogError) : catalogUrl() ? 'Spectra games will show up here when they release.' : 'Set your game server address in Settings to load the catalogue.'}</p>
      <div class="row gap"><button class="btn primary" data-action="refresh">Check again</button><button class="btn ghost" data-route="settings">Settings</button></div>
    </div>`;
    return `
    <div class="page-head"><h1>Store</h1><p class="muted">Every game made by Spectra. All free while we're growing.</p></div>
    <div class="store-feature" data-game="${f.id}">
      ${banner(f, 'store')}
      <div class="hero-shade side"></div>
      <div class="sf-body">
        <span class="eyebrow">Featured · ${statusPill(f)}</span>
        <h2>${esc(f.title)}</h2>
        <p>${esc(f.description)}</p>
        <div class="row gap">${primaryBtn(f, 'lg')}<button class="btn secondary lg" data-game="${f.id}">Learn more</button></div>
      </div>
    </div>
    <div class="chips">${['All', ...genres].map((x) => `<button class="chip ${x === sel ? 'on' : ''}" data-action="genre" data-genre="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    ${play.length ? `<div class="sec-head"><h2>Play now</h2></div><div class="store-grid">${play.map(storeCard).join('')}</div>` : ''}
    ${soon.length ? `<div class="sec-head"><h2>Coming soon</h2></div><div class="store-grid">${soon.map(storeCard).join('')}</div>` : ''}
    ${!list.length ? '<p class="muted empty">No games in this genre yet.</p>' : ''}`;
  };

  function storeCard(g) {
    return `<div class="store-card" data-game="${g.id}">
      ${cover(g)}
      <div class="sc-body">
        <div class="row between"><b>${esc(g.title)}</b>${statusPill(g)}</div>
        <p>${esc(g.tagline)}</p>
        <div class="row between"><span class="muted small">${g.genres.join(' · ')}</span><span class="price">${owned(g.id) ? 'In library' : playable(g) ? 'Free' : fmtDate(g.released)}</span></div>
      </div>
    </div>`;
  }

  views.library = () => {
    const ui = state.ui, F = rt.libFilter;
    let list = state.owned.map((id) => byId[id]).filter(Boolean);
    if (ui.libTab === 'favorites') list = list.filter((g) => state.favorites.includes(g.id));
    if (ui.libTab === 'installed' || F.installed) list = list.filter((g) => installed(g.id));
    if (F.q) list = list.filter((g) => g.title.toLowerCase().includes(F.q.toLowerCase()));
    if (F.genres.size) list = list.filter((g) => g.genres.some((x) => F.genres.has(x)));
    const sorters = {
      recent: (a, b) => (state.lastPlayed[b.id] || 0) - (state.lastPlayed[a.id] || 0) || a.title.localeCompare(b.title),
      az: (a, b) => a.title.localeCompare(b.title),
      playtime: (a, b) => (state.playtime[b.id] || 0) - (state.playtime[a.id] || 0),
      size: (a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0),
    };
    list.sort(sorters[ui.libSort]);
    const sortLabels = { recent: 'Recently Played', az: 'Alphabetical A–Z', playtime: 'Time Played', size: 'Size' };
    const ownedGames = state.owned.map((id) => byId[id]).filter(Boolean);
    const genres = [...new Set(ownedGames.flatMap((g) => g.genres))];
    const instCount = ownedGames.filter((g) => installed(g.id)).length;

    const body = !list.length
      ? `<div class="empty-state">${icon.grid}<h3>${state.owned.length ? 'No games match' : 'Your library is empty'}</h3><p class="muted">${state.owned.length ? 'Try clearing filters.' : GAMES.length ? 'Grab a free game from the store.' : 'No Spectra games have been released yet.'}</p><button class="btn primary" data-route="store">Browse store</button></div>`
      : ui.libView === 'grid'
        ? `<div class="lib-grid">${list.map(tile).join('')}</div>`
        : `<div class="lib-table">
            <div class="lt-head"><span>Title</span><span>Achievements</span><span>Status</span><span>Time Played</span><span>Size</span><span></span></div>
            ${list.map((g) => {
              const total = g.achievements.length, got = achCount(g);
              const d = dlOf(g.id);
              return `<div class="lt-row" data-game="${g.id}">
                <div class="lt-title">${cover(g, 'xs')}<div><b>${esc(g.title)}</b>${libAction(g)}</div></div>
                <div>${total ? `<div class="ach-bar" title="${got}/${total}"><i style="width:${(got / total) * 100}%"></i></div>` : '<span class="muted">–</span>'}</div>
                <div>${rt.running.has(g.id) ? '<span class="live-text"><i class="live"></i>Running</span>' : d ? `<span class="muted">${d.started ? Math.floor((d.received / d.total) * 100) + '%' : 'Queued'}</span>` : statusPill(g)}</div>
                <div>${fmtTime(state.playtime[g.id])}</div>
                <div>${installed(g.id) ? fmtBytes(g.sizeBytes) : '<span class="muted">–</span>'}</div>
                <div><button class="icon-btn" data-action="menu" data-id="${g.id}" title="More">${icon.more}</button></div>
              </div>`;
            }).join('')}
          </div>`;

    return `
    <div class="page-head row between">
      <div class="row gap"><h1>Library</h1><button class="icon-btn" data-action="refresh" title="Refresh">${icon.refresh}</button></div>
    </div>
    <div class="tabs">
      ${['all', 'favorites', 'installed'].map((t) => `<button class="tab ${ui.libTab === t ? 'on' : ''}" data-action="libtab" data-tab="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
    </div>
    <div class="lib-wrap">
      <div class="lib-main">
        <div class="lib-tools row between">
          <div class="sort"><span class="muted">Sort by:</span>
            <button class="dropdown" data-action="sortmenu">${sortLabels[ui.libSort]} ${icon.chevron}</button>
          </div>
          <div class="seg">
            <button class="${ui.libView === 'grid' ? 'on' : ''}" data-action="libview" data-view="grid" title="Grid">${icon.grid}</button>
            <button class="${ui.libView === 'list' ? 'on' : ''}" data-action="libview" data-view="list" title="List">${icon.list}</button>
          </div>
        </div>
        ${body}
      </div>
      <aside class="filters card">
        <h3>Filters</h3>
        <label class="search sm"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg><input id="libSearch" placeholder="Title" value="${esc(F.q)}"></label>
        <label class="check"><input type="checkbox" data-action="f-installed" ${F.installed ? 'checked' : ''}><span>Installed (${instCount})</span></label>
        <div class="f-group"><div class="f-label">Genre</div>
          ${genres.map((x) => `<label class="check"><input type="checkbox" data-action="f-genre" data-genre="${esc(x)}" ${F.genres.has(x) ? 'checked' : ''}><span>${esc(x)}</span></label>`).join('')}
        </div>
        <div class="f-group"><div class="f-label">Platform</div><label class="check"><input type="checkbox" checked disabled><span>Windows</span></label></div>
        ${F.q || F.installed || F.genres.size ? '<button class="btn ghost block" data-action="f-clear">Clear filters</button>' : ''}
      </aside>
    </div>`;
  };

  function libAction(g) {
    if (rt.running.has(g.id)) return `<a class="mini-act" data-action="stop" data-id="${g.id}">${icon.stop} Stop</a>`;
    if (dlOf(g.id)) return `<a class="mini-act" data-route="downloads">${icon.dl} Installing</a>`;
    if (installed(g.id)) return `<a class="mini-act" data-action="play" data-id="${g.id}">${icon.play} Launch</a>`;
    if (playable(g)) return `<a class="mini-act" data-action="install" data-id="${g.id}">${icon.dl} Install</a>`;
    return `<span class="mini-act muted">${STATUS[g.status].label}</span>`;
  }

  views.game = ({ id }) => {
    const g = byId[id];
    if (!g) return '<p class="empty muted">Game not found.</p>';
    const fav = state.favorites.includes(g.id);
    const amap = achMap(g.id);
    const gotN = achCount(g);
    const tab = rt.gameTab;
    const tabs = [['overview', 'Overview'], ['achievements', `Achievements${g.achievements.length ? ` ${gotN}/${g.achievements.length}` : ''}`], ['patch', 'Patch notes']];
    let content = '';
    if (tab === 'overview') {
      content = `
        <p class="lead">${esc(g.description)}</p>
        <div class="shots">${[1, 2, 3].map((n) => `<div class="shot">${SpectraArt.svg(g, { w: 640, h: 360, seed: 's' + n })}</div>`).join('')}</div>
        <h3>Features</h3>
        <ul class="features">${g.features.map((f) => `<li>${icon.check}<span>${esc(f)}</span></li>`).join('')}</ul>`;
    } else if (tab === 'achievements') {
      const sorted = [...g.achievements].sort((a, b) => (amap[b.id] ? 1 : 0) - (amap[a.id] ? 1 : 0) || (amap[b.id] || 0) - (amap[a.id] || 0));
      content = g.achievements.length
        ? `<div class="ach-summary"><div class="ach-bar lg"><i style="width:${(gotN / g.achievements.length) * 100}%"></i></div><span>${gotN} of ${g.achievements.length} unlocked</span></div>
           <div class="ach-list">${sorted.map((a) => {
             const at = amap[a.id];
             const secret = a.hidden && !at;
             const ico = a.icon && !secret ? `<img src="${esc(a.icon)}" alt="">` : at ? icon.trophy : icon.lock;
             return `<div class="ach ${at ? 'on' : ''}"><div class="ach-ico">${ico}</div>
               <div><b>${secret ? 'Hidden achievement' : esc(a.name)}</b><p>${secret ? 'Keep playing to find out.' : esc(a.desc)}</p></div>
               ${at ? `<span class="ach-date">Unlocked<br>${new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>` : ''}</div>`;
           }).join('')}</div>`
        : '<p class="muted">This game has no achievements.</p>';
    } else {
      content = g.patchNotes.length
        ? g.patchNotes.map((p) => `<div class="patch"><div class="row between"><b>Version ${esc(p.version)}</b><time class="muted">${fmtDate(p.date)}</time></div><ul>${p.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`).join('')
        : '<p class="muted">No patch notes yet — this game hasn\'t shipped a build.</p>';
    }
    return `
    <div class="game-hero">
      ${banner(g)}
      <div class="hero-shade"></div>
      <div class="gh-body">
        <div class="eyebrow">${statusPill(g)} <span>Spectra Studios</span></div>
        <h1>${esc(g.title)}</h1>
        <p class="tagline">${esc(g.tagline)}</p>
        <div class="row gap">
          ${primaryBtn(g, 'lg')}
          ${owned(g.id) ? `<button class="icon-btn big ${fav ? 'on' : ''}" data-action="fav" data-id="${g.id}" title="${fav ? 'Unfavorite' : 'Favorite'}">${icon.star}</button>` : ''}
          ${owned(g.id) ? `<button class="icon-btn big" data-action="menu" data-id="${g.id}" title="More">${icon.more}</button>` : ''}
        </div>
      </div>
    </div>
    <div class="game-body">
      <div>
        <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-action="gametab" data-tab="${k}">${l}</button>`).join('')}</div>
        <div class="game-content">${content}</div>
      </div>
      <aside class="card info">
        <dl>
          <div><dt>Status</dt><dd>${STATUS[g.status].label}</dd></div>
          <div><dt>Version</dt><dd>${esc(g.version || '—')}</dd></div>
          <div><dt>Release</dt><dd>${fmtDate(g.released)}</dd></div>
          <div><dt>Size</dt><dd>${fmtBytes(g.sizeBytes)}</dd></div>
          <div><dt>Time played</dt><dd>${fmtTime(state.playtime[g.id])}</dd></div>
          <div><dt>Last played</dt><dd>${fmtAgo(state.lastPlayed[g.id])}</dd></div>
          <div><dt>Genre</dt><dd>${g.genres.join(', ')}</dd></div>
          <div><dt>Platform</dt><dd>${g.platforms.join(', ')}</dd></div>
          <div><dt>Developer</dt><dd>Spectra Studios</dd></div>
          <div><dt>Price</dt><dd class="accent-text">Free</dd></div>
        </dl>
      </aside>
    </div>`;
  };

  views.downloads = () => {
    const [active, ...queued] = rt.queue;
    const row = (d, isActive) => {
      const g = byId[d.id];
      const pct = d.total ? (d.received / d.total) * 100 : 0;
      const eta = d.speed && !d.paused ? (d.total - d.received) / d.speed : 0;
      return `<div class="dl-row ${isActive ? 'active' : ''}">
        <div data-game="${g.id}">${cover(g, isActive ? 'md' : 'xs')}</div>
        <div class="dl-info">
          <div class="row between"><b>${esc(g.title)}</b><span class="muted small">${isActive ? (d.paused ? 'Paused' : d.started ? 'Downloading' : 'Starting…') : 'Queued'}</span></div>
          ${isActive ? `<div class="bar"><i style="width:${pct}%"></i></div>
          <div class="row between small muted"><span>${fmtBytes(d.received)} / ${fmtBytes(d.total)}</span><span>${d.paused ? '—' : fmtBytes(d.speed) + '/s'} · ${eta ? fmtTime(Math.ceil(eta)) + ' left' : '—'}</span></div>` : `<span class="muted small">${fmtBytes(d.total || g.sizeBytes)}</span>`}
        </div>
        <div class="row gap">
          ${isActive && !d.real ? `<button class="icon-btn" data-action="${d.paused ? 'resume' : 'pause'}" data-id="${g.id}" title="${d.paused ? 'Resume' : 'Pause'}">${d.paused ? icon.play : icon.pause}</button>` : ''}
          <button class="icon-btn" data-action="cancel" data-id="${g.id}" title="Cancel">${icon.x}</button>
        </div>
      </div>`;
    };
    return `
    <div class="page-head"><h1>Downloads</h1></div>
    ${active ? `<div class="card dl-card">${row(active, true)}</div>` : `<div class="card empty-state slim">${icon.dl}<h3>Nothing downloading</h3><p class="muted">Games you install show up here.</p></div>`}
    ${queued.length ? `<div class="sec-head"><h2>Up next</h2></div><div class="card">${queued.map((d) => row(d, false)).join('')}</div>` : ''}
    ${state.completed.length ? `<div class="sec-head"><h2>Completed</h2><a data-action="clear-completed">Clear</a></div>
      <div class="card">${state.completed.slice().reverse().map((c) => { const g = byId[c.id]; return g ? `<div class="dl-row"><div data-game="${g.id}">${cover(g, 'xs')}</div><div class="dl-info"><b>${esc(g.title)}</b><span class="muted small">Installed ${fmtAgo(c.at)} · ${fmtBytes(g.sizeBytes)}</span></div>${installed(g.id) ? primaryBtn(g, 'sm') : '<span class="muted small">Uninstalled</span>'}</div>` : ''; }).join('')}</div>` : ''}`;
  };

  views.settings = () => {
    const s = state.settings;
    const accents = ['#927dff', '#5ec8ff', '#5ee8a4', '#f2f27a', '#ffb35c', '#ff5e8e'];
    return `
    <div class="page-head"><h1>Settings</h1></div>
    <div class="settings">
      <section class="card">
        <h3>Account</h3>
        <div class="set-row"><div><b>Display name</b><p class="muted">Shown in the title bar and on your profile.</p></div><input class="input" id="setName" maxlength="24" value="${esc(state.profile.name)}"></div>
      </section>
      <section class="card">
        <h3>Updates</h3>
        <div class="set-row"><div><b>Spectra Launcher v${esc(rt.info.version)}</b><p class="muted">${updateText()}</p></div>
          <div class="row gap">${rt.update?.state === 'ready'
            ? '<button class="btn primary" data-action="update-install">Restart to update</button>'
            : `<button class="btn secondary" data-action="update-check" ${['checking', 'downloading', 'dev'].includes(rt.update?.state) ? 'disabled' : ''}>Check for updates</button>`}</div></div>
        ${rt.update?.notes && ['ready', 'downloading'].includes(rt.update.state) ? `<div class="set-row"><div><b>What's new in v${esc(rt.update.version)}</b><p class="muted pre">${esc(rt.update.notes)}</p></div></div>` : ''}
      </section>
      <section class="card">
        <h3>Game server</h3>
        <div class="set-row"><div><b>Catalogue URL</b><p class="muted">Where the launcher gets the list of Spectra games. ${rt.catalogError ? `<span class="err-text">Error: ${esc(rt.catalogError)}</span>` : catalogUrl() ? `<span class="ok-text">Connected · ${GAMES.length} game${GAMES.length === 1 ? '' : 's'}</span>` : 'Not set.'}</p></div>
          <div class="row gap"><input class="input wide" id="setServer" placeholder="https://your-server.com/catalog.json" value="${esc(state.settings.catalogUrl || CONFIG.catalogUrl || '')}"><button class="btn secondary" data-action="save-server">Save</button></div></div>
      </section>
      <section class="card">
        <h3>Downloads</h3>
        <div class="set-row"><div><b>Install location</b><p class="muted mono">${esc(s.installRoot || rt.info.defaultInstallRoot)}</p></div><button class="btn secondary" data-action="choose-folder">${icon.folder} Change</button></div>
      </section>
      <section class="card">
        <h3>Launching</h3>
        <div class="set-row"><div><b>Minimize launcher while playing</b><p class="muted">Restores when the game closes.</p></div>${toggle('minimizeOnLaunch')}</div>
      </section>
      <section class="card">
        <h3>Appearance</h3>
        <div class="set-row"><div><b>Accent colour</b><p class="muted">Pick a band of the spectrum.</p></div>
          <div class="swatches">${accents.map((c) => `<button class="swatch ${s.accent === c ? 'on' : ''}" style="--c:${c}" data-action="accent" data-c="${c}"></button>`).join('')}</div></div>
        <div class="set-row"><div><b>Reduce motion</b><p class="muted">Turns off animations and the hero carousel.</p></div>${toggle('reduceMotion')}</div>
      </section>
      <section class="card">
        <h3>Data</h3>
        <div class="set-row"><div><b>Reset launcher</b><p class="muted">Clears library, playtime and settings. Installed game files are not deleted.</p></div><button class="btn danger" data-action="reset">Reset</button></div>
      </section>
      <p class="muted small about"><img src="../Assets/icon.png" alt=""> Spectra Launcher v${esc(rt.info.version)} · ${api.isDesktop ? 'Desktop' : 'Browser preview'}</p>
    </div>`;
  };
  function updateText() {
    const u = rt.update || {};
    switch (u.state) {
      case 'dev': return 'Updates are checked in the installed app (not when running with npm start).';
      case 'checking': return 'Checking for updates…';
      case 'downloading': return `Downloading v${esc(u.version || '')}… ${u.percent || 0}%`;
      case 'ready': return `<span class="ok-text">v${esc(u.version)} is ready.</span> Restart to install it, or it installs next time you close the launcher.`;
      case 'none': return `<span class="ok-text">You're up to date.</span> Checked ${fmtAgo(u.checkedAt)}.`;
      case 'error': return `<span class="err-text">${esc(u.error)}</span>`;
      default: return 'Updates install automatically.';
    }
  }
  const toggle = (k) => `<label class="toggle"><input type="checkbox" data-action="toggle" data-k="${k}" ${state.settings[k] ? 'checked' : ''}><i></i></label>`;

  // ---------------- render ----------------
  function render(keepScroll = false) {
    const top = main.scrollTop;
    const r = rt.route;
    main.innerHTML = `<div class="view view-${r.name}">${views[r.name](r)}</div>`;
    if (keepScroll) main.scrollTop = top;
    document.querySelectorAll('.sidebar [data-route]').forEach((a) => a.classList.toggle('on', a.dataset.route === r.name));
    $('#navBack').disabled = !rt.back.length;
    $('#navFwd').disabled = !rt.fwd.length;
    const ls = $('#libSearch');
    if (ls) ls.addEventListener('input', (e) => { rt.libFilter.q = e.target.value; const pos = e.target.selectionStart; render(true); const n = $('#libSearch'); n.focus(); n.setSelectionRange(pos, pos); });
    const sn = $('#setName');
    if (sn) sn.addEventListener('change', (e) => { state.profile.name = e.target.value.trim() || 'Player'; save(); renderChrome(); toast('Display name updated'); });
    renderChrome();
  }
  const rerender = () => render(true);

  function renderChrome() {
    $('#profileName').textContent = state.profile.name;
    $('#avatar').textContent = (state.profile.name[0] || 'P').toUpperCase();
    document.documentElement.style.setProperty('--accent', state.settings.accent);
    document.body.classList.toggle('reduce-motion', !!state.settings.reduceMotion);
    const quick = state.owned.filter(installed).map((id) => byId[id]).filter(Boolean);
    $('#quickLaunch').innerHTML = quick.length
      ? quick.map((g) => `<a class="quick-item" data-game="${g.id}">${cover(g, 'q')}<span>${esc(g.title)}</span>${rt.running.has(g.id) ? '<i class="live"></i>' : `<button class="q-play" data-action="play" data-id="${g.id}" title="Play">${icon.play}</button>`}</a>`).join('')
      : '<p class="muted small side-empty">Installed games appear here.</p>';
    const b = $('#dlBadge');
    b.hidden = !rt.queue.length; b.textContent = rt.queue.length;
    const a = rt.queue[0], m = $('#miniDl');
    if (a) {
      const pct = a.total ? (a.received / a.total) * 100 : 0;
      m.hidden = false;
      m.innerHTML = `<a data-route="downloads"><div class="row between small"><b>${esc(byId[a.id].title)}</b><span>${Math.floor(pct)}%</span></div><div class="bar thin"><i style="width:${pct}%"></i></div></a>`;
    } else m.hidden = true;
    const pill = $('#updatePill'), u = rt.update || {};
    pill.hidden = !(u.state === 'ready' || u.state === 'downloading');
    pill.disabled = u.state !== 'ready';
    pill.classList.toggle('ready', u.state === 'ready');
    pill.innerHTML = u.state === 'ready' ? `${icon.refresh}<span>Restart to update</span>` : `${icon.dl}<span>Updating ${u.percent || 0}%</span>`;
    pill.title = u.state === 'ready' ? `Install Spectra Launcher v${u.version}` : `Downloading v${u.version || ''}`;
    const unread = state.notifications.some((n) => !n.read);
    $('#notifDot').hidden = !unread;
  }

  function go(name, params = {}, push = true) {
    if (push) { rt.back.push(rt.route); rt.fwd = []; }
    if (name === 'game' && rt.route.id !== params.id) rt.gameTab = 'overview';
    rt.route = { name, ...params };
    closePopups();
    render();
    main.scrollTop = 0;
  }

  // ---------------- toasts / notifications ----------------
  function toast(text, kind = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.textContent = text;
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3600);
  }
  function notify(text) {
    state.notifications.push({ text, at: Date.now(), read: false });
    state.notifications = state.notifications.slice(-30);
    save();
    renderChrome();
  }

  // ---------------- popups ----------------
  function closePopups() {
    $('#ctxMenu').hidden = true;
    $('#notifPanel').hidden = true;
    $('#searchResults').hidden = true;
  }
  function openMenu(anchor, items) {
    const m = $('#ctxMenu');
    m.innerHTML = items.map((it, i) => (it === '-' ? '<hr>' : `<button data-mi="${i}" class="${it.danger ? 'danger' : ''}">${it.icon || ''}<span>${esc(it.label)}</span></button>`)).join('');
    m.hidden = false;
    const r = anchor.getBoundingClientRect();
    const mw = 220;
    m.style.left = Math.min(window.innerWidth - mw - 8, r.right - mw) + 'px';
    m.style.top = Math.min(window.innerHeight - m.offsetHeight - 8, r.bottom + 6) + 'px';
    m.onclick = (e) => { const b = e.target.closest('[data-mi]'); if (!b) return; m.hidden = true; items[+b.dataset.mi].run(); };
  }
  function confirmModal({ title, body, ok = 'Confirm', danger = false }) {
    return new Promise((res) => {
      const m = $('#modal');
      m.innerHTML = `<div class="modal"><h3>${esc(title)}</h3><p class="muted">${esc(body)}</p><div class="row gap end"><button class="btn ghost" data-r="0">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${esc(ok)}</button></div></div>`;
      m.hidden = false;
      m.onclick = (e) => { const b = e.target.closest('[data-r]'); if (!b && e.target !== m) return; m.hidden = true; res(b ? b.dataset.r === '1' : false); };
    });
  }

  function gameMenu(anchor, g) {
    const items = [];
    if (installed(g.id)) items.push({ label: rt.running.has(g.id) ? 'Stop' : 'Play', icon: rt.running.has(g.id) ? icon.stop : icon.play, run: () => (rt.running.has(g.id) ? stopGame(g.id) : play(g.id)) });
    else if (playable(g) && !dlOf(g.id)) items.push({ label: 'Install', icon: icon.dl, run: () => install(g.id) });
    items.push({ label: state.favorites.includes(g.id) ? 'Remove from favorites' : 'Add to favorites', icon: icon.star, run: () => toggleFav(g.id) });
    items.push({ label: 'View game page', icon: icon.grid, run: () => go('game', { id: g.id }) });
    if (installed(g.id) && api.isDesktop && !state.installed[g.id].simulated) items.push({ label: 'Open install folder', icon: icon.folder, run: () => api.openPath(state.installed[g.id].dir) });
    if (installed(g.id)) items.push('-', { label: 'Uninstall', icon: icon.trash, danger: true, run: () => uninstall(g.id) });
    openMenu(anchor, items);
  }

  // ---------------- actions ----------------
  function toggleFav(id) {
    const i = state.favorites.indexOf(id);
    if (i >= 0) state.favorites.splice(i, 1); else state.favorites.push(id);
    save(); rerender();
  }

  function get(id) {
    if (!owned(id)) state.owned.push(id);
    save();
    toast(`${byId[id].title} added to your library`, 'ok');
    install(id);
  }

  function install(id) {
    const g = byId[id];
    if (!owned(id)) state.owned.push(id);
    if (installed(id) || dlOf(id)) return;
    if (api.isDesktop && !g.download) { toast(`${g.title} doesn't have a download on the server yet`, 'err'); return; }
    // In the browser preview there's no file system, so installs are simulated.
    const real = api.isDesktop;
    rt.queue.push({ id, received: 0, total: g.sizeBytes || 0, speed: 0, paused: false, real, started: false });
    save();
    toast(`${rt.queue.length > 1 ? 'Queued' : 'Installing'} ${g.title}`);
    pumpQueue();
    rerender();
  }

  async function pumpQueue() {
    const d = rt.queue[0];
    if (!d || d.started) return;
    d.started = true;
    const g = byId[d.id];
    if (d.real) {
      const r = await api.install({ id: g.id, url: g.download, root: state.settings.installRoot || rt.info.defaultInstallRoot });
      if (!rt.queue.includes(d)) return; // cancelled
      if (r.ok) finishInstall(d, { dir: r.dir });
      else { rt.queue.shift(); toast(`${g.title} failed to install: ${r.error}`, 'err'); notify(`${g.title} failed to install: ${r.error}`); rerender(); pumpQueue(); }
    }
    // simulated downloads progress via the ticker below
  }

  api.onInstallProgress(({ id, received, total }) => {
    const d = dlOf(id);
    if (!d) return;
    const now = Date.now();
    if (d.lastT) d.speed = ((received - d.received) / (now - d.lastT)) * 1000 * 0.3 + d.speed * 0.7;
    d.lastT = now; d.received = received; if (total) d.total = total;
    tickUI();
  });

  setInterval(() => {
    const d = rt.queue[0];
    if (!d || d.real || !d.started || d.paused) return;
    // simulated ~60-140 MB/s, but never faster than a 5s install so progress is visible
    if (!d.total) d.total = 200 * 1048576;
    const target = Math.min((60 + Math.random() * 80) * 1048576, d.total / 5);
    d.speed = (d.speed || target) * 0.7 + target * 0.3;
    d.received = Math.min(d.total, d.received + d.speed * 0.25);
    if (d.received >= d.total) finishInstall(d, { simulated: true });
    else tickUI();
  }, 250);

  let uiPending = false;
  function tickUI() {
    if (uiPending) return;
    uiPending = true;
    requestAnimationFrame(() => {
      uiPending = false;
      renderChrome();
      if (['downloads', 'library', 'game', 'home', 'store'].includes(rt.route.name)) {
        // light-weight progress updates without rebuilding the page
        const d = rt.queue[0];
        if (!d) return;
        const pct = d.total ? (d.received / d.total) * 100 : 0;
        if (rt.route.name === 'downloads') rerender();
        else {
          document.querySelectorAll(`.btn.progress`).forEach((b) => { b.style.setProperty('--p', pct + '%'); const s = b.querySelector('span'); if (s && b.closest(`[data-game="${d.id}"], .game-hero, .hero, .store-feature`)) s.textContent = `${d.paused ? 'Paused' : 'Installing'} ${Math.floor(pct)}%`; });
          document.querySelectorAll(`[data-game="${d.id}"] .tile-bar i`).forEach((i) => (i.style.width = pct + '%'));
        }
      }
    });
  }

  function finishInstall(d, extra = {}) {
    rt.queue = rt.queue.filter((x) => x !== d);
    const g = byId[d.id];
    state.installed[g.id] = { version: g.version, at: Date.now(), ...extra };
    state.completed.push({ id: g.id, at: Date.now() });
    state.completed = state.completed.slice(-20);
    save();
    toast(`${g.title} is ready to play`, 'ok');
    notify(`${g.title} finished installing.`);
    rerender();
    pumpQueue();
  }

  async function cancel(id) {
    const d = dlOf(id);
    if (!d) return;
    if (d.real) await api.cancelInstall(id);
    rt.queue = rt.queue.filter((x) => x !== d);
    toast(`Cancelled ${byId[id].title}`);
    rerender();
    pumpQueue();
  }

  async function uninstall(id) {
    const g = byId[id];
    const ok = await confirmModal({ title: `Uninstall ${g.title}?`, body: 'Game files will be removed. Your playtime and achievements stay in the launcher.', ok: 'Uninstall', danger: true });
    if (!ok) return;
    if (!state.installed[id].simulated) await api.uninstall({ id, root: state.settings.installRoot || rt.info.defaultInstallRoot });
    delete state.installed[id];
    save();
    toast(`${g.title} uninstalled`);
    rerender();
  }

  async function play(id) {
    const g = byId[id];
    if (rt.running.has(id)) return;
    if (state.installed[id]?.simulated) {
      toast('This is the browser preview — games can only be launched from the desktop app', 'err');
      return;
    }
    const r = await api.launch({ id, exe: g.exe, root: state.settings.installRoot || rt.info.defaultInstallRoot });
    if (!r.ok) { toast(`Couldn't launch ${g.title}: ${r.error}`, 'err'); return; }
    rt.running.add(id);
    state.lastPlayed[id] = Date.now();
    save();
    toast(`Launching ${g.title}…`);
    rerender();
    if (state.settings.minimizeOnLaunch && api.isDesktop) setTimeout(() => api.win.minimize(), 600);
  }

  function stopGame(id) { api.stop(id); }

  // live updates while a game is running (the main process watches the game's achievements file)
  api.onAchievements(({ id, ids }) => { if (mergeAchievements(id, ids, { live: true })) rerender(); });

  // pick up achievements earned while the launcher was closed (e.g. the game exe was run directly)
  async function syncAchievements() {
    const all = await api.readAllAchievements();
    let changed = 0;
    for (const [gid, ids] of Object.entries(all || {})) changed += mergeAchievements(gid, ids);
    if (changed) rerender();
  }

  api.onGameExited(({ id, seconds }) => {
    rt.running.delete(id);
    state.playtime[id] = (state.playtime[id] || 0) + seconds;
    state.lastPlayed[id] = Date.now();
    save();
    if (state.settings.minimizeOnLaunch && api.isDesktop) api.win.restore();
    rerender();
  });

  // ---------------- search ----------------
  const gs = $('#globalSearch');
  gs.addEventListener('input', () => {
    const q = gs.value.trim().toLowerCase();
    const box = $('#searchResults');
    if (!q) { box.hidden = true; return; }
    const res = GAMES.filter((g) => g.title.toLowerCase().includes(q) || g.genres.some((x) => x.toLowerCase().includes(q)));
    if (!GAMES.length) { box.innerHTML = '<p class="muted">No games released yet</p>'; box.hidden = false; return; }
    box.innerHTML = res.length
      ? res.map((g) => `<a data-game="${g.id}">${cover(g, 'xs')}<div><b>${esc(g.title)}</b><span>${g.genres.join(' · ')} · ${owned(g.id) ? 'In library' : STATUS[g.status].label}</span></div></a>`).join('')
      : '<p class="muted">No games found</p>';
    box.hidden = false;
  });
  gs.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const a = $('#searchResults [data-game]'); if (a) { go('game', { id: a.dataset.game }); gs.value = ''; gs.blur(); } }
    if (e.key === 'Escape') { gs.value = ''; closePopups(); gs.blur(); }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); gs.focus(); gs.select(); }
    if (e.key === 'Escape') closePopups();
    if (e.altKey && e.key === 'ArrowLeft') navBack();
    if (e.altKey && e.key === 'ArrowRight') navFwd();
  });

  function navBack() { if (!rt.back.length) return; rt.fwd.push(rt.route); const r = rt.back.pop(); go(r.name, r, false); }
  function navFwd() { if (!rt.fwd.length) return; rt.back.push(rt.route); const r = rt.fwd.pop(); go(r.name, r, false); }
  $('#navBack').onclick = navBack;
  $('#navFwd').onclick = navFwd;

  // ---------------- click delegation ----------------
  document.addEventListener('click', async (e) => {
    const t = e.target;
    if (!t.closest('#ctxMenu') && !t.closest('[data-action="menu"]') && !t.closest('[data-action="sortmenu"]')) $('#ctxMenu').hidden = true;
    if (!t.closest('#notifPanel') && !t.closest('#btnNotif')) $('#notifPanel').hidden = true;
    if (!t.closest('.tb-left')) $('#searchResults').hidden = true;

    const act = t.closest('[data-action]');
    if (act) {
      const id = act.dataset.id;
      const a = act.dataset.action;
      if (act.tagName === 'INPUT') {
        // checkboxes / toggles
        if (a === 'f-installed') rt.libFilter.installed = act.checked;
        if (a === 'f-genre') act.checked ? rt.libFilter.genres.add(act.dataset.genre) : rt.libFilter.genres.delete(act.dataset.genre);
        if (a === 'toggle') { state.settings[act.dataset.k] = act.checked; save(); renderChrome(); return; }
        return rerender();
      }
      e.preventDefault(); e.stopPropagation();
      switch (a) {
        case 'play': return play(id);
        case 'stop': return stopGame(id);
        case 'install': return install(id);
        case 'get': return get(id);
        case 'cancel': return cancel(id);
        case 'pause': case 'resume': { const d = dlOf(id); if (d) d.paused = a === 'pause'; return rerender(); }
        case 'wishlist': {
          const i = state.wishlist.indexOf(id);
          if (i >= 0) state.wishlist.splice(i, 1); else { state.wishlist.push(id); toast(`We'll let you know when ${byId[id].title} is out`, 'ok'); }
          save(); return rerender();
        }
        case 'fav': return toggleFav(id);
        case 'menu': return gameMenu(act, byId[id]);
        case 'hero': rt.heroIdx = +act.dataset.i; resetHero(); return rerender();
        case 'genre': rt.storeGenre = act.dataset.genre; return rerender();
        case 'libtab': state.ui.libTab = act.dataset.tab; save(); return rerender();
        case 'libview': state.ui.libView = act.dataset.view; save(); return rerender();
        case 'gametab': rt.gameTab = act.dataset.tab; return rerender();
        case 'refresh': await loadCatalog(); rerender(); return toast(rt.catalogError ? "Couldn't reach the game server" : `Catalogue updated · ${GAMES.length} game${GAMES.length === 1 ? '' : 's'}`, rt.catalogError ? 'err' : '');
        case 'save-server': {
          state.settings.catalogUrl = $('#setServer').value.trim(); save();
          await loadCatalog(); rerender();
          return toast(rt.catalogError ? `Couldn't load catalogue: ${rt.catalogError}` : `Loaded ${GAMES.length} game${GAMES.length === 1 ? '' : 's'}`, rt.catalogError ? 'err' : 'ok');
        }
        case 'f-clear': rt.libFilter = { q: '', installed: false, genres: new Set() }; return rerender();
        case 'sortmenu': {
          const opts = [['recent', 'Recently Played'], ['az', 'Alphabetical A–Z'], ['playtime', 'Time Played'], ['size', 'Size']];
          return openMenu(act, opts.map(([k, l]) => ({ label: l, icon: state.ui.libSort === k ? icon.check : '<i class="sp"></i>', run: () => { state.ui.libSort = k; save(); rerender(); } })));
        }
        case 'update-check': rt.update = await api.update.check(); return rerender();
        case 'update-install': {
          const r = await api.update.install();
          if (!r.ok) toast(r.error || "Couldn't start the update", 'err');
          return;
        }
        case 'clear-completed': state.completed = []; save(); return rerender();
        case 'accent': state.settings.accent = act.dataset.c; save(); return rerender();
        case 'choose-folder': {
          const p = await api.chooseFolder();
          if (p) { state.settings.installRoot = p; save(); rerender(); toast('Install location updated'); }
          return;
        }
        case 'reset': {
          const ok = await confirmModal({ title: 'Reset Spectra Launcher?', body: 'Your library, playtime, favorites and settings will be cleared.', ok: 'Reset', danger: true });
          if (ok) { state = structuredClone(DEFAULT); state.notifications[0].at = Date.now(); save(); go('home'); toast('Launcher reset'); }
          return;
        }
      }
      return;
    }
    const gameEl = t.closest('[data-game]');
    if (gameEl && !t.closest('button:not([data-game])')) { $('#globalSearch').value = ''; return go('game', { id: gameEl.dataset.game }); }
    const routeEl = t.closest('[data-route]');
    if (routeEl) { e.preventDefault(); return go(routeEl.dataset.route); }
  });

  // notifications
  $('#btnNotif').onclick = () => {
    const p = $('#notifPanel');
    if (!p.hidden) { p.hidden = true; return; }
    const list = state.notifications.slice().reverse();
    p.innerHTML = `<div class="row between"><h4>Notifications</h4>${list.length ? '<a data-clear-notifs>Clear all</a>' : ''}</div>` +
      (list.length ? list.map((n) => `<div class="notif ${n.read ? '' : 'unread'}"><p>${esc(n.text)}</p><time>${fmtAgo(n.at)}</time></div>`).join('') : '<p class="muted small">You\'re all caught up.</p>');
    p.hidden = false;
    state.notifications.forEach((n) => (n.read = true));
    save(); renderChrome();
    const c = p.querySelector('[data-clear-notifs]');
    if (c) c.onclick = (e) => { e.stopPropagation(); state.notifications = []; save(); p.hidden = true; renderChrome(); };
  };
  $('#profileChip').onclick = () => go('settings');

  // window controls
  if (api.isDesktop) {
    document.querySelectorAll('[data-win]').forEach((b) => (b.onclick = () => api.win[b.dataset.win]()));
  } else {
    $('#winControls').classList.add('hidden');
    document.body.classList.add('web');
  }

  // hero carousel
  let heroTimer;
  function resetHero() {
    clearInterval(heroTimer);
    heroTimer = setInterval(() => {
      if (state.settings.reduceMotion || rt.route.name !== 'home' || document.hidden) return;
      if (main.querySelector('.hero:hover')) return;
      rt.heroIdx++;
      rerender();
    }, 8000);
  }

  // refresh achievements when the launcher regains focus
  window.addEventListener('focus', () => { syncAchievements(); });

  async function loadCatalog() {
    const url = catalogUrl();
    rt.catalogError = '';
    if (!url) { setCatalog(null); return; }
    try {
      const c = await api.fetchCatalog(url);
      if (!c || !Array.isArray(c.games)) throw new Error('Catalogue has no "games" list');
      setCatalog(c);
      state.catalogCache = c;
      save();
    } catch (err) {
      rt.catalogError = err.message || String(err);
      setCatalog(state.catalogCache); // keep showing the cached library when offline
    }
  }

  // ---------------- boot ----------------
  (async function boot() {
    rt.info = await api.info();
    rt.update = await api.update.get();
    api.update.onStatus((u) => {
      const was = rt.update?.state;
      rt.update = u;
      if (u.state === 'ready' && was !== 'ready') { toast(`Launcher update v${u.version} is ready — restart to install`, 'ok'); notify(`Spectra Launcher v${u.version} is ready to install.`); }
      if (rt.route.name === 'settings') rerender(); else renderChrome();
    });
    const saved = await api.loadState();
    state = Object.assign(structuredClone(DEFAULT), saved || {});
    state.settings = Object.assign({}, DEFAULT.settings, state.settings);
    state.ui = Object.assign({}, DEFAULT.ui, state.ui);
    state.owned = state.owned.filter((id) => typeof id === 'string');
    if (state.catalogCache) setCatalog(state.catalogCache); // show last-known games straight away / offline
    render();
    await loadCatalog();
    render();
    syncAchievements();
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
    resetHero();
  })();
})();
