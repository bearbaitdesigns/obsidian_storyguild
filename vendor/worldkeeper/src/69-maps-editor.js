/* =====================================================================
   Map editor view
   ===================================================================== */
const TOOLS = [
  ['select', '🖐', 'Select & move (V)', 'v'], ['pin', '📍', 'Pin (P)', 'p'], ['line', '〰️', 'Line: route, border, road, river (L)', 'l'], ['area', '⬠', 'Area: realm, region (A)', 'a'],
  ['label', '🔤', 'Label (T)', 't'], ['note', '📝', 'Note (N)', 'n'], ['measure', '📏', 'Measure distance (M)', 'm'], ['scale', '⚖', 'Set the scale', null],
];
const DASHES = { '': 'Solid', '9 6': 'Dashed', '2 5': 'Dotted', '12 4 2 4': 'Dash-dot', '3 6': 'Fine dots' };

class MapEditorView extends ItemView {
  constructor(leaf) { super(leaf); this.file = null; this.d = null; this.tool = 'select'; this.opt = { icon: 'town', line: 'route', area: 'realm', label: 'place', note: NOTE_COLORS[0] }; this.draft = null; this.undo = []; this.redo = []; this.focusPath = null; this.q = ''; }
  getViewType() { return VIEW_MAP; }
  getDisplayText() { return this.file ? this.file.basename : 'Map'; }
  getIcon() { return 'map'; }
  getState() { return { file: this.file ? this.file.path : null, focus: this.focusPath }; }
  async setState(state, result) { const f = state && state.file && app().vault.getAbstractFileByPath(state.file); this.focusPath = state && state.focus || null; if (f instanceof TFile) await this.openMapFile(f); return super.setState ? super.setState(state, result) : undefined; }
  async onOpen() {
    this.root = this.contentEl.appendChild(h('div', { class: 'wk wkm wkm-editor' }));
    this.registerEvent(app().vault.on('modify', (f) => { if (this.file && f.path === this.file.path) this.externalChange(); }));
    this.registerEvent(app().metadataCache.on('changed', (f) => { if (this.file && f.path === this.file.path && !this.saving) { if (!this.typingInPanel()) this.drawPanel(); this.drawCrumbs(); } }));
    this.registerEvent(app().vault.on('rename', (f, old) => { if (this.file && f === this.file) { this.leaf.updateHeader && this.leaf.updateHeader(); this.drawCrumbs(); } }));
    this.saveSoon = debounce(() => this.doSave(), 500);
    if (!this.file) setKids(this.root, h('div', { class: 'wkm-empty' }, 'Open a map from the Maps library.'));
  }
  async onClose() { if (this.saveSoon) await this.saveSoon.flush(); }
  async openMapFile(f) {
    if (this.file && this.file.path !== f.path && this.saveSoon) await this.saveSoon.flush();
    this.file = f; this.d = await M.read(f); this.undo = []; this.redo = []; this.sel = new Set(); this.draft = null; this.lastSaved = M.serialize(this.d);
    this.leaf.updateHeader && this.leaf.updateHeader();
    this.build();
    try { this.img = await loadMapImage(f); } catch (e) { this.img = null; this.imgErr = e.message || String(e); }
    this.stage.setImage(this.img); this.draw(); requestAnimationFrame(() => { this.stage.fit(); this.applyFocus(); });
    if (!this.img) ap(this.stageWrap, h('div', { class: 'wkm-noimg' }, h('p', {}, this.imgErr ? '⚠ ' + this.imgErr : 'This map has no image yet.'), h('button', { class: 'mod-cta', onclick: () => this.changeImage() }, 'Choose an image or PDF')));
  }
  focusOn(path) { this.focusPath = path; this.applyFocus(); }
  applyFocus() {
    if (!this.focusPath || !this.d) return; const f = app().vault.getAbstractFileByPath(this.focusPath); if (!f) return;
    const hits = M.hitsFor(this.d, this.file, f); if (!hits.length) return;
    this.sel = new Set(hits.map((x) => x.id)); const c = hits.flatMap((x) => x.pts || [[x.x, x.y]]);
    this.stage.focusBox(Math.min(...c.map((p) => p[0])), Math.min(...c.map((p) => p[1])), Math.max(...c.map((p) => p[0])), Math.max(...c.map((p) => p[1])));
    this.draw(); this.drawPanel(); setTimeout(() => this.stage.flash(hits.map((x) => x.id)), 60); this.focusPath = null;
  }
  async externalChange() {
    if (this.saving) return; const txt = await readNote(this.file); const nd = M.parse(txt); const ser = M.serialize(nd);
    if (ser === this.lastSaved) return; this.d = nd; this.lastSaved = ser; this.draw(); this.drawPanel();
  }
  async doSave() { if (!this.file || !this.d) return; const ser = M.serialize(this.d); if (ser === this.lastSaved) return; this.saving = true; try { await M.write(this.file, this.d); this.lastSaved = ser; } finally { setTimeout(() => { this.saving = false; }, 300); } }
  /** record an undo step, apply a change, redraw, save */
  change(fn, { panel = true } = {}) { this.undo.push(M.serialize(this.d)); if (this.undo.length > 100) this.undo.shift(); this.redo = []; fn(this.d); this.draw(); if (panel) this.drawPanel(); this.saveSoon(); }
  /** a change while typing or dragging a slider: no undo step per keystroke, no panel rebuild */
  live(fn) { if (!this._liveSnap) { this._liveSnap = M.serialize(this.d); setTimeout(() => { if (this._liveSnap) { this.undo.push(this._liveSnap); this.redo = []; this._liveSnap = null; } }, 800); } fn(this.d); this.draw(); this.saveSoon(); }
  doUndo() { if (!this.undo.length) return; this.redo.push(M.serialize(this.d)); this.d = M.parse('```worldkeeper-map\n' + this.undo.pop() + '\n```'); this.sel = new Set([...this.sel].filter((id) => this.d.items.some((x) => x.id === id))); this.draw(); this.drawPanel(); this.saveSoon(); }
  doRedo() { if (!this.redo.length) return; this.undo.push(M.serialize(this.d)); this.d = M.parse('```worldkeeper-map\n' + this.redo.pop() + '\n```'); this.draw(); this.drawPanel(); this.saveSoon(); }
  item(id) { return this.d.items.find((x) => x.id === id); }
  selItems() { return [...this.sel].map((id) => this.item(id)).filter(Boolean); }

