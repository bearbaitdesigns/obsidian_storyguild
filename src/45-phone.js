/* =====================================================================
   Phone layout (all three sections)
   Obsidian marks phones with Platform.isPhone. The setting “Phone layout” can force it on (handy in a
   narrow pane) or off. When it's on, <body> gets the sg-phone class and the CSS in draftsmith.css
   reflows every screen; the pieces below replace layouts that can't be fixed with CSS alone.
   ===================================================================== */
function isPhone() {
  const m = (SG && SG.data && DSS().phoneLayout) || 'auto';
  return m === 'on' || (m === 'auto' && !!(ob.Platform && ob.Platform.isPhone));
}
function applyPhoneClass() { document.body.classList.toggle('sg-phone', isPhone()); }

/** Phones can't hover: tapping a chart mark shows its tooltip, tapping elsewhere hides it. */
let _tapHide = null;
function tapToHideTips() {
  if (_tapHide) return; _tapHide = (e) => { if (!(e.target instanceof Element) || !e.target.closest('svg')) tipHide(); };
  document.addEventListener('touchstart', _tapHide, { passive: true }); document.addEventListener('scroll', tipHide, true);
}
function untapToHideTips() { if (!_tapHide) return; document.removeEventListener('touchstart', _tapHide); document.removeEventListener('scroll', tipHide, true); _tapHide = null; }

/** Wide tables become one card per row on a phone: each cell is labelled with its column heading. */
function labelTables(root) {
  for (const t of root.querySelectorAll('table.ds-table:not(.ds-stable)')) {
    const hs = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim()); if (!hs.length) continue;
    t.classList.add('sg-stack');
    for (const tr of t.querySelectorAll('tbody tr')) [...tr.children].forEach((td, i) => { if (hs[i]) td.setAttribute('data-label', hs[i]); else td.classList.add('sg-nolabel'); });
  }
}

/** Long forms: each card opens and closes; the header shows how many of its fields are filled. */
function foldCards(view, root, key) {
  const open = (view.state.fold ??= {})[key] ??= new Set(['__first']);
  [...root.querySelectorAll(':scope .ds-card')].forEach((c, i) => {
    const hd = c.querySelector(':scope > .ds-card-h'); if (!hd) return;
    const name = hd.textContent.trim(); const fields = [...c.querySelectorAll('input:not([type=checkbox]):not([type=file]), textarea, select')];
    const filled = fields.filter((f) => String(f.value || '').trim() && f.value !== '—').length;
    c.classList.add('sg-fold'); if (!(open.has(name) || (i === 0 && open.has('__first')))) c.classList.add('is-closed');
    if (fields.length) put(hd, el('small', { class: 'sg-fold-n' }, `${filled}/${fields.length}`));
    put(hd, el('span', { class: 'sg-fold-cr' }, '›'));
    hd.addEventListener('click', (e) => { if (e.target.closest('button, a, input, select')) return; open.delete('__first'); if (i === 0 && !c.classList.contains('is-closed')) open.delete(name);
      const shut = c.classList.toggle('is-closed'); if (shut) open.delete(name); else open.add(name); });
  });
}

/** Draftsmith / Worldkeeper / Plot Weaver switcher shown at the top of each section on a phone. */
function sectionBar(cur) {
  const p = activeProject(); const n = p && linkedNovel(p);
  const b = (key, label, fn) => el('button', { class: cur === key ? 'is-on' : '', onclick: cur === key ? null : fn }, label);
  return el('div', { class: 'sg-sections' },
    b('ds', '✒️ Draftsmith', () => SG.openDraftsmith()),
    HOST.world ? b('wk', '🌍 Worldkeeper', () => HOST.world.openHome()) : null,
    HOST.plot ? b('pw', '🧵 Plot Weaver', () => (n ? HOST.plot.openBoard(n.id) : HOST.plot.activateView())) : null);
}

