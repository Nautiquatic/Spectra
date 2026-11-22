/* Shared by the existing launcher callback URLs and website email flows. */
(async function () {
  const A = window.SpectraWebAccount;
  const params = window.SpectraReadMailLink?.();
  const reset = document.body.dataset.mailMode === 'reset';
  const heading = document.getElementById('heading'), detail = document.getElementById('detail');
  const signIn = document.getElementById('signinLink');
  const say = (title, description) => { heading.textContent = title; detail.textContent = description; };
  try {
    if (!params) throw new Error('Open the link in the email sent by Spectra.');
    await A.verifyMail(params, reset ? 'reset' : 'confirm');
  } catch (err) {
    say('Email link unavailable', err.message);
    if (reset) { signIn.href = '../#/account/forgot'; signIn.textContent = 'Request a new link'; }
    return;
  }
  if (!reset) {
    await A.signOut().catch(() => {});
    say('Email verified', 'You can sign in on the website or in Spectra Launcher with the same account.');
    return;
  }
  document.getElementById('message').hidden = true;
  const form = document.getElementById('passwordForm');
  const pw = document.getElementById('pw'), confirm = document.getElementById('pw2');
  const status = document.getElementById('status'), submit = form.querySelector('button');
  form.hidden = false;
  pw.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submit.disabled) return;
    status.textContent = '';
    if (pw.value !== confirm.value) { status.textContent = 'The passwords don’t match.'; return; }
    submit.disabled = true;
    try {
      await A.changePassword(pw.value);
      await A.signOut().catch(() => {});
      form.reset();
      form.hidden = true;
      document.getElementById('message').hidden = false;
      say('Password changed', 'Sign in with your new password on the website or in Spectra Launcher.');
    } catch (err) { status.textContent = err.message; }
    finally { submit.disabled = false; }
  });
})();
