/* =====================================================================
   Glyph sets, part two
   • Your own glyphs: upload an image (PNG, JPG, WebP, SVG) for a sign, a
     batch of images named after their sounds or symbols, or one sheet of
     many glyphs. Each image is traced into a filled outline, so it works
     exactly like a made one: in the chart, text, the font, copy and paste
     and published books.
   • Pictures: the words of a sentence joined into one picture, like a
     constellation. Made automatically from a line of text, then arranged
     by hand: drag words, link any two points, add stars.
   ===================================================================== */

/* ---------- tracing an image into outlines ---------- */
async function glLoadImage(file) {
  const url = URL.createObjectURL(file);
  try { const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('not an image')); img.src = url; }); return img; } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
}
/** pixels → ink mask: dark marks on a light or clear background (or light marks on dark, which are flipped) */
function glInkMask(cx, w, h, clearHint) {
  const d = cx.getImageData(0, 0, w, h).data; const lum = new Float32Array(w * h); const alpha = new Float32Array(w * h); let opaque = 0;
  for (let i = 0; i < w * h; i++) { alpha[i] = d[i * 4 + 3] / 255; lum[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255; if (alpha[i] > 0.5) opaque++; }
  const clear = clearHint != null ? clearHint : opaque < w * h * 0.6; const ink = new Uint8Array(w * h);
  if (clear) { for (let i = 0; i < w * h; i++) ink[i] = alpha[i] > 0.45 ? 1 : 0; return ink; }
  // Otsu threshold on brightness
  const hist = new Array(256).fill(0); for (let i = 0; i < w * h; i++) hist[Math.round(lum[i] * 255)]++;
  let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t]; let sB = 0, wB = 0, best = 0, th = 128;
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = w * h - wB; if (!wF) break; sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF; const v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; th = t; } }
  let dark = 0; for (let i = 0; i < w * h; i++) { ink[i] = lum[i] * 255 <= th ? 1 : 0; dark += ink[i]; }
  if (dark > w * h * 0.5) for (let i = 0; i < w * h; i++) ink[i] = 1 - ink[i];
  return ink;
}
/** the edges between ink and paper, joined into closed rings (pixel corners), then simplified */
function glContours(ink, w, h, eps = 0.9) {
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? ink[y * w + x] : 0);
  const next = new Map(); const key = (x, y) => y * (w + 1) + x;
  const edge = (x1, y1, x2, y2) => { const k = key(x1, y1); if (!next.has(k)) next.set(k, []); next.get(k).push([x2, y2]); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!ink[y * w + x]) continue;
    if (!at(x, y - 1)) edge(x, y, x + 1, y); if (!at(x + 1, y)) edge(x + 1, y, x + 1, y + 1);
    if (!at(x, y + 1)) edge(x + 1, y + 1, x, y + 1); if (!at(x - 1, y)) edge(x, y + 1, x, y);
  }
  const rings = [];
  for (const [k0, list] of next) {
    while (list.length) {
      const sx = k0 % (w + 1), sy = Math.floor(k0 / (w + 1)); const ring = [[sx, sy]]; let [cx2, cy2] = list.pop(); let guard = 0;
      while (!(cx2 === sx && cy2 === sy) && guard++ < 200000) { ring.push([cx2, cy2]); const l = next.get(key(cx2, cy2)); if (!l || !l.length) break; const [nx, ny] = l.pop(); cx2 = nx; cy2 = ny; }
      if (ring.length >= 8) rings.push(ring);
    }
  }
  const rdp = (pts) => { if (pts.length < 3) return pts; const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1]; const L = Math.hypot(bx - ax, by - ay) || 1; let idx = 0, md = 0;
    for (let i = 1; i < pts.length - 1; i++) { const dd = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L; if (dd > md) { md = dd; idx = i; } }
    return md > eps ? [...rdp(pts.slice(0, idx + 1)).slice(0, -1), ...rdp(pts.slice(idx))] : [pts[0], pts[pts.length - 1]]; };
  return rings.map((r) => { const half = Math.floor(r.length / 2); const a = rdp(r.slice(0, half + 1)), b = rdp([...r.slice(half), r[0]]); return [...a.slice(0, -1), ...b.slice(0, -1)]; }).filter((r) => r.length >= 3);
}
/** an image (or part of one) → a glyph: one filled shape, holes kept, fitted into the sign box */
function glTraceCanvas(src, sx, sy, sw, sh) {
  const N = 220; const cv = document.createElement('canvas'); cv.width = N; cv.height = N; const cx = cv.getContext('2d', { willReadFrequently: true });
  const k = Math.min((N * 0.7) / sw, (N * 0.7) / sh); const dw = sw * k, dh = sh * k; cx.imageSmoothingEnabled = true;
  // does the image itself have a clear background? then its shape is its ink; otherwise lay it on white and find the dark marks
  const probe = document.createElement('canvas'); probe.width = Math.max(1, Math.round(dw)); probe.height = Math.max(1, Math.round(dh)); const px = probe.getContext('2d', { willReadFrequently: true }); px.drawImage(src, sx, sy, sw, sh, 0, 0, probe.width, probe.height);
  const pd = px.getImageData(0, 0, probe.width, probe.height).data; let clearPx = 0; for (let i = 3; i < pd.length; i += 4) if (pd[i] < 128) clearPx++;
  const clear = clearPx > (pd.length / 4) * 0.15;
  if (!clear) { cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, N, N); }
  cx.drawImage(src, sx, sy, sw, sh, (N - dw) / 2, (N - dh) / 2, dw, dh);
  const ink = glInkMask(cx, N, N, clear); const rings = glContours(ink, N, N);
  if (!rings.length) return null;
  const sc = 100 / N; const d = rings.map((r) => r.map(([x, y], i) => `${i ? 'L' : 'M'}${glN(x * sc)} ${glN(y * sc)}`).join('') + 'Z').join('');
  return ['F:' + d];
}
async function glTraceFile(file) { const img = await glLoadImage(file); const w = img.naturalWidth || img.width || 200, hh = img.naturalHeight || img.height || 200; return glTraceCanvas(img, 0, 0, w, hh); }
/** a sheet of many glyphs: rows split by blank bands, then each row by blank columns; reading order */
async function glSplitSheet(file) {
  const img = await glLoadImage(file); const W0 = img.naturalWidth || img.width, H0 = img.naturalHeight || img.height; const k = Math.min(1, 1400 / Math.max(W0, H0)); const w = Math.round(W0 * k), hh = Math.round(H0 * k);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = hh; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, w, hh); cx.drawImage(img, 0, 0, w, hh); const ink = glInkMask(cx, w, hh, false);
  const bands = (n, has) => { const out = []; let start = -1; for (let i = 0; i <= n; i++) { const on = i < n && has(i); if (on && start < 0) start = i; if (!on && start >= 0) { out.push([start, i]); start = -1; } } return out; };
  const rowsOn = bands(hh, (y) => { for (let x = 0; x < w; x++) if (ink[y * w + x]) return true; return false; });
  // join thin bands (dots above letters) to the band below them
  const rows = []; for (const r of rowsOn) { const last = rows[rows.length - 1]; if (last && (r[0] - last[1] < hh * 0.012 || last[1] - last[0] < hh * 0.012)) last[1] = r[1]; else rows.push([...r]); }
  const cells = [];
  for (const [y0, y1] of rows) {
    const cols = bands(w, (x) => { for (let y = y0; y < y1; y++) if (ink[y * w + x]) return true; return false; });
    const merged = []; for (const c of cols) { const last = merged[merged.length - 1]; if (last && c[0] - last[1] < (y1 - y0) * 0.18) last[1] = c[1]; else merged.push([...c]); }
    for (const [x0, x1] of merged) { const pad = 2; const part = glTraceCanvas(cv, Math.max(0, x0 - pad), Math.max(0, y0 - pad), Math.min(w, x1 + pad) - Math.max(0, x0 - pad), Math.min(hh, y1 + pad) - Math.max(0, y0 - pad)); if (part) cells.push(part); }
  }
  return cells;
}
function glPickFiles(multiple, cb) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,.svg'; inp.multiple = !!multiple; inp.style.display = 'none'; document.body.append(inp);
  inp.addEventListener('change', async () => { const files = [...(inp.files || [])]; inp.remove(); if (files.length) await cb(files); }); inp.click();
}
/** match an uploaded file's name to a sign: "k.png" → k, "ka.png" → ka, "kara.png" → the word kara, "Fire Ward.png" → that symbol */
function glMatchSign(set, name) {
  const n = String(name).replace(/\.[a-z0-9]+$/i, '').trim().toLowerCase();
  for (const grp of set.inv) for (const sg of grp.signs) { const lab = sg.label.split('  ')[0].trim().toLowerCase(); if (lab === n || sg.key.toLowerCase() === n || sg.key.slice(2).toLowerCase() === n) return sg.key; }
  return null;
}
async function glUploadOne(f, key) {
  glPickFiles(false, async ([file]) => {
    try { const strokes = await glTraceFile(file); if (!strokes) { toast('No marks found in that image.'); return; } await S.write(f, (x) => { x.custom = Object.assign({}, x.custom || {}); x.custom[key] = strokes; }); toast('Glyph uploaded'); }
    catch (e) { console.error(e); toast('Could not read that image.'); }
  });
}
/** many images: matched to signs by file name; in a symbol set, new names become new symbols */
async function glUploadMany(f, files) {
  const set = glSetOf(f); const sym = set.fm.kind === 'symbols'; const put = {}; const add = []; const miss = [];
  for (const file of files) {
    try { const strokes = await glTraceFile(file); if (!strokes) { miss.push(file.name); continue; } const key = glMatchSign(set, file.name);
      if (key) put[key] = strokes; else if (sym) { const nm = file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim(); const id = (nm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sym') + '-' + uid().slice(0, 3); add.push({ id, name: nm.replace(/\b\w/g, (c) => c.toUpperCase()), meaning: '' }); put['Y:' + id] = strokes; } else miss.push(file.name); }
    catch (e) { miss.push(file.name); }
  }
  await S.write(f, (x) => { x.custom = Object.assign({}, x.custom || {}, put); if (add.length) x.symbols = [...arr(x.symbols), ...add]; });
  toast(`Uploaded ${Object.keys(put).length} glyph${Object.keys(put).length === 1 ? '' : 's'}${miss.length ? `. Not matched to a sign: ${miss.slice(0, 6).join(', ')}${miss.length > 6 ? '…' : ''} (name files after their sound or symbol, e.g. k.png, ka.png, Fire.png)` : ''}`);
}
/** one sheet → its glyphs in reading order, given to the chart's signs in order (or new symbols) */
async function glUploadSheet(f, file) {
  const cells = await glSplitSheet(file); if (!cells.length) { toast('No glyphs found on that sheet.'); return; }
  const set = glSetOf(f); const sym = set.fm.kind === 'symbols'; const keys = set.inv.flatMap((g) => g.signs).filter((x) => !x.key.startsWith('p:')).map((x) => x.key);
  const put = {}; const add = [];
  cells.forEach((strokes, i) => { if (i < keys.length) put[keys[i]] = strokes; else if (sym) { const id = `sheet-${uid().slice(0, 5)}`; add.push({ id, name: `Symbol ${set.fm.symbols.length + add.length + 1}`, meaning: '' }); put['Y:' + id] = strokes; } });
  await S.write(f, (x) => { x.custom = Object.assign({}, x.custom || {}, put); if (add.length) x.symbols = [...arr(x.symbols), ...add]; });
  toast(`Found ${cells.length} glyph${cells.length === 1 ? '' : 's'} on the sheet and gave them to ${Object.keys(put).length} sign${Object.keys(put).length === 1 ? '' : 's'}, in chart order. Click any sign to fix it.`, 9000);
}

/* ---------- pictures: words joined like a constellation ---------- */
/** points a link can attach to: star centres, line ends */
function glAnchors(strokes) {
  const pts = [];
  for (const x of strokes) for (const poly of glFlatten(x.d)) {
    if (x.f) { const p = poly.pts; const c = p.reduce((a, q) => [a[0] + q[0] / p.length, a[1] + q[1] / p.length], [0, 0]); pts.push(c); }
    else { pts.push(poly.pts[0], poly.pts[poly.pts.length - 1]); }
  }
  const out = []; for (const p of pts) if (!out.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 5)) out.push([glN(p[0]), glN(p[1])]);
  return out;
}
/** one word as a block: its signs side by side, in the 0–100 high box */
function glWordBlock(set, word) {
  const cls = GL_PUNCT[word] ? [] : glSpell(set, word); let x = 0; const strokes = [];
  for (const c of cls) { const b = glCluster(set, c); strokes.push(...glMove(b.strokes, glBox(1, 1, x, 0))); x += b.adv; }
  const [x0, x1] = strokes.length ? glBounds(strokes) : [0, 100]; return { strokes, w: Math.max(40, x1 - x0 + 20), x0 };
}
/** the automatic arrangement: each word set down near the last, turning to avoid the others, joined star to star */
function glAutoPicture(set, text, seed = 1) {
  const words = (String(text || '').match(/[\p{L}\p{M}'’ʼ-]+/gu) || []).slice(0, 40); const r = glRng(`${set.g.seed}|pic|${seed}|${text}`);
  const items = []; const boxes = []; let ang = r() * Math.PI * 2; const turn = (r() < 0.5 ? 1 : -1) * (0.7 + r() * 0.4); // curl one way, so it closes into a figure
  words.forEach((w, i) => {
    const blk = glWordBlock(set, w); const bw = blk.w, bh = 100;
    let pos = [0, 0];
    if (i) {
      const prev = items[i - 1]; const pb = boxes[i - 1]; let placed = null;
      for (let t = 0; t < 24 && !placed; t++) {
        const a = ang + (t % 2 ? 1 : -1) * Math.ceil(t / 2) * 0.35 + (r() - 0.5) * 0.3; const dd = (Math.max(pb.w, pb.h) + Math.max(bw, bh)) * (0.62 + 0.1 * Math.floor(t / 6));
        const cand = [prev.x + pb.w / 2 + Math.cos(a) * dd - bw / 2, prev.y + pb.h / 2 + Math.sin(a) * dd - bh / 2];
        if (boxes.every((b) => cand[0] + bw + 10 < b.x || b.x + b.w + 10 < cand[0] || cand[1] + bh + 10 < b.y || b.y + b.h + 10 < cand[1])) { placed = cand; ang = a + turn + (r() - 0.5) * 0.9; }
      }
      pos = placed || [prev.x + pb.w + 40, prev.y];
    }
    items.push({ w, x: glN(pos[0] - blk.x0 + 10), y: glN(pos[1]), s: 1 }); boxes.push({ x: pos[0], y: pos[1], w: bw, h: bh });
  });
  // links: the closest points of each word and the next; long gaps get a star along the way
  const links = []; const stars = [];
  const anc = items.map((it) => glAnchors(glWordBlock(set, it.w).strokes));
  for (let i = 1; i < items.length; i++) {
    let best = null; anc[i - 1].forEach((p, a) => anc[i].forEach((q, b) => { const d = Math.hypot(items[i - 1].x + p[0] - items[i].x - q[0], items[i - 1].y + p[1] - items[i].y - q[1]); if (!best || d < best[2]) best = [a, b, d]; }));
    if (!best) continue;
    if (best[2] > 110) { const p = anc[i - 1][best[0]], q = anc[i][best[1]]; const mx = (items[i - 1].x + p[0] + items[i].x + q[0]) / 2 + (r() - 0.5) * 30, my = (items[i - 1].y + p[1] + items[i].y + q[1]) / 2 + (r() - 0.5) * 30;
      stars.push({ x: glN(mx), y: glN(my) }); const si = stars.length - 1; links.push({ a: [i - 1, best[0]], b: [-1, si] }, { a: [-1, si], b: [i, best[1]] }); }
    else links.push({ a: [i - 1, best[0]], b: [i, best[1]] });
  }
  // a few links back to earlier words close by, so it reads as one figure
  for (let i = 2; i < items.length; i++) if (r() < 0.3) {
    const j = i - 2; let best = null; anc[j].forEach((p, a) => anc[i].forEach((q, b) => { const d = Math.hypot(items[j].x + p[0] - items[i].x - q[0], items[j].y + p[1] - items[i].y - q[1]); if (!best || d < best[2]) best = [a, b, d]; }));
    if (best && best[2] < 140) links.push({ a: [j, best[0]], b: [i, best[1]] });
  }
  return { text, items, links, stars };
}
function glPicturePoint(set, pic, [i, k], cache) {
  if (i < 0) { const st = pic.stars[k]; return st ? [st.x, st.y] : null; }
  const it = pic.items[i]; if (!it) return null; cache[i] = cache[i] || glAnchors(glWordBlock(set, it.w).strokes); const p = cache[i][k]; if (!p) return null; const sc = it.s || 1;
  return [it.x + p[0] * sc, it.y + p[1] * sc];
}
/** a picture as SVG; with `edit`, words and points are handles for the composer */
function glPictureSvg(set, pic, opts = {}) {
  const svg = s('svg', { class: 'gl-pic', role: 'img', 'aria-label': pic.text || 'glyph picture' }); const g = s('g', {}); svg.append(g); const cache = {};
  let bb = [Infinity, Infinity, -Infinity, -Infinity]; const grow = (x, y) => { bb = [Math.min(bb[0], x), Math.min(bb[1], y), Math.max(bb[2], x), Math.max(bb[3], y)]; };
  const color = opts.color || 'currentColor'; const lw = Math.max(1.4, (set.style.w || 4) * 0.55);
  pic.links.forEach((l, li) => { const a = glPicturePoint(set, pic, l.a, cache), b = glPicturePoint(set, pic, l.b, cache); if (!a || !b) return;
    g.append(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: color, 'stroke-width': lw, 'stroke-linecap': 'round', opacity: 0.85, class: opts.edit ? 'gl-pic-link' : null, 'data-link': opts.edit ? li : null })); });
  pic.items.forEach((it, i) => { const blk = glWordBlock(set, it.w); const sc = it.s || 1;
    const gg = s('g', { transform: `translate(${it.x} ${it.y}) scale(${sc})`, class: opts.edit ? 'gl-pic-word' + (opts.sel === i ? ' is-sel' : '') : null, 'data-item': opts.edit ? i : null });
    if (opts.edit) gg.append(s('rect', { x: blk.x0 - 8, y: 4, width: blk.w, height: 92, rx: 10, class: 'gl-pic-hit' }));
    ap(gg, glPaths(set, blk.strokes, color)); g.append(gg); grow(it.x + (blk.x0 - 10) * sc, it.y); grow(it.x + (blk.x0 - 10 + blk.w) * sc, it.y + 100 * sc);
    if (opts.edit) cache[i] = cache[i] || glAnchors(blk.strokes); });
  pic.stars.forEach((st, k) => { g.append(s('circle', { cx: st.x, cy: st.y, r: 4.5, fill: color })); grow(st.x - 6, st.y - 6); grow(st.x + 6, st.y + 6); });
  if (opts.edit) { // points to link
    pic.items.forEach((it, i) => (cache[i] || []).forEach((p, k) => g.append(s('circle', { cx: it.x + p[0] * (it.s || 1), cy: it.y + p[1] * (it.s || 1), r: 6, class: 'gl-pic-pt' + (opts.pend && opts.pend[0] === i && opts.pend[1] === k ? ' is-pend' : ''), 'data-pt': `${i},${k}` }))));
    pic.stars.forEach((st, k) => g.append(s('circle', { cx: st.x, cy: st.y, r: 7, class: 'gl-pic-pt' + (opts.pend && opts.pend[0] === -1 && opts.pend[1] === k ? ' is-pend' : ''), 'data-pt': `-1,${k}` })));
  }
  if (!isFinite(bb[0])) bb = [0, 0, 100, 100]; const pad = opts.edit ? 60 : 24;
  const W2 = bb[2] - bb[0] + pad * 2, H2 = bb[3] - bb[1] + pad * 2;
  svg.setAttribute('viewBox', `${bb[0] - pad} ${bb[1] - pad} ${W2} ${H2}`);
  if (!opts.fluid) { const k = (opts.size || 40) / 100; svg.setAttribute('width', String(Math.round(W2 * k))); svg.setAttribute('height', String(Math.round(H2 * k))); }
  return svg;
}
/** the composer: drag words, link points, add stars, then save */
function glComposer(f, spec, st, rerender) {
  const set = glSet(spec); const pics = arr(S.fm(f).pictures);
  st.pic = st.pic || null; const wrap = h('div', { class: 'cl-card gl-composer' });
  const save = async (p) => { await S.write(f, (x) => { const list = arr(x.pictures).filter((y) => y.id !== p.id); const clean = JSON.parse(JSON.stringify({ id: p.id, name: p.name, text: p.text, items: p.items, links: p.links, stars: p.stars })); x.pictures = [...list, clean].sort((a, b) => String(a.name).localeCompare(String(b.name))); }); toast(`Saved “${p.name}”`); };
  const head = h('div', { class: 'gl-chart-head' }, h('h4', {}, 'Pictures'), h('span', { class: 'cd-spacer' }),
    h('button', { onclick: () => prompt2('New picture', 'A sentence to join, e.g. The river remembers the stars', (t) => { st.pic = Object.assign(glAutoPicture(set, t, 1), { id: uid(), name: t.slice(0, 40), seed: 1 }); st.picSel = null; st.picPend = null; rerender(); }) }, '+ New picture'));
  ap(wrap, head, h('div', { class: 'cs-hint' }, 'Join the words of a sentence into one figure, like stars in a constellation. Storyguild sets the words down and links them; then drag words, link any two points and add stars of your own.'));
  if (pics.length && !st.pic) ap(wrap, h('div', { class: 'gl-pic-list' }, ...pics.map((p) => h('button', { class: 'gl-pic-card', onclick: () => { st.pic = JSON.parse(JSON.stringify(p)); st.picSel = null; st.picPend = null; rerender(); } }, glPictureSvg(set, p, { size: 16 }), h('b', {}, p.name)))));
  if (!st.pic) return wrap;
  const P2 = st.pic; P2.stars = P2.stars || []; P2.links = P2.links || [];
  st.picMode = st.picMode || 'move';
  const canvas = h('div', { class: 'gl-pic-canvas' });
  let drag = null;
  const draw = () => {
    const svg = glPictureSvg(set, P2, { edit: true, fluid: true, sel: st.picSel, pend: st.picPend }); canvas.replaceChildren(svg);
    if (drag && drag.vb) svg.setAttribute('viewBox', drag.vb); // hold the view still while dragging
    const pt = (e) => { const m = svg.getScreenCTM(); if (!m) return [0, 0]; const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(m.inverse()); return [q.x, q.y]; };
    svg.addEventListener('pointerdown', (e) => {
      const ptEl = e.target.closest('[data-pt]'); const wEl = e.target.closest('[data-item]'); const lEl = e.target.closest('[data-link]');
      if (st.picMode === 'link' && ptEl) { const [i, k] = ptEl.dataset.pt.split(',').map(Number); if (st.picPend && !(st.picPend[0] === i && st.picPend[1] === k)) { P2.links.push({ a: st.picPend, b: [i, k] }); st.picPend = null; } else st.picPend = [i, k]; draw(); return; }
      if (st.picMode === 'link' && lEl) { P2.links.splice(+lEl.dataset.link, 1); draw(); return; }
      if (st.picMode === 'star') { const [x, y] = pt(e); P2.stars.push({ x: glN(x), y: glN(y) }); draw(); return; }
      if (st.picMode === 'move' && ptEl && ptEl.dataset.pt.startsWith('-1,')) { const k = +ptEl.dataset.pt.split(',')[1]; drag = { star: k, from: pt(e), o: [P2.stars[k].x, P2.stars[k].y], vb: svg.getAttribute('viewBox') }; return; }
      if (wEl) { const i = +wEl.dataset.item; st.picSel = i; drag = { item: i, from: pt(e), o: [P2.items[i].x, P2.items[i].y], vb: svg.getAttribute('viewBox') }; draw(); return; }
      st.picSel = null; draw();
    });
    svg.addEventListener('pointermove', (e) => { if (!drag) return; const [x, y] = pt(e); const dx = x - drag.from[0], dy = y - drag.from[1];
      if (drag.item != null) { P2.items[drag.item].x = glN(drag.o[0] + dx); P2.items[drag.item].y = glN(drag.o[1] + dy); } else { P2.stars[drag.star].x = glN(drag.o[0] + dx); P2.stars[drag.star].y = glN(drag.o[1] + dy); }
      draw(); });
    const end = () => { if (drag) { drag = null; draw(); } }; svg.addEventListener('pointerup', end); svg.addEventListener('pointerleave', end);
  };
  draw();
  const modes = h('div', { class: 'cs-seg' }, ...[['move', '✋ Move'], ['link', '🔗 Link points'], ['star', '✦ Add star']].map(([k, l]) => h('button', { class: st.picMode === k ? 'is-on' : '', onclick: () => { st.picMode = k; st.picPend = null; rerender(); } }, l)));
  const help = { move: 'Drag words and stars. Click a word to select it.', link: 'Click a point, then another to join them. Click a line to remove it.', star: 'Click anywhere to add a star.' }[st.picMode];
  const name = h('input', { type: 'text', value: P2.name || '', placeholder: 'Name' }); name.addEventListener('change', () => { P2.name = name.value.trim() || P2.name; });
  const addW = h('input', { type: 'text', placeholder: 'Add a word…', list: 'gl-pic-words' }); const dl = h('datalist', { id: 'gl-pic-words' }, ...spec.lexicon.slice(0, 400).map((e) => h('option', { value: e.word }, e.meaning || '')));
  const sel = st.picSel != null ? P2.items[st.picSel] : null;
  ap(wrap, h('div', { class: 'gl-pic-tools' }, name, modes, h('span', { class: 'cs-hint' }, help)), canvas,
    h('div', { class: 'gl-pic-tools' }, addW, dl, h('button', { onclick: () => { const w = addW.value.trim(); if (!w) return; const last = P2.items[P2.items.length - 1]; P2.items.push({ w, x: last ? last.x + 160 : 0, y: last ? last.y : 0, s: 1 }); rerender(); } }, '+ Word'),
      sel ? [h('button', { onclick: () => { sel.s = glN(Math.min(3, (sel.s || 1) * 1.2)); rerender(); } }, 'Bigger'), h('button', { onclick: () => { sel.s = glN(Math.max(0.3, (sel.s || 1) / 1.2)); rerender(); } }, 'Smaller'),
        h('button', { class: 'mod-warning', onclick: () => { const i = st.picSel; P2.items.splice(i, 1); P2.links = P2.links.filter((l) => l.a[0] !== i && l.b[0] !== i).map((l) => ({ a: [l.a[0] > i ? l.a[0] - 1 : l.a[0], l.a[1]], b: [l.b[0] > i ? l.b[0] - 1 : l.b[0], l.b[1]] })); st.picSel = null; rerender(); } }, 'Remove word')] : null,
      h('span', { class: 'cd-spacer' }),
      h('button', { title: 'Set the words down again in a new arrangement', onclick: () => { P2.seed = (P2.seed || 1) + 1; Object.assign(P2, glAutoPicture(set, P2.items.map((x) => x.w).join(' '), P2.seed), { text: P2.items.map((x) => x.w).join(' ') }); st.picSel = null; rerender(); } }, '🎲 Arrange again'),
      h('button', { onclick: () => { P2.links = []; P2.stars = []; rerender(); } }, 'Clear links')),
    h('div', { class: 'gl-pic-tools' },
      h('button', { class: 'mod-cta', onclick: async () => { P2.name = name.value.trim() || P2.name || 'Picture'; await save(P2); } }, 'Save picture'),
      h('button', { title: 'Copy a block that shows this picture; paste it into a chapter', onclick: async () => { P2.name = name.value.trim() || P2.name || 'Picture'; await save(P2); wwCopy('```glyphs\nset: ' + glName(f) + '\npicture: ' + P2.name + '\n```\n', 'Picture block'); } }, '⧉ Copy for Draftsmith'),
      h('button', { onclick: () => glSaveImage(f, glPictureSvg(set, P2, { size: 60 }), P2.name || 'Picture', { bg: false, unit: 1, scale: 1 }) }, '🖼 Save as image'),
      h('button', { onclick: async () => { await S.write(f, (x) => { x.pictures = arr(x.pictures).filter((y) => y.id !== P2.id); }); st.pic = null; } }, 'Delete'),
      h('button', { onclick: () => { st.pic = null; rerender(); } }, 'Close')));
  return wrap;
}
