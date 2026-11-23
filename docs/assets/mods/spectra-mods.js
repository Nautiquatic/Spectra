/*
 * Spectra Workshop mod loader, shared by every Spectra game.
 * Source: SpectraLauncher/mod-sdk/spectra-mods.js (each game ships a copy next to its index.html).
 *
 * Load it with a plain <script> tag after the game's data scripts and before its main script.
 * When the game is started by Spectra Launcher, the launcher has written
 *   %APPDATA%/Spectra Launcher/mods/<game id>/mods.js
 * which calls SpectraMods.register([...]) with the player's enabled Workshop items, in load order.
 * Played in a browser, or with no mods enabled, nothing happens and SpectraMods.list is empty.
 *
 * What a game does with it:
 *   SpectraMods.palette(target, 'section')   recolour: copies the mods' colour strings into an object of colours
 *   SpectraMods.sounds(table)                swap sounds: replaces entries of a { name: url } table with mod files
 *   SpectraMods.data({ section: table })     rebalance: copies numbers / text / switches into the game's tables
 *   SpectraMods.ready(api)                   then runs code mods, which use SpectraMods.api and SpectraMods.on(...)
 *   SpectraMods.emit('event', ...)           tells code mods what happened (runStart, update, kill, runEnd, …)
 *   SpectraMods.modded                       true when a data or code mod is on: no achievements, no online play
 */
