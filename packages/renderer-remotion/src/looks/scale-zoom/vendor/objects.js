// Copiado de Lemo-Opuscar (https://github.com/lemomo-ai/lemo-opuscar), commit 00a7f9ec99c8686265a8ca4ed9a3fdaaf27ea6f4,
// styles/flat-space-explainer/demo/index.html y scenes.js. Copyright (c) 2026 Lemomo (LemoLab). Licencia MIT: ver LICENSE-lemo-opuscar.txt.
// Funciones de dibujo extraídas sin cambios de index.html (nextRing, galaxy, tinyGalaxy, satellite, bacterium, rbc) y scenes.js (virusShape).

import { C, el, g, r1, rng, clipOf, shaded, text } from "./flat.js";
import { capsule } from "./heroes.js";
function nextRing(p, x, y, r, label, lx, ly, anchor = 'start') {
  el('circle', { cx: x, cy: y, r, fill: 'none', stroke: C.sun, 'stroke-width': 4 }, p);
  el('circle', { cx: x, cy: y, r: r + 13, fill: 'none', stroke: C.sun, 'stroke-width': 2.5, 'stroke-dasharray': '3 9', 'stroke-linecap': 'round' }, p);
  const a = Math.atan2(ly - y, lx - x), sx = x + Math.cos(a) * (r + 22), sy = y + Math.sin(a) * (r + 22);
  const below = ly > y, ex = lx + (anchor === 'start' ? 30 : anchor === 'end' ? -30 : 0), ey = below ? ly - 46 : ly + 30;
  el('path', { d: `M${r1(sx)},${r1(sy)}L${ex},${ey}`, stroke: C.sun, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, p);
  text(p, lx, ly - 18, 'NEXT STOP', { 'font-size': 16, 'font-weight': 600, fill: C.sun, 'letter-spacing': 3, 'text-anchor': anchor });
  text(p, lx, ly + 14, label, { 'font-size': 28, 'font-weight': 600, fill: C.cream, 'text-anchor': anchor });
}

function galaxy(p, cx, cy, R, tilt, sq, seed) {
  const rr = rng(seed);
  const G = g(p, { transform: `translate(${cx},${cy}) rotate(${tilt}) scale(1,${sq})` });
  el('circle', { r: R * 1.1, fill: C.n2 }, G);
  el('circle', { r: R * 0.78, fill: C.n3 }, G);
  const b = 0.29, r0 = R * 0.085, th = Math.log(1 / 0.085) / b;
  const armPt = (ph, t, off = 0) => {
    const r = r0 * Math.exp(b * t), a = t + ph;
    const nx = Math.cos(a) * b - Math.sin(a), ny = Math.sin(a) * b + Math.cos(a), nl = Math.hypot(nx, ny);
    return [Math.cos(a) * r - ny / nl * off, Math.sin(a) * r + nx / nl * off];
  };
  const ribbon = (ph, wmax, t0, t1, col) => {
    const A = [], B = [];
    for (let i = 0; i <= 90; i++) {
      const u = i / 90, t = t0 + (t1 - t0) * u, w = wmax * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.25 + 0.05)), 0.8) * (0.55 + 0.45 * Math.exp(b * t) / Math.exp(b * t1));
      A.push(armPt(ph, t, w)); B.push(armPt(ph, t, -w));
    }
    const pts = A.concat(B.reverse());
    el('path', { d: 'M' + pts.map(q => `${r1(q[0])},${r1(q[1])}`).join('L') + 'Z', fill: col, 'stroke-linejoin': 'round' }, G);
  };
  for (const ph of [0, Math.PI]) ribbon(ph, R * 0.15, 1.0, th, C.blueD);
  for (const ph of [Math.PI * 0.5, Math.PI * 1.5]) ribbon(ph, R * 0.075, 2.2, th - 0.5, C.blueD);
  for (const ph of [0, Math.PI]) ribbon(ph - 0.05, R * 0.09, 1.2, th - 0.2, C.blue);
  // star clouds along the arms
  for (const ph of [0, Math.PI, Math.PI * 0.5, Math.PI * 1.5]) {
    const minor = ph % Math.PI !== 0;
    for (let i = 0; i < (minor ? 50 : 120); i++) {
      const t = 1.2 + rr() * (th - 1.2), u = t / th;
      const [x, y] = armPt(ph, t, (rr() - 0.5) * R * (minor ? 0.14 : 0.26));
      const k = rr(), size = (1 - u * 0.5) * (minor ? 6 : 10) * (0.35 + rr());
      const fill = k < 0.06 ? C.coral : k < 0.12 ? C.mint : u < 0.4 ? (k < 0.6 ? C.sun : C.cream) : k < 0.78 ? C.cream : C.sun;
      el('circle', { cx: r1(x), cy: r1(y), r: r1(size), fill }, G);
    }
  }
  // core: three flat steps
  el('circle', { r: R * 0.15, fill: C.sun }, G);
  el('circle', { r: R * 0.075, fill: C.cream }, G);
  return { at: (ph, t, off = 0) => { const [x, y] = armPt(ph, t, off); const a = tilt * Math.PI / 180, ys = y * sq; return [cx + Math.cos(a) * x - Math.sin(a) * ys, cy + Math.sin(a) * x + Math.cos(a) * ys]; }, r0, b, th };
}