  /* ---------- layout ---------- */
  build() {
    this.root.replaceChildren();
    this.crumbs = h('div', { class: 'wkm-crumbs' });
    this.bar = h('div', { class: 'wkm-bar' }); this.optBar = h('div', { class: 'wkm-optbar' });
    this.stageWrap = h('div', { class: 'wkm-stage-wrap' }); this.panel = h('div', { class: 'wkm-panel' });
    this.pop = h('div', { class: 'wkm-popover', style: { display: 'none' } });
    this.pop.addEventListener('pointerdown', (e) => e.stopPropagation()); this.pop.addEventListener('wheel', (e) => e.stopPropagation());
    this.readout = h('div', { class: 'wkm-readout', style: { display: 'none' } });
    this.zoomEl = h('span', { class: 'wkm-zoom' });
    this.body = h('div', { class: 'wkm-body' + (this.panelOpen() ? '' : ' is-closed') }, this.stageWrap, this.panel);
    ap(this.root, this.crumbs, h('div', { class: 'wkm-toolcard' }, this.bar, this.optBar), this.body);
    this.stage = new Stage(this.stageWrap, { interactive: true }); ap(this.stageWrap, this.readout, this.pop);
    this.stage.onZoom = (z) => { this.zoomEl.textContent = Math.round(z * 100) + '%'; this.placePop(); };
    this.bindStage(); this.bindKeys();
    this.drawCrumbs(); this.drawBar(); this.drawOpts(); this.drawPanel();
  }
  drawCrumbs() {
    if (!this.crumbs) return; const chain = []; let cur = M.parent(this.file); const seen = new Set([this.file.path]);
    while (cur && !seen.has(cur.path)) { seen.add(cur.path); chain.unshift(cur); cur = M.parent(cur); }
    const kids = M.children(this.file); const of = M.resolve(M.fm(this.file)['map-of'], this.file.path);
    const trail = h('div', { class: 'wkm-trail' }, h('a', { onclick: () => P.openMaps() }, '🧭 Wayfinder'), ...chain.map((m) => [h('span', {}, '›'), h('a', { onclick: () => this.openMapFile(m) }, m.basename)]));
    setKids(this.crumbs, h('div', { class: 'wkm-head-l' }, trail, h('div', { class: 'wkm-title-row' }, h('h2', { class: 'wkm-title' }, this.file.basename),
      of ? h('button', { class: 'apill', title: 'This map shows ' + of.basename, onclick: (e) => openFile(of, e) }, h('span', {}, noteIcon(of)), of.basename) : null)),
      kids.length ? h('div', { class: 'wkm-kids' }, h('span', { class: 'wkm-hint' }, 'Maps inside'), ...kids.map((k) => h('button', { class: 'apill', onclick: () => this.openMapFile(k) }, h('span', {}, '⤵'), k.basename))) : null);
  }
  drawBar() {
    const tb = (id, ic, tip) => h('button', { class: 'wkm-tool' + (this.tool === id ? ' is-on' : ''), title: tip, onclick: () => this.setTool(id) }, h('span', {}, ic));
    setKids(this.bar, h('div', { class: 'wkm-tools' }, ...TOOLS.map(([id, ic, tip]) => tb(id, ic, tip))),
      h('div', { class: 'wkm-tools' }, h('button', { class: 'wkm-tool', title: 'Pin a note: pick a character, place or entry, then click the map', onclick: () => this.pinANote() }, '＋📄'), h('button', { class: 'wkm-tool', title: 'Undo (Ctrl+Z)', onclick: () => this.doUndo() }, '↶'), h('button', { class: 'wkm-tool', title: 'Redo (Ctrl+Shift+Z)', onclick: () => this.doRedo() }, '↷')),
      h('span', { class: 'wkm-sp' }),
      h('div', { class: 'wkm-tools' }, h('button', { class: 'wkm-tool', title: 'Zoom out', onclick: () => this.stage.zoomBy(1 / 1.3) }, '−'), this.zoomEl, h('button', { class: 'wkm-tool', title: 'Zoom in', onclick: () => this.stage.zoomBy(1.3) }, '+'), h('button', { class: 'wkm-tool', title: 'Fit the whole map', onclick: () => this.stage.fit() }, '⤢')),
      h('button', { class: 'mod-cta wkm-export', onclick: () => openExport(this.file, this.d, this.img) }, '⤓ Export'),
      h('button', { class: 'wkm-tool wkm-gear' + (this.panelOpen() ? ' is-on' : ''), title: this.panelOpen() ? 'Hide map settings' : 'Map settings: image, scale, layers, linked notes, everything on the map', onclick: () => this.togglePanel() }, '⚙'));
  }
  drawOpts() {
    const o = this.optBar; o.replaceChildren(); const t = this.tool;
    const tip = (x) => h('span', { class: 'wkm-hint' }, x);
    if (t === 'select') ap(o, tip('Click to select · Shift-click to add · drag to move · drag a line’s dots to reshape, double-click a line to add a dot · Delete removes · drag the background to pan, scroll to zoom'));
    if (t === 'pin') {
      ap(o, iconPalette(this.opt.icon, (k) => { if (k === 'emoji') mPrompt('Symbol for these pins', 'An emoji, e.g. 🐉', (v) => { this.opt.icon = 'emoji'; this.opt.emoji = [...v][0]; this.drawOpts(); }, this.opt.emoji || ''); else { this.opt.icon = k; this.drawOpts(); } }, this.opt.emoji), tip('Click the map to place a ' + (this.opt.icon === 'emoji' ? 'marker' : ((iconDef(this.opt.icon) || ICONS.poi).label).toLowerCase())));
    }
    if (t === 'line' || t === 'area') {
      const set = t === 'line' ? LINES : AREAS; const key = t === 'line' ? 'line' : 'area';
      ap(o, h('div', { class: 'wkm-seg' }, ...Object.entries(set).map(([k, p]) => h('button', { class: this.opt[key] === k ? 'is-on' : '', onclick: () => { this.opt[key] = k; this.drawOpts(); } }, h('i', { style: { background: p.color } }), p.label))),
        tip(t === 'line' ? 'Click to add points · double-click or Enter to finish · Backspace removes the last point · Esc cancels' : 'Click around the area · double-click or Enter to close it · Esc cancels'));
    }
    if (t === 'label') ap(o, h('div', { class: 'wkm-seg' }, ...Object.entries(LABELS).map(([k, p]) => h('button', { class: this.opt.label === k ? 'is-on' : '', onclick: () => { this.opt.label = k; this.drawOpts(); } }, h('span', { style: { 'font-style': p.italic ? 'italic' : '', 'text-transform': p.caps ? 'uppercase' : '', 'letter-spacing': p.spacing ? '1px' : '', color: p.color, 'font-family': p.font === 'sans' ? '' : 'Georgia, serif' } }, p.label)))), tip('Click where the label goes'));
    if (t === 'note') ap(o, h('div', { class: 'wkm-swatches' }, ...NOTE_COLORS.map((c) => h('button', { class: 'wkm-sw' + (this.opt.note === c ? ' is-on' : ''), style: { background: c }, onclick: () => { this.opt.note = c; this.drawOpts(); } }))), tip('Click to stick a note on the map'));
    if (t === 'measure') ap(o, tip(this.d.scale ? 'Click points to measure · double-click or Enter to finish · Esc clears' : 'Set the scale first (⚖) to measure real distances. Until then, distances show in map units.'));
    if (t === 'scale') ap(o, tip('Click both ends of something whose length you know, such as the map’s own scale bar, then enter its length.'), this.d.scale ? h('span', { class: 'wkm-pill' }, `Current: ${fmtD(MAP_W / this.d.scale.per)} ${this.d.scale.unit} across`) : null);
  }
  setTool(t) { if (t !== 'select' && this.sel && this.sel.size && !this.pending) { this.sel = new Set(); this.draw(); this.drawPanel(); } this.tool = t; this.draft = null; this.readout.style.display = 'none'; this.stage.el.dataset.tool = t; this.drawBar(); this.drawOpts(); this.drawDraft(); }

