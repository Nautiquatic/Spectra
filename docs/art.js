/*
 * Procedural cover / banner art so every game looks good before real key art exists.
 * To use real images instead, add `cover` / `banner` image paths to a game in catalog.js.
 */
(function () {
  const RAYS = ['#ff5e8e', '#ffb35c', '#f2f27a', '#5ee8a4', '#5ec8ff', '#927dff'];
  let uid = 0;

  function rng(seed) {
    let s = 0;
    for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  const motifs = {
    prism(w, h, r, a) {
      const cx = w * (0.38 + r() * 0.24), cy = h * (0.5 + r() * 0.1), s = Math.min(w, h) * (0.3 + r() * 0.08);
      const top = [cx, cy - s], bl = [cx - s * 0.95, cy + s * 0.62], br = [cx + s * 0.95, cy + s * 0.62];
      const hit = [cx + s * 0.42, cy - s * 0.12];
      let rays = '';
      RAYS.forEach((c, i) => {
        const ang = -0.55 + i * 0.22;
        const len = w;
        rays += `<line x1="${hit[0]}" y1="${hit[1]}" x2="${hit[0] + Math.cos(ang) * len}" y2="${hit[1] + Math.sin(ang) * len}" stroke="${c}" stroke-width="${s * 0.07}" stroke-linecap="round" opacity=".9"/>`;
      });
      let shards = '';
      for (let i = 0; i < 18; i++) {
        const x = r() * w, y = r() * h, z = 4 + r() * 14;
        shards += `<polygon points="${x},${y - z} ${x + z * 0.6},${y + z * 0.5} ${x - z * 0.6},${y + z * 0.5}" fill="none" stroke="#fff" stroke-opacity="${0.06 + r() * 0.12}" stroke-width="1.5"/>`;
      }
      return `${shards}
        <line x1="0" y1="${cy + s * 0.1}" x2="${cx - s * 0.42}" y2="${cy - s * 0.04}" stroke="#fff" stroke-width="${s * 0.07}" stroke-linecap="round"/>
        <line x1="${cx - s * 0.42}" y1="${cy - s * 0.04}" x2="${hit[0]}" y2="${hit[1]}" stroke="#fff" stroke-opacity=".45" stroke-width="${s * 0.05}"/>
        ${rays}
        <polygon points="${top} ${bl} ${br}" fill="${a.to}" fill-opacity=".35" stroke="#fff" stroke-width="${s * 0.075}" stroke-linejoin="round"/>`;
    },
    moon(w, h, r, a) {
      let cave = `<path d="M0 0 `;
      for (let x = 0; x <= w; x += w / 14) cave += `L${x} ${h * (0.08 + r() * 0.22)} L${x + w / 28} ${h * 0.04} `;
      cave += `L${w} 0 Z" fill="#000" fill-opacity=".55"/>`;
      let floor = `<path d="M0 ${h} `;
      for (let x = 0; x <= w; x += w / 10) floor += `L${x} ${h * (0.78 + r() * 0.12)} `;
      floor += `L${w} ${h} Z" fill="#000" fill-opacity=".6"/>`;
      let motes = '';
      for (let i = 0; i < 30; i++) motes += `<circle cx="${r() * w}" cy="${r() * h}" r="${0.8 + r() * 2.2}" fill="${a.glow}" opacity="${0.2 + r() * 0.6}"/>`;
      const lx = w * (0.35 + r() * 0.3), ly = h * 0.58;
      return `${cave}${floor}${motes}
        <circle cx="${lx}" cy="${ly}" r="${h * 0.32}" fill="url(#g${uid}glow)" opacity=".8"/>
        <rect x="${lx - 9}" y="${ly - 14}" width="18" height="26" rx="5" fill="#fff" opacity=".95"/>
        <rect x="${lx - 5}" y="${ly - 22}" width="10" height="8" rx="2" fill="none" stroke="#fff" stroke-width="2"/>`;
    },
    beams(w, h, r, a) {
      let out = '';
      let x = 0, y = h * (0.3 + r() * 0.4);
      const pts = [[x, y]];
      for (let i = 0; i < 5; i++) { x += w / 5; y = h * (0.15 + r() * 0.7); pts.push([x, y]); }
      for (let i = 0; i < pts.length - 1; i++) {
        const c = i === 0 ? '#fff' : RAYS[(i * 2) % RAYS.length];
        out += `<line x1="${pts[i][0]}" y1="${pts[i][1]}" x2="${pts[i + 1][0]}" y2="${pts[i + 1][1]}" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`;
        if (i > 0) out += `<rect x="${pts[i][0] - 14}" y="${pts[i][1] - 4}" width="28" height="8" rx="2" fill="#fff" opacity=".85" transform="rotate(${-40 + r() * 80} ${pts[i][0]} ${pts[i][1]})"/>`;
      }
      for (let gx = 0; gx < w; gx += 40) out += `<line x1="${gx}" y1="0" x2="${gx}" y2="${h}" stroke="#fff" stroke-opacity=".035"/>`;
      for (let gy = 0; gy < h; gy += 40) out += `<line x1="0" y1="${gy}" x2="${w}" y2="${gy}" stroke="#fff" stroke-opacity=".035"/>`;
      return out;
    },
    road(w, h, r, a) {
      const hy = h * 0.55, cx = w * (0.4 + r() * 0.2);
      let out = `<circle cx="${cx}" cy="${hy}" r="${h * 0.22}" fill="${a.glow}" opacity=".85"/>`;
      for (let i = 0; i < 6; i++) out += `<rect x="0" y="${hy - h * 0.2 + i * h * 0.04}" width="${w}" height="${h * 0.012}" fill="${a.to}"/>`;
      out += `<rect x="0" y="${hy}" width="${w}" height="${h - hy}" fill="#000" opacity=".75"/>`;
      for (let i = -8; i <= 8; i++) out += `<line x1="${cx}" y1="${hy}" x2="${cx + i * w * 0.18}" y2="${h}" stroke="${a.glow}" stroke-opacity=".45" stroke-width="1.5"/>`;
      for (let i = 1; i < 8; i++) { const yy = hy + (h - hy) * Math.pow(i / 8, 2); out += `<line x1="0" y1="${yy}" x2="${w}" y2="${yy}" stroke="${a.glow}" stroke-opacity=".3"/>`; }
      out += `<path d="M${cx - 6} ${hy} L${cx - w * 0.16} ${h} L${cx + w * 0.16} ${h} L${cx + 6} ${hy}Z" fill="#fff" opacity=".06"/>`;
      return out;
    },
    towers(w, h, r, a) {
      let out = '';
      const base = h * 0.82;
      for (let i = 0; i < 7; i++) {
        const x = w * (0.06 + i * 0.14), th = h * (0.18 + r() * 0.25), tw = w * 0.05;
        const c = RAYS[i % RAYS.length];
        out += `<line x1="${x + tw / 2}" y1="${base - th}" x2="${w * (0.2 + r() * 0.6)}" y2="${h * r() * 0.3}" stroke="${c}" stroke-width="3" opacity=".8"/>`;
        out += `<rect x="${x}" y="${base - th}" width="${tw}" height="${th}" fill="#000" opacity=".7" stroke="${c}" stroke-opacity=".6"/>`;
        out += `<circle cx="${x + tw / 2}" cy="${base - th}" r="${tw * 0.45}" fill="${c}"/>`;
      }
      out += `<rect x="0" y="${base}" width="${w}" height="${h - base}" fill="#000" opacity=".75"/>`;
      return out;
    },
    burst(w, h, r, a) {
      let out = '';
      for (let i = 0; i < 14; i++) {
        const c = RAYS[Math.floor(r() * RAYS.length)];
        const x = r() * w, y = r() * h, rad = 20 + r() * Math.min(w, h) * 0.22;
        out += `<circle cx="${x}" cy="${y}" r="${rad}" fill="${c}" opacity="${0.25 + r() * 0.5}"/>`;
        for (let j = 0; j < 5; j++) out += `<circle cx="${x + (r() - 0.5) * rad * 3}" cy="${y + (r() - 0.5) * rad * 3}" r="${2 + r() * 8}" fill="${c}" opacity=".7"/>`;
      }
      out += `<polygon points="${w / 2},${h * 0.2} ${w * 0.62},${h * 0.5} ${w / 2},${h * 0.8} ${w * 0.38},${h * 0.5}" fill="none" stroke="#fff" stroke-width="4" opacity=".85"/>`;
      return out;
    },
  };

  function svg(game, opts = {}) {
    const w = opts.w || 600, h = opts.h || 800;
    const a = game.art || { from: '#222', to: '#000', glow: '#927dff', motif: 'prism' };
    const r = rng(game.id + (opts.seed || ''));
    uid++;
    const body = (motifs[a.motif] || motifs.prism)(w, h, r, a);
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="g${uid}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a.from}"/><stop offset="1" stop-color="${a.to}"/></linearGradient>
        <radialGradient id="g${uid}glow"><stop offset="0" stop-color="${a.glow}" stop-opacity=".9"/><stop offset="1" stop-color="${a.glow}" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#g${uid}bg)"/>
      <circle cx="${w * 0.75}" cy="${h * 0.3}" r="${Math.max(w, h) * 0.55}" fill="url(#g${uid}glow)" opacity=".28"/>
      ${body}
    </svg>`;
  }

  window.SpectraArt = { svg, RAYS };
})();
