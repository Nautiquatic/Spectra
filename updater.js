// Spectra Launcher — self-updates from GitHub Releases (electron-updater).
//
// How it works:
//  - On start (and every 4 hours) the launcher asks GitHub for the release marked "Latest"
//    on Nautiquatic/Spectra and reads its latest.yml.
//  - If that version is newer than this one, the new installer downloads in the background
//    (only the changed parts, using the .blockmap file).
//  - The UI shows "Restart to update". If the player doesn't, it installs on next quit.
//
// The release must contain: SpectraLauncherSetup.exe, SpectraLauncherSetup.exe.blockmap, latest.yml
// (all three are made by `npm run dist` in the dist/ folder).
const { app, ipcMain } = require('electron');

let status = { state: 'idle', current: app.getVersion() };
let getWin = () => null;
let isBusy = () => false;
let autoUpdater = null;

function send(next) {
  status = { ...status, ...next, current: app.getVersion() };
  getWin()?.webContents.send('update:status', status);
}

function check() {
  if (!autoUpdater) return;
  autoUpdater.checkForUpdates().catch((err) => send({ state: 'error', error: friendly(err) }));
}

function friendly(err) {
  const msg = String(err?.message || err);
  if (/latest\.yml/i.test(msg)) return 'The newest GitHub release has no launcher update files (latest.yml).';
  if (/ENOTFOUND|ETIMEDOUT|ECONNRESET|net::/i.test(msg)) return "Couldn't reach GitHub.";
  if (/404/.test(msg)) return 'No launcher release found on GitHub yet.';
  return msg.split('\n')[0].slice(0, 200);
}

function setup({ win, busy }) {
  getWin = win;
  isBusy = busy;

  ipcMain.handle('update:get', () => status);
  ipcMain.handle('update:check', () => { check(); return status; });
  ipcMain.handle('update:install', () => {
    if (status.state !== 'ready') return { ok: false, error: 'No update is ready yet' };
    if (isBusy()) return { ok: false, error: 'Close your game and wait for downloads to finish first' };
    setImmediate(() => autoUpdater.quitAndInstall(true, true)); // silent install, then reopen the launcher
    return { ok: true };
  });

  // Updates only work in the installed app, not when running with `npm start`
  if (!app.isPackaged) { status = { state: 'dev', current: app.getVersion() }; return; }

  ({ autoUpdater } = require('electron-updater'));
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.logger = null;

  autoUpdater.on('checking-for-update', () => send({ state: 'checking', error: null }));
  autoUpdater.on('update-available', (i) => send({ state: 'downloading', version: i.version, percent: 0, notes: notesText(i.releaseNotes) }));
  autoUpdater.on('update-not-available', () => send({ state: 'none', checkedAt: Date.now() }));
  autoUpdater.on('download-progress', (p) => send({ state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) => send({ state: 'ready', version: i.version, notes: notesText(i.releaseNotes) }));
  autoUpdater.on('error', (err) => send({ state: 'error', error: friendly(err) }));

  setTimeout(check, 4000);
  setInterval(check, 4 * 60 * 60 * 1000);
}

function notesText(n) {
  if (!n) return '';
  const raw = Array.isArray(n) ? n.map((x) => x.note).join('\n') : String(n);
  return raw.replace(/<[^>]+>/g, '').trim().slice(0, 600);
}

module.exports = { setup };
