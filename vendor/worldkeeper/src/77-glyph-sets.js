/* =====================================================================
   Glyph sets: scripts and symbols as notes of their own (Wordwright)
   ---------------------------------------------------------------------
   A glyph set note (type: glyphs) is either
     • a script: signs for the sounds of a conlang (conlang: "[[X (conlang)]]"),
       or for plain English letters when no conlang is linked; or
     • a symbol set: named runes, sigils, wards… for magic or anything else.
   Any note can use a set (glyphs: "[[Y (glyphs)]]"); a Language uses its
   conlang's script. Each set gets a font of its own, built here, so its
   signs copy and paste as ordinary text (private-use characters) into
   Draftsmith and every other note.
   ===================================================================== */
const GL_NOTE = 'glyphs';
const GL_SUFFIX = /\s*\(glyphs\)$/i;
const GL_PLANE = 0xf0000; // Supplementary Private Use Area-A: 0x400 characters per set
const GL_ENGLISH = { consonants: 'b c d f g h j k l m n p q r s t v w x y z', vowels: 'a e i o u', patterns: 'CV CVC' };
const GL_TAB_TYPES = ['language', 'culture', 'magic', 'organization', 'pantheon', 'species', 'demon', 'item'];
const GL_STARTER = [['fire', 'Fire'], ['water', 'Water'], ['earth', 'Earth'], ['air', 'Air'], ['light', 'Light'], ['shadow', 'Shadow'], ['life', 'Life'], ['death', 'Death'], ['ward', 'Ward', 'protection'], ['bind', 'Bind', 'to hold fast'], ['open', 'Open', 'to unlock, to reveal'], ['seal', 'Seal', 'to close, to end']];
const isGlyphs = (f) => !!f && f.extension === 'md' && String(arr(S.fm(f).type)[0] ?? '').toLowerCase() === GL_NOTE;
const glName = (f) => (f ? f.basename.replace(GL_SUFFIX, '') : '');

const GLS = {
  all() { return S.files().filter(isGlyphs).sort(byName); },
  folder() { return normalizePath(String(ST().glyphFolder || '{root}/Glyphs').replace('{root}', ST().root)); },
  conlangOf(g) { return g ? S.linkFiles(g, 'conlang').find(isConlang) || null : null; },
  /** the sets a note uses: its own links, else (Language) its conlang's, else (conlang) the scripts made for it */
  setsFor(note) {
    if (!note) return [];
    if (isGlyphs(note)) return [note];
    const own = S.linkFiles(note, 'glyphs').filter(isGlyphs); if (own.length) return own;
    if (isLanguage(note)) { const c = WW.conlangOf(note); return c ? GLS.setsFor(c) : []; }
    if (isConlang(note)) return GLS.all().filter((g) => { const c = GLS.conlangOf(g); return c && c.path === note.path; });
    return [];
  },
  usedBy(g) { const out = S.files().filter((x) => x.path !== g.path && S.linkFiles(x, 'glyphs').some((y) => y.path === g.path)); const c = GLS.conlangOf(g); if (c && !out.some((x) => x.path === c.path)) out.unshift(c); return out; },
  freeSlot() { const used = new Set(GLS.all().map((g) => S.fm(g).slot).filter((x) => x != null).map(Number)); let i = 0; while (used.has(i)) i++; return i; },
  async create(name, { kind = 'script', conlang = null, link = null, open = true, script = null } = {}) {
    let nm = safeName(String(name || '').trim().replace(GL_SUFFIX, '')); if (!nm) return null; nm += ' (glyphs)';
    const folder = GLS.folder(); await S.ensureFolder(folder);
    const path = normalizePath(`${folder}/${nm}.md`); let f = app().vault.getAbstractFileByPath(path);
    if (!(f instanceof TFile)) f = await app().vault.create(path, '```wordwright\n```\n');
    const cf = conlang ? S.fm(conlang) : {};
    const style = glDefaultStyle(cf); const slot = GLS.freeSlot();
    await S.write(f, (x) => {
      x.type = GL_NOTE; x.kind = kind; x.style = style; x.seed = 1 + Math.floor(Math.random() * 99999); x.slot = slot;
      if (kind === 'script') { x.script = script || (GL_TYPES.some(([k]) => k === cf.script) ? cf.script : 'Alphabet'); if (conlang) x.conlang = S.link(conlang, f.path); }
      else x.symbols = GL_STARTER.map(([id, n, m]) => ({ id, name: n, meaning: m || '' }));
    });
    if (conlang && kind === 'script') await S.write(conlang, (x) => { x.script = S.fm(f).script || x.script; });
    if (link) await GLS.link(link, f);
    if (open) await app().workspace.getLeaf(false).openFile(f);
    return f;
  },
  async link(note, g) { await S.write(note, (x) => { const cur = arr(x.glyphs).filter(Boolean); const l = S.link(g, note.path); if (!cur.some((v) => linkName(v) === linkName(l))) cur.push(l); x.glyphs = cur.length === 1 ? cur[0] : cur; }); },
  async unlink(note, g) { await S.write(note, (x) => { const cur = arr(x.glyphs).filter((v) => { const t = app().metadataCache.getFirstLinkpathDest(linkName(v), note.path); return !t || t.path !== g.path; }); if (cur.length) x.glyphs = cur.length === 1 ? cur[0] : cur; else delete x.glyphs; }); },
};

/** everything the drawing code needs, from the set's note and its conlang */
function glSpec(gf) {
  const g = S.fm(gf); const c = GLS.conlangOf(gf); const cf = c ? S.fm(c) : null;
  const sym = g.kind === 'symbols';
  return {
    _file: gf, _conlang: c, kind: sym ? 'symbols' : 'script',
    phonology: sym ? {} : cf ? Object.assign({}, WW_PH, cf.phonology || {}) : Object.assign({}, GL_ENGLISH, g.phonology || {}),
    lexicon: cf ? arr(cf.lexicon) : [], affixes: cf ? arr(cf.affixes) : [], phrases: cf ? arr(cf.phrases) : [],
    script: sym ? 'Symbols' : g.script || 'Alphabet', symbols: arr(g.symbols),
    writing: { direction: g.direction || (cf && (cf.writing || {}).direction) || null },
    glyphs: { style: g.style, seed: g.seed, level: g.level, featural: g.featural, pointed: g.pointed, rolls: g.rolls || {}, custom: g.custom || {}, anyWord: g.anyWord != null ? !!g.anyWord : !c, join: !!g.join },
    pictures: arr(g.pictures),
    slot: g.slot, codes: g.codes || {},
  };
}
const glSetOf = (gf) => glSet(glSpec(gf));

