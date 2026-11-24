/* =====================================================================
   Maps library, new maps, "maps for this note", code blocks
   ===================================================================== */
async function thumb(map, cls = 'wkm-thumb') {
  const box = h('div', { class: cls });
  loadMapImage(map).then((img) => { if (!img) { box.classList.add('is-empty'); box.textContent = '🗺'; return; } box.style.backgroundImage = `url("${img.url}")`;
    // a light preview of the markup on top of the thumbnail
    M.read(map).then((d) => { const sv = s('svg', { viewBox: `0 0 ${MAP_W} ${img.H}`, preserveAspectRatio: 'xMidYMid slice', class: 'wkm-thumb-svg' }); ap(sv, drawMarkup(d, { H: img.H, showNames: false, idp: uid() })); box.append(sv); });
  }).catch(() => { box.classList.add('is-empty'); box.textContent = '⚠'; });
  return box;
}
function mapStats(map) {
  // counts from the note's map-links/front matter are cheap; item counts need the note text
  const fm = M.fm(map); return { of: M.resolve(fm['map-of'], map.path), links: arr(fm['map-links']).length };
}
async function mapCard(map, { focus = null } = {}) {
  const st = mapStats(map); const d = await M.read(map);
  const n = (k) => d.items.filter((x) => x.k === k).length;
  const counts = [['pin', '📍', 'pins'], ['line', '〰️', 'lines'], ['area', '⬠', 'areas'], ['label', '🔤', 'labels'], ['note', '📝', 'notes']].filter(([k]) => n(k)).map(([k, ic, l]) => h('span', { class: 'wkm-count', title: `${n(k)} ${l}` }, ic, ' ', String(n(k))));
  const chain = st.of ? WK.chain(st.of).map((x) => x.basename) : []; const parent = M.parent(map); const img = M.imageFile(map);
  const card = h('div', { class: 'wkm-mcard' },
    h('div', { class: 'wkm-mcard-img' }, await thumb(map, 'wkm-mcard-thumb'), h('div', { class: 'wkm-mcard-shade' }),
      parent ? h('span', { class: 'wkm-badge' }, '⤵ Inside ' + parent.basename) : null, img && img.extension.toLowerCase() === 'pdf' ? h('span', { class: 'wkm-badge is-r' }, 'PDF') : null,
      h('div', { class: 'wkm-mcard-name' }, map.basename)),
    h('div', { class: 'wkm-mcard-b' },
      st.of ? h('div', { class: 'wkm-mcard-of' }, h('span', {}, noteIcon(st.of)), [...chain, st.of.basename].join(' › ')) : h('div', { class: 'wkm-mcard-of is-none' }, 'Not linked to a place yet'),
      h('div', { class: 'wkm-mcard-n' }, counts.length ? counts : h('span', { class: 'wkm-dim' }, 'Nothing marked yet'), h('span', { class: 'wkm-sp' }), d.scale ? h('span', { class: 'wkm-pill' }, `${fmtD(MAP_W / d.scale.per)} ${d.scale.unit} across`) : null)));
  card.addEventListener('click', (e) => P.openMap(map, focus, e));
  card.addEventListener('contextmenu', (e) => { e.preventDefault(); const m = new Menu(); m.addItem((i) => i.setTitle('Open in Wayfinder').setIcon('compass').onClick(() => P.openMap(map, focus))); m.addItem((i) => i.setTitle('Open map note').setIcon('file-text').onClick(() => openFile(map))); m.addItem((i) => i.setTitle('Export…').setIcon('download').onClick(async () => openExport(map, await M.read(map), await loadMapImage(map)))); m.showAtMouseEvent(e); });
  return card;
}

