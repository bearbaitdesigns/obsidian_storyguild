/* =====================================================================
   Wordwright glyphs: a script for the conlang
   ---------------------------------------------------------------------
   Signs are made, not stored: every glyph comes from the note's style,
   seed and sounds, so the same settings always draw the same script.
   Only re-rolls and hand-drawn signs are saved (glyphs.rolls, .custom).
   A glyph is a list of strokes {d, f?, w?} in a 100 × 100 box (ink 15–85).
   ===================================================================== */
const GL_STYLES = [
  { id: 'runic', name: 'Runic', blurb: 'Straight strokes cut into wood or stone. No curves.', w: 7, cap: 'square', straight: true },
  { id: 'flowing', name: 'Flowing', blurb: 'Looping curves, like an elvish hand.', w: 6.5 },
  { id: 'geometric', name: 'Geometric', blurb: 'Bars and corners on a grid, square and orderly.', w: 8, cap: 'square', straight: true },
  { id: 'orbital', name: 'Orbital', blurb: 'Circles, arcs and dots.', w: 6 },
  { id: 'brush', name: 'Brush', blurb: 'Broad-nib calligraphy, thick and thin.', w: 3, nib: true },
  { id: 'wedge', name: 'Wedge', blurb: 'Wedge marks pressed into clay.', w: 3.5, straight: true },
  { id: 'hanging', name: 'Hanging', blurb: 'Shapes hang from a line that joins each word.', w: 6, gap: 0 },
  { id: 'thorn', name: 'Thorned', blurb: 'Jagged spines and barbs. Dark and sharp.', w: 5, cap: 'square', straight: true },
  { id: 'arcane', name: 'Arcane circle', blurb: 'Rings, inscribed stars and a band of tiny runes, like a summoning circle.', w: 2 },
  { id: 'constellation', name: 'Constellation', blurb: 'Stars joined by fine lines. Words can join into one picture.', w: 2.4 },
];
const GL_TYPES = [
  ['Alphabet', 'A letter for each consonant and vowel.', 'k · a · r → three signs'],
  ['Abjad', 'Letters for consonants only; vowels are left out, or shown with small points.', 'k r → two signs'],
  ['Abugida', 'Each consonant carries a vowel; small marks change the vowel.', 'ka · r → one sign and a mark'],
  ['Syllabary', 'One sign for each syllable (ka, ki, ko…).', 'ka · ri → two signs'],
  ['Logographic', 'One sign for each word; names are spelled out in sound signs.', 'kar → one sign'],
];
const GL_FLAIR_STYLE = { dark: 'thorn', infernal: 'thorn', germanic: 'runic', norse: 'runic', celtic: 'flowing', elvish: 'flowing', fae: 'orbital', latin: 'geometric', slavic: 'hanging', whisky: 'brush', 'sea-worn': 'orbital' };
const GL_PUNCT = { '.': 'period', ',': 'comma', '?': 'question', '!': 'exclaim', ';': 'comma', ':': 'period' };
const glStyle = (id) => GL_STYLES.find((x) => x.id === id) || GL_STYLES[0];
function glDefaultStyle(fm) {
  const fl = String(((fm || {}).phonology || {}).flair || '').toLowerCase().split(/\s*,\s*/).filter(Boolean);
  for (const x of fl) if (GL_FLAIR_STYLE[x]) return GL_FLAIR_STYLE[x];
  return 'flowing';
}

