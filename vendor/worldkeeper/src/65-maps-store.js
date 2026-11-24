/* =====================================================================
   Store: map notes, their markup, images (JPEG/PNG/PDF) and links
   =====================================================================

   A map is an ordinary note:

   ---
   type: map
   map-image: "[[Varos.jpg]]"       the picture or PDF
   map-page: 1                      PDF page (PDFs only)
   map-of: "[[Varos]]"              the place it shows (optional)
   map-parent: "[[Thalassar map]]"  a bigger map it sits inside (optional)
   map-links: [...]                 every note the map links to (kept up to date for you, so backlinks work)
   ---
   ```worldkeeper-map
   { "v": 1, "scale": …, "items": [ …pins, lines, areas, labels, notes… ] }
   ```
   Anything you write below the block is yours.
*/
const BLOCK_RE = /```worldkeeper-map[ \t]*\n([\s\S]*?)\n?```/;
const EMPTY_DATA = () => ({ v: 1, scale: null, items: [], linked: [], hidden: {}, pinSize: null });

const M = {
  fm(f) { return (f && app().metadataCache.getFileCache(f)?.frontmatter) || {}; },
  isMap(f) { if (!f || f.extension !== 'md') return false; const t = String(arr(this.fm(f).type)[0] ?? '').toLowerCase(); return t === 'map' || !!this.fm(f)['map-image']; },
  all() { return app().vault.getMarkdownFiles().filter((f) => this.isMap(f)).sort((a, b) => a.basename.localeCompare(b.basename)); },
  resolve(v, src = '') { const n = linkName(v); return n ? app().metadataCache.getFirstLinkpathDest(n, src) : null; },
  link(f, src = '') { return `[[${app().metadataCache.fileToLinktext(f, src, true)}]]`; },
  imageFile(map) { return this.resolve(this.fm(map)['map-image'], map.path); },
  parse(text) {
    const m = String(text || '').match(BLOCK_RE); if (!m) return EMPTY_DATA();
    try { const d = JSON.parse(m[1] || '{}'); return Object.assign(EMPTY_DATA(), d, { items: arr(d.items) }); } catch (e) { const d = EMPTY_DATA(); d.broken = String(e.message || e); return d; }
  },
  /** one item per line, so the note stays readable and syncs/diffs well */
  serialize(d) {
    const { items, ...rest } = d; delete rest.broken;
    const head = JSON.stringify(rest).slice(0, -1);
    return `${head}${head.length > 1 ? ',' : ''}"items":[${items.length ? '\n' + items.map((x) => JSON.stringify(x)).join(',\n') + '\n' : ''}]}`;
  },
  async read(f) { return this.parse(await readNote(f)); },
  /** save markup into the note's map block, and keep map-links in step with what the map links to */
  async write(f, d) {
    const body = this.serialize(d);
    await processNote(f, (t) => (BLOCK_RE.test(t) ? t.replace(BLOCK_RE, () => '```worldkeeper-map\n' + body + '\n```') : t.replace(/\s*$/, '\n\n') + '```worldkeeper-map\n' + body + '\n```\n'));
    const want = this.linksOf(f, d); const have = arr(this.fm(f)['map-links']).map(linkName).sort();
    const wantN = want.map((x) => linkName(this.link(x, f.path))).sort();
    if (JSON.stringify(have) !== JSON.stringify(wantN)) await app().fileManager.processFrontMatter(f, (x) => { x['map-links'] = want.map((t) => this.link(t, f.path)); });
  },
  /** notes a map links to: the notes you linked to the map, and every pin/line/label/note link */
  linksOf(map, d) {
    const out = new Map(); const add = (v) => { const t = this.resolve(v, map.path); if (t && t.path !== map.path) out.set(t.path, t); };
    arr(d.linked).forEach(add);
    for (const it of d.items) { add(it.link); arr(it.chars).forEach(add); add(it.map); }
    return [...out.values()];
  },
  /** maps that show or mention a note, with the items that mention it */
  mapsFor(file) {
    if (!file) return [];
    const out = [];
    for (const m of this.all()) {
      const fm = this.fm(m); const of = this.resolve(fm['map-of'], m.path); const links = arr(fm['map-links']).map((v) => this.resolve(v, m.path)).filter(Boolean);
      const isOf = of && of.path === file.path; const mentioned = links.some((t) => t.path === file.path);
      if (isOf || mentioned || m.path === file.path) out.push({ map: m, isOf });
    }
    return out.sort((a, b) => Number(b.isOf) - Number(a.isOf) || a.map.basename.localeCompare(b.map.basename));
  },
  /** items on a map that point at a note */
  hitsFor(d, map, file) { return d.items.filter((it) => [it.link, ...arr(it.chars)].some((v) => { const t = this.resolve(v, map.path); return t && t.path === file.path; })); },
  children(map) { return this.all().filter((m) => { const p = this.resolve(this.fm(m)['map-parent'], m.path); return p && p.path === map.path; }); },
  parent(map) { return this.resolve(this.fm(map)['map-parent'], map.path); },
};


