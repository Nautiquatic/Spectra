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
  const catalogUrl = new URLSearchParams(location.search).get('catalog') || CFG.catalogUrl || '';
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
      byId = Object.fromEntries(GAMES.map((g) => [g.id, g]));
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
      <span class="i-status">${tag(g)}</span>
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
    const lead = (GAMES.filter((g) => g.featured)[0]) || GAMES[0];
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
  function androidTicket() {
    return `<div class="ticket dark" id="android">
      <div class="t-main">
        ${label(droidIcon, 'Pocket edition')}
        <h2>Spectra for Android</h2>
        <p class="muted">The launcher on your phone: your library, friends and achievements, and games marked <b>Android</b> to play on the go, online with PC players too.</p>
        <div class="row gap wrap-row">${ANDROID ? `<a class="btn solid lg" href="${esc(ANDROID.url)}" download>${droidIcon}<span>Download APK</span></a>` : `<span class="btn line lg static">${droidIcon}<span>Coming soon</span></span>`}</div>
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

  let gFilter = { q: '', genre: 'All', status: 'all' };
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
      (gFilter.status === 'all' || (gFilter.status === 'playable' ? playable(g) : !playable(g))));
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
        <div class="row gap wrap-row">${tag(g)}<span class="fine">${g.genres.map(esc).join(' / ')}</span></div>
        <h1>${esc(g.title)}</h1>
        <p class="tagline">${esc(g.tagline)}</p>
        <div class="row gap wrap-row">
          ${playable(g) ? dlBtn() : `<span class="btn line lg static">Coming ${g.released ? fmtDate(g.released) : 'soon'}</span>`}
          ${playable(g) && onAndroid(g) ? `<a class="btn line lg" href="#/download">${droidIcon}<span>Also on Android</span></a>` : ''}
        </div>
        <p class="fine">${playable(g) ? 'Free. Install and play it in the Spectra Launcher.' : "Not out yet. It'll appear in the Spectra Launcher on release day."}</p>
      </div>
    </section>
    <section class="wrap gbody" style="--g:${glow(g)}">
      <div class="gmain">
        ${g.description ? `<p class="lead big">${esc(g.description)}</p>` : ''}
        ${Array.isArray(g.screenshots) && g.screenshots.length ? `<div class="shots">${g.screenshots.map((s) => `<div class="shot"><img src="${esc(s)}" alt="" loading="lazy"></div>`).join('')}</div>` : ''}
        ${g.features.length ? `${label('A', 'Features')}<ol class="feats">${g.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ol>` : ''}
        ${g.achievements.length ? `${label('B', `Achievements · ${g.achievements.filter((a) => !a.secret).length}`)}<div class="ach">${g.achievements.filter((a) => !a.secret).map((a, i) => a.hidden ? '<div class="secret"><em>??</em><span><b>Hidden</b><p>Unlock it in the game to find out.</p></span></div>' : `<div><em>${String(i + 1).padStart(2, '0')}</em><span><b>${esc(a.name)}</b><p>${esc(a.desc)}</p></span></div>`).join('')}</div>` : ''}
        ${g.patchNotes.length ? `${label('C', 'Patch notes')}<div class="patches">${g.patchNotes.map((p) => `<div class="patch"><div class="p-head"><b>${esc(p.version)}</b><time>${fmtDate(p.date)}</time></div><ul>${(p.notes || []).map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
      </div>
      <aside class="gside">
        <div class="gcover">${img(g, 'cover', 300, 400)}</div>
        <dl class="spec">
          <div><dt>Status</dt><dd>${STATUS[g.status].label}</dd></div>
          ${g.version ? `<div><dt>Version</dt><dd>${esc(g.version)}${g.build != null ? ` · build ${esc(g.build)}` : ''}</dd></div>` : ''}
          <div><dt>Released</dt><dd>${fmtDate(g.released)}</dd></div>
          ${g.sizeBytes ? `<div><dt>Size</dt><dd>${fmtBytes(g.sizeBytes)}</dd></div>` : ''}
          <div><dt>Players</dt><dd>${isMulti(g) ? '1 · 2–4 online' : '1'}</dd></div>
          <div><dt>Platform</dt><dd>${platformsOf(g).map(esc).join(' · ')}</dd></div>
          <div><dt>Developer</dt><dd>Spectra</dd></div>
          <div><dt>Price</dt><dd>Free</dd></div>
        </dl>
      </aside>
    </section>
    ${more.length ? `<section class="wrap sec">${label('→', 'More from Spectra')}<div class="index">${more.map((x) => indexRow(x, GAMES.indexOf(x))).join('')}</div></section>` : ''}`;
  };

  pages.launcher = () => `
    <section class="wrap page-head">
      ${label('03', 'Spectra Launcher')}
      <h1>Your home for Spectra games</h1>
      <p class="lead">A small desktop app that installs, updates and launches every Spectra game, and keeps you playing with friends.</p>
      <div class="row gap wrap-row">${dlBtn()}</div>
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
          ['Can I play on my phone?', 'Yes, on Android. Get Spectra for Android from the download page. Games marked Android can be installed and played on your phone, and online games work across PC and phone.'],
          ['Mac, Linux or iPhone?', 'Not yet. Spectra runs on Windows and Android for now.'],
        ].map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}
      </div>
    </section>
    <section class="wrap sec">${ticket()}</section>`;

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
    const [name, arg] = h.split('/');
    const key = pages[name] ? name : 'home';
    if (beamStop) beamStop();
    app.innerHTML = `<div class="page page-${key}">${pages[key](arg && decodeURIComponent(arg))}</div>`;
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === (key === 'game' ? 'games' : key)));
    document.title = key === 'game' && byId[arg] ? `${byId[arg].title} · Spectra` : 'Spectra · Light goes in. Games come out.';
    document.body.classList.remove('menu-open');
    document.getElementById('menuBtn').setAttribute('aria-expanded', 'false');
    if (key === 'home') {
      startBeam();
      // a single colour sweep through "Games come out." so people notice it reacts
      const out = app.querySelector('.h-out');
      if (out && !reduceMotion) { setTimeout(() => out.classList.add('lit'), 700); setTimeout(() => out.classList.remove('lit'), 2600); }
    }
    if (key === 'games') bindGames();
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
    document.querySelectorAll('[data-genre]').forEach((b) => b.addEventListener('click', () => {
      gFilter.genre = b.dataset.genre;
      document.querySelectorAll('[data-genre]').forEach((x) => x.classList.toggle('on', x === b));
      renderGrid();
    }));
  }

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

  loadCatalog().then(route);
  route();
})();
