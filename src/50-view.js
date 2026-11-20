/* =====================================================================
   Draftsmith view: header + tabs
   ===================================================================== */
const DS_TABS = [['manuscript', 'Manuscript', 'book-open'], ['details', 'Book details', 'id-card'], ['readers', 'Readers', 'users'], ['checklist', 'Publishing checklist', 'list-checks'], ['stats', 'Stats', 'bar-chart'], ['compile', 'Publish', 'file-output']];
const btn = (label, onclick, cls = '', title = '') => el('button', { class: cls, onclick, title: title || null }, label);
const pill = (text, cls = '', style) => el('span', { class: 'ds-pill ' + cls, style }, text);
const hint = (t) => el('div', { class: 'ds-hint' }, t);
function card(title, ...kids) { return el('div', { class: 'ds-card' }, title ? el('div', { class: 'ds-card-h' }, typeof title === 'string' ? el('h3', {}, title) : title) : null, ...kids); }
const openFile = (f, newLeaf = true) => app().workspace.getLeaf(newLeaf ? 'tab' : false).openFile(f);
const resourceUrl = (path) => { const f = path && app().vault.getAbstractFileByPath(normalizePath(path)); return f instanceof TFile ? app().vault.getResourcePath(f) : ''; };

class DraftsmithView extends ItemView {
  constructor(leaf) { super(leaf); this.state = {}; }
  getViewType() { return VIEW_DS; }
  getDisplayText() { const p = activeProject(); return p ? `Draftsmith — ${p.title}` : 'Draftsmith'; }
  getIcon() { return 'feather'; }
  async onOpen() { this.render(); }
  async onClose() { this.contentEl.empty(); tipHide(); }
  onResize() { if (DS().ui.tab === 'stats') { clearTimeout(this._rz); this._rz = setTimeout(() => this.render(), 200); } }
  setTab(t) { DS().ui.tab = t; SG.saveSoon(); this.render(); }

  render() {
    const root = this.contentEl; const scroll = root.scrollTop; root.empty(); root.addClass('ds-root');
    const p = ensureProject(); const ui = DS().ui; if (!DS_TABS.some((t) => t[0] === ui.tab)) ui.tab = 'manuscript';
    // header
    const opt = (x) => el('option', { value: x.id, selected: x.id === p.id }, (x.seriesNo ? `${x.seriesNo}. ` : '') + x.title);
    const sel = el('select', { class: 'dropdown ds-proj' },
      allSeries().filter((s) => s.books.length).map((s) => el('optgroup', { label: s.name }, s.books.map((id) => projectById(id)).filter(Boolean).map(opt))),
      DS().projects.some((x) => !seriesOf(x)) ? el('optgroup', { label: 'Standalone' }, DS().projects.filter((x) => !seriesOf(x)).map(opt)) : null,
      el('option', { value: '__new' }, '+ New book…'));
    sel.addEventListener('change', () => {
      if (sel.value === '__new') { sel.value = p.id; newBookModal(); return; }
      setActiveProject(sel.value);
    });
    const stage = el('select', { class: 'dropdown' }, STAGES.map((s) => el('option', { selected: s === p.stage }, s)));
    stage.addEventListener('change', () => setProjectField(p, 'stage', stage.value));
    const cov = resourceUrl(p.cover);
    put(root, el('div', { class: 'ds-head' },
      el('div', { class: 'ds-cover-sm', onclick: () => this.setTab('details'), title: 'Book details' }, cov ? el('img', { src: cov }) : el('span', {}, p.title.slice(0, 1))),
      el('div', { class: 'ds-head-main' }, el('div', { class: 'ds-row' }, sel, btn('📚 Books & series', () => openLibrary(), 'ds-sm'), linkedNovel(p) ? pill('🧵 ' + linkedNovel(p).title, 'is-pw', null) : null),
        el('h1', {}, p.title), el('div', { class: 'ds-sub' }, [seriesLine(p), p.genre, p.penName || p.author].filter(Boolean).join(' · '))),
      el('div', { class: 'ds-draftbox' }, el('small', {}, 'Manuscript draft'), el('div', { class: 'ds-draftline' }, el('b', {}, '#' + p.draft), el('span', { class: 'ds-draftwords', title: 'Total words in the manuscript (ideas not counted)' }, `${fmtN(totalWords(p))} words`)), stage)));
    put(root, el('div', { class: 'ds-tabs' }, DS_TABS.map(([k, l]) => el('button', { class: ui.tab === k ? 'is-on' : '', onclick: () => this.setTab(k) }, l))));
    const body = el('div', { class: 'ds-body' }); put(root, body);
    try {
      ({ manuscript: renderManuscript, details: renderDetails, readers: renderReaders, checklist: renderChecklist, stats: renderStats, compile: renderCompile })[ui.tab](this, p, body);
    } catch (e) { console.error(e); put(body, el('p', { class: 'ds-warn' }, 'Something went wrong drawing this tab: ' + e.message)); }
    root.scrollTop = scroll;
  }
}