class MapsLibraryView extends ItemView {
  constructor(leaf) { super(leaf); this.q = ''; }
  getViewType() { return VIEW_LIB; }
  getDisplayText() { return 'Wayfinder'; }
  getIcon() { return 'compass'; }
  async onOpen() {
    this.body = this.contentEl.appendChild(h('div', { class: 'wk wkm wkm-libview cd-view' }));
    const re = debounce(() => this.run(), 400);
    this.registerEvent(app().metadataCache.on('changed', (f) => { if (M.isMap(f)) re(); }));
    this.registerEvent(app().vault.on('delete', re)); this.registerEvent(app().vault.on('rename', re));
    this.run();
  }
  async run() { const el = h('div', {}); await renderLibrary(el, this); setKids(this.body, el); }
}
/** the Wayfinder page: every map as a card, searchable; "Nested" groups maps under the map they sit inside. Also shown in the World Atlas. */
async function renderLibrary(el, state = {}) {
  const maps = M.all(); state.q = state.q || ''; const v = MS().view || (MS().view = {}); const mode = v.lib === 'nested' ? 'nested' : 'cards'; const sort = v.libSort || 'name';
  const setV = (k, val) => { MS().view = Object.assign({}, MS().view, { [k]: val }); P.saveSettingsQuiet(); redraw(); };
  const head = h('div', { class: 'cd-top' }, h('div', { class: 'cd-h1' }, '🧭 Wayfinder'), h('span', { class: 'cd-count' }, `${maps.length} map${maps.length === 1 ? '' : 's'}`), h('span', { class: 'cd-spacer' }),
    ...[['cards', '▦ Cards'], ['nested', '⤵ Nested']].map(([m, l]) => h('button', { class: 'cd-btn' + (mode === m ? ' is-active' : ''), onclick: () => setV('lib', m) }, l)),
    h('button', { class: 'mod-cta cd-new', onclick: () => P.newMap() }, '＋ New map'));
  const search = h('input', { type: 'search', placeholder: 'Find a map, or a place on one…', value: state.q });
  const sortSel = h('select', { class: 'dropdown' }, ...[['name', 'Sort: name'], ['recent', 'Sort: recently changed'], ['place', 'Sort: place']].map(([k, l]) => h('option', { value: k, selected: sort === k }, l)));
  sortSel.addEventListener('change', () => setV('libSort', sortSel.value));
  const filters = h('div', { class: 'cd-filters' }, search, sortSel);
  const body = h('div', {}); const root = h('div', { class: 'cd-root wkm-lib' }, head, maps.length ? filters : null, body); setKids(el, root);
  async function redraw() { const r = await renderLibrary(h('div'), state); root.replaceWith(r.firstChild || r); }
  const ordered = maps.slice().sort((a, b) => sort === 'recent' ? b.stat.mtime - a.stat.mtime : sort === 'place' ? (display(linkName(M.fm(a)['map-of'] || '~')) || '~').localeCompare(display(linkName(M.fm(b)['map-of'] || '~')) || '~') || a.basename.localeCompare(b.basename) : a.basename.localeCompare(b.basename));
  const draw = async () => {
    const q = state.q.toLowerCase(); body.replaceChildren();
    if (!maps.length) { ap(body, h('div', { class: 'wkm-welcome' }, h('div', { class: 'wkm-big' }, '🧭'), h('h3', {}, 'No maps yet'), h('p', {}, 'Add a JPEG, PNG or PDF of a map, set its scale, then add pins, routes, borders, labels and notes. Link maps to places, characters and encyclopedia entries, and they show up on those pages.'), h('button', { class: 'mod-cta cd-new', onclick: () => P.newMap() }, '＋ Add your first map'))); return; }
    if (q) {
      const hits = [];
      for (const m of ordered) { const d = await M.read(m); const its = d.items.filter((it) => (itemTitle(it) + ' ' + (it.desc || '') + ' ' + mDisplay(it.link || '')).toLowerCase().includes(q)); if (m.basename.toLowerCase().includes(q) || its.length) hits.push([m, its]); }
      if (!hits.length) { ap(body, h('div', { class: 'cd-empty wkm-dim' }, 'No maps or places match.')); return; }
      const grid = h('div', { class: 'wkm-mgrid' }); ap(body, grid);
      for (const [m, its] of hits) { const c = await mapCard(m); if (its.length) ap(c.querySelector('.wkm-mcard-b'), h('div', { class: 'wkm-hits' }, ...its.slice(0, 6).map((it) => h('button', { class: 'apill', onclick: (e) => { e.stopPropagation(); P.openMap(m, null, e, it.id); } }, h('span', {}, itemIcon(it)), itemTitle(it))))); ap(grid, c); }
      return;
    }
    if (mode === 'cards') { const grid = h('div', { class: 'wkm-mgrid' }); ap(body, grid); for (const m of ordered) ap(grid, await mapCard(m)); return; }
    // nested: each top-level map with the maps inside it
    const inLib = new Set(maps.map((m) => m.path)); const kidsOf = (m) => ordered.filter((x) => { const p = M.parent(x); return p && p.path === m.path && x.path !== m.path; });
    const top = ordered.filter((m) => { const p = M.parent(m); return !p || !inLib.has(p.path) || p.path === m.path; }); const seen = new Set();
    const branch = async (m, depth) => {
      if (seen.has(m.path)) return null; seen.add(m.path); const kids = kidsOf(m);
      const sec = h('section', { class: 'wkm-branch' + (depth ? ' is-sub' : '') }, h('div', { class: 'wkm-mgrid' }, await mapCard(m)));
      if (kids.length) { const sub = h('div', { class: 'wkm-sub' }, h('div', { class: 'wkm-sub-h' }, `⤵ Inside ${m.basename}`)); const g = h('div', { class: 'wkm-mgrid' }); ap(sub, g); for (const k of kids) { const kk = kidsOf(k); if (kk.length) ap(sub, await branch(k, depth + 1)); else { seen.add(k.path); ap(g, await mapCard(k)); } } ap(sec, sub); }
      return sec;
    };
    for (const m of top) ap(body, await branch(m, 0));
  };
  search.addEventListener('input', debounce(() => { state.q = search.value; draw(); }, 200));
  await draw();
  return el;
}

