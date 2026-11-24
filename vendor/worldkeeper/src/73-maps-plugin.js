/* =====================================================================
   Wayfinder: wiring into the Worldkeeper plugin
   ===================================================================== */
function installWayfinder(plugin) {
  plugin.registerView(VIEW_MAP, (leaf) => new MapEditorView(leaf));
  plugin.registerView(VIEW_LIB, (leaf) => new MapsLibraryView(leaf));
  plugin.registerMarkdownCodeBlockProcessor(BLOCK, (src, el, ctx) => ctx.addChild(new MapBlock(el, src, ctx)));
  plugin.registerMarkdownCodeBlockProcessor(BLOCK_LIST, (src, el, ctx) => ctx.addChild(new MapsForBlock(el, src, ctx)));
  plugin.addRibbonIcon('compass', 'Wayfinder (maps)', () => plugin.openMaps());
  const active = () => app().workspace.getActiveFile();
  plugin.addCommand({ id: 'open-wayfinder', name: 'Open Wayfinder (maps)', callback: () => plugin.openMaps() });
  plugin.addCommand({ id: 'new-map', name: 'New map…', callback: () => plugin.newMap() });
  plugin.addCommand({ id: 'maps-for-note', name: 'Show maps for this note', checkCallback: (chk) => { const f = active(); if (!f) return false; if (!chk) plugin.showMapsFor(f); return true; } });
  plugin.addCommand({ id: 'open-map-editor', name: 'Open this map in Wayfinder', checkCallback: (chk) => { const f = active(); if (!f || !M.isMap(f)) return false; if (!chk) plugin.openMap(f); return true; } });
  plugin.addCommand({ id: 'new-map-of-note', name: 'New map of this note', checkCallback: (chk) => { const f = active(); if (!f || M.isMap(f) || f.extension !== 'md') return false; if (!chk) plugin.newMap({ of: M.link(f) }); return true; } });
  plugin.addCommand({ id: 'insert-maps-block', name: 'Insert “maps for this note” block', editorCallback: (ed) => ed.replaceSelection('```worldkeeper-maps\n```\n') });
  plugin.addCommand({ id: 'export-map', name: 'Export this map…', checkCallback: (chk) => {
    const v = app().workspace.getActiveViewOfType ? app().workspace.getActiveViewOfType(MapEditorView) : null; const f = v ? v.file : active(); if (!f || !M.isMap(f)) return false;
    if (!chk) (async () => openExport(f, v ? v.d : await M.read(f), v ? v.img : await loadMapImage(f)))(); return true;
  } });
  plugin.registerEvent(app().workspace.on('file-menu', (menu, f) => {
    if (!(f instanceof TFile)) return;
    if (MAP_EXT.includes(f.extension.toLowerCase())) menu.addItem((i) => i.setTitle('Make a Wayfinder map from this').setIcon('compass').onClick(() => plugin.newMap({ image: f })));
    if (M.isMap(f)) menu.addItem((i) => i.setTitle('Open in Wayfinder').setIcon('compass').onClick(() => plugin.openMap(f)));
    else if (f.extension === 'md') menu.addItem((i) => i.setTitle('Maps of this note').setIcon('compass').onClick(() => plugin.showMapsFor(f)));
  }));
}
/** added to the Worldkeeper plugin when it loads */
const WAYFINDER_METHODS = {
  async openMaps() {
    const ex = app().workspace.getLeavesOfType(VIEW_LIB)[0];
    if (ex) { app().workspace.revealLeaf(ex); return; }
    const leaf = app().workspace.getLeaf('tab'); await leaf.setViewState({ type: VIEW_LIB, active: true }); app().workspace.revealLeaf(leaf);
  },
  /** open a map; focus = a note (or its path) to zoom to and highlight; itemId = one item */
  async openMap(map, focus = null, e = null, itemId = null) {
    const fpath = focus ? (typeof focus === 'string' ? focus : focus.path) : null;
    let leaf = app().workspace.getLeavesOfType(VIEW_MAP).find((l) => l.view.file && l.view.file.path === map.path);
    if (!leaf) { leaf = app().workspace.getLeaf(e && (e.ctrlKey || e.metaKey) ? 'split' : 'tab'); await leaf.setViewState({ type: VIEW_MAP, active: true, state: { file: map.path, focus: fpath } }); }
    else if (fpath) leaf.view.focusOn(fpath);
    app().workspace.revealLeaf(leaf);
    if (itemId) setTimeout(() => { const v = leaf.view; const it = v.item(itemId); if (!it) return; v.sel = new Set([it.id]); const c = it.pts || [[it.x, it.y]]; v.stage.focusBox(Math.min(...c.map((p) => p[0])), Math.min(...c.map((p) => p[1])), Math.max(...c.map((p) => p[0])), Math.max(...c.map((p) => p[1]))); v.draw(); v.drawPanel(); v.stage.flash([it.id]); }, 350);
    return leaf;
  },
  newMap(opts) { return newMap(opts || {}); },
  showMapsFor(f) {
    const box = h('div', { class: 'wkm-suggest is-wide' }, h('div', { class: 'wkm-sg-title' }, `🧭 Maps of ${f.basename}`));
    mModal(box, { wide: true }); renderMapsFor(box, f, {});
  },
};

