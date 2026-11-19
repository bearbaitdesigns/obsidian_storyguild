/* =====================================================================
   Books & series — shared by Draftsmith, Worldkeeper and Plot Weaver
   ---------------------------------------------------------------------
   A book is a Draftsmith project (with its linked Plot Weaver novel).
   A series is an ordered list of books. Series name and book number are
   shown everywhere, and in Plot Weaver each book in a series automatically
   "draws on" the earlier books (Plot Weaver's linked novels).
   The current book is the same in all three sections.
   ===================================================================== */
const allSeries = () => DS().series;
const seriesById = (id) => allSeries().find((s) => s.id === id) || null;
const seriesOf = (p) => (p ? allSeries().find((s) => s.books.includes(p.id)) || null : null);
const projectById = (id) => DS().projects.find((p) => p.id === id) || null;
const seriesLine = (p) => (p && p.series ? `${p.series} · Book ${p.seriesNo}` : '');

/** Recompute every book's series name/number and Plot Weaver's links between books of a series. */
function syncSeries() {
  for (const s of allSeries()) s.books = s.books.filter((id, i, a) => projectById(id) && a.indexOf(id) === i);
  let plotChanged = false;
  for (const p of DS().projects) {
    const s = seriesOf(p);
    p.seriesId = s ? s.id : ''; p.series = s ? s.name : ''; p.seriesNo = s ? String(s.books.indexOf(p.id) + 1) : '';
    const n = linkedNovel(p); if (!n) continue;
    const want = s ? s.books.slice(0, s.books.indexOf(p.id)).map((id) => linkedNovel(projectById(id))).filter(Boolean).map((x) => x.id) : [];
    const managed = p.pwSeriesLinks || [];
    n.links = Array.isArray(n.links) ? n.links : [];
    const before = n.links.join();
    n.links = n.links.filter((id) => !managed.includes(id) || want.includes(id));
    for (const id of want) if (!n.links.includes(id)) n.links.push(id);
    p.pwSeriesLinks = want;
    if (n.links.join() !== before) plotChanged = true;
  }
  if (plotChanged && HOST.plot) HOST.plot._sgCommit();
  SG.saveSoon();
}
function createSeries(name, bookIds = []) {
  const nm = name.trim() || 'New series'; let s = allSeries().find((x) => x.name.toLowerCase() === nm.toLowerCase());
  if (!s) { s = { id: uid(), name: nm, description: '', books: [] }; allSeries().push(s); } for (const id of bookIds) addToSeries(projectById(id), s.id, null, true);
  syncSeries(); return s;
}
function addToSeries(p, seriesId, pos = null, quiet = false) {
  if (!p) return; for (const s of allSeries()) s.books = s.books.filter((x) => x !== p.id);
  const s = seriesById(seriesId); if (s) { const at = pos == null ? s.books.length : Math.max(0, Math.min(pos, s.books.length)); s.books.splice(at, 0, p.id); }
  if (!quiet) { syncSeries(); SG.refreshAll(); }
}
const removeFromSeries = (p) => addToSeries(p, null);
function moveInSeries(p, d) { const s = seriesOf(p); if (!s) return; const i = s.books.indexOf(p.id); const j = i + d; if (j < 0 || j >= s.books.length) return; [s.books[i], s.books[j]] = [s.books[j], s.books[i]]; syncSeries(); SG.refreshAll(); }
function deleteSeries(s) { DS().series = allSeries().filter((x) => x !== s); syncSeries(); SG.refreshAll(); }

/** Make a book the current one in every section. */
function setActiveProject(id) {
  const p = projectById(id); if (!p) return;
  DS().activeId = p.id; const n = linkedNovel(p);
  if (n && HOST.plot && HOST.plot.data.activeNovelId !== n.id) { HOST.plot.data.activeNovelId = n.id; SG._pwActive = n.id; HOST.plot._sgCommit(); }
  SG.saveSoon(); syncRoundsToWorld(p); SG.refreshAll();
}

