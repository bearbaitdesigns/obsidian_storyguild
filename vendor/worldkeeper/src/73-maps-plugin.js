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
}
