// Spectra Launcher — Electron main process
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');
const { spawn, execFile } = require('child_process');

// Fixed name so the data folder is always %APPDATA%\Spectra Launcher (games rely on this path)
app.setName('Spectra Launcher');

const stateFile = () => path.join(app.getPath('userData'), 'state.json');
const defaultInstallRoot = () => path.join(app.getPath('home'), 'Spectra Games');
const safeId = (id) => /^[a-z0-9-]+$/i.test(String(id));

let win;
const running = new Map(); // gameId -> { started, kill }
const downloads = new Map(); // gameId -> { req, aborted }

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1080,
    minHeight: 660,
    frame: false,
    backgroundColor: '#0b0b12',
    title: 'Spectra Launcher',
    icon: path.join(__dirname, 'Assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.on('maximize', () => win.webContents.send('win:maximized', true));
  win.on('unmaximize', () => win.webContents.send('win:maximized', false));
}

app.whenReady().then(() => {
  createWindow();
  // self-update from GitHub Releases; never restart mid-game or mid-download
  require('./updater').setup({ win: () => win, busy: () => running.size > 0 || downloads.size > 0 });
});
app.on('window-all-closed', () => app.quit());

// ---------- window controls ----------
ipcMain.on('win:minimize', () => win?.minimize());
ipcMain.on('win:maximize', () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()));
ipcMain.on('win:close', () => win?.close());
ipcMain.on('win:restore', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

// ---------- state ----------
ipcMain.handle('state:load', () => {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return null; }
});
ipcMain.handle('state:save', (_e, state) => {
  fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
  fs.writeFileSync(stateFile(), JSON.stringify(state, null, 2));
  return true;
});
ipcMain.handle('app:info', () => ({ defaultInstallRoot: defaultInstallRoot(), version: app.getVersion(), platform: process.platform }));

ipcMain.handle('dialog:folder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('shell:open', (_e, p) => shell.openPath(p));

// ---------- catalogue (list of games on the server) ----------
ipcMain.handle('catalog:fetch', async (_e, url) => {
  if (!/^https?:\/\//i.test(url)) return JSON.parse(fs.readFileSync(url, 'utf8')); // local file for testing
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Server returned ${res.status}`);
  return res.json();
});

// ---------- install ----------
function fetchTo(url, dest, onProgress, entry, redirects = 0) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
        res.resume();
        return fetchTo(new URL(res.headers.location, url).toString(), dest, onProgress, entry, redirects + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const total = Number(res.headers['content-length']) || 0;
      let received = 0;
      const out = fs.createWriteStream(dest);
      res.on('data', (c) => { received += c.length; onProgress(received, total); });
      res.pipe(out);
      out.on('finish', () => out.close(() => resolve()));
      res.on('error', reject);
      out.on('error', reject);
    });
    req.on('error', reject);
    entry.req = req;
  });
}

function extractZip(zip, dir) {
  return new Promise((resolve, reject) => {
    // Paths go in through environment variables so spaces, quotes or $ in folder names
    // (e.g. "C:\Users\me\Spectra Games") can't break the PowerShell command.
    execFile('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', 'Expand-Archive -LiteralPath $env:SPECTRA_ZIP -DestinationPath $env:SPECTRA_DEST -Force'],
      { env: { ...process.env, SPECTRA_ZIP: zip, SPECTRA_DEST: dir }, windowsHide: true },
      (err, _out, stderr) => (err ? reject(new Error(String(stderr || err.message).split('\n')[0].trim() || 'Could not extract the game')) : resolve()));
  });
}

ipcMain.handle('game:install', async (_e, { id, url, root }) => {
  if (!safeId(id)) throw new Error('Bad game id');
  const dir = path.join(root || defaultInstallRoot(), id);
  fs.mkdirSync(dir, { recursive: true });
  const fileName = decodeURIComponent(new URL(url).pathname.split('/').pop() || `${id}.bin`);
  const tmp = path.join(os.tmpdir(), `spectra-${id}-${Date.now()}-${fileName}`);
  const entry = { aborted: false };
  downloads.set(id, entry);
  try {
    await fetchTo(url, tmp, (received, total) => win?.webContents.send('install:progress', { id, received, total }), entry);
    if (entry.aborted) throw new Error('cancelled');
    if (fileName.toLowerCase().endsWith('.zip')) await extractZip(tmp, dir);
    else fs.copyFileSync(tmp, path.join(dir, fileName));
    return { ok: true, dir };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    downloads.delete(id);
    fs.rm(tmp, { force: true }, () => {});
  }
});

ipcMain.handle('game:cancel', (_e, id) => {
  const d = downloads.get(id);
  if (d) { d.aborted = true; d.req?.destroy(new Error('cancelled')); }
  return true;
});

ipcMain.handle('game:uninstall', (_e, { id, root }) => {
  if (!safeId(id)) throw new Error('Bad game id');
  const dir = path.join(root || defaultInstallRoot(), id);
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
});

// ---------- launch ----------
function finished(id) {
  const r = running.get(id);
  if (!r) return;
  running.delete(id);
  r.unwatch?.();
  win?.webContents.send('game:exited', { id, seconds: Math.round((Date.now() - r.started) / 1000) });
}

// ---------- achievements ----------
// Each game unlocks achievements by appending one achievement id per line to
//   %APPDATA%/Spectra Launcher/achievements/<gameId>.txt
// The path is passed to the game in the SPECTRA_ACHIEVEMENTS_FILE environment variable.
const achDir = () => path.join(app.getPath('userData'), 'achievements');
const achFile = (id) => path.join(achDir(), `${id}.txt`);
const ACH_ID = /^[a-z0-9_.-]{1,64}$/i;

function readAchievements(id) {
  try {
    return [...new Set(fs.readFileSync(achFile(id), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => ACH_ID.test(l)))];
  } catch { return []; }
}

ipcMain.handle('achievements:readAll', () => {
  const out = {};
  try {
    for (const f of fs.readdirSync(achDir())) {
      const id = f.replace(/\.txt$/i, '');
      if (f.toLowerCase().endsWith('.txt') && safeId(id)) out[id] = readAchievements(id);
    }
  } catch {}
  return out;
});

function watchAchievements(id) {
  const file = achFile(id);
  const push = () => win?.webContents.send('achievements:update', { id, ids: readAchievements(id) });
  fs.watchFile(file, { interval: 750 }, push);
  return () => { fs.unwatchFile(file, push); push(); };
}

ipcMain.handle('game:launch', (_e, { id, exe, root }) => {
  if (!safeId(id)) throw new Error('Bad game id');
  if (running.has(id)) return { ok: false, error: 'Already running' };
  const dir = path.join(root || defaultInstallRoot(), id);
  const exePath = path.join(dir, exe || '');
  if (!exe || !fs.existsSync(exePath)) return { ok: false, error: `Executable not found: ${exePath}` };
  fs.mkdirSync(achDir(), { recursive: true });
  const env = { ...process.env, SPECTRA_LAUNCHER: '1', SPECTRA_GAME_ID: id, SPECTRA_ACHIEVEMENTS_FILE: achFile(id) };
  const child = spawn(exePath, [], { cwd: dir, detached: false, stdio: 'ignore', env });
  running.set(id, { started: Date.now(), kill: () => child.kill(), unwatch: watchAchievements(id) });
  child.on('exit', () => finished(id));
  child.on('error', () => finished(id));
  return { ok: true };
});

ipcMain.handle('game:stop', (_e, id) => { running.get(id)?.kill(); return true; });
