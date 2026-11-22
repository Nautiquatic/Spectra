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
      transient.set(key, value);
    },
    removeItem(key) {
      transient.delete(key);
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

  window.SpectraWebAccount = {
    available: !!sb, usernamePattern, gameIdPattern, user, profile, byUsername, extras, privateLibrary, stats, signIn, ids,
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
