/* Spectra website */
(function () {
  const CFG = window.SPECTRA_SITE || {};
  const app = document.getElementById('app');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (s) => (s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBA');
  const fmtBytes = (b) => {
    if (!b) return '—';
    const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return `${b.toFixed(i < 2 || b >= 100 ? 0 : b >= 10 ? 1 : 2)} ${u[i]}`;
  };
  const STATUS = {
    available: { label: 'Available', cls: 'ok' },
    'early-access': { label: 'Early access', cls: 'ea' },
    'coming-soon': { label: 'Coming soon', cls: 'soon' },
    'in-development': { label: 'In development', cls: 'dev' },
  };
  const RAYS = SpectraArt.RAYS; // red → violet
  const playable = (g) => g.status === 'available' || g.status === 'early-access';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dlIcon = '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 19h14"/></svg>';
  const winIcon = '<svg viewBox="0 0 24 24" class="fill"><path d="M3 5.5l7.5-1v7H3zM11.5 4.3L21 3v8.5h-9.5zM3 12.5h7.5v7L3 18.5zM11.5 12.5H21V21l-9.5-1.3z"/></svg>';
  const arrow = '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  // ---------- catalogue ----------
  let GAMES = [], NEWS = [], byId = {}, loadError = '', loaded = false;
  let ANDROID = null; // the Android app (catalog.androidApp: { version, url, sizeBytes })
  // Only local previews can override the catalogue URL. A public account page
  // should never render game links or content from a URL supplied by a visitor.
  const localPreview = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const catalogUrl = (localPreview ? new URLSearchParams(location.search).get('catalog') : '') || CFG.catalogUrl || '';
  async function loadCatalog() {
    if (!catalogUrl) { loaded = true; return; }
    try {
      const r = await fetch(catalogUrl, { cache: 'no-store' });
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      const c = await r.json();
      GAMES = (Array.isArray(c.games) ? c.games : []).filter((g) => g && /^[a-z0-9-]+$/i.test(g.id || '')).map((g) => ({
        title: g.id, tagline: '', description: '', status: 'available', genres: [], platforms: ['Windows'],
        features: [], achievements: [], patchNotes: [], art: { from: '#2a1458', to: '#0b0b1a', glow: '#927dff', motif: 'prism' }, ...g,
      }));
      GAMES.forEach((g) => { if (!STATUS[g.status]) g.status = 'available'; });
      NEWS = Array.isArray(c.news) ? c.news : [];
      ANDROID = c.androidApp && c.androidApp.url ? c.androidApp : null;
      byId = Object.assign(Object.create(null), Object.fromEntries(GAMES.map((g) => [g.id, g])));
    } catch (e) { loadError = e.message; }
    loaded = true;
  }
  const glow = (g) => (g.art && /^#[0-9a-f]{6}$/i.test(g.art.glow) ? g.art.glow : '#927dff');
  const isMulti = (g) => g.features.some((f) => /multiplayer/i.test(f));
  const onAndroid = (g) => !!(g.android && g.android.download);
  const platformsOf = (g) => [...new Set([...g.platforms, ...(onAndroid(g) ? ['Android'] : [])])];
  const droidIcon = '<svg viewBox="0 0 24 24" class="fill"><path d="M7.2 8.6h9.6v7.6a1.3 1.3 0 01-1.3 1.3h-.8v2.4a1.1 1.1 0 01-2.2 0v-2.4h-1v2.4a1.1 1.1 0 01-2.2 0v-2.4h-.8a1.3 1.3 0 01-1.3-1.3zM5.4 8.9a1.1 1.1 0 012.2 0v5a1.1 1.1 0 01-2.2 0zm11 0a1.1 1.1 0 012.2 0v5a1.1 1.1 0 01-2.2 0zM8.9 4.2l-.8-1.3.4-.3.8 1.3a5.6 5.6 0 015.4 0l.8-1.3.4.3-.8 1.3A4.7 4.7 0 0117 7.9H7a4.7 4.7 0 011.9-3.7zm1 1.7a.6.6 0 100 1.2.6.6 0 000-1.2zm4.2 0a.6.6 0 100 1.2.6.6 0 000-1.2z"/></svg>';

  // ---------- art ----------
  const img = (g, kind, w, h, seed = '') => {
    const url = kind === 'cover' ? g.cover : g.banner;
    return url ? `<img src="${esc(url)}" alt="" loading="lazy" data-fb="${g.id}" data-kind="${kind}" data-w="${w}" data-h="${h}">` : SpectraArt.svg(g, { w, h, seed });
  };
  document.addEventListener('error', (e) => {
    const t = e.target;
    if (t.tagName === 'IMG' && t.dataset.fb && byId[t.dataset.fb]) t.outerHTML = SpectraArt.svg(byId[t.dataset.fb], { w: +t.dataset.w, h: +t.dataset.h });
  }, true);
  const tag = (g) => `<span class="tag ${STATUS[g.status].cls}">${STATUS[g.status].label}</span>`;
  const bandRule = '<div class="band" aria-hidden="true">' + RAYS.map((c) => `<i style="background:${c}"></i>`).join('') + '</div>';
  const label = (n, text) => `<div class="label"><em>${n}</em><span>${text}</span></div>`;
  const droidBadge = (g) => (onAndroid(g) ? `<span class="badge droid" title="Also playable on Android through Spectra for Android">${droidIcon}<span>Android</span></span>` : '');
  const fmtPlay = (s) => { s = Number(s) || 0; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${m}m` : m ? `${m}m` : s ? '<1m' : '—'; };
  const TIER_PTS = { bronze: 1, silver: 2, gold: 3, platinum: 5 };
  // "Notify me": for anything that isn't out yet. An email, once, the day it releases
  function notifyBox(g) {
    const done = (() => { try { return localStorage.getItem('spectra-notify-' + g.id) === '1'; } catch { return false; } })();
    if (done) return `<p class="notify-done">${'✓'} You’re on the list for ${esc(g.title)}. We’ll email you once, the day it releases.</p>`;
    return `<form class="notify" data-notify="${esc(g.id)}" novalidate>
      <label class="sr" for="nm-${esc(g.id)}">Email for ${esc(g.title)} release news</label>
      <input id="nm-${esc(g.id)}" type="email" name="email" required maxlength="254" placeholder="you@example.com" autocomplete="email">
      <button class="btn solid" type="submit">Notify me</button>
      <p class="fine notify-msg" aria-live="polite">One email, the day ${esc(g.title)} releases. Nothing else.</p>
    </form>`;
  }

  // ---------- download ----------
  const dlHref = () => CFG.downloadUrl || '#/download';
  const dlBtn = (cls = 'lg') => CFG.downloadUrl
    ? `<a class="btn solid ${cls}" href="${esc(CFG.downloadUrl)}" download>${winIcon}<span>Download for Windows</span></a>`
    : `<a class="btn solid ${cls}" href="#/download">${dlIcon}<span>Download launcher</span></a>`;

  // ---------- the game index (editorial list) ----------
  function indexRow(g, i) {
    return `<a class="irow" href="#/game/${g.id}" style="--g:${glow(g)}">
      <span class="i-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="i-title">${esc(g.title)}</span>
      <span class="i-meta"><span>${g.genres.map(esc).join(' / ') || '—'}</span>${isMulti(g) ? '<span>1–4 players</span>' : ''}${onAndroid(g) ? '<span>PC + Android</span>' : ''}</span>
      <span class="i-status">${tag(g)}${!playable(g) ? '<span class="i-bell" title="Notify me on its page">🔔</span>' : ''}</span>
      <span class="i-go">${arrow}</span>
      <span class="i-art" aria-hidden="true">${img(g, 'banner', 640, 300, 'i')}</span>
    </a>`;
  }
  const emptyIndex = () => `<div class="empty">
      <p class="empty-big">${loadError ? 'The light didn’t make it.' : 'The bench is empty.'}</p>
      <p class="muted">${loadError ? "Couldn't load the game list. Try again in a moment." : "Spectra's first games are on the way. Get the launcher and they'll show up there the day they release."}</p>
    </div>`;

  // ---------- launcher mock (mirrors the real app) ----------
  function launcherMock() {
    const g = GAMES[0];
    const cover = g ? img(g, 'cover', 150, 200, 'm') : '';
    return `<div class="mock" id="mock" data-focus="install">
      <div class="m-bar"><i></i><i></i><i></i><span class="m-search">Search Spectra games</span><span class="m-chip"><b>A</b>Alex<i class="m-dot"></i></span></div>
      <div class="m-body">
        <div class="m-side">
          <div class="m-brand"><img src="assets/spectra-logo.svg" alt=""><b>Spectra</b></div>
          <span class="m-nav on">Home</span><span class="m-nav">Store</span><span class="m-nav">Library</span><span class="m-nav">Downloads</span><span class="m-nav m-friends">Friends <em>2</em></span>
        </div>
        <div class="m-main">
          <div class="m-hero">${g ? img(g, 'banner', 800, 340, 'm') : ''}<div class="m-hero-txt"><b>${g ? esc(g.title) : 'Spectra'}</b><span class="m-play">▶ Play</span><span class="m-upd">Update</span></div></div>
          <div class="m-row">
            <div class="m-tile">${cover}<span class="m-bar-dl"><i></i></span></div>
            <div class="m-stats"><div><small>PLAYTIME</small><b>14h 32m</b></div><div><small>ACHIEVEMENTS</small><b>11 / 15</b></div><div class="m-ach">🏆 Riftbreaker unlocked</div></div>
            <div class="m-fr">
              <div><b style="background:#ff5e8e">C</b><span>Cara<small class="p">Playing ${g ? esc(g.title) : 'a game'}</small></span></div>
              <div><b style="background:#ffb35c">B</b><span>Bob<small class="o">Online</small></span></div>
              <div class="m-invite"><span>Cara invited you</span><i>Join</i></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }
  const TOUR = [
    ['install', 'One click in', 'Pick a game, press Install. The launcher downloads it, sets it up and drops it in your library.'],
    ['update', 'Always the newest build', 'New versions land in the launcher automatically. If a game has an update, it tells you and swaps it in for you.'],
    ['track', 'Everything counted', 'Playtime, achievements and patch notes for every game, in one place. Achievements pop up the moment you earn them.'],
    ['friends', 'Bring people', 'A free Spectra account syncs your library across PCs, gives you a profile and a friends list, and lets you invite friends straight into a game.'],
  ];

  // ---------- pages ----------
  const pages = {};

  pages.home = () => {
    const lead = GAMES.find((g) => g.featured && playable(g)) || GAMES.find(playable) || GAMES[0];
    return `
    <section class="hero">
      <canvas class="beam" id="beam" aria-hidden="true"></canvas>
      <div class="wrap hero-in">
        <div class="hero-copy">
          ${label('00', 'An independent games studio')}
          <h1><span class="h-line">Light goes in.</span><span class="h-line h-out">Games come out.</span></h1>
          <p class="lead">Spectra is a tiny studio making bright, fast, slightly unhinged games, plus the free launcher you play them in.</p>
          <div class="row gap wrap-row">${dlBtn()}<a class="btn line lg" href="#/games">See the games ${arrow}</a></div>
          <p class="fine">Windows 10 / 11 · ${esc(CFG.launcherSize)} · v${esc(CFG.launcherVersion)} · free</p>
        </div>
      </div>
      ${lead ? `<a class="now" href="#/game/${lead.id}" style="--g:${glow(lead)}"><span class="now-dot"></span><span>Now playing</span><b>${esc(lead.title)}</b>${arrow}</a>` : ''}
    </section>

    ${bandRule}

    <section class="wrap sec">
      <div class="sec-head">${label('01', 'The spectrum')}<h2>Everything we’ve made</h2></div>
      ${GAMES.length ? `<div class="index">${GAMES.map(indexRow).join('')}</div>` : emptyIndex()}
    </section>

    ${lead ? spotlight(lead) : ''}

    <section class="wrap sec tour-sec">
      <div class="sec-head">${label('03', 'The launcher')}<h2>One small app. Every game.</h2></div>
      <div class="tour">
        <div class="tour-steps" role="tablist">
          ${TOUR.map(([k, t, d], i) => `<button class="tstep ${i === 0 ? 'on' : ''}" data-tour="${k}" role="tab" style="--c:${RAYS[(i * 2 + 1) % RAYS.length]}"><em>${String(i + 1).padStart(2, '0')}</em><b>${t}</b><p>${d}</p></button>`).join('')}
        </div>
        <div class="tour-view">${launcherMock()}</div>
      </div>
    </section>

    ${NEWS.length ? `<section class="wrap sec">
      <div class="sec-head">${label('04', 'Dispatches')}<h2>Latest</h2></div>
      <div class="dispatch">${NEWS.slice(0, 3).map((n) => {
        const g = byId[n.game];
        return `<${g ? `a href="#/game/${g.id}"` : 'div'} class="disp">
          <time>${fmtDate(n.date)}</time><span class="tag info">${esc(n.tag || 'News')}</span><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p>
        </${g ? 'a' : 'div'}>`;
      }).join('')}</div>
    </section>` : ''}

    <section class="wrap sec">${ticket()}${ANDROID ? `<a class="also" href="#/download">${droidIcon}<span>Also on Android: <b>Spectra for Android</b></span>${arrow}</a>` : ''}</section>`;
  };

  // featured game as a spec sheet
  function spotlight(g) {
    const rows = [
      ['Genre', g.genres.join(' / ') || '—'],
      ['Players', isMulti(g) ? '1 · or 2–4 online' : '1'],
      ['Platforms', platformsOf(g).join(' · ')],
      ['Status', STATUS[g.status].label],
      ['Version', g.version ? `${g.version}${g.build != null ? ` · build ${g.build}` : ''}` : '—'],
      ['Size', fmtBytes(g.sizeBytes)],
      ['Achievements', String(g.achievements.filter((a) => !a.secret).length || '—')],
      ['Price', 'Free'],
    ];
    return `<section class="spot" style="--g:${glow(g)}">
      <div class="wrap">
        <div class="sec-head">${label('02', 'On the bench')}<h2>${esc(g.title)}</h2></div>
        <div class="spot-grid">
          <a class="spot-art" href="#/game/${g.id}">${img(g, 'banner', 1400, 620, 's')}<span class="spot-tagline">${esc(g.tagline)}</span></a>
          <dl class="spec">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        </div>
        ${g.features.length ? `<ol class="feats">${g.features.slice(0, 6).map((f) => `<li>${esc(f)}</li>`).join('')}</ol>` : ''}
        <div class="row gap wrap-row spot-cta"><a class="btn line" href="#/game/${g.id}">Full spec sheet ${arrow}</a>${playable(g) ? dlBtn('') : ''}</div>
      </div>
    </section>`;
  }

  // download as a ticket
  function ticket() {
    return `<div class="ticket">
      <div class="t-main">
        ${label('→', 'Admit one')}
        <h2>Spectra Launcher</h2>
        <p class="muted">Install it once. Every Spectra game is one click away after that.</p>
        <div class="row gap wrap-row">${CFG.downloadUrl ? dlBtn() : `<span class="btn line lg static">${dlIcon}<span>Coming soon</span></span>`}</div>
      </div>
      <div class="t-stub">
        <dl>
          <div><dt>Version</dt><dd>${esc(CFG.launcherVersion)}</dd></div>
          <div><dt>Size</dt><dd>${esc(CFG.launcherSize)}</dd></div>
          <div><dt>System</dt><dd>Windows 10 / 11</dd></div>
          <div><dt>Price</dt><dd>Free</dd></div>
        </dl>
        <div class="t-code" aria-hidden="true">${RAYS.concat(RAYS).map((c, i) => `<i style="background:${c};width:${[3, 6, 2, 4, 8, 3, 5, 2, 7, 3, 4, 6][i]}px"></i>`).join('')}</div>
      </div>
    </div>`;
  }

  // the Android app as a second ticket (dark)
  function androidDownload(label, style) {
    if (!ANDROID) return '';
    return `<a class="btn ${style} lg" href="${esc(ANDROID.url)}" download>${droidIcon}<span>${label}</span></a>`;
  }
  function androidTicket() {
    return `<div class="ticket dark" id="android">
      <div class="t-main">
        ${label(droidIcon, 'Pocket edition')}
        <h2>Spectra for Android</h2>
        <p class="muted">The launcher on your phone: your library, friends and achievements, and games marked <b>Android</b> to play on the go, online with PC players too.</p>
        <div class="row gap wrap-row">${androidDownload('Download APK', 'solid') || `<span class="btn line lg static">${droidIcon}<span>Coming soon</span></span>`}</div>
        ${ANDROID ? '<p class="fine">Open the APK on your phone to install it. Android asks you to allow installing apps from your browser the first time.</p>' : ''}
      </div>
      <div class="t-stub">
        <dl>
          <div><dt>Version</dt><dd>${ANDROID ? esc(ANDROID.version) : '—'}</dd></div>
          <div><dt>Size</dt><dd>${ANDROID && ANDROID.sizeBytes ? fmtBytes(ANDROID.sizeBytes) : '—'}</dd></div>
          <div><dt>System</dt><dd>Android 7+</dd></div>
          <div><dt>Price</dt><dd>Free</dd></div>
        </dl>
        <div class="t-code" aria-hidden="true">${RAYS.concat(RAYS).reverse().map((c, i) => `<i style="background:${c};width:${[3, 6, 2, 4, 8, 3, 5, 2, 7, 3, 4, 6][i]}px"></i>`).join('')}</div>
      </div>
    </div>`;
  }

  let gFilter = { q: '', genre: 'All', status: 'all', android: false };
  pages.games = () => {
    const genres = ['All', ...new Set(GAMES.flatMap((g) => g.genres))];
    return `
    <section class="wrap page-head">
      ${label('02', 'The spectrum')}
      <h1>All games</h1>
      <p class="lead">Everything Spectra has made or is making. Install and play them through the Spectra Launcher.</p>
    </section>
    <section class="wrap">
      ${GAMES.length ? `
      <div class="toolbar">
        <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg><input id="gq" placeholder="Search" value="${esc(gFilter.q)}" aria-label="Search games"></label>
        <div class="chips">${genres.map((x) => `<button class="chip ${gFilter.genre === x ? 'on' : ''}" data-genre="${esc(x)}">${esc(x)}</button>`).join('')}</div>
        <div class="chips">${[['all', 'Any'], ['playable', 'Playable now'], ['upcoming', 'Upcoming']].map(([k, l]) => `<button class="chip ${gFilter.status === k ? 'on' : ''}" data-status="${k}">${l}</button>`).join('')}</div>
        ${GAMES.some(onAndroid) ? `<div class="chips"><button class="chip ${gFilter.android ? 'on' : ''}" data-android>On Android</button></div>` : ''}
      </div>
      <div id="gameGrid"></div>` : emptyIndex()}
    </section>`;
  };
  function renderGrid() {
    const el = document.getElementById('gameGrid');
    if (!el) return;
    const list = GAMES.filter((g) =>
      (!gFilter.q || g.title.toLowerCase().includes(gFilter.q.toLowerCase())) &&
      (gFilter.genre === 'All' || g.genres.includes(gFilter.genre)) &&
      (gFilter.status === 'all' || (gFilter.status === 'playable' ? playable(g) : !playable(g))) &&
      (!gFilter.android || onAndroid(g)));
    el.innerHTML = list.length ? `<div class="index">${list.map((g) => indexRow(g, GAMES.indexOf(g))).join('')}</div>` : '<p class="muted none">Nothing in that part of the spectrum.</p>';
  }

  pages.game = (id) => {
    const g = byId[id];
    if (!g && !loaded) return '<section class="wrap page-head"><p class="muted">Loading…</p></section>';
    if (!g) return `<section class="wrap page-head"><h1>Not found</h1><p class="lead">That game isn't in the Spectra catalogue.</p><a class="btn line" href="#/games">Back to games</a></section>`;
    const more = GAMES.filter((x) => x.id !== g.id);
    return `
    <section class="ghero" style="--g:${glow(g)}">
      <div class="ghero-art">${img(g, 'banner', 1600, 700)}</div>
      <div class="ghero-shade"></div>
      <div class="wrap ghero-in">
        <a class="back" href="#/games">← All games</a>
        <div class="row gap wrap-row">${tag(g)}${droidBadge(g)}<span class="fine">${g.genres.map(esc).join(' / ')}</span></div>
        <h1>${esc(g.title)}</h1>
        <p class="tagline">${esc(g.tagline)}</p>
        <div class="row gap wrap-row">
          ${playable(g) ? dlBtn() : `<span class="btn line lg static">Coming ${g.released ? fmtDate(g.released) : 'soon'}</span>`}
          ${playable(g) && onAndroid(g) ? `<a class="btn line lg" href="#/download">${droidIcon}<span>Also on Android</span></a>` : ''}
        </div>
        ${playable(g) ? '' : notifyBox(g)}
        <p class="fine">${playable(g) ? 'Free. Install and play it in the Spectra Launcher.' : "Not out yet. It shows in the Spectra Launcher now, and you can install it there on release day."}</p>
      </div>
    </section>
    <section class="wrap gbody" style="--g:${glow(g)}">
      <div class="gmain">
        ${g.description ? `<p class="lead big">${esc(g.description)}</p>` : ''}
        ${g.trailer ? `<div class="trailer"><video src="${esc(g.trailer)}" ${g.trailerPoster ? `poster="${esc(g.trailerPoster)}"` : ''} autoplay muted loop playsinline preload="metadata" aria-label="${esc(g.title)} trailer"></video><span class="trailer-tag">Trailer · in-game footage</span></div>` : ''}
        ${Array.isArray(g.screenshots) && g.screenshots.length ? `<div class="shots">${g.screenshots.map((s, i) => `<button class="shot" type="button" data-shot="${esc(s)}" aria-label="Open screenshot ${i + 1}"><img src="${esc(s)}" alt="${esc(g.title)} screenshot ${i + 1}" loading="lazy"></button>`).join('')}</div>` : ''}
        ${g.features.length ? `${label('A', 'Features')}<ol class="feats">${g.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ol>` : ''}
        ${g.achievements.length ? `${label('B', `Achievements · ${g.achievements.filter((a) => !a.secret).length}`)}<div class="ach">${g.achievements.filter((a) => !a.secret).map((a, i) => a.hidden ? '<div class="secret"><em>??</em><span><b>Hidden</b><p>Unlock it in the game to find out.</p></span></div>' : `<div><em>${String(i + 1).padStart(2, '0')}</em><span><b>${esc(a.name)}</b><p>${esc(a.desc)}</p></span></div>`).join('')}</div>` : ''}
        ${playable(g) ? `${label('★', 'Player reviews')}<div class="reviews" data-reviews="${esc(g.id)}"><p class="muted">Loading reviews…</p></div>` : ''}
        ${playable(g) && g.achievements.length ? `${label('B', 'Leaderboard')}<div class="board" data-board="${esc(g.id)}"><p class="muted">Loading the leaderboard…</p></div>` : ''}
        ${playable(g) && g.patchNotes.length ? `${label('C', 'Patch notes')}<div class="patches">${g.patchNotes.map((p) => `<div class="patch"><div class="p-head"><b>${esc(p.version)}</b><time>${fmtDate(p.date)}</time></div><ul>${(p.notes || []).map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
      </div>
      <aside class="gside">
        <div class="gcover">${img(g, 'cover', 300, 400)}</div>
        <dl class="spec">
          <div><dt>Status</dt><dd>${STATUS[g.status].label}</dd></div>
          ${g.version && playable(g) ? `<div><dt>Version</dt><dd>${esc(g.version)}${g.build != null ? ` · build ${esc(g.build)}` : ''}</dd></div>` : ''}
          ${onAndroid(g) ? `<div><dt>Android</dt><dd>${droidBadge(g)}</dd></div>` : ''}
          <div><dt>Released</dt><dd>${fmtDate(g.released)}</dd></div>
          ${g.sizeBytes ? `<div><dt>Size</dt><dd>${fmtBytes(g.sizeBytes)}</dd></div>` : ''}
          <div><dt>Players</dt><dd>${isMulti(g) ? '1 · 2–4 online' : '1'}</dd></div>
          <div><dt>Platform</dt><dd>${platformsOf(g).map(esc).join(' · ')}</dd></div>
          <div><dt>Developer</dt><dd>Spectra</dd></div>
          <div><dt>Price</dt><dd>Free</dd></div>
        </dl>
        ${g.requirements ? `<div class="reqs">${label('D', 'System requirements')}<dl class="spec">${[['os', 'OS'], ['processor', 'Processor'], ['memory', 'Memory'], ['graphics', 'Graphics'], ['storage', 'Storage'], ['online', 'Internet']].filter(([k]) => g.requirements[k]).map(([k, l]) => `<div><dt>${l}</dt><dd>${esc(g.requirements[k])}</dd></div>`).join('')}</dl></div>` : ''}
        ${playable(g) && g.achievements.length ? `<a class="btn line sm full" href="#/boards/${esc(g.id)}">All leaderboards ${arrow}</a>` : ''}
        ${playable(g) ? `<a class="btn line sm full report-link" href="#/report/${esc(g.id)}">Report a problem with ${esc(g.title)}</a>` : ''}
      </aside>
    </section>
    ${more.length ? `<section class="wrap sec">${label('→', 'More from Spectra')}<div class="index">${more.map((x) => indexRow(x, GAMES.indexOf(x))).join('')}</div></section>` : ''}`;
  };

  pages.launcher = () => `
    <section class="wrap page-head">
      ${label('03', 'Spectra Launcher')}
      <h1>Your home for Spectra games</h1>
      <p class="lead">A small desktop app that installs, updates and launches every Spectra game, and keeps you playing with friends.</p>
      <div class="row gap wrap-row">${dlBtn()}${androidDownload('Download Android APK', 'line')}</div>
    </section>
    <section class="wrap sec tour-sec">
      <div class="tour">
        <div class="tour-steps" role="tablist">
          ${TOUR.map(([k, t, d], i) => `<button class="tstep ${i === 0 ? 'on' : ''}" data-tour="${k}" role="tab" style="--c:${RAYS[(i * 2 + 1) % RAYS.length]}"><em>${String(i + 1).padStart(2, '0')}</em><b>${t}</b><p>${d}</p></button>`).join('')}
        </div>
        <div class="tour-view">${launcherMock()}</div>
      </div>
    </section>
    <section class="wrap sec">
      ${label('A', 'System requirements')}
      <dl class="spec wide">
        <div><dt>OS</dt><dd>Windows 10 or 11 (64-bit)</dd></div>
        <div><dt>Launcher size</dt><dd>${esc(CFG.launcherSize)}</dd></div>
        <div><dt>Internet</dt><dd>To download games and play online</dd></div>
        <div><dt>Account</dt><dd>Optional, free (sync, profile, friends, multiplayer)</dd></div>
      </dl>
    </section>
    <section class="wrap sec" id="faq">
      ${label('B', 'Questions')}
      <div class="faq">
        ${[
          ['Is it free?', 'Yes. The launcher is free, and Spectra games are free to play.'],
          ['Do I need an account?', 'No. You can install and play without one. A free Spectra account adds cloud sync for your library and achievements, a profile, a friends list and online multiplayer.'],
          ['Can I play with friends?', 'In games that support it, yes. Add each other in the launcher, host a game and invite them, and they get a Join button. Prismfall supports up to 4 players in co-op or versus.'],
          ['Can I play in the browser?', 'No. This site is for browsing. Games are installed and played through the Spectra Launcher on your PC.'],
          ['Where are games installed?', 'By default in a "Spectra Games" folder in your user folder. You can change it in the launcher settings.'],
          ['Can I play on my phone?', 'Yes, on Android. Use the Download Android APK button at the top of this page. Games marked Android can be installed and played on your phone, and online games work across PC and phone.'],
          ['Mac, Linux or iPhone?', 'Not yet. Spectra runs on Windows and Android for now.'],
        ].map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}
      </div>
    </section>
    <section class="wrap sec">${ticket()}</section>`;

  // ---------- leaderboards: every public board, per game, from Spectra accounts ----------
  pages.boards = (id) => {
    const list = GAMES.filter((g) => playable(g) && g.achievements.length);
    const g = byId[id] && list.includes(byId[id]) ? byId[id] : list[0];
    return `
    <section class="wrap page-head">
      ${label('04', 'Leaderboards')}
      <h1>Boards</h1>
      <p class="lead">Who has unlocked the most, and who has played the longest, from everyone with a Spectra account. Sign in to the launcher and play to appear here.</p>
    </section>
    <section class="wrap">
      ${list.length ? `<div class="chips board-tabs">${list.map((x) => `<a class="chip ${x === g ? 'on' : ''}" href="#/boards/${esc(x.id)}">${esc(x.title)}</a>`).join('')}</div>
      <div class="board big" data-board="${esc(g.id)}" data-full="1"><p class="muted">Loading the leaderboard…</p></div>` : '<p class="muted">No boards yet.</p>'}
    </section>`;
  };
  // ranks players by achievement points (bronze 1, silver 2, gold 3, platinum 5), then playtime
  function boardHTML(g, rows, full) {
    const pub = g.achievements.filter((a) => !a.secret);
    const all = g.achievements;
    const players = rows.filter((r) => r && r.profiles && r.profiles.username).map((r) => {
      const got = all.filter((a) => Number(r.achievements && r.achievements[a.id]) > 0);
      return { p: r.profiles, play: Number(r.playtime) || 0, n: got.filter((a) => !a.secret).length, sec: got.filter((a) => a.secret).length, pts: got.reduce((s, a) => s + (TIER_PTS[a.tier] || 1), 0), got };
    }).filter((x) => x.play > 0 || x.got.length);
    if (!players.length) return '<p class="muted">No one is on this board yet. Play with a Spectra account to be first.</p>';
    const who = (x) => `<a class="who" href="#/u/${encodeURIComponent(x.p.username)}"><b style="background:${/^#[0-9a-f]{6}$/i.test(x.p.avatar_color || '') ? x.p.avatar_color : '#927dff'}">${esc((x.p.display_name || x.p.username).slice(0, 1).toUpperCase())}</b><span>${esc(x.p.display_name || x.p.username)}${(window.SpectraRank || (() => ''))(x.p)}<small>@${esc(x.p.username)}</small></span></a>`;
    const byPts = players.slice().sort((a, b) => b.pts - a.pts || b.n - a.n || b.play - a.play).slice(0, full ? 25 : 10);
    const byPlay = players.slice().sort((a, b) => b.play - a.play).slice(0, full ? 10 : 5);
    const rarity = pub.map((a) => ({ a, pct: Math.round((100 * players.filter((x) => Number(x.got.includes(a))).length) / players.length) })).sort((x, y) => x.pct - y.pct);
    return `<div class="board-grid">
      <div class="board-col"><h3>Most achievements</h3><ol class="ranks">${byPts.map((x, i) => `<li class="${i < 3 ? 'top top' + (i + 1) : ''}"><em>${i + 1}</em>${who(x)}<span class="r-val"><b>${x.n}/${pub.length}</b>${x.sec ? `<small>+${x.sec} secret</small>` : ''}<small>${x.pts} pts</small></span></li>`).join('')}</ol></div>
      <div class="board-col"><h3>Most played</h3><ol class="ranks">${byPlay.map((x, i) => `<li class="${i < 3 ? 'top top' + (i + 1) : ''}"><em>${i + 1}</em>${who(x)}<span class="r-val"><b>${fmtPlay(x.play)}</b></span></li>`).join('')}</ol>
        <h3>Rarest achievements</h3><ul class="rarity">${rarity.slice(0, full ? pub.length : 6).map(({ a, pct }) => `<li class="t-${esc(a.tier || 'bronze')}"><span><b>${esc(a.hidden ? 'Hidden achievement' : a.name)}</b><small>${esc(a.hidden ? 'Unlock it to see it' : a.desc)}</small></span><span class="r-bar"><i style="width:${Math.max(2, pct)}%"></i></span><em>${pct}%</em></li>`).join('')}</ul></div>
    </div><p class="fine">${players.length} player${players.length === 1 ? '' : 's'} with a Spectra account. Secret achievements are counted but never named.</p>`;
  }
  async function fillBoards() {
    const A = window.SpectraWebAccount;
    for (const el of document.querySelectorAll('[data-board]')) {
      const g = byId[el.dataset.board];
      if (!g) continue;
      if (!A || !A.available) { el.innerHTML = '<p class="muted">Leaderboards need Spectra accounts, which aren’t available right now.</p>'; continue; }
      try { const rows = await A.leaderboard(g.id); if (el.isConnected) el.innerHTML = boardHTML(g, rows || [], !!el.dataset.full); }
      catch (e) { if (el.isConnected) el.innerHTML = '<p class="muted">Couldn’t load the leaderboard. Try again in a moment.</p>'; }
    }
  }

  // ---------- the devlog: short posts and version notes, from devlog.json and the catalogue ----------
  let DEVLOG = null, devFilter = 'all';
  async function loadDevlog() {
    if (DEVLOG) return DEVLOG;
    try { const r = await fetch(CFG.devlogUrl || 'devlog.json', { cache: 'no-store' }); const j = await r.json(); DEVLOG = (Array.isArray(j.posts) ? j.posts : []).filter((p) => p && p.title && p.date); } catch { DEVLOG = []; }
    return DEVLOG;
  }
  pages.devlog = () => `
    <section class="wrap page-head">
      ${label('05', 'Devlog')}
      <h1>What changed, and why</h1>
      <p class="lead">Short posts from the studio, and the version notes for every game, the launcher and the IDE.</p>
    </section>
    <section class="wrap"><div id="devlog"><p class="muted">Loading…</p></div></section>`;
  function renderDevlog() {
    const el = document.getElementById('devlog');
    if (!el || !DEVLOG) return;
    const notes = GAMES.flatMap((g) => (playable(g) ? g.patchNotes : []).map((p) => ({ date: p.date, tag: g.title, game: g.id, version: p.version, title: `${g.title} ${p.version}`, notes: p.notes || [], kind: 'notes' })));
    const posts = DEVLOG.map((p) => ({ ...p, kind: 'post' }));
    const tags = ['all', ...new Set(posts.concat(notes).map((p) => p.tag).filter(Boolean))];
    const items = posts.concat(devFilter === 'posts' ? [] : notes).filter((p) => devFilter === 'all' || devFilter === 'posts' || p.tag === devFilter)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (a.kind === 'post' ? -1 : 1));
    el.innerHTML = `<div class="chips dev-tabs">${tags.concat('posts').map((t) => `<button class="chip ${devFilter === t ? 'on' : ''}" data-devtag="${esc(t)}">${t === 'all' ? 'Everything' : t === 'posts' ? 'Posts only' : esc(t)}</button>`).join('')}</div>
      <div class="devlog">${items.map((p) => `<article class="dev ${p.kind}"><div class="dev-meta"><time>${fmtDate(p.date)}</time><span class="tag info">${esc(p.tag || 'Studio')}</span>${p.version ? `<span class="dev-ver">v${esc(p.version)}</span>` : ''}</div>
        <div class="dev-body"><h3>${p.game && byId[p.game] ? `<a href="#/game/${esc(p.game)}">${esc(p.title)}</a>` : esc(p.title)}</h3>${p.body ? `<p>${esc(p.body)}</p>` : ''}${p.notes && p.notes.length ? `<details><summary>${p.notes.length} change${p.notes.length === 1 ? '' : 's'}</summary><ul>${p.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></details>` : ''}</div></article>`).join('') || '<p class="muted">Nothing here yet.</p>'}</div>`;
    el.querySelectorAll('[data-devtag]').forEach((b) => b.addEventListener('click', () => { devFilter = b.dataset.devtag; renderDevlog(); }));
  }

  // ---------- report a problem / feedback (stored privately in Supabase: supabase/reports.sql) ----------
  const REPORT_KINDS = [['bug', 'Bug'], ['crash', 'Crash'], ['performance', 'Slow / laggy'], ['feedback', 'Feedback'], ['idea', 'Idea'], ['other', 'Something else']];
  const REPORT_STATUS = { new: 'Received', seen: 'Seen', 'in-progress': 'Being worked on', fixed: 'Fixed', 'wont-fix': "Won't fix", duplicate: 'Already reported' };
  const reportTargets = () => [
    ...GAMES.map((g) => [g.id, g.title]),
    ['launcher', 'Spectra Launcher'], ['android-app', 'Spectra for Android'], ['ide', 'Spectra IDE'], ['website', 'This website'], ['other', 'Something else'],
  ];
  const targetName = (id) => (reportTargets().find(([k]) => k === id) || [id, id])[1];
  const versionOf = (id) => (byId[id] && playable(byId[id]) ? byId[id].version || '' : id === 'launcher' ? CFG.launcherVersion || '' : id === 'android-app' ? (ANDROID && ANDROID.version) || '' : id === 'ide' ? CFG.ideVersion || '' : '');
  pages.report = (arg) => {
    if (arg === 'inbox') return `
    <section class="wrap page-head">
      ${label('✉', 'Reports inbox')}
      <h1>Reports</h1>
      <p class="lead">Every bug report and piece of feedback sent from the website and the launcher. Only Spectra admins can see this page.</p>
    </section>
    <section class="wrap"><div id="inbox"><p class="muted">Loading…</p></div></section>`;
    const pick = byId[arg] || ['launcher', 'android-app', 'ide', 'website', 'other'].includes(arg) ? arg : '';
    return `
    <section class="wrap page-head">
      ${label('?', 'Report a problem')}
      <h1>Found a bug? Tell us.</h1>
      <p class="lead">Bugs, crashes, lag, ideas or anything else about a Spectra game, the launcher or this site. Reports come straight to the Spectra team and stay private.</p>
    </section>
    <section class="wrap report-wrap">
      <form class="report-form" id="reportForm" novalidate>
        <label class="rf-field"><span>What is it about?</span>
          <select name="game" required><option value="">Choose…</option>${reportTargets().map(([k, l]) => `<option value="${esc(k)}" ${k === pick ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        <div class="rf-field"><span>What kind of report?</span>
          <div class="chips rf-kinds" role="radiogroup">${REPORT_KINDS.map(([k, l], i) => `<label class="chip ${i === 0 ? 'on' : ''}"><input type="radio" name="kind" value="${k}" ${i === 0 ? 'checked' : ''}>${esc(l)}</label>`).join('')}</div></div>
        <label class="rf-field"><span>Title</span><input name="title" maxlength="120" placeholder="For example: Game freezes when the leviathan appears" required></label>
        <label class="rf-field"><span>What happened?</span><textarea name="details" rows="5" maxlength="4000" placeholder="What did you expect, and what happened instead?" required></textarea></label>
        <label class="rf-field" data-steps><span>Steps to make it happen again <em>(optional)</em></span><textarea name="steps" rows="3" maxlength="2000" placeholder="1. Start a story run&#10;2. Pick the Lancer&#10;3. …"></textarea></label>
        <div class="rf-row">
          <label class="rf-field"><span>Version <em>(optional)</em></span><input name="version" maxlength="40" value="${esc(versionOf(pick))}" placeholder="e.g. 1.4.4"></label>
          <label class="rf-field"><span>Played on</span><select name="platform"><option value="windows">Windows</option><option value="android">Android</option><option value="browser">Web browser</option><option value="other">Other</option></select></label>
        </div>
        <label class="rf-field"><span>Email for a reply <em>(optional)</em></span><input name="contact" type="email" maxlength="254" placeholder="you@example.com" autocomplete="email"></label>
        <label class="rf-trap" aria-hidden="true">Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label>
        <p class="fine rf-who" id="reportWho">Signed-out reports are anonymous unless you leave an email.</p>
        <div class="row gap wrap-row"><button class="btn solid" type="submit">Send report</button><span class="rf-msg" id="reportMsg" role="status"></span></div>
      </form>
      <aside class="report-side">
        ${label('i', 'Good reports')}
        <ul class="rf-tips"><li>One problem per report.</li><li>Say what you did just before it happened.</li><li>Include the version. It's on the game's page in the launcher.</li><li>For crashes, say what was on screen.</li></ul>
        <div id="myReports"></div>
      </aside>
    </section>`;
  };
  async function bindReport(arg) {
    const A = window.SpectraWebAccount;
    if (arg === 'inbox') return renderInbox();
    const f = document.getElementById('reportForm');
    if (!f) return;
    const sync = () => {
      f.querySelectorAll('.rf-kinds .chip').forEach((c) => c.classList.toggle('on', c.querySelector('input').checked));
      const k = f.kind.value;
      f.querySelector('[data-steps]').hidden = !['bug', 'crash', 'performance'].includes(k);
    };
    f.addEventListener('change', (e) => {
      if (e.target.name === 'game' && !f.version.dataset.touched) f.version.value = versionOf(f.game.value);
      if (e.target.name === 'game' && f.game.value === 'android-app') f.platform.value = 'android';
      sync();
    });
    f.version.addEventListener('input', () => { f.version.dataset.touched = '1'; });
    sync();
    let me = null;
    try { me = A && A.available ? await A.user() : null; } catch {}
    if (me) {
      document.getElementById('reportWho').textContent = 'You are signed in, so you can see this report and our reply under “Your reports”.';
      if (me.email && !f.contact.value) f.contact.value = me.email;
      renderMyReports();
    }
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('reportMsg'), btn = f.querySelector('button[type=submit]');
      msg.classList.remove('bad');
      if (f.website.value) { msg.textContent = 'Thanks!'; return; } // a bot filled the hidden field
      try {
        if (!A || !A.available) throw new Error('Reports aren’t available right now. Try again later.');
        btn.disabled = true; msg.textContent = 'Sending…';
        await A.report({ game: f.game.value, kind: f.kind.value, title: f.elements.title.value, details: f.details.value, steps: f.querySelector('[data-steps]').hidden ? '' : f.steps.value, version: f.version.value, platform: f.platform.value, contact: f.contact.value });
        const what = targetName(f.game.value);
        f.outerHTML = `<div class="report-done"><h3>Thanks, we've got it.</h3><p>Your report about ${esc(what)} is with the Spectra team.${me ? ' You can follow it under “Your reports”.' : f.contact.value ? ' If we need more detail, we’ll email you.' : ''}</p><a class="btn line sm" href="#/report/${esc(f.game.value)}" data-again>Send another report</a></div>`;
        document.querySelector('[data-again]')?.addEventListener('click', (ev) => { ev.preventDefault(); route(); });
        if (me) renderMyReports();
      } catch (err) { msg.textContent = err.message; msg.classList.add('bad'); btn.disabled = false; }
    });
  }
  async function renderMyReports() {
    const el = document.getElementById('myReports');
    const A = window.SpectraWebAccount;
    if (!el || !A) return;
    try {
      const rows = await A.myReports();
      if (!rows.length) { el.innerHTML = ''; return; }
      el.innerHTML = `${label('↺', 'Your reports')}<div class="my-reports">${rows.map((r) => `<div class="my-report"><div class="row between"><b>${esc(r.title)}</b><span class="rstat s-${esc(r.status)}">${esc(REPORT_STATUS[r.status] || r.status)}</span></div>
        <span class="fine">${esc(targetName(r.game))} · ${fmtDate(r.created_at)}</span>${r.reply ? `<p class="my-reply"><b>Spectra:</b> ${esc(r.reply)}</p>` : ''}</div>`).join('')}</div>`;
    } catch { el.innerHTML = ''; }
  }
  let inboxFilter = { status: 'open', game: '' };
  async function renderInbox() {
    const el = document.getElementById('inbox');
    const A = window.SpectraWebAccount;
    if (!el) return;
    if (!A || !A.available || !(await A.isAdmin().catch(() => false))) {
      el.innerHTML = `<p class="lead">This page is for the Spectra team. ${A && A.available ? '<a href="#/account">Sign in</a> with an admin account.' : ''}</p><a class="btn line" href="#/report">Report a problem instead</a>`;
      return;
    }
    let rows;
    try { rows = await A.allReports(); } catch (err) { el.innerHTML = `<p class="lead">${esc(err.message)}</p>`; return; }
    const open = (r) => ['new', 'seen', 'in-progress'].includes(r.status);
    const list = rows.filter((r) => (inboxFilter.status === 'all' || (inboxFilter.status === 'open' ? open(r) : r.status === inboxFilter.status)) && (!inboxFilter.game || r.game === inboxFilter.game));
    const games = [...new Set(rows.map((r) => r.game))];
    const kindName = Object.fromEntries(REPORT_KINDS);
    el.innerHTML = `<div class="inbox-tools">
        <div class="chips">${[['open', `Open (${rows.filter(open).length})`], ['new', `New (${rows.filter((r) => r.status === 'new').length})`], ['fixed', 'Fixed'], ['all', `All (${rows.length})`]].map(([k, l]) => `<button class="chip ${inboxFilter.status === k ? 'on' : ''}" data-ifs="${k}">${esc(l)}</button>`).join('')}</div>
        <select id="inboxGame"><option value="">Everything</option>${games.map((g) => `<option value="${esc(g)}" ${inboxFilter.game === g ? 'selected' : ''}>${esc(targetName(g))}</option>`).join('')}</select>
      </div>
      ${list.length ? list.map((r) => `<article class="inbox-item ${r.status === 'new' ? 'is-new' : ''}" data-rid="${r.id}">
        <div class="ii-head"><div><span class="tag info">${esc(kindName[r.kind] || r.kind)}</span><span class="fine">#${r.id} · ${esc(targetName(r.game))}${r.version ? ' v' + esc(r.version) : ''} · ${esc(r.platform || '')} · ${new Date(r.created_at).toLocaleString()}</span></div><span class="rstat s-${esc(r.status)}">${esc(REPORT_STATUS[r.status] || r.status)}</span></div>
        <h3>${esc(r.title)}</h3>
        <p class="ii-text">${esc(r.details)}</p>
        ${r.steps ? `<p class="ii-steps"><b>Steps</b><br>${esc(r.steps)}</p>` : ''}
        <p class="fine">${r.contact ? `Reply to <a href="mailto:${esc(r.contact)}?subject=${encodeURIComponent('Your Spectra report: ' + r.title)}">${esc(r.contact)}</a>` : 'No email given'}${r.user_id ? ' · signed-in player (sees your reply on this site)' : ' · anonymous'}</p>
        <div class="ii-act">
          <select data-ist>${Object.entries(REPORT_STATUS).map(([k, l]) => `<option value="${k}" ${r.status === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
          <input data-irp maxlength="2000" placeholder="Reply the player sees (optional)" value="${esc(r.reply)}">
          <button class="btn line sm" data-isave>Save</button><button class="btn line sm" data-idel title="Delete report">Delete</button><span class="fine" data-imsg></span>
        </div></article>`).join('') : '<p class="muted">Nothing here. Nice.</p>'}`;
    el.querySelectorAll('[data-ifs]').forEach((b) => b.addEventListener('click', () => { inboxFilter.status = b.dataset.ifs; renderInbox(); }));
    el.querySelector('#inboxGame').addEventListener('change', (e) => { inboxFilter.game = e.target.value; renderInbox(); });
    el.querySelectorAll('.inbox-item').forEach((it) => {
      const id = +it.dataset.rid, m = it.querySelector('[data-imsg]');
      it.querySelector('[data-isave]').addEventListener('click', async () => {
        m.textContent = 'Saving…';
        try { await A.updateReport(id, { status: it.querySelector('[data-ist]').value, reply: it.querySelector('[data-irp]').value }); m.textContent = 'Saved'; setTimeout(renderInbox, 600); } catch (err) { m.textContent = err.message; }
      });
      it.querySelector('[data-idel]').addEventListener('click', async () => {
        if (!confirm('Delete report #' + id + '? This can’t be undone.')) return;
        try { await A.deleteReport(id); renderInbox(); } catch (err) { m.textContent = err.message; }
      });
    });
  }

  // ---------- reviews on game pages ----------
  async function fillReviews() {
    const el = document.querySelector('[data-reviews]');
    const A = window.SpectraWebAccount;
    if (!el) return;
    const g = byId[el.dataset.reviews];
    const rows = A && A.available ? await A.reviews(el.dataset.reviews).catch(() => []) : [];
    if (!el.isConnected) return;
    const stars = (n) => `<span class="stars" aria-label="${n} out of 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= Math.round(n) ? 'on' : ''}">★</i>`).join('')}</span>`;
    const hint = `<p class="fine">Reviews come from players in the Spectra Launcher. Play ${esc(g ? g.title : 'the game')} there for a minute, then rate it on its page.</p>`;
    if (!rows.length) { el.innerHTML = `<p class="muted">No reviews yet.</p>${hint}`; return; }
    const avg = rows.reduce((a, r) => a + r.stars, 0) / rows.length;
    const time = (s) => (s >= 3600 ? Math.floor(s / 3600) + 'h ' : '') + Math.floor((s % 3600) / 60) + 'm';
    el.innerHTML = `<div class="rv-top"><b>${avg.toFixed(1)}</b>${stars(avg)}<span class="fine">${rows.length} review${rows.length === 1 ? '' : 's'}</span></div>
      <div class="rv-list">${rows.slice(0, 6).map((r) => `<div class="rv"><div class="rv-head"><a href="#/u/${esc(r.profiles.username)}"><span class="rv-av" style="background:${esc(r.profiles.avatar_color || '#927dff')}">${esc((r.profiles.display_name || '?')[0].toUpperCase())}</span>${esc(r.profiles.display_name)}${(window.SpectraRank || (() => ''))(r.profiles)}</a>${stars(r.stars)}</div>
        ${r.body ? `<p>${esc(r.body)}</p>` : ''}<span class="fine">${time(r.playtime || 0)} played · ${fmtDate(r.updated_at)}</span></div>`).join('')}</div>${hint}`;
  }

  // ---------- Spectra IDE ----------
  const ideBtn = (cls = 'lg') => CFG.ideDownloadUrl
    ? `<a class="btn solid ${cls}" href="${esc(CFG.ideDownloadUrl)}" download>${winIcon}<span>Download Spectra IDE</span></a>`
    : `<span class="btn line ${cls} static">${dlIcon}<span>Coming soon</span></span>`;
  function ideMock() {
    const code = [['fn', ' main', '() {'], ['    let', ' light', ' = Prism::new();'], ['    for', ' ray', ' in light.split() {'], ['        println!', '("{ray}")', ';'], ['    }', '', ''], ['}', '', '']];
    return `<div class="ide-mock" aria-hidden="true">
      <div class="ide-bar"><b>Spectra IDE</b><span>File</span><span>Edit</span><span>View</span><span>Run</span><span>Plugins</span></div>
      <div class="ide-body">
        <div class="ide-act"><i>▤</i><i>⌕</i><i>⑂</i><i class="on">▶</i></div>
        <div class="ide-side"><small>EXPLORER</small><span>▾ src</span><span class="on">· main.rs</span><span>· prism.rs</span><span>▸ assets</span><span>· Cargo.toml</span></div>
        <div class="ide-main">
          <div class="ide-tabs"><span class="on">main.rs ✕</span><span>prism.rs ✕</span></div>
          <pre class="ide-code">${code.map((l, i) => `<span class="ln">${i + 1}</span><span class="k">${esc(l[0])}</span><span class="v">${esc(l[1])}</span>${esc(l[2])}`).join('\n')}</pre>
          <div class="ide-term"><small>RUN · TERMINAL</small><span>$ cargo run</span><span class="ok">   red · orange · yellow · green · blue · indigo · violet</span></div>
        </div>
      </div>
      <div class="ide-status"><span>⑂ main</span><span>UTF-8 · LF · Rust · Ln 3, Col 18</span></div>
    </div>`;
  }
  pages.ide = () => `
    <section class="wrap page-head ide-head">
      ${label('06', 'Spectra IDE')}
      <h1>The editor we make Spectra with</h1>
      <p class="lead">A small, fast, native code editor for Windows, laid out like the big ones. Tabs, a split view, a terminal, a command palette, and plugins for the languages and mods you work on.</p>
      <div class="row gap wrap-row">${ideBtn()}</div>
      <p class="fine">Windows 10 / 11 · ${esc(CFG.ideSize || '')} · v${esc(CFG.ideVersion || '1.0.0')} · free · installs for your user only, no administrator rights</p>
    </section>
    <section class="wrap sec">${ideMock()}</section>
    <section class="wrap sec">
      ${label('A', 'What it does')}
      <div class="ide-feats">${[
        ['Syntax highlighting', 'Dozens of languages: Rust, Python, JavaScript, TypeScript, HTML, CSS, JSON, TOML, YAML, Markdown, C, C++, C#, Java, Kotlin, Go, Lua, SQL and more.'],
        ['A real editor', 'Split editor, minimap, bracket matching, auto-indent, auto-close, multi-line indent, line moves and comments, font zoom, format document.'],
        ['Find anything', 'Find and replace with highlighting, go to line, fuzzy go-to-file, and a command palette that runs any command, Gradle tasks included.'],
        ['Run and terminal', 'Run your project and keep the output, open several terminal tabs, and jump from problems straight to the line.'],
        ['Plugins', 'Python, Lua, web, Gradle and themes, plus Minecraft (Fabric) and Terraria modding with New Project templates. Install them from a plugin catalogue, permissions shown first.'],
        ['Your setup', 'A first-run wizard for theme, title bar and editor defaults, editable shortcuts, and per-language settings. Open folders and files from Explorer.'],
      ].map(([t, d], i) => `<div class="ide-feat" style="--c:${RAYS[i % RAYS.length]}"><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>
    </section>
    <section class="wrap sec">
      ${label('B', 'System requirements')}
      <dl class="spec wide">
        <div><dt>OS</dt><dd>Windows 10 or 11 (64-bit)</dd></div>
        <div><dt>Size</dt><dd>${esc(CFG.ideSize || '—')}</dd></div>
        <div><dt>Admin rights</dt><dd>Not needed (installs for your user)</dd></div>
        <div><dt>Uninstall</dt><dd>Settings → Apps</dd></div>
      </dl>
      <p class="fine">The installer isn’t code-signed yet, so Windows SmartScreen may say “unknown publisher”. Choose More info → Run anyway.</p>
    </section>`;

  pages.download = () => `
    <section class="wrap page-head">
      ${label('↓', 'Download')}
      <h1>Get the launcher</h1>
    </section>
    <section class="wrap sec first">${ticket()}</section>
    <section class="wrap sec">${androidTicket()}</section>
    <section class="wrap sec">
      <div class="steps">
        ${[['Download', 'Get the installer from this page.'], ['Install', 'Run it. The launcher sets itself up in a few seconds.'], ['Play', 'Open the Store, install a game and press Play.']].map(([t, d], i) => `<div class="step" style="--c:${RAYS[i * 2]}"><em>${String(i + 1).padStart(2, '0')}</em><h3>${t}</h3><p>${d}</p></div>`).join('')}
      </div>
      ${CFG.downloadUrl ? `<p class="fine center">Download not starting? <a class="ul" href="${esc(CFG.downloadUrl)}">Click here</a>.</p>` : ''}
    </section>`;

  // ---------- hero: a beam of light hits a prism and splits ----------
  let beamStop = null;
  function startBeam() {
    if (beamStop) beamStop();
    const cv = document.getElementById('beam');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, raf = 0, t = 0, mx = 0.5, my = 0.5, tx = 0.5, ty = 0.5;
    const dust = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 1.6 + 0.3, v: Math.random() * 0.02 + 0.005 }));
    function size() {
      const r = cv.getBoundingClientRect();
      dpr = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function draw() {
      t += 1 / 60;
      mx += (tx - mx) * 0.06; my += (ty - my) * 0.06;
      ctx.clearRect(0, 0, W, H);
      const narrow = W < 760;
      const mid = W < 1180;
      const px = narrow ? W * 0.72 : mid ? W * 0.8 : W * 0.86, py = narrow ? H * 0.2 : mid ? H * 0.25 : H * 0.42, s = Math.min(W, H) * (narrow ? 0.14 : mid ? 0.13 : 0.14);
      const A = [px, py - s], B = [px - s * 0.9, py + s * 0.62], Cc = [px + s * 0.9, py + s * 0.62];
      // the incoming white beam
      const hit = [px - s * 0.42, py];
      const g = ctx.createLinearGradient(0, H * 0.62, hit[0], hit[1]);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.9)');
      ctx.strokeStyle = g; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(-20, H * (narrow ? 0.34 : 0.62)); ctx.lineTo(hit[0], hit[1]); ctx.stroke();
      // the fan of colour, swinging with the cursor
      const exit = [px + s * 0.38, py - s * 0.05];
      const spread = 0.34 + (my - 0.5) * 0.28;
      const base = -0.05 + (mx - 0.5) * 0.35 + Math.sin(t * 0.4) * 0.03;
      ctx.globalCompositeOperation = 'lighter';
      RAYS.forEach((c, i) => {
        const a0 = base + (i / RAYS.length) * spread, a1 = base + ((i + 1) / RAYS.length) * spread;
        const L = Math.hypot(W, H);
        const grd = ctx.createRadialGradient(exit[0], exit[1], 0, exit[0], exit[1], L);
        grd.addColorStop(0, c); grd.addColorStop(0.55, c + '55'); grd.addColorStop(1, c + '00');
        ctx.fillStyle = grd;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(exit[0], exit[1]);
        ctx.lineTo(exit[0] + Math.cos(a0) * L, exit[1] + Math.sin(a0) * L);
        ctx.lineTo(exit[0] + Math.cos(a1) * L, exit[1] + Math.sin(a1) * L);
        ctx.closePath(); ctx.fill();
      });
      ctx.globalAlpha = 1;
      // dust caught in the light
      for (const d of dust) {
        d.x += d.v / 60; if (d.x > 1) d.x = 0;
        const x = d.x * W, y = d.y * H;
        const a = Math.atan2(y - exit[1], x - exit[0]);
        const inFan = x > exit[0] && a > base && a < base + spread;
        ctx.fillStyle = inFan ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.08)';
        ctx.fillRect(x, y, d.s, d.s);
      }
      ctx.globalCompositeOperation = 'source-over';
      // the prism
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(Cc[0], Cc[1]); ctx.closePath();
      ctx.fillStyle = 'rgba(12,12,20,0.82)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.6; ctx.stroke();
      const inner = ctx.createLinearGradient(hit[0], hit[1], exit[0], exit[1]);
      inner.addColorStop(0, 'rgba(255,255,255,0.7)'); inner.addColorStop(1, 'rgba(255,255,255,0.15)');
      ctx.strokeStyle = inner; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(hit[0], hit[1]); ctx.lineTo(exit[0], exit[1]); ctx.stroke();
      if (!reduceMotion) raf = requestAnimationFrame(draw);
    }
    const onMove = (e) => { tx = e.clientX / innerWidth; ty = e.clientY / innerHeight; if (reduceMotion) requestAnimationFrame(draw); };
    size(); draw();
    addEventListener('resize', size);
    addEventListener('pointermove', onMove, { passive: true });
    const vis = () => { cancelAnimationFrame(raf); if (!document.hidden && !reduceMotion) raf = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', vis);
    beamStop = () => { cancelAnimationFrame(raf); removeEventListener('resize', size); removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', vis); beamStop = null; };
  }

  // ---------- launcher tour ----------
  function bindTour() {
    document.querySelectorAll('[data-tour]').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('[data-tour]').forEach((x) => x.classList.toggle('on', x === b));
      const m = document.getElementById('mock');
      if (m) m.dataset.focus = b.dataset.tour;
    }));
  }

  // ---------- reveal on scroll ----------
  let io = null;
  function bindReveal() {
    if (io) io.disconnect();
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.sec, .spot, .irow, .ticket').forEach((el) => { el.classList.add('rv'); io.observe(el); });
  }

  // ---------- router ----------
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [name, raw, rawExtra] = h.split('/');
    const decode = (value) => { try { return decodeURIComponent(value || ''); } catch { return ''; } };
    const arg = decode(raw), extra = decode(rawExtra);
    const accountRoute = ['account', 'u', 'join'].includes(name);
    const key = accountRoute ? 'account' : Object.hasOwn(pages, name) ? name : 'home';
    if (beamStop) beamStop();
    if (accountRoute) {
      app.innerHTML = '<div class="page page-account" data-account-view></div>';
      window.SpectraAccountPages.render({ root: app.firstElementChild, section: name, arg, extra, games: byId, playable });
    } else app.innerHTML = `<div class="page page-${key}">${pages[key](arg)}</div>`;
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === (key === 'game' ? 'games' : key)));
    document.title = key === 'game' && byId[arg] ? `${byId[arg].title} · Spectra` : accountRoute ? 'Account · Spectra' : ({ boards: 'Leaderboards · Spectra', devlog: 'Devlog · Spectra', ide: 'Spectra IDE', report: arg === 'inbox' ? 'Reports inbox · Spectra' : 'Report a problem · Spectra' })[key] || 'Spectra · Light goes in. Games come out.';
    document.body.classList.remove('menu-open');
    document.getElementById('menuBtn').setAttribute('aria-expanded', 'false');
    if (key === 'home') {
      startBeam();
      // a single colour sweep through "Games come out." so people notice it reacts
      const out = app.querySelector('.h-out');
      if (out && !reduceMotion) { setTimeout(() => out.classList.add('lit'), 700); setTimeout(() => out.classList.remove('lit'), 2600); }
    }
    if (key === 'games') bindGames();
    if (key === 'game' || key === 'boards') fillBoards();
    if (key === 'devlog') loadDevlog().then(renderDevlog);
    if (key === 'report') bindReport(arg);
    if (key === 'game') fillReviews();
    prefillNotify();
    bindTour();
    bindReveal();
    if (h === 'launcher' && window._faq) { window._faq = false; setTimeout(() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }), 50); }
    else window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function bindGames() {
    renderGrid();
    const q = document.getElementById('gq');
    if (!q) return;
    q.addEventListener('input', () => { gFilter.q = q.value; renderGrid(); });
    document.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => {
      gFilter.status = b.dataset.status;
      document.querySelectorAll('[data-status]').forEach((x) => x.classList.toggle('on', x === b));
      renderGrid();
    }));
    document.querySelector('[data-android]')?.addEventListener('click', (e) => { gFilter.android = !gFilter.android; e.currentTarget.classList.toggle('on', gFilter.android); renderGrid(); });
    document.querySelectorAll('[data-genre]').forEach((b) => b.addEventListener('click', () => {
      gFilter.genre = b.dataset.genre;
      document.querySelectorAll('[data-genre]').forEach((x) => x.classList.toggle('on', x === b));
      renderGrid();
    }));
  }

  // notify-me sign-ups
  async function prefillNotify() {
    const A = window.SpectraWebAccount;
    if (!A || !A.available || !document.querySelector('[data-notify]')) return;
    try { const u = await A.user(); if (u && u.email) document.querySelectorAll('[data-notify] input[type=email]').forEach((i) => { if (!i.value) i.value = u.email; }); } catch {}
  }
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-notify]');
    if (!f) return;
    e.preventDefault();
    const msg = f.querySelector('.notify-msg'), btn = f.querySelector('button'), email = f.querySelector('input').value, id = f.dataset.notify;
    const A = window.SpectraWebAccount;
    btn.disabled = true; msg.textContent = 'Signing you up…'; msg.classList.remove('bad');
    try {
      if (!A || !A.available) throw new Error('Sign-ups aren’t available right now. Try again later.');
      await A.notify(email, id);
      try { localStorage.setItem('spectra-notify-' + id, '1'); } catch {}
      f.outerHTML = `<p class="notify-done">✓ You’re on the list. We’ll email you once, the day ${esc((byId[id] || {}).title || 'it')} releases.</p>`;
    } catch (err) { msg.textContent = err.message; msg.classList.add('bad'); btn.disabled = false; }
  });
  // screenshots open full size
  document.addEventListener('click', (e) => {
    const s = e.target.closest('[data-shot]');
    if (s) { const box = document.createElement('div'); box.className = 'lightbox'; box.innerHTML = `<img src="${esc(s.dataset.shot)}" alt=""><button type="button" aria-label="Close">✕</button>`; box.addEventListener('click', () => box.remove()); document.body.appendChild(box); return; }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelector('.lightbox')?.remove(); });
  document.querySelector('[data-faq]').addEventListener('click', () => (window._faq = true));
  document.getElementById('menuBtn').addEventListener('click', (e) => {
    const open = document.body.classList.toggle('menu-open');
    e.currentTarget.setAttribute('aria-expanded', String(open));
  });
  const prog = document.getElementById('progress');
  window.addEventListener('scroll', () => {
    document.getElementById('nav').classList.toggle('solid', scrollY > 10);
    const max = document.documentElement.scrollHeight - innerHeight;
    prog.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  }, { passive: true });
  window.addEventListener('hashchange', route);
  document.getElementById('year').textContent = new Date().getFullYear();
  document.querySelectorAll('[data-download]').forEach((a) => (a.href = dlHref()));
  if (CFG.contactEmail) { const c = document.getElementById('contactLink'); c.href = 'mailto:' + CFG.contactEmail; c.hidden = false; }

  loadCatalog().then(() => {
    // Preserve credentials typed while the catalogue was loading.
    const accountView = app.querySelector('[data-account-view]');
    if (!accountView || !accountView.querySelector('[data-form]') || !accountView.contains(document.activeElement)) route();
  });
  route();
})();
