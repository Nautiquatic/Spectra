/*
 * Spectra website config.
 *
 * catalogUrl  - the same catalog.json the launcher reads, so the site always lists
 *               the same games. Leave '' until you have one. For testing you can also
 *               add ?catalog=<url> to the page address.
 * downloadUrl - link to the launcher installer (e.g. a GitHub release .exe).
 *               `npm run dist` copies the newest build to website/downloads/, so the
 *               default works as long as you upload that folder with the site.
 *               While empty, the Download button shows "Coming soon".
 */
window.SPECTRA_SITE = {
  catalogUrl: '',
  downloadUrl: 'downloads/SpectraLauncherSetup.exe',
  launcherVersion: '0.1.0',
  launcherSize: '78 MB',
  contactEmail: '',
};