/* ---------------- Manuscript tab ---------------- */
function renderManuscript(view, p, body) {
  const chs = listChapters(p); const tw = chs.filter((c) => !isIdea(c)).reduce((a, c) => a + (c.words || 0), 0); const pct = p.targetWords ? Math.min(100, Math.round((tw / p.targetWords) * 100)) : 0;
  const cur = p.rounds[p.rounds.length - 1]; const next = nextDatedStep(p); const novel = linkedNovel(p);
  const counts = {}; for (const c of chs.filter((x) => !isIdea(x))) { const d = statusDef(c.status); const k = d ? d.name : c.status || 'No status'; counts[k] = (counts[k] || 0) + 1; }
  put(body, el('div', { class: 'ds-stats' },
    el('div', { class: 'ds-stat' }, el('small', {}, 'Words'), el('b', {}, fmtN(tw)), el('span', {}, `of ${fmtN(p.targetWords)} · ${pct}%`), el('div', { class: 'ds-bar' }, el('i', { style: { width: pct + '%' } }))),
    el('div', { class: 'ds-stat' }, el('small', {}, 'Chapters'), el('b', {}, String(chs.filter((c) => c.kind === 'chapter').length)), el('span', {}, [chs.filter((c) => !['chapter', 'idea'].includes(c.kind)).map((c) => c.label.toLowerCase()).join(', '), chs.some(isIdea) ? `${chs.filter(isIdea).length} idea${chs.filter(isIdea).length === 1 ? '' : 's'}` : '', Object.entries(counts).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(' · ')].filter(Boolean).join(' · ') || 'none yet')),
    el('div', { class: 'ds-stat is-click', onclick: () => { if (cur) DS().ui.round = cur.id; view.setTab('readers'); } }, el('small', {}, cur ? `${cur.name} · ${cur.version}` : 'Readers'), el('b', {}, cur ? `${cur.sends.filter((s) => s.status === 'Feedback in').length}/${cur.sends.length}` : '—'), el('span', {}, cur ? `feedback in · ${p.comments.filter((c) => c.round === cur.id && !c.resolved).length} open notes` : 'no reader rounds yet')),
    el('div', { class: 'ds-stat is-click', onclick: () => { if (next) p.checklistTab = next.list; view.setTab('checklist'); } }, el('small', {}, next ? `Next step · ${CHECKLIST_NAMES[next.list]}` : 'Next step'), el('b', { class: 'is-text' }, next ? next.it.t : 'Nothing dated'), el('span', {}, next ? `${next.it.due} · ${daysText(next.it.due)}` : 'add target dates in the checklist'))));

  const plotOrder = DSS().followPlotOrder && novel;
  const tools = el('div', { class: 'ds-row' }, el('h2', { class: 'ds-grow' }, 'Chapters'),
    btn('+ New chapter', () => newChapterModal(p)), btn('💡 New idea', () => newChapterModal(p, 'idea')),
    novel ? btn('↻ Chapters from Plot Weaver', async () => { const n = await chaptersFromPlot(p); notice(n ? `Created ${n} chapter note${n === 1 ? '' : 's'} from Plot Weaver.` : 'Every Plot Weaver chapter already has a note.'); setTimeout(() => view.render(), 400); }, '', 'Create a note for each Plot Weaver chapter that has none') : null,
    btn('⇪ Import chapter notes', () => new ImportChaptersModal(p).open(), '', 'Turn notes you already have into chapters'),
    btn('Draft history', () => draftHistoryModal(p)),
    btn(`Start draft #${p.draft + 1}`, () => new FormModal(`Start manuscript draft #${p.draft + 1}`, [{ key: 'note', label: 'What is this draft for?', placeholder: 'e.g. Post-beta revision' }, { key: 'bump', label: 'Also add 1 to every chapter’s draft number', type: 'checkbox', value: false }], 'Start draft', (v) => startManuscriptDraft(p, v.note, v.bump),
      `A read-only copy of all ${chs.length} chapter notes is saved to ${projectSub(p, 'snapshotFolder')}/Draft ${p.draft}/ first.`).open(), 'mod-cta'));
  put(body, tools);
  if (!chs.length) {
    put(body, card(null, el('p', {}, `No chapter notes yet. Draftsmith looks for notes in `, el('code', {}, chaptersFolder(p)), '.'),
      el('div', { class: 'ds-row' }, btn('⇪ Import existing chapter notes…', () => new ImportChaptersModal(p).open(), 'mod-cta'), novel ? btn('↻ Chapters from Plot Weaver', async () => { await chaptersFromPlot(p); setTimeout(() => view.render(), 400); }) : null, btn('+ New chapter', () => newChapterModal(p))),
      hint('Already writing in Obsidian? Import moves your chapter notes into this book (links stay intact) or uses their folder as is.')));
    return;
  }
  const K = DSS().keys; const sk = statusKey();
  const tbl = el('table', { class: 'ds-table ds-chtable' }, el('thead', {}, el('tr', {}, ['', '#', 'Chapter', 'Type', 'Draft', 'Status', 'Words', 'POV', 'Plot Weaver', ''].map((x) => el('th', {}, x)))));
  let dragFrom = null;
  const tb = el('tbody'); put(tbl, tb);
  chs.forEach((c, i) => {
    const st = el('select', { class: 'dropdown ds-st' }, el('option', { value: '' }, '—'), statusDefs().map((d) => el('option', { selected: statusDef(c.status)?.name === d.name }, d.name)), c.status && !statusDef(c.status) ? el('option', { selected: true }, c.status) : null);
    const def = statusDef(c.status); if (def) st.style.setProperty('--c', def.color || '#888');
    st.addEventListener('change', () => setFm(c.file, (fm) => { fm[sk] = st.value; }));
    const cards = cardsForChapter(p, c);
    const kind = el('select', { class: 'dropdown ds-kind' }, DS_KINDS.map((k) => el('option', { value: k, selected: c.kind === k }, (k === 'idea' ? '💡 ' : '') + KIND_LABEL[k])));
    kind.addEventListener('change', () => setChapterKind(p, c, kind.value));
    const tr = el('tr', { class: 'ds-drag-row is-' + c.kind, draggable: 'true' },
      el('td', { class: 'ds-grip', title: 'Drag to reorder' }, '⋮⋮'),
      el('td', { class: 'ds-num' }, c.kind === 'chapter' ? String(c.num) : el('span', { class: 'ds-kindlabel', title: c.label }, KIND_SHORT[c.kind])),
      el('td', {}, el('a', { class: 'ds-link', onclick: () => openFile(c.file) }, c.title)),
      el('td', {}, kind),
      el('td', {}, pill('D' + c.draft, 'is-draft'), el('a', { class: 'ds-mini', title: 'Save this version and start the next chapter draft', onclick: async () => { await bumpChapterDraft(p, c); } }, '+')),
      el('td', {}, st), el('td', { class: 'ds-r', title: isIdea(c) ? 'Ideas don’t count toward the manuscript’s words' : null }, c.words == null ? '—' : isIdea(c) ? `(${fmtN(c.words)})` : fmtN(c.words)), el('td', { class: 'ds-povcell' }, povCell(c, cards)),
      el('td', {}, isIdea(c) ? hint('idea · not linked') : cards.length ? cards.slice(0, 4).map((x) => el('span', { class: 'ds-pw', title: `${x.plotline ? x.plotline.name + ': ' : ''}${x.b.title}${x.pov ? ' · POV ' + x.pov.name : ''} — open on the board`, onclick: () => HOST.plot.openBoard(novel.id, x.b.id) }, el('i', { style: { background: (x.plotline && x.plotline.color) || '#888' } }), x.b.title.length > 28 ? x.b.title.slice(0, 27) + '…' : x.b.title)) : c.pwChapter ? hint('no cards') : el('a', { class: 'ds-mini', onclick: () => linkChapterToPlot(p, c) }, novel ? 'link…' : '—')),
      el('td', {}, el('a', { class: 'ds-mini', title: 'Open', onclick: () => openFile(c.file) }, '↗')));
    tr.addEventListener('dragstart', (e) => { dragFrom = i; tr.addClass('is-dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(i)); } catch (x) { /* */ } });
    tr.addEventListener('dragend', () => tr.removeClass('is-dragging'));
    tr.addEventListener('dragover', (e) => { if (dragFrom == null) return; e.preventDefault(); tr.addClass('is-over'); });
    tr.addEventListener('dragleave', () => tr.removeClass('is-over'));
    tr.addEventListener('drop', async (e) => { e.preventDefault(); tr.removeClass('is-over'); const from = dragFrom; dragFrom = null; if (from == null || from === i) return; const a = chs.slice(); const [x] = a.splice(from, 1); a.splice(i, 0, x); await reorderChapters(p, a); });
    put(tb, tr);
  });
  put(body, el('div', { class: 'ds-tablewrap' }, tbl));
  put(body, hint(`Drag rows by ⋮⋮ to reorder. Only chapters are numbered: P = prologue, I = interlude, E = epilogue, 💡 = idea. Status and words use Plot Weaver’s fields (“${sk}”, “${wordsKey()}”), so all three sections read the same properties.${plotOrder ? ' Reordering here also reorders the Plot Weaver board, and type changes are shared with it.' : ''}`));
}
function daysText(iso) { const d = daysUntil(iso); return d == null ? '' : d < 0 ? `${-d} days overdue` : d === 0 ? 'today' : `in ${d} days`; }
function nextDatedStep(p) {
  const all = []; for (const [list, gs] of Object.entries(p.checklists)) for (const g of gs) for (const it of g.items) if (it.due && !itemDone(p, it)) all.push({ list, it });
  return all.sort((a, b) => a.it.due.localeCompare(b.it.due))[0] || null;
}
function draftHistoryModal(p) {
  const m = new Modal(SG.app); m.contentEl.addClass('ds-modal');
  put(m.contentEl, el('h3', {}, 'Manuscript draft history'), el('div', { class: 'ds-hist' }, p.draftHistory.map((h) => el('div', {}, el('span', {}, el('b', {}, `Draft ${h.n}`), ' · ', h.note || ''), el('span', { class: 'ds-hint' }, `${h.date} · ${h.words == null ? 'in progress' : fmtN(h.words) + ' words'}`)))),
    hint(`Snapshots of earlier drafts are in ${projectSub(p, 'snapshotFolder')}/.`));
  m.open();
}
/** POV: the note's own pov property if set; otherwise the POV tags of its Plot Weaver cards. */
function povCell(c, cards) {
  const seen = new Map(); for (const x of cards) if (x.pov && !seen.has(x.pov.id)) seen.set(x.pov.id, x.pov);
  const tags = [...seen.values()];
  if (c.pov) return el('span', { title: tags.length ? `From the note’s “${DSS().keys.pov}” property · Plot Weaver: ${tags.map((t) => t.name).join(', ')}` : `From the note’s “${DSS().keys.pov}” property` }, c.pov);
  if (!tags.length) return '—';
  return el('span', { class: 'ds-povtags', title: 'POV tags from this chapter’s Plot Weaver cards' }, tags.map((t) => el('span', { class: 'ds-pov' }, el('i', { style: { background: t.color || '#888' } }), t.name)));
}
function newChapterModal(p, preset = 'chapter') {
  new FormModal(preset === 'idea' ? 'New idea' : 'New chapter', [
    { key: 'title', label: 'Title', required: true },
    { key: 'kind', label: 'Type', type: 'select', options: DS_KINDS.map((k) => [k, KIND_LABEL[k]]), value: preset, desc: 'An Idea isn’t numbered or linked to Plot Weaver and doesn’t count toward words. Put it anywhere; turn it into a chapter later.' },
    { key: 'pov', label: 'POV (optional)' },
  ], 'Create', async (v) => {
    const f = await createChapter(p, v.title.trim(), { pov: v.pov, kind: v.kind });
    // prologues go first; everything else goes last
    if (v.kind === 'prologue') { await new Promise((r) => setTimeout(r, 150)); const chs = listChapters(p); const me = chs.find((c) => c.file.path === f.path); if (me) await reorderChapters(p, [me, ...chs.filter((c) => c !== me)]); }
    openFile(f);
  }).open();
}
function linkChapterToPlot(p, c) {
  const n = linkedNovel(p); if (!n) return;
  const secs = (n.chapters || []).filter((x) => SCENE_KINDS.includes(x.kind || 'chapter'));
  const used = new Set(listChapters(p).map((x) => x.pwChapter).filter(Boolean));
  new FormModal(`Link “${c.title}” to Plot Weaver`, [{ key: 'id', label: 'Plot Weaver chapter', type: 'select', options: [['__new', `+ New board chapter “${titleFromName(c.title)}” here`], ...secs.filter((x) => !used.has(x.id)).map((x) => [x.id, `${x.title} (${KIND_LABEL[x.kind || 'chapter']})`])] }], 'Link', (v) => linkToPlot(p, c, v.id)).open();
}