/* ---------- random numbers that repeat for the same seed ---------- */
function glHash(str) { let h1 = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h1 = Math.imul(h1 ^ str.charCodeAt(i), 3432918353); h1 = (h1 << 13) | (h1 >>> 19); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 = Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (h1 ^ (h1 >>> 16)) >>> 0; }
function glRng(seed) { let a = glHash(String(seed)); return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const glPick = (r, a) => a[Math.floor(r() * a.length) % a.length];
const glN = (v) => Math.round(v * 10) / 10;
const glC = (v) => Math.max(15, Math.min(85, v));

/* ---------- path pieces (absolute commands only, so they can be moved and scaled) ---------- */
const glL = (x1, y1, x2, y2) => `M${glN(x1)} ${glN(y1)}L${glN(x2)} ${glN(y2)}`;
const glPoly = (pts, close) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${glN(x)} ${glN(y)}`).join('') + (close ? 'Z' : '');
const glCirc = (cx, cy, r) => `M${glN(cx - r)} ${glN(cy)}A${glN(r)} ${glN(r)} 0 1 0 ${glN(cx + r)} ${glN(cy)}A${glN(r)} ${glN(r)} 0 1 0 ${glN(cx - r)} ${glN(cy)}`;
const glDot = (cx, cy, r = 6) => ({ d: glCirc(cx, cy, r), f: true });
function glArc(cx, cy, r, a0, span) {
  const p = (a) => [glN(cx + r * Math.cos(a)), glN(cy + r * Math.sin(a))]; const [x0, y0] = p(a0), [x1, y1] = p(a0 + span);
  return `M${x0} ${y0}A${glN(r)} ${glN(r)} 0 ${span > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
}
/** Move, scale, mirror or quarter-turn a path: m = [a, b, c, d, e, f] (x' = ax + cy + e, y' = bx + dy + f). */
function glAffine(d, m) {
  const [a, b, c, dd, e, f] = m; const P = (x, y) => [glN(a * x + c * y + e), glN(b * x + dd * y + f)];
  const det = a * dd - b * c; const sx = Math.hypot(a, b), sy = Math.hypot(c, dd); const turned = Math.abs(b) > Math.abs(a);
  let out = '';
  for (const [, cmd, rest] of String(d).matchAll(/([MLCSQTAZ])([^MLCSQTAZ]*)/gi)) {
    const n = (rest.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number); const C = cmd.toUpperCase();
    if (C === 'Z') { out += 'Z'; continue; }
    if (C === 'A') { for (let i = 0; i + 7 <= n.length; i += 7) { let rx = n[i] * sx, ry = n[i + 1] * sy; if (turned) [rx, ry] = [n[i + 1] * sx, n[i] * sy]; const [x, y] = P(n[i + 5], n[i + 6]); out += `A${glN(rx)} ${glN(ry)} ${n[i + 2]} ${n[i + 3]} ${det < 0 ? 1 - n[i + 4] : n[i + 4]} ${x} ${y}`; } continue; }
    const pts = []; for (let i = 0; i + 1 < n.length; i += 2) pts.push(P(n[i], n[i + 1]).join(' '));
    out += C + pts.join(' ');
  }
  return out;
}
const glMove = (strokes, m) => strokes.map((s2) => { const o = Object.assign({}, s2, { d: glAffine(s2.d, m) }); if (s2.n) { const [a, b, c, dd, e, f] = m; o.n = Object.assign({}, s2.n, { x: a * s2.n.x + c * s2.n.y + e, y: b * s2.n.x + dd * s2.n.y + f }); } return o; });
const glBox = (sx, sy, tx, ty) => [sx, 0, 0, sy, tx, ty];
/** Turn a glyph about its centre: 0 none, 1 quarter turn, 2 half, 3 mirrored, 4 three quarters */
const GL_TURNS = [[1, 0, 0, 1, 0, 0], [0, 1, -1, 0, 100, 0], [-1, 0, 0, -1, 100, 100], [-1, 0, 0, 1, 100, 0], [0, -1, 1, 0, 0, 100]];

/* ---------- one generator per look ---------- */
/* ---------- the parts each look can use; turn them on and off per glyph set ---------- */
const GL_ELEMENTS = {
  runic: [['stave', 'Staves', 1], ['branch', 'Branches', 1], ['pocket', 'Pockets', 1], ['cross', 'Crossing strokes', 1], ['free', 'Standalone shapes', 1], ['triangle', 'Triangles', 0]],
  flowing: [['curve', 'Curves', 1], ['loop', 'Loops', 1], ['dot', 'Dots', 1], ['hook', 'Hooked ends', 0]],
  geometric: [['bar', 'Bars', 1], ['box', 'Boxes', 1], ['dot', 'Dots', 1], ['triangle', 'Triangles', 0], ['circle', 'Circles', 0]],
  orbital: [['circle', 'Circles', 1], ['arc', 'Arcs', 1], ['dot', 'Dots', 1], ['spoke', 'Spokes', 1], ['inner', 'Inner rings', 1], ['bullseye', 'Dot in a circle', 0]],
  brush: [['stroke', 'Strokes', 1], ['dot', 'Dots', 1], ['hook', 'Hooks', 0]],
  wedge: [['wedge', 'Wedges', 1], ['corner', 'Corner wedges', 1], ['triangle', 'Closed triangles', 0], ['opentri', 'Open triangles', 0]],
  hanging: [['bar', 'Upright bar', 1], ['bowl', 'Bowls', 1], ['hook', 'Hooks', 1], ['loop', 'Loops', 1], ['knot', 'Cross-strokes', 1], ['tail', 'Tails', 1]],
  thorn: [['zig', 'Zigzags', 1], ['fork', 'Forks', 1], ['slash', 'Slashes', 1], ['crown', 'Crowns', 1], ['barb', 'Barbs', 1]],
  arcane: [['ring', 'Double ring', 1], ['runes', 'Rune band', 1], ['polygon', 'Inscribed triangle or star', 1], ['nodes', 'Small circles at the points', 1], ['center', 'Centre seal', 1], ['orbit', 'Off-centre orbits', 1], ['spiral', 'Spiral', 0], ['spokes', 'Spokes', 0], ['outer', 'Outer nodes on the ring', 0]],
  constellation: [['dot', 'Closed dots', 1], ['ring', 'Open dots', 0], ['bullseye', 'Dot in a circle', 0], ['star', 'Closed stars', 0], ['openstar', 'Open stars', 0], ['line', 'Single lines', 1], ['double', 'Double lines', 0], ['triple', 'Triple lines', 0]],
};
/** which parts are on: the set's own choice for this look, or the look's defaults */
function glElems(set) {
  const id = set.style.id; const all = GL_ELEMENTS[id] || []; const own = ((set.g && set.g.elements) || {})[id];
  const on = new Set(Array.isArray(own) && own.length ? own : all.filter((x) => x[2]).map((x) => x[0]));
  const E = (k) => on.has(k); E.list = (ks) => ks.filter((k) => on.has(k)); return E;
}
const GL_NODES = ['dot', 'ring', 'bullseye', 'star', 'openstar'];
const glStarPts = (cx, cy, R, k = 0.45, n = 5) => { const p = []; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n; const rr = i % 2 ? R * k : R; p.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); } return p; };
/** one star of a constellation; the first stroke carries what it is and where (for joining words) */
function glNode(t, x, y, r) {
  const n = { t, x, y, r: r + 1.5 }; let out;
  if (t === 'ring') out = [{ d: glCirc(x, y, r * 0.9), w: 2 }];
  else if (t === 'bullseye') out = [{ d: glCirc(x, y, r + 1.2), w: 1.8 }, glDot(x, y, Math.max(1.8, r * 0.42))];
  else if (t === 'star') out = [{ d: glPoly(glStarPts(x, y, r * 1.6), true), f: true }];
  else if (t === 'openstar') out = [{ d: glPoly(glStarPts(x, y, r * 1.65), true), w: 1.6 }];
  else out = [glDot(x, y, r)];
  out[0] = Object.assign({}, out[0], { n }); return out;
}
/** a line between two stars, stopping at their edges: single, double or triple */
function glEdge(a, b, kind, w) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L; const nx = -uy, ny = ux;
  const x1 = a.x + ux * a.r, y1 = a.y + uy * a.r, x2 = b.x - ux * b.r, y2 = b.y - uy * b.r; if (L < a.r + b.r + 2) return [];
  const offs = kind === 'triple' ? [-3.4, 0, 3.4] : kind === 'double' ? [-2.3, 2.3] : [0]; const ww = kind === 'line' ? w : Math.max(1.2, w * 0.62);
  return offs.map((o) => ({ d: glL(x1 + nx * o, y1 + ny * o, x2 + nx * o, y2 + ny * o), w: ww }));
}
/** a tiny rune set along a ring: a few strokes in the ring's own direction */
function glMiniRune(r, cx, cy, a, rm, sz = 2.4) {
  const tx = -Math.sin(a), ty = Math.cos(a), nx = Math.cos(a), ny = Math.sin(a); const bx = cx + rm * nx, by = cy + rm * ny;
  const L = (u, v) => [bx + tx * u * sz / 2 + nx * v * sz / 2, by + ty * u * sz / 2 + ny * v * sz / 2];
  const SH = [[[[0, -2], [0, 2]]], [[[0, -2], [0, 2]], [[0, 0], [1.4, 1.6]]], [[[-1.2, -2], [0, 2], [1.2, -2]]], [[[-1, -2], [1, 2]], [[1, -2], [-1, 2]]], [[[0, -2], [0, 2]], [[-1.2, -0.6], [1.2, -0.6]]], [[[-1.2, 2], [0, -2], [1.2, 2]]], [[[-1, -2], [-1, 2], [1, 2]]], [[[0, -2], [1.2, 0], [0, 2], [-1.2, 0], [0, -2]]]];
  return glPick(r, SH).map((poly) => ({ d: glPoly(poly.map(([u, v]) => L(u, v))), w: 0.9 }));
}
const GL_GEN = {
  arcane(r, c, E) {
    const out = []; const cx = 50, cy = 50, R = 35; const thin = 1.3, mid = 2.1; const P = (a, rr) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
    const band = E('runes') ? 7.5 : 4; const inner = E('ring') ? R - band : R;
    out.push({ d: glCirc(cx, cy, R), w: mid }); if (E('ring')) out.push({ d: glCirc(cx, cy, inner), w: thin });
    if (E('runes') && E('ring')) { const n = 18 + Math.floor(r() * 10); const a0 = r() * Math.PI * 2; for (let i = 0; i < n; i++) { if (r() < 0.12) continue; out.push(...glMiniRune(r, cx, cy, a0 + (i / n) * Math.PI * 2, R - band / 2)); } }
    const rot = -Math.PI / 2 + Math.floor(r() * 4) * (Math.PI / 6); const kinds = c === 1 ? ['tri', 'square', 'tri'] : ['tri', 'hex', 'pent', 'square', 'tri', 'hex']; const kind = glPick(r, kinds);
    const n = { tri: 3, hex: 3, pent: 5, square: 4 }[kind]; const verts = []; for (let i = 0; i < n; i++) verts.push(P(rot + (i / n) * Math.PI * 2, inner));
    if (E('polygon')) {
      if (kind === 'pent') out.push({ d: glPoly([0, 2, 4, 1, 3].map((i) => verts[i]), true), w: thin });
      else out.push({ d: glPoly(verts, true), w: thin });
      if (kind === 'hex') out.push({ d: glPoly(verts.map((_, i) => P(rot + Math.PI / 3 + (i / 3) * Math.PI * 2, inner)), true), w: thin });
      if (kind === 'square' && c >= 2 && r() < 0.6) out.push({ d: glPoly(verts.map((_, i) => P(rot + Math.PI / 4 + (i / 4) * Math.PI * 2, inner)), true), w: thin });
      if (c >= 2 && r() < 0.5) out.push({ d: glCirc(cx, cy, inner * (kind === 'tri' ? 0.5 : 0.62)), w: thin });
    }
    if (E('spokes')) for (const [x, y] of verts) out.push({ d: glL(cx, cy, x, y), w: thin });
    if (E('orbit') && c >= 2) { const k = 1 + (c >= 3 ? 1 : 0); for (let i = 0; i < k; i++) { const a = r() * Math.PI * 2, d = 4 + r() * 8, rr = 10 + r() * 12; const [ox, oy] = P(a, d); if (r() < 0.6) out.push({ d: glCirc(ox, oy, rr), w: thin }); else out.push({ d: glArc(ox, oy, rr, a, Math.PI * (1 + r())), w: thin }); } }
    if (E('spiral')) { const pts = []; const a0 = r() * Math.PI * 2; for (let i = 0; i <= 40; i++) { const t = i / 40; const a = a0 + t * Math.PI * 3.2; pts.push(P(a, 2 + t * 14)); } out.push({ d: glPoly(pts), w: thin }); }
    if (E('nodes') && c >= 2) for (const [x, y] of verts) { out.push({ d: glCirc(x, y, 5), w: thin }); if (r() < 0.5) out.push(glDot(x, y, 1.4)); else out.push(...glMiniRune(r, x, y, 0, 0, 2.6)); }
    if (E('outer')) { const m = 2 + Math.floor(r() * 3); const a0 = r() * Math.PI * 2; for (let i = 0; i < m; i++) { const [x, y] = P(a0 + (i / m) * Math.PI * 2, R); out.push({ d: glCirc(x, y, 4.5), w: thin }); out.push(glDot(x, y, 1.4)); } }
    if (E('center')) { out.push({ d: glCirc(cx, cy, 6), w: thin }); if (c >= 2) out.push({ d: glCirc(cx, cy, 3.4), w: thin }); out.push(glDot(cx, cy, 1.5)); }
    return out;
  },
  runic(r, c, E) {
    const out = [];
    if ((c === 1 && r() < 0.5 && E('free')) || !E('stave')) {
      if (E('free') || !E.list(['branch', 'pocket', 'cross', 'triangle']).length) {
        const k = glPick(r, ['x', 'diamond', 'angle', 'arrow', ...(E('stave') ? ['stave'] : []), ...(E('triangle') ? ['tri'] : [])]);
        if (k === 'x') return [{ d: glL(28, 18, 72, 82) }, { d: glL(72, 18, 28, 82) }];
        if (k === 'diamond') return [{ d: glPoly([[50, 18], [76, 50], [50, 82], [24, 50]], true) }];
        if (k === 'angle') return [{ d: glPoly([[70, 18], [30, 50], [70, 82]]) }];
        if (k === 'arrow') return [{ d: glL(50, 15, 50, 85) }, { d: glPoly([[26, 38], [50, 15], [74, 38]]) }];
        if (k === 'tri') return [{ d: glPoly([[50, 18], [78, 78], [22, 78]], true) }];
        return [{ d: glL(50, 15, 50, 85) }];
      }
    }
    const staves = E('stave'); const xs = staves && c >= 2 && r() < 0.28 ? [32, 68] : [glPick(r, [36, 50, 64])];
    if (staves) xs.forEach((x) => out.push({ d: glL(x, 15, x, 85) }));
    const kinds = E.list(['branch', 'pocket', 'cross', 'triangle']); const n = c === 1 ? 1 : c === 2 ? 1 + (r() < 0.6 ? 1 : 0) : 2 + (r() < 0.5 ? 1 : 0);
    const used = new Set();
    for (let i = 0; i < n && kinds.length; i++) {
      const x = glPick(r, xs); const y = glPick(r, [15, 30, 45, 58]); const dir = xs.length === 2 ? (x === 32 ? 1 : -1) : r() < 0.5 ? -1 : 1; const kind = glPick(r, kinds); const tag = `${x}${y}${dir}`;
      if (used.has(tag)) continue; used.add(tag);
      if (kind === 'branch') { if (xs.length === 2 && r() < 0.5) out.push({ d: glL(32, y, 68, Math.min(85, y + glPick(r, [0, 22, 30]))) }); else out.push({ d: glL(x, y, glC(x + dir * glPick(r, [24, 32])), Math.min(85, y + glPick(r, [16, 26]))) }); }
      else if (kind === 'pocket') out.push({ d: glPoly([[x, y], [glC(x + dir * 26), y + 14], [x, Math.min(85, y + 28)]]) });
      else if (kind === 'triangle') out.push({ d: glPoly([[x, y], [glC(x + dir * 24), y + 12], [x, Math.min(85, y + 24)]], true), f: r() < 0.4 });
      else out.push({ d: glL(glC(x - 22), y + 6, glC(x + 22), Math.min(85, y + 28)) });
    }
    if (!out.length) out.push({ d: glL(50, 15, 50, 85) });
    return out;
  },
  geometric(r, c, E) {
    const G = [20, 50, 80]; const pt = (i) => [G[i % 3], G[Math.floor(i / 3)]];
    const out = []; const walk = (len) => {
      let at = Math.floor(r() * 9); const pts = [pt(at)]; let lastAxis = -1;
      for (let s2 = 0; s2 < len; s2++) {
        const axis = lastAxis === 0 ? 1 : lastAxis === 1 ? 0 : r() < 0.5 ? 0 : 1; const [cx, cy] = [at % 3, Math.floor(at / 3)];
        const opts = [0, 1, 2].filter((v) => v !== (axis === 0 ? cx : cy)); const v = glPick(r, opts);
        at = axis === 0 ? cy * 3 + v : v * 3 + cx; pts.push(pt(at)); lastAxis = axis;
      }
      return { d: glPoly(pts) };
    };
    const extra = () => { const [x, y] = pt(Math.floor(r() * 9)); const k = glPick(r, E.list(['box', 'dot', 'triangle', 'circle']).concat(E('bar') ? ['bar'] : []));
      if (k === 'box') return { d: glPoly([[x - 9, y - 9], [x + 9, y - 9], [x + 9, y + 9], [x - 9, y + 9]], true) };
      if (k === 'dot') return glDot(x, y, 6); if (k === 'triangle') return { d: glPoly([[x, y - 10], [x + 10, y + 8], [x - 10, y + 8]], true) };
      if (k === 'circle') return { d: glCirc(x, y, 9) }; return walk(1); };
    if (E('bar')) out.push(walk(c === 1 ? 1 + (r() < 0.5 ? 1 : 0) : c + 1));
    const nx = E('bar') ? (c >= 2 && r() < 0.6 ? 1 : 0) + (c >= 3 ? 1 : 0) : c + 1;
    for (let i = 0; i < nx; i++) { const e = extra(); if (e) out.push(e); }
    if (!out.length) out.push(walk(2));
    return out;
  },
  flowing(r, c, E) {
    const G = [22, 50, 78]; const jit = () => (r() - 0.5) * 8; const out = [];
    const strokeThrough = (n) => {
      const pts = []; let last = -1;
      for (let i = 0; i < n; i++) { let k; let tries = 0; do { k = Math.floor(r() * 9); tries++; } while ((k === last || (pts.length && Math.hypot(G[k % 3] - pts[pts.length - 1][0], G[Math.floor(k / 3)] - pts[pts.length - 1][1]) < 30)) && tries < 30); last = k; pts.push([glC(G[k % 3] + jit()), glC(G[Math.floor(k / 3)] + jit())]); }
      let d = `M${glN(pts[0][0])} ${glN(pts[0][1])}`; let bend = r() < 0.5 ? 1 : -1;
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; const len = Math.hypot(bx - ax, by - ay) || 1; const nx = -(by - ay) / len, ny = (bx - ax) / len; const off = bend * len * (0.25 + r() * 0.3);
        d += `C${glN(glC(ax + (bx - ax) * 0.3 + nx * off))} ${glN(glC(ay + (by - ay) * 0.3 + ny * off))} ${glN(glC(ax + (bx - ax) * 0.7 + nx * off))} ${glN(glC(ay + (by - ay) * 0.7 + ny * off))} ${glN(bx)} ${glN(by)}`;
        if (r() < 0.6) bend = -bend;
      }
      return { d, start: pts[0], end: pts[pts.length - 1] };
    };
    const main = strokeThrough(c === 1 ? 2 : c + 1); out.push({ d: main.d });
    const deco = E.list(['loop', 'dot', 'hook']); const k = deco.length && r() < 0.55 ? glPick(r, deco) : null;
    if (k === 'loop') out.push({ d: glCirc(main.start[0], main.start[1] - 6, 6) });
    else if (k === 'dot') out.push(glDot(glC(main.end[0] + (r() < 0.5 ? 12 : -12)), glC(main.end[1] - 14), 5));
    else if (k === 'hook') out.push({ d: `M${glN(main.end[0])} ${glN(main.end[1])}Q${glN(glC(main.end[0] + 12))} ${glN(glC(main.end[1] + 2))} ${glN(glC(main.end[0] + 6))} ${glN(glC(main.end[1] - 10))}` });
    if (c >= 3 || (c === 2 && r() < 0.3)) out.push({ d: strokeThrough(2).d });
    return out;
  },
  orbital(r, c, E) {
    const cx = glPick(r, [44, 50, 56]), cy = 50; const R = c === 1 ? glPick(r, [16, 22]) : glPick(r, [24, 30]);
    const out = []; const q = Math.PI / 2; const bases = E.list(['circle', 'arc']);
    const base = bases.length ? glPick(r, bases) : 'arc';
    if (base === 'circle') out.push({ d: glCirc(cx, cy, R) }); else out.push({ d: glArc(cx, cy, R, Math.floor(r() * 4) * q, glPick(r, [Math.PI, 1.5 * Math.PI, 1.25 * Math.PI])) });
    const extras = E.list(['dot', 'spoke', 'inner', 'bullseye']);
    for (let i = 0; i < c && extras.length; i++) {
      const a = Math.floor(r() * 8) * (Math.PI / 4); const k = glPick(r, extras); const px = (rr) => cx + rr * Math.cos(a), py = (rr) => cy + rr * Math.sin(a);
      if (k === 'dot') out.push(r() < 0.6 ? glDot(px(R), py(R), 5.5) : glDot(glC(px(R + 14)), glC(py(R + 14)), 5));
      else if (k === 'spoke') out.push({ d: glL(px(R), py(R), glC(px(R + 20)), glC(py(R + 20))) });
      else if (k === 'bullseye') { const bx = glC(px(R + 12)), by = glC(py(R + 12)); out.push({ d: glCirc(bx, by, 7), w: 3 }, glDot(bx, by, 3)); }
      else out.push({ d: r() < 0.5 ? glCirc(cx, cy, R * 0.4) : glArc(cx, cy, R * 0.5, a, Math.PI) });
    }
    return out;
  },
  brush(r, c, E) {
    const G = [22, 50, 78]; const jit = () => (r() - 0.5) * 12; const out = [];
    const n = c === 1 ? 1 + (r() < 0.4 ? 1 : 0) : c;
    for (let i = 0; i < n; i++) {
      const a = [glC(G[Math.floor(r() * 3)] + jit()), glC(G[Math.floor(r() * 3)] + jit())]; let b; do { b = [glC(G[Math.floor(r() * 3)] + jit()), glC(G[Math.floor(r() * 3)] + jit())]; } while (Math.hypot(a[0] - b[0], a[1] - b[1]) < 25);
      const mx = (a[0] + b[0]) / 2 + (r() - 0.5) * 30, my = (a[1] + b[1]) / 2 + (r() - 0.5) * 30;
      out.push({ d: `M${glN(a[0])} ${glN(a[1])}Q${glN(mx)} ${glN(my)} ${glN(b[0])} ${glN(b[1])}` });
      if (E('hook') && r() < 0.35) out.push({ d: `M${glN(b[0])} ${glN(b[1])}Q${glN(glC(b[0] + 8))} ${glN(glC(b[1] + 8))} ${glN(glC(b[0] + 2))} ${glN(glC(b[1] + 14))}` });
    }
    if (E('dot') && r() < 0.35) { const x = glC(25 + r() * 50), y = glC(25 + r() * 50); out.push({ d: glL(x, y, x + 5, y + 6) }); }
    return out;
  },
  wedge(r, c, E) {
    const slots = [[24, 26], [50, 26], [76, 26], [24, 52], [50, 52], [76, 52], [24, 76], [50, 76], [76, 76]];
    const n = c === 1 ? 1 + (r() < 0.5 ? 1 : 0) : c === 2 ? 2 + (r() < 0.5 ? 1 : 0) : 3 + Math.floor(r() * 2);
    const kinds = E.list(['wedge', 'corner', 'triangle', 'opentri']); if (!kinds.length) kinds.push('wedge');
    const out = []; const taken = new Set();
    for (let i = 0; i < n; i++) {
      let k; let tries = 0; do { k = Math.floor(r() * 9); tries++; } while (taken.has(k) && tries < 20); taken.add(k);
      const [x, y] = slots[k]; const kind = glPick(r, kinds); const ang = glPick(r, [0, 0, Math.PI / 2, Math.PI / 2, Math.PI / 4, Math.PI]);
      const rot = ([px, py]) => [x + px * Math.cos(ang) - py * Math.sin(ang), y + px * Math.sin(ang) + py * Math.cos(ang)];
      if (kind === 'corner') { out.push({ d: glPoly([[x + 10, y - 11], [x - 8, y], [x + 10, y + 11]]), w: 4 }); out.push({ d: glPoly([[x - 10, y - 5], [x - 4, y], [x - 10, y + 5]], true), f: true }); continue; }
      if (kind === 'triangle' || kind === 'opentri') { out.push({ d: glPoly([[-10, -10], [10, 0], [-10, 10]].map(rot), true), f: kind === 'triangle', w: 3 }); continue; }
      const len = 14; const o = [-len / 2 - 8, 0];
      out.push({ d: glPoly([[o[0], -10], [o[0] + 16, 0], [o[0], 10]].map(rot), true), f: true });
      out.push({ d: glPoly([[o[0] + 14, 0], [o[0] + 16 + len, 0]].map(rot)), w: 4.5 });
    }
    return out;
  },
  hanging(r, c, E) {
    const out = [{ d: glL(0, 20, 100, 20) }]; const bar = E('bar') && r() < 0.65; const bx = glPick(r, [64, 70]);
    if (bar) out.push({ d: glL(bx, 20, bx, 84) });
    const shapes = E.list(['bowl', 'hook', 'loop', 'knot', 'tail']); const n = c === 1 ? 1 : c === 2 ? 1 + (r() < 0.5 ? 1 : 0) : 2;
    const used = new Set();
    for (let i = 0; i < n && shapes.length; i++) {
      let k; do { k = glPick(r, shapes); } while (used.has(k) && used.size < shapes.length); used.add(k);
      const x = bar ? bx : glPick(r, [40, 50, 60]);
      if (k === 'bowl') out.push({ d: `M${x} 46C${x - 46} 40 ${x - 46} 84 ${x - 8} 80` });
      else if (k === 'hook') out.push({ d: `M${x - 30} 20C${x - 46} 40 ${x - 10} 52 ${x - 26} 70S${x - 40} 86 ${x - 46} 80` });
      else if (k === 'loop') { out.push({ d: glL(x - 28, 20, x - 28, 36) }); out.push({ d: glCirc(x - 28, 48, 12) }); }
      else if (k === 'knot') out.push({ d: glL(x - 40, 52, x, 52) });
      else out.push({ d: `M${x} 70Q${x + 22} 72 ${x + 18} 88` });
    }
    if (out.length < 3 && !bar) out.push({ d: glL(50, 20, 50, 70) });
    return out;
  },
  thorn(r, c, E) {
    const out = []; const pool = E.list(c === 1 ? ['zig', 'fork', 'slash'] : ['zig', 'fork', 'slash', 'crown', 'zig']); const kind = pool.length ? glPick(r, pool) : 'zig';
    const barb = (x, y, dir, up = true) => out.push({ d: glL(x, y, glC(x + dir * glPick(r, [10, 14, 18])), Math.max(15, Math.min(85, y + (up ? -1 : 1) * glPick(r, [10, 16])))) });
    let pts;
    if (kind === 'zig') { const n = glPick(r, [2, 3, 4]); const x0 = glPick(r, [32, 50, 68]); pts = [[x0, 15]]; for (let i = 1; i <= n; i++) pts.push([glC(x0 + (i % 2 ? 1 : -1) * glPick(r, [12, 20, 28])), glN(15 + (70 * i) / n)]); out.push({ d: glPoly(pts) }); }
    else if (kind === 'fork') { const x = glPick(r, [42, 50, 58]); const fy = glPick(r, [38, 50]); out.push({ d: glPoly([[glC(x - 26), 15], [x, fy], [glC(x + 26), 15]]) }); out.push({ d: glL(x, fy, x + glPick(r, [-10, 0, 10]), 85) }); pts = [[x, fy], [x, 85]]; }
    else if (kind === 'slash') { const lr = r() < 0.5; pts = [[lr ? 24 : 76, 15], [lr ? 76 : 24, 85]]; out.push({ d: glPoly(pts) }); }
    else { pts = [[20, 15], [35, 40], [50, 18], [65, 40], [80, 15]]; out.push({ d: glPoly(pts) }); out.push({ d: glL(50, 18, 50, 85) }); }
    const nb = !E('barb') ? 0 : c === 1 ? (kind === 'slash' ? 1 : 0) : c - (kind === 'crown' ? 1 : 0) + (r() < 0.4 ? 1 : 0);
    for (let i = 0; i < nb; i++) { const t = 0.25 + r() * 0.6; const a = pts[0], b = pts[pts.length - 1]; const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t; barb(x, y, r() < 0.5 ? -1 : 1, r() < 0.7); }
    if (c >= 2 && r() < 0.3) out.push({ d: glL(24, glPick(r, [52, 66]), 76, glPick(r, [44, 58])) });
    return out;
  },
  constellation(r, c, E, n0) {
    const n = n0 || (c === 1 ? 2 + (r() < 0.5 ? 1 : 0) : c === 2 ? 3 + Math.floor(r() * 2) : 4 + Math.floor(r() * 3));
    const pts = []; let tries = 0;
    while (pts.length < n && tries++ < 400) { const p = [glN(16 + r() * 68), glN(16 + r() * 68)]; if (pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > (n > 5 ? 17 : 22))) pts.push(p); }
    const inT = [0]; const edges = [];
    while (inT.length < pts.length) { let best = null; for (const i of inT) for (let j = 0; j < pts.length; j++) if (!inT.includes(j)) { const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (!best || d < best[2]) best = [i, j, d]; } inT.push(best[1]); edges.push(best); }
    if (pts.length > 3 && r() < 0.35) { const a = Math.floor(r() * pts.length); const b = (a + 2) % pts.length; if (!edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) edges.push([a, b]); }
    const nodeKinds = E.list(GL_NODES); if (!nodeKinds.length) nodeKinds.push('dot'); const lineKinds = E.list(['line', 'double', 'triple']); if (!lineKinds.length) lineKinds.push('line');
    const kinds = pts.map((p, i) => (i === 0 && nodeKinds.length > 1 ? nodeKinds[nodeKinds.length - 1] : glPick(r, nodeKinds)));
    const sizes = pts.map((p, i) => (i === 0 ? 6.2 : glPick(r, [4, 4.8, 5.5])));
    const nodes = pts.map((p, i) => ({ t: kinds[i], x: p[0], y: p[1], r: kinds[i] === 'dot' ? sizes[i] * 0.6 : sizes[i] + 1.6 }));
    const lineKind = glPick(r, lineKinds); const out = [];
    for (const [i, j] of edges) out.push(...glEdge(nodes[i], nodes[j], lineKinds.length > 1 && r() < 0.3 ? glPick(r, lineKinds) : lineKind, 2.4));
    const deg = pts.map((_, i) => edges.filter(([a, b]) => a === i || b === i).length);
    pts.forEach((p, i) => { const parts = glNode(kinds[i], p[0], p[1], sizes[i]); parts[0].n.deg = deg[i]; out.push(...parts); });
    return out;
  },
};
/** Small marks (vowel points, the silent-consonant mark, stress), drawn in the full box and placed small. */
const GL_MARKS = {
  dot: () => [glDot(50, 50, 13)], dot2: () => [glDot(28, 50, 12), glDot(72, 50, 12)], dot3: () => [glDot(50, 28, 11), glDot(28, 70, 11), glDot(72, 70, 11)],
  bar: () => [{ d: glL(18, 50, 82, 50) }], bar2: () => [{ d: glL(20, 35, 80, 35) }, { d: glL(20, 68, 80, 68) }], vee: () => [{ d: glPoly([[20, 28], [50, 74], [80, 28]]) }],
  cross: () => [{ d: glL(50, 18, 50, 82) }, { d: glL(18, 50, 82, 50) }], ring: () => [{ d: glCirc(50, 50, 24) }], hook: () => [{ d: 'M22 30Q50 96 78 30' }], wave: () => [{ d: 'M14 54Q32 22 50 54T86 54' }],
  caret: () => [{ d: glPoly([[20, 72], [50, 26], [80, 72]]) }], dotbar: () => [{ d: glL(18, 66, 82, 66) }, glDot(50, 30, 12)],
};
const GL_MARK_SETS = { straight: ['dot', 'bar', 'vee', 'dot2', 'caret', 'cross', 'dot3', 'bar2', 'dotbar'], round: ['dot', 'ring', 'hook', 'dot2', 'wave', 'bar', 'dot3', 'caret', 'dotbar'] };
const GL_MARK_POS = ['above', 'below', 'above', 'below', 'right', 'above', 'below', 'right', 'above'];