(function () {
  'use strict';
  const M = {
    version: 1,
    list: [],
    modded: false,
    api: null,
    errors: [],
    current: null,
    onError: null,
  };
  window.SpectraMods = M;
  const listeners = Object.create(null);

  const fileUrl = (p) => 'file:///' + String(p).replace(/\\/g, '/').replace(/^\/+/, '').split('/')
    .map((part, i) => (i === 0 && /^[A-Za-z]:$/.test(part) ? part : encodeURIComponent(part))).join('/');
  const safeRel = (rel) => typeof rel === 'string' && rel.length > 0 && rel.length <= 200 && !rel.includes('..') && !/^[\\/]/.test(rel) && !/^[a-z]+:/i.test(rel);
  M.url = (mod, rel) => (mod && mod.dir && safeRel(rel) ? fileUrl(mod.dir + '/' + rel) : '');

  function report(mod, err) {
    const msg = (mod ? (mod.title || mod.id) + ': ' : '') + (err && err.message ? err.message : String(err));
    M.errors.push(msg);
    try { console.error('[Spectra mods] ' + msg, err); } catch (e) { /* ignore */ }
    if (typeof M.onError === 'function') { try { M.onError(msg); } catch (e) { /* ignore */ } }
  }
  M.report = report;

  // called by the launcher-written mods.js
  M.register = function (list) {
    if (!Array.isArray(list)) return;
    M.list = list.filter((m) => m && typeof m === 'object' && typeof m.id === 'string' && typeof m.dir === 'string').slice(0, 50);
    M.modded = M.list.some((m) => m.kind === 'data' || m.kind === 'code' || (m.data && typeof m.data === 'object') || (Array.isArray(m.code) && m.code.length));
    // resource-pack stylesheets go in now, while the page is still loading
    for (const m of M.list) {
      for (const css of Array.isArray(m.css) ? m.css.slice(0, 10) : []) {
        const href = M.url(m, css);
        if (href) document.write('<link rel="stylesheet" href="' + href.replace(/"/g, '%22') + '">');
      }
    }
  };

  // recolour: every mod's palette[section] (or the whole palette when no section) is copied onto target,
  // only where target already has a string (or a nested object of strings) under that name
  function mergeStrings(target, src, depth) {
    if (!src || typeof src !== 'object' || !target || typeof target !== 'object' || depth > 4) return;
    for (const k of Object.keys(src)) {
      if (!Object.prototype.hasOwnProperty.call(target, k)) continue;
      const v = src[k];
      if (typeof target[k] === 'string' && typeof v === 'string' && v.length <= 80) target[k] = v;
      else if (target[k] && typeof target[k] === 'object' && v && typeof v === 'object') mergeStrings(target[k], v, depth + 1);
    }
  }
  M.palette = function (target, section) {
    for (const m of M.list) {
      try { mergeStrings(target, section ? m.palette && m.palette[section] : m.palette, 0); } catch (e) { report(m, e); }
    }
    return target;
  };

  // swap sounds: table is { name: url }; mods give { name: 'sounds/file.mp3' }
  M.sounds = function (table) {
    if (!table || typeof table !== 'object') return table;
    for (const m of M.list) {
      if (!m.sounds || typeof m.sounds !== 'object') continue;
      for (const k of Object.keys(m.sounds)) {
        if (!Object.prototype.hasOwnProperty.call(table, k)) continue;
        const url = M.url(m, m.sounds[k]);
        if (url) table[k] = url;
      }
    }
    return table;
  };

  // rebalance: tables is { section: { key: { field: value } } }; a mod's data[section][key][field]
  // replaces a value of the same type (number, text or true/false). Numbers must be finite.
  function mergeData(target, src, depth) {
    if (!src || typeof src !== 'object' || !target || typeof target !== 'object' || depth > 4) return 0;
    let n = 0;
    for (const k of Object.keys(src)) {
      if (!Object.prototype.hasOwnProperty.call(target, k)) continue;
      const cur = target[k], v = src[k];
      if (typeof cur === 'number' && typeof v === 'number' && Number.isFinite(v)) { target[k] = v; n++; }
      else if (typeof cur === 'string' && typeof v === 'string' && v.length <= 400) { target[k] = v; n++; }
      else if (typeof cur === 'boolean' && typeof v === 'boolean') { target[k] = v; n++; }
      else if (cur && typeof cur === 'object' && typeof cur !== 'function' && v && typeof v === 'object') n += mergeData(cur, v, depth + 1);
    }
    return n;
  }
  M.data = function (tables) {
    let n = 0;
    for (const m of M.list) {
      if (!m.data || typeof m.data !== 'object') continue;
      for (const section of Object.keys(m.data)) {
        if (!tables || !tables[section]) continue;
        try { n += mergeData(tables[section], m.data[section], 0); } catch (e) { report(m, e); }
      }
    }
    return n;
  };

  // events for code mods
  M.on = function (event, fn) {
    if (typeof fn !== 'function') return () => {};
    const mod = M.current;
    (listeners[event] = listeners[event] || []).push({ fn, mod });
    return () => { listeners[event] = (listeners[event] || []).filter((l) => l.fn !== fn); };
  };
  M.emit = function (event) {
    const ls = listeners[event];
    if (!ls || !ls.length) return;
    const args = Array.prototype.slice.call(arguments, 1);
    for (const l of ls.slice()) {
      try { l.fn.apply(null, args); } catch (e) { report(l.mod, e); }
    }
  };

  // the game is set up: run code mods one after another, in load order
  M.ready = function (api) {
    M.api = api || {};
    const queue = [];
    for (const m of M.list) for (const rel of Array.isArray(m.code) ? m.code.slice(0, 10) : []) queue.push([m, rel]);
    const next = () => {
      const item = queue.shift();
      if (!item) { M.current = null; M.emit('ready', M.api); return; }
      const [m, rel] = item;
      const src = M.url(m, rel);
      if (!src) { next(); return; }
      M.current = m;
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => next();
      s.onerror = () => { report(m, new Error('Could not load ' + rel)); next(); };
      document.head.appendChild(s);
    };
    next();
  };

  // what to show players: "MODDED · 3 mods" (or packs only)
  M.label = () => (M.list.length ? (M.modded ? 'MODDED' : 'PACKS') + ' · ' + M.list.length + (M.list.length === 1 ? ' MOD' : ' MODS') : '');

  // load the launcher's list: it sits beside the achievements file the launcher already passes in
  const ach = window.SPECTRA_ACHIEVEMENTS_FILE, gid = window.SPECTRA_GAME_ID;
  if (window.SPECTRA_LAUNCHER && typeof ach === 'string' && typeof gid === 'string' && /^[a-z0-9-]{1,40}$/.test(gid)) {
    const root = ach.replace(/[\\/]achievements[\\/][^\\/]+\.txt$/i, '');
    if (root !== ach) {
      M.base = fileUrl(root + '/mods/' + gid);
      document.write('<script src="' + M.base + '/mods.js?t=' + Date.now() + '"><\/script>');
    }
  }
})();