function tinyGalaxy(p, x, y, r, rot) {
  const G = g(p, { transform: `translate(${x},${y}) rotate(${rot}) scale(1,0.42)` });
  el('circle', { r: r * 1.5, fill: C.n2 }, G); el('circle', { r, fill: C.n3 }, G);
  el('circle', { r: r * 0.55, fill: C.blueD }, G); el('circle', { r: r * 0.22, fill: C.cream }, G);
}

// ---------- satellites ----------
function satellite(p, x, y, s, rot, body = C.cream, bodyD = C.creamD) {
  const G = g(p, { transform: `translate(${x},${y}) rotate(${rot})` });
  el('rect', { x: -s * 1.05, y: -s * 0.05, width: s * 2.1, height: s * 0.1, fill: C.mist }, G);
  for (const sx of [-1, 1]) {
    const px = sx > 0 ? s * 0.42 : -s * 1.12;
    el('rect', { x: px, y: -s * 0.24, width: s * 0.7, height: s * 0.48, rx: s * 0.05, fill: C.blueD }, G);
    el('rect', { x: px, y: -s * 0.24, width: s * 0.7, height: s * 0.22, rx: s * 0.05, fill: C.blue }, G);
  }
  shaded(G, 'rect', { x: -s * 0.3, y: -s * 0.3, width: s * 0.6, height: s * 0.6, rx: s * 0.12 }, body, bodyD, s * 0.1, s * 0.1);
  el('circle', { cx: 0, cy: -s * 0.02, r: s * 0.1, fill: C.coral }, G);
  return G;
}

// ---------- bacterium: coral rod with flagella ----------
function bacterium(p, x, y, len, wid, rot, o = {}) {
  const G = g(p, { transform: `translate(${x},${y}) rotate(${rot})` });
  const base = o.dim ? C.coralD : C.coral, shade = o.dim ? '#B83A3C' : C.coralD;
  if (o.tails !== false) for (const [sy, k] of [[-0.25, 1], [0.2, -1], [0.0, 1]]) {
    const x0 = -len / 2 + wid * 0.2, y0 = sy * wid;
    el('path', { d: `M${x0},${y0}C${x0 - len * 0.25},${y0 + k * wid * 0.6} ${x0 - len * 0.35},${y0 - k * wid * 0.7} ${x0 - len * 0.62},${y0 + k * wid * 0.1}`, fill: 'none', stroke: shade, 'stroke-width': Math.max(2.5, wid * 0.09), 'stroke-linecap': 'round' }, G);
  }
  shaded(G, 'rect', { x: -len / 2, y: -wid / 2, width: len, height: wid, rx: wid / 2 }, base, shade, 0, wid * 0.22);
  if (!o.dim) for (const q of [-0.22, 0.12]) el('circle', { cx: q * len, cy: -wid * 0.08, r: wid * 0.12, fill: C.sun }, G);
  return G;
}

// red blood cell, top view (flat disc + dimple)
function rbc(p, x, y, r) {
  shaded(p, 'circle', { cx: x, cy: y, r }, C.coral, C.coralD, r * 0.1, r * 0.1);
  el('circle', { cx: x + r * 0.04, cy: y + r * 0.04, r: r * 0.52, fill: C.coralD }, p);
  const G = g(p, { 'clip-path': clipOf('circle', { cx: x + r * 0.04, cy: y + r * 0.04, r: r * 0.52 }) });
  el('circle', { cx: x + r * 0.16, cy: y + r * 0.16, r: r * 0.52, fill: C.coral }, G);
}


function virusShape(p, x, y, R, rot) {
  for (let i = 0; i < 16; i++) {
    const a = rot + i / 16 * Math.PI * 2; if (Math.abs(((a + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)) < 0.32 || Math.abs(((a + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - 2 * Math.PI) < 0.32) continue;
    capsule(p, x + Math.cos(a) * R * 0.92, y + Math.sin(a) * R * 0.92, x + Math.cos(a) * R * 1.22, y + Math.sin(a) * R * 1.22, R * 0.07, C.mist);
    el('circle', { cx: r1(x + Math.cos(a) * R * 1.27), cy: r1(y + Math.sin(a) * R * 1.27), r: r1(R * 0.1), fill: C.coral }, p);
  }
  shaded(p, 'circle', { cx: r1(x), cy: r1(y), r: r1(R) }, C.cream, C.creamD, R * 0.13, R * 0.12);
  const Rv = rng(77);
  for (let i = 0; i < 9; i++) { const a = Rv() * 6.28, rr = Rv() * R * 0.7; el('circle', { cx: r1(x + Math.cos(a) * rr), cy: r1(y + Math.sin(a) * rr), r: r1(R * (0.05 + Rv() * 0.04)), fill: C.creamD }, p); }
}

export { nextRing, galaxy, tinyGalaxy, satellite, bacterium, rbc, virusShape };