/** maps that show or mention a note: used on Worldkeeper sheets, encyclopedia entries and the maps code block */
async function renderMapsFor(el, file, { comp = null, preview = true, newButton = true } = {}) {
  const list = M.mapsFor(file); const wrap = h('div', { class: 'wk wkm wkm-for' }); ap(el, wrap);
  if (!list.length) {
    ap(wrap, h('div', { class: 'wkm-empty' }, `No maps show or mention ${file.basename} yet.`, newButton ? h('div', { class: 'wkm-row wkm-center' }, h('button', { class: 'mod-cta', onclick: () => P.newMap({ of: M.link(file) }) }, `＋ New map of ${file.basename}`), h('button', { onclick: () => P.openMaps() }, 'Open Wayfinder')) : null));
    return wrap;
  }
  const first = list[0]; let current = first.map;
  const strip = h('div', { class: 'wkm-for-strip' }); const view = h('div', { class: 'wkm-for-view' });
  const show = async (m) => { current = m; strip.querySelectorAll('.wkm-for-tab').forEach((b) => b.classList.toggle('is-on', b.dataset.p === m.path)); view.replaceChildren(); if (preview) await renderViewer(view, m, { height: 380, focus: file.path === m.path ? null : file, comp }); };
  for (const { map, isOf } of list) {
    const d = await M.read(map); const hits = M.hitsFor(d, map, file);
    ap(strip, h('button', { class: 'wkm-for-tab', 'data-p': map.path, onclick: () => show(map) }, h('span', {}, '🗺 ' + map.basename), h('small', {}, isOf ? 'map of this' : map.path === file.path ? 'this map' : hits.length ? `${hits.length} mention${hits.length === 1 ? '' : 's'}` : 'linked')));
  }
  if (newButton) ap(strip, h('button', { class: 'wkm-for-new', title: 'New map of this note', onclick: () => P.newMap({ of: M.link(file) }) }, '＋'));
  ap(wrap, strip, view); await show(current);
  return wrap;
}

