// Exposes a small, safe API to the launcher UI as window.spectra
const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (cb) => {
  const fn = (_e, data) => cb(data);
  ipcRenderer.on(channel, fn);
  return () => ipcRenderer.removeListener(channel, fn);
};

contextBridge.exposeInMainWorld('spectra', {
  isDesktop: true,
  info: () => ipcRenderer.invoke('app:info'),
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (s) => ipcRenderer.invoke('state:save', s),
  fetchCatalog: (url) => ipcRenderer.invoke('catalog:fetch', url),
  chooseFolder: () => ipcRenderer.invoke('dialog:folder'),
  openPath: (p) => ipcRenderer.invoke('shell:open', p),
  install: (opts) => ipcRenderer.invoke('game:install', opts),
  cancelInstall: (id) => ipcRenderer.invoke('game:cancel', id),
  uninstall: (opts) => ipcRenderer.invoke('game:uninstall', opts),
  launch: (opts) => ipcRenderer.invoke('game:launch', opts),
  stop: (id) => ipcRenderer.invoke('game:stop', id),
  readAllAchievements: () => ipcRenderer.invoke('achievements:readAll'),
  onAchievements: on('achievements:update'),
  update: {
    get: () => ipcRenderer.invoke('update:get'),
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    onStatus: on('update:status'),
  },
  onInstallProgress: on('install:progress'),
  onGameExited: on('game:exited'),
  onMaximized: on('win:maximized'),
  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    maximize: () => ipcRenderer.send('win:maximize'),
    close: () => ipcRenderer.send('win:close'),
    restore: () => ipcRenderer.send('win:restore'),
  },
});
