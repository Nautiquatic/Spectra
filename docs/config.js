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
  launcherVersion: '0.2.0',
  launcherSize: '78 MB',
  contactEmail: '',
};
