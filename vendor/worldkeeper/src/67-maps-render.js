/* =====================================================================
   Drawing: the same SVG is used on screen, in embeds and in exports
   ===================================================================== */
const HALO = '#fbf6ea';
const KIND_LAYER = { pin: 'pins', line: 'lines', area: 'areas', label: 'labels', note: 'notes' };
const LAYER_NAMES = { areas: 'Areas & borders', lines: 'Lines & routes', labels: 'Labels', pins: 'Pins', notes: 'Notes' };

/** smooth curve through points (Catmull-Rom → Bézier) */
function smoothPath(pts, closed) {
  if (pts.length < 3) return 'M' + pts.map((p) => p.join(' ')).join(' L') + (closed ? ' Z' : '');
  const P2 = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 1; i <= n; i++) {
    const p0 = P2[i - 1], p1 = P2[i], p2 = P2[i + 1], p3 = P2[i + 2];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + (closed ? ' Z' : '');
}
const straightPath = (pts, closed) => 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L') + (closed ? ' Z' : '');

function pinGlyph(it, size) {
  const ic = ICONS[it.icon] || ICONS.poi; const col = it.color || ic.color; const k = size / 24;
  const g = s('g', { transform: `translate(${(it.x - size / 2).toFixed(1)} ${(it.y - size / 2).toFixed(1)}) scale(${k.toFixed(3)})` });
  const r = ic.small ? 7.5 : 10;
  ap(g, s('circle', { cx: 12.6, cy: 13, r, fill: '#000', opacity: 0.25 }));
  if (ic.ring) ap(g, s('circle', { cx: 12, cy: 12, r: 11.6, fill: 'none', stroke: col, 'stroke-width': 1.4 }));
  ap(g, s('circle', { cx: 12, cy: 12, r, fill: col, stroke: '#fff', 'stroke-width': 1.6 }));
  if (it.icon === 'emoji' && it.emoji) ap(g, s('text', { x: 12, y: 12.5, 'font-size': 12, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, it.emoji));
  else if (ic.small) ap(g, s('circle', { cx: 12, cy: 12, r: 2.6, fill: '#fff' }));
  else ap(g, s('path', { d: G[ic.glyph], fill: '#fff' }));
  return g;
}
function textEl(x, y, txt, { size = 14, color = '#2b2118', font = 'serif', italic = false, caps = false, spacing = 0, rot = 0, halo = true, anchor = 'middle', weight = 600 } = {}) {
  const lines = String(txt).split('\n');
  const t = s('text', { x, y, 'font-size': size, fill: color, 'font-family': font === 'sans' ? 'Inter, "Segoe UI", Helvetica, Arial, sans-serif' : 'Georgia, "Iowan Old Style", "Palatino Linotype", "Times New Roman", serif',
    'font-style': italic ? 'italic' : null, 'font-weight': weight, 'letter-spacing': spacing || null, 'text-anchor': anchor,
    transform: rot ? `rotate(${rot} ${x} ${y})` : null, stroke: halo ? HALO : null, 'stroke-width': halo ? Math.max(2, size * 0.18) : null, 'stroke-linejoin': 'round', 'paint-order': 'stroke' });
  lines.forEach((ln, i) => ap(t, s('tspan', { x, dy: i === 0 ? `${(-(lines.length - 1) * 0.6).toFixed(2)}em` : '1.2em', 'dominant-baseline': 'central' }, caps ? ln.toUpperCase() : ln)));
  return t;
}
/** wrap text to a width (approximate; good enough for sticky notes) */
function wrapText(txt, size, width) {
  const maxCh = Math.max(6, Math.floor(width / (size * 0.52))); const out = [];
  for (const para of String(txt || '').split('\n')) { let cur = ''; for (const w of para.split(/\s+/)) { if ((cur + ' ' + w).trim().length > maxCh) { if (cur) out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } out.push(cur); }
  return out;
}

/**
 * Build the map's markup as SVG.
 * opts: { H, pinSize, showNames, scale, interactive, selected, numbers (Map id→n for notes), legend, scaleBar, title }
 */
function drawMarkup(d, opts) {
  const H = opts.H; const root = s('g', { class: 'wkm-markup' });
  const defs = s('defs'); ap(root, defs); const markers = new Map();
  const arrowFor = (color) => { if (markers.has(color)) return markers.get(color); const id = 'wkm-arrow-' + markers.size + '-' + (opts.idp || ''); ap(defs, s('marker', { id, viewBox: '0 0 10 10', refX: 6, refY: 5, markerWidth: 4.5, markerHeight: 4.5, orient: 'auto-start-reverse', markerUnits: 'strokeWidth' }, s('path', { d: 'M0 0 L10 5 L0 10 z', fill: color }))); markers.set(color, id); return id; };
  const hidden = d.hidden || {}; const pinSize = opts.pinSize || d.pinSize || MS().pinSize;
  const showNames = opts.showNames ?? (d.showNames ?? MS().showNames);
  const sel = opts.selected || new Set();
  const layer = (k) => !hidden[k];
  const tag = (el, it) => { if (opts.interactive) { el.setAttribute('data-id', it.id); el.classList.add('wkm-it'); if (sel.has(it.id)) el.classList.add('is-sel'); } if (it.name || it.text) ap(el, s('title', {}, [it.name || '', it.desc ? '\n' + it.desc : ''].join('').trim() || it.text)); return el; };
  const by = (k) => d.items.filter((x) => x.k === k && !x.hide);

  // areas
  if (layer('areas')) for (const it of by('area')) {
    if (!it.pts || it.pts.length < 2) continue; const pre = AREAS[it.style] || AREAS.custom; const col = it.color || pre.color;
    const path = (it.smooth ? smoothPath : straightPath)(it.pts, true);
    const g = s('g', {}, s('path', { d: path, fill: col, 'fill-opacity': it.fill ?? pre.fill, stroke: col, 'stroke-width': it.width || pre.width, 'stroke-dasharray': (it.dash ?? pre.dash) || null, 'stroke-linejoin': 'round' }));
    if (opts.interactive) ap(g, s('path', { d: path, fill: 'none', stroke: 'transparent', 'stroke-width': 12, class: 'wkm-hit' }));
    ap(root, tag(g, it));
  }
  // lines
  if (layer('lines')) for (const it of by('line')) {
    if (!it.pts || it.pts.length < 2) continue; const pre = LINES[it.style] || LINES.custom; const col = it.color || pre.color;
    const smooth = it.smooth ?? pre.smooth; const path = (smooth ? smoothPath : straightPath)(it.pts, false);
    const arrow = it.arrow ?? pre.arrow;
    const g = s('g', {});
    if ((it.style || 'custom') === 'border') ap(g, s('path', { d: path, fill: 'none', stroke: col, 'stroke-opacity': 0.18, 'stroke-width': (it.width || pre.width) * 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    ap(g, s('path', { d: path, fill: 'none', stroke: col, 'stroke-width': it.width || pre.width, 'stroke-dasharray': (it.dash ?? pre.dash) || null, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'marker-end': arrow ? `url(#${arrowFor(col)})` : null }));
    if (opts.interactive) ap(g, s('path', { d: path, fill: 'none', stroke: 'transparent', 'stroke-width': 14, class: 'wkm-hit' }));
    ap(root, tag(g, it));
  }
  // labels
  if (layer('labels')) for (const it of by('label')) {
    const pre = LABELS[it.style] || LABELS.place;
    ap(root, tag(s('g', {}, textEl(it.x, it.y, it.text || 'Label', { size: it.size || pre.size, color: it.color || pre.color, font: it.font || pre.font, italic: it.italic ?? pre.italic, caps: it.caps ?? pre.caps, spacing: it.spacing ?? pre.spacing, rot: it.rot || 0, halo: it.halo ?? true })), it));
  }
  // pins
  if (layer('pins')) for (const it of by('pin')) {
    const sz = (it.size || 1) * pinSize; const g = s('g', {}, pinGlyph(it, sz));
    if (showNames && it.name && !it.hideName) ap(g, textEl(it.x, it.y + sz * 0.5 + sz * 0.32, it.name, { size: Math.max(8, sz * 0.46), color: '#241a12', weight: (ICONS[it.icon] || {}).ring ? 700 : 600 }));
    if (it.map && opts.interactive) ap(g, s('text', { x: it.x + sz * 0.42, y: it.y - sz * 0.42, 'font-size': sz * 0.42, class: 'wkm-sub-ic' }, '⤵'));
    ap(root, tag(g, it));
  }
  // notes
  if (layer('notes')) for (const it of by('note')) {
    const n = opts.numbers ? opts.numbers.get(it.id) : null; const col = it.color || NOTE_COLORS[0]; const g = s('g', {});
    const fs = 11; const w = it.w || 170;
    if (it.open) {
      const lines = wrapText(it.text, fs, w - 16); const hh = 14 + lines.length * fs * 1.3;
      ap(g, s('rect', { x: it.x + 2, y: it.y + 2, width: w, height: hh, rx: 3, fill: '#000', opacity: 0.18 }), s('rect', { x: it.x, y: it.y, width: w, height: hh, rx: 3, fill: col, stroke: '#00000030' }));
      const t = s('text', { x: it.x + 8, y: it.y + 8, 'font-size': fs, 'font-family': 'Inter, "Segoe UI", Helvetica, Arial, sans-serif', fill: '#2b2118' });
      lines.forEach((ln, i) => ap(t, s('tspan', { x: it.x + 8, dy: i === 0 ? '0.95em' : '1.3em' }, ln))); ap(g, t);
    } else {
      ap(g, s('path', { d: `M${it.x} ${it.y}h18v13l-5 5H${it.x}z`, fill: col, stroke: '#00000055', 'stroke-width': 0.8 }), s('path', { d: `M${it.x + 13} ${it.y + 18}v-5h5`, fill: 'none', stroke: '#00000055', 'stroke-width': 0.8 }));
      ap(g, s('text', { x: it.x + 9, y: it.y + 9.5, 'font-size': 9, 'font-weight': 700, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#2b2118', 'font-family': 'Inter, Helvetica, Arial, sans-serif' }, n ? String(n) : '✎'));
    }
    ap(root, tag(g, it));
  }
  // scale bar
  if (opts.scaleBar && d.scale && d.scale.per) {
    const nb = niceBar(d.scale, H); const x = 24, y = H - 26; const g = s('g', { class: 'wkm-scalebar' });
    ap(g, s('rect', { x: x - 8, y: y - 22, width: nb.len + 16 + 40, height: 36, rx: 4, fill: HALO, opacity: 0.85 }));
    for (let i = 0; i < 4; i++) ap(g, s('rect', { x: x + (nb.len / 4) * i, y: y - 6, width: nb.len / 4, height: 6, fill: i % 2 ? HALO : '#2b2118', stroke: '#2b2118', 'stroke-width': 1 }));
    ap(g, textEl(x, y - 14, '0', { size: 10, halo: false, anchor: 'middle', font: 'sans', weight: 500 }), textEl(x + nb.len, y - 14, `${fmtD(nb.value)} ${d.scale.unit}`, { size: 10, halo: false, anchor: 'start', font: 'sans', weight: 600 }));
    ap(root, g);
  }
  // legend (exports)
  if (opts.legend) {
    const used = []; const seen = new Set();
    for (const it of d.items) {
      if (it.hide || hidden[KIND_LAYER[it.k]]) continue;
      const key = it.k === 'pin' ? 'p:' + (it.icon || 'poi') + (it.icon === 'emoji' ? it.emoji : '') : it.k === 'line' ? 'l:' + (it.style || 'custom') + (it.color || '') : it.k === 'area' ? 'a:' + (it.style || 'custom') + (it.color || '') : null;
      if (!key || seen.has(key)) continue; seen.add(key); used.push(it);
    }
    if (used.length) {
      const rowH = 18, w = 170; const x = MAP_W - w - 16, y = 16; const g = s('g', { class: 'wkm-legend' });
      ap(g, s('rect', { x, y, width: w, height: 28 + used.length * rowH, rx: 5, fill: HALO, opacity: 0.92, stroke: '#2b211833' }), textEl(x + 10, y + 13, 'Legend', { size: 11, halo: false, anchor: 'start', font: 'sans', weight: 700 }));
      used.forEach((it, i) => {
        const yy = y + 30 + i * rowH; let sw; let lab;
        if (it.k === 'pin') { sw = pinGlyph({ x: x + 18, y: yy, icon: it.icon, color: it.color, emoji: it.emoji }, 15); lab = it.icon === 'emoji' ? 'Marker' : (ICONS[it.icon] || ICONS.poi).label; }
        else if (it.k === 'line') { const pre = LINES[it.style] || LINES.custom; sw = s('path', { d: `M${x + 9} ${yy}h18`, stroke: it.color || pre.color, 'stroke-width': 2.5, 'stroke-dasharray': (it.dash ?? pre.dash) || null }); lab = pre.label; }
        else { const pre = AREAS[it.style] || AREAS.custom; const c = it.color || pre.color; sw = s('rect', { x: x + 10, y: yy - 6, width: 16, height: 12, fill: c, 'fill-opacity': 0.25, stroke: c, 'stroke-width': 1.5 }); lab = pre.label; }
        ap(g, sw, textEl(x + 34, yy, lab, { size: 10.5, halo: false, anchor: 'start', font: 'sans', weight: 500 }));
      });
      ap(root, g);
    }
  }
  if (opts.title) ap(root, textEl(MAP_W / 2, 30, opts.title, { size: 26, caps: true, spacing: 4, color: '#2b2118' }));
  return root;
}
/** numbers for notes, in reading order, used on markers and in the PDF key */
function noteNumbers(d) { const m = new Map(); let i = 1; for (const it of d.items) if (it.k === 'note' && !it.hide) m.set(it.id, i++); return m; }
function itemCenter(it) { if (it.pts && it.pts.length) { const xs = it.pts.map((p) => p[0]), ys = it.pts.map((p) => p[1]); return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]; } return [it.x || 0, it.y || 0]; }
function itemTitle(it) {
  if (it.k === 'pin') return it.name || (ICONS[it.icon] || {}).label || 'Pin';
  if (it.k === 'line') return it.name || (LINES[it.style] || LINES.custom).label;
  if (it.k === 'area') return it.name || (AREAS[it.style] || AREAS.custom).label;
  if (it.k === 'label') return (it.text || 'Label').replace(/\n/g, ' ');
  if (it.k === 'note') return (it.text || 'Note').split('\n')[0].slice(0, 60);
  return 'Item';
}
function itemIcon(it) { return { pin: '📍', line: '〰️', area: '⬠', label: '🔤', note: '📝' }[it.k] || '•'; }