/* ---------- the sign inventory for a script type ---------- */
function glSounds(fm) {
  const ph = fm.phonology || {}; const sp = (x) => String(x || '').toLowerCase().split(/\s+/).filter((t) => t && !isApos(t));
  const strip = (x) => x.normalize('NFD').replace(/\p{M}/gu, '');
  const V = []; for (const v of sp(ph.vowels)) { const b = /́/.test(v.normalize('NFD')) && sp(ph.vowels).includes(strip(v)) ? null : v; if (b && !V.includes(b)) V.push(b); }
  return { C: [...new Set(sp(ph.consonants))], V };
}
function glType(fm) { const t = fm.script; return t === 'Symbols' || GL_TYPES.some(([k]) => k === t) ? t : null; }
/** The signs, grouped as the chart shows them: [{title, hint, signs: [{key, label, mark?}]}] */
function glInventory(fm) {
  const t = glType(fm); const { C, V } = glSounds(fm); const g = fm.glyphs || {}; const groups = [];
  const S2 = (key, label, extra) => Object.assign({ key, label }, extra || {});
  const punct = { title: 'Marks and punctuation', signs: [S2('p:period', '.  end of a sentence'), S2('p:comma', ',  pause'), S2('p:question', '?  question'), S2('p:exclaim', '!  exclamation'), S2('p:hyphen', '-  joins a word'), S2("p:apos", "'  catch in the voice")] };
  if (t === 'Alphabet') {
    groups.push({ title: 'Consonants', signs: C.map((c) => S2('C:' + c, c)) }, { title: 'Vowels', signs: V.map((v) => S2('V:' + v, v)) });
    punct.signs.unshift(S2('m:stress', 'á  stressed vowel', { mark: true }));
  } else if (t === 'Abjad') {
    groups.push({ title: 'Consonants', signs: C.map((c) => S2('C:' + c, c)) }, { title: 'Vowel seat', hint: 'Carries a vowel that starts a word.', signs: [S2('V:seat', 'a word-first vowel')] });
    groups.push({ title: g.pointed ? 'Vowel points' : 'Vowel points (hidden)', hint: g.pointed ? 'Small points over or under a consonant show the vowel after it.' : 'Turn on “Show vowel points” to write vowels as small points.', signs: V.map((v) => S2('m:' + v, v, { mark: true })) });
  } else if (t === 'Abugida') {
    groups.push({ title: `Consonants (each says its sound + ${V[0] || 'a'})`, signs: C.map((c) => S2('C:' + c, c + (V[0] || 'a'))) });
    groups.push({ title: 'Vowel marks', hint: 'Added to a consonant to change its vowel.', signs: V.slice(1).map((v) => S2('m:' + v, '-' + v, { mark: true })) });
    groups.push({ title: 'Vowels on their own', hint: 'For a vowel with no consonant before it.', signs: V.map((v) => S2('V:' + v, v)) });
    punct.signs.unshift(S2('m:kill', 'no vowel (r, not ra)', { mark: true }));
  } else if (t === 'Syllabary') {
    groups.push({ title: 'Vowels', signs: V.map((v) => S2('V:' + v, v)) });
    for (const c of C) groups.push({ title: c + '-', row: true, signs: V.map((v, i) => S2(g.featural ? `C:${c}|${i}` : `S:${c}${v}`, c + v)) });
    punct.signs.unshift(S2('m:kill', 'no vowel (r, not ra)', { mark: true }));
  } else if (t === 'Logographic') {
    const lex = arr(fm.lexicon).filter((e) => e.word && !/\s/.test(e.word));
    groups.push({ title: 'Word signs', hint: 'Words that share a root share the left or top part of their sign.', words: true, signs: lex.map((e) => S2('W:' + e.word.toLowerCase(), e.word, { meaning: wwSplit(e.meaning)[0] || '' })) });
    groups.push({ title: 'Sound signs', hint: 'Names and new words are spelled with these, inside a frame.', signs: [...C.map((c) => S2('C:' + c, c)), ...V.map((v) => S2('V:' + v, v))] });
    punct.signs.push(S2('p:open', '⟨  a spelled-out name begins'), S2('p:close', '⟩  and ends'));
  }
  if (t === 'Symbols') { groups.push({ title: 'Symbols', words: true, signs: arr(fm.symbols).filter((y) => y && y.id).map((y) => S2('Y:' + y.id, y.name || '?', { meaning: y.meaning || '' })) }); return groups; }
  if (t) groups.push(punct);
  return groups;
}

