(function () {
  const A = window.SpectraWebAccount;
  const cfg = window.SPECTRA_SITE || {};
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const userLink = (name) => '#/u/' + encodeURIComponent(name);
  const date = (value) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleDateString() : '';
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
  const avatar = (p, extras, large = false) => {
    const color = /^#[a-f0-9]{6}$/i.test(p?.avatar_color) ? p.avatar_color : '#927dff';
    const letter = (p?.display_name || p?.username || '?').slice(0, 1).toUpperCase();
    return `<span class="account-avatar ${large ? 'large' : ''}" style="--avatar-color:${color}">${esc(letter)}
      ${validAvatar(extras?.avatar) ? `<img src="${extras.avatar}" alt="">` : ''}</span>`;
  };
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
      ${publicAchievements.length ? `<span>${count}/${publicAchievements.length} achievements${count === publicAchievements.length ? ' · Completed' : ''}</span>` : ''}</div>${action}</div>
      ${earned.length ? `<details><summary>Unlocked achievements</summary><ul>${earned.map((a) => `<li>${esc(a.name)} <small>${esc(date(Number(progress[a.id])))}</small></li>`).join('')}</ul></details>` : ''}</article>`;
  }

  function profilePage(context, p, extras, stats, library, ownProfile) {
    if (!p) return layout('Profile not found', '<p class="muted">Check the username and try again.</p>');
    const owned = A.ids(ownProfile ? library?.data?.owned : extras.publicLibrary);
    const byGame = Object.fromEntries(stats.map((row) => [row.game_id, row.achievements]));
    const shown = A.ids([...owned, ...Object.keys(byGame)]);
    const count = ownProfile || Array.isArray(extras.publicLibrary) ? `<p>${owned.length} owned game${owned.length === 1 ? '' : 's'}</p>` : '';
    const pinned = typeof extras.pinnedGame === 'string' && A.gameIdPattern.test(extras.pinnedGame) ? context.games[extras.pinnedGame] : null;
    const info = `<div class="account-card account-profile">${avatar(p, extras, true)}<div><h2>${esc(p.display_name)}</h2>
      <p>&#64;${esc(p.username)} · Joined ${esc(date(p.created_at))}</p>${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
      ${pinned?.id ? `<p>Featured game <a href="#/game/${pinned.id}">${esc(pinned.title)}</a></p>` : ''}</div>
      <div class="account-actions">${button('Copy profile link', 'copy-profile', p.username)}
      ${!ownProfile && context.account && context.account.id !== p.id ? button('Add friend', 'add-friend', p.username) : ''}</div></div>`;
    return layout(ownProfile ? 'My profile' : 'Player profile', info + feedbackLine + count + '<h2>Games and achievements</h2>'
      + (shown.length ? shown.map((id) => gameRow(context, id, byGame[id], false)).join('') : '<p class="muted">No game activity to display.</p>'),
      ownProfile ? tabs('') : '');
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
      ${groups[key].length ? groups[key].map((p) => `<div class="account-friend"><a href="${userLink(p.username)}">${avatar(p)}<span>${esc(p.display_name)} <small>&#64;${esc(p.username)}</small></span></a>
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
      ${form('Avatar', 'avatar', `<div class="account-actions">${avatar(p, extras, true)}${button('Remove picture', 'remove-avatar')}</div>
        ${field('Profile picture', 'file', 'photo', 'accept="image/png,image/jpeg,image/webp"')}`, 'Upload picture')}
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
      const [extras, stats] = await Promise.all([A.extras(p.id), A.stats(p.id)]);
      return profilePage(context, p, extras, stats, null, false);
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
        const [p, extras, stats, library] = await Promise.all([A.profile(id), A.extras(id), A.stats(id), A.privateLibrary(id)]);
        return profilePage(context, p, extras, stats, library, true);
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
        case 'avatar':
          await A.saveExtras({ avatar: await avatarData(values.photo) });
          updateNav(); render(context, 'Profile picture updated.'); return;
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
        const owned = share ? A.ids((await A.privateLibrary(context.account.id))?.data?.owned) : null;
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
  window.SpectraAccountPages = { render };
})();
