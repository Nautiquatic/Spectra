/*
 * Spectra website config.
 *
 * catalogUrl  - the same catalog.json the launcher reads, so the site always lists
 *               the same games. Leave '' until you have one. For testing you can also
 *               add ?catalog=<url> to the page address.
 * downloadUrl - link to the launcher installer. This "latest" link always serves the
 *               SpectraLauncherSetup.exe attached to the newest GitHub release.
 *               While empty, the Download button shows "Coming soon".
 */
window.SPECTRA_SITE = {
  catalogUrl: 'catalog.json',
  downloadUrl: 'https://github.com/Nautiquatic/Spectra/releases/download/Launcher/SpectraLauncherSetup.exe',
  launcherVersion: '1.0.1',
  launcherSize: '79 MB',
  // Spectra IDE (the #/games/ide page). While ideDownloadUrl is empty, its button shows "Coming soon".
  ideDownloadUrl: 'https://github.com/Nautiquatic/Spectra/releases/download/IDE/SpectraIDE-Setup.exe',
  ideVersion: '1.0.0',
  ideSize: '5.5 MB',
  devlogUrl: 'devlog.json',
  contactEmail: '',
  // Spectra accounts: same values as supabaseUrl / supabaseAnonKey in the launcher's src/catalog.js.
  // Only the Supabase project URL and public publishable key belong here.
  siteUrl: 'https://nautiquatic.github.io/Spectra/',
  launcherProtocol: false,
  supabaseUrl: 'https://chkkfntakeoohwpaugrr.supabase.co',
  supabasePublishableKey: 'sb_publishable_eTMBOPDEzWtpqOoBkQvKnQ_Swy3y8ox',
};