/* ---------- making each sign ---------- */
const glCache = new Map();
function glSet(fm) {
  const g = fm.glyphs || {}; const inv = glInventory(fm);
  const key = JSON.stringify([fm.script, g, fm.slot, fm.codes, (fm.writing || {}).direction, arr(fm.symbols).map((y) => [y.id, y.name]), arr(fm.lexicon).map((e) => [e.word, e.root, e.meaning]), inv.map((x) => x.signs.map((s2) => s2.key))]);
  if (glCache.has(key)) return glCache.get(key);
  const set = { fm, g, style: glStyle(g.style || glDefaultStyle(fm)), signs: new Map(), seen: new Set(), inv };
  for (const grp of inv) for (const s2 of grp.signs) glSign(set, s2.key);
  if (glCache.size > 30) glCache.clear(); glCache.set(key, set);
  return set;
}
function glParseCustom(list) { return arr(list).map((x) => { const m = String(x).match(/^(F:)?(?:W([\d.]+):)?([\s\S]*)$/); const o = { d: m[3] }; if (m[1]) o.f = true; if (m[2]) o.w = Number(m[2]); return o; }); }
function glSign(set, key) {
  if (set.signs.has(key)) return set.signs.get(key);
  const g = set.g; const st = set.style; const cus = (g.custom || {})[key];
  let strokes;
  if (cus) strokes = glParseCustom(cus);
  else if (key.startsWith('m:')) strokes = glMarkFor(set, key);
  else if (key.startsWith('p:')) strokes = glPunct(set, key);
  else if (key.startsWith('C:') && key.includes('|')) { const [c, i] = key.slice(2).split('|'); const base = glSign(set, 'C:' + c); const n = +i; strokes = glMove(base, GL_TURNS[n % GL_TURNS.length]); if (n >= GL_TURNS.length) strokes = [...strokes, glDot(86, 86, 6)]; }
  else if (key.startsWith('W:')) strokes = glWord(set, key.slice(2));
  else {
    const lvl = g.level === 'simple' ? -1 : g.level === 'ornate' ? 1 : 0;
    const base = key.startsWith('V:') ? 1 : key.startsWith('R:') ? 1 : key.startsWith('Y:') ? 3 : 2; const c = Math.max(1, Math.min(3, base + lvl));
    for (let salt = 0; salt < 8; salt++) {
      const r = glRng(`${g.seed || 1}|${st.id}|${key}|${(g.rolls || {})[key] || 0}|${salt}`);
      strokes = GL_GEN[st.id](r, c, glElems(set)); const sig = strokes.map((x) => x.d).join('|');
      if (!set.seen.has(sig)) { set.seen.add(sig); break; }
    }
  }
  set.signs.set(key, strokes); return strokes;
}
function glMarkFor(set, key) {
  const k = key.slice(2);
  if (k === 'kill') return [{ d: glL(22, 22, 78, 78) }];
  if (k === 'stress') return [{ d: glL(36, 78, 64, 22) }];
  const { V } = glSounds(set.fm); const list = GL_MARK_SETS[set.style.straight ? 'straight' : 'round'];
  const order = [...list].sort((a, b) => glHash(`${set.g.seed}|${a}`) - glHash(`${set.g.seed}|${b}`));
  const i = Math.max(0, V.indexOf(k)) + ((set.g.rolls || {})[key] || 0);
  return GL_MARKS[order[i % order.length]]();
}
function glMarkPos(set, key) {
  const k = key.slice(2); if (k === 'kill') return 'kill'; if (k === 'stress') return 'stress';
  const { V } = glSounds(set.fm); return GL_MARK_POS[Math.max(0, V.indexOf(k)) % GL_MARK_POS.length];
}
function glPunct(set, key) {
  const k = key.slice(2); const id = set.style.id; const head = id === 'hanging';
  if (k === 'period') return head ? [{ d: glL(50, 20, 50, 84) }] : id === 'runic' || id === 'thorn' ? [glDot(50, 38, 6), glDot(50, 66, 6)] : id === 'geometric' ? [{ d: glPoly([[43, 64], [57, 64], [57, 78], [43, 78]], true), f: true }] : [glDot(50, 74, 7)];
  if (k === 'comma') return head ? [{ d: glL(50, 20, 50, 60) }] : [{ d: glL(54, 64, 44, 86) }];
  if (k === 'hyphen') return [{ d: glL(30, head ? 20 : 52, 70, head ? 20 : 52) }];
  if (k === 'apos') return [{ d: glL(54, 14, 46, 32) }];
  if (k === 'open') return [{ d: set.style.straight ? glPoly([[60, 10], [44, 10], [44, 90], [60, 90]]) : 'M62 10Q38 50 62 90' }];
  if (k === 'close') return [{ d: set.style.straight ? glPoly([[40, 10], [56, 10], [56, 90], [40, 90]]) : 'M38 10Q62 50 38 90' }];
  const r = glRng(`${set.g.seed}|${id}|${key}|${(set.g.rolls || {})[key] || 0}`);
  const body = GL_GEN[id](r, 1, glElems(set)).filter((x) => !(head && /^M0 20L100 20$/.test(x.d)));
  return glMove(body, glBox(0.6, 0.6, 20, 6)).concat(k === 'question' ? [glDot(50, 82, 5)] : [{ d: glL(42, 82, 58, 82) }]);
}
/** A word sign: two parts side by side, one over the other, or one inside a frame. Words with the same root share the first part. */
function glWord(set, word) {
  if (set.style.id === 'constellation') { const r = glRng(`${set.g.seed}|W|${word}|${(set.g.rolls || {})['W:' + word] || 0}`); return GL_GEN.constellation(r, 3, glElems(set), Math.max(3, Math.min(8, 2 + Math.ceil(String(word).length / 2)))); }
  const fm = set.fm; const e = arr(fm.lexicon).find((x) => String(x.word).toLowerCase() === word) || { word };
  const N = 28; const A = glHash(`${set.g.seed}|${String(e.root || wwSplit(e.meaning)[0] || word).toLowerCase()}`) % N; let B = glHash(`${set.g.seed}|${word}|${(set.g.rolls || {})['W:' + word] || 0}`) % N; if (B === A) B = (B + 1) % N;
  const ra = glSign(set, 'R:' + A), rb = glSign(set, 'R:' + B); const fam = String(e.root || wwSplit(e.meaning)[0] || word).toLowerCase(); const lay = glHash(`${set.g.seed}|${fam}|lay`) % 10;
  const head = set.style.id === 'hanging'; const strip = (l) => (head ? l.filter((x) => !/^M0 20L100 20$/.test(x.d)) : l); const hl = head ? [{ d: glL(0, 20, 100, 20) }] : [];
  if (lay < 5) return [...hl, ...glMove(strip(ra), glBox(0.5, 1, 3, 0)), ...glMove(strip(rb), glBox(0.5, 1, 47, 0))];
  if (lay < 8) return [...hl, ...glMove(strip(ra), glBox(1, 0.5, 0, head ? 16 : 6)), ...glMove(strip(rb), glBox(1, 0.5, 0, head ? 50 : 44))];
  const fk = A % 4; const top = head ? 26 : 16;
  const frame = set.style.straight ? [[[85, top], [15, top], [15, 84], [85, 84]], [[15, top], [85, top], [85, 84], [15, 84]], [[15, 84], [15, top], [85, top], [85, 84]], [[15, top], [15, 84], [85, 84], [85, top]]][fk].map((pts) => pts) : null;
  const fr = frame ? [{ d: glPoly(frame) }] : [{ d: glArc(50, 52, 34, [0.25, 1.25, 0.75, 1.75][fk] * Math.PI, Math.PI * 1.5) }];
  return [...hl, ...fr, ...glMove(strip(rb), glBox(0.56, 0.56, 22, head ? 30 : 24))];
}

