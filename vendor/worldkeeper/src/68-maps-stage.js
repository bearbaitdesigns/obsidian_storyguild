/* =====================================================================
   Stage: a pannable, zoomable map with its markup drawn on top
   ===================================================================== */
class Stage {
  constructor(parent, { interactive = false, onRender } = {}) {
    this.interactive = interactive; this.onRender = onRender;
    this.el = h('div', { class: 'wkm-stage', tabindex: interactive ? 0 : null });
    this.world = h('div', { class: 'wkm-world' });
    this.img = h('img', { class: 'wkm-base', draggable: 'false', alt: '' });
    this.svg = s('svg', { class: 'wkm-svg', xmlns: SVGNS });
    this.top = s('g', { class: 'wkm-top' });
    ap(this.world, this.img, this.svg); ap(this.el, this.world); ap(parent, this.el);
    this.z = 1; this.tx = 0; this.ty = 0; this.H = 700; this.d = null; this.selected = new Set();
    this.pointers = new Map();
    this.el.addEventListener('wheel', (e) => { e.preventDefault(); const r = this.el.getBoundingClientRect(); this.zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    new ResizeObserver(() => { if (this.el.clientWidth && !this._userMoved) this.fit(); }).observe(this.el);
  }
  setImage(img) { this.imgInfo = img; this.H = img ? img.H : 700; this.img.src = img ? img.url : ''; this.img.style.width = MAP_W + 'px'; this.img.style.height = this.H + 'px'; this.svg.setAttribute('viewBox', `0 0 ${MAP_W} ${this.H}`); this.svg.setAttribute('width', MAP_W); this.svg.setAttribute('height', this.H); this.world.style.width = MAP_W + 'px'; this.world.style.height = this.H + 'px'; }
  render(d, extra = {}) {
    this.d = d;
    const g = drawMarkup(d, { H: this.H, interactive: this.interactive || extra.clickable, selected: this.selected, numbers: noteNumbers(d), scaleBar: true, idp: this.idp || (this.idp = uid()), ...extra });
    setKids(this.svg, g, this.top);
    this.onRender && this.onRender();
  }
  apply() { this.world.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.z})`; this.el.style.setProperty('--wkm-z', this.z); this.onZoom && this.onZoom(this.z); }
  fit(pad = 12) {
    const w = this.el.clientWidth, hh = this.el.clientHeight; if (!w || !hh) return; this._fitted = true;
    this.z = Math.min((w - pad * 2) / MAP_W, (hh - pad * 2) / this.H); this.tx = (w - MAP_W * this.z) / 2; this.ty = (hh - this.H * this.z) / 2; this.apply();
  }
  zoomAt(f, cx, cy) { this._userMoved = true; const z2 = clamp(this.z * f, 0.05, 40); const k = z2 / this.z; this.tx = cx - (cx - this.tx) * k; this.ty = cy - (cy - this.ty) * k; this.z = z2; this.apply(); }
  zoomBy(f) { this.zoomAt(f, this.el.clientWidth / 2, this.el.clientHeight / 2); }
  /** centre the view on a box in map units */
  focusBox(x0, y0, x1, y1, maxK = 4) {
    this._userMoved = true;
    const w = this.el.clientWidth, hh = this.el.clientHeight; if (!w) return; this._fitted = true;
    const bw = Math.max(60, x1 - x0), bh = Math.max(60, y1 - y0);
    let z = Math.min(w / (bw * 1.8), hh / (bh * 1.8)); const zf = Math.min(w / MAP_W, hh / this.H); z = clamp(z, zf, zf * maxK);
    this.z = z; this.tx = w / 2 - ((x0 + x1) / 2) * z; this.ty = hh / 2 - ((y0 + y1) / 2) * z; this.apply();
  }
  toMap(cx, cy) { const r = this.el.getBoundingClientRect(); return [(cx - r.left - this.tx) / this.z, (cy - r.top - this.ty) / this.z]; }
  flash(ids) {
    for (const id of ids) { const el = this.svg.querySelector(`[data-id="${id}"]`); if (el) { el.classList.remove('wkm-flash'); void el.getBBox; el.classList.add('wkm-flash'); setTimeout(() => el.classList.remove('wkm-flash'), 2400); } }
  }
  /** pan with one finger/mouse, pinch with two; calls handlers for everything else */
  bindPointers({ down, move, up, panIf }) {
    let pan = null, pinch = null, moved = false, downAt = null;
    this.el.addEventListener('pointerdown', (e) => {
      if (e.button === 1 || e.button === 2 && !this.interactive) return;
      this.pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; pinch = { d: dist(a, b), z: this.z, c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; pan = null; return; }
      moved = false; downAt = [e.clientX, e.clientY];
      const handled = down ? down(e) : false;
      if (!handled && (!panIf || panIf(e))) { pan = { x: e.clientX, y: e.clientY, tx: this.tx, ty: this.ty }; this.el.classList.add('is-panning'); }
      try { this.el.setPointerCapture(e.pointerId); } catch (x) { /* */ }
    });
    this.el.addEventListener('pointermove', (e) => {
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; const r = this.el.getBoundingClientRect(); this.zoomAt((dist(a, b) / pinch.d) * pinch.z / this.z, pinch.c[0] - r.left, pinch.c[1] - r.top); return; }
      if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 3) moved = true;
      if (pan) { this._userMoved = true; this.tx = pan.tx + e.clientX - pan.x; this.ty = pan.ty + e.clientY - pan.y; this.apply(); return; }
      move && move(e, moved);
    });
    const end = (e) => {
      this.pointers.delete(e.pointerId); if (this.pointers.size < 2) pinch = null;
      const wasPan = !!pan; pan = null; this.el.classList.remove('is-panning');
      up && up(e, moved, wasPan); downAt = null;
    };
    this.el.addEventListener('pointerup', end); this.el.addEventListener('pointercancel', end);
  }
}

/* =====================================================================
   Viewer: read-only map for embeds, sheets and the library
   ===================================================================== */
async function renderViewer(el, map, { height = 420, focus = null, comp = null, toolbar = true } = {}) {
  const wrap = h('div', { class: 'wk wkm wkm-viewer', style: { height: height + 'px' } }); ap(el, wrap);
  const d = await M.read(map); let img = null;
  try { img = await loadMapImage(map); } catch (e) { ap(wrap, h('div', { class: 'wkm-empty' }, '⚠ ' + (e.message || e))); return wrap; }
  if (!img) { ap(wrap, h('div', { class: 'wkm-empty' }, 'This map has no image yet. ', h('button', { onclick: () => P.openMap(map) }, 'Open the map editor'))); return wrap; }
  const st = new Stage(wrap, { interactive: false }); st.setImage(img); st.render(d, { clickable: true });
  const pop = h('div', { class: 'wkm-pop', style: { display: 'none' } }); ap(wrap, pop);
  const showPop = (it, cx, cy) => {
    const r = wrap.getBoundingClientRect(); const ln = it.link ? M.resolve(it.link, map.path) : null; const sub = it.map ? M.resolve(it.map, map.path) : null;
    const len = it.k === 'line' || it.k === 'area' ? fmtDist(pathLen(it.pts, it.k === 'area'), d.scale) : null;
    setKids(pop, h('div', { class: 'wkm-pop-h' }, h('b', {}, itemTitle(it)), h('button', { class: 'wkm-x', onclick: () => { pop.style.display = 'none'; } }, '✕')),
      it.k === 'note' ? h('div', { class: 'wkm-pop-t' }, it.text) : null, it.desc ? h('div', { class: 'wkm-pop-t' }, it.desc) : null, len ? h('div', { class: 'wkm-hint' }, (it.k === 'area' ? 'Perimeter ' : 'Length ') + len) : null,
      arr(it.chars).length ? h('div', { class: 'wkm-hint' }, 'Travellers: ' + arr(it.chars).map(mDisplay).join(', ')) : null,
      h('div', { class: 'wkm-row' }, ln ? h('button', { class: 'mod-cta wkm-sm', onclick: (e) => openFile(ln, e) }, `${noteIcon(ln)} ${ln.basename}`) : null, sub ? h('button', { class: 'wkm-sm', onclick: () => P.openMap(sub) }, `🗺 ${sub.basename}`) : null));
    pop.style.display = ''; pop.style.left = clamp(cx - r.left + 10, 6, r.width - 250) + 'px'; pop.style.top = clamp(cy - r.top + 10, 6, r.height - 120) + 'px';
  };
  st.bindPointers({ up: (e, moved, wasPan) => { if (moved) return; const t = e.target.closest && e.target.closest('[data-id]'); const it = t && d.items.find((x) => x.id === t.getAttribute('data-id')); if (it) showPop(it, e.clientX, e.clientY); else pop.style.display = 'none'; } });
  if (toolbar) ap(wrap, h('div', { class: 'wkm-vbar' }, h('button', { title: 'Zoom in', onclick: () => st.zoomBy(1.4) }, '+'), h('button', { title: 'Zoom out', onclick: () => st.zoomBy(1 / 1.4) }, '−'), h('button', { title: 'Fit', onclick: () => st.fit() }, '⤢'),
    h('button', { class: 'is-open', title: 'Open in the map editor', onclick: () => P.openMap(map, focus) }, '✎ Edit map')));
  requestAnimationFrame(() => {
    st.fit();
    if (focus) { const hits = M.hitsFor(d, map, focus); if (hits.length) { const c = hits.flatMap((x) => x.pts || [[x.x, x.y]]); st.focusBox(Math.min(...c.map((p) => p[0])), Math.min(...c.map((p) => p[1])), Math.max(...c.map((p) => p[0])), Math.max(...c.map((p) => p[1])), 2.2); st.flash(hits.map((x) => x.id)); } }
  });
  return wrap;
}