/** Create a book: Draftsmith project + (optionally) a Plot Weaver novel, in a series if asked. */
function createBook({ title, seriesId = '', newSeries = '', pos = null, plot = true, activate = true }) {
  const p = makeProject(title.trim() || 'Untitled'); DS().projects.push(p);
  if (plot && HOST.plot) { SG._creatingBook = true; try { const n = PlotWeaverModule.internals.makeNovel(p.title); HOST.plot.addNovel(n); p.pwNovelId = n.id; } finally { SG._creatingBook = false; } }
  let sid = seriesId; if (sid === '__new') sid = createSeries(newSeries || `${p.title} series`).id;
  if (sid) addToSeries(p, sid, pos, true);
  syncSeries();
  if (activate) setActiveProject(p.id); else SG.refreshAll();
  notice(`Created “${p.title}”${seriesOf(p) ? ` — book ${p.seriesNo} of ${p.series}` : ''}.`);
  return p;
}

/** Old projects stored the series as text ("Tidebound, Book 1"): turn that into a real series. */
function adoptLegacySeries() {
  for (const p of DS().projects) {
    if (p.seriesId || !String(p.series || '').trim() || seriesOf(p)) continue;
    let name = String(p.series).trim(); let no = Number(p.seriesNo) || null;
    let m = name.match(/^(.*?)[\s,·:–—-]*\bbook\s*(\d+)\s*$/i); if (m && m[1].trim()) { name = m[1].trim(); no = no || Number(m[2]); }
    m = name.match(/^book\s*(\d+)\s+of\s+(?:the\s+)?(.+)$/i); if (m) { name = m[2].trim(); no = no || Number(m[1]); }
    let s = allSeries().find((x) => x.name.toLowerCase() === name.toLowerCase()); if (!s) { s = { id: uid(), name, description: '', books: [] }; allSeries().push(s); }
    s.books.push(p.id); p._legacyNo = no || 999;
  }
  for (const s of allSeries()) s.books.sort((a, b) => ((projectById(a) || {})._legacyNo || 0) - ((projectById(b) || {})._legacyNo || 0));
  for (const p of DS().projects) delete p._legacyNo;
}

/** Plot Weaver made a new novel from its own toolbar: it becomes a book too. */
function adoptPlotNovel(n) {
  if (SG._creatingBook || DS().projects.some((p) => p.pwNovelId === n.id)) return;
  const p = makeProject(n.title); p.pwNovelId = n.id; DS().projects.push(p); DS().activeId = p.id;
  syncSeries(); SG.saveSoon(); SG.refreshAll();
  notice(`“${n.title}” was added to your books. Put it in a series from Books & series.`);
}

