/* Remove emailed parameters from the current history entry before other scripts load. */
(function () {
  const url = new URL(location.href);
  const raw = new URLSearchParams(url.hash.slice(1));
  const get = (key) => url.searchParams.get(key) || raw.get(key) || '';
  const keys = ['code', 'sb_flow_id', 'token_hash', 'access_token', 'refresh_token', 'error', 'error_code',
    'error_description', 'type', 'expires_at', 'expires_in', 'token_type'];
  if (!keys.some((key) => url.searchParams.has(key) || raw.has(key))) return;
  const params = { code: get('code'), flowId: get('sb_flow_id'), tokenHash: get('token_hash'), accessToken: get('access_token'),
    refreshToken: get('refresh_token'), error: get('error') || get('error_code'), type: get('type') };
  for (const key of keys) url.searchParams.delete(key);
  if (!url.hash.startsWith('#/')) url.hash = '';
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  window.SpectraReadMailLink = () => {
    delete window.SpectraReadMailLink;
    return params;
  };
})();
