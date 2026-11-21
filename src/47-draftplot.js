/* =====================================================================
   Plot Weaver · Draft plot
   A scratch canvas per novel, drawn like Obsidian Canvas or a Mermaid flowchart. Its cards are
   deliberately not linked to notes, the board or Draftsmith. Saved in Storyguild's data under
   draftPlots[novelId].
   ===================================================================== */
const DP_COLORS = { grey: '#6b6b74', purple: '#a882ff', amber: '#e0b04f', teal: '#4fb3c9', red: '#e06c6c', green: '#5cb85c', pink: '#d55181' };
const DP_KINDS = [['scene', '▭', 'Scene'], ['event', '⬭', 'Event'], ['choice', '◇', 'Choice'], ['idea', '◯', 'Idea'], ['note', '🗒', 'Sticky note']];
const DP_HELP = 'A scratch space: nothing here is linked to notes, the board or Draftsmith. Double-click (or long-press) empty space for a card · drag a card’s dot onto another card to connect them · double-click a card or arrow to write on it · click a card for shape, colour and group · drag empty space to move around; Ctrl/⌘ + scroll or pinch to zoom.';
const dpId = () => 'd' + Math.random().toString(36).slice(2, 9);
const svgNS = 'http://www.w3.org/2000/svg';

function draftStore(novelId) {
  const all = (SG.data.draftPlots ??= {});
  const s = (all[novelId] ??= { active: '', plots: [] });
  if (!s.plots.length) s.plots.push(newDraftPlot('Draft plot 1'));
  if (!s.plots.some((p) => p.id === s.active)) s.active = s.plots[0].id;
  return s;
}
function newDraftPlot(name) {
  return { id: dpId(), name, layout: 'free', view: null, cards: [{ id: dpId(), t: 'Start here', k: 'event', c: 'purple', x: 300, y: 160 }], edges: [], groups: [] };
}

/** Called by Plot Weaver's view (patch pw:draft-mode) to draw the Draft plot mode. */
function draftPlot(view, main, n) {
  const store = draftStore(n.id);
  if (view._dp && view._dp.novel === n.id && view._dp.isConnected) { main.appendChild(view._dp.root); view._dp.mount(); return; }
  if (view._dp) view._dp.destroy();
  view._dp = new DraftPlotCanvas(view, store, n);
  main.appendChild(view._dp.root); view._dp.mount();
}

class DraftPlotCanvas {
  constructor(view, store, n) {
    this.view = view; this.store = store; this.novel = n.id; this.sel = null; this.picking = null; this.pointers = new Map();
    this.root = el('div', { class: 'sg-dp' }); this.isConnected = true;
    this.save = () => SG.saveSoon(600);
  }
  get P() { return this.store.plots.find((p) => p.id === this.store.active) || this.store.plots[0]; }
  destroy() { this.isConnected = false; this.root.remove(); }

