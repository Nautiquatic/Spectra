(function () {
  const url = new URL(location.href);
  url.pathname = url.pathname.replace(/\/account(?:\/index\.html|\/)?$/i, '/');
  if (!/^#\/account(?:\/|$)/.test(url.hash)) {
    const type = url.searchParams.get('type');
    const hasEmailToken = url.searchParams.has('token_hash') || url.searchParams.has('code');
    url.hash = hasEmailToken ? (type === 'recovery' ? '/account/recover' : '/account/verify-email') : '/account';
  }
  location.replace(url.href);
})();