  /* ---------- drawing ---------- */
  draw() { this.stage.selected = this.sel; this.stage.render(this.d); this.drawHandles(); this.drawDraft(); }
  drawHandles() {
    const top = this.stage.top; top.replaceChildren();
    for (const it of this.selItems()) {
      if (it.pts) it.pts.forEach((p, i) => ap(top, s('circle', { cx: p[0], cy: p[1], r: 5, class: 'wkm-handle', 'data-vi': i, 'data-hid': it.id })));
      else if (it.k !== 'note' || !it.open) { const r = it.k === 'pin' ? ((it.size || 1) * (this.d.pinSize || MS().pinSize)) * 0.62 : 10; ap(top, s('circle', { cx: it.x, cy: it.y, r, class: 'wkm-selring' })); }
    }
    this.stage.svg.append(top);
  }
  drawDraft() {
    const top = this.stage.top; top.querySelectorAll('.wkm-draft').forEach((x) => x.remove()); const dr = this.draft; if (!dr) return;
    const pts = dr.hover ? [...dr.pts, dr.hover] : dr.pts; if (!pts.length) return;
    const g = s('g', { class: 'wkm-draft' });
    const col = dr.kind === 'line' ? (LINES[this.opt.line] || LINES.custom).color : dr.kind === 'area' ? (AREAS[this.opt.area] || AREAS.custom).color : dr.kind === 'scale' ? '#e0457b' : '#1f8fff';
    ap(g, s('path', { d: straightPath(pts, dr.kind === 'area'), fill: dr.kind === 'area' ? col : 'none', 'fill-opacity': 0.12, stroke: col, 'stroke-width': 2.5 / Math.max(0.4, this.stage.z) + 0.5, 'stroke-dasharray': dr.kind === 'measure' || dr.kind === 'scale' ? '6 4' : null }));
    dr.pts.forEach((p) => ap(g, s('circle', { cx: p[0], cy: p[1], r: 3.5, fill: '#fff', stroke: col, 'stroke-width': 1.5 })));
    top.append(g);
    if (dr.kind === 'measure' || dr.kind === 'scale' || dr.kind === 'line') {
      const L = pathLen(pts, false); const real = fmtDist(L, this.d.scale);
      this.readout.style.display = ''; setKids(this.readout, h('b', {}, real || `${fmtD(L)} map units`), dr.kind === 'measure' && real ? h('span', {}, travelTimes(L, this.d.scale).slice(0, 2).map((t) => `${t.name}: ${fmtDays(t.days)}`).join(' · ')) : null,
        dr.kind === 'measure' && dr.done ? h('button', { class: 'wkm-sm', onclick: () => { const p = dr.pts.slice(); this.draft = null; this.readout.style.display = 'none'; this.addLine('line', p); } }, 'Save as route') : null);
    }
  }