  /* ---------- frame ---------- */
  mount() {
    const P = this.P; this.v = P.view || { x: 40, y: 30, z: 0.85 };
    this.root.replaceChildren();
    // tools
    const seg = el('div', { class: 'sg-dp-seg' }, (isPhone() ? [['free', 'Free'], ['TD', 'Chart ↓'], ['LR', 'Chart →']] : [['free', 'Free canvas'], ['TD', 'Flowchart ↓'], ['LR', 'Flowchart →']]).map(([k, l]) => el('button', { class: P.layout === k ? 'is-on' : '', onclick: () => this.setLayout(k) }, l)));
    const tools = el('div', { class: 'sg-dp-tools' },
      el('button', { onclick: () => this.addCard() }, '＋ Card'), el('button', { onclick: () => this.addGroup() }, '▢ Group'), seg,
      el('span', { class: 'sg-grow' }),
      el('button', { class: this.store.code ? 'is-on' : '', onclick: () => { this.store.code = !this.store.code; this.save(); this.mount(); } }, isPhone() ? '⟨/⟩' : '⟨/⟩ Mermaid'));
    // draft list
    const list = el('div', { class: 'sg-dp-list' }, el('span', { class: 'sg-dp-lbl' }, 'Draft plots'),
      this.store.plots.map((p) => el('button', { class: p.id === P.id ? 'is-on' : '', onclick: () => { if (p.id !== P.id) { this.store.active = p.id; this.sel = null; this.picking = null; this.save(); this.mount(); } }, ondblclick: () => this.renamePlot(p) }, p.name)),
      el('button', { onclick: () => { const p = newDraftPlot(`Draft plot ${this.store.plots.length + 1}`); this.store.plots.push(p); this.store.active = p.id; this.save(); this.mount(); } }, '＋ New'),
      el('button', { class: 'sg-sq', 'aria-label': 'Draft plot options', onclick: (e) => this.plotMenu(e) }, '⋯'),
      el('span', { class: 'ds-hint sg-dp-note' }, 'Not linked to notes or the board'));
    // stage
    this.stage = el('div', { class: 'sg-dp-stage', tabindex: '0' });
    this.world = el('div', { class: 'sg-dp-world' }); this.stage.appendChild(this.world);
    this.svg = document.createElementNS(svgNS, 'svg'); this.svg.setAttribute('class', 'sg-dp-edges');
    this.svg.innerHTML = '<defs><marker id="sg-dp-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="sg-dp-ah"/></marker><marker id="sg-dp-ahs" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="sg-dp-ah is-sel"/></marker></defs>';
    this.world.appendChild(this.svg);
    this.fmt = el('div', { class: 'sg-dp-fmt' }); this.stage.appendChild(this.fmt);
    this.info = el('div', { class: 'sg-dp-info' }); this.stage.appendChild(this.info);
    put(this.stage, el('div', { class: 'sg-dp-zoom' }, el('button', { 'aria-label': 'Zoom in', onclick: () => this.zoomBy(1.2) }, '＋'), el('button', { 'aria-label': 'Zoom out', onclick: () => this.zoomBy(1 / 1.2) }, '－'), el('button', { 'aria-label': 'Fit everything', onclick: () => this.fit() }, '⤢')));
    if (!this.store.helpSeen) put(this.stage, el('div', { class: 'sg-dp-help' }, el('span', {}, isPhone() ? 'Not linked to anything. Long-press empty space for a card · drag a card’s dot to connect · double-tap to write · pinch to zoom.' : DP_HELP), el('button', { onclick: (e) => { this.store.helpSeen = true; this.save(); e.currentTarget.parentElement.remove(); } }, 'Got it')));
    // mermaid panel
    this.code = el('pre', { class: 'sg-dp-code' });
    const side = this.store.code ? el('div', { class: 'sg-dp-side' }, el('div', { class: 'sg-dp-sidehd' }, el('b', {}, 'Mermaid'), el('span', { class: 'ds-hint' }, ' · updates as you draw')), this.code,
      el('div', { class: 'ds-row' }, el('button', { onclick: () => { navigator.clipboard.writeText(this.mermaid()).then(() => notice('Copied. Paste it into a note inside ```mermaid … ```.')); } }, 'Copy'),
        HOST.world ? el('button', { onclick: () => this.toEntry() }, 'Add to an Encyclopedia entry…') : null, el('button', { onclick: () => this.toNewNote() }, 'Save as a note…'))) : null;
    put(this.root, tools, list, el('div', { class: 'sg-dp-main' }, this.stage, side));
    this.bindStage(); this.applyView(); this.draw();
    if (!P.view) requestAnimationFrame(() => this.fit());
  }