/* ---------------- Draftsmith: header ---------------- */
function phoneHeader(view, p) {
  const cov = resourceUrl(p.cover);
  const stage = el('select', { class: 'dropdown' }, STAGES.map((s) => el('option', { selected: s === p.stage }, s)));
  stage.addEventListener('change', () => setProjectField(p, 'stage', stage.value));
  return el('div', { class: 'ds-head sg-phead' },
    el('div', { class: 'sg-phead-top' },
      el('div', { class: 'ds-cover-sm', onclick: () => view.setTab('details') }, cov ? el('img', { src: cov }) : el('span', {}, p.title.slice(0, 1))),
      el('div', { class: 'ds-head-main' },
        el('button', { class: 'sg-bookchip', onclick: () => openLibrary() }, `📚 ${seriesLine(p) || 'Books & series'} ▾`),
        el('h1', {}, p.title))),
    el('div', { class: 'sg-pmeta' }, el('span', {}, el('b', {}, `Draft #${p.draft}`), ` · ${fmtN(totalWords(p))} words`), stage));
}

/* ---------------- Draftsmith: chapter cards ---------------- */
function phoneChapterTools(view, actions) {
  const reorder = !!view.state.reorder;
  const more = el('button', { class: 'sg-sq', 'aria-label': 'More' }, '⋯');
  more.addEventListener('click', (e) => { const m = new Menu(); for (const a of actions.slice(1)) m.addItem((it) => it.setTitle(a.label).onClick(a.fn)); m.showAtMouseEvent(e); });
  return el('div', { class: 'ds-row sg-chtools' }, el('h2', { class: 'ds-grow' }, 'Chapters'),
    el('button', { class: reorder ? 'is-on' : '', onclick: () => { view.state.reorder = !reorder; view.render(); } }, reorder ? '✓ Done' : '⇅ Reorder'),
    more, el('button', { class: 'mod-cta sg-sq', 'aria-label': actions[0].label, onclick: actions[0].fn }, '＋'));
}
function statusChip(c) {
  const d = statusDef(c.status);
  return el('span', { class: 'sg-st', style: { '--c': (d && d.color) || 'var(--text-faint)' } }, el('i'), d ? d.name : c.status || 'No status');
}
function phoneChapterCards(view, p, body, chs) {
  const reorder = !!view.state.reorder;
  const move = async (i, j) => { if (j < 0 || j >= chs.length) return; const a = chs.slice(); [a[i], a[j]] = [a[j], a[i]]; view.state.lift = a[j].file.path; await reorderChapters(p, a); setTimeout(() => view.render(), 350); };
  const list = el('div', { class: 'sg-chlist' }); put(body, list);
  chs.forEach((c, i) => {
    const cards = cardsForChapter(p, c); const pov = c.pov || [...new Set(cards.map((x) => x.pov && x.pov.name).filter(Boolean))].join(', ');
    const num = c.kind === 'chapter' ? String(c.num) : KIND_SHORT[c.kind];
    put(list, el('div', { class: 'ds-chcard is-' + c.kind + (view.state.lift === c.file.path ? ' is-lift' : ''), onclick: reorder ? null : () => new ChapterSheet(view, p, c).open() },
      el('div', { class: 'ds-chnum' + (c.kind === 'chapter' ? '' : ' is-kind') }, num),
      el('div', { class: 'ds-chmain' }, el('b', {}, c.title),
        el('div', { class: 'ds-chmeta' }, statusChip(c), isIdea(c) ? el('span', {}, 'idea · not linked') : pill('D' + c.draft, 'is-draft'), pov ? el('span', {}, pov) : null)),
      reorder ? el('div', { class: 'ds-mv' }, el('button', { 'aria-label': 'Move up', disabled: i === 0, onclick: (e) => { e.stopPropagation(); move(i, i - 1); } }, '↑'), el('button', { 'aria-label': 'Move down', disabled: i === chs.length - 1, onclick: (e) => { e.stopPropagation(); move(i, i + 1); } }, '↓'))
        : el('div', { class: 'ds-chw' }, el('b', {}, c.words == null ? '—' : fmtN(c.words)), isIdea(c) ? 'not counted' : 'words')));
  });
  view.state.lift = null;
  put(body, hint(reorder ? 'Tap ↑ ↓ to move a chapter. The Plot Weaver board follows the same order.' : 'Tap a chapter for its type, status, draft and Plot Weaver cards. P prologue · I interlude · E epilogue · 💡 idea (not numbered).'));
}
/** Everything the desktop table row shows, for one chapter, in a sheet. */
class ChapterSheet extends Modal {
  constructor(view, p, c) { super(SG.app); this.view = view; this.p = p; this.c = c; }
  onOpen() {
    const { p, c } = this; const sk = statusKey(); const novel = linkedNovel(p); const cards = cardsForChapter(p, c);
    this.modalEl.addClass('sg-sheet'); this.contentEl.addClass('ds-modal');
    const redraw = () => setTimeout(() => this.view.render(), 400);
    const st = el('select', { class: 'dropdown' }, el('option', { value: '' }, '—'), statusDefs().map((d) => el('option', { selected: statusDef(c.status)?.name === d.name }, d.name)), c.status && !statusDef(c.status) ? el('option', { selected: true }, c.status) : null);
    st.addEventListener('change', () => { setFm(c.file, (fm) => { fm[sk] = st.value; }); redraw(); });
    const kind = el('select', { class: 'dropdown' }, DS_KINDS.map((k) => el('option', { value: k, selected: c.kind === k }, (k === 'idea' ? '💡 ' : '') + KIND_LABEL[k])));
    kind.addEventListener('change', async () => { await setChapterKind(p, c, kind.value); this.close(); redraw(); });
    const row = (label, ...v) => el('div', { class: 'sg-srow' }, el('span', {}, label), el('div', {}, ...v));
    put(this.contentEl, el('h3', {}, c.title),
      el('div', { class: 'ds-hint' }, isIdea(c) ? 'Idea · not numbered, not counted' : `${c.label} · ${c.words == null ? '—' : fmtN(c.words)} words`),
      row('Type', kind), row('Status', st),
      row('Chapter draft', pill('D' + c.draft, 'is-draft'), el('button', { onclick: async () => { await bumpChapterDraft(p, c); this.close(); redraw(); } }, '＋ New draft')),
      row('POV', povCell(c, cards)),
      isIdea(c) ? null : el('div', { class: 'sg-scards' }, el('span', {}, 'Plot Weaver cards'),
        cards.length ? el('div', { class: 'sg-chips' }, cards.map((x) => el('button', { class: 'sg-chip', onclick: () => { this.close(); HOST.plot.openBoard(novel.id, x.b.id); } }, el('i', { style: { background: (x.plotline && x.plotline.color) || '#888' } }), x.b.title)))
          : c.pwChapter ? hint('No cards in this chapter yet.') : novel ? el('button', { onclick: () => { this.close(); linkChapterToPlot(p, c); } }, 'Link to a Plot Weaver chapter…') : hint('This book isn’t linked to Plot Weaver.')),
      el('div', { class: 'sg-sbtns' }, el('button', { onclick: () => this.close() }, 'Close'), el('button', { class: 'mod-cta', onclick: () => { this.close(); openFile(c.file); } }, 'Open note')));
  }
  onClose() { this.contentEl.empty(); }
}