/* ---------- dialogs ---------- */
function seriesOptions(withNone = true, withNew = true) {
  return [...(withNone ? [['', '— Standalone —']] : []), ...allSeries().map((s) => [s.id, `${s.name} (${s.books.length} book${s.books.length === 1 ? '' : 's'})`]), ...(withNew ? [['__new', '+ New series…']] : [])];
}
function newBookModal(preset = {}) {
  new FormModal('New book', [
    { key: 'title', label: 'Title', required: true, value: preset.title || '' },
    { key: 'seriesId', label: 'Series', type: 'select', options: seriesOptions(), value: preset.seriesId || '' },
    { key: 'newSeries', label: 'New series name', showIf: (i) => i.seriesId.value === '__new' },
    { key: 'pos', label: 'Book number in the series', type: 'number', placeholder: 'last', showIf: (i) => i.seriesId.value && i.seriesId.value !== '__new' },
    HOST.plot ? { key: 'plot', label: 'Also start a Plot Weaver board for it', type: 'checkbox', value: true } : null,
    { key: 'activate', label: 'Switch to this book now', type: 'checkbox', value: true },
  ].filter(Boolean), 'Create book', (v) => createBook({ title: v.title, seriesId: v.seriesId, newSeries: v.newSeries, pos: v.pos ? v.pos - 1 : null, plot: v.plot !== false && !!HOST.plot, activate: v.activate }),
  'A book gets its own manuscript, readers, checklist and book details in Draftsmith, its own board in Plot Weaver, and its own banner and milestones on Worldkeeper Home. Your world stays shared.').open();
}
function newSeriesModal() {
  const books = DS().projects;
  new FormModal('New series', [
    { key: 'name', label: 'Series name', required: true },
    ...books.map((p) => ({ key: 'b_' + p.id, label: `Add “${p.title}”${seriesOf(p) ? ` (now in ${seriesOf(p).name})` : ''}`, type: 'checkbox' })),
  ], 'Create series', (v) => { const ids = books.filter((p) => v['b_' + p.id]).map((p) => p.id); const s = createSeries(v.name, ids); SG.refreshAll(); notice(`Series “${s.name}” created${ids.length ? ` with ${ids.length} book${ids.length === 1 ? '' : 's'}` : ''}.`); },
  'Books in a series share a series name and numbering everywhere, and in Plot Weaver each book can draw on events in the books before it.').open();
}
function addBookToSeriesModal(seriesId) {
  const s = seriesById(seriesId); const others = DS().projects.filter((p) => !s || !s.books.includes(p.id));
  if (!others.length) { notice('Every book is already in this series. Create a new book instead.'); return; }
  new FormModal(s ? `Add a book to ${s.name}` : 'Add a book to a series', [
    { key: 'p', label: 'Book', type: 'select', options: others.map((p) => [p.id, p.title + (seriesOf(p) ? ` (in ${seriesOf(p).name})` : '')]) },
    s ? null : { key: 's', label: 'Series', type: 'select', options: seriesOptions(false, true) },
    { key: 'newSeries', label: 'New series name', showIf: (i) => i.s && i.s.value === '__new' },
    { key: 'pos', label: 'Book number', type: 'number', placeholder: 'last' },
  ].filter(Boolean), 'Add', (v) => { let sid = s ? s.id : v.s; if (sid === '__new') sid = createSeries(v.newSeries || 'New series').id; addToSeries(projectById(v.p), sid, v.pos ? v.pos - 1 : null); }).open();
}