  /* ---------- pointer handling ---------- */
  bindStage() {
    const st = this.stage; let drag = null;
    st.bindPointers({
      panIf: (e) => this.tool === 'select' || e.button === 1 || e.shiftKey && this.tool !== 'select' || e.pointerType === 'touch' && this.tool === 'select',
      down: (e) => {
        if (e.button !== 0) return false; st.el.focus({ preventScroll: true });
        const p = st.toMap(e.clientX, e.clientY);
        if (this.tool === 'select') {
          const hd = e.target.closest && e.target.closest('[data-vi]');
          if (hd) { const it = this.item(hd.getAttribute('data-hid')); drag = { kind: 'vertex', it, vi: +hd.getAttribute('data-vi'), snap: M.serialize(this.d) }; return true; }
          const t = e.target.closest && e.target.closest('[data-id]');
          if (t) {
            const id = t.getAttribute('data-id');
            if (e.shiftKey) { this.sel.has(id) ? this.sel.delete(id) : this.sel.add(id); } else if (!this.sel.has(id)) this.sel = new Set([id]);
            this.draw(); this.drawPanel();
            drag = { kind: 'move', start: p, orig: this.selItems().map((it) => ({ it, x: it.x, y: it.y, pts: it.pts ? it.pts.map((q) => q.slice()) : null })), snap: M.serialize(this.d) };
            return true;
          }
          return false;
        }
        return true;
      },
      move: (e) => {
        const p = this.stage.toMap(e.clientX, e.clientY);
        if (drag) this.pop.classList.add('is-dragging');
        if (drag && drag.kind === 'vertex') { drag.it.pts[drag.vi] = [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]; drag.moved = true; this.draw(); return; }
        if (drag && drag.kind === 'move') { const dx = p[0] - drag.start[0], dy = p[1] - drag.start[1]; for (const o of drag.orig) { if (o.pts) o.it.pts = o.pts.map((q) => [Math.round((q[0] + dx) * 10) / 10, Math.round((q[1] + dy) * 10) / 10]); else { o.it.x = Math.round((o.x + dx) * 10) / 10; o.it.y = Math.round((o.y + dy) * 10) / 10; } } drag.moved = true; this.draw(); return; }
        if (this.draft && !this.draft.done) { this.draft.hover = p; this.drawDraft(); }
      },
      up: (e, moved, wasPan) => {
        if (drag) { this.pop.classList.remove('is-dragging'); if (drag.moved) { this.undo.push(drag.snap); this.redo = []; this.saveSoon(); this.drawPanel(); } drag = null; return; }
        if (wasPan) { if (!moved && this.tool === 'select' && this.sel.size) { this.sel = new Set(); this.draw(); this.drawPanel(); } return; }
        if (moved || e.button !== 0) return;
        // our own double-click: the dot drawn under the pointer after the first click stops the browser's from firing
        const now = Date.now(); const lc = this._lastClick; this._lastClick = { t: now, x: e.clientX, y: e.clientY };
        if (lc && now - lc.t < 400 && Math.hypot(e.clientX - lc.x, e.clientY - lc.y) < 8 && this.draft && ['line', 'area', 'measure'].includes(this.draft.kind)) { this._lastClick = null; this.finishDraft(); return; }
        this.click(this.stage.toMap(e.clientX, e.clientY), e);
      },
    });
    st.el.addEventListener('dblclick', (e) => {
      if (this.draft && (this.draft.kind === 'line' || this.draft.kind === 'area' || this.draft.kind === 'measure')) { e.preventDefault(); this.finishDraft(); return; }
      if (this.tool !== 'select') return;
      const t = e.target.closest && e.target.closest('[data-id]'); const it = t && this.item(t.getAttribute('data-id'));
      if (it && it.pts) { const p = this.stage.toMap(e.clientX, e.clientY); const i = nearestSeg(it.pts, p, it.k === 'area'); this.change(() => { it.pts.splice(i + 1, 0, [Math.round(p[0]), Math.round(p[1])]); }); }
      else if (it && (it.k === 'label' || it.k === 'note')) this.editText(it);
    });
    st.el.addEventListener('contextmenu', (e) => {
      e.preventDefault(); const hd = e.target.closest && e.target.closest('[data-vi]');
      if (hd) { const it = this.item(hd.getAttribute('data-hid')); const vi = +hd.getAttribute('data-vi'); if (it.pts.length > (it.k === 'area' ? 3 : 2)) this.change(() => it.pts.splice(vi, 1)); return; }
      const t = e.target.closest && e.target.closest('[data-id]'); if (!t) return; const it = this.item(t.getAttribute('data-id')); if (!it) return;
      if (!this.sel.has(it.id)) { this.sel = new Set([it.id]); this.draw(); this.drawPanel(); }
      const menu = new Menu(); const ln = it.link && M.resolve(it.link, this.file.path); const sub = it.map && M.resolve(it.map, this.file.path);
      if (ln) menu.addItem((i) => i.setTitle(`Open ${ln.basename}`).setIcon('file-text').onClick(() => openFile(ln)));
      if (sub) menu.addItem((i) => i.setTitle(`Open map: ${sub.basename}`).setIcon('map').onClick(() => this.openMapFile(sub)));
      menu.addItem((i) => i.setTitle('Duplicate').setIcon('copy').onClick(() => this.duplicate()));
      menu.addItem((i) => i.setTitle('Bring to front').setIcon('arrow-up').onClick(() => this.change((d) => { d.items = [...d.items.filter((x) => !this.sel.has(x.id)), ...this.selItems()]; })));
      menu.addItem((i) => i.setTitle('Send to back').setIcon('arrow-down').onClick(() => this.change((d) => { d.items = [...this.selItems(), ...d.items.filter((x) => !this.sel.has(x.id))]; })));
      menu.addItem((i) => i.setTitle('Delete').setIcon('trash').onClick(() => this.deleteSel()));
      menu.showAtMouseEvent(e);
    });
  }
  bindKeys() {
    this.stage.el.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, select')) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? this.doRedo() : this.doUndo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); this.doRedo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); this.duplicate(); return; }
      if (e.key === 'Escape') { if (this.draft) { this.draft = null; this.readout.style.display = 'none'; this.drawDraft(); } else if (this.sel.size) { this.sel = new Set(); this.draw(); this.drawPanel(); } return; }
      if (e.key === 'Enter' && this.draft) { e.preventDefault(); this.finishDraft(); return; }
      if (e.key === 'Backspace' && this.draft && this.draft.pts.length) { e.preventDefault(); this.draft.pts.pop(); this.drawDraft(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel.size) { e.preventDefault(); this.deleteSel(); return; }
      if (e.key.startsWith('Arrow') && this.sel.size) { e.preventDefault(); const st = e.shiftKey ? 10 : 1; const dx = e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, dy = e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0; this.change(() => { for (const it of this.selItems()) { if (it.pts) it.pts = it.pts.map((p) => [p[0] + dx, p[1] + dy]); else { it.x += dx; it.y += dy; } } }, { panel: false }); return; }
      const tool = TOOLS.find((x) => x[3] === k); if (tool && !e.ctrlKey && !e.metaKey && !e.altKey) this.setTool(tool[0]);
    });
  }
  click(p, e) {
    const [x, y] = [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
    if (x < -50 || y < -50 || x > MAP_W + 50 || y > this.stage.H + 50) return;
    const t = this.tool;
    if (t === 'pin') { const it = { id: uid(), k: 'pin', x, y, icon: this.opt.icon, name: '' }; if (this.opt.icon === 'emoji') it.emoji = this.opt.emoji || '★'; if (this.pending) { Object.assign(it, this.pending); this.pending = null; } this.change((d) => d.items.push(it)); this.sel = new Set([it.id]); this.draw(); this.drawPanel(); if (!it.name) setTimeout(() => this.pop.querySelector('.wkm-name')?.focus(), 30); if (it.link) this.setTool('select'); return; }
    if (t === 'label') { mPrompt('Label text', 'e.g. The Northmarch', (v) => { const it = { id: uid(), k: 'label', x, y, text: v, style: this.opt.label }; this.change((d) => d.items.push(it)); this.sel = new Set([it.id]); this.draw(); this.drawPanel(); }, '', { multiline: false }); return; }
    if (t === 'note') { mPrompt('Note', 'What should this note say?', (v) => { const it = { id: uid(), k: 'note', x, y, text: v, color: this.opt.note, open: false }; this.change((d) => d.items.push(it)); this.sel = new Set([it.id]); this.draw(); this.drawPanel(); }, '', { multiline: true, ok: 'Add note' }); return; }
    if (t === 'line' || t === 'area' || t === 'measure' || t === 'scale') {
      if (!this.draft || this.draft.done) this.draft = { kind: t, pts: [] };
      this.draft.pts.push([x, y]);
      if (t === 'scale' && this.draft.pts.length === 2) { this.finishDraft(); return; }
      this.drawDraft();
    }
  }
  finishDraft() {
    const dr = this.draft; if (!dr) return; const pts = dr.pts.filter((p, i, a) => i === 0 || dist(p, a[i - 1]) > 0.5);
    if (dr.kind === 'measure') { if (pts.length < 2) return; dr.done = true; dr.hover = null; dr.pts = pts; this.drawDraft(); return; }
    this.draft = null; this.readout.style.display = 'none'; this.drawDraft();
    if (dr.kind === 'scale') { if (pts.length < 2) return; this.askScale(dist(pts[0], pts[1])); return; }
    if (dr.kind === 'line' && pts.length >= 2) this.addLine('line', pts);
    if (dr.kind === 'area' && pts.length >= 3) this.addLine('area', pts);
  }
  addLine(kind, pts) {
    const it = { id: uid(), k: kind, pts, style: kind === 'line' ? (this.tool === 'line' ? this.opt.line : 'route') : this.opt.area, name: '' };
    this.change((d) => d.items.push(it)); this.sel = new Set([it.id]); this.draw(); this.drawPanel();
  }
  askScale(len) {
    const val = h('input', { type: 'number', min: 0, step: 'any', placeholder: 'e.g. 100', class: 'wkm-num' });
    const unit = h('select', { class: 'dropdown' }, ...Object.entries(UNITS).map(([k, l]) => h('option', { value: k, selected: k === ((this.d.scale && this.d.scale.unit) || MS().defaultUnit) }, l)));
    const ok = () => { const v = Number(val.value); if (!(v > 0)) { val.focus(); return; } close(); this.change((d) => { d.scale = { per: len / v, unit: unit.value }; }); toast(`Scale set: the map is ${fmtD(MAP_W / (len / v))} ${unit.value} across`); this.setTool('select'); };
    const box = h('div', { class: 'wkm-suggest' }, h('div', { class: 'wkm-sg-title' }, 'How long is the line you drew?'), h('div', { class: 'wkm-row' }, val, unit), h('p', { class: 'wkm-hint' }, 'Tip: draw along the map’s own scale bar for the most accurate result. Every distance on this map is worked out from this.'),
      h('div', { class: 'wkm-sg-foot' }, h('button', { class: 'mod-cta', onclick: ok }, 'Set scale')));
    const close = mModal(box); val.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); }); setTimeout(() => val.focus(), 0);
  }
  pinANote() {
    pickNote('Pin which note?', (f) => {
      const t = WK.typeOf(f); this.pending = { name: f.basename, link: M.link(f, this.file.path), icon: ICON_FOR_TYPE[t] || (WK.isEntry(f) ? 'poi' : 'poi') };
      if (M.isMap(f)) Object.assign(this.pending, { map: M.link(f, this.file.path), icon: 'flag', link: undefined });
      this.opt.icon = this.pending.icon; this.setTool('pin'); toast(`Click the map to place ${f.basename}`);
    }, { exclude: [this.file] });
  }
  duplicate() { const items = this.selItems(); if (!items.length) return; const copies = items.map((it) => { const c = clone(it); c.id = uid(); if (c.pts) c.pts = c.pts.map((p) => [p[0] + 12, p[1] + 12]); else { c.x += 12; c.y += 12; } return c; }); this.change((d) => d.items.push(...copies)); this.sel = new Set(copies.map((c) => c.id)); this.draw(); this.drawPanel(); }
  deleteSel() { const n = this.sel.size; if (!n) return; this.change((d) => { d.items = d.items.filter((x) => !this.sel.has(x.id)); }); this.sel = new Set(); this.draw(); this.drawPanel(); toast(`Deleted ${n} item${n === 1 ? '' : 's'} · Ctrl+Z to undo`); }
  editText(it) { mPrompt(it.k === 'note' ? 'Edit note' : 'Edit label', '', (v) => this.change(() => { it.text = v; }), it.text || '', { multiline: it.k === 'note' }); }
  async changeImage() {
    chooseMapImage(async (f) => {
      await app().fileManager.processFrontMatter(this.file, (x) => { x['map-image'] = M.link(f, this.file.path); if (f.extension.toLowerCase() !== 'pdf') delete x['map-page']; else x['map-page'] = x['map-page'] || 1; });
      setTimeout(() => this.openMapFile(this.file), 150);
    });
  }

  /* ---------- side panel ---------- */
  /** the ⚙ map settings side bar (closed unless you open it) and the pop-up for the selected item */
  panelOpen() { return !!(MS().view && MS().view.panel); }
  togglePanel() { MS().view = Object.assign({}, MS().view, { panel: !this.panelOpen() }); P.saveSettingsQuiet(); this.body.classList.toggle('is-closed', !this.panelOpen()); this.drawBar(); this.drawPanel(); requestAnimationFrame(() => this.placePop()); }
  drawPanel() {
    if (!this.panel || !this.d) return; const items = this.selItems();
    if (this.panelOpen()) setKids(this.panel, this.mapPanel()); else this.panel.replaceChildren();
    if (!items.length) { this.pop.style.display = 'none'; this.pop.replaceChildren(); return; }
    setKids(this.pop, items.length === 1 ? this.inspector(items[0]) : this.multiPanel(items));
    this.pop.style.display = ''; this.placePop();
  }
  /** keep the pop-up beside the selected item, inside the map area */
  placePop() {
    if (!this.pop || this.pop.style.display === 'none') return; const items = this.selItems(); if (!items.length) return;
    const pts = items.flatMap((x) => x.pts || [[x.x, x.y]]); const st = this.stage;
    const xs = pts.map((p) => p[0] * st.z + st.tx), ys = pts.map((p) => p[1] * st.z + st.ty);
    const W = this.stageWrap.clientWidth, Hh = this.stageWrap.clientHeight; const pw = this.pop.offsetWidth || 300, ph = this.pop.offsetHeight || 300;
    if (W < 560) { this.pop.style.left = ''; this.pop.style.top = ''; this.pop.classList.add('is-sheet'); return; } this.pop.classList.remove('is-sheet');
    let x = Math.max(...xs) + 24; if (x + pw > W - 8) x = Math.min(...xs) - pw - 24; x = clamp(x, 8, Math.max(8, W - pw - 8));
    const y = clamp((Math.min(...ys) + Math.max(...ys)) / 2 - ph / 2, 8, Math.max(8, Hh - ph - 8));
    this.pop.style.left = x + 'px'; this.pop.style.top = y + 'px';
  }
  section(title, ...kids) { return h('section', { class: 'wkm-sec' }, title ? h('h4', { class: 'wkm-sec-h' }, title) : null, ...kids); }
  switchRow(label, on, cb, extra = null) { const b = h('button', { class: 'wk-toggle' + (on ? ' is-on' : ''), onclick: () => cb(!on) }); return h('div', { class: 'wkm-switch', onclick: (e) => { if (e.target !== b) b.click(); } }, h('div', {}, h('span', {}, label)), extra, b); }
  field(label, ...kids) { return h('label', { class: 'wkm-f' }, h('span', {}, label), ...kids); }
  noteChip(v, onX, src) { const f = M.resolve(v, src || this.file.path); return h('span', { class: 'wkm-chip' + (f ? '' : ' is-missing'), title: f ? f.path : 'No note with this name yet' }, h('span', { class: 'wkm-chip-l', onclick: (e) => (f ? openFile(f, e) : openName(linkName(v), this.file.path)) }, `${noteIcon(f)} ${mDisplay(v)}`), onX ? h('span', { class: 'wkm-x', title: 'Remove', onclick: onX }, '✕') : null); }
  mapPanel() {
    const fm = M.fm(this.file); const d = this.d; const of = fm['map-of']; const parent = fm['map-parent'];
    const setFm = (k, v) => app().fileManager.processFrontMatter(this.file, (x) => { if (v == null) delete x[k]; else x[k] = v; });
    const wrap = h('div', {}, h('div', { class: 'wkm-panel-h' }, h('b', {}, '⚙ Map settings'), h('span', { class: 'wkm-sp' }), h('button', { class: 'wkm-iconbtn', title: 'Close', onclick: () => this.togglePanel() }, '✕')));
    const img = M.imageFile(this.file);
    ap(wrap, this.section('🗺 Map', h('div', { class: 'wkm-kv' }, h('span', {}, 'Image'), h('span', {}, img ? img.name : '—'), h('button', { class: 'wkm-sm', onclick: () => this.changeImage() }, 'Change')),
      this.img && this.img.pdf ? h('div', { class: 'wkm-kv' }, h('span', {}, 'PDF page'), ((i) => { i.addEventListener('change', async () => { await setFm('map-page', clamp(+i.value || 1, 1, this.img.pages)); setTimeout(() => this.openMapFile(this.file), 150); }); return i; })(h('input', { type: 'number', min: 1, max: this.img.pages, value: fm['map-page'] || 1, class: 'wkm-num' })), h('span', { class: 'wkm-hint' }, `of ${this.img.pages}`)) : null,
      h('div', { class: 'wkm-kv' }, h('span', {}, 'Shows'), of ? this.noteChip(of, () => setFm('map-of', null)) : h('span', { class: 'wkm-hint' }, 'Not set'), h('button', { class: 'wkm-sm', title: 'The place this map shows: a planet, continent, kingdom, place…', onclick: () => pickNote('This map shows…', (f) => setFm('map-of', M.link(f, this.file.path)), { exclude: [this.file] }) }, of ? 'Change' : 'Set')),
      h('div', { class: 'wkm-kv' }, h('span', {}, 'Inside map'), parent ? this.noteChip(parent, () => setFm('map-parent', null)) : h('span', { class: 'wkm-hint' }, 'None (top level)'), h('button', { class: 'wkm-sm', title: 'A bigger map this one is part of', onclick: () => pickNote('This map sits inside…', (f) => setFm('map-parent', M.link(f, this.file.path)), { onlyMaps: true, exclude: [this.file] }) }, parent ? 'Change' : 'Set'))));
    ap(wrap, this.section('🔗 Linked notes', h('div', { class: 'wkm-chips' }, ...arr(d.linked).map((v, i) => this.noteChip(v, () => this.change((dd) => dd.linked.splice(i, 1)))), h('button', { class: 'wkm-add', title: 'Link a note: character, encyclopedia entry, place…', onclick: () => pickNote('Link a note to this map', (f) => this.change((dd) => { dd.linked = [...arr(dd.linked), M.link(f, this.file.path)]; }), { exclude: [this.file] }) }, '+')),
      h('div', { class: 'wkm-hint' }, 'Linked notes, and every note a pin or line links to, list this map on their own page.')));
    const sc = d.scale;
    ap(wrap, this.section('📏 Scale', sc ? h('div', { class: 'wkm-kv' }, h('span', {}, 'Map width'), h('b', {}, `${fmtD(MAP_W / sc.per)} ${unitName(sc.unit)}`)) : h('div', { class: 'wkm-hint' }, 'No scale yet. Set one to measure distances and travel times.'),
      h('div', { class: 'wkm-row' }, h('button', { class: 'wkm-sm', onclick: () => this.setTool('scale') }, '⚖ Set by drawing'), h('button', { class: 'wkm-sm', onclick: () => mPrompt('How wide is the whole map?', 'e.g. 600', (v) => { const n = Number(v); if (n > 0) this.change((dd) => { dd.scale = { per: MAP_W / n, unit: (dd.scale && dd.scale.unit) || MS().defaultUnit }; }); }) }, 'Set by width'),
        sc ? h('select', { class: 'dropdown wkm-sm', onchange: (e) => this.change((dd) => { dd.scale.unit = e.target.value; }) }, ...Object.entries(UNITS).map(([k, l]) => h('option', { value: k, selected: k === sc.unit }, l))) : null,
        sc ? h('button', { class: 'wkm-sm', title: 'Remove the scale', onclick: () => this.change((dd) => { dd.scale = null; }) }, '✕') : null)));
    const ps = h('input', { type: 'range', min: 12, max: 60, value: d.pinSize || MS().pinSize }); ps.addEventListener('input', () => this.live((dd) => { dd.pinSize = +ps.value; }));
    const namesOn = d.showNames ?? MS().showNames;
    ap(wrap, this.section('🎨 Display', this.field('Pin size', ps), this.switchRow('Show pin names', namesOn, (v) => this.change((dd) => { dd.showNames = v; }))),
      this.section('🗂 Layers', ...Object.entries(LAYER_NAMES).map(([k, l]) => { const n = d.items.filter((x) => KIND_LAYER[x.k] === k).length; return this.switchRow(l, !(d.hidden || {})[k], (v) => this.change((dd) => { dd.hidden = Object.assign({}, dd.hidden, { [k]: !v }); }), h('span', { class: 'wkm-n' }, String(n))); })));
    // items list
    const list = h('div', { class: 'wkm-items' }); const q = h('input', { type: 'search', placeholder: 'Find on this map…', value: this.q, class: 'wkm-search' });
    const fill = () => { const qq = this.q.toLowerCase(); setKids(list, ...d.items.filter((it) => !qq || (itemTitle(it) + ' ' + (it.desc || '') + ' ' + mDisplay(it.link || '')).toLowerCase().includes(qq)).map((it) => h('div', { class: 'wkm-item', onclick: () => { this.sel = new Set([it.id]); const c = it.pts || [[it.x, it.y]]; this.stage.focusBox(Math.min(...c.map((p) => p[0])), Math.min(...c.map((p) => p[1])), Math.max(...c.map((p) => p[0])), Math.max(...c.map((p) => p[1]))); this.draw(); this.drawPanel(); this.stage.flash([it.id]); } },
      h('span', { class: 'wkm-item-ic' }, it.k === 'pin' ? iconSvg(it.icon, 16, it) : itemIcon(it)), h('span', { class: 'wkm-item-t' }, itemTitle(it)), it.link ? h('span', { class: 'wkm-item-sub' }, noteIcon(M.resolve(it.link, this.file.path))) : null))); if (!list.children.length) ap(list, h('div', { class: 'wkm-hint' }, d.items.length ? 'Nothing matches.' : 'Nothing on this map yet. Pick a tool above and click the map.')); };
    q.addEventListener('input', () => { this.q = q.value; fill(); }); fill();
    ap(wrap, this.section(`📍 On this map · ${d.items.length}`, q, list));
    ap(wrap, h('div', { class: 'wkm-row wkm-panel-foot' }, h('button', { class: 'wkm-addpill', onclick: () => openFile(this.file) }, '↗ Open map note'), h('button', { class: 'wkm-addpill', onclick: () => P.newMap({ parent: this.file }) }, '＋ Map inside this one')));
    return wrap;
  }
  multiPanel(items) {
    return h('div', {}, this.section(`${items.length} selected`, h('div', { class: 'wkm-hint' }, 'Drag to move them together, or use the arrow keys.'),
      h('div', { class: 'wkm-row' }, h('button', { class: 'wkm-sm', onclick: () => this.duplicate() }, 'Duplicate'), h('button', { class: 'wkm-sm mod-warning', onclick: () => this.deleteSel() }, 'Delete')),
      h('div', { class: 'wkm-items' }, ...items.map((it) => h('div', { class: 'wkm-item', onclick: () => { this.sel = new Set([it.id]); this.draw(); this.drawPanel(); } }, h('span', { class: 'wkm-item-ic' }, itemIcon(it)), h('span', { class: 'wkm-item-t' }, itemTitle(it)))))));
  }
  inspector(it) {
    const wrap = h('div', { class: 'wkm-insp' }); const src = this.file.path;
    const txt = (key, ph, { multi = false, cls = '' } = {}) => { const i = multi ? h('textarea', { rows: 3, placeholder: ph, class: cls }) : h('input', { type: 'text', placeholder: ph, value: it[key] || '', class: cls }); if (multi) i.value = it[key] || ''; i.addEventListener('input', () => this.live(() => { it[key] = i.value; })); i.addEventListener('change', () => this.drawPanelSoon()); return i; };
    const num = (key, min, max, step, def, unit = '') => { const i = h('input', { type: 'range', min, max, step, value: it[key] ?? def }); const out = h('span', { class: 'wkm-n' }, String(it[key] ?? def) + unit); i.addEventListener('input', () => { out.textContent = i.value + unit; this.live(() => { it[key] = +i.value; }); }); return h('div', { class: 'wkm-range' }, i, out); };
    const color = (def) => { const i = h('input', { type: 'color', value: it.color || def }); i.addEventListener('input', () => this.live(() => { it.color = i.value; })); return h('div', { class: 'wkm-colour' }, i, it.color ? h('button', { class: 'wkm-link', onclick: () => this.change(() => { delete it.color; }) }, 'Reset') : null); };
    const toggle = (key, label, def, hint) => { const on = it[key] ?? def; const b = h('button', { class: 'wk-toggle' + (on ? ' is-on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: () => this.change(() => { it[key] = !on; }) }); return h('div', { class: 'wkm-switch', onclick: (e) => { if (e.target !== b) b.click(); } }, h('div', {}, h('span', {}, label), hint ? h('small', {}, hint) : null), b); };
    const sel = (key, opts, def) => h('select', { class: 'dropdown', onchange: (e) => this.change(() => { it[key] = e.target.value; if (key === 'style') ['color', 'dash', 'width', 'arrow', 'smooth', 'fill', 'size', 'font', 'italic', 'caps', 'spacing'].forEach((k) => delete it[k]); }) }, ...Object.entries(opts).map(([k, l]) => h('option', { value: k, selected: k === (it[key] ?? def) }, typeof l === 'string' ? l : l.label)));
    const f = (label, ...kids) => h('div', { class: 'wkm-field' }, h('label', {}, label), ...kids);
    const two = (...kids) => h('div', { class: 'wkm-2col' }, ...kids);
    const group = (title, ...kids) => h('section', { class: 'wkm-grp' }, title ? h('h4', {}, title) : null, ...kids);
    const linkRow = (label = 'Linked note', hint = null) => f(label, h('div', { class: 'wkm-chips' }, it.link ? this.noteChip(it.link, () => this.change(() => { delete it.link; })) : null,
      h('button', { class: 'wkm-addpill', title: 'Link a note', onclick: () => pickNote('Link to which note?', (ff) => this.change(() => { it.link = M.link(ff, src); if (it.k === 'pin' && !it.name) it.name = ff.basename; if (it.k === 'pin' && !it._iconSet && ICON_FOR_TYPE[WK.typeOf(ff)] && it.icon === 'poi') it.icon = ICON_FOR_TYPE[WK.typeOf(ff)]; }), { exclude: [this.file] }) }, it.link ? '⇄ Change' : '＋ Link a note')), hint ? h('small', { class: 'wkm-hint' }, hint) : null);
    const KIND = { pin: 'Pin', line: 'Line', area: 'Area', label: 'Label', note: 'Note' }[it.k];
    const swatch = it.k === 'pin' ? iconSvg(it.icon, 30, it) : h('span', { class: 'wkm-kind-ic' }, itemIcon(it));
    ap(wrap, h('header', { class: 'wkm-insp-h' }, swatch, h('div', { class: 'wkm-insp-t' }, h('small', {}, KIND), h('b', {}, itemTitle(it))), h('span', { class: 'wkm-sp' }),
      h('button', { class: 'wkm-iconbtn', title: 'Duplicate (Ctrl+D)', onclick: () => this.duplicate() }, '⧉'), h('button', { class: 'wkm-iconbtn is-danger', title: 'Delete', onclick: () => this.deleteSel() }, '🗑'), h('button', { class: 'wkm-iconbtn', title: 'Close', onclick: () => { this.sel = new Set(); this.draw(); this.drawPanel(); } }, '✕')));
    const body = h('div', { class: 'wkm-insp-b' }); ap(wrap, body);
    if (it.k === 'pin') {
      const grid = iconPalette(it.icon, (k) => { if (k === 'emoji') mPrompt('Symbol', 'An emoji, e.g. 🐉', (v) => this.change(() => { it.icon = 'emoji'; it.emoji = [...v][0]; })); else this.change(() => { it.icon = k; it._iconSet = true; delete it.emoji; }); }, it.emoji, true);
      const sub = it.map ? M.resolve(it.map, src) : null;
      ap(body, group(null, f('Name', txt('name', 'e.g. Saltgate', { cls: 'wkm-name' })), linkRow(), f('Description', txt('desc', 'Shown when someone clicks the pin', { multi: true }))),
        group('Appearance', f('Icon', grid), two(f('Colour', color((iconDef(it.icon) || ICONS.poi).color)), f('Size', num('size', 0.5, 2.5, 0.1, 1, '×'))), toggle('hideName', 'Hide the name on the map', false)),
        group('Map of this place', h('div', { class: 'wkm-chips' }, it.map ? this.noteChip(it.map, () => this.change(() => { delete it.map; })) : null,
          sub ? h('button', { class: 'wkm-addpill', onclick: () => this.openMapFile(sub) }, '↗ Open') : null,
          h('button', { class: 'wkm-addpill', title: 'A more detailed map of this spot', onclick: () => pickNote('Open which map from this pin?', (ff) => this.change(() => { it.map = M.link(ff, src); }), { onlyMaps: true, exclude: [this.file] }) }, it.map ? '⇄ Change' : '＋ Pick a map'),
          !it.map ? h('button', { class: 'wkm-addpill', onclick: () => P.newMap({ parent: this.file, name: it.name ? it.name + ' map' : '', of: it.link, fromPin: { view: this, it } }) }, '＋ New map') : null),
          h('small', { class: 'wkm-hint' }, 'Clicking the pin in a map view opens this map.')));
    }
    if (it.k === 'line' || it.k === 'area') {
      const isLine = it.k === 'line'; const pre = isLine ? LINES[it.style] || LINES.custom : AREAS[it.style] || AREAS.custom;
      const L = pathLen(it.pts, !isLine); const real = fmtDist(L, this.d.scale); const travel = isLine && TRAVEL_STYLES.has(it.style || 'custom');
      ap(body, h('div', { class: 'wkm-stat' }, h('div', {}, h('b', {}, real || `${fmtD(L)} map units`), h('span', {}, isLine ? 'long' : 'around the edge')), !this.d.scale ? h('button', { class: 'wkm-addpill', onclick: () => this.setTool('scale') }, '⚖ Set the scale') : null),
        travel && real ? h('div', { class: 'wkm-travel' }, ...travelTimes(L, this.d.scale).map((t) => h('div', {}, h('span', {}, t.name), h('b', {}, fmtDays(t.days))))) : null,
        group(null, two(f('Name', txt('name', isLine ? 'e.g. Ilsa’s flight north' : 'e.g. The Northmarch', { cls: 'wkm-name' })), f('Kind', sel('style', isLine ? LINES : AREAS, 'custom'))), linkRow(),
          travel ? f('Travellers', h('div', { class: 'wkm-chips' }, ...arr(it.chars).map((v, i) => this.noteChip(v, () => this.change(() => it.chars.splice(i, 1)))), h('button', { class: 'wkm-addpill', title: 'The route shows on their page', onclick: () => pickNote('Who travels this route?', (ff) => this.change(() => { it.chars = [...arr(it.chars), M.link(ff, src)]; }), { exclude: [this.file] }) }, '＋ Add'))) : null,
          f('Description', txt('desc', 'Notes about this ' + (isLine ? 'route or border' : 'area'), { multi: true }))),
        group('Style', two(f('Colour', color(pre.color)), f('Line', sel('dash', DASHES, pre.dash))), two(f('Width', num('width', 0.5, 12, 0.5, pre.width)), !isLine ? f('Fill', num('fill', 0, 0.8, 0.02, pre.fill)) : h('div')),
          isLine ? toggle('arrow', 'Arrow at the end', pre.arrow) : null, toggle('smooth', 'Smooth curve', isLine ? pre.smooth : false),
          isLine ? h('button', { class: 'wkm-addpill', onclick: () => this.change(() => { it.pts.reverse(); }) }, '⇄ Reverse direction') : null),
        h('p', { class: 'wkm-hint wkm-foot' }, 'Drag the dots to reshape. Double-click the line to add a dot; right-click a dot to remove it.'));
    }
    if (it.k === 'label') {
      const pre = LABELS[it.style] || LABELS.place;
      ap(body, group(null, f('Text', txt('text', 'Label', { multi: true })), f('Style', sel('style', LABELS, 'place')), linkRow('Links to')),
        group('Lettering', two(f('Size', num('size', 6, 90, 1, pre.size)), f('Rotation', num('rot', -90, 90, 1, 0, '°'))), two(f('Letter spacing', num('spacing', 0, 20, 0.5, pre.spacing)), f('Colour', color(pre.color))),
          f('Font', sel('font', { serif: 'Serif (classic map)', sans: 'Sans-serif' }, pre.font)), toggle('caps', 'Capitals', pre.caps), toggle('italic', 'Italic', pre.italic), toggle('halo', 'Halo', true, 'A soft outline so it reads over busy map areas')));
    }
    if (it.k === 'note') {
      ap(body, group(null, f('Note', txt('text', 'Write your note…', { multi: true })), linkRow('Links to')),
        group('Appearance', f('Colour', h('div', { class: 'wkm-swatches' }, ...NOTE_COLORS.map((c) => h('button', { class: 'wkm-sw' + ((it.color || NOTE_COLORS[0]) === c ? ' is-on' : ''), style: { background: c }, onclick: () => this.change(() => { it.color = c; }) })))),
          toggle('open', 'Show the text on the map', false, 'Off: a numbered marker; the PDF key lists the text'), it.open ? f('Width', num('w', 100, 400, 10, 170)) : null));
    }
    return wrap;
  }
  typingInPanel() { const a = this.containerEl.ownerDocument.activeElement; return !!a && a.tagName !== 'BUTTON' && ((this.panel && this.panel.contains(a)) || (this.pop && this.pop.contains(a))); }
  drawPanelSoon() { clearTimeout(this._pt); this._pt = setTimeout(() => { if (!this.typingInPanel()) this.drawPanel(); }, 50); }
}
function nearestSeg(pts, p, closed) {
  let best = 0, bd = Infinity; const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; const dx = b[0] - a[0], dy = b[1] - a[1]; const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1); const dd = dist(p, [a[0] + t * dx, a[1] + t * dy]); if (dd < bd) { bd = dd; best = i; } }
  return best;
}
/** a pin icon as a small standalone SVG (toolbar, lists) */
/** every pin icon, grouped (built-in and custom), plus "your own emoji" */
function iconPalette(current, onPick, emoji, compact = false) {
  const wrap = h('div', { class: 'wkm-palette' + (compact ? ' is-compact' : '') });
  for (const [g, keys] of iconGroups()) {
    const row = h('div', { class: 'wkm-pal-g', title: g }, compact ? null : h('span', { class: 'wkm-pal-l' }, g));
    for (const k of keys) { const ic = iconDef(k); if (!ic) continue; const b = h('button', { class: 'wkm-ib' + (current === k ? ' is-on' : ''), title: ic.label, onclick: () => onPick(k) }); ap(b, iconSvg(k, 22)); ap(row, b); }
    ap(wrap, row);
  }
  ap(wrap, h('div', { class: 'wkm-pal-g' }, compact ? null : h('span', { class: 'wkm-pal-l' }, 'Other'), h('button', { class: 'wkm-ib' + (current === 'emoji' ? ' is-on' : ''), title: 'Any emoji as a symbol', onclick: () => onPick('emoji') }, emoji || '✱'),
    h('button', { class: 'wkm-ib wkm-pal-add', title: 'Make your own pins, or change these, in Settings → Wayfinder → Pins', onclick: () => openPinSettings() }, '✎')));
  return wrap;
}
/** open Settings at Wayfinder → Pins */
function openPinSettings() {
  if (P.settingTab) P.settingTab.tab = 'maps';
  const st = app().setting; if (!st) return; try { st.open(); st.openTabById && st.openTabById(P.settingTab && P.settingTab.id ? P.settingTab.id : P.manifest.id); } catch (e) { console.error(e); }
  setTimeout(() => { const el = (CP_BOX && CP_BOX.isConnected) ? CP_BOX : P.settingTab && P.settingTab.containerEl.querySelector('.wkm-custom'); el && el.scrollIntoView({ block: 'start' }); }, 300);
}
/** redraw open maps after pins change in settings */
function refreshOpenMaps() { for (const l of app().workspace.getLeavesOfType(VIEW_MAP)) { const v = l.view; if (v && v.d && v.stage) { v.drawOpts(); v.draw(); v.drawPanel(); } } }
function iconSvg(key, size, it = {}) {
  const sv = s('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, class: 'wkm-icsvg' });
  ap(sv, pinGlyph({ x: size / 2, y: size / 2, icon: key, color: it.color, emoji: it.emoji, _glyph: it._glyph, _def: it._def }, size)); return sv;
}