/* ---------- creating maps ---------- */
async function newMap({ of = null, parent = null, name = '', image = null, fromPin = null } = {}) {
  const go = (img) => mPrompt('Name this map', 'e.g. Varos', async (nm) => {
    const folder = mapFolder('mapsFolder'); await mEnsureFolder(folder);
    const path = await mFreePath(folder, nm, 'md');
    const fm = { type: 'map', 'map-image': M.link(img) };
    if (img.extension.toLowerCase() === 'pdf') fm['map-page'] = 1;
    if (of) fm['map-of'] = of;
    if (parent) fm['map-parent'] = M.link(parent);
    fm['map-links'] = [];
    const d = EMPTY_DATA(); d.scale = null; if (of) d.linked = [];
    const f = await app().vault.create(path, '---\n' + stringifyYaml(fm) + '---\n```worldkeeper-map\n' + M.serialize(d) + '\n```\n');
    if (fromPin) { const { view, it } = fromPin; view.change(() => { it.map = M.link(f, view.file.path); }); }
    toast(`Created ${f.path}`);
    setTimeout(() => P.openMap(f), 250);
  }, name || img.basename);
  if (image) go(image); else chooseMapImage(go);
}

/* ---------- code blocks ----------
   ```worldkeeper-map
   map: [[Varos]]      ← embed a map in any note (height:, focus: optional)
   ```
   Inside a map note the block holds the map's own data and shows the map. */
class MapBlock extends MarkdownRenderChild {
  constructor(el, src, ctx) { super(el); this.src = src; this.ctx = ctx; }
  onload() {
    this.run = debounce(() => this.draw(), 300); this.draw();
    this.registerEvent(app().metadataCache.on('changed', (f) => { if (this.target && f.path === this.target.path) this.run(); }));
  }
  async draw() {
    const el = this.containerEl; el.replaceChildren();
    const raw = this.src.trim(); const here = app().vault.getAbstractFileByPath(this.ctx.sourcePath);
    if (!raw || raw.startsWith('{')) {
      this.target = here; if (!here) return;
      const d = M.parse('```worldkeeper-map\n' + raw + '\n```');
      if (d.broken) ap(el, h('div', { class: 'wkm wkm-empty' }, '⚠ This map’s data could not be read: ' + d.broken + '. Undo your last edit to this block, or open the map editor.'));
      // one way into the editor: the ✎ Edit map button on the map itself
      ap(el, h('div', { class: 'wk wkm wkm-blockbar' }, h('b', {}, '🧭 ' + here.basename), h('span', { class: 'wkm-hint' }, `${d.items.length} item${d.items.length === 1 ? '' : 's'}${d.scale ? ' · ' + fmtD(MAP_W / d.scale.per) + ' ' + d.scale.unit + ' across' : ''}`)));
      await renderViewer(el, here, { height: 460, toolbar: true }); return;
    }
    const opts = {}; for (const line of raw.split('\n')) { const m = line.match(/^\s*([\w-]+)\s*:\s*(.*)$/); if (m) opts[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, ''); }
    const target = M.resolve(opts.map, this.ctx.sourcePath); this.target = target;
    if (!target || !M.isMap(target)) { ap(el, h('div', { class: 'wkm wkm-empty' }, opts.map ? `No map called “${mDisplay(opts.map)}”.` : 'Add a line like  map: [[Varos]]')); return; }
    const focus = opts.focus ? M.resolve(opts.focus, this.ctx.sourcePath) : null;
    await renderViewer(el, target, { height: Number(opts.height) || 420, focus });
  }
}
/** ```worldkeeper-maps``` — every map that shows or mentions this note (or `for: [[Note]]`) */
class MapsForBlock extends MarkdownRenderChild {
  constructor(el, src, ctx) { super(el); this.src = src; this.ctx = ctx; }
  onload() { this.draw(); const re = debounce(() => this.draw(), 500); this.registerEvent(app().metadataCache.on('changed', (f) => { if (M.isMap(f)) re(); })); }
  async draw() {
    const el = this.containerEl; el.replaceChildren(); const m = this.src.match(/for\s*:\s*(.+)/i);
    const f = m ? M.resolve(m[1].trim().replace(/^["']|["']$/g, ''), this.ctx.sourcePath) : app().vault.getAbstractFileByPath(this.ctx.sourcePath);
    if (!f) { ap(el, h('div', { class: 'wkm wkm-empty' }, 'Note not found.')); return; }
    await renderMapsFor(el, f, { comp: this });
  }
}