class LibraryModal extends Modal {
  constructor() { super(SG.app); }
  onOpen() { this.modalEl.addClass('ds-lib-modal'); this.draw(); }
  onClose() { this.contentEl.empty(); }
  draw() {
    const c = this.contentEl; c.empty(); c.addClass('ds-modal', 'ds-lib');
    const cur = activeProject(); const redraw = () => this.draw();
    const bookRow = (p, s) => {
      const n = linkedNovel(p); const isCur = cur && cur.id === p.id;
      return el('div', { class: 'ds-lib-book' + (isCur ? ' is-current' : '') },
        s ? el('span', { class: 'ds-lib-no' }, `#${p.seriesNo}`) : el('span', { class: 'ds-lib-no' }, '·'),
        el('div', { class: 'ds-grow' }, el('b', {}, p.title), el('small', { class: 'ds-hint' }, ` · ${p.stage} · draft ${p.draft}${n ? ' · 🧵 board' : ''}`)),
        isCur ? pill('current', 'is-draft') : btn('Open', () => { setActiveProject(p.id); redraw(); }, 'ds-sm'),
        s ? [btn('↑', () => { moveInSeries(p, -1); redraw(); }, 'clickable-icon ds-sm', 'Earlier in the series'), btn('↓', () => { moveInSeries(p, 1); redraw(); }, 'clickable-icon ds-sm', 'Later in the series'), btn('Remove', () => { removeFromSeries(p); redraw(); }, 'ds-sm', 'Make it a standalone book (nothing is deleted)')]
          : allSeries().length ? ((sel) => { sel.addEventListener('change', () => { if (sel.value) { addToSeries(p, sel.value); redraw(); } }); return sel; })(el('select', { class: 'dropdown ds-sm' }, el('option', { value: '' }, 'Add to series…'), allSeries().map((x) => el('option', { value: x.id }, x.name)))) : null);
    };
    c.append(el('div', { class: 'ds-row' }, el('h2', { class: 'ds-grow' }, '📚 Books & series'),
      btn('+ New book', () => { this.close(); newBookModal(); }, 'mod-cta'), btn('+ New series', () => { this.close(); newSeriesModal(); })),
    el('p', { class: 'ds-hint' }, 'The current book is the same in Draftsmith, Worldkeeper Home and Plot Weaver. Your world (sheets, encyclopedia) is shared by every book.'));
    for (const s of allSeries()) {
      const name = el('input', { type: 'text', value: s.name, class: 'ds-ghost ds-lib-sname' }); name.addEventListener('change', () => { s.name = name.value.trim() || s.name; syncSeries(); SG.refreshAll(); });
      c.append(el('div', { class: 'ds-lib-series' },
        el('div', { class: 'ds-row' }, el('span', {}, '📖'), name, el('span', { class: 'ds-hint' }, `${s.books.length} book${s.books.length === 1 ? '' : 's'}`),
          btn('+ New book in series', () => { this.close(); newBookModal({ seriesId: s.id }); }, 'ds-sm'), btn('+ Add existing book', () => { this.close(); addBookToSeriesModal(s.id); }, 'ds-sm'),
          btn('Delete series', () => new ConfirmModal(`Delete the series “${s.name}”?`, 'Its books become standalone books. No book, note or board is deleted.', 'Delete series', () => { deleteSeries(s); redraw(); }).open(), 'ds-sm mod-warning')),
        s.books.length ? s.books.map((id) => bookRow(projectById(id), s)) : el('p', { class: 'ds-hint' }, 'No books yet.')));
    }
    const solo = DS().projects.filter((p) => !seriesOf(p));
    if (solo.length) c.append(el('div', { class: 'ds-lib-series' }, el('div', { class: 'ds-row' }, el('span', {}, '📘'), el('b', {}, 'Standalone books')), solo.map((p) => bookRow(p, null))));
  }
}
/** Quick switcher for the command palette. */
class BookSwitcher extends FuzzySuggestModal {
  constructor() { super(SG.app); this.setPlaceholder('Switch to a book…'); }
  getItems() { return DS().projects; }
  getItemText(p) { return `${p.title}${p.series ? ` — ${seriesLine(p)}` : ''}`; }
  onChooseItem(p) { setActiveProject(p.id); }
}
const openLibrary = () => new LibraryModal().open();

/* ---------- pills on Worldkeeper Home ---------- */
function sectionPills(...right) {
  const p = activeProject(); const n = linkedNovel(p);
  const wrap = document.createElement('div'); wrap.className = 'hd-sections';
  const mk = (icon, label, count, onclick, title) => el('button', { class: 'apill hd-enc hd-sec', onclick, title }, el('span', {}, icon), label, count != null ? el('b', {}, String(count)) : null);
  if (HOST.plot) wrap.append(mk('🧵', 'Plot Weaver', n ? (n.beats || []).filter((b) => b.chapterId && (!b.status || b.status === 'active')).length : null, () => (n ? HOST.plot.openBoard(n.id) : HOST.plot.activateView()), n ? `Open the board for “${n.title}”` : 'Open Plot Weaver'));
  wrap.append(mk('✒️', 'Draftsmith', p ? 'D' + p.draft : null, () => SG.openDraftsmith(), 'Open the manuscript, readers, checklist and publishing'));
  const r = document.createElement('div'); r.className = 'hd-sections-right'; r.append(...right.filter(Boolean)); wrap.append(r);
  return wrap;
}
function booksButton() { return el('button', { title: 'Switch book, start a new book or manage series', onclick: () => openLibrary() }, '📚 Books & series'); }
