/* The site and launcher share the same Supabase Auth and tables. */
(function () {
  const cfg = window.SPECTRA_SITE || {};
  const usernamePattern = /^[a-z0-9_]{3,20}$/i;
  const gameIdPattern = /^[a-z0-9-]{1,40}$/;
  const profileFields = 'id,username,display_name,bio,avatar_color,created_at';
  const profileMetadata = 'spectra-profile';
  const storageKey = 'spectra-website-auth';
  const verifierKey = storageKey + '-code-verifier';
  const isVerifier = (key) => key === verifierKey || key === storageKey + '-flows-code-verifier'
    || /^spectra-website-auth-flow-[a-z0-9_-]{8,64}-code-verifier$/i.test(key);
  const transient = new Map();
  const storage = {
    getItem(key) {
      if (isVerifier(key)) {
        try {
          const stored = JSON.parse(localStorage.getItem(key));
          if (stored && stored.expires > Date.now() && typeof stored.value === 'string') return stored.value;
          localStorage.removeItem(key);
        } catch {}
      }
      try { const v = localStorage.getItem(key); if (v != null) return v; } catch {} // the session itself: kept between visits
      return transient.get(key) ?? null;
    },
    setItem(key, value) {
      if (isVerifier(key)) {
        try {
          localStorage.setItem(key, JSON.stringify({ value, expires: Date.now() + 3600000 }));
          transient.delete(key);
          return;
        } catch {}
      }
      try { localStorage.setItem(key, value); transient.delete(key); return; } catch {} // stays signed in between sessions
      transient.set(key, value);
    },
    removeItem(key) {
      transient.delete(key);
      try { localStorage.removeItem(key); } catch {}
      if (isVerifier(key)) {
        try { localStorage.removeItem(key); } catch {}
      }
    },
  };
  const publicKey = cfg.supabasePublishableKey || cfg.supabaseAnonKey;
  const sb = cfg.supabaseUrl && publicKey && window.supabase?.createClient
    ? window.supabase.createClient(cfg.supabaseUrl, publicKey, {
      auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, storage, storageKey },
    }) : null;
  const callbacks = new URL('account/', cfg.siteUrl || document.baseURI);
  const callbackUrl = (mode) => new URL(mode === 'reset' ? 'reset.html' : 'confirmed.html', callbacks).href;
  const must = ({ data, error }) => {
    if (error) {
      if (error.status === 429) throw new Error('Too many attempts. Wait a few minutes and try again.');
      if (error.code === 'email_not_confirmed') throw new Error('Confirm your email before signing in.');
      if (error.code === 'invalid_credentials') throw new Error('The email or password was incorrect.');
      throw new Error(error.message || 'Spectra could not complete the request.');
    }
    return data;
  };
  const client = () => {
    if (!sb) throw new Error('Spectra account services are unavailable.');
    return sb;
  };
  const user = async () => must(await client().auth.getSession()).session?.user || null;
  const own = async () => {
    const account = await user();
    if (!account) throw new Error('Sign in to continue.');
    return account;
  };
  const attempts = [];
  const signIn = async (email, password) => {
    const now = Date.now();
    while (attempts.length && now - attempts[0] >= 60000) attempts.shift();
    if (attempts.length >= 5) throw new Error('Too many sign-in attempts. Try again in one minute.');
    attempts.push(now);
    const data = must(await client().auth.signInWithPassword({ email, password }));
    attempts.length = 0;
    return data.user;
  };
  const profile = async (id) => must(await client().from('profiles').select(profileFields).eq('id', id).maybeSingle());
  async function byUsername(name) {
    if (!usernamePattern.test(name)) return null;
    const query = name.replaceAll('_', '\\_');
    const result = must(await client().from('profiles').select(profileFields).ilike('username', query).maybeSingle());
    return result?.username.toLowerCase() === name.toLowerCase() ? result : null;
  }
  const extras = async (id) => must(await client().from('game_stats').select('achievements')
    .eq('user_id', id).eq('game_id', profileMetadata).maybeSingle())?.achievements || {};
  const privateLibrary = async (id) => must(await client().from('user_data').select('data,updated_at').eq('id', id).maybeSingle());
  const stats = async (id) => must(await client().from('game_stats').select('game_id,playtime,achievements,last_played')
    .eq('user_id', id).neq('game_id', profileMetadata).order('game_id'));
  const relations = () => client().from('friendships');
  const friendRows = async () => must(await relations().select('requester,addressee,status,created_at').order('created_at'));
  const pair = (id, other) => `and(requester.eq.${id},addressee.eq.${other}),and(requester.eq.${other},addressee.eq.${id})`;
  const ids = (value) => Array.isArray(value) ? [...new Set(value.filter((item) => typeof item === 'string' && gameIdPattern.test(item) && item !== profileMetadata))] : [];

  // every player's public stats for one game, with their public profile (for the leaderboards)
  const leaderboard = async (gameId) => {
    if (!gameIdPattern.test(gameId) || gameId === profileMetadata) return [];
    return must(await client().from('game_stats').select('user_id,playtime,achievements,last_played,profiles(username,display_name,avatar_color)')
      .eq('game_id', gameId).limit(500));
  };
  // "notify me" for games that aren't out yet: an email and a game, nothing else (see supabase/notify.sql)
  const notify = async (email, gameId) => {
    email = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(email)) throw new Error('Enter a valid email address.');
    if (!gameIdPattern.test(gameId)) throw new Error('That game is not in the catalogue.');
    const { error } = await client().from('notify_signups').insert({ email, game_id: gameId });
    if (!error || error.code === '23505') return true; // already on the list counts as success
    if (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || '')) throw new Error('Sign-ups open shortly. Try again later.');
    if (error.status === 429) throw new Error('Too many attempts. Wait a few minutes and try again.');
    throw new Error('Could not sign you up right now. Try again later.');
  };

  // ---------- bug reports and feedback (see supabase/reports.sql) ----------
  const REPORT_KINDS = ['bug', 'crash', 'performance', 'feedback', 'idea', 'other'];
  const reportError = (error) => {
    if (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || '')) return new Error('Reports open shortly. Try again later.');
    if (error.code === 'P0001') return new Error(error.message);
    if (error.status === 429) return new Error('Too many attempts. Wait a few minutes and try again.');
    return new Error('Could not send your report right now. Try again later.');
  };
  const report = async (r) => {
    const clean = (v, n) => String(v || '').trim().slice(0, n);
    const row = {
      game: clean(r.game, 40), kind: r.kind, title: clean(r.title, 120), details: clean(r.details, 4000),
      steps: clean(r.steps, 2000), version: clean(r.version, 40), platform: clean(r.platform, 12), contact: clean(r.contact, 254).toLowerCase(),
    };
    if (!gameIdPattern.test(row.game)) throw new Error('Choose what the report is about.');
    if (!REPORT_KINDS.includes(row.kind)) throw new Error('Choose the kind of report.');
    if (row.title.length < 4) throw new Error('Give the report a short title.');
    if (row.details.length < 10) throw new Error('Describe what happened in a sentence or two.');
    if (row.contact && !/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(row.contact)) throw new Error('That email address doesn’t look right. Leave it empty if you prefer.');
    const account = sb ? await user().catch(() => null) : null;
    if (account) row.user_id = account.id;
    const { error } = await client().from('reports').insert(row);
    if (error) throw reportError(error);
    return true;
  };
  const myReports = async () => {
    const account = await user();
    if (!account) return [];
    const { data, error } = await client().from('reports').select('id,created_at,game,kind,title,status,reply,updated_at').eq('user_id', account.id).order('created_at', { ascending: false }).limit(50);
    if (error) throw reportError(error);
    return data || [];
  };
  const isAdmin = async () => {
    if (!(await user())) return false;
    const { data, error } = await client().rpc('is_admin');
    return !error && data === true;
  };
  const allReports = async () => {
    const { data, error } = await client().from('reports').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) throw reportError(error);
    return data || [];
  };
  const updateReport = async (id, patch) => {
    const row = { updated_at: new Date().toISOString() };
    if (patch.status) row.status = patch.status;
    if (patch.reply != null) row.reply = String(patch.reply).slice(0, 2000);
    const { error } = await client().from('reports').update(row).eq('id', id);
    if (error) throw new Error(error.message || 'Could not update the report.');
  };
  const deleteReport = async (id) => {
    const { error } = await client().from('reports').delete().eq('id', id);
    if (error) throw new Error(error.message || 'Could not delete the report.');
  };

  // public game reviews (written in the launcher after playing; see supabase/reviews.sql)
  const reviews = async (gameId) => {
    if (!sb || !gameIdPattern.test(gameId)) return [];
    const { data, error } = await client().from('reviews').select('stars,body,playtime,updated_at,profiles(username,display_name,avatar_color)')
      .eq('game_id', gameId).order('updated_at', { ascending: false }).limit(200);
    if (error) return [];
    return (data || []).filter((r) => r.profiles);
  };

  window.SpectraWebAccount = {
    available: !!sb, usernamePattern, gameIdPattern, user, profile, byUsername, extras, privateLibrary, stats, signIn, ids, leaderboard, notify,
    report, myReports, isAdmin, allReports, updateReport, deleteReport, reviews,
    onSessionChange(fn) {
      sb?.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') setTimeout(() => fn(session?.user || null), 0);
      });
    },
    async register({ email, password, username, displayName }) {
      if (!usernamePattern.test(username)) throw new Error('Use 3–20 letters, numbers or underscores for your username.');
      if (!must(await client().rpc('username_available', { name: username }))) throw new Error('That username is already taken.');
      return must(await client().auth.signUp({
        email, password, options: { data: { username, display_name: displayName || username }, emailRedirectTo: callbackUrl('confirm') },
      }));
    },
    async resend(email) {
      must(await client().auth.resend({ type: 'signup', email, options: { emailRedirectTo: callbackUrl('confirm') } }));
    },
    async signOut() { must(await client().auth.signOut({ scope: 'local' })); },
    async requestReset(email) {
      must(await client().auth.resetPasswordForEmail(email, { redirectTo: callbackUrl('reset') }));
    },
    async verifyMail(params, mode) {
      const auth = client().auth;
      if (params.error) throw new Error('This email link has expired or has already been used.');
      if (params.tokenHash) {
        const valid = mode === 'reset' ? ['recovery'] : ['email', 'signup', 'email_change'];
        if (!valid.includes(params.type) || !/^[0-9a-z_-]{20,250}$/i.test(params.tokenHash)) throw new Error('This email link is invalid.');
        return must(await auth.verifyOtp({ token_hash: params.tokenHash, type: params.type }));
      }
      if (params.code) {
        const flowId = params.flowId || '';
        const slot = flowId ? storageKey + '-flow-' + flowId + '-code-verifier' : verifierKey;
        if (flowId && !/^[a-z0-9_-]{8,64}$/i.test(flowId)) throw new Error('This email link is invalid.');
        if (!storage.getItem(slot)) throw new Error(mode === 'reset'
          ? 'Open this link in the browser that requested the reset, or request a new link.'
          : 'Return to Sign in and try your account. If your email still needs verification, request a new link.');
        const result = must(await auth.exchangeCodeForSession(params.code, flowId ? { flowId } : undefined));
        if (mode === 'reset' && result.redirectType !== 'recovery') {
          await auth.signOut({ scope: 'local' });
          throw new Error('This link cannot be used to reset a password.');
        }
        return result;
      }
      // Previously sent launcher links may use a Supabase URL fragment.
      if (params.accessToken && params.refreshToken) {
        if (mode === 'reset' && params.type !== 'recovery') throw new Error('This link cannot be used to reset a password.');
        return must(await auth.setSession({ access_token: params.accessToken, refresh_token: params.refreshToken }));
      }
      throw new Error('This email link is missing or has already been used.');
    },
    async changePassword(password) {
      must(await client().auth.updateUser({ password }));
    },
    async reauthenticate(password) {
      const account = await own();
      await signIn(account.email, password);
    },
    async changeEmail(email, password) {
      await this.reauthenticate(password);
      must(await client().auth.updateUser({ email }, { emailRedirectTo: callbackUrl('confirm') }));
    },
    async presence(id) {
      return must(await client().from('presence').select('status,now_playing,last_seen').eq('user_id', id).maybeSingle());
    },
    async updateProfile(displayName, bio) {
      const account = await own();
      if (!displayName || displayName.length > 24 || bio.length > 200) throw new Error('Use up to 24 characters for your name and 200 for your bio.');
      return must(await client().from('profiles').update({ display_name: displayName, bio }).eq('id', account.id).select(profileFields).maybeSingle());
    },
    async saveExtras(patch) {
      const account = await own();
      const current = await extras(account.id);
      must(await client().from('game_stats').upsert({
        user_id: account.id, game_id: profileMetadata, achievements: { ...current, ...patch }, playtime: 0,
      }));
    },
    async friends() {
      const account = await own(), rows = await friendRows();
      const idOf = (row) => row.requester === account.id ? row.addressee : row.requester;
      const result = { accepted: [], incoming: [], outgoing: [] };
      if (!rows.length) return result;
      const players = new Map(must(await client().from('profiles').select(profileFields)
        .in('id', [...new Set(rows.map(idOf))])).map((entry) => [entry.id, entry]));
      for (const row of rows) {
        const entry = players.get(idOf(row));
        if (entry) result[row.status === 'accepted' ? 'accepted' : row.addressee === account.id ? 'incoming' : 'outgoing'].push(entry);
      }
      return result;
    },
    async friendAction(action, name) {
      const account = await own(), target = await byUsername(name);
      if (!target || target.id === account.id) throw new Error('Choose another Spectra username.');
      const rows = must(await relations().select('requester,addressee,status').or(pair(account.id, target.id)));
      const incoming = rows.some((row) => row.requester === target.id && row.status === 'pending');
      if (action === 'accept' || (action === 'add' && incoming)) {
        if (!incoming) throw new Error('There is no pending request to accept.');
        must(await relations().update({ status: 'accepted' }).eq('requester', target.id).eq('addressee', account.id));
        return 'Friend added.';
      }
      if (action === 'remove') {
        must(await relations().delete().or(pair(account.id, target.id)));
        return 'Friendship or request removed.';
      }
      if (action !== 'add') throw new Error('Unknown friend action.');
      if (rows.length) throw new Error('You already have a friendship or pending request with this player.');
      must(await relations().insert({ requester: account.id, addressee: target.id, status: 'pending' }));
      return 'Friend request sent.';
    },
    async exportData() {
      const account = await own(), id = account.id;
      const [myProfile, myLibrary, gameStats, metadata, friendships, presence] = await Promise.all([
        profile(id), privateLibrary(id), stats(id), extras(id), friendRows(),
        client().from('presence').select('status,visibility,now_playing,last_seen').eq('user_id', id).maybeSingle().then(must),
      ]);
      return { exportedAt: new Date().toISOString(), account: { id, email: account.email, createdAt: account.created_at },
        profile: myProfile, profileSettings: metadata, library: myLibrary, gameStats, friendships, presence };
    },
    async deleteAccount(password) {
      await this.reauthenticate(password);
      must(await client().rpc('delete_my_account'));
      await client().auth.signOut({ scope: 'local' });
    },
  };
})();
