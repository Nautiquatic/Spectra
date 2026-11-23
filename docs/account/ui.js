(function () {
  const A = window.SpectraWebAccount;
  const cfg = window.SPECTRA_SITE || {};
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const userLink = (name) => '#/u/' + encodeURIComponent(name);
  const date = (value) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const button = (title, action, value = '') => `<button type="button" class="btn line sm" data-act="${action}" data-value="${esc(value)}">${title}</button>`;
  const field = (label, type, name, attrs = '') => `<label class="account-field"><span>${label}</span><input name="${name}" type="${type}" required ${attrs}></label>`;
  const email = () => field('Email address', 'email', 'email', 'autocomplete="email" maxlength="254"');
  const current = (label = 'Current password') => field(label, 'password', 'password', 'autocomplete="current-password"');
  const password = (label = 'New password', name = 'next') => field(label, 'password', name, 'autocomplete="new-password" minlength="8" maxlength="128"');
  const form = (title, action, fields, submit) => `<form class="account-card" data-form="${action}">${title ? `<h2>${title}</h2>` : ''}${fields}
    <button class="btn solid sm" type="submit">${submit}</button><p class="account-feedback" data-feedback role="status"></p></form>`;
  const layout = (title, content, nav = '') => `<section class="wrap accounts"><header class="account-head"><h1>${title}</h1>${nav}</header>${content}</section>`;
  const errorText = (message) => `<p class="account-feedback error" role="alert">${esc(message)}</p>`;
  const feedbackLine = '<p data-page-feedback class="account-feedback" role="status"></p>';
  const validAvatar = (value) => typeof value === 'string' && value.length <= 65536 && /^data:image\/webp;base64,[a-z0-9+/]+=*$/i.test(value);
  // Spectra-themed avatar icons (same set as the launcher)
  const ICONS = {
    prism: '<path d="M12 3.5 21 19H3z"/><path d="M12 3.5 14 19M7 12.5h10"/>',
    ship: '<path d="M12 2.5 18.5 20 12 15.8 5.5 20z"/><circle cx="12" cy="10.5" r="1.6" class="f"/>',
    hex: '<path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4z"/><path d="M12 7.5 16 9.8v4.4L12 16.5 8 14.2V9.8z"/>',
    diamond: '<path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/><path d="M12 7 17 12 12 17 7 12z"/>',
    lens: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.6" class="f"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>',
    spark: '<path d="M12 2.5c.9 5 2.5 6.6 7.5 9.5-5 2.9-6.6 4.5-7.5 9.5-.9-5-2.5-6.6-7.5-9.5 5-2.9 6.6-4.5 7.5-9.5z"/>',
    orbit: '<circle cx="12" cy="12" r="3" class="f"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-25 12 12)"/>',
    rift: '<path d="M4 4l6.5 6.5M20 4l-6.5 6.5M4 20l6.5-6.5M20 20l-6.5-6.5"/><circle cx="12" cy="12" r="2.4"/>',
  };
  const iconSvg = (id) => (ICONS[id] ? `<svg class="avatar-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[id]}</svg>` : '');
  const BANNERS = ['', '#927dff', '#5ec8ff', '#5ee8a4', '#f2f27a', '#ffb35c', '#ff5e8e', '#c86bff', 'spectrum'];
  const bannerCss = (b) => (b === 'spectrum' ? 'linear-gradient(100deg,#ff5e8e,#ffb35c,#f2f27a,#5ee8a4,#5ec8ff,#927dff)' : /^#[0-9a-f]{6}$/i.test(b || '') ? `linear-gradient(120deg, ${b}, color-mix(in srgb, ${b} 35%, #08080c))` : '');
  const safeLink = (u) => { try { const x = new URL(String(u)); return x.protocol === 'https:' && !x.username && !x.password ? x.href : ''; } catch { return ''; } };
  const linkLabel = (u) => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/$/, '')).slice(0, 40); } catch { return u; } };
  const avatar = (p, extras, large = false) => {
    const color = /^#[a-f0-9]{6}$/i.test(p?.avatar_color) ? p.avatar_color : '#927dff';
    const letter = (p?.display_name || p?.username || '?').slice(0, 1).toUpperCase();
    const inner = validAvatar(extras?.avatar) ? `${esc(letter)}<img src="${extras.avatar}" alt="">` : ICONS[extras?.avatarIcon] ? iconSvg(extras.avatarIcon) : esc(letter);
    return `<span class="account-avatar ${large ? 'large' : ''}" style="--avatar-color:${color}">${inner}</span>`;
  };
  let profileSort = 'playtime';
  const navigation = (current, entries) => `<nav class="account-tabs" aria-label="Account">${entries.map(([key, label]) =>
    `<a href="#/account${key ? '/' + key : ''}" ${key === current ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
  const tabs = (key) => navigation(key, [['', 'Profile'], ['library', 'My Library'], ['friends', 'Friends'], ['settings', 'Settings']]);
  const authNav = (key) => navigation(key, [['', 'Sign in'], ['register', 'Register'], ['forgot', 'Forgot password'], ['resend', 'Resend verification']]);
  let navVersion = 0, active, banner = '';
  const mailLink = window.SpectraReadMailLink?.();
  let mailCheck;

  async function updateNav() {
    const link = document.getElementById('navAccount');
    if (!link || !A.available) return;
    const version = ++navVersion;
    const user = await A.user().catch(() => null);
    const p = user ? await A.profile(user.id).catch(() => null) : null;
    const extras = p ? await A.extras(user.id).catch(() => null) : null;
    if (version === navVersion) link.innerHTML = p ? `${avatar(p, extras)}<span>${esc(p.username)}</span>` : user ? 'Account' : 'Sign in';
  }

  async function avatarData(file) {
    if (!file.size || file.size > 8 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG or WebP image under 8 MB.');
    const image = await createImageBitmap(file);
    try {
      const side = Math.min(image.width, image.height), canvas = document.createElement('canvas');
      canvas.width = canvas.height = 160;
      canvas.getContext('2d').drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 160, 160);
      const result = canvas.toDataURL('image/webp', 0.78);
      if (!validAvatar(result)) throw new Error('Could not use that picture.');
      return result;
    } finally { image.close(); }
  }

  function authPage(tab) {
    if (tab === 'register') return layout('Create an account', form('', 'register', email()
      + field('Username', 'text', 'username', 'autocomplete="username" minlength="3" maxlength="20" pattern="[A-Za-z0-9_]{3,20}"')
      + '<label class="account-field"><span>Display name <small>(optional)</small></span><input name="displayName" maxlength="24" autocomplete="nickname"></label>'
      + password('Password', 'password'), 'Register'), authNav(tab));
    if (tab === 'forgot' || tab === 'resend') {
      const reset = tab === 'forgot';
      return layout(reset ? 'Reset your password' : 'Resend verification', form('', tab, email(),
        reset ? 'Send reset link' : 'Send verification link'), authNav(tab));
    }
    return layout('Sign in', (banner ? `<p class="account-feedback" role="status">${esc(banner)}</p>` : '')
      + form('', 'signin', email() + current('Password'), 'Sign in'), authNav(''));
  }

  function gameRow(context, id, progress, install) {
    const game = context.games[id];
    const catalog = Array.isArray(game?.achievements) ? game.achievements : [];
    const publicAchievements = catalog.filter((a) => !a.secret);
    const count = publicAchievements.filter((a) => progress?.[a.id]).length;
    const earned = catalog.filter((a) => progress?.[a.id]);
    const action = !install || !game || !context.playable(game) ? '' : cfg.launcherProtocol === true
      ? `<a class="btn solid sm" href="spectra://install/${id}">Install</a>` : '<a class="btn line sm" href="#/download">Get launcher</a>';
    return `<article class="account-game"><div class="account-game-top"><div><strong>${game ? `<a href="#/game/${id}">${esc(game.title)}</a>` : esc(id)}</strong>
      ${publicAchievements.length ? `<span>${count + catalog.filter((a) => a.secret && progress?.[a.id]).length}/${publicAchievements.length} achievements ${(() => { const b = window.SpectraTiers?.doneTiers(catalog, (a) => progress?.[a.id]).pop(); return b ? window.SpectraTiers.badge(b) : ''; })()}</span>` : ''}</div>${action}</div>
      ${earned.length ? `<details><summary>Unlocked achievements</summary><ul>${earned.map((a) => `<li>${esc(a.name)} <small>${esc(date(Number(progress[a.id])))}</small></li>`).join('')}</ul></details>` : ''}</article>`;
  }

  const trophy = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 1v5m-4 2h8m-7-2h6"/></svg>';
  const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum'];
  const tierRank = (a) => Math.max(0, tiers.findIndex((tier) => tier.toLowerCase() === a.tier));
  const nonnegative = (v) => Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0;
  function duration(seconds) {
    const value = Math.floor(nonnegative(seconds));
    if (!value) return '—';
    const minutes = Math.floor(value / 60), hours = Math.floor(minutes / 60);
    return hours ? `${hours}h${minutes % 60 ? ' ' + minutes % 60 + 'm' : ''}` : minutes ? minutes + 'm' : value + 's';
  }
  function ago(value, now) {
    const mins = Math.max(0, Math.floor((now - value) / 60000));
    if (!mins) return 'just now';
    if (mins < 60) return mins + ' min ago';
    if (mins < 1440) return Math.floor(mins / 60) + ' h ago';
    const days = Math.floor(mins / 1440);
    return days < 7 ? days + ' d ago' : date(value);
  }
  const profileGameUrl = (id) => '#/game/' + encodeURIComponent(id);
  const panel = (title, html) => `<section class="player-section"><h2>${title}</h2>${html}</section>`;
  const avatarColor = (p) => /^#[a-f0-9]{6}$/i.test(p.avatar_color) ? p.avatar_color : '#5ec8ff';
  function cover(game) {
    const url = typeof game.cover === 'string' ? game.cover : '';
    let href = null;
    try { if (url) href = new URL(url, document.baseURI); } catch {}
    const safe = href && (href.protocol === 'https:' || href.origin === location.origin);
    return `<div class="player-cover">${safe ? `<img src="${esc(href.href)}" alt="" loading="lazy" data-fb="${game.id}" data-kind="cover" data-w="192" data-h="256">`
      : `<span class="player-cover-letter">${esc(game.title.slice(0, 1))}</span>`}</div>`;
  }
  function presenceLine(presence, games, now) {
    const lastSeen = Date.parse(presence?.last_seen);
    if (!Number.isFinite(lastSeen) || presence.status === 'offline' || now - lastSeen >= 180000) return '';
    const playing = Object.hasOwn(games, presence.now_playing) ? games[presence.now_playing] : null;
    const status = playing?.id ? 'Playing ' + playing.title : { online: 'Online', away: 'Away', dnd: 'Do not disturb' }[presence.status];
    return status ? `<p class="player-presence"><i aria-hidden="true"></i>${esc(status)}</p>` : '';
  }
  function featured(game, now) {
    const notes = Array.isArray(game.patchNotes) ? game.patchNotes : [];
    const posted = Date.parse(game.updated || notes.find((note) => note.version === game.version)?.date);
    const age = Number.isFinite(posted) ? Math.floor(Math.max(0, now - posted) / 86400000) : null;
    const updated = age === null ? '' : age ? ' · updated ' + age + ' day' + (age === 1 ? '' : 's') + ' ago' : ' · updated today';
    return `<section class="player-panel player-feature" aria-label="Featured game">
      ${cover(game)}<div><p class="muted">Featured game</p><h2>${esc(game.title)}</h2>
      ${game.tagline ? `<p>${esc(game.tagline)}</p>` : ''}
      ${game.version ? `<p class="player-version">v${esc(String(game.version).replace(/^v/i, ''))}${esc(updated)}</p>` : ''}
      <a class="btn line sm" href="${profileGameUrl(game.id)}">View game</a></div></section>`;
  }
  function stat(label, value) {
    return `<div class="player-panel player-stat"><dt>${label}</dt><dd>${value}</dd></div>`;
  }

  function profilePage(context, p, extras, stats, library, ownProfile, presence) {
    if (!p) return layout('Profile not found', '<p class="muted">Check the username and try again.</p>');
    const now = Date.now(), joined = Date.parse(p.created_at);
    const today = new Date(now), monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
    const games = context.games;
    // Public pages render game details and aggregate stats only for published catalogue entries.
    const published = (id) => Object.hasOwn(games, id) && games[id]?.id === id;
    const owned = A.ids(ownProfile ? library?.data?.owned : extras.publicLibrary).filter(published);
    const knownRows = stats.filter((row) => published(row.game_id));
    const byGame = new Map(knownRows.map((row) => [row.game_id, row]));
    const visible = A.ids([...owned, ...byGame.keys()]).sort((a, b) =>
      nonnegative(byGame.get(b)?.playtime) - nonnegative(byGame.get(a)?.playtime) || games[a].title.localeCompare(games[b].title));
    const total = knownRows.reduce((sum, row) => sum + nonnegative(row.playtime), 0);
    const ownSessions = library?.data?.longestSession || {};
    const longest = ownProfile ? Math.max(0, ...visible.map((id) => nonnegative(ownSessions[id]))) : nonnegative(extras.longestSession);
    const earned = knownRows.flatMap((row) => {
      const game = games[row.game_id];
      return (Array.isArray(game.achievements) ? game.achievements : []).flatMap((achievement) => {
        const at = nonnegative(row.achievements?.[achievement.id]);
        return at > 0 && at <= now ? [{ game, achievement, at }] : [];
      });
    });
    const picks = Array.isArray(extras.showcase) ? extras.showcase.filter((k) => typeof k === 'string').slice(0, 5) : [];
    const picked = picks.map((k) => earned.find(({ game, achievement }) => game.id + ':' + achievement.id === k)).filter(Boolean);
    const showcase = picked.length ? picked : earned.slice().sort((a, b) => tierRank(b.achievement) - tierRank(a.achievement) || b.at - a.at).slice(0, 5);
    const activity = [
      ...knownRows.map((row) => ({ id: row.game_id, at: Date.parse(row.last_played), label: 'Played ' + games[row.game_id].title })),
      ...earned.map(({ game, achievement, at }) => ({ id: game.id, at, label: 'Unlocked ' + achievement.name, achievement: true })),
    ].filter((item) => item.at > 0 && item.at <= now).sort((a, b) => b.at - a.at).slice(0, 6);
    const pinned = published(extras.pinnedGame) ? games[extras.pinnedGame] : null;
    const editLink = ownProfile ? '<a class="btn line sm" href="#/account/settings/profile">Edit profile</a>' : '';
    const canFriend = !ownProfile && context.account && context.account.id !== p.id;
    const showOwned = ownProfile || Array.isArray(extras.publicLibrary);

    return `<section class="wrap player-profile">
      ${ownProfile ? tabs('') : ''}
      <header class="player-panel player-identity ${bannerCss(extras.banner) ? 'has-banner' : ''}" style="--profile-accent:${avatarColor(p)};${bannerCss(extras.banner) ? '--banner:' + bannerCss(extras.banner) : ''}">
        ${ownProfile ? `<a class="avatar-edit" href="#/account/settings/avatar" title="Change avatar">${avatar(p, extras, true)}<span>Change avatar</span></a>` : avatar(p, extras, true)}
        <div class="player-identity-text">
          <h1>${esc(p.display_name || p.username)}${(window.SpectraRank || (() => ''))(p)}</h1>
          <p class="muted">&#64;${esc(p.username)}${extras.pronouns ? ' · ' + esc(String(extras.pronouns).slice(0, 20)) : ''}${date(p.created_at) ? ' · Joined ' + esc(date(p.created_at)) : ''}</p>
          ${presenceLine(presence, games, now)}
          ${p.bio ? `<p class="player-bio">${esc(p.bio)}</p>` : ownProfile ? '<a class="player-bio-link" href="#/account/settings/bio">Add a bio</a>' : '<p class="muted">No bio yet.</p>'}
          ${Array.isArray(extras.links) && extras.links.some(safeLink) ? `<p class="player-links">${extras.links.map(safeLink).filter(Boolean).slice(0, 3).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer nofollow">↗ ${esc(linkLabel(u))}</a>`).join('')}</p>` : ''}
        </div>
        <div class="player-actions">${editLink}${canFriend ? button('Add friend', 'add-friend', p.username) : ''}
          ${button('Share profile', 'copy-profile', p.username)}</div>
      </header>
      ${feedbackLine}
      ${pinned ? featured(pinned, now) : ''}
      <dl class="player-stats">
        ${stat('Total playtime', total ? duration(total) : '0m')}
        ${stat('Longest recorded session', duration(longest))}
        ${stat('Achievements', earned.length)}
        ${stat('Achievements this month', earned.filter(({ at }) => at >= monthStart).length)}
      </dl>
      ${total ? `<section class="player-panel player-split"><div class="split-head"><b>Playtime by game</b>${Number.isFinite(joined) ? `<span class="muted">Member for ${Math.max(0, Math.floor((now - joined) / 86400000))} days</span>` : ''}</div>
        <div class="split-bar">${visible.filter((id) => nonnegative(byGame.get(id)?.playtime)).map((id, i) => `<i style="width:${100 * nonnegative(byGame.get(id).playtime) / total}%;background:${SPLIT[i % SPLIT.length]}" title="${esc(games[id].title)}"></i>`).join('')}</div>
        <div class="split-key">${visible.filter((id) => nonnegative(byGame.get(id)?.playtime)).map((id, i) => `<span><i style="background:${SPLIT[i % SPLIT.length]}"></i>${esc(games[id].title)} <b>${duration(byGame.get(id).playtime)}</b> <em>${Math.round(100 * nonnegative(byGame.get(id).playtime) / total)}%</em></span>`).join('')}</div></section>` : ''}
      ${panel('Showcase', showcase.length ? `<div class="player-showcase">${showcase.map(({ game, achievement }) => {
        const tier = achievement.secret ? 'Secret' : tiers[tierRank(achievement)];
        return `<button class="player-panel player-trophy tier-${tier.toLowerCase()}" data-act="show-achievements" data-value="${game.id}" type="button">
          ${trophy}<strong>${esc(achievement.name)}</strong><span>${esc(game.title)} · ${tier}</span></button>`;
      }).join('')}</div>` : '<p class="muted">Unlocked achievements will appear here.</p>')}
      ${panel('Recent activity', `<ul class="player-panel player-activity">
        ${activity.map((item) => `<li>${item.achievement
          ? `<button type="button" data-act="show-achievements" data-value="${item.id}">${esc(item.label)}</button>`
          : `<a href="${profileGameUrl(item.id)}">${esc(item.label)}</a>`}<time datetime="${new Date(item.at).toISOString()}">${esc(ago(item.at, now))}</time></li>`).join('')}
        ${Number.isFinite(joined) ? `<li><span>Joined ${esc(date(p.created_at))}</span><span class="muted">Member for ${Math.max(0, Math.floor((now - joined) / 86400000))} days</span></li>` : ''}
        ${!activity.length && !Number.isFinite(joined) ? '<li class="muted">No recent activity.</li>' : ''}
      </ul>`)}
      ${panel('Games', (visible.length > 1 ? `<div class="chips player-sort">${[['playtime', 'Most played'], ['recent', 'Last played'], ['az', 'A–Z']].map(([k, l]) => `<button type="button" class="chip ${profileSort === k ? 'on' : ''}" data-act="profile-sort" data-value="${k}">${l}</button>`).join('')}</div>` : '')
        + (showOwned ? `<p class="muted player-owned">${owned.length} owned game${owned.length === 1 ? '' : 's'}</p>` : '')
        + (visible.length ? `<div class="player-panel player-games">${sortGames(visible, byGame, games).map((id) => playerGame(games[id], byGame.get(id), total, pinned?.id, ownProfile)).join('')}</div>`
          : '<p class="muted">Games and achievements will appear here.</p>'))}
    </section>`;
  }

  const SPLIT = ['#927dff', '#5ec8ff', '#5ee8a4', '#f2f27a', '#ffb35c', '#ff5e8e', '#c86bff'];
  function sortGames(ids, byGame, games) {
    return ids.slice().sort(profileSort === 'az' ? (a, b) => games[a].title.localeCompare(games[b].title)
      : profileSort === 'recent' ? (a, b) => (Date.parse(byGame.get(b)?.last_played) || 0) - (Date.parse(byGame.get(a)?.last_played) || 0)
        : (a, b) => nonnegative(byGame.get(b)?.playtime) - nonnegative(byGame.get(a)?.playtime));
  }
  function playerGame(game, row, total, pinned, ownProfile) {
    const catalog = Array.isArray(game.achievements) ? game.achievements : [];
    const unlocked = (achievement) => nonnegative(row?.achievements?.[achievement.id]) > 0;
    const published = catalog.filter((achievement) => !achievement.secret);
    const shown = catalog.filter((achievement) => !achievement.secret || unlocked(achievement));
    const done = published.filter(unlocked).length;
    const secretDone = catalog.filter((a) => a.secret && unlocked(a)).length;
    const complete = published.length && done === published.length;
    const T = window.SpectraTiers;
    const best = T ? T.doneTiers(catalog, unlocked).pop() : (complete ? 'gold' : '');
    const played = nonnegative(row?.playtime);
    return `<article class="player-game" data-profile-game="${game.id}">
      <div class="player-game-row">${cover(game)}<div class="player-game-title"><a href="${profileGameUrl(game.id)}">${esc(game.title)}</a>
        <p class="muted">${played ? duration(played) + ' played' + (total ? ' · ' + Math.round(100 * played / total) + '% of playtime' : '') : 'Not played yet'}</p></div>
      ${published.length ? `<button class="player-progress ${complete ? 'complete' : ''} ${done + secretDone > published.length ? 'over' : ''}" type="button" data-act="show-achievements" data-value="${game.id}" aria-label="View achievements for ${esc(game.title)}">
        <span>${done + secretDone}/${published.length} achievements</span>${best && T ? T.badge(best) : ''}
        <span class="player-bar"><i style="width:${Math.min(100, (100 * done) / published.length)}%"></i></span></button>` : ''}
      ${ownProfile ? button(game.id === pinned ? 'Unpin' : 'Pin game', 'pin-game', game.id === pinned ? '' : game.id) : ''}
      </div>
      ${shown.length ? `<details class="player-achievements"><summary>Achievements</summary><ul>${shown.map((a) => {
        const earned = unlocked(a);
        const title = !earned && a.hidden ? 'Hidden achievement' : a.name;
        return `<li><span class="tier-${a.secret ? 'secret' : tiers[tierRank(a)].toLowerCase()}">${trophy} ${esc(title)}${a.secret ? ' <small>Secret</small>' : ''}</span><small>${earned ? esc(date(Number(row.achievements[a.id]))) : 'Locked'}</small></li>`;
      }).join('')}</ul></details>` : ''}
    </article>`;
  }

  function libraryPage(context, library, stats) {
    const owned = A.ids(library?.data?.owned);
    const byGame = Object.fromEntries(stats.map((row) => [row.game_id, row.achievements]));
    return layout('My Library', `<p class="muted">${cfg.launcherProtocol === true ? 'Choose Install to open a game in Spectra Launcher.'
      : 'Your games sync from Spectra Launcher. To install a game, select it in the launcher’s Library.'}</p>
      ${owned.length ? owned.map((id) => gameRow(context, id, byGame[id], true)).join('') : '<div class="account-card"><p>No games have synced to this account yet.</p><a href="#/games">Browse games</a></div>'}
      ${library?.updated_at ? `<p class="muted">Last synced ${esc(date(library.updated_at))}</p>` : ''}`, tabs('library'));
  }

  function friendsPage(groups) {
    const list = (key, title, empty, remove) => `<section class="account-card"><h2>${title}</h2>
      ${groups[key].length ? groups[key].map((p) => `<div class="account-friend"><a href="${userLink(p.username)}">${avatar(p)}<span>${esc(p.display_name)}${(window.SpectraRank || (() => ''))(p)} <small>&#64;${esc(p.username)}</small></span></a>
        <div class="account-actions">${key === 'incoming' ? button('Accept', 'accept-friend', p.username) : ''}${button(remove, 'remove-friend', p.username)}</div></div>`).join('')
        : `<p class="muted">${empty}</p>`}</section>`;
    return layout('Friends', feedbackLine + `<div class="account-columns">
      ${form('Add by username', 'add-friend', field('Username', 'text', 'username', 'pattern="[A-Za-z0-9_]{3,20}" maxlength="20"'), 'Send request')}
      ${form('Share a Prismfall room', 'room-link', '<p class="muted">Host a match in Prismfall and enter its room code to create a shareable link.</p>'
        + field('Room code', 'text', 'code', 'pattern="[A-Za-z0-9]{4,6}" maxlength="6" autocomplete="off"'), 'Create invite link')}
      ${list('accepted', 'Friends', 'No friends yet.', 'Remove')}
      ${list('incoming', 'Incoming requests', 'No pending requests.', 'Decline')}
      ${list('outgoing', 'Sent requests', 'No sent requests.', 'Cancel')}</div>`, tabs('friends'));
  }

  function settingsPage(context, p, extras) {
    return layout('Account settings', feedbackLine + `<div class="account-columns">
      ${form('Profile', 'edit-profile', field('Display name', 'text', 'displayName', `maxlength="24" value="${esc(p?.display_name || '')}" autocomplete="nickname"`)
        + `<label class="account-field"><span>Bio <em class="bio-count" data-count-for="bio">${(p?.bio || '').length}/200</em></span><textarea name="bio" maxlength="200" rows="3">${esc(p?.bio || '')}</textarea></label>`
        + `<label class="account-field"><span>Pronouns <small>(optional)</small></span><input name="pronouns" maxlength="20" placeholder="e.g. they/them" value="${esc(extras.pronouns || '')}"></label>`
        + `<div class="account-field"><span>Links <small>(optional, https only)</small></span>${[0, 1, 2].map((i) => `<input name="link${i}" maxlength="200" placeholder="https://" value="${esc((Array.isArray(extras.links) && extras.links[i]) || '')}">`).join('')}</div>`, 'Save profile')}
      ${form('Username', 'username', `<p class="muted">You are <b>&#64;${esc(p?.username || '')}</b>. Friends find you by your username, so you can change it once every 30 days.</p>`
        + field('New username', 'text', 'username', 'minlength="3" maxlength="20" pattern="[A-Za-z0-9_]{3,20}" autocomplete="off"'), 'Change username')}
      ${(p?.role && ['owner', 'admin', 'moderator', 'tester'].includes(p.role)) || window.SpectraTag?.bestTag(p) ? form('Badges', 'badges',
        (p?.role ? `<label class="account-check"><input type="checkbox" name="hideRank" ${p.hideRank ? 'checked' : ''}> Hide my rank badge</label>` : '')
        + (window.SpectraTag?.bestTag(p) ? `<label class="account-check"><input type="checkbox" name="hideTag" ${p.hideTag ? 'checked' : ''}> Hide my achievement tag</label>` : '')
        + '<p class="muted">Hidden badges don’t show next to your name anywhere. Your rank still works.</p>', 'Save badges') : ''}
      ${form('Avatar', 'avatar', `<div class="account-actions">${avatar(p, extras, true)}${button('Remove picture', 'remove-avatar')}</div>
        ${field('Profile picture', 'file', 'photo', 'accept="image/png,image/jpeg,image/webp"').replace(' required', '')}
        <div class="account-field"><span>Or a Spectra icon</span><div class="icon-pick">${['', ...Object.keys(ICONS)].map((k) => `<label><input type="radio" name="icon" value="${k}" ${(extras.avatarIcon || '') === k ? 'checked' : ''}><span style="--avatar-color:${avatarColor(p)}">${k ? iconSvg(k) : esc((p?.display_name || '?')[0].toUpperCase())}</span></label>`).join('')}</div></div>
        <div class="account-field"><span>Banner</span><div class="icon-pick banner-pick">${BANNERS.map((c) => `<label><input type="radio" name="banner" value="${c}" ${(extras.banner || '') === c ? 'checked' : ''}><span style="background:${bannerCss(c) || 'transparent'}" title="${c || 'No banner'}">${c ? '' : '✕'}</span></label>`).join('')}</div></div>`, 'Save avatar')}
      ${form('Email address', 'email', `<p class="muted">Current email ${esc(context.account.email)}</p>${email()}${current()}`, 'Send confirmation')}
      ${form('Password', 'password', current() + password() + password('Confirm new password', 'repeat'), 'Change password')}
      <section class="account-card"><h2>Public profile</h2><p class="muted">Share a copy of your synced owned games. Share the list again after changes in the launcher.</p>
        <div class="account-actions">${button(Array.isArray(extras.publicLibrary) ? 'Refresh public library' : 'Share owned games', 'share-library')}
        ${Array.isArray(extras.publicLibrary) ? button('Hide owned games', 'hide-library') : ''}</div></section>
      <section class="account-card"><h2>Account data</h2><p class="muted">Download a JSON copy of your Spectra account data.</p>
        <div class="account-actions">${button('Export data', 'export')}${button('Sign out', 'signout')}</div></section>
      <details class="account-card account-delete"><summary>Delete account</summary><p>Permanently removes your Spectra account, synced profile, friends, library and achievements. Game files stay on your devices.</p>
        ${form('', 'delete', current() + field('Type DELETE to confirm', 'text', 'confirm', 'pattern="DELETE" autocomplete="off"'), 'Delete my account')}</details>
      </div>`, tabs('settings'));
  }

  function invitePage(game, code) {
    if (game !== 'prismfall' || !/^[A-Z0-9]{4,6}$/.test(code || '')) return layout('Invalid game invite', '<a href="#/account/friends">Go to Friends</a>');
    const action = cfg.launcherProtocol === true ? `<a class="btn solid sm" href="spectra://join/prismfall/${code}">Join in launcher</a>` : '';
    return layout('Join Prismfall', `<div class="account-card"><p>Open Prismfall, go to Multiplayer → Join, and enter this room code.</p>
      <strong class="room-code">${code}</strong><div class="account-actions">${button('Copy room code', 'copy-code', code)}${action}
      <a class="btn line sm" href="#/download">Get launcher</a></div>${feedbackLine}</div>`);
  }

  async function view(context) {
    if (context.section === 'join') return invitePage(context.arg, context.extra);
    if (!A.available) return layout('Spectra account', errorText('Accounts are unavailable right now. Try again shortly.'));
    if (context.section === 'account' && ['recover', 'verify-email'].includes(context.arg)) {
      const recover = context.arg === 'recover';
      if (!mailLink) return layout('Email link unavailable', '<p>Open the link in your email from Spectra.</p><a href="#/account/forgot">Request a password reset</a>');
      mailCheck ??= A.verifyMail(mailLink, recover ? 'reset' : 'confirm').then(() => context.arg);
      if (await mailCheck !== context.arg) throw new Error('This link cannot be used for this action.');
      if (recover) return layout('Choose a new password', form('', 'recover', password() + password('Confirm new password', 'repeat'), 'Save password'));
      updateNav();
      return layout('Email verified', '<p>Your account works on the website and in Spectra Launcher.</p><a class="btn solid sm" href="#/account">Continue</a>');
    }
    context.account = await A.user();
    if (context.section === 'u') {
      const p = await A.byUsername(context.arg || '');
      if (!p) return layout('Profile not found', '<p class="muted">Check the username and try again.</p>');
      const [extras, stats, presence] = await Promise.all([A.extras(p.id), A.stats(p.id), A.presence(p.id).catch(() => null)]);
      return profilePage(context, p, extras, stats, null, false, presence);
    }
    if (!context.account) return authPage(context.arg);
    const id = context.account.id;
    switch (context.arg) {
      case 'library': {
        const [library, stats] = await Promise.all([A.privateLibrary(id), A.stats(id)]);
        return libraryPage(context, library, stats);
      }
      case 'friends': return friendsPage(await A.friends());
      case 'settings': return settingsPage(context, await A.profile(id), await A.extras(id));
      default: {
        const [p, extras, stats, library, presence] = await Promise.all([A.profile(id), A.extras(id), A.stats(id), A.privateLibrary(id), A.presence(id).catch(() => null)]);
        return profilePage(context, p, extras, stats, library, true, presence);
      }
    }
  }

  function show(target, message, failed = false) {
    if (!target) return;
    target.textContent = message;
    target.classList.toggle('error', failed);
  }
  async function copy(value) {
    try { await navigator.clipboard.writeText(value); return 'Copied to clipboard.'; } catch { return value; }
  }

  async function handleForm(event, context) {
    const node = event.target.closest('[data-form]');
    if (!node) return;
    event.preventDefault();
    const submit = node.querySelector('[type=submit]');
    if (submit.disabled) return;
    const note = node.querySelector('[data-feedback]');
    const values = Object.fromEntries(new FormData(node));
    submit.disabled = true;
    try {
      let message = '';
      switch (node.dataset.form) {
        case 'signin':
          await A.signIn(values.email.trim(), values.password);
          banner = ''; updateNav(); render(context); return;
        case 'register': {
          const result = await A.register({ ...values, email: values.email.trim(), username: values.username.trim(), displayName: values.displayName.trim() });
          if (result.session) { updateNav(); location.hash = '/account'; return; }
          message = 'Check your email for a link to confirm your Spectra account.';
          break;
        }
        case 'forgot':
          await A.requestReset(values.email.trim());
          message = 'If an account uses this email, you’ll receive a reset link. Open it in this browser.';
          break;
        case 'resend':
          await A.resend(values.email.trim());
          message = 'If this account is still awaiting verification, you’ll receive a new link.';
          break;
        case 'edit-profile': {
          const links = [values.link0, values.link1, values.link2].map((u) => String(u || '').trim()).filter(Boolean);
          const bad = links.find((u) => !safeLink(u));
          if (bad) throw new Error('Links must be full https:// addresses.');
          await A.updateProfile(values.displayName.trim(), values.bio.trim());
          await A.saveExtras({ pronouns: String(values.pronouns || '').trim().slice(0, 20), links: links.map(safeLink).slice(0, 3) });
          updateNav(); render(context, 'Profile updated.'); return;
        }
        case 'badges': {
          await A.setBadgePrefs(values.hideRank === 'on', values.hideTag === 'on');
          render(context, 'Badges saved.'); return;
        }
        case 'username':
          await A.changeUsername(values.username.trim());
          updateNav(); render(context, 'Username changed to @' + values.username.trim() + '.'); return;
        case 'avatar': {
          const patch = { avatarIcon: Object.hasOwn(ICONS, values.icon) ? values.icon : '', banner: BANNERS.includes(values.banner) ? values.banner : '' };
          if (values.photo && values.photo.size) { patch.avatar = await avatarData(values.photo); patch.avatarIcon = ''; }
          else if (patch.avatarIcon) patch.avatar = '';
          await A.saveExtras(patch);
          updateNav(); render(context, 'Avatar updated.'); return;
        }
        case 'email':
          await A.changeEmail(values.email.trim(), values.password);
          message = 'Check your inboxes to confirm the change.';
          break;
        case 'recover':
        case 'password':
          if (values.next !== values.repeat) throw new Error('The passwords don’t match.');
          if (node.dataset.form === 'password') await A.reauthenticate(values.password);
          await A.changePassword(values.next);
          if (node.dataset.form === 'recover') {
            await A.signOut().catch(() => {});
            banner = 'Password changed. Sign in with your new password.';
            location.hash = '/account'; return;
          }
          message = 'Password changed.';
          break;
        case 'delete':
          if (values.confirm !== 'DELETE') throw new Error('Type DELETE to confirm.');
          await A.deleteAccount(values.password);
          banner = 'Your account was deleted.';
          updateNav(); location.hash = '/account'; return;
        case 'add-friend':
          render(context, await A.friendAction('add', values.username.trim())); return;
        case 'room-link': {
          const code = values.code.trim().toUpperCase();
          if (!/^[A-Z0-9]{4,6}$/.test(code)) throw new Error('Enter a room code of 4–6 letters or numbers.');
          const url = new URL('#/join/prismfall/' + code, location.href).href, link = document.createElement('a');
          link.href = url; link.textContent = url;
          show(note, ''); note.append(await copy(url) === url ? 'Share this invite: ' : 'Invite copied. ', link);
          return;
        }
      }
      node.reset(); show(note, message);
    } catch (err) { show(note, err.message, true); }
    finally { submit.disabled = false; }
  }

  async function handleButton(event, context) {
    const target = event.target.closest('[data-act]');
    if (!target) return;
    target.disabled = true;
    const note = context.root.querySelector('[data-page-feedback]'), value = target.dataset.value;
    try {
      const action = target.dataset.act;
      if (action === 'copy-profile') return show(note, await copy(new URL(userLink(value), location.href).href));
      if (action === 'copy-code') return show(note, await copy(value));
      if (action === 'profile-sort') { profileSort = ['playtime', 'recent', 'az'].includes(value) ? value : 'playtime'; render(context); return; }
      if (action === 'show-achievements' && A.gameIdPattern.test(value)) {
        const details = context.root.querySelector(`[data-profile-game="${value}"] .player-achievements`);
        if (details) {
          details.open = true;
          details.querySelector('summary').focus({ preventScroll: true });
          details.scrollIntoView({ block: 'nearest' });
        }
        return;
      }
      if (action === 'pin-game') {
        if (value && (!A.gameIdPattern.test(value) || context.games[value]?.id !== value)) return;
        await A.saveExtras({ pinnedGame: value });
        render(context, value ? 'Featured game updated.' : 'Featured game removed.');
        return;
      }
      if (action.endsWith('-friend')) {
        const message = await A.friendAction(action.split('-')[0], value);
        if (context.arg === 'friends') { render(context, message); return; }
        return show(note, message);
      }
      if (action === 'signout') { await A.signOut(); updateNav(); location.hash = '/account'; return; }
      if (action === 'export') {
        const data = new Blob([JSON.stringify(await A.exportData(), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(data), anchor = document.createElement('a');
        anchor.href = url; anchor.download = 'spectra-account-data.json'; anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return show(note, 'Account data exported.');
      }
      if (action === 'remove-avatar') {
        await A.saveExtras({ avatar: '' }); updateNav(); render(context, 'Profile picture removed.');
      }
      if (action === 'share-library' || action === 'hide-library') {
        const share = action === 'share-library';
        const owned = share ? A.ids((await A.privateLibrary(context.account.id))?.data?.owned).filter((id) => Object.hasOwn(context.games, id)) : null;
        await A.saveExtras({ publicLibrary: owned });
        render(context, share ? 'Your synced owned games are now public.' : 'Your owned games are private.');
      }
    } catch (err) { show(note, err.message, true); }
    finally { target.disabled = false; }
  }

  async function render(context, message = '') {
    active = context;
    const root = context.root, nonce = Symbol('account view');
    if (!root.isConnected) return;
    context.nonce = nonce;
    root.innerHTML = layout('Spectra account', '<p class="muted" role="status">Loading…</p>');
    try {
      const html = await view(context);
      if (!root.isConnected || context.nonce !== nonce) return;
      root.innerHTML = html;
      if (message) show(root.querySelector('[data-page-feedback]'), message);
      if (context.arg === 'settings' && context.extra === 'bio') root.querySelector('[name="bio"]')?.focus();
      else if (context.arg === 'settings' && context.extra === 'profile') root.querySelector('[name="displayName"]')?.focus();
      else if (context.arg === 'settings' && context.extra === 'avatar') root.querySelector('[data-form="avatar"]')?.scrollIntoView({ block: 'center' });
      root.querySelectorAll('[data-count-for]').forEach((c) => { const t = root.querySelector(`[name="${c.dataset.countFor}"]`); if (t) t.addEventListener('input', () => { c.textContent = t.value.length + '/200'; }); });
    } catch (err) {
      if (root.isConnected && context.nonce === nonce) root.innerHTML = layout('Spectra account', errorText(err.message));
    }
    root.onsubmit = (e) => handleForm(e, context);
    root.onclick = (e) => handleButton(e, context);
  }

  A.onSessionChange((account) => {
    updateNav();
    if (!account && active?.root.isConnected && active.account) render(active);
  });
  updateNav();
  window.SpectraAvatar = avatar;
  window.SpectraAccountPages = { render };
})();
