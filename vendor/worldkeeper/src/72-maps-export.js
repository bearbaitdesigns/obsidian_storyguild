/* =====================================================================
   Export: PNG, JPEG, SVG, PDF (map + key page) and the markup as JSON
   ===================================================================== */
const PAPER = { image: 'Same shape as the map', letter: 'Letter (8.5 × 11 in)', a4: 'A4', tabloid: 'Tabloid (11 × 17 in)', a3: 'A3' };
const PAPER_PT = { letter: [612, 792], a4: [595.3, 841.9], tabloid: [792, 1224], a3: [841.9, 1190.6] };

function exportItems(d, o) {
  const dd = clone(d); dd.hidden = Object.assign({}, d.hidden, o.hidden || {});
  if (o.openNotes) dd.items.forEach((it) => { if (it.k === 'note') it.open = true; });
  return dd;
}
/** the markup as a standalone SVG string; withImage embeds the map picture */
async function exportSvg(map, d, img, o, withImage) {
  const H = img.H; const dd = exportItems(d, o);
  const sv = s('svg', { xmlns: SVGNS, 'xmlns:xlink': 'http://www.w3.org/1999/xlink', viewBox: `0 0 ${MAP_W} ${H}`, width: o.width, height: Math.round((o.width * H) / MAP_W) });
  if (withImage) ap(sv, s('image', { href: await blobToDataUrl(img.url), x: 0, y: 0, width: MAP_W, height: H, preserveAspectRatio: 'none' }));
  ap(sv, drawMarkup(dd, { H, showNames: o.names, scaleBar: o.scaleBar, legend: o.legend, title: o.title ? map.basename : null, numbers: noteNumbers(dd), idp: 'x' }));
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(sv);
}
async function exportCanvas(map, d, img, o) {
  const W = Math.round(o.width), Hpx = Math.round((W * img.H) / MAP_W);
  const c = document.createElement('canvas'); c.width = W; c.height = Hpx; const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, Hpx); ctx.drawImage(img.img, 0, 0, W, Hpx);
  const svg = await exportSvg(map, d, img, o, false);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try { const over = await loadImg(url); ctx.drawImage(over, 0, 0, W, Hpx); } finally { URL.revokeObjectURL(url); }
  return c;
}
async function blobToDataUrl(url) { const b = await (await fetch(url)).blob(); return new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); }
const canvasBlob = (c, type, q) => new Promise((r) => c.toBlob(r, type, q));