/* ---------------- Plot Weaver: one chapter at a time ---------------- */
function phoneBoard(view, main, n, NV) {
  if (!view._sgPhone) { view._sgPhone = true; view.ui.shelfCollapsed = true; }
  const short = { prologue: 'P', interlude: 'I', epilogue: 'E', planning: '📝' };
  let num = 0;
  const cols = n.chapters.filter((c) => NV.kind(c) !== 'part').map((c) => { const k = NV.kind(c); return { id: c.id, title: c.title || 'Untitled', tag: k === 'chapter' ? String(++num) : short[k] || '·' }; });
  cols.push({ id: null, title: 'No chapter yet', tag: '…', staging: true });
  const lanes = n.plotlines.filter((p) => !p.archived);
  const beatsOf = (col) => n.beats.filter((b) => NV.onBoard(n, b) && (col.id ? b.chapterId === col.id : !NV.hasChapter(n, b)));
  let cur = Math.min(view._sgCol || 0, cols.length - 1);
  const wrap = main.createDiv('sg-pw-phone');
  put(wrap, sectionBar('pw'));
  const chips = wrap.createDiv('sg-pw-chips');
  const strip = wrap.createDiv('sg-pw-lanes');
  const dots = el('div', { class: 'sg-dots' }, cols.map(() => el('i')));
  const mark = (i) => { cur = i; view._sgCol = i; [...chips.children].forEach((b, k) => b.classList.toggle('is-on', k === i)); [...dots.children].forEach((d, k) => d.classList.toggle('is-on', k === i)); const on = chips.children[i]; if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' }); };
  cols.forEach((col, i) => {
    put(chips, el('button', { onclick: () => { strip.scrollTo({ left: strip.children[i].offsetLeft, behavior: 'smooth' }); mark(i); } }, `${col.tag} · ${col.title.length > 16 ? col.title.slice(0, 15) + '…' : col.title}`));
    const beats = beatsOf(col); const box = strip.createDiv('sg-pw-col');
    const words = col.id ? view.plugin.wordsOf(beats) : null;
    put(box, el('h3', {}, `${col.tag} · ${col.title}`), el('div', { class: 'ds-hint' }, [`${beats.length} card${beats.length === 1 ? '' : 's'}`, words ? `${fmtN(words)} words` : ''].filter(Boolean).join(' · ')));
    for (const p of [...lanes, null]) {
      const mine = beats.filter((b) => (p ? b.plotlineId === p.id : !lanes.some((l) => l.id === b.plotlineId))).sort((a, b) => (a.order || 0) - (b.order || 0));
      if (!mine.length) continue;
      put(box, el('div', { class: 'sg-pw-pl', style: { '--c': p ? p.color : 'var(--text-faint)' } }, el('i'), p ? p.name : 'No plotline'));
      for (const b of mine) view.renderCard(box, n, b, 'board');
    }
    if (!beats.length) put(box, el('div', { class: 'ds-hint sg-empty' }, col.staging ? 'Cards with a plotline but no chapter wait here.' : 'No cards in this chapter yet.'));
    put(box, el('button', { class: 'sg-addcard', onclick: () => view.newBeat(col.id ? { chapterId: col.id, plotlineId: lanes[0] ? lanes[0].id : null } : { staged: true, plotlineId: lanes[0] ? lanes[0].id : null }) }, '＋ Add a card here'));
  });
  put(wrap, dots, el('div', { class: 'ds-hint sg-center' }, 'Swipe sideways for the next chapter. Tap a card to edit it or move it to another chapter or plotline.'));
  let t = 0;
  strip.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => { const w = strip.clientWidth || 1; const i = Math.round(strip.scrollLeft / w); if (i !== cur && i >= 0 && i < cols.length) mark(i); }, 90); });
  requestAnimationFrame(() => { if (strip.children[cur]) strip.scrollLeft = strip.children[cur].offsetLeft; mark(cur); });
}