/** Settings → 🧭 Wayfinder */
function renderMapSettings(root, { row, head }) {
  const st = MS(); const save = () => P.saveSettingsQuiet();
  const txt = (k, ph) => { const i = h('input', { type: 'text', value: st[k], placeholder: ph }); i.addEventListener('change', () => { st[k] = i.value.trim() || MAP_DEFAULTS[k]; save(); }); return i; };
  const num = (k, min, max) => { const i = h('input', { type: 'number', value: st[k], min, max, class: 'wk-num' }); i.addEventListener('change', () => { st[k] = clamp(+i.value || MAP_DEFAULTS[k], min, max); save(); }); return i; };
  const tog = (k) => { const b = h('button', { class: 'wk-toggle' + (st[k] ? ' is-on' : ''), onclick: () => { st[k] = !st[k]; b.classList.toggle('is-on', st[k]); save(); } }); return b; };
  const unit = h('select', { class: 'dropdown' }, ...Object.entries(UNITS).map(([k, l]) => h('option', { value: k, selected: st.defaultUnit === k }, l))); unit.addEventListener('change', () => { st.defaultUnit = unit.value; save(); });
  const speeds = h('textarea', {}); speeds.value = st.speeds.map((x) => `${x.name}, ${x.perDay}`).join('\n');
  speeds.addEventListener('change', () => { st.speeds = speeds.value.split('\n').map((l) => { const m = l.match(/^(.*?),\s*([\d.]+)\s*$/); return m ? { name: m[1].trim(), perDay: +m[2] } : null; }).filter(Boolean); save(); });
  ap(root, head('🧭 Wayfinder', 'Maps of your world: JPEG, PNG or PDF, with scale, pins, routes, borders, labels and notes.'),
    row('Map notes', '{root} is your world folder', txt('mapsFolder', '{root}/Maps')),
    row('Uploaded images', 'Where images and PDFs you upload are saved', txt('imagesFolder', '{root}/Maps/Images')),
    row('Exports', 'Where exported maps are saved', txt('exportsFolder', '{root}/Maps/Exports')),
    row('Default unit', 'Used when you set a map’s scale', unit),
    row('Pin size', 'Default size for pins (each map can change it)', num('pinSize', 10, 80)),
    row('Show pin names', 'Default for maps that haven’t chosen', tog('showNames')),
    row('PDF detail', 'Width in pixels that PDF maps are drawn at. Higher is sharper but slower.', num('pdfWidth', 1000, 8000)),
    row('Travel speeds', 'Routes show how long they take. One per line: name, miles per day', speeds));
  ap(root, renderCustomPins());
}
let CP_REDRAW = false;
/** Settings → Wayfinder → Custom pins: your own pin types with a symbol, emoji or picture */
function renderCustomPins() {
  const st = MS(); st.customPins = arr(st.customPins); const box = h('div', { class: 'wkm wkm-custom' });
  const save = () => P.saveSettingsQuiet(); const redraw = () => { if (CP_REDRAW) return; CP_REDRAW = true; setTimeout(() => { CP_REDRAW = false; const cur = document.querySelector('.wkm-custom'); if (cur && cur.isConnected) cur.replaceWith(renderCustomPins()); }, 0); };
  const groups = [...new Set([...ICON_GROUPS.map((g) => g[0]), ...st.customPins.map((c) => (c.group || '').trim()).filter(Boolean)])];
  const dl = h('datalist', { id: 'wkm-groups' }, ...groups.map((g) => h('option', { value: g })));
  ap(box, h('div', { class: 'wk-set-h' }, h('h3', {}, '📍 Custom pins'), h('p', { class: 'setting-item-description' }, 'Make your own pin types, such as Tavern, Shipwreck or Ley line node. Give each a name, a group it’s listed under, and a symbol, emoji or picture. They appear with the built-in pins in Wayfinder, in legends and in the PDF key.')), dl);
  st.customPins.forEach((c, i) => {
    const prev = h('div', { class: 'wkm-cp-prev' }); const paint = () => prev.replaceChildren(iconSvg(c.id, 40));
    const upd = (k, v, re = false) => { c[k] = v; save(); paint(); if (re) redraw(); };
    const name = h('input', { type: 'text', value: c.label || '', placeholder: 'Name, e.g. Tavern' }); name.addEventListener('input', () => upd('label', name.value)); name.addEventListener('change', () => redraw());
    const grp = h('input', { type: 'text', value: c.group || '', placeholder: 'Group, e.g. Places', list: 'wkm-groups' }); grp.addEventListener('change', () => upd('group', grp.value.trim(), true));
    const col = h('input', { type: 'color', value: c.color || '#5a6b7b' }); col.addEventListener('input', () => upd('color', col.value));
    const ring = h('label', { class: 'wkm-check' }, ((x) => { x.addEventListener('change', () => upd('ring', x.checked)); return x; })(h('input', { type: 'checkbox', checked: !!c.ring })), 'Outer ring');
    const kind = h('div', { class: 'wkm-seg' }, ...[['glyph', 'Symbol'], ['emoji', 'Emoji'], ['image', 'Picture']].map(([k, l]) => h('button', { class: (c.kind || 'glyph') === k ? 'is-on' : '', onclick: () => upd('kind', k, true) }, l)));
    let pick;
    if ((c.kind || 'glyph') === 'glyph') pick = h('div', { class: 'wkm-cp-glyphs' }, ...Object.keys(G).map((g) => { const b = h('button', { class: 'wkm-ib' + ((c.glyph || 'poi') === g ? ' is-on' : ''), title: g, onclick: () => upd('glyph', g, true) }); ap(b, iconSvg('__g', 22, { color: c.color || '#5a6b7b', _glyph: g })); return b; }));
    else if (c.kind === 'emoji') { const e = h('input', { type: 'text', value: c.emoji || '', placeholder: 'e.g. 🍺', class: 'wkm-cp-emoji' }); e.addEventListener('input', () => { const v = [...e.value.trim()]; if (v.length) upd('emoji', v.slice(0, 2).join('')); }); pick = e; }
    else {
      const up = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
      const setImg = async (blob) => { try { upd('img', await iconDataUrl(blob), true); } catch (e) { toast('Could not read that picture'); } };
      up.addEventListener('change', () => up.files[0] && setImg(up.files[0]));
      pick = h('div', { class: 'wkm-row' }, h('button', { onclick: () => up.click() }, '⤒ Upload a picture'), h('button', { onclick: () => chooseMapImage(async (f) => { if (f.extension.toLowerCase() === 'pdf') { toast('Pick an image, not a PDF'); return; } setImg(new Blob([await app().vault.readBinary(f)])); }) }, 'From your vault'), up, h('span', { class: 'setting-item-description' }, 'Square pictures work best; it’s shown in a circle.'));
    }
    paint();
    ap(box, h('div', { class: 'wkm-cp' }, prev, h('div', { class: 'wkm-cp-main' }, h('div', { class: 'wkm-row' }, name, grp, col, ring, h('span', { class: 'wkm-sp' }),
      h('button', { class: 'mod-warning', title: 'Delete this pin type. Pins already on maps change to Point of interest.', onclick: () => { st.customPins.splice(i, 1); save(); redraw(); } }, 'Delete')), kind, pick)));
  });
  ap(box, h('button', { class: 'mod-cta', onclick: () => { st.customPins.push({ id: 'c-' + uid(), label: '', group: 'Custom', kind: 'glyph', glyph: 'poi', color: '#c0392b' }); save(); redraw(); setTimeout(() => { const ins = document.querySelectorAll('.wkm-cp input[type=text]'); const last = [...ins].filter((x) => x.placeholder.startsWith('Name')).pop(); last && last.focus(); }, 30); } }, '＋ Add a custom pin'));
  return box;
}
/** shrink a picture to a small square PNG kept in settings, so pins look the same everywhere, exports included */
async function iconDataUrl(blob) {
  const url = URL.createObjectURL(blob); try { const im = await loadImg(url); const n = 96; const c = document.createElement('canvas'); c.width = c.height = n; const ctx = c.getContext('2d'); const k = Math.max(n / im.naturalWidth, n / im.naturalHeight); const w = im.naturalWidth * k, hh = im.naturalHeight * k; ctx.drawImage(im, (n - w) / 2, (n - hh) / 2, w, hh); return c.toDataURL('image/png'); } finally { URL.revokeObjectURL(url); }
}