/* ---------- a small PDF writer: one JPEG map page, then key pages ---------- */
const WIN = { '›': 155, '‹': 139, '’': 146, '‘': 145, '“': 147, '”': 148, '–': 150, '—': 151, '…': 133, '•': 149, '€': 128, '™': 153 };
function pdfStr(t) { let o = ''; for (const ch of String(t).replace(/→/g, '->').replace(/←/g, '<-')) { let c = WIN[ch] ?? ch.charCodeAt(0); if (c > 255) c = 63; if (ch === '(' || ch === ')' || ch === '\\') o += '\\' + ch; else if (c < 32 || c > 126) o += '\\' + c.toString(8).padStart(3, '0'); else o += ch; } return o; }
function textW(t, size, bold) { return String(t).length * size * (bold ? 0.56 : 0.5); }
function wrapPdf(t, size, w) { const out = []; for (const para of String(t).split('\n')) { let cur = ''; for (const word of para.split(/\s+/)) { const nx = cur ? cur + ' ' + word : word; if (textW(nx, size) > w && cur) { out.push(cur); cur = word; } else cur = nx; } out.push(cur); } return out; }
function hexRgb(hx) { const m = String(hx || '#888').replace('#', ''); const v = m.length === 3 ? m.split('').map((x) => x + x).join('') : m.padEnd(6, '0'); return [0, 2, 4].map((i) => (parseInt(v.slice(i, i + 2), 16) / 255).toFixed(3)).join(' '); }
async function buildPdf(map, d, img, o) {
  const c = await exportCanvas(map, d, img, o);
  const jpg = new Uint8Array(await (await canvasBlob(c, 'image/jpeg', 0.9)).arrayBuffer());
  let [pw, ph] = o.paper === 'image' ? [c.width * 0.48, c.height * 0.48] : PAPER_PT[o.paper] || PAPER_PT.letter;
  if (o.paper !== 'image' && (c.width > c.height) !== (pw > ph)) [pw, ph] = [ph, pw];
  const m = o.paper === 'image' ? 0 : 28; const k = Math.min((pw - m * 2) / c.width, (ph - m * 2) / c.height); const iw = c.width * k, ih = c.height * k;
  const pages = [`q ${iw.toFixed(2)} 0 0 ${ih.toFixed(2)} ${((pw - iw) / 2).toFixed(2)} ${((ph - ih) / 2).toFixed(2)} cm /Im1 Do Q`];
  const sizes = [[pw, ph]];
  if (o.key) {
    // key pages are portrait
    const [kw, kh] = o.paper === 'image' || !PAPER_PT[o.paper] ? PAPER_PT.letter : PAPER_PT[o.paper];
    let ops = []; let y = kh - 56; const L = 54, R = kw - 54;
    const newPage = () => { pages.push(ops.join('\n')); sizes.push([kw, kh]); ops = []; y = kh - 56; };
    const need = (hh) => { if (y - hh < 50) newPage(); };
    const text = (x, yy, t, size = 10, bold = false, rgb = '0.17 0.13 0.09') => ops.push(`BT ${rgb} rg /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(1)} ${yy.toFixed(1)} Td (${pdfStr(t)}) Tj ET`);
    const para = (x, t, size = 9.5, w = R - x) => { for (const ln of wrapPdf(t, size, w)) { need(size * 1.4); text(x, y, ln, size); y -= size * 1.4; } };
    const heading = (t) => { need(40); y -= 8; text(L, y, t, 13, true); y -= 6; ops.push(`0.6 0.55 0.5 RG 0.6 w ${L} ${y} m ${R} ${y} l S`); y -= 16; };
    const dot = (x, yy, rgb, r = 5) => { const kk = 0.5523 * r; ops.push(`${rgb} rg ${x + r} ${yy} m ${x + r} ${yy + kk} ${x + kk} ${yy + r} ${x} ${yy + r} c ${x - kk} ${yy + r} ${x - r} ${yy + kk} ${x - r} ${yy} c ${x - r} ${yy - kk} ${x - kk} ${yy - r} ${x} ${yy - r} c ${x + kk} ${yy - r} ${x + r} ${yy - kk} ${x + r} ${yy} c f`); };
    text(L, y, map.basename, 20, true); y -= 20;
    const of = M.resolve(M.fm(map)['map-of'], map.path);
    const sub = [of ? `Map of ${[...WK.chain(of).map((x) => x.basename), of.basename].join(' › ')}` : null, d.scale ? `Scale: the map is ${fmtD(MAP_W / d.scale.per)} ${unitName(d.scale.unit)} across` : 'No scale set', `Exported ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`].filter(Boolean).join('   ·   ');
    text(L, y, sub, 9.5, false, '0.4 0.36 0.32'); y -= 14;
    const dd = exportItems(d, o); const vis = (it) => !it.hide && !dd.hidden[KIND_LAYER[it.k]];
    const pins = dd.items.filter((it) => it.k === 'pin' && vis(it));
    if (pins.length) {
      heading(`Places · ${pins.length}`);
      for (const [g, keys] of iconGroups().concat([['Other', ['emoji']]])) {
        const ps = pins.filter((p) => keys.includes(p.icon) || (g === 'Other' && !iconDef(p.icon))); if (!ps.length) continue;
        need(18); text(L, y, g.toUpperCase(), 8, true, '0.45 0.4 0.35'); y -= 13;
        for (const p of ps.sort((a, b) => (a.name || '').localeCompare(b.name || ''))) {
          need(14); dot(L + 5, y + 3, hexRgb(p.color || (iconDef(p.icon) || ICONS.poi).color), 4.2);
          const ln = p.link ? M.resolve(p.link, map.path) : null;
          text(L + 16, y, p.name || (iconDef(p.icon) || { label: 'Marker' }).label, 10, true);
          const extra = [(iconDef(p.icon) || { label: 'Marker' }).label, ln && ln.basename !== p.name ? '→ ' + ln.basename : null].filter(Boolean).join('  ·  ');
          text(L + 22 + textW(p.name || '', 10, true), y, extra, 8.5, false, '0.45 0.4 0.35'); y -= 13;
          if (p.desc) { y += 2; para(L + 16, p.desc, 8.5); y -= 2; }
        }
        y -= 4;
      }
    }
    const lines = dd.items.filter((it) => (it.k === 'line' || it.k === 'area') && vis(it));
    if (lines.length) {
      heading(`Routes, borders & areas · ${lines.length}`);
      for (const it of lines) {
        const pre = it.k === 'line' ? LINES[it.style] || LINES.custom : AREAS[it.style] || AREAS.custom; const L2 = pathLen(it.pts, it.k === 'area');
        need(16); ops.push(`${hexRgb(it.color || pre.color)} RG 2.2 w ${L} ${y + 3} m ${L + 12} ${y + 3} l S`);
        text(L + 18, y, itemTitle(it), 10, true);
        const real = fmtDist(L2, d.scale); const tt = it.k === 'line' && TRAVEL_STYLES.has(it.style || 'custom') ? travelTimes(L2, d.scale).slice(0, 3).map((t) => `${t.name.toLowerCase()} ${fmtDays(t.days)}`).join(', ') : '';
        text(L + 24 + textW(itemTitle(it), 10, true), y, [pre.label, real ? (it.k === 'area' ? 'perimeter ' : '') + real : null, tt].filter(Boolean).join('  ·  '), 8.5, false, '0.45 0.4 0.35'); y -= 13;
        if (arr(it.chars).length) { y += 2; para(L + 18, 'Travellers: ' + arr(it.chars).map(mDisplay).join(', '), 8.5); y -= 2; }
        if (it.desc) { y += 2; para(L + 18, it.desc, 8.5); y -= 2; }
      }
    }
    const notes = dd.items.filter((it) => it.k === 'note' && vis(it)); const nums = noteNumbers(dd);
    if (notes.length) {
      heading(`Notes · ${notes.length}`);
      for (const it of notes) { need(16); dot(L + 6, y + 3, hexRgb(it.color || NOTE_COLORS[0]), 6); text(L + 6 - (String(nums.get(it.id)).length * 2.6), y, String(nums.get(it.id)), 8, true); const lines2 = wrapPdf(it.text || '', 9.5, R - L - 20); lines2.forEach((ln, i) => { if (i) { need(13); } text(L + 20, y, ln, 9.5); y -= 13; }); y -= 3; }
    }
    const links = M.linksOf(map, d);
    if (links.length) { heading('Linked notes'); para(L, links.map((f) => `${f.basename}${noteKind(f) ? ' (' + noteKind(f) + ')' : ''}`).join('   ·   '), 9.5); }
    if (ops.length) pages.push(ops.join('\n')), sizes.push([kw, kh]);
  }
  // assemble
  const parts = []; const offsets = []; let len = 0;
  const push = (x) => { const b = typeof x === 'string' ? latin1(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n`); for (const b of [].concat(body)) push(b); push('\nendobj\n'); };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const pageIds = pages.map((_, i) => 6 + i * 2);
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${pageIds.map((x) => x + ' 0 R').join(' ')}] /Count ${pages.length} >>`);
  obj(3, [`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`, jpg, '\nendstream']);
  obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  obj(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  pages.forEach((content, i) => {
    const [w, hh] = sizes[i]; const pid = pageIds[i], cid = pid + 1; const bytes = latin1(content);
    obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w.toFixed(2)} ${hh.toFixed(2)}] /Resources << /XObject << /Im1 3 0 R >> /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents ${cid} 0 R >>`);
    obj(cid, [`<< /Length ${bytes.length} >>\nstream\n`, bytes, '\nendstream']);
  });
  const n = 6 + pages.length * 2; const xref = len;
  push(`xref\n0 ${n}\n0000000000 65535 f \n`); for (let i = 1; i < n; i++) push(String(offsets[i] || 0).padStart(10, '0') + ' 00000 n \n');
  push(`trailer\n<< /Size ${n} /Root 1 0 R /Info << /Title (${pdfStr(map.basename)}) /Producer (Worldkeeper Maps) >> >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}
function latin1(str) { const b = new Uint8Array(str.length); for (let i = 0; i < str.length; i++) b[i] = str.charCodeAt(i) & 255; return b; }

/* ---------- the export dialog ---------- */
function openExport(map, d, img) {
  if (!img) { toast('This map has no image to export yet'); return; }
  const o = Object.assign({ fmt: 'png', width: Math.min(Math.max(img.w, 2000), 6000), names: d.showNames ?? MS().showNames, scaleBar: !!d.scale, legend: true, title: false, openNotes: false, key: true, paper: 'letter', hidden: Object.assign({}, d.hidden) }, MS().lastExport || {});
  if (!o.width || o.width > 12000) o.width = 3000; o.hidden = Object.assign({}, d.hidden);
  const preview = h('div', { class: 'wkm-exp-prev' });
  const fmtBtns = h('div', { class: 'wkm-seg' }); const opts = h('div', { class: 'wkm-exp-opts' });
  const FMT = { png: ['PNG', 'Picture, sharp text'], jpg: ['JPEG', 'Smaller picture'], pdf: ['PDF', 'Print or share, with a key page'], svg: ['SVG', 'Markup stays editable in design apps'], json: ['Markup', 'Pins, lines, labels and notes as data (JSON)'] };
  const refresh = debounce(async () => {
    if (o.fmt === 'json') { preview.replaceChildren(h('pre', { class: 'wkm-json' }, JSON.stringify(markupJson(map, d), null, 1).slice(0, 1600) + '\n…')); return; }
    const c = await exportCanvas(map, d, img, Object.assign({}, o, { width: 520 })); c.className = 'wkm-exp-canvas'; preview.replaceChildren(c);
  }, 120);
  const chk = (k, label, hint) => { const c = h('input', { type: 'checkbox', checked: !!o[k] }); c.addEventListener('change', () => { o[k] = c.checked; refresh(); }); return h('label', { class: 'wkm-check', title: hint || '' }, c, label); };
  const draw = () => {
    fmtBtns.replaceChildren(...Object.entries(FMT).map(([k, [l, sub]]) => h('button', { class: o.fmt === k ? 'is-on' : '', title: sub, onclick: () => { o.fmt = k; draw(); refresh(); } }, l)));
    opts.replaceChildren();
    ap(opts, h('div', { class: 'wkm-hint' }, FMT[o.fmt][1]));
    if (o.fmt !== 'json') {
      const sizes = [[img.w, `Same as the image (${fmtD(img.w)} px)`], [2000, '2,000 px wide'], [4000, '4,000 px wide'], [6000, '6,000 px wide (large)']].filter((x, i, a) => a.findIndex((y) => y[0] === x[0]) === i);
      const sz = h('select', { class: 'dropdown' }, ...sizes.map(([v, l]) => h('option', { value: v, selected: Number(o.width) === v }, l))); sz.addEventListener('change', () => { o.width = +sz.value; });
      if (o.fmt !== 'svg') ap(opts, h('label', { class: 'wkm-f' }, h('span', {}, 'Size'), sz));
      if (o.fmt === 'pdf') { const pp = h('select', { class: 'dropdown' }, ...Object.entries(PAPER).map(([k, l]) => h('option', { value: k, selected: o.paper === k }, l))); pp.addEventListener('change', () => { o.paper = pp.value; }); ap(opts, h('label', { class: 'wkm-f' }, h('span', {}, 'Paper'), pp)); }
      ap(opts, h('div', { class: 'wkm-sec-h' }, 'Include'), chk('names', 'Pin names'), chk('scaleBar', 'Scale bar', d.scale ? '' : 'Set a scale first'), chk('legend', 'Legend'), chk('title', 'Map name as a title'), chk('openNotes', 'Note text on the map', 'Off: notes show as numbered markers'),
        o.fmt === 'pdf' ? chk('key', 'Key page: places, routes with distances, notes, linked notes') : null,
        h('div', { class: 'wkm-sec-h' }, 'Layers'), ...Object.entries(LAYER_NAMES).map(([k, l]) => { const c = h('input', { type: 'checkbox', checked: !o.hidden[k] }); c.addEventListener('change', () => { o.hidden[k] = !c.checked; refresh(); }); return h('label', { class: 'wkm-check' }, c, l); }));
    }
  };
  const save = async (download) => {
    btnSave.disabled = btnDl.disabled = true; btnSave.textContent = 'Exporting…';
    try {
      const { blob, ext } = await makeExport(map, d, img, o);
      MS().lastExport = { fmt: o.fmt, width: o.width, names: o.names, legend: o.legend, title: o.title, openNotes: o.openNotes, key: o.key, paper: o.paper }; P.saveSettingsQuiet();
      if (download) { const a = h('a', { href: URL.createObjectURL(blob), download: `${map.basename}.${ext}` }); activeDoc().body.append(a); a.click(); a.remove(); toast('Download started'); close(); return; }
      const folder = mapFolder('exportsFolder'); await mEnsureFolder(folder);
      const f = await app().vault.createBinary(await mFreePath(folder, map.basename, ext), await blob.arrayBuffer());
      toast(`Saved ${f.path}`); close(); if (ext !== 'json' && ext !== 'svg') openFile(f);
    } catch (e) { console.error(e); toast('Export failed: ' + (e.message || e)); btnSave.disabled = btnDl.disabled = false; btnSave.textContent = 'Save to vault'; }
  };
  const btnSave = h('button', { class: 'mod-cta', onclick: () => save(false) }, 'Save to vault');
  const btnDl = h('button', { onclick: () => save(true) }, 'Download');
  const btnCopy = h('button', { title: 'Copy the picture to the clipboard', onclick: async () => { try { const c = await exportCanvas(map, d, img, o); const b = await canvasBlob(c, 'image/png'); await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); toast('Copied the map picture'); } catch (e) { toast('Could not copy: ' + (e.message || e)); } } }, 'Copy picture');
  const box = h('div', { class: 'wkm-suggest is-wide wkm-export-box' }, h('div', { class: 'wkm-sg-title' }, `Export “${map.basename}”`), fmtBtns,
    h('div', { class: 'wkm-exp' }, preview, opts), h('div', { class: 'wkm-sg-foot' }, h('span', { class: 'wkm-hint' }, `Saved to ${mapFolder('exportsFolder')}/`), h('span', { class: 'wkm-sp' }), btnCopy, btnDl, btnSave));
  const close = mModal(box, { wide: true }); draw(); refresh();
}
function markupJson(map, d) {
  const img = M.imageFile(map);
  return { map: map.basename, image: img ? img.path : null, mapOf: M.fm(map)['map-of'] || null, units: { width: MAP_W, note: 'Coordinates are in map units: the map is 1000 units wide.' }, scale: d.scale, linked: d.linked, items: d.items, exported: new Date().toISOString(), by: 'Worldkeeper Maps' };
}
async function makeExport(map, d, img, o) {
  if (o.fmt === 'json') return { blob: new Blob([JSON.stringify(markupJson(map, d), null, 2)], { type: 'application/json' }), ext: 'json' };
  if (o.fmt === 'svg') return { blob: new Blob([await exportSvg(map, d, img, Object.assign({}, o, { width: img.w }), true)], { type: 'image/svg+xml' }), ext: 'svg' };
  if (o.fmt === 'pdf') return { blob: await buildPdf(map, d, img, o), ext: 'pdf' };
  const c = await exportCanvas(map, d, img, o);
  return o.fmt === 'jpg' ? { blob: await canvasBlob(c, 'image/jpeg', 0.92), ext: 'jpg' } : { blob: await canvasBlob(c, 'image/png'), ext: 'png' };
}