  /* ---------- geometry ---------- */
  byId(i) { return this.P.cards.find((c) => c.id === i); }
  cardEl(i) { return this.world.querySelector(`.sg-dp-card[data-id="${i}"]`); }
  box(c) { const e = this.cardEl(c.id); const w = e ? e.offsetWidth : (this.sizes && this.sizes[c.id] && this.sizes[c.id][0]) || 190; const h = e ? e.offsetHeight : (this.sizes && this.sizes[c.id] && this.sizes[c.id][1]) || 56; return { x: c.x, y: c.y, w, h, cx: c.x + w / 2, cy: c.y + h / 2 }; }
  members(g) { return (g.ids || []).map((i) => this.byId(i)).filter(Boolean); }
  gbox(g) {
    const ms = this.members(g); if (!ms.length) return { x: g.x ?? 300, y: g.y ?? 200, w: g.w ?? 320, h: g.h ?? 180 };
    const bs = ms.map((c) => this.box(c)); const x = Math.min(...bs.map((b) => b.x)) - 28, y = Math.min(...bs.map((b) => b.y)) - 34;
    const r = { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) + 28 - x, h: Math.max(...bs.map((b) => b.y + b.h)) + 28 - y }; Object.assign(g, r); return r;
  }
  pt(e) { const r = this.stage.getBoundingClientRect(); return { x: (e.clientX - r.left - this.v.x) / this.v.z, y: (e.clientY - r.top - this.v.y) / this.v.z }; }
  applyView() { this.world.style.transform = `translate(${this.v.x}px,${this.v.y}px) scale(${this.v.z})`; this.P.view = this.v; }
  zoomAt(k, sx, sy) { const z = Math.min(2.5, Math.max(0.2, this.v.z * k)); const wx = (sx - this.v.x) / this.v.z, wy = (sy - this.v.y) / this.v.z; this.v.z = z; this.v.x = sx - wx * z; this.v.y = sy - wy * z; this.applyView(); this.formatBar(); this.infoLine(); this.save(); }
  zoomBy(k) { this.zoomAt(k, this.stage.clientWidth / 2, this.stage.clientHeight / 2); }
  fit() {
    const bs = [...this.P.cards.map((c) => this.box(c)), ...this.P.groups.map((g) => { const r = this.gbox(g); return { x: r.x, y: r.y - 14, w: r.w, h: r.h + 14 }; })]; if (!bs.length) return;
    const x0 = Math.min(...bs.map((b) => b.x)), y0 = Math.min(...bs.map((b) => b.y)), x1 = Math.max(...bs.map((b) => b.x + b.w)), y1 = Math.max(...bs.map((b) => b.y + b.h));
    const help = this.stage.querySelector('.sg-dp-help'); const top = (help ? help.offsetHeight + 16 : 0) + 30;
    const W = this.stage.clientWidth || 600, H = this.stage.clientHeight || 400; const z = Math.min(1.2, (W - 60) / Math.max(1, x1 - x0), (H - top - 50) / Math.max(1, y1 - y0));
    this.v = { z, x: (W - (x1 - x0) * z) / 2 - x0 * z, y: top - y0 * z }; this.applyView(); this.draw(); this.save();
  }

  /* ---------- drawing ---------- */
  draw() {
    const P = this.P; this.world.querySelectorAll('.sg-dp-card, .sg-dp-grp').forEach((e) => e.remove());
    this.stage.classList.toggle('is-picking', !!this.picking);
    // measure cards first so groups can wrap them
    this.sizes = {};
    for (const c of P.cards) { const e = this.makeCard(c, true); this.world.appendChild(e); this.sizes[c.id] = [e.offsetWidth, e.offsetHeight]; e.remove(); }
    for (const g of P.groups) {
      const r = this.gbox(g); const on = this.sel && this.sel.id === g.id;
      const e = el('div', { class: 'sg-dp-grp' + (on ? ' is-sel' : ''), 'data-id': g.id, style: { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px', '--c': DP_COLORS[g.c] || DP_COLORS.grey } }, el('div', { class: 'sg-dp-gt' }, g.t));
      this.world.insertBefore(e, this.svg); this.bindGroup(e, g);
    }
    for (const c of P.cards) { const e = this.makeCard(c); this.world.appendChild(e); this.bindCard(e, c); }
    this.drawEdges(); this.formatBar(); this.infoLine(); this.pickBanner();
    if (this.store.code) this.code.textContent = this.mermaid();
  }
  makeCard(c, measure) {
    const gp = this.picking && this.P.groups.find((g) => g.id === this.picking); const inG = gp && (gp.ids || []).includes(c.id);
    const e = el('div', { class: `sg-dp-card k-${c.k}` + (this.sel && this.sel.id === c.id ? ' is-sel' : ''), 'data-id': c.id, style: { left: c.x + 'px', top: c.y + 'px', '--c': DP_COLORS[c.c] || DP_COLORS.grey, visibility: measure ? 'hidden' : null } },
      gp ? el('span', { class: 'sg-dp-pick' + (inG ? ' is-on' : '') }, inG ? '✓' : '') : null,
      el('span', { class: 'sg-dp-t' }, c.t),
      measure ? null : ['n', 's', 'w', 'e'].map((s) => el('i', { class: 'sg-dp-dot is-' + s, 'data-s': s })));
    return e;
  }
  infoLine() { const P = this.P; this.info.textContent = `${P.cards.length} card${P.cards.length === 1 ? '' : 's'} · ${P.edges.length} arrow${P.edges.length === 1 ? '' : 's'}${P.groups.length ? ` · ${P.groups.length} group${P.groups.length === 1 ? '' : 's'}` : ''} · ${Math.round(this.v.z * 100)}%`; }
  sides(A, B) { const dx = B.cx - A.cx, dy = B.cy - A.cy; if (Math.abs(dy) * 1.2 > Math.abs(dx)) return dy > 0 ? ['s', 'n'] : ['n', 's']; return dx > 0 ? ['e', 'w'] : ['w', 'e']; }
  port(b, s) { return s === 'n' ? [b.cx, b.y] : s === 's' ? [b.cx, b.y + b.h] : s === 'w' ? [b.x, b.cy] : [b.x + b.w, b.cy]; }
  curve(p, q, sa, sb) { const d = Math.max(40, Math.hypot(q[0] - p[0], q[1] - p[1]) / 2.4); const v = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }; return `M${p[0]},${p[1]} C${p[0] + v[sa][0] * d},${p[1] + v[sa][1] * d} ${q[0] + v[sb][0] * d},${q[1] + v[sb][1] * d} ${q[0]},${q[1]}`; }
  drawEdges() {
    this.svg.querySelectorAll('g.sg-dp-ed').forEach((g) => g.remove());
    for (const ed of this.P.edges) {
      const A = this.byId(ed.a), B = this.byId(ed.b); if (!A || !B) continue;
      const a = this.box(A), b = this.box(B); const [sa, sb] = this.sides(a, b); const p = this.port(a, sa), q = this.port(b, sb); const d = this.curve(p, q, sa, sb); const on = this.sel && this.sel.id === ed.id;
      const g = document.createElementNS(svgNS, 'g'); g.setAttribute('class', 'sg-dp-ed');
      const hit = document.createElementNS(svgNS, 'path'); hit.setAttribute('class', 'sg-dp-hit'); hit.setAttribute('d', d);
      const line = document.createElementNS(svgNS, 'path'); line.setAttribute('class', 'sg-dp-line' + (ed.dash ? ' is-dash' : '') + (on ? ' is-sel' : '')); line.setAttribute('d', d); line.setAttribute('marker-end', `url(#${on ? 'sg-dp-ahs' : 'sg-dp-ah'})`);
      g.append(hit, line);
      if (ed.l) { const t = document.createElementNS(svgNS, 'text'); t.setAttribute('x', (p[0] + q[0]) / 2); t.setAttribute('y', (p[1] + q[1]) / 2 - 4); t.setAttribute('text-anchor', 'middle'); t.textContent = ed.l; g.appendChild(t); }
      hit.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.sel = { type: 'edge', id: ed.id }; this.draw(); });
      hit.addEventListener('dblclick', (e) => { e.stopPropagation(); this.edgeWords(ed); });
      this.svg.appendChild(g);
    }
  }

  /* ---------- interaction ---------- */
  bindStage() {
    const st = this.stage; let longT = 0;
    const empty = (t) => t === st || t === this.world || t === this.svg;
    st.addEventListener('pointerdown', (e) => {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) { clearTimeout(longT); this.pinch = { d: this.pdist(), z: this.v.z }; return; }
      if (!empty(e.target)) return; st.focus({ preventScroll: true });
      if (!this.picking) { if (this.sel) { this.sel = null; this.draw(); } }
      const s = { x: e.clientX, y: e.clientY, vx: this.v.x, vy: this.v.y }; let moved = false; st.classList.add('is-panning');
      if (e.pointerType !== 'mouse') longT = setTimeout(() => { if (!moved && this.pointers.size === 1) this.addCardAt(this.pt(e)); }, 550);
      const mv = (ev) => { if (this.pinch) return; if (Math.hypot(ev.clientX - s.x, ev.clientY - s.y) > 6) { moved = true; clearTimeout(longT); } this.v.x = s.vx + ev.clientX - s.x; this.v.y = s.vy + ev.clientY - s.y; this.applyView(); this.formatBar(); };
      const up = () => { clearTimeout(longT); st.classList.remove('is-panning'); st.removeEventListener('pointermove', mv); st.removeEventListener('pointerup', up); st.removeEventListener('pointercancel', up); if (moved) this.save(); };
      st.addEventListener('pointermove', mv); st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
    });
    st.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return; this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch && this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; const r = st.getBoundingClientRect(); this.zoomAt((this.pinch.z * (this.pdist() / this.pinch.d)) / this.v.z, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); }
    });
    const lift = (e) => { this.pointers.delete(e.pointerId); if (this.pointers.size < 2) this.pinch = null; };
    st.addEventListener('pointerup', lift); st.addEventListener('pointercancel', lift);
    st.addEventListener('dblclick', (e) => { if (empty(e.target)) this.addCardAt(this.pt(e)); });
    st.addEventListener('wheel', (e) => {
      e.preventDefault(); const r = st.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) this.zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
      else { this.v.x -= e.deltaX; this.v.y -= e.deltaY; this.applyView(); this.formatBar(); this.save(); }
    }, { passive: false });
    st.addEventListener('keydown', (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel && !document.activeElement.isContentEditable && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); this.remove(); } if (e.key === 'Escape' && this.picking) { this.donePicking(); } });
  }
  pdist() { const [a, b] = [...this.pointers.values()]; return Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)); }
  bindCard(elc, c) {
    elc.addEventListener('pointerdown', (e) => {
      if (e.target.isContentEditable || this.pointers.size > 1) return; e.stopPropagation(); this.stage.focus({ preventScroll: true });
      if (this.picking) { const g = this.P.groups.find((x) => x.id === this.picking); if (g) { this.P.groups.forEach((o) => { if (o !== g) o.ids = (o.ids || []).filter((i) => i !== c.id); }); g.ids = (g.ids || []).includes(c.id) ? g.ids.filter((i) => i !== c.id) : [...(g.ids || []), c.id]; this.save(); this.draw(); } return; }
      const dot = e.target.closest('.sg-dp-dot'); if (dot) { this.connect(e, c, dot.dataset.s); return; }
      if (!(this.sel && this.sel.id === c.id)) { this.sel = { type: 'card', id: c.id }; this.world.querySelectorAll('.is-sel').forEach((x) => x.classList.remove('is-sel')); elc.classList.add('is-sel'); this.drawEdges(); this.formatBar(); }
      const s = this.pt(e), ox = c.x, oy = c.y; let moved = false; try { elc.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      const mv = (ev) => { const p = this.pt(ev); if (!moved && Math.hypot(p.x - s.x, p.y - s.y) < 3) return; moved = true; c.x = Math.round(ox + p.x - s.x); c.y = Math.round(oy + p.y - s.y); elc.style.left = c.x + 'px'; elc.style.top = c.y + 'px'; this.refreshGroups(); this.drawEdges(); this.formatBar(); };
      const up = () => { elc.removeEventListener('pointermove', mv); elc.removeEventListener('pointerup', up); elc.removeEventListener('pointercancel', up); if (!moved) return;
        if (this.P.layout !== 'free') this.P.layout = 'free';
        const b = this.box(c); const home = this.P.groups.find((g) => (g.ids || []).includes(c.id)); const into = this.P.groups.find((g) => g !== home && b.cx > g.x && b.cx < g.x + g.w && b.cy > g.y && b.cy < g.y + g.h);
        if (into) { if (home) home.ids = home.ids.filter((i) => i !== c.id); into.ids = [...(into.ids || []), c.id]; notice(`Added to “${into.t}”`); }
        this.save(); this.mountTools(); this.draw(); };
      elc.addEventListener('pointermove', mv); elc.addEventListener('pointerup', up); elc.addEventListener('pointercancel', up);
    });
    elc.addEventListener('dblclick', (e) => { e.stopPropagation(); if (!this.picking) this.editCard(c); });
  }
  mountTools() { const seg = this.root.querySelectorAll('.sg-dp-seg button'); ['free', 'TD', 'LR'].forEach((k, i) => seg[i] && seg[i].classList.toggle('is-on', this.P.layout === k)); }
  editCard(c) {
    const e = this.cardEl(c.id); if (!e) return; const t = e.querySelector('.sg-dp-t'); t.contentEditable = 'true'; t.focus();
    const r = document.createRange(); r.selectNodeContents(t); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    const done = () => { t.contentEditable = 'false'; c.t = t.textContent.trim() || 'Untitled'; this.save(); this.draw(); };
    t.onblur = done; t.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); t.blur(); } if (ev.key === 'Escape') t.blur(); };
  }
  bindGroup(elg, g) {
    elg.addEventListener('pointerdown', (e) => {
      if (this.picking || this.pointers.size > 1) return; e.stopPropagation(); this.sel = { type: 'group', id: g.id }; this.draw();
      const ge = this.world.querySelector(`.sg-dp-grp[data-id="${g.id}"]`); const s = this.pt(e); const o = { x: g.x, y: g.y, cs: this.members(g).map((c) => [c, c.x, c.y]) }; let moved = false;
      const mv = (ev) => { const p = this.pt(ev); const dx = p.x - s.x, dy = p.y - s.y; moved = true; g.x = Math.round(o.x + dx); g.y = Math.round(o.y + dy); for (const [c, x, y] of o.cs) { c.x = Math.round(x + dx); c.y = Math.round(y + dy); const ce = this.cardEl(c.id); if (ce) { ce.style.left = c.x + 'px'; ce.style.top = c.y + 'px'; } } if (ge) { ge.style.left = g.x + 'px'; ge.style.top = g.y + 'px'; } this.drawEdges(); this.formatBar(); };
      const up = () => { this.stage.removeEventListener('pointermove', mv); this.stage.removeEventListener('pointerup', up); this.stage.removeEventListener('pointercancel', up); if (moved) { if (o.cs.length) this.P.layout = 'free'; this.save(); this.mountTools(); } };
      this.stage.addEventListener('pointermove', mv); this.stage.addEventListener('pointerup', up); this.stage.addEventListener('pointercancel', up);
    });
    elg.querySelector('.sg-dp-gt').addEventListener('dblclick', (e) => { e.stopPropagation(); this.renameGroup(g); });
  }
  connect(e, c, side) {
    const a = this.box(c); const p = this.port(a, side); const ghost = document.createElementNS(svgNS, 'path'); ghost.setAttribute('class', 'sg-dp-line is-ghost'); this.svg.appendChild(ghost);
    const st = this.stage;
    const mv = (ev) => { const q = this.pt(ev); ghost.setAttribute('d', `M${p[0]},${p[1]} L${q.x},${q.y}`); };
    const up = (ev) => {
      st.removeEventListener('pointermove', mv); st.removeEventListener('pointerup', up); st.removeEventListener('pointercancel', up); ghost.remove(); if (ev.type === 'pointercancel') return;
      const q = this.pt(ev); if (Math.hypot(q.x - p[0], q.y - p[1]) < 12) return;
      const t = this.P.cards.find((o) => { const b = this.box(o); return o.id !== c.id && q.x >= b.x - 10 && q.x <= b.x + b.w + 10 && q.y >= b.y - 10 && q.y <= b.y + b.h + 10; });
      if (t) { if (!this.P.edges.some((x) => x.a === c.id && x.b === t.id)) this.P.edges.push({ id: dpId(), a: c.id, b: t.id }); this.save(); this.draw(); return; }
      const nc = { id: dpId(), t: 'New card', k: 'scene', c: c.c, x: Math.round(q.x - 95), y: Math.round(q.y - 28) }; this.P.cards.push(nc); this.P.edges.push({ id: dpId(), a: c.id, b: nc.id });
      this.sel = { type: 'card', id: nc.id }; this.save(); this.draw(); this.editCard(nc);
    };
    st.addEventListener('pointermove', mv); st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
  }

  /* ---------- floating format bar ---------- */
  formatBar() {
    const f = this.fmt; f.replaceChildren(); const s = this.sel; if (!s || this.picking) { f.style.display = 'none'; return; }
    const P = this.P; let item, r; const sr = this.stage.getBoundingClientRect();
    if (s.type === 'card') { item = this.byId(s.id); const e = this.cardEl(s.id); r = e && e.getBoundingClientRect(); }
    else if (s.type === 'group') { item = P.groups.find((g) => g.id === s.id); const e = this.world.querySelector(`.sg-dp-grp[data-id="${s.id}"]`); r = e && e.getBoundingClientRect(); }
    else { item = P.edges.find((x) => x.id === s.id); if (item && this.byId(item.a) && this.byId(item.b)) { const A = this.box(this.byId(item.a)), B = this.box(this.byId(item.b)); r = { left: sr.left + this.v.x + ((A.cx + B.cx) / 2) * this.v.z - 60, top: sr.top + this.v.y + ((A.cy + B.cy) / 2) * this.v.z, width: 120 }; } }
    if (!item || !r) { f.style.display = 'none'; return; }
    const b = (label, fn, cls = '', title = '') => el('button', { class: cls, title: title || null, onclick: (e) => { e.stopPropagation(); fn(); } }, label);
    const sep = () => el('span', { class: 'sg-dp-div' });
    if (s.type === 'card') { put(f, DP_KINDS.map(([k, i, l]) => b(i, () => { item.k = k; this.save(); this.draw(); }, item.k === k ? 'is-on' : '', l)), sep()); }
    if (s.type !== 'edge') put(f, Object.entries(DP_COLORS).map(([k, v]) => { const x = b('', () => { item.c = k; this.save(); this.draw(); }, 'sg-dp-sw' + (item.c === k ? ' is-on' : ''), k); x.style.background = v; return x; }), sep());
    if (s.type === 'card') {
      put(f, b('✎', () => this.editCard(item), '', 'Write on the card'));
      if (P.groups.length) { const gs = el('select', { class: 'dropdown', title: 'Group' }, el('option', { value: '' }, 'No group'), P.groups.map((g) => el('option', { value: g.id, selected: (g.ids || []).includes(item.id) }, '▢ ' + g.t))); gs.addEventListener('change', () => { P.groups.forEach((g) => (g.ids = (g.ids || []).filter((i) => i !== item.id))); const g = P.groups.find((x) => x.id === gs.value); if (g) g.ids.push(item.id); this.save(); this.draw(); }); gs.addEventListener('pointerdown', (e) => e.stopPropagation()); put(f, gs); }
    }
    if (s.type === 'group') put(f, b('☑ Choose cards', () => { this.picking = item.id; this.sel = null; this.draw(); }), b('✎ Rename', () => this.renameGroup(item)));
    if (s.type === 'edge') put(f, b(item.dash ? '— Solid' : '┄ Dashed', () => { item.dash = !item.dash; this.save(); this.draw(); }), b('✎ Words', () => this.edgeWords(item)), b('⇄ Reverse', () => { [item.a, item.b] = [item.b, item.a]; this.save(); this.draw(); }));
    put(f, sep(), b('🗑', () => this.remove(), '', 'Delete'));
    f.style.display = 'flex'; const fw = f.offsetWidth;
    f.style.left = Math.max(6, Math.min(sr.width - fw - 6, r.left - sr.left + r.width / 2 - fw / 2)) + 'px';
    const above = r.top - sr.top - 50; f.style.top = (above > 6 ? above : Math.min(sr.height - 50, r.top - sr.top + (r.height || 0) + 10)) + 'px';
    f.onpointerdown = (e) => e.stopPropagation();
  }
  remove() {
    const s = this.sel; if (!s) return; const P = this.P;
    if (s.type === 'card') { P.groups.forEach((g) => (g.ids = (g.ids || []).filter((i) => i !== s.id))); P.cards = P.cards.filter((c) => c.id !== s.id); P.edges = P.edges.filter((x) => x.a !== s.id && x.b !== s.id); }
    else if (s.type === 'edge') P.edges = P.edges.filter((x) => x.id !== s.id);
    else P.groups = P.groups.filter((g) => g.id !== s.id);
    this.sel = null; this.save(); this.draw();
  }

  /* ---------- small in-place editors (no pop-ups) ---------- */
  inline(sx, sy, value, placeholder, done) {
    this.stage.querySelectorAll('.sg-dp-inl').forEach((x) => x.remove());
    const i = el('input', { class: 'sg-dp-inl', type: 'text', value: value || '', placeholder }); this.stage.appendChild(i);
    i.style.left = Math.max(6, Math.min(this.stage.clientWidth - 210, sx - 100)) + 'px'; i.style.top = Math.max(6, sy - 18) + 'px';
    let closed = false; const close = (ok) => { if (closed) return; closed = true; const v = i.value; i.remove(); if (ok) done(v.trim()); };
    i.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') close(true); if (e.key === 'Escape') close(false); });
    i.addEventListener('blur', () => close(true)); i.addEventListener('pointerdown', (e) => e.stopPropagation());
    i.focus(); i.select();
  }
  edgeWords(ed) { const A = this.box(this.byId(ed.a)), B = this.box(this.byId(ed.b)); this.fmt.style.display = 'none'; this.inline(this.v.x + ((A.cx + B.cx) / 2) * this.v.z, this.v.y + ((A.cy + B.cy) / 2) * this.v.z, ed.l, 'Words on this arrow, e.g. “yes”', (v) => { ed.l = v; this.save(); this.draw(); }); }
  renameGroup(g) { this.fmt.style.display = 'none'; this.inline(this.v.x + (g.x + 100) * this.v.z, this.v.y + g.y * this.v.z, g.t, 'Group name, e.g. Act II', (v) => { g.t = v || 'Group'; this.save(); this.draw(); }); }
  renamePlot(p) { const btn = [...this.root.querySelectorAll('.sg-dp-list button')].find((b) => b.textContent === p.name); const r = btn ? btn.getBoundingClientRect() : null; const sr = this.stage.getBoundingClientRect();
    this.inline(r ? r.left - sr.left + 100 : 120, 24, p.name, 'Name of this draft plot', (v) => { if (v) { p.name = v; this.save(); this.mount(); } }); }
  plotMenu(e) {
    const P = this.P; const m = new Menu();
    m.addItem((it) => it.setTitle(`Rename “${P.name}”`).onClick(() => this.renamePlot(P)));
    m.addItem((it) => it.setTitle('Duplicate').onClick(() => { const c = JSON.parse(JSON.stringify(P)); c.id = dpId(); c.name = P.name + ' (copy)'; this.store.plots.push(c); this.store.active = c.id; this.save(); this.mount(); }));
    m.addItem((it) => it.setTitle('Show the help again').onClick(() => { this.store.helpSeen = false; this.mount(); }));
    m.addItem((it) => it.setTitle(`Delete “${P.name}”…`).onClick(() => new ConfirmModal(`Delete “${P.name}”?`, `Its ${P.cards.length} cards and ${P.edges.length} arrows will be gone. Nothing else in Plot Weaver changes.`, 'Delete', () => { this.store.plots = this.store.plots.filter((x) => x !== P); draftStore(this.novel); this.store.active = this.store.plots[0].id; this.save(); this.mount(); }).open()));
    m.showAtMouseEvent(e);
  }
  refreshGroups() { for (const g of this.P.groups) { if (!this.members(g).length) continue; const r = this.gbox(g); const e = this.world.querySelector(`.sg-dp-grp[data-id="${g.id}"]`); if (e) Object.assign(e.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' }); } }
  pickBanner() {
    this.stage.querySelectorAll('.sg-dp-banner').forEach((x) => x.remove()); if (!this.picking) return;
    const g = this.P.groups.find((x) => x.id === this.picking); if (!g) { this.picking = null; return; }
    const bn = el('div', { class: 'sg-dp-banner' }, el('span', {}, 'Tap cards to put them in or take them out of ', el('b', {}, g.t), ` · ${(g.ids || []).length} in it`), el('button', { class: 'mod-cta', onclick: () => this.donePicking() }, 'Done'));
    bn.addEventListener('pointerdown', (e) => e.stopPropagation()); this.stage.appendChild(bn);
  }
  donePicking() { const g = this.P.groups.find((x) => x.id === this.picking); this.picking = null; if (g && !(g.ids || []).length) { this.P.groups = this.P.groups.filter((x) => x !== g); notice('Empty group removed.'); } else if (g) this.sel = { type: 'group', id: g.id }; this.save(); this.draw(); }

  /* ---------- adding ---------- */
  centre() { return { x: (this.stage.clientWidth / 2 - this.v.x) / this.v.z, y: (this.stage.clientHeight / 2 - this.v.y) / this.v.z }; }
  addCard() { this.addCardAt(this.centre()); }
  addCardAt(q) { const c = { id: dpId(), t: 'New card', k: 'scene', c: 'grey', x: Math.round(q.x - 95), y: Math.round(q.y - 28) }; this.P.cards.push(c); this.sel = { type: 'card', id: c.id }; this.save(); this.draw(); this.editCard(c); }
  addGroup() {
    const q = this.centre(); const first = this.sel && this.sel.type === 'card' ? [this.sel.id] : [];
    this.P.groups.forEach((o) => (o.ids = (o.ids || []).filter((i) => !first.includes(i))));
    const g = { id: dpId(), t: 'New group', c: 'teal', ids: first, x: Math.round(q.x - 160), y: Math.round(q.y - 90), w: 320, h: 180 }; this.P.groups.push(g); this.picking = g.id; this.sel = null; this.save(); this.draw();
  }

  /* ---------- arranging like a Mermaid flowchart ---------- */
  setLayout(l) {
    const P = this.P; if (l === P.layout) return;
    if (P.layout === 'free') P.free = Object.fromEntries(P.cards.map((c) => [c.id, [c.x, c.y]]));
    if (l === 'free') { if (P.free) P.cards.forEach((c) => { if (P.free[c.id]) [c.x, c.y] = P.free[c.id]; }); }
    else this.arrange(l);
    P.layout = l; this.save(); this.world.classList.add('is-anim'); this.mount();
    const tick = setInterval(() => this.drawEdges(), 30); setTimeout(() => { clearInterval(tick); this.world.classList.remove('is-anim'); this.fit(); }, 480);
  }
  arrange(dir) {
    const P = this.P; const linked = new Set(P.edges.flatMap((e) => [e.a, e.b]));
    const ids = P.cards.map((c) => c.id).filter((i) => linked.has(i)); const loose = P.cards.map((c) => c.id).filter((i) => !linked.has(i));
    const inn = Object.fromEntries(ids.map((i) => [i, []])); for (const e of P.edges) if (inn[e.b] && e.a !== e.b && inn[e.a]) inn[e.b].push(e.a);
    const rank = {}; const visiting = new Set();
    const r = (i) => { if (rank[i] != null) return rank[i]; if (visiting.has(i)) return 0; visiting.add(i); rank[i] = inn[i].length ? Math.max(...inn[i].map((p) => r(p) + 1)) : 0; visiting.delete(i); return rank[i]; };
    ids.forEach(r);
    const layers = []; ids.forEach((i) => (layers[rank[i]] ??= []).push(i));
    const avg = (a) => (a.length ? a.reduce((x, y) => x + (y ?? 0), 0) / a.length : 0);
    for (let k = 1; k < layers.length; k++) { if (!layers[k]) { layers[k] = []; continue; } const pos = Object.fromEntries((layers[k - 1] || []).map((i, j) => [i, j])); layers[k].sort((a, b) => avg(inn[a].map((p) => pos[p])) - avg(inn[b].map((p) => pos[p]))); }
    const GX = dir === 'TD' ? 240 : 290, GY = dir === 'TD' ? 150 : 130;
    layers.forEach((L, k) => (L || []).forEach((i, j) => { const c = this.byId(i); const off = j - (L.length - 1) / 2; if (dir === 'TD') { c.x = Math.round(500 + off * GX - 95); c.y = 40 + k * GY; } else { c.x = 40 + k * GX; c.y = Math.round(360 + off * GY - 28); } }));
    const bs = ids.map((i) => this.box(this.byId(i))); const right = bs.length ? Math.max(...bs.map((b) => b.x + b.w)) : 300; const bottom = bs.length ? Math.max(...bs.map((b) => b.y + b.h)) : 300;
    loose.forEach((i, j) => { const c = this.byId(i); if (dir === 'TD') { c.x = right + 120; c.y = 40 + j * 190; } else { c.x = 40 + j * 240; c.y = bottom + 120; } });
  }

  /* ---------- Mermaid ---------- */
  mermaid() {
    const P = this.P; const q = (t) => String(t).replace(/"/g, '#quot;').replace(/\n/g, ' ');
    const shape = (c) => ({ scene: `["${q(c.t)}"]`, event: `("${q(c.t)}")`, choice: `{"${q(c.t)}"}`, idea: `(("${q(c.t)}"))`, note: `>"${q(c.t)}"]` })[c.k] || `["${q(c.t)}"]`;
    const key = new Map(P.cards.map((c, i) => [c.id, 'n' + (i + 1)])); const lines = [`flowchart ${P.layout === 'LR' ? 'LR' : 'TD'}`]; const inG = new Set();
    P.groups.forEach((g, gi) => { const cs = this.members(g); if (!cs.length) return; lines.push(`  subgraph g${gi + 1}["${q(g.t)}"]`); cs.forEach((c) => { lines.push(`    ${key.get(c.id)}${shape(c)}`); inG.add(c.id); }); lines.push('  end'); });
    P.cards.filter((c) => !inG.has(c.id)).forEach((c) => lines.push(`  ${key.get(c.id)}${shape(c)}`));
    for (const e of P.edges) if (key.has(e.a) && key.has(e.b)) lines.push(`  ${key.get(e.a)} ${e.dash ? '-.->' : '-->'}${e.l ? `|"${q(e.l)}"|` : ''} ${key.get(e.b)}`);
    const used = [...new Set(P.cards.map((c) => c.c))];
    used.forEach((k) => lines.push(`  classDef ${k} stroke:${DP_COLORS[k] || DP_COLORS.grey},stroke-width:2px`));
    used.forEach((k) => lines.push(`  class ${P.cards.filter((c) => c.c === k).map((c) => key.get(c.id)).join(',')} ${k}`));
    return lines.join('\n');
  }
  block() { return '```mermaid\n' + this.mermaid() + '\n```\n'; }
  async toEntry() {
    const S = WorldkeeperModule.storyguild.S; const entries = S.entries(); const P = this.P; const blk = this.block();
    if (!entries.length) { notice('There are no Encyclopedia entries yet.'); return; }
    const pick = new (class extends FuzzySuggestModal { getItems() { return entries; } getItemText(f) { return f.basename; } onChooseItem(f) { app().vault.process(f, (t) => t.replace(/\s*$/, '\n\n') + `## ${P.name}\n\n` + blk).then(() => notice(`Added “${P.name}” to “${f.basename}”.`)); } })(SG.app);
    pick.setPlaceholder('Add the diagram to which entry?'); pick.open();
  }
  toNewNote() {
    const P = this.P;
    new FormModal('Save the draft plot as a note', [{ key: 'path', label: 'Note', value: `${projectFolderOrRoot()}/${P.name}.md`, required: true }], 'Save', async (v) => {
      const path = normalizePath(v.path.endsWith('.md') ? v.path : v.path + '.md'); const body = `# ${P.name}\n\n${this.block()}`;
      const ex = app().vault.getAbstractFileByPath(path);
      if (ex instanceof TFile) await app().vault.modify(ex, body); else { const dir = path.split('/').slice(0, -1).join('/'); if (dir && !app().vault.getAbstractFileByPath(dir)) await app().vault.createFolder(dir); await app().vault.create(path, body); }
      notice(`Saved ${path}. It’s a copy: changes to the draft plot don’t update it.`);
    }).open();
  }
}
function projectFolderOrRoot() { const p = activeProject(); return (p && p.folder) || 'Plot drafts'; }