/* ---------- characters: every sign or sign-with-marks gets a code in the set's range ---------- */
const glCKey = (cl) => cl.base + (cl.marks || []).map((m) => '+' + m.key).join('');
/** every cluster the script can write, so the font covers them all */
function glAllClusters(set) {
  const fm = set.fm; const t = glType(fm); const { C, V } = glSounds(fm); const g = set.g; const out = [];
  const add = (base, marks = []) => out.push({ base, marks: marks.map((k) => ({ key: k, pos: glMarkPos(set, k) })) });
  for (const grp of set.inv) for (const sg of grp.signs) if (!sg.key.startsWith('m:')) add(sg.key);
  if (t === 'Alphabet') V.forEach((v) => add('V:' + v, ['m:stress']));
  if (t === 'Abjad') { if (g.pointed) { C.forEach((c) => V.forEach((v) => add('C:' + c, ['m:' + v]))); V.forEach((v) => add('V:seat', ['m:' + v])); } }
  if (t === 'Abugida') C.forEach((c) => { add('C:' + c, ['m:kill']); add('C:' + c, ['m:stress']); V.slice(1).forEach((v) => { add('C:' + c, ['m:' + v]); add('C:' + c, ['m:' + v, 'm:stress']); }); });
  if (t === 'Abugida' || t === 'Syllabary') V.forEach((v) => add('V:' + v, ['m:stress']));
  if (t === 'Syllabary') C.forEach((c) => { add(g.featural ? `C:${c}|0` : `S:${c}${V[0] || 'a'}`, ['m:kill']); V.forEach((v, i) => add(g.featural ? `C:${c}|${i}` : `S:${c}${v}`, ['m:stress'])); });
  if (t === 'Logographic') for (const grp of set.inv) if (grp.words) grp.signs.forEach((sg) => add(sg.key, ['m:kill']));
  const seen = new Set(); return out.filter((cl) => { const k = glCKey(cl); if (seen.has(k)) return false; seen.add(k); return true; });
}
/** give new clusters a code (never reusing an old one) and the set a slot; writes only when something is new */
async function glEnsureCodes(gf, text = '') {
  const fm = S.fm(gf); const set = glSetOf(gf); const codes = Object.assign({}, fm.codes || {}); let next = Math.max(0, ...Object.values(codes).map(Number)) + 1; let changed = false;
  const extra = []; for (const tok of String(text).match(/[\p{L}\p{M}'’ʼ-]+/gu) || []) extra.push(...glSpell(set, tok));
  for (const cl of [...glAllClusters(set), ...extra]) { const k = glCKey(cl); if (codes[k] == null && next < 0x3ff) { codes[k] = next++; changed = true; } }
  const slot = fm.slot != null ? fm.slot : GLS.freeSlot(); if (fm.slot == null) changed = true;
  if (changed) await S.write(gf, (x) => { x.codes = codes; x.slot = slot; });
  return changed;
}
const glCp = (spec, key) => { const n = (spec.codes || {})[key]; return n == null || spec.slot == null ? null : GL_PLANE + Number(spec.slot) * 0x400 + Number(n); };
/** text in the set's characters, ready to paste anywhere */
function glEncode(set, text) {
  const spec = set.fm; const dir = (spec.writing || {}).direction; const out = [];
  for (const raw of String(text || '').split(/\n/)) {
    const parts = [];
    for (const tok of raw.match(/[\p{L}\p{M}'’ʼ-]+|[.,?!;:]|\s+|./gu) || []) {
      if (/^\s+$/.test(tok)) { parts.push([' ']); continue; }
      const cls = GL_PUNCT[tok] ? [{ base: 'p:' + GL_PUNCT[tok], marks: [] }] : glSpell(set, tok);
      if (!cls.length) { parts.push([tok]); continue; }
      const frame = cls.some((c) => c.frame); const chars = [];
      if (frame && glCp(spec, 'p:open')) chars.push(String.fromCodePoint(glCp(spec, 'p:open')));
      for (const c of cls) { const cp = glCp(spec, glCKey(c)) || glCp(spec, c.base); chars.push(cp ? String.fromCodePoint(cp) : ''); }
      if (frame && glCp(spec, 'p:close')) chars.push(String.fromCodePoint(glCp(spec, 'p:close')));
      parts.push(chars);
    }
    const flat = parts.flat(); out.push((dir === 'Right to left' ? flat.reverse() : flat).join(''));
  }
  return out.join('\n');
}

/* ---------- the font: strokes become filled outlines, written as a TrueType file ---------- */
const GL_K = 10; // font units per box unit; ink 15–85 sits from the baseline up to 700 (about a capital's height)
function glFlatten(d) {
  const polys = []; let cur = null; let x = 0, y = 0, sx = 0, sy = 0, lc = null, lq = null;
  const push = (px, py) => { cur.pts.push([px, py]); x = px; y = py; };
  for (const [, cmd, rest] of String(d).matchAll(/([MLCSQTAZ])([^MLCSQTAZ]*)/gi)) {
    const n = (rest.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number); const C = cmd.toUpperCase();
    if (C === 'M') { cur = { pts: [], closed: false }; polys.push(cur); push(n[0], n[1]); sx = x; sy = y; for (let i = 2; i + 1 < n.length; i += 2) push(n[i], n[i + 1]); lc = lq = null; }
    else if (C === 'L') { for (let i = 0; i + 1 < n.length; i += 2) push(n[i], n[i + 1]); lc = lq = null; }
    else if (C === 'Z') { if (cur) cur.closed = true; x = sx; y = sy; lc = lq = null; }
    else if (C === 'C' || C === 'S') {
      const step = C === 'C' ? 6 : 4;
      for (let i = 0; i + step - 1 < n.length; i += step) {
        const [c1x, c1y] = C === 'C' ? [n[i], n[i + 1]] : lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y]; const o = C === 'C' ? 2 : 0;
        const c2x = n[i + o], c2y = n[i + o + 1], ex = n[i + o + 2], ey = n[i + o + 3]; const x0 = x, y0 = y;
        for (let k = 1; k <= 12; k++) { const t = k / 12, u = 1 - t; push(u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex, u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey); }
        lc = [c2x, c2y]; lq = null;
      }
    } else if (C === 'Q' || C === 'T') {
      const step = C === 'Q' ? 4 : 2;
      for (let i = 0; i + step - 1 < n.length; i += step) {
        const [qx, qy] = C === 'Q' ? [n[i], n[i + 1]] : lq ? [2 * x - lq[0], 2 * y - lq[1]] : [x, y]; const ex = n[i + step - 2], ey = n[i + step - 1]; const x0 = x, y0 = y;
        for (let k = 1; k <= 10; k++) { const t = k / 10, u = 1 - t; push(u * u * x0 + 2 * u * t * qx + t * t * ex, u * u * y0 + 2 * u * t * qy + t * t * ey); }
        lq = [qx, qy]; lc = null;
      }
    } else if (C === 'A') {
      for (let i = 0; i + 6 < n.length; i += 7) {
        let [rx, ry] = [Math.abs(n[i]), Math.abs(n[i + 1])]; const fa = n[i + 3], fs = n[i + 4], ex = n[i + 5], ey = n[i + 6]; const x0 = x, y0 = y;
        if (!rx || !ry) { push(ex, ey); continue; }
        const dx = (x0 - ex) / 2, dy = (y0 - ey) / 2; let lam = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry); if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
        const sgn = fa === fs ? -1 : 1; const num = rx * rx * ry * ry - rx * rx * dy * dy - ry * ry * dx * dx; const co = sgn * Math.sqrt(Math.max(0, num / (rx * rx * dy * dy + ry * ry * dx * dx)));
        const cxp = (co * rx * dy) / ry, cyp = (-co * ry * dx) / rx; const cx = cxp + (x0 + ex) / 2, cy = cyp + (y0 + ey) / 2;
        const ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
        const t1 = ang(1, 0, (dx - cxp) / rx, (dy - cyp) / ry); let dt = ang((dx - cxp) / rx, (dy - cyp) / ry, (-dx - cxp) / rx, (-dy - cyp) / ry);
        if (!fs && dt > 0) dt -= 2 * Math.PI; if (fs && dt < 0) dt += 2 * Math.PI;
        const steps = Math.max(6, Math.ceil(Math.abs(dt) / (Math.PI / 12)));
        for (let k = 1; k <= steps; k++) { const a = t1 + (dt * k) / steps; push(cx + rx * Math.cos(a), cy + ry * Math.sin(a)); }
        lc = lq = null;
      }
    }
  }
  return polys;
}
const glArea = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
function glHull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up = []; for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
/** filled polygons (box units) for one glyph's strokes */
function glOutline(set, strokes) {
  const st = set.style; const out = [];
  const disc = (cx, cy, r) => { const p = []; for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; };
  for (const s2 of strokes) {
    for (const poly of glFlatten(s2.d)) {
      const pts = poly.pts.filter((q, i, a) => !i || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 0.01);
      if (s2.f) { if (pts.length >= 3) { pts.fill = s2; out.push(pts); } continue; }
      const seq = poly.closed && pts.length > 2 ? [...pts, pts[0]] : pts;
      if (seq.length === 1) { out.push(disc(seq[0][0], seq[0][1], (s2.w || st.w) / 2)); continue; }
      const hw = (s2.w || st.w) / 2; const square = st.cap === 'square';
      for (let i = 0; i + 1 < seq.length; i++) {
        let [ax, ay] = seq[i], [bx, by] = seq[i + 1]; const len = Math.hypot(bx - ax, by - ay); if (!len) continue; const ux = (bx - ax) / len, uy = (by - ay) / len;
        if (st.nib) { const v = [5.5, -5.5]; out.push(glHull([[ax + v[0], ay + v[1]], [ax - v[0], ay - v[1]], [bx + v[0], by + v[1]], [bx - v[0], by - v[1]], [ax + hw, ay], [bx + hw, by], [ax - hw, ay], [bx - hw, by]])); continue; }
        if (square) { ax -= ux * hw; ay -= uy * hw; bx += ux * hw; by += uy * hw; }
        const nx = -uy * hw, ny = ux * hw; out.push([[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]]);
        if (!square) {
          const pv = seq[i - 1]; let bend = true; if (pv) { const l0 = Math.hypot(seq[i][0] - pv[0], seq[i][1] - pv[1]) || 1; bend = ((seq[i][0] - pv[0]) * ux + (seq[i][1] - pv[1]) * uy) / l0 < 0.97; }
          if (i === 0 || bend) out.push(disc(seq[i][0], seq[i][1], hw)); if (i + 2 === seq.length) out.push(disc(seq[i + 1][0], seq[i + 1][1], hw));
        }
      }
    }
  }
  // shapes with holes (uploaded glyphs): a ring inside another ring of the same shape is a hole
  for (const p of out) if (p.fill) { const inside = out.filter((q) => q !== p && q.fill === p.fill && glInPoly(p[0], q)).length; p.hole = inside % 2 === 1; }
  return out;
}
function glInPoly([x, y], poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }
function glFontBytes(set, family) {
  const spec = set.fm; const glyphs = [{ adv: 500, polys: [] }, { adv: 320, polys: [], cp: 0x20 }];
  const clOf = (k) => { const [base, ...ms] = k.split('+'); return { base, marks: ms.map((m) => ({ key: m, pos: glMarkPos(set, m) })) }; };
  for (const k of Object.keys(spec.codes || {})) {
    const cl = clOf(k); const cp = glCp(spec, k); if (!cp) continue;
    const c = glCluster(set, cl); const head = set.style.id === 'hanging';
    const polys = glOutline(set, c.strokes).map((p) => { const q = p.map(([x, y]) => [Math.round(x * GL_K), Math.round((85 - y) * GL_K)]); q.hole = p.hole; return q; });
    glyphs.push({ cp, adv: Math.round((c.adv + (head ? 0 : 6)) * GL_K), polys });
  }
  // --- glyf / loca / hmtx ---
  const B = (n) => new DataView(new ArrayBuffer(n));
  const glyf = []; const loca = [0]; let off = 0; let maxPts = 0, maxCont = 0; const bb = [Infinity, Infinity, -Infinity, -Infinity]; const hm = [];
  for (const g of glyphs) {
    const polys = g.polys.map((p) => { const q = p.filter((v, i, a) => !i || v[0] !== a[i - 1][0] || v[1] !== a[i - 1][1]); q.hole = p.hole; if (q.length > 1 && q[0][0] === q[q.length - 1][0] && q[0][1] === q[q.length - 1][1]) q.pop(); return q; }).filter((p) => p.length >= 3 && Math.abs(glArea(p)) > 0.5).map((p) => ((glArea(p) > 0) !== !!p.hole ? p.reverse() : p));
    if (!polys.length) { glyf.push(new Uint8Array(0)); loca.push(off); hm.push([g.adv, 0]); continue; }
    const all = polys.flat(); const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]); const b = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    bb[0] = Math.min(bb[0], b[0]); bb[1] = Math.min(bb[1], b[1]); bb[2] = Math.max(bb[2], b[2]); bb[3] = Math.max(bb[3], b[3]);
    maxPts = Math.max(maxPts, all.length); maxCont = Math.max(maxCont, polys.length);
    const n = all.length; const size = 10 + 2 * polys.length + 2 + n + 4 * n; const v = B(size + ((4 - (size % 4)) % 4)); let p = 0;
    v.setInt16(p, polys.length); v.setInt16(p + 2, b[0]); v.setInt16(p + 4, b[1]); v.setInt16(p + 6, b[2]); v.setInt16(p + 8, b[3]); p = 10;
    let end = -1; for (const q of polys) { end += q.length; v.setUint16(p, end); p += 2; }
    v.setUint16(p, 0); p += 2; for (let i = 0; i < n; i++) v.setUint8(p++, 1);
    let px = 0; for (const [x] of all) { v.setInt16(p, x - px); px = x; p += 2; }
    let py = 0; for (const [, y] of all) { v.setInt16(p, y - py); py = y; p += 2; }
    const bytes = new Uint8Array(v.buffer); glyf.push(bytes); off += bytes.length; loca.push(off); hm.push([g.adv, b[0]]);
  }
  if (!isFinite(bb[0])) { bb[0] = bb[1] = 0; bb[2] = bb[3] = 0; }
  const N = glyphs.length; const cat = (arrs) => { const t = arrs.reduce((a, b) => a + b.length, 0); const o = new Uint8Array(t); let i = 0; for (const a of arrs) { o.set(a, i); i += a.length; } return o; };
  const T = {};
  T.glyf = cat(glyf);
  { const v = B(4 * (N + 1)); loca.forEach((x, i) => v.setUint32(i * 4, x)); T.loca = new Uint8Array(v.buffer); }
  { const v = B(4 * N); hm.forEach(([a, l], i) => { v.setUint16(i * 4, a); v.setInt16(i * 4 + 2, l); }); T.hmtx = new Uint8Array(v.buffer); }
  const advMax = Math.max(...hm.map((x) => x[0]));
  { const v = B(54); v.setUint32(0, 0x10000); v.setUint32(4, 0x10000); v.setUint32(8, 0); v.setUint32(12, 0x5f0f3cf5); v.setUint16(16, 0x000b); v.setUint16(18, 1000);
    v.setInt16(36, bb[0]); v.setInt16(38, bb[1]); v.setInt16(40, bb[2]); v.setInt16(42, bb[3]); v.setUint16(44, 0); v.setUint16(46, 8); v.setInt16(48, 2); v.setInt16(50, 1); v.setInt16(52, 0); T.head = new Uint8Array(v.buffer); }
  { const v = B(36); v.setUint32(0, 0x10000); v.setInt16(4, 1050); v.setInt16(6, -350); v.setInt16(8, 0); v.setUint16(10, advMax); v.setInt16(12, Math.min(0, ...hm.map((x) => x[1]))); v.setInt16(14, 0); v.setInt16(16, bb[2]); v.setInt16(18, 1); v.setInt16(20, 0); v.setInt16(22, 0); v.setInt16(34, 0); v.setUint16(34, N); T.hhea = new Uint8Array(v.buffer); }
  { const v = B(32); v.setUint32(0, 0x10000); v.setUint16(4, N); v.setUint16(6, Math.max(1, maxPts)); v.setUint16(8, Math.max(1, maxCont)); v.setUint16(14, 2); T.maxp = new Uint8Array(v.buffer); }
  { const v = B(96); v.setUint16(0, 4); v.setInt16(2, Math.round(hm.reduce((a, b) => a + b[0], 0) / N)); v.setUint16(4, 400); v.setUint16(6, 5); v.setUint16(8, 0);
    v.setInt16(10, 650); v.setInt16(12, 600); v.setInt16(14, 0); v.setInt16(16, 75); v.setInt16(18, 650); v.setInt16(20, 600); v.setInt16(22, 0); v.setInt16(24, 350); v.setInt16(26, 50); v.setInt16(28, 260); v.setInt16(30, 0);
    v.setUint32(46, 1 << 25); v.setUint32(50, 1 << 26); v.setUint8(58, 78); v.setUint8(59, 79); v.setUint8(60, 78); v.setUint8(61, 69); v.setUint16(62, 0x40); v.setUint16(64, 0x20); v.setUint16(66, 0xffff);
    v.setInt16(68, 1050); v.setInt16(70, -350); v.setInt16(72, 0); v.setUint16(74, 1050); v.setUint16(76, 350); v.setUint32(78, 1); v.setUint32(82, 0); v.setInt16(86, 500); v.setInt16(88, 700); v.setUint16(90, 0); v.setUint16(92, 32); v.setUint16(94, 1); T['OS/2'] = new Uint8Array(v.buffer); }
  { // cmap: format 4 (space only) and format 12 (everything)
    const map = glyphs.map((g, i) => [g.cp, i]).filter(([c]) => c != null).sort((a, b) => a[0] - b[0]);
    const f4 = B(32); f4.setUint16(0, 4); f4.setUint16(2, 32); f4.setUint16(4, 0); f4.setUint16(6, 4); f4.setUint16(8, 4); f4.setUint16(10, 1); f4.setUint16(12, 0);
    f4.setUint16(14, 0x20); f4.setUint16(16, 0xffff); f4.setUint16(18, 0); f4.setUint16(20, 0x20); f4.setUint16(22, 0xffff); f4.setInt16(24, 1 - 0x20); f4.setInt16(26, 1); f4.setUint16(28, 0); f4.setUint16(30, 0);
    const f12 = B(16 + 12 * map.length); f12.setUint16(0, 12); f12.setUint32(4, 16 + 12 * map.length); f12.setUint32(8, 0); f12.setUint32(12, map.length);
    map.forEach(([c, gi], i) => { f12.setUint32(16 + i * 12, c); f12.setUint32(20 + i * 12, c); f12.setUint32(24 + i * 12, gi); });
    const hd = B(20); hd.setUint16(0, 0); hd.setUint16(2, 2); hd.setUint16(4, 3); hd.setUint16(6, 1); hd.setUint32(8, 20); hd.setUint16(12, 3); hd.setUint16(14, 10); hd.setUint32(16, 20 + 32);
    T.cmap = cat([new Uint8Array(hd.buffer), new Uint8Array(f4.buffer), new Uint8Array(f12.buffer)]);
  }
  { const ps = family.replace(/[^A-Za-z0-9]/g, '') || 'StoryguildGlyphs'; const recs = [[1, family], [2, 'Regular'], [3, ps + '-Regular'], [4, family], [6, ps]];
    const strs = recs.map(([, t]) => { const u = new Uint8Array(t.length * 2); for (let i = 0; i < t.length; i++) { u[i * 2] = t.charCodeAt(i) >> 8; u[i * 2 + 1] = t.charCodeAt(i) & 255; } return u; });
    const v = B(6 + 12 * recs.length); v.setUint16(0, 0); v.setUint16(2, recs.length); v.setUint16(4, 6 + 12 * recs.length); let so = 0;
    recs.forEach(([id], i) => { const p = 6 + i * 12; v.setUint16(p, 3); v.setUint16(p + 2, 1); v.setUint16(p + 4, 0x409); v.setUint16(p + 6, id); v.setUint16(p + 8, strs[i].length); v.setUint16(p + 10, so); so += strs[i].length; });
    T.name = cat([new Uint8Array(v.buffer), ...strs]); }
  { const v = B(32); v.setUint32(0, 0x30000); v.setInt16(8, -100); v.setInt16(10, 50); T.post = new Uint8Array(v.buffer); }
  // --- the file ---
  const tags = Object.keys(T).sort(); const nt = tags.length; let es = 0; while (1 << (es + 1) <= nt) es++;
  const dir = B(12 + 16 * nt); dir.setUint32(0, 0x10000); dir.setUint16(4, nt); dir.setUint16(6, 16 << es); dir.setUint16(8, es); dir.setUint16(10, nt * 16 - (16 << es));
  const sum = (u) => { const p = new Uint8Array(Math.ceil(u.length / 4) * 4); p.set(u); const dv = new DataView(p.buffer); let s3 = 0; for (let i = 0; i < p.length; i += 4) s3 = (s3 + dv.getUint32(i)) >>> 0; return s3; };
  let at = 12 + 16 * nt; const body = [];
  tags.forEach((tag, i) => { const d = T[tag]; for (let k = 0; k < 4; k++) dir.setUint8(12 + i * 16 + k, tag.charCodeAt(k)); dir.setUint32(12 + i * 16 + 4, sum(d)); dir.setUint32(12 + i * 16 + 8, at); dir.setUint32(12 + i * 16 + 12, d.length);
    const pad = new Uint8Array(Math.ceil(d.length / 4) * 4); pad.set(d); body.push(pad); at += pad.length; });
  const font = cat([new Uint8Array(dir.buffer), ...body]);
  const hi = tags.indexOf('head'); const hoff = dir.getUint32(12 + hi * 16 + 8);
  new DataView(font.buffer).setUint32(hoff + 8, (0xb1b0afba - sum(font)) >>> 0);
  font.meta = { gid: new Map(glyphs.map((g, i) => [g.cp, i]).filter(([c]) => c != null)), adv: glyphs.map((g) => g.adv) };
  return font;
}

/* ---------- fonts in the app: one per set, added after the theme's own fonts ---------- */
const GLF = {
  faces: new Map(), base: null, timer: null,
  family: (spec) => `Storyguild Glyphs ${spec.slot}`,
  async refresh() {
    const keep = new Set();
    for (const gf of GLS.all()) {
      try {
        await glEnsureCodes(gf); const spec = glSpec(gf); if (spec.slot == null) continue; const set = glSet(spec); const fam = GLF.family(spec); keep.add(fam);
        const sig = JSON.stringify([spec.script, spec.glyphs, spec.symbols, spec.phonology, spec.lexicon.map((e) => [e.word, e.root, e.meaning]), spec.codes, spec.writing]);
        const had = GLF.faces.get(fam); if (had && had.sig === sig) continue;
        if (!Object.keys(spec.codes || {}).length) continue;
        const bytes = glFontBytes(set, fam); const face = new FontFace(fam, bytes.buffer); await face.load(); document.fonts.add(face);
        if (had) document.fonts.delete(had.face); GLF.faces.set(fam, { face, sig, bytes });
      } catch (e) { console.error('[Wordwright] could not build the font for', gf.path, e); }
    }
    for (const [fam, v] of [...GLF.faces]) if (!keep.has(fam)) { document.fonts.delete(v.face); GLF.faces.delete(fam); }
    GLF.css();
  },
  soon() { clearTimeout(GLF.timer); GLF.timer = setTimeout(() => GLF.refresh(), 900); },
  /** append the glyph fonts to the text, interface and code font stacks, so pasted signs show everywhere */
  css() {
    const b = document.body; const fams = [...GLF.faces.keys()].map((x) => `"${x}"`).join(', ');
    for (const v of ['--font-text', '--font-interface', '--font-monospace']) {
      b.style.removeProperty(v); if (!fams) continue;
      const cur = getComputedStyle(b).getPropertyValue(v).trim(); if (cur) b.style.setProperty(v, `${cur}, ${fams}`);
    }
    b.style.setProperty('--sg-glyph-fonts', fams || 'serif');
  },
  /** fonts for publishing: { slot: { family, bytes, gid: Map(char → glyph number), adv: [widths] } } */
  async forPublish() { await GLF.refresh(); const out = {}; for (const [fam, v] of GLF.faces) out[Number(fam.split(' ').pop())] = { family: fam, bytes: v.bytes, gid: v.bytes.meta.gid, adv: v.bytes.meta.adv }; return out; },
  bytesOf(gf) { const v = GLF.faces.get(GLF.family(glSpec(gf))); return v ? v.bytes : null; },
};

/* ---------- the glyph set note ---------- */
function renderGlyphNote(f) {
  const fm = S.fm(f); const spec = glSpec(f); const c = spec._conlang; const root = h('div', { class: 'cs-root ww-root gl-root' });
  const st = P.mem(f.path, 'glyphs', {}); const rerender = () => wkRerender(root);
  const sym = spec.kind === 'symbols';
  ap(root, h('div', { class: 'ww-hero gl-hero' },
    h('div', { class: 'ww-hero-pill' }, '✒️ Wordwright · Glyphs'),
    h('h1', { class: 'ww-title' }, glName(f)),
    h('div', { class: 'ww-hero-sub' },
      sym ? h('span', { class: 'cs-hint' }, 'A set of symbols') : c ? [h('span', { class: 'cs-hint' }, 'The script of '), h('a', { class: 'wk-link', onclick: (e) => openFile(c, e) }, '🔤 ' + c.basename.replace(/\s*\(conlang\)$/i, ''))] : h('span', { class: 'cs-hint' }, 'A script for English letters'),
      !sym ? h('button', { class: 'ww-mini', onclick: () => suggest({ items: [{ label: '✳ English letters (no conlang)', value: '' }, ...WW.all().map((x) => ({ label: x.basename, value: x.path }))], placeholder: 'Whose sounds does this script write?', source: 'Glyphs',
        onPick: async (v) => { await S.write(f, (x) => { if (v) x.conlang = S.link(app().vault.getAbstractFileByPath(v), f.path); else delete x.conlang; }); } }) }, c ? 'Change' : '🔗 Link a conlang') : null),
    h('div', { class: 'gl-hero-sample' }, glLayout(glSet(spec), sym ? spec.symbols.slice(0, 6).map((y) => y.name).join(' ') : (spec.lexicon.slice(0, 4).map((e) => e.word).join(' ') || 'abc'), { size: 30, color: 'currentColor' }))));
  const used = GLS.usedBy(f);
  ap(root, h('div', { class: 'cs-stat-row' }, h('div', { class: 'cs-stat' }, h('b', {}, String(glSet(spec).inv.reduce((a, g) => a + g.signs.length, 0))), h('span', {}, 'Signs')),
    h('div', { class: 'cs-stat' }, h('b', {}, sym ? 'Symbols' : spec.script), h('span', {}, 'Kind')), h('div', { class: 'cs-stat' }, h('b', {}, glSet(spec).style.name), h('span', {}, 'Look')),
    h('div', { class: 'cs-stat' }, h('b', {}, String(used.length)), h('span', {}, 'Used in'))));
  ap(root, renderGlyphEditor(f, spec, st, rerender));
  return root;
}
function renderGlyphEditor(f, spec, st, rerender) {
  const G = (fn) => S.write(f, (x) => fn(x)); G.spec = spec;
  const wrap = h('div', { class: 'gl-wrap' }); const sym = spec.kind === 'symbols'; const t = glType(spec); const { C, V } = glSounds(spec);
  if (!sym) {
    const typeCards = h('div', { class: 'gl-types' }, ...GL_TYPES.map(([k, d, ex]) => h('button', { class: 'gl-type' + (t === k ? ' is-on' : ''), onclick: async () => { await G((x) => { x.script = k; }); if (spec._conlang) { await S.write(spec._conlang, (x) => { x.script = k; }); await WW.syncTypology(spec._conlang); } } }, h('b', {}, k), h('span', {}, d), h('small', {}, ex))));
    ap(wrap, h('div', { class: 'cl-card' }, h('h4', {}, 'Kind of script'), h('div', { class: 'cs-hint' }, spec._conlang ? 'What each sign stands for. The signs are made from the conlang’s sounds and words, and change with them.' : 'What each sign stands for. With no conlang linked, the script writes English letters, like a cipher.'), typeCards));
    if (!C.length && !V.length) { ap(wrap, h('div', { class: 'cl-card' }, h('div', { class: 'cs-hint' }, 'The linked conlang has no sounds yet: add consonants and vowels on its Sounds tab.'))); return wrap; }
  }
  const set = glSet(spec); const g = spec.glyphs;
  const sampleKeys = sym ? spec.symbols.slice(0, 2).map((y) => 'Y:' + y.id) : [C[0] ? 'C:' + C[0] : 'V:' + V[0], C[1] ? 'C:' + C[1] : 'V:' + (V[1] || V[0])];
  const sample = (style) => { const s2 = glSet(Object.assign({}, spec, { glyphs: Object.assign({}, g, { style, custom: {} }) })); return h('span', { class: 'gl-sample' }, ...sampleKeys.filter(Boolean).map((k) => glSignSvg(s2, k, 30))); };
  const styles = h('div', { class: 'gl-styles' }, ...GL_STYLES.map((x) => h('button', { class: 'gl-style' + (set.style.id === x.id ? ' is-on' : ''), title: x.blurb, onclick: () => G((y) => { y.style = x.id; y.rolls = {}; }) }, sample(x.id), h('b', {}, x.name), h('small', {}, x.blurb))));
  const level = h('div', { class: 'cs-seg gl-level' }, ...[['simple', 'Simple'], ['', 'Balanced'], ['ornate', 'Ornate']].map(([k, l]) => h('button', { class: (g.level || '') === k ? 'is-on' : '', onclick: () => G((y) => { if (k) y.level = k; else delete y.level; }) }, l)));
  const opt = [];
  if (t === 'Abjad') { const cb = h('input', { type: 'checkbox', checked: !!g.pointed }); cb.addEventListener('change', () => G((y) => { y.pointed = cb.checked; })); opt.push(h('label', { class: 'lh-check' }, cb, 'Show vowel points')); }
  if (t === 'Syllabary') { const cb = h('input', { type: 'checkbox', checked: !!g.featural }); cb.addEventListener('change', () => G((y) => { y.featural = cb.checked; })); opt.push(h('label', { class: 'lh-check', title: 'Like Cree syllabics: ka, ki, ko share one shape, turned a different way for each vowel.' }, cb, 'One shape per consonant, turned for each vowel')); }
  if (t === 'Logographic') { const cb = h('input', { type: 'checkbox', checked: !!g.anyWord }); cb.addEventListener('change', () => G((y) => { y.anyWord = cb.checked; })); opt.push(h('label', { class: 'lh-check', title: 'Words not in the dictionary get a sign of their own instead of being spelled out' }, cb, 'Any word gets its own sign')); }
  { const cb = h('input', { type: 'checkbox', checked: !!g.join }); cb.addEventListener('change', () => G((y) => { y.join = cb.checked; })); opt.push(h('label', { class: 'lh-check', title: 'The words of a sentence join into one figure, like a constellation' }, cb, 'Join words into a picture')); }
  if (!sym) { const dir = h('select', { class: 'dropdown' }, ...['Left to right', 'Right to left', 'Top to bottom', 'Alternating lines'].map((v) => h('option', { selected: (spec.writing.direction || 'Left to right') === v }, v))); dir.addEventListener('change', () => G((y) => { y.direction = dir.value; })); opt.push(h('label', { class: 'cl-inline cs-hint' }, 'Direction ', dir)); }
  const nDrawn = Object.keys(g.custom || {}).length;
  ap(wrap, h('div', { class: 'cl-card' }, h('h4', {}, 'The look'), styles,
    h('div', { class: 'gl-opts' }, h('span', { class: 'cs-hint' }, 'Detail'), level, ...opt,
      h('button', { onclick: () => G((y) => { y.seed = 1 + Math.floor(Math.random() * 99999); y.rolls = {}; }) }, '🎲 New set'),
      h('span', { class: 'cs-hint' }, nDrawn ? `Your ${nDrawn} drawn sign${nDrawn === 1 ? ' is' : 's are'} kept.` : 'Click a sign to re-roll it or draw your own.'))));
  // sign chart
  const chart = h('div', { class: 'cl-card gl-chart' }, h('div', { class: 'gl-chart-head' }, h('h4', {}, sym ? 'Symbols' : 'Sign chart'), h('span', { class: 'cd-spacer' }),
    sym ? h('button', { onclick: () => prompt2('New symbol', 'Name, e.g. Thorn-ward', (nm) => G((x) => { x.symbols = arr(x.symbols); const id = (nm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sym') + '-' + uid().slice(0, 3); x.symbols.push({ id, name: nm.trim(), meaning: '' }); st.glEdit = 'Y:' + id; })) }, '+ Add symbol') : null,
    h('button', { title: 'Several images at once, each named after its sound or symbol (k.png, ka.png, Fire.png)', onclick: () => glPickFiles(true, (fs) => glUploadMany(f, fs)) }, '⇪ Upload glyphs'),
    h('button', { title: 'One image with many glyphs in rows; they go to the signs in chart order', onclick: () => glPickFiles(false, ([fl]) => glUploadSheet(f, fl)) }, '⇪ Upload a sheet'),
    h('button', { onclick: () => glSaveImage(f, glChartSvg(spec), sym ? 'Symbols' : 'Script chart', { bg: '#ffffff', unit: 1, scale: 1.2 }) }, '🖼 Save chart as image')));
  for (const grp of set.inv) {
    const all = grp.signs; if (!all.length && !sym) continue; const limit = grp.words && !st.glAllWords ? 48 : all.length;
    const cells = all.slice(0, limit).map((sg) => h('button', { class: 'gl-cell' + (st.glEdit === sg.key ? ' is-on' : '') + ((g.custom || {})[sg.key] ? ' is-drawn' : ''), title: 'Click to change', onclick: () => { st.glEdit = st.glEdit === sg.key ? null : sg.key; st.glDraw = null; rerender(); } },
      glSignSvg(set, sg.key, grp.words ? 50 : 56), h('span', { class: 'gl-lab' }, sg.label.split('  ')[0]), sg.meaning ? h('small', {}, sg.meaning) : sg.label.includes('  ') ? h('small', {}, sg.label.split('  ')[1]) : null));
    ap(chart, h('div', { class: 'gl-group' + (grp.row ? ' is-row' : '') }, sym ? null : h('div', { class: 'cs-group-title' }, grp.title, grp.hint ? h('span', { class: 'cs-hint' }, ' — ' + grp.hint) : null), all.length ? h('div', { class: 'gl-grid' }, ...cells) : h('div', { class: 'cs-hint' }, 'No symbols yet.'),
      limit < all.length ? h('button', { class: 'gl-more', onclick: () => { st.glAllWords = true; rerender(); } }, `Show all ${all.length}`) : null));
    const ed = all.find((x) => x.key === st.glEdit); if (ed) ap(chart, glEditor(f, spec, set, st, rerender, G, ed));
  }
  ap(wrap, chart);
  // write and copy
  if (st.glText == null) st.glText = sym ? spec.symbols.slice(0, 4).map((y) => y.name).join(' ') : spec.phrases.map((p) => p.conlang || p.text).filter(Boolean)[0] || spec.lexicon.slice(0, 6).map((e) => e.word).join(' ') || 'The quick brown fox';
  const ta = h('textarea', { class: 'cl-in gl-in', placeholder: sym ? 'Symbol names, separated by spaces…' : 'Type to see it written…' }, st.glText);
  const show = (t) => (g.join ? glPictureSvg(set, glAutoPicture(set, t), { size: 55 }) : glLayout(set, t, { size: 44 }));
  const out = h('div', { class: 'gl-out' }, show(st.glText));
  ta.addEventListener('input', () => { st.glText = ta.value; out.replaceChildren(show(ta.value)); });
  ap(wrap, h('div', { class: 'cl-card' }, h('div', { class: 'gl-chart-head' }, h('h4', {}, 'Write and copy'), h('span', { class: 'cd-spacer' }),
      h('button', { class: 'mod-cta', title: 'Paste it into Draftsmith or any note: it stays text, in this set’s font', onclick: async () => { await glEnsureCodes(f, st.glText); await GLF.refresh(); wwCopy(glEncode(glSet(glSpec(f)), st.glText), 'Glyphs'); } }, '⧉ Copy as text'),
      h('button', { title: 'A block that draws this in a chapter, and in the published book', onclick: () => wwCopy('```glyphs\nset: ' + glName(f) + '\ntext: ' + st.glText.replace(/\n/g, ' ') + (g.join ? '\njoin: yes' : '') + '\n```\n', 'Glyph block') }, '⧉ Copy as a block'),
      h('button', { onclick: () => glSaveImage(f, show(st.glText), 'Sample', { bg: false, unit: 1, scale: 1 }) }, '🖼 Save as image')), ta, out,
    h('div', { class: 'cs-hint cs-mt' }, sym ? 'Tip: click a symbol in a note’s Glyphs tab to copy just that one.' : `${t === 'Abjad' && !g.pointed ? 'Vowels inside a word are left out, as in Hebrew or Arabic. ' : ''}${t === 'Logographic' ? (g.anyWord ? 'Every word gets a sign of its own. ' : 'Words not in the lexicon are spelled in sound signs inside a frame. ') : ''}${g.join ? 'Words join into one picture: copy it as a block for a chapter, or make and arrange pictures below. ' : ''}Copied text pastes as characters in this set’s font: in Draftsmith you can type around it, cut and move it. Select conlang text in Draftsmith and right-click → “Write in glyphs” to convert it in place.`)));
  ap(wrap, glComposer(f, spec, st, rerender));
  // font
  ap(wrap, h('div', { class: 'cl-card gl-font' }, h('div', {}, h('h4', {}, 'Font'), h('div', { class: 'cs-hint' }, `Storyguild builds a font for this set (“${GLF.family(spec)}”) so copied glyphs show in every note. To use them in Word, Scrivener or a design app, export the font and install it.`)),
    h('button', { onclick: () => glExportFont(f) }, '⇩ Export font (.ttf)')));
  // used in
  const used = GLS.usedBy(f);
  ap(wrap, h('div', { class: 'cl-card' }, h('h4', {}, 'Used in'), used.length ? h('div', { class: 'gl-used' }, ...used.map((n) => h('a', { class: 'wk-link', onclick: (e) => openFile(n, e) }, n.basename))) : h('div', { class: 'cs-hint' }, 'No notes use this set yet. Open a Language, Magic or other note, go to its Glyphs tab and pick this set.')));
  return wrap;
}
async function glExportFont(gf) {
  await glEnsureCodes(gf); await GLF.refresh(); const spec = glSpec(gf); const bytes = glFontBytes(glSet(spec), `${glName(gf)} Glyphs`);
  const folder = normalizePath(`${GLS.folder()}/Exports`); await S.ensureFolder(folder);
  const path = await mFreePath(folder, `${glName(gf)} Glyphs`, 'ttf'); await app().vault.createBinary(path, bytes.buffer.slice(0));
  new Notice(`Saved ${path}. Install it to use the glyphs outside Obsidian; letters pasted from Storyguild use this font.`, 9000); return path;
}

/* ---------- a Glyphs tab for Languages, Magic and other notes ---------- */
function renderGlyphsFor(note) {
  const sets = GLS.setsFor(note); const wrap = h('div', { class: 'gl-for' }); const own = S.linkFiles(note, 'glyphs').filter(isGlyphs);
  const isLang = isLanguage(note) || isConlang(note); const c = isConlang(note) ? note : isLanguage(note) ? WW.conlangOf(note) : null;
  const pick = () => suggest({ items: GLS.all().filter((g) => !sets.some((x) => x.path === g.path)).map((g) => ({ label: glName(g), sub: S.fm(g).kind === 'symbols' ? 'symbols' : 'script', value: g.path })), placeholder: 'Use which glyph set?', source: 'Glyphs',
    onPick: async (v) => { await GLS.link(note, app().vault.getAbstractFileByPath(v)); } });
  const make = (kind) => GLS.create(kind === 'symbols' ? `${note.basename} sigils` : `${(c ? c.basename.replace(/\s*\(conlang\)$/i, '') : note.basename)} script`, { kind, conlang: kind === 'script' ? c : null, link: isConlang(note) && kind === 'script' ? null : note, open: true });
  const btns = h('div', { class: 'wk-legacy-btns' },
    h('button', { class: isLang ? 'mod-cta' : '', onclick: () => make('script') }, isLang ? '✒️ Create a script' : '✒️ New script'),
    h('button', { class: isLang ? '' : 'mod-cta', onclick: () => make('symbols') }, '✴ New symbol set'),
    GLS.all().length ? h('button', { onclick: pick }, '🔗 Use an existing set') : null);
  if (!sets.length) {
    ap(wrap, h('div', { class: 'cv-callout' }, h('div', {}, h('b', {}, isLang ? `How is ${note.basename.replace(/\s*\(conlang\)$/i, '')} written?` : `Glyphs for ${note.basename}`),
      h('div', { class: 'cs-hint' }, isLang ? 'Make a script for it: an alphabet, syllabary, runes… drawn for you from the language’s sounds, ready to copy into your chapters.' : 'Give it runes, sigils or a secret script. Glyph sets live in Wordwright and can be shared between notes; their signs copy into Draftsmith as text.')), btns));
    return wrap;
  }
  for (const gf of sets) {
    const spec = glSpec(gf); const set = glSet(spec); const sym = spec.kind === 'symbols'; const st = P.mem(note.path + '|' + gf.path, 'glyphs-for', { text: '' });
    const signs = set.inv.flatMap((g) => g.signs).filter((x) => !x.key.startsWith('m:') && !x.key.startsWith('p:')).slice(0, sym ? 60 : 30);
    const copyOne = async (key) => { await glEnsureCodes(gf); const sp = glSpec(gf); const cp = glCp(sp, key); if (cp) wwCopy(String.fromCodePoint(cp), 'Glyph'); };
    const ta = h('input', { type: 'text', class: 'gl-for-in', value: st.text, placeholder: sym ? 'Symbol names…' : 'Type to write it…' }); const out = h('div', { class: 'gl-out' }, st.text ? glLayout(set, st.text, { size: 34 }) : null);
    ta.addEventListener('input', () => { st.text = ta.value; out.replaceChildren(ta.value ? glLayout(set, ta.value, { size: 34 }) : ''); });
    const linked = own.some((x) => x.path === gf.path);
    ap(wrap, h('div', { class: 'cl-card gl-for-card' },
      h('div', { class: 'gl-chart-head' }, h('div', {}, h('div', { class: 'cs-tile-label' }, sym ? 'Symbols' : `${spec.script} · ${set.style.name}`), h('a', { class: 'wk-link ww-lang-name', onclick: (e) => openFile(gf, e) }, glName(gf))), h('span', { class: 'cd-spacer' }),
        h('button', { class: 'mod-cta', onclick: (e) => openFile(gf, e) }, '✒️ Open'),
        linked ? h('button', { title: 'Stop using this set here', onclick: () => GLS.unlink(note, gf) }, 'Unlink') : null),
      h('div', { class: 'gl-grid gl-mini' }, ...signs.map((sg) => h('button', { class: 'gl-cell', title: `Copy ${sg.label.split('  ')[0]}${sg.meaning ? ' (' + sg.meaning + ')' : ''}`, onclick: () => copyOne(sg.key) }, glSignSvg(set, sg.key, 40), h('span', { class: 'gl-lab' }, sg.label.split('  ')[0])))),
      h('div', { class: 'cs-hint' }, 'Click a sign to copy it; paste it anywhere as text.'),
      h('div', { class: 'gl-for-write' }, ta, h('button', { onclick: async () => { await glEnsureCodes(gf, st.text); await GLF.refresh(); wwCopy(glEncode(glSet(glSpec(gf)), st.text), 'Glyphs'); } }, '⧉ Copy as text')), out));
  }
  ap(wrap, h('div', { class: 'gl-for-more' }, btns));
  return wrap;
}
/** ```glyphs``` in any note: set: Name / text: … */
function renderGlyphsBlock(src, f) {
  const o = {}; for (const line of String(src).split(/\n/)) { const m = line.match(/^\s*(\w+)\s*:\s*(.*)$/); if (m) o[m[1].toLowerCase()] = m[2].trim(); }
  const name = (o.set || '').replace(/^\[\[|\]\]$/g, ''); const gf = name ? GLS.all().find((g) => glName(g).toLowerCase() === name.replace(GL_SUFFIX, '').toLowerCase()) : GLS.setsFor(f)[0];
  if (!gf) return h('div', { class: 'cs-hint' }, name ? `No glyph set called “${name}”.` : 'Name a glyph set: set: Name, then text: …');
  const set = glSetOf(gf); const size = Number(o.size) || 40;
  if (o.picture) { const p = arr(S.fm(gf).pictures).find((x) => String(x.name).toLowerCase() === o.picture.toLowerCase()); return p ? h('div', { class: 'gl-block' }, glPictureSvg(set, p, { size: size * 0.8 })) : h('div', { class: 'cs-hint' }, `No picture called “${o.picture}” in ${glName(gf)}.`); }
  if (/^(yes|true|1)$/i.test(o.join || '')) return h('div', { class: 'gl-block' }, glPictureSvg(set, glAutoPicture(set, o.text || '', Number(o.seed) || 1), { size: size * 0.8 }));
  return h('div', { class: 'gl-block' }, glLayout(set, o.text || '', { size }));
}
/** a ```glyphs``` block as a picture for a book: dark ink on white */
async function glBlockImage(src, f) {
  const el = renderGlyphsBlock(src, f); const svg = el && el.querySelector && el.querySelector('svg'); if (!svg) return null;
  const r = await glRaster(svg, { type: 'image/jpeg', unit: 1, scale: 1.6, bg: '#ffffff' }); return { bytes: r.bytes, w: r.w, h: r.h, alt: (String(src).match(/text\s*:\s*(.*)/) || [])[1] || 'glyphs' };
}
async function glImagesFor(note) {
  const gf = GLS.setsFor(note)[0]; if (!gf) return [];
  const chart = await glRaster(glChartSvg(glSpec(gf)), { type: 'image/jpeg', unit: 1, scale: 1.4 });
  return [{ title: `The ${glName(gf)} ${S.fm(gf).kind === 'symbols' ? 'symbols' : 'script'}`, bytes: chart.bytes, w: chart.w, h: chart.h }];
}
function newGlyphFlow() {
  suggest({ items: [{ label: '✒️ A script for a conlang', value: 'conlang' }, { label: '✴ A set of symbols: runes, sigils, wards…', value: 'symbols' }, { label: '🔡 A script for English letters (a cipher)', value: 'english' }, { label: '✦ Constellation words: each English word a pattern of stars; sentences join into pictures', value: 'stars' }], placeholder: 'What kind of glyphs?', source: 'Glyphs',
    onPick: (v) => {
      if (v === 'conlang') { const cs = WW.all(); if (!cs.length) { toast('Make a conlang first, or pick English letters.'); return; } suggest({ items: cs.map((c) => ({ label: c.basename.replace(/\s*\(conlang\)$/i, ''), value: c.path })), placeholder: 'Which conlang?', source: 'Glyphs', onPick: (p) => { const c = app().vault.getAbstractFileByPath(p); GLS.create(c.basename.replace(/\s*\(conlang\)$/i, '') + ' script', { conlang: c }); } }); return; }
      if (v === 'stars') { prompt2('New constellation script', 'Name, e.g. Skyreading', async (nm) => { const g2 = await GLS.create(nm, { kind: 'script', script: 'Logographic', open: false }); if (!g2) return; await S.write(g2, (x) => { x.style = 'constellation'; x.anyWord = true; x.join = true; }); await app().workspace.getLeaf(false).openFile(g2); }); return; }
      prompt2(v === 'symbols' ? 'New symbol set' : 'New script', v === 'symbols' ? 'Name, e.g. Ember sigils' : 'Name, e.g. Thieves’ cant', (nm) => GLS.create(nm, { kind: v === 'symbols' ? 'symbols' : 'script' }));
    } });
}
function glLibraryCards() {
  return GLS.all().map((gf) => { const spec = glSpec(gf); const set = glSet(spec); const sym = spec.kind === 'symbols'; const c = spec._conlang;
    const keys = set.inv.flatMap((g) => g.signs).filter((x) => !x.key.startsWith('m:') && !x.key.startsWith('p:')).slice(0, 8);
    return h('div', { class: 'ww-card gl-card', onclick: (e) => { if (!e.target.closest('button, a')) openFile(gf, e); } },
      h('div', { class: 'ww-card-name' }, glName(gf)),
      h('div', { class: 'cs-hint' }, sym ? `Symbols · ${set.style.name}` : [`${spec.script} · ${set.style.name} · `, c ? h('a', { class: 'wk-link', onclick: (e) => openFile(c, e) }, c.basename.replace(/\s*\(conlang\)$/i, '')) : 'English letters']),
      h('div', { class: 'gl-card-signs' }, ...keys.map((k) => glSignSvg(set, k.key, 30))),
      h('div', { class: 'ww-card-stats' }, `${set.inv.reduce((a, g) => a + g.signs.length, 0)} signs · used in ${GLS.usedBy(gf).length}`)); });
}
