/*
 * Browser fallback for window.spectra so the UI also runs in a normal browser
 * (useful for designing). In the desktop app, preload.js provides the real API.
 */
(function () {
  if (window.spectra) return;
  const listeners = { exited: [] };
  const KEY = 'spectra:state';

  window.spectra = {
    isDesktop: false,
    info: async () => ({ defaultInstallRoot: 'C:\\Users\\You\\Spectra Games', version: '0.1.0', platform: 'web' }),
    loadState: async () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
    saveState: async (s) => { localStorage.setItem(KEY, JSON.stringify(s)); return true; },
    fetchCatalog: async (url) => {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      return r.json();
    },
    chooseFolder: async () => prompt('Install folder', 'D:\\Spectra Games'),
    openPath: async () => '',
    install: async () => ({ ok: false, error: 'Real downloads need the desktop app' }),
    cancelInstall: async () => true,
    uninstall: async () => true,
    launch: async () => ({ ok: false, error: 'Games can only be launched from the desktop app' }),
    stop: async () => true,
    readAllAchievements: async () => ({}),
    onAchievements: () => () => {},
    update: { get: async () => ({ state: 'dev', current: '0.0.0' }), check: async () => ({ state: 'dev' }), install: async () => ({ ok: false }), onStatus: () => () => {} },
    onInstallProgress: () => () => {},
    onGameExited: (cb) => { listeners.exited.push(cb); return () => {}; },
    onClosing: () => () => {},
    closeReady: () => {},
    onMaximized: () => () => {},
    win: { minimize() {}, maximize() {}, close() {}, restore() {} },
  };
})();