/* ---------------------------------------------------------------------
   Collapsible sections on phones
   Tapping a section heading in a note sheet, an encyclopedia entry or a dashboard folds it away, so a long
   note is quicker to scroll. Folded sections stay folded (per heading, on this device) until tapped again.
   The sheets are built by Worldkeeper, so the headings are marked up here after they are drawn.
   --------------------------------------------------------------------- */
const COLLAPSE_KEY = 'storyguild-collapsed';
/* sib: the heading's later siblings fold away · next: only the element right after the heading */
const COLLAPSIBLE = [
  { id: 'rules', sel: '.wk .mg-col > h4', mode: 'sib' },
  { id: 'conlang', sel: '.wk .cl-card > h4', mode: 'sib' },
  { id: 'gallery', sel: '.wk .cs-gallery > .cs-gallery-head', mode: 'sib' },
  { id: 'card', sel: '.wk .wk-card > .card-h', mode: 'sib' },
  { id: 'group', sel: '.wk .cs-group-title', mode: 'next', skip: '.enc-side' },
  { id: 'linked', sel: '.wk .enc-links > .cs-tile-label', mode: 'sib' },
  { id: 'fields', sel: '.wk .sg-fields-h', mode: 'next' },
];
let _collapsed = null;
function collapsedSet() {
  if (!_collapsed) { try { _collapsed = new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '[]')); } catch (e) { _collapsed = new Set(); } }
  return _collapsed;
}
function saveCollapsed() { try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...collapsedSet()].slice(-400))); } catch (e) { /* private mode */ } }
/** The heading's own words, without the count badge, so "Rules 2" and "Rules 3" are the same section. */
function collapseKey(rule, hd) {
  const own = [...hd.childNodes].filter((n) => !(n.nodeType === 1 && n.matches('.cs-tab-count, .wk-pill, button, .cd-spacer, .cs-hint, .sp'))).map((n) => n.textContent).join(' ');
  return rule.id + ':' + own.replace(/\s+/g, ' ').trim().toLowerCase();
}
function decorateCollapsibles(root) {
  if (!document.body.classList.contains('sg-phone')) return;
  // the field tiles under a sheet's banner get a heading of their own so they can fold too
  for (const sc of root.querySelectorAll('.wk .cs-tiles-scroll')) {
    if (sc.previousElementSibling && sc.previousElementSibling.classList.contains('sg-fields-h')) continue;
    const n = sc.querySelectorAll('.cs-tile').length; if (!n) continue;
    const hd = document.createElement('div'); hd.className = 'sg-fields-h';
    hd.append(document.createTextNode('Fields'), Object.assign(document.createElement('span'), { className: 'cs-tab-count', textContent: String(n) }));
    sc.before(hd);
  }
  const set = collapsedSet();
  for (const rule of COLLAPSIBLE) for (const hd of root.querySelectorAll(rule.sel)) {
    if (rule.skip && hd.closest(rule.skip)) continue;
    if (!hd.classList.contains('sg-colh')) { hd.classList.add('sg-colh', rule.mode === 'next' ? 'sg-colh-next' : 'sg-colh-sib'); hd.setAttribute('role', 'button'); }
    const key = collapseKey(rule, hd); hd.dataset.sgKey = key;
    const on = set.has(key); hd.classList.toggle('is-collapsed', on); hd.setAttribute('aria-expanded', String(!on));
  }
}
let _colObs = null; let _colRaf = 0; let _colClick = null;
function startCollapsibles() {
  if (_colObs) return;
  _colObs = new MutationObserver(() => { if (_colRaf || !document.body.classList.contains('sg-phone')) return; _colRaf = requestAnimationFrame(() => { _colRaf = 0; decorateCollapsibles(document); }); });
  _colObs.observe(document.body, { childList: true, subtree: true });
  _colClick = (e) => {
    if (!document.body.classList.contains('sg-phone') || !(e.target instanceof Element)) return;
    const hd = e.target.closest('.sg-colh'); if (!hd || e.target.closest('button, a, input, select, textarea, .cs-x, .wk-link')) return;
    const set = collapsedSet(); const key = hd.dataset.sgKey; if (!key) return;
    if (set.has(key)) set.delete(key); else set.add(key); saveCollapsed();
    for (const x of document.querySelectorAll('.sg-colh')) if (x.dataset.sgKey === key) { x.classList.toggle('is-collapsed', set.has(key)); x.setAttribute('aria-expanded', String(!set.has(key))); }
  };
  document.addEventListener('click', _colClick, true);
  decorateCollapsibles(document);
}
function stopCollapsibles() {
  if (_colObs) { _colObs.disconnect(); _colObs = null; } if (_colRaf) cancelAnimationFrame(_colRaf); _colRaf = 0;
  if (_colClick) { document.removeEventListener('click', _colClick, true); _colClick = null; }
  for (const x of document.querySelectorAll('.sg-fields-h')) x.remove();
  for (const x of document.querySelectorAll('.sg-colh')) x.classList.remove('sg-colh', 'sg-colh-next', 'sg-colh-sib', 'is-collapsed');
}