/* ---------- spelling a line of text into signs ---------- */
/** One word → clusters [{base, marks: [{key, pos}], adv, frame?}] */
function glSpell(set, word) {
  const fm = set.fm; const t = glType(fm); const ph = fm.phonology || {}; const g = set.g; const { C, V } = glSounds(fm);
  const w = String(word).toLowerCase(); const out = [];
  if (t === 'Symbols') { const y = arr(fm.symbols).find((x) => x && String(x.name || '').toLowerCase() === w); return y ? [{ base: 'Y:' + y.id, marks: [] }] : []; }
  if (t === 'Logographic') {
    const hit = arr(fm.lexicon).find((e) => String(e.word).toLowerCase() === w) || arr(fm.lexicon).find((e) => { const a = arr(fm.affixes).find((x) => { const s2 = String(x.affix || '').replace(/-/g, ''); return s2 && w.endsWith(s2) && String(e.word).toLowerCase() === w.slice(0, -s2.length); }); return !!a; });
    if (hit && !/\s/.test(hit.word)) { out.push({ base: 'W:' + String(hit.word).toLowerCase(), marks: String(hit.word).toLowerCase() !== w ? [{ key: 'm:kill', pos: 'right' }] : [] }); return out; }
    if (set.g.anyWord && /^[\p{L}\p{M}'’-]+$/u.test(w)) return [{ base: 'W:' + w, marks: [] }];
    const sp = glSpellSounds(set, w, 'Alphabet', C, V, ph); sp.forEach((c) => (c.frame = true)); return sp;
  }
  return glSpellSounds(set, w, t, C, V, ph);
}
function glSpellSounds(set, w, t, C, V, ph) {
  const strip = (x) => x.normalize('NFD').replace(/\p{M}/gu, ''); const out = []; const g = set.g;
  const parts = w.split(/-+/);
  parts.forEach((part, pi) => {
    if (pi) out.push({ base: 'p:hyphen', marks: [] });
    const toks = sayTokens(ph, part).map((x) => { if (x.g) return x; let s2 = x.s; let stress = false; if (x.k === 'V' && !V.includes(s2) && /́/.test(s2.normalize('NFD'))) { s2 = strip(s2); stress = true; } return { s: s2, k: x.k, stress }; });
    for (let i = 0; i < toks.length; i++) {
      const x = toks[i]; const nx = toks[i + 1];
      if (x.g) { out.push({ base: 'p:apos', marks: [] }); continue; }
      const st2 = x.stress && t !== 'Abjad' ? [{ key: 'm:stress', pos: 'stress' }] : [];
      if (t === 'Alphabet' || !t) { out.push({ base: (x.k === 'V' ? 'V:' : 'C:') + x.s, marks: st2 }); continue; }
      if (t === 'Abjad') {
        if (x.k === 'C') { const c = { base: 'C:' + x.s, marks: [] }; if (nx && nx.k === 'V' && !nx.g && g.pointed) { c.marks.push({ key: 'm:' + nx.s, pos: glMarkPos(set, 'm:' + nx.s) }); i++; } else if (nx && nx.k === 'V' && !nx.g) i++; out.push(c); }
        else if (!out.length || i === 0) out.push({ base: 'V:seat', marks: g.pointed ? [{ key: 'm:' + x.s, pos: glMarkPos(set, 'm:' + x.s) }] : [] });
        continue;
      }
      if (t === 'Abugida') {
        if (x.k === 'C') {
          const c = { base: 'C:' + x.s, marks: [] };
          if (nx && nx.k === 'V' && !nx.g) { if (nx.s !== V[0]) c.marks.push({ key: 'm:' + nx.s, pos: glMarkPos(set, 'm:' + nx.s) }); if (nx.stress) c.marks.push({ key: 'm:stress', pos: 'stress' }); i++; } else c.marks.push({ key: 'm:kill', pos: 'kill' });
          out.push(c);
        } else out.push({ base: 'V:' + x.s, marks: st2 });
        continue;
      }
      if (t === 'Syllabary') {
        if (x.k === 'C') {
          if (nx && nx.k === 'V' && !nx.g) { const vi = Math.max(0, V.indexOf(nx.s)); out.push({ base: g.featural ? `C:${x.s}|${vi}` : `S:${x.s}${nx.s}`, marks: nx.stress ? [{ key: 'm:stress', pos: 'stress' }] : [] }); i++; }
          else out.push({ base: g.featural ? `C:${x.s}|0` : `S:${x.s}${V[0] || 'a'}`, marks: [{ key: 'm:kill', pos: 'kill' }] });
        } else out.push({ base: 'V:' + x.s, marks: st2 });
      }
    }
  });
  return out;
}
/** A finished cluster: its strokes in a 0–100 box (marks placed), and how far to move on. */
function glCluster(set, cl) {
  const base = glSign(set, cl.base); let strokes = [...base]; let adv = cl.base.startsWith('p:') ? 56 : 100; let right = 0;
  const head = set.style.id === 'hanging';
  if (cl.base.startsWith('p:') && !head) strokes = glMove(strokes, glBox(1, 1, -22, 0));
  for (const m of cl.marks || []) {
    const ms = glSign(set, m.key); const pos = m.pos;
    const box = pos === 'above' ? glBox(0.3, 0.3, 35, head ? -14 : -18) : pos === 'below' ? glBox(0.3, 0.3, 35, 88) : pos === 'right' ? glBox(0.3, 0.3, 92, 35) : pos === 'kill' ? glBox(0.26, 0.26, 70, 86) : glBox(0.26, 0.26, 64, head ? -16 : -20);
    strokes.push(...glMove(ms, box)); if (pos === 'right') right = 28;
  }
  if (!head && !cl.base.startsWith('p:')) { const [x0, x1] = glBounds(strokes); if (x1 > x0) { strokes = glMove(strokes, glBox(1, 1, 8 - x0, 0)); adv = Math.max(34, x1 - x0 + 16); right = 0; } }
  return { strokes, adv: adv + right, frame: cl.frame, base: cl.base };
}

/** left and right edges of the ink (end points only, which is near enough for spacing) */
function glBounds(strokes) {
  let a = Infinity, z = -Infinity;
  for (const x of strokes) for (const [, cmd, rest] of String(x.d).matchAll(/([MLCSQTAZ])([^MLCSQTAZ]*)/gi)) {
    const n = (rest.match(/-?\d*\.?\d+/g) || []).map(Number); const C = cmd.toUpperCase();
    if (C === 'A') { for (let i = 0; i + 7 <= n.length; i += 7) { a = Math.min(a, n[i + 5]); z = Math.max(z, n[i + 5]); } continue; }
    for (let i = 0; i + 1 < n.length; i += 2) { a = Math.min(a, n[i]); z = Math.max(z, n[i]); }
  }
  return [a, z];
}
/* ---------- drawing ---------- */
function glPaths(set, strokes, color = 'currentColor') {
  const st = set.style; const out = [];
  for (const x of strokes) {
    if (x.f) { out.push(s('path', { d: x.d, fill: color, stroke: 'none', 'fill-rule': 'evenodd' })); continue; }
    if (st.nib) { for (let k = -5; k <= 5; k++) out.push(s('path', { d: x.d, fill: 'none', stroke: color, 'stroke-width': st.w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', transform: `translate(${glN(k * 1.1)} ${glN(-k * 1.1)})` })); continue; }
    out.push(s('path', { d: x.d, fill: 'none', stroke: color, 'stroke-width': x.w || st.w, 'stroke-linecap': st.cap || 'round', 'stroke-linejoin': st.cap === 'square' ? 'miter' : 'round' }));
  }
  return out;
}
/** One sign on its own, for the chart (marks shown on a dotted circle). */
function glSignSvg(set, key, px = 48) {
  const isMark = key.startsWith('m:');
  let strokes = glSign(set, key);
  if (isMark) { const pos = glMarkPos(set, key); const box = pos === 'below' ? glBox(0.42, 0.42, 29, 66) : pos === 'right' ? glBox(0.42, 0.42, 66, 29) : pos === 'kill' ? glBox(0.36, 0.36, 62, 64) : glBox(0.42, 0.42, 29, -6); strokes = glMove(strokes, box); }
  const svg = s('svg', { viewBox: '-12 -22 124 136', width: px, height: px * 136 / 124, class: 'gl-svg' + (isMark ? ' is-mark' : '') });
  if (isMark) svg.append(s('circle', { cx: 50, cy: 50, r: 20, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.5, 'stroke-dasharray': '4 5', opacity: 0.45 }));
  ap(svg, glPaths(set, strokes)); return svg;
}
/** A text written in the script. Lines wrap at `cols` signs; direction follows the note. */
function glLayout(set, text, opts = {}) {
  const cols = opts.cols || 20; const dir = opts.direction || (set.fm.writing || {}).direction || 'Left to right';
  const gap = set.style.gap === 0 ? 0 : 4; const space = 48; const lines = [];
  for (const raw of String(text || '').split(/\n/)) {
    let line = []; let width = 0;
    const words = raw.match(/[\p{L}\p{M}'’ʼ-]+|[.,?!;:]/gu) || [];
    for (const wd of words) {
      const cls = GL_PUNCT[wd] ? [{ base: 'p:' + GL_PUNCT[wd], marks: [] }] : glSpell(set, wd);
      const built = cls.map((c) => glCluster(set, c)); const ww = built.reduce((a, b) => a + b.adv + gap, 0);
      if (line.length && width + ww > cols * 112 && !GL_PUNCT[wd]) { lines.push(line); line = []; width = 0; }
      line.push({ built, punct: !!GL_PUNCT[wd] }); width += ww + space;
    }
    lines.push(line);
  }
  const placed = []; const frames = [];
  const vertical = dir === 'Top to bottom';
  let maxW = 0, maxH = 0;
  lines.forEach((line, li) => {
    let pos = 0; const items = [];
    line.forEach((wd, wi) => {
      if (wi && !wd.punct) pos += space; const start = pos;
      wd.built.forEach((b) => { items.push({ b, at: pos }); pos += (vertical ? 120 : b.adv) + gap; });
      if (wd.built.some((b) => b.frame)) frames.push({ li, from: start, to: pos - gap });
    });
    const len = Math.max(0, pos - gap);
    const flip = dir === 'Right to left' || (dir === 'Alternating lines' && li % 2 === 1); const mirror = dir === 'Alternating lines' && li % 2 === 1;
    for (const it of items) placed.push({ li, at: flip ? len - it.at - (vertical ? 120 : it.b.adv) : it.at, b: it.b, mirror, len });
    for (const fr of frames.filter((x) => x.li === li && !x.done)) { if (flip) [fr.from, fr.to] = [len - fr.to, len - fr.from]; fr.done = true; }
    if (vertical) maxH = Math.max(maxH, len); else maxW = Math.max(maxW, len);
  });
  const LH = 150; const n = lines.length;
  const svg = s('svg', { class: 'gl-text', role: 'img', 'aria-label': text });
  const g = s('g', {}); svg.append(g);
  for (const p of placed) {
    let st2 = p.b.strokes; if (p.mirror) st2 = glMove(st2, [-1, 0, 0, 1, 100, 0]);
    const x = vertical ? (n - 1 - p.li) * 130 : p.at, y = vertical ? p.at : p.li * LH;
    g.append(ap(s('g', { transform: `translate(${x} ${y})` }), glPaths(set, st2, opts.color)));
  }
  for (const fr of frames) {
    const x0 = vertical ? (n - 1 - fr.li) * 130 - 6 : fr.from - 8, x1 = vertical ? (n - 1 - fr.li) * 130 + 106 : fr.to + 8; const y0 = vertical ? fr.from - 8 : fr.li * LH + 2, y1 = vertical ? fr.to + 8 : fr.li * LH + 98;
    g.append(s('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 16, fill: 'none', stroke: opts.color || 'currentColor', 'stroke-width': 3, opacity: 0.8 }));
  }
  const W2 = vertical ? n * 130 : Math.max(100, maxW), H2 = vertical ? Math.max(100, maxH) : n * LH - 10;
  svg.setAttribute('viewBox', `-20 -34 ${W2 + 40} ${H2 + 60}`);
  const k = (opts.size || 40) / 100; svg.setAttribute('width', String(Math.round((W2 + 40) * k))); svg.setAttribute('height', String(Math.round((H2 + 60) * k)));
  return svg;
}
/* ---------- pictures for export ---------- */
async function glRaster(svg, opts = {}) {
  const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number); const scale = opts.scale || 2;
  const w = Math.round(vb[2] * scale * (opts.unit || 0.5)), hgt = Math.round(vb[3] * scale * (opts.unit || 0.5));
  const c2 = svg.cloneNode(true); c2.setAttribute('width', String(w)); c2.setAttribute('height', String(hgt)); c2.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  c2.querySelectorAll('[stroke="currentColor"]').forEach((e) => e.setAttribute('stroke', opts.ink || '#1d1d1f'));
  c2.querySelectorAll('[fill="currentColor"]').forEach((e) => e.setAttribute('fill', opts.ink || '#1d1d1f'));
  const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c2));
  const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
  const cv = document.createElement('canvas'); cv.width = w; cv.height = hgt; const cx = cv.getContext('2d');
  if (opts.bg !== false) { cx.fillStyle = opts.bg || '#ffffff'; cx.fillRect(0, 0, w, hgt); }
  cx.drawImage(img, 0, 0, w, hgt);
  const type = opts.type || 'image/png';
  const blob = await new Promise((res) => cv.toBlob(res, type, 0.92));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), w, h: hgt };
}
/** The whole sign chart as one picture: sign over its sound, in rows. */
function glChartSvg(fm, opts = {}) {
  const set = glSet(fm); const cols = opts.cols || 8; const cw = 130, ch = 190; const rows = [];
  for (const grp of set.inv) {
    if (grp.title.endsWith('(hidden)')) continue;
    const signs = grp.words ? grp.signs.slice(0, opts.maxWords || 64) : grp.signs; if (!signs.length) continue;
    rows.push({ title: grp.title }); for (let i = 0; i < signs.length; i += cols) rows.push({ signs: signs.slice(i, i + cols) });
  }
  const svg = s('svg', { xmlns: 'http://www.w3.org/2000/svg' }); let y = 0;
  for (const r of rows) {
    if (r.title) { svg.append(s('text', { x: 0, y: y + 40, 'font-family': 'Georgia, serif', 'font-size': 30, 'font-weight': 'bold', fill: 'currentColor' }, r.title)); y += 60; continue; }
    r.signs.forEach((sg, i) => {
      const x = i * cw; const isMark = sg.key.startsWith('m:'); let st2 = glSign(set, sg.key);
      if (isMark) { const pos = glMarkPos(set, sg.key); st2 = glMove(st2, pos === 'below' ? glBox(0.42, 0.42, 29, 66) : pos === 'right' ? glBox(0.42, 0.42, 66, 29) : pos === 'kill' ? glBox(0.36, 0.36, 62, 64) : glBox(0.42, 0.42, 29, -6)); }
      const gg = s('g', { transform: `translate(${x + 15} ${y + 22})` }); ap(gg, glPaths(set, st2)); svg.append(gg);
      if (isMark) svg.append(s('circle', { cx: x + 65, cy: y + 72, r: 20, fill: 'none', stroke: '#999', 'stroke-width': 2.5, 'stroke-dasharray': '4 5' }));
      svg.append(s('text', { x: x + 65, y: y + 168, 'text-anchor': 'middle', 'font-family': 'Georgia, serif', 'font-size': sg.meaning ? 22 : 26, fill: 'currentColor' }, sg.meaning ? `${sg.label} · ${sg.meaning}` .slice(0, 16) : sg.label.split('  ')[0]));
    });
    y += ch;
  }
  svg.setAttribute('viewBox', `-10 -10 ${cols * cw + 20} ${y + 20}`);
  return svg;
}
/* ---------- editing one sign ---------- */
function glEditor(f, fm, set, st, rerender, G, sg) {
  const key = sg.key; const g = fm.glyphs || {}; const drawn = !!(g.custom || {})[key];
  if (st.glDraw && st.glDraw.key === key) return glDrawPad(f, set, st, rerender, G, sg);
  const big = glSignSvg(set, key, 120);
  return h('div', { class: 'gl-editor' }, big, h('div', { class: 'gl-ed-side' }, h('b', {}, `${sg.label.split('  ')[0]}`), sg.meaning ? h('div', { class: 'cs-hint' }, sg.meaning) : null,
    h('div', { class: 'gl-ed-actions' },
      !drawn ? h('button', { onclick: () => G((y) => { y.rolls = Object.assign({}, y.rolls || {}); y.rolls[key] = (y.rolls[key] || 0) + 1; }) }, '🎲 New shape') : null,
      h('button', { onclick: () => { st.glDraw = { key, strokes: glSign(set, key).map(glStrokeStr), mode: 'free', pend: [] }; rerender(); } }, '✏️ Draw it yourself'),
      h('button', { title: 'Start from an empty pad', onclick: () => { st.glDraw = { key, strokes: [], mode: 'free', pend: [] }; rerender(); } }, '✍ Draw from scratch'),
      h('button', { title: 'A PNG, JPG, WebP or SVG of your own glyph: dark marks on a light or clear background', onclick: () => glUploadOne(f, key) }, '⇪ Upload image'),
      drawn || (g.rolls || {})[key] ? h('button', { onclick: () => G((y) => { if (y.custom) delete y.custom[key]; if (y.rolls) delete y.rolls[key]; }) }, '↺ Back to the first shape') : null),
    key.startsWith('Y:') ? glSymbolFields(G, key) : null,
    h('div', { class: 'cs-hint' }, drawn ? 'Your own sign (drawn or uploaded). New sets and new looks keep it.' : key.startsWith('Y:') ? 'New shape tries another symbol for this name only.' : 'New shape tries another sign for this sound only.')));
}
function glSymbolFields(G, key) {
  const id = key.slice(2); const cur = (G.spec || {}).symbols || [];
  const y = cur.find((x) => x.id === id) || {};
  const nm = h('input', { type: 'text', value: y.name || '', placeholder: 'Name' }); const mn = h('input', { type: 'text', value: y.meaning || '', placeholder: 'Meaning (optional)' });
  const save = () => G((x) => { const it = arr(x.symbols).find((z) => z.id === id); if (it) { it.name = nm.value.trim() || it.name; it.meaning = mn.value.trim(); } });
  nm.addEventListener('change', save); mn.addEventListener('change', save);
  return h('div', { class: 'gl-symfields' }, nm, mn, h('button', { class: 'mod-warning', onclick: () => G((x) => { x.symbols = arr(x.symbols).filter((z) => z.id !== id); if (x.custom) delete x.custom[key]; if (x.rolls) delete x.rolls[key]; }) }, 'Delete symbol'));
}
const GL_STAMPS = [['dot', '● Dot'], ['ring', '○ Open dot'], ['bullseye', '◉ Dot in a circle'], ['star', '★ Star'], ['openstar', '☆ Open star'], ['tri', '▲ Triangle'], ['opentri', '△ Open triangle'], ['box', '■ Square'], ['openbox', '□ Open square']];
function glStamp(t, x, y, r = 6) {
  if (t === 'tri' || t === 'opentri') { const p = [[x, y - r * 1.3], [x + r * 1.2, y + r * 0.8], [x - r * 1.2, y + r * 0.8]]; return t === 'tri' ? [{ d: glPoly(p, true), f: true }] : [{ d: glPoly(p, true), w: 2.4 }]; }
  if (t === 'box' || t === 'openbox') { const p = [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]]; return t === 'box' ? [{ d: glPoly(p, true), f: true }] : [{ d: glPoly(p, true), w: 2.4 }]; }
  return glNode(t, x, y, r).map((q) => { const o = Object.assign({}, q); delete o.n; return o; });
}
const glStrokeStr = (x) => (x.f ? 'F:' : '') + (x.w ? `W${x.w}:` : '') + x.d;
/** the drawing pad: freehand with a pen, mouse or finger, or lines, curves and shapes on a grid */
function glDrawPad(f, set, st, rerender, G, sg) {
  const D = st.glDraw; const P = [15, 32.5, 50, 67.5, 85]; D.mode = D.mode || 'free'; if (D.snap == null) D.snap = true; D.stamp = D.stamp || 'dot';
  const svg = s('svg', { viewBox: '0 0 100 100', class: 'gl-pad' + (D.mode === 'free' ? ' is-free' : ''), width: 260, height: 260 });
  let live = null; // the freehand stroke being drawn
  const redraw = () => {
    svg.replaceChildren(s('rect', { x: 0, y: 0, width: 100, height: 100, class: 'gl-pad-bg' }), s('rect', { x: 15, y: 15, width: 70, height: 70, class: 'gl-pad-box' }));
    for (const y of P) for (const x of P) svg.append(s('circle', { cx: x, cy: y, r: 1.4, class: 'gl-dot-guide' }));
    const strokes = glParseCustom(D.strokes); strokes.forEach((x, i) => { const g = s('g', { class: 'gl-pad-stroke', 'data-i': i }); ap(g, glPaths(set, [x])); if (D.mode === 'erase') g.append(s('path', { d: x.d, fill: x.f ? 'transparent' : 'none', stroke: 'transparent', 'stroke-width': 10 })); svg.append(g); });
    if (live && live.length > 1) svg.append(s('polyline', { points: live.map((p) => p.join(',')).join(' '), fill: 'none', stroke: 'currentColor', 'stroke-width': set.style.w || 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.8 }));
    for (const [x, y] of D.pend) svg.append(s('circle', { cx: x, cy: y, r: 3.2, class: 'gl-pend' }));
  };
  const at = (e) => { const m = svg.getScreenCTM(); if (!m) return [50, 50]; const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(m.inverse()); return [Math.max(0, Math.min(100, q.x)), Math.max(0, Math.min(100, q.y))]; };
  const snapTo = ([x, y]) => (D.snap ? [P.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a)), P.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a))] : [glN(x), glN(y)]);
  const smooth = (pts) => { // simplify, then a smooth curve through the points
    const rdp = (q) => { if (q.length < 3) return q; const [ax, ay] = q[0], [bx, by] = q[q.length - 1]; const L = Math.hypot(bx - ax, by - ay) || 1; let idx = 0, md = 0; for (let i = 1; i < q.length - 1; i++) { const dd = Math.abs((bx - ax) * (ay - q[i][1]) - (ax - q[i][0]) * (by - ay)) / L; if (dd > md) { md = dd; idx = i; } } return md > 1.1 ? [...rdp(q.slice(0, idx + 1)).slice(0, -1), ...rdp(q.slice(idx))] : [q[0], q[q.length - 1]]; };
    const q = rdp(pts); if (q.length === 1 || (q.length === 2 && Math.hypot(q[0][0] - q[1][0], q[0][1] - q[1][1]) < 1.5)) return 'F:' + glCirc(q[0][0], q[0][1], Math.max(2.5, (set.style.w || 5) / 2));
    if (q.length === 2) return glL(q[0][0], q[0][1], q[1][0], q[1][1]);
    let d = `M${glN(q[0][0])} ${glN(q[0][1])}`; for (let i = 1; i < q.length - 1; i++) { const mx = (q[i][0] + q[i + 1][0]) / 2, my = (q[i][1] + q[i + 1][1]) / 2; d += `Q${glN(q[i][0])} ${glN(q[i][1])} ${glN(mx)} ${glN(my)}`; }
    const e = q[q.length - 1]; return d + `L${glN(e[0])} ${glN(e[1])}`;
  };
  svg.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (D.mode === 'erase') { const g = e.target.closest('.gl-pad-stroke'); if (g) { D.strokes.splice(+g.dataset.i, 1); redraw(); } return; }
    if (D.mode === 'free') { live = [at(e)]; try { svg.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } redraw(); return; }
    const p = snapTo(at(e));
    if (D.mode === 'dot') { D.strokes.push('F:' + glCirc(p[0], p[1], 5)); redraw(); return; }
    if (D.mode === 'stamp') { D.strokes.push(...glStamp(D.stamp, p[0], p[1]).map(glStrokeStr)); redraw(); return; }
    D.pend.push(p);
    if (D.mode === 'line' && D.pend.length === 2) { const [a, b] = D.pend; if (a[0] !== b[0] || a[1] !== b[1]) D.strokes.push(glL(a[0], a[1], b[0], b[1])); D.pend = []; }
    else if (D.mode === 'curve' && D.pend.length === 3) { const [a, b, c] = D.pend; D.strokes.push(`M${a[0]} ${a[1]}Q${b[0]} ${b[1]} ${c[0]} ${c[1]}`); D.pend = []; }
    else if (D.mode === 'ring' && D.pend.length === 2) { const [a, b] = D.pend; const r = Math.hypot(a[0] - b[0], a[1] - b[1]); if (r) D.strokes.push(glCirc(a[0], a[1], glN(r))); D.pend = []; }
    redraw();
  });
  svg.addEventListener('pointermove', (e) => { if (!live) return; const p = at(e); const l = live[live.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 0.6) { live.push(p); redraw(); } });
  const finish = () => { if (!live) return; const pts = live; live = null; D.strokes.push(smooth(pts)); redraw(); };
  svg.addEventListener('pointerup', finish); svg.addEventListener('pointercancel', finish);
  redraw();
  const modes = h('div', { class: 'cs-seg gl-pad-modes' }, ...[['free', '✍ Freehand'], ['line', 'Line'], ['curve', 'Curve'], ['ring', 'Circle'], ['dot', 'Dot'], ['stamp', 'Shape'], ['erase', 'Erase']].map(([k, l]) => h('button', { class: D.mode === k ? 'is-on' : '', onclick: () => { D.mode = k; D.pend = []; rerender(); } }, l)));
  const snap = h('input', { type: 'checkbox', checked: D.snap }); snap.addEventListener('change', () => { D.snap = snap.checked; });
  const stamp = h('select', { class: 'dropdown' }, ...GL_STAMPS.map(([k, l]) => h('option', { value: k, selected: D.stamp === k }, l))); stamp.addEventListener('change', () => { D.stamp = stamp.value; });
  const help = { free: 'Draw with a pen, mouse or finger. Each stroke is smoothed; a tap makes a dot.', line: 'Tap two points.', curve: 'Tap the start, a point to bend toward, then the end.', ring: 'Tap the centre, then a point on the edge.', dot: 'Tap where the dot goes.', stamp: 'Pick a shape, then tap where it goes.', erase: 'Tap a stroke to remove it.' }[D.mode];
  return h('div', { class: 'gl-editor gl-drawing' }, svg, h('div', { class: 'gl-ed-side' }, h('b', {}, `Drawing ${sg.label.split('  ')[0]}`), modes,
    D.mode === 'stamp' ? stamp : null, ['line', 'curve', 'ring', 'dot', 'stamp'].includes(D.mode) ? h('label', { class: 'lh-check' }, snap, 'Snap to the grid') : null, h('div', { class: 'cs-hint' }, help),
    h('div', { class: 'gl-ed-actions' },
      h('button', { onclick: () => { D.strokes.pop(); D.pend = []; redraw(); } }, '↶ Undo'), h('button', { onclick: () => { D.strokes = []; D.pend = []; redraw(); } }, 'Clear'),
      h('button', { class: 'mod-cta', onclick: async () => { const k = D.key; const list = [...D.strokes]; st.glDraw = null; await G((y) => { y.custom = Object.assign({}, y.custom || {}); if (list.length) y.custom[k] = list; else delete y.custom[k]; }); } }, 'Save sign'),
      h('button', { onclick: () => { st.glDraw = null; rerender(); } }, 'Cancel')),
    h('div', { class: 'cs-hint' }, 'The square marks where a sign normally sits; anything outside it still shows.')));
}
async function glSaveImage(f, svg, what, opts) {
  try {
    const img = await glRaster(svg, opts); const folder = normalizePath(`${GLS.folder()}/Exports`);
    await S.ensureFolder(folder);
    const path = await mFreePath(folder, `${f.basename.replace(/\s*\((conlang|glyphs)\)$/i, '')} - ${what}`, 'png');
    await app().vault.createBinary(path, img.bytes); new Notice(`Saved ${path}`, 6000); return path;
  } catch (e) { console.error(e); toast('Could not save the picture.'); return null; }
}
