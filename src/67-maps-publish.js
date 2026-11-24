/* =====================================================================
   Publish → maps from Wayfinder (Worldkeeper)
   Chosen maps are drawn with their pins, routes, labels and notes and
   added to the book: before chapter one, or after the story.
   ===================================================================== */
/** Wayfinder's helpers, when the Worldkeeper section is on */
const WF = () => (HOST.world && WorldkeeperModule.storyguild && WorldkeeperModule.storyguild.wayfinder) || null;
function wayfinderMaps() { const w = WF(); try { return w ? w.M.all() : []; } catch (e) { return []; } }
/** maps picked for this book that still exist */
function pickedMaps(p) { const all = wayfinderMaps(); const set = arrOf(p.compile.maps); return set.map((path) => all.find((m) => m.path === path)).filter(Boolean); }
const arrOf = (v) => (Array.isArray(v) ? v : v ? [v] : []);
/** maps go in books, not in standard manuscript format */
const mapsAllowed = (o) => !(o.manuscriptFormat && (o.format === 'pdf' || o.format === 'docx'));

/** Draw each picked map with its markup. Wide maps can be turned to fill a portrait page (PDF and Word). */
async function renderBookMaps(p) {
  const o = p.compile; const w = WF(); if (!w || !mapsAllowed(o)) return [];
  const out = [];
  for (const map of pickedMaps(p)) {
    try {
      const img = await w.loadMapImage(map); if (!img) continue;
      const d = await w.M.read(map);
      const c = await w.exportCanvas(map, d, img, { width: Math.min(3000, Math.max(1600, img.w)), names: o.mapNames !== false, scaleBar: o.mapScale !== false && !!d.scale, legend: o.mapLegend !== false, title: false, openNotes: false, hidden: Object.assign({}, d.hidden) });
      let canvas = c;
      const turn = o.mapTurn !== false && o.format !== 'epub' && o.format !== 'md' && c.width > c.height * 1.15;
      if (turn) { canvas = document.createElement('canvas'); canvas.width = c.height; canvas.height = c.width; const ctx = canvas.getContext('2d'); ctx.translate(0, c.width); ctx.rotate(-Math.PI / 2); ctx.drawImage(c, 0, 0); }
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
      out.push({ title: map.basename, path: map.path, ext: 'jpg', mime: 'image/jpeg', bytes: new Uint8Array(await blob.arrayBuffer()), w: canvas.width, h: canvas.height, turned: turn });
    } catch (e) { console.error(e); (p._mapWarnings ||= []).push(`The map “${map.basename}” couldn’t be drawn, so it was left out.`); }
  }
  return out;
}

/** Publish tab: pick maps, where they go, and what's drawn on them */
function renderMapsCard(p, set) {
  const o = p.compile;
  if (!HOST.world) return card('Maps', hint('Turn on the Worldkeeper section to add maps from Wayfinder.'));
  const all = wayfinderMaps();
  if (!all.length) return card('Maps', hint('No maps yet. Add one in Worldkeeper → Wayfinder, then pick it here.'), el('div', { class: 'ds-row' }, btn('🧭 Open Wayfinder', () => HOST.world.openMaps && HOST.world.openMaps())));
  if (!mapsAllowed(o)) return card('Maps', hint('Standard manuscript format leaves out images, so maps aren’t added. Turn it off to include them.'));
  const chosen = new Set(arrOf(o.maps));
  const list = el('div', { class: 'ds-pick ds-maps-pick' }, all.map((m) => el('label', { class: 'ds-map-opt' },
    ((cb) => { cb.addEventListener('change', () => { const next = arrOf(o.maps).filter((x) => x !== m.path); if (cb.checked) next.push(m.path); set('maps', next); }); return cb; })(el('input', { type: 'checkbox', checked: chosen.has(m.path) })),
    mapThumb(m), el('span', {}, m.basename))));
  const ordered = pickedMaps(p);
  const order = ordered.length > 1 ? el('div', { class: 'ds-maps-order' }, el('small', { class: 'ds-hint' }, 'Order in the book'), ordered.map((m, i) => el('div', { class: 'ds-row' }, el('span', { class: 'ds-grow' }, `${i + 1}. ${m.basename}`),
    btn('↑', () => { const a = arrOf(o.maps).filter((x) => ordered.some((y) => y.path === x)); const j = a.indexOf(m.path); if (j > 0) { [a[j - 1], a[j]] = [a[j], a[j - 1]]; set('maps', a); } }, 'ds-sm'),
    btn('↓', () => { const a = arrOf(o.maps).filter((x) => ordered.some((y) => y.path === x)); const j = a.indexOf(m.path); if (j >= 0 && j < a.length - 1) { [a[j + 1], a[j]] = [a[j], a[j + 1]]; set('maps', a); } }, 'ds-sm')))) : null;
  const opt = (k, label, desc) => el('div', { class: 'ds-opt' }, el('div', {}, el('div', {}, label), desc ? el('small', { class: 'ds-hint' }, desc) : null), ((c) => { c.addEventListener('change', () => set(k, c.checked)); return c; })(el('input', { type: 'checkbox', checked: o[k] !== false })));
  const place = el('div', { class: 'ds-opt' }, el('div', {}, 'Where'), ((s) => { s.addEventListener('change', () => set('mapsPlace', s.value)); return s; })(el('select', { class: 'dropdown' }, [['front', 'Before chapter one'], ['back', 'After the story']].map(([v, l]) => el('option', { value: v, selected: (o.mapsPlace || 'front') === v }, l)))));
  return card(`Maps · ${ordered.length} of ${all.length}`, list, ordered.length ? [order, place,
    opt('mapNames', 'Place names', 'Pin names as they show in Wayfinder'), opt('mapLegend', 'Legend'), opt('mapScale', 'Scale bar', 'Only on maps with a scale set'),
    o.format === 'pdf' || o.format === 'docx' ? opt('mapTurn', 'Turn wide maps sideways', 'Fills a portrait page; readers turn the book to read them') : null] : hint('Tick the maps to add. Each one gets its own page with its pins, routes, borders, labels and notes, and is listed in the contents.'));
}
function mapThumb(m) {
  const box = el('span', { class: 'ds-map-thumb' }); const w = WF();
  if (w) w.loadMapImage(m).then((img) => { if (img) box.style.backgroundImage = `url("${img.url}")`; }).catch(() => {});
  return box;
}