/* ---------- images: JPEG / PNG / WebP / GIF, and PDF pages ---------- */
const IMG_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'];
const MAP_EXT = [...IMG_EXT, 'pdf'];
const IMG_CACHE = new Map();
/** { url, w, h, H } — url is a blob URL; H is the map's height in map units */
async function loadMapImage(map) {
  const f = M.imageFile(map); if (!f) return null;
  const page = Math.max(1, Number(M.fm(map)['map-page']) || 1);
  const key = `${f.path}|${f.stat && f.stat.mtime}|${page}|${MS().pdfWidth}`;
  if (IMG_CACHE.has(key)) return IMG_CACHE.get(key);
  const pr = (async () => {
    const buf = await app().vault.readBinary(f);
    let blob;
    if (f.extension.toLowerCase() === 'pdf') blob = await renderPdfPage(buf, page);
    else blob = new Blob([buf], { type: 'image/' + (f.extension.toLowerCase() === 'jpg' ? 'jpeg' : f.extension.toLowerCase()) });
    const url = URL.createObjectURL(blob);
    const img = await loadImg(url);
    return { url, w: img.naturalWidth, h: img.naturalHeight, H: Math.round((MAP_W * img.naturalHeight) / img.naturalWidth), file: f, pdf: f.extension.toLowerCase() === 'pdf', pages: blob.pages || 1, img };
  })();
  IMG_CACHE.set(key, pr);
  pr.catch(() => IMG_CACHE.delete(key));
  return pr;
}
function loadImg(url) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not load the map image')); i.src = url; }); }
/** draw one PDF page to a PNG, using the PDF reader built into Obsidian */
async function renderPdfPage(buf, page) {
  const pdfjs = await obsidian.loadPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const pg = await doc.getPage(clamp(page, 1, doc.numPages));
  const base = pg.getViewport({ scale: 1 });
  const vp = pg.getViewport({ scale: clamp(MS().pdfWidth / base.width, 0.5, 8) });
  const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await pg.render({ canvasContext: ctx, viewport: vp }).promise;
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  blob.pages = doc.numPages; return blob;
}

/* ---------- Worldkeeper types for map links ---------- */
const WK = {
  typeOf(f) { return S.typeIdOf(f) || null; },
  typeInfo(id) { return (T()[id]) || (id === 'map' ? { label: 'Map', icon: '🗺' } : null); },
  chain(f) { const out = []; let cur = f; const seen = new Set(); while (cur && !seen.has(cur.path)) { seen.add(cur.path); cur = S.parentOf(cur); if (cur) out.unshift(cur); } return out; },
  isEntry(f) { return S.isEntry(f); },
};
function noteIcon(f) { if (!f) return '📄'; if (M.isMap(f)) return '🗺'; if (WK.isEntry(f)) return '📚'; const t = WK.typeOf(f); return (t && WK.typeInfo(t)?.icon) || '📄'; }
function noteKind(f) { if (!f) return ''; if (M.isMap(f)) return 'Map'; if (WK.isEntry(f)) return 'Encyclopedia'; const t = WK.typeOf(f); return (t && WK.typeInfo(t)?.label) || ''; }

/* ---------- scale ---------- */
function unitName(u) { return UNITS[u] || u || ''; }
function fmtDist(mapUnits, scale) {
  if (!scale || !scale.per) return null;
  const v = mapUnits / scale.per;
  return `${fmtD(v, v < 10 ? 1 : 0)} ${scale.unit}`;
}
function travelTimes(mapUnits, scale) {
  if (!scale || !scale.per || scale.unit === 'day') return [];
  const v = mapUnits / scale.per; const perUnitMi = { mi: 1, km: 0.621371, lea: 3, m: 0.000621371, ft: 0.000189394 }[scale.unit];
  if (!perUnitMi) return [];
  const miles = v * perUnitMi;
  return MS().speeds.filter((x) => x.perDay > 0).map((x) => ({ name: x.name, days: miles / x.perDay }));
}
function fmtDays(d) { if (d < 1) return `${fmtD(d * 24, 0)} h`; return `${fmtD(d, d < 10 ? 1 : 0)} day${Math.round(d * 10) / 10 === 1 ? '' : 's'}`; }
/** a round length for the scale bar, about a quarter of the map wide */
function niceBar(scale, H) {
  const target = (MAP_W * 0.22) / scale.per; const p = Math.pow(10, Math.floor(Math.log10(target))); const n = [1, 2, 2.5, 5, 10].map((k) => k * p).reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
  return { value: n, len: n * scale.per };
}
