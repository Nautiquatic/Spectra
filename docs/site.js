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
    'early-access': { label: 'Early Access', cls: 'ea' },
    'coming-soon': { label: 'Coming Soon', cls: 'soon' },
    'in-development': { label: 'In Development', cls: 'dev' },
  };
  const playable = (g) => g.status === 'available' || g.status === 'early-access';
  const check = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const dlIcon = '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 19h14"/></svg>';
  const winIcon = '<svg viewBox="0 0 24 24" class="fill"><path d="M3 5.5l7.5-1v7H3zM11.5 4.3L21 3v8.5h-9.5zM3 12.5h7.5v7L3 18.5zM11.5 12.5H21V21l-9.5-1.3z"/></svg>';

  // ---------- catalogue ----------
  let GAMES = [], NEWS = [], byId = {}, loadError = '', loaded = false;
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
      byId = Object.fromEntries(GAMES.map((g) => [g.id, g]));
    } catch (e) { loadError = e.message; }
    loaded = true;
  }

  // ---------- art helpers ----------
  const img = (g, kind, w, h, seed = '') => {
    const url = kind === 'cover' ? g.cover : g.banner;
    return url ? `<img src="${esc(url)}" alt="" loading="lazy" data-fb="${g.id}" data-kind="${kind}" data-w="${w}" data-h="${h}">` : SpectraArt.svg(g, { w, h, seed });
  };
  document.addEventListener('error', (e) => {
    const t = e.target;
    if (t.tagName === 'IMG' && t.dataset.fb && byId[t.dataset.fb]) t.outerHTML = SpectraArt.svg(byId[t.dataset.fb], { w: +t.dataset.w, h: +t.dataset.h });
  }, true);
  const pill = (g) => `<span class="pill ${STATUS[g.status].cls}">${STATUS[g.status].label}</span>`;

  // ---------- download button ----------
  const dlHref = () => CFG.downloadUrl || '#/download';
  const dlBtn = (cls = 'lg') => CFG.downloadUrl
    ? `<a class="btn primary ${cls}" href="${esc(CFG.downloadUrl)}" download>${winIcon}<span>Download for Windows</span></a>`
    : `<a class="btn primary ${cls}" href="#/download">${dlIcon}<span>Download launcher</span></a>`;

  function gameCard(g) {
    return `<a class="gcard" href="#/game/${g.id}">
      <div class="gcard-art">${img(g, 'cover', 300, 400)}</div>
      <div class="gcard-body">
        <div class="row between"><b>${esc(g.title)}</b>${pill(g)}</div>
        <p>${esc(g.tagline)}</p>
        <span class="muted small">${g.genres.map(esc).join(' · ') || '&nbsp;'}</span>
      </div>
    </a>`;
  }
  const noGames = (compact) => `<div class="empty ${compact ? 'compact' : ''}">
      <img src="assets/spectra-logo.svg" alt="">
      <h3>${loadError ? "Couldn't load the game list" : 'No games yet'}</h3>
      <p class="muted">${loadError ? 'Please try again in a bit.' : "Spectra's first games are on the way. Grab the launcher now and they'll show up there the day they release."}</p>
    </div>`;

  // ---------- launcher mockup (pure HTML, mirrors the real app) ----------
  function launcherMock() {
    const gs = GAMES.slice(0, 4);
    return `<div class="mock">
      <div class="mock-side">
        <div class="mock-brand"><img src="assets/spectra-logo.svg" alt=""><b>Spectra</b></div>
        <i class="on">Home</i><i>Store</i><i>Library</i><i>Downloads</i>
        <small>QUICK LAUNCH</small>
        ${gs.slice(0, 2).map((g) => `<div class="mock-q"><span>${SpectraArt.svg(g, { w: 60, h: 80 })}</span>${esc(g.title)}</div>`).join('') || '<div class="mock-q muted">—</div>'}
      </div>
      <div class="mock-main">
        <div class="mock-search"></div>
        <div class="mock-hero">
          ${gs[0] ? SpectraArt.svg(gs[0], { w: 800, h: 340 }) : '<img src="assets/spectra-logo-dark.png" alt="" class="mock-logo">'}
          <div class="mock-hero-txt"><b>${gs[0] ? esc(gs[0].title) : 'Every frame, refracted.'}</b><span class="mock-btn">${gs[0] ? '▶ Play' : 'Store'}</span></div>
        </div>
        <div class="mock-row">${(gs.length ? gs : [null, null, null, null]).map((g) => `<div class="mock-tile">${g ? SpectraArt.svg(g, { w: 150, h: 200 }) : ''}</div>`).join('')}</div>
      </div>
    </div>`;
  }

  // ---------- pages ----------
  const pages = {};

  pages.home = () => {
    const featured = (GAMES.filter((g) => g.featured).length ? GAMES.filter((g) => g.featured) : GAMES).slice(0, 3);
    return `
    <section class="hero">
      <div class="beams" aria-hidden="true">${SpectraArt.RAYS.map((c, i) => `<i style="--c:${c};--i:${i}"></i>`).join('')}</div>
      <div class="wrap hero-in">
        <div class="hero-copy">
          <span class="kicker">Spectra Launcher · v${esc(CFG.launcherVersion)}</span>
          <h1>Every frame,<br><span class="grad">refracted.</span></h1>
          <p class="lead">Spectra makes games. The Spectra Launcher is where you install them, keep them updated and play them. It's free, and so are the games.</p>
          <div class="row gap wrap-row">${dlBtn()}<a class="btn ghost lg" href="#/games">Browse games</a></div>
          <p class="muted small">Windows 10 / 11 · ${esc(CFG.launcherSize)} · No account needed</p>
        </div>
        <div class="hero-visual">${launcherMock()}</div>
      </div>
    </section>

    <section class="wrap sec">
      <div class="sec-head"><div><span class="kicker">The games</span><h2>${GAMES.length ? 'Made by Spectra' : 'Coming soon'}</h2></div>${GAMES.length ? '<a class="link" href="#/games">See all games →</a>' : ''}</div>
      ${GAMES.length ? `<div class="feat-grid">${featured.map((g, i) => `
        <a class="feat ${i === 0 ? 'big' : ''}" href="#/game/${g.id}">
          <div class="feat-art">${img(g, 'banner', i === 0 ? 1200 : 700, i === 0 ? 700 : 420, 'f')}</div>
          <div class="feat-body">${pill(g)}<h3>${esc(g.title)}</h3><p>${esc(g.tagline)}</p></div>
        </a>`).join('')}</div>` : noGames()}
    </section>

    <section class="wrap sec">
      <div class="sec-head"><div><span class="kicker">The launcher</span><h2>One app for every Spectra game</h2></div></div>
      <div class="features">
        ${[
          ['One-click installs', 'Pick a game, hit Install, and the launcher downloads and sets it up for you.', '#5ec8ff'],
          ['Always up to date', 'New versions arrive through the launcher, so you are always on the latest build.', '#5ee8a4'],
          ['Your library', 'Favorites, playtime tracking and achievements for every game, all in one place.', '#ffb35c'],
          ['Free, no account', 'No sign-up, no store checkout. Install the launcher and start playing.', '#ff5e8e'],
        ].map(([t, d, c]) => `<div class="feature" style="--c:${c}"><i></i><h3>${t}</h3><p>${d}</p></div>`).join('')}
      </div>
    </section>

    ${NEWS.length ? `<section class="wrap sec">
      <div class="sec-head"><div><span class="kicker">News</span><h2>What's new</h2></div></div>
      <div class="news">${NEWS.slice(0, 3).map((n) => {
        const g = byId[n.game];
        return `<${g ? `a href="#/game/${g.id}"` : 'div'} class="news-card">
          <div class="news-art">${n.image ? `<img src="${esc(n.image)}" alt="">` : g ? img(g, 'banner', 600, 340, 'n') : '<img src="assets/spectra-logo-dark.png" alt="">'}</div>
          <div class="news-body"><span class="pill info">${esc(n.tag || 'News')}</span><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><time>${fmtDate(n.date)}</time></div>
        </${g ? 'a' : 'div'}>`;
      }).join('')}</div>
    </section>` : ''}

    <section class="wrap sec">
      <div class="cta">
        <img src="assets/spectra-logo.svg" alt="">
        <div><h2>Ready to play?</h2><p>Download the Spectra Launcher and every Spectra game is one click away.</p></div>
        ${dlBtn()}
      </div>
    </section>`;
  };

  let gFilter = { q: '', genre: 'All', status: 'all' };
  pages.games = () => {
    const genres = ['All', ...new Set(GAMES.flatMap((g) => g.genres))];
    return `
    <section class="wrap page-head">
      <span class="kicker">Library</span>
      <h1>All games</h1>
      <p class="lead">Everything Spectra has made or is making. Install and play them through the Spectra Launcher.</p>
    </section>
    <section class="wrap">
      ${GAMES.length ? `
      <div class="toolbar">
        <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg><input id="gq" placeholder="Search games" value="${esc(gFilter.q)}"></label>
        <div class="chips">${genres.map((x) => `<button class="chip ${gFilter.genre === x ? 'on' : ''}" data-genre="${esc(x)}">${esc(x)}</button>`).join('')}</div>
        <select id="gstatus" class="select">
          <option value="all">Any status</option>
          <option value="playable" ${gFilter.status === 'playable' ? 'selected' : ''}>Playable now</option>
          <option value="upcoming" ${gFilter.status === 'upcoming' ? 'selected' : ''}>Upcoming</option>
        </select>
      </div>
      <div id="gameGrid"></div>` : noGames()}
    </section>`;
  };
  function renderGrid() {
    const el = document.getElementById('gameGrid');
    if (!el) return;
    const list = GAMES.filter((g) =>
      (!gFilter.q || g.title.toLowerCase().includes(gFilter.q.toLowerCase())) &&
      (gFilter.genre === 'All' || g.genres.includes(gFilter.genre)) &&
      (gFilter.status === 'all' || (gFilter.status === 'playable' ? playable(g) : !playable(g))));
    el.innerHTML = list.length ? `<div class="grid">${list.map(gameCard).join('')}</div>` : '<p class="muted none">No games match those filters.</p>';
  }

  pages.game = (id) => {
    const g = byId[id];
    if (!g && !loaded) return '<section class="wrap page-head"><p class="muted">Loading…</p></section>';
    if (!g) return `<section class="wrap page-head"><h1>Game not found</h1><p class="lead">That game isn't in the Spectra catalogue.</p><a class="btn ghost" href="#/games">Back to games</a></section>`;
    const shots = Array.isArray(g.screenshots) && g.screenshots.length
      ? g.screenshots.map((s) => `<div class="shot"><img src="${esc(s)}" alt="" loading="lazy"></div>`).join('')
      : [1, 2, 3].map((n) => `<div class="shot">${SpectraArt.svg(g, { w: 640, h: 360, seed: 's' + n })}</div>`).join('');
    const more = GAMES.filter((x) => x.id !== g.id).slice(0, 4);
    return `
    <section class="ghero">
      <div class="ghero-art">${img(g, 'banner', 1600, 700)}</div>
      <div class="ghero-shade"></div>
      <div class="wrap ghero-in">
        <a class="back" href="#/games">← All games</a>
        <div class="row gap">${pill(g)}<span class="muted">${g.genres.map(esc).join(' · ')}</span></div>
        <h1>${esc(g.title)}</h1>
        <p class="tagline">${esc(g.tagline)}</p>
        <div class="row gap wrap-row">
          ${playable(g) ? dlBtn() : `<span class="btn ghost lg static">Coming ${g.released ? fmtDate(g.released) : 'soon'}</span>`}
        </div>
        <p class="muted small get-note">${playable(g) ? 'Free. Install and play it through the Spectra Launcher.' : "Not out yet. It'll appear in the Spectra Launcher on release day."}</p>
      </div>
    </section>
    <section class="wrap gbody">
      <div>
        ${g.description ? `<p class="lead">${esc(g.description)}</p>` : ''}
        <div class="shots">${shots}</div>
        ${g.features.length ? `<h2>Features</h2><ul class="flist">${g.features.map((f) => `<li>${check}<span>${esc(f)}</span></li>`).join('')}</ul>` : ''}
        ${g.achievements.length ? `<h2>Achievements <span class="muted">${g.achievements.length}</span></h2><div class="ach">${g.achievements.map((a) => a.hidden ? '<div class="secret"><b>Hidden achievement</b><p>Unlock it in the game to find out.</p></div>' : `<div>${a.icon ? `<img src="${esc(a.icon)}" alt="">` : ''}<span><b>${esc(a.name)}</b><p>${esc(a.desc)}</p></span></div>`).join('')}</div>` : ''}
        ${g.patchNotes.length ? `<h2>Patch notes</h2>${g.patchNotes.map((p) => `<div class="patch"><div class="row between"><b>Version ${esc(p.version)}</b><time class="muted">${fmtDate(p.date)}</time></div><ul>${(p.notes || []).map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`).join('')}` : ''}
      </div>
      <aside class="info">
        <div class="info-cover">${img(g, 'cover', 300, 400)}</div>
        <dl>
          <div><dt>Status</dt><dd>${STATUS[g.status].label}</dd></div>
          ${g.version ? `<div><dt>Version</dt><dd>${esc(g.version)}</dd></div>` : ''}
          <div><dt>Release</dt><dd>${fmtDate(g.released)}</dd></div>
          ${g.sizeBytes ? `<div><dt>Size</dt><dd>${fmtBytes(g.sizeBytes)}</dd></div>` : ''}
          <div><dt>Platform</dt><dd>${g.platforms.map(esc).join(', ')}</dd></div>
          <div><dt>Developer</dt><dd>Spectra</dd></div>
          <div><dt>Price</dt><dd class="free">Free</dd></div>
        </dl>
      </aside>
    </section>
    ${more.length ? `<section class="wrap sec"><div class="sec-head"><div><h2>More from Spectra</h2></div></div><div class="grid">${more.map(gameCard).join('')}</div></section>` : ''}`;
  };

  pages.launcher = () => `
    <section class="wrap page-head">
      <span class="kicker">Spectra Launcher</span>
      <h1>Your home for Spectra games</h1>
      <p class="lead">A small desktop app that installs, updates and launches every Spectra game.</p>
      <div class="row gap wrap-row">${dlBtn()}</div>
    </section>
    <section class="wrap sec"><div class="mock-wide">${launcherMock()}</div></section>
    <section class="wrap sec two">
      <div>
        <h2>What it does</h2>
        <ul class="flist single">
          ${['Browse every Spectra game in the Store', 'Install with one click, with pause and resume', 'Launch games and track your playtime', 'See achievements and patch notes for each game', 'Choose where games are installed', 'Works offline once your games are installed'].map((f) => `<li>${check}<span>${f}</span></li>`).join('')}
        </ul>
      </div>
      <div>
        <h2>System requirements</h2>
        <dl class="req">
          <div><dt>OS</dt><dd>Windows 10 or 11 (64-bit)</dd></div>
          <div><dt>Launcher size</dt><dd>${esc(CFG.launcherSize)}</dd></div>
          <div><dt>Internet</dt><dd>Needed to download games</dd></div>
          <div><dt>Games</dt><dd>Each game lists its own size</dd></div>
        </dl>
      </div>
    </section>
    <section class="wrap sec" id="faq">
      <h2>FAQ</h2>
      <div class="faq">
        ${[
          ['Is it free?', 'Yes. The launcher is free, and Spectra games are free to play.'],
          ['Do I need an account?', 'No. Download the launcher, install a game and play.'],
          ['Can I play games in the browser?', "No. This site is for browsing. Games are installed and played through the Spectra Launcher on your PC."],
          ['Where are games installed?', 'By default in a "Spectra Games" folder in your user folder. You can change it in the launcher settings.'],
          ['Is Mac or Linux supported?', 'Not yet. Spectra games are Windows-only for now.'],
        ].map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}
      </div>
    </section>`;

  pages.download = () => `
    <section class="wrap page-head center">
      <img class="dl-logo" src="assets/icon.png" alt="">
      <h1>Download Spectra Launcher</h1>
      <p class="lead">Version ${esc(CFG.launcherVersion)} · Windows 10 / 11 · ${esc(CFG.launcherSize)}</p>
      ${CFG.downloadUrl
        ? `<div class="row gap center-row">${dlBtn()}</div><p class="muted small">Download not starting? <a class="link" href="${esc(CFG.downloadUrl)}">Click here</a>.</p>`
        : `<div class="row gap center-row"><span class="btn ghost lg static">${dlIcon}<span>Coming soon</span></span></div><p class="muted small">The launcher download isn't up yet. Check back soon.</p>`}
    </section>
    <section class="wrap sec">
      <div class="steps">
        ${[['Download', 'Get the installer from this page.'], ['Install', 'Run it. The launcher sets itself up in a few seconds.'], ['Play', 'Open the Store tab, install a game and press Play.']].map(([t, d], i) => `<div class="step"><span>${i + 1}</span><h3>${t}</h3><p>${d}</p></div>`).join('')}
      </div>
    </section>`;

  // ---------- router ----------
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [name, arg] = h.split('/');
    const key = pages[name] ? name : 'home';
    app.innerHTML = `<div class="page">${pages[key](arg && decodeURIComponent(arg))}</div>`;
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === (key === 'game' ? 'games' : key)));
    document.title = key === 'game' && byId[arg] ? `${byId[arg].title} | Spectra` : 'Spectra: Every frame, refracted.';
    document.body.classList.remove('menu-open');
    if (key === 'games') bindGames();
    if (h === 'launcher' && window._faq) { window._faq = false; setTimeout(() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }), 50); }
    else window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function bindGames() {
    renderGrid();
    const q = document.getElementById('gq');
    if (!q) return;
    q.addEventListener('input', () => { gFilter.q = q.value; renderGrid(); });
    document.getElementById('gstatus').addEventListener('change', (e) => { gFilter.status = e.target.value; renderGrid(); });
    document.querySelectorAll('[data-genre]').forEach((b) => b.addEventListener('click', () => {
      gFilter.genre = b.dataset.genre;
      document.querySelectorAll('[data-genre]').forEach((x) => x.classList.toggle('on', x === b));
      renderGrid();
    }));
  }

  document.querySelector('[data-faq]').addEventListener('click', () => (window._faq = true));
  document.getElementById('menuBtn').addEventListener('click', () => document.body.classList.toggle('menu-open'));
  window.addEventListener('scroll', () => document.getElementById('nav').classList.toggle('solid', scrollY > 10), { passive: true });
  window.addEventListener('hashchange', route);
  document.getElementById('year').textContent = new Date().getFullYear();
  document.querySelectorAll('[data-download]').forEach((a) => (a.href = dlHref()));
  if (CFG.contactEmail) { const c = document.getElementById('contactLink'); c.href = 'mailto:' + CFG.contactEmail; c.hidden = false; }

  loadCatalog().then(route);
  route();
})();
