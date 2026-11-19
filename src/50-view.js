/* =====================================================================
   Draftsmith view: header + tabs
   ===================================================================== */
const DS_TABS = [['manuscript', 'Manuscript', 'book-open'], ['details', 'Book details', 'id-card'], ['readers', 'Readers', 'users'], ['checklist', 'Publishing checklist', 'list-checks'], ['compile', 'Publish', 'file-output']];
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
  async onClose() { this.contentEl.empty(); }
  setTab(t) { DS().ui.tab = t; SG.saveSoon(); this.render(); }

  render() {
    const root = this.contentEl; const scroll = root.scrollTop; root.empty(); root.addClass('ds-root');
    const p = ensureProject(); const ui = DS().ui; if (!DS_TABS.some((t) => t[0] === ui.tab)) ui.tab = 'manuscript';
    // header
    const sel = el('select', { class: 'dropdown ds-proj' }, DS().projects.map((x) => el('option', { value: x.id, selected: x.id === p.id }, x.title)), el('option', { value: '__new' }, '+ New project…'));
    sel.addEventListener('change', () => {
      if (sel.value === '__new') { sel.value = p.id; new FormModal('New project', [{ key: 'title', label: 'Title', required: true }], 'Create', (v) => { const np = makeProject(v.title.trim()); DS().projects.push(np); DS().activeId = np.id; SG.saveSoon(); SG.refreshAll(); }).open(); return; }
      DS().activeId = sel.value; SG.saveSoon(); SG.refreshAll(); syncRoundsToWorld();
    });
    const stage = el('select', { class: 'dropdown' }, STAGES.map((s) => el('option', { selected: s === p.stage }, s)));
    stage.addEventListener('change', () => setProjectField(p, 'stage', stage.value));
    const cov = resourceUrl(p.cover);
    root.append(el('div', { class: 'ds-head' },
      el('div', { class: 'ds-cover-sm', onclick: () => this.setTab('details'), title: 'Book details' }, cov ? el('img', { src: cov }) : el('span', {}, p.title.slice(0, 1))),
      el('div', { class: 'ds-head-main' }, el('div', { class: 'ds-row' }, sel, linkedNovel(p) ? pill('🧵 ' + linkedNovel(p).title, 'is-pw', null) : null),
        el('h1', {}, p.title), el('div', { class: 'ds-sub' }, [p.series ? `${p.series}${p.seriesNo ? ' #' + p.seriesNo : ''}` : '', p.genre, p.penName || p.author].filter(Boolean).join(' · '))),
      el('div', { class: 'ds-draftbox' }, el('small', {}, 'Manuscript draft'), el('b', {}, '#' + p.draft), stage)));
    root.append(el('div', { class: 'ds-tabs' }, DS_TABS.map(([k, l]) => el('button', { class: ui.tab === k ? 'is-on' : '', onclick: () => this.setTab(k) }, l))));
    const body = el('div', { class: 'ds-body' }); root.append(body);
    try {
      ({ manuscript: renderManuscript, details: renderDetails, readers: renderReaders, checklist: renderChecklist, compile: renderCompile })[ui.tab](this, p, body);
    } catch (e) { console.error(e); body.append(el('p', { class: 'ds-warn' }, 'Something went wrong drawing this tab: ' + e.message)); }
    root.scrollTop = scroll;
  }
}

/* ---------------- Manuscript tab ---------------- */
function renderManuscript(view, p, body) {
  const chs = listChapters(p); const tw = chs.reduce((a, c) => a + (c.words || 0), 0); const pct = p.targetWords ? Math.min(100, Math.round((tw / p.targetWords) * 100)) : 0;
  const cur = p.rounds[p.rounds.length - 1]; const next = nextDatedStep(p); const novel = linkedNovel(p);
  const counts = {}; for (const c of chs) { const d = statusDef(c.status); const k = d ? d.name : c.status || 'No status'; counts[k] = (counts[k] || 0) + 1; }
  body.append(el('div', { class: 'ds-stats' },
    el('div', { class: 'ds-stat' }, el('small', {}, 'Words'), el('b', {}, fmtN(tw)), el('span', {}, `of ${fmtN(p.targetWords)} · ${pct}%`), el('div', { class: 'ds-bar' }, el('i', { style: { width: pct + '%' } }))),
    el('div', { class: 'ds-stat' }, el('small', {}, 'Chapters'), el('b', {}, String(chs.length)), el('span', {}, Object.entries(counts).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(' · ') || 'none yet')),
    el('div', { class: 'ds-stat is-click', onclick: () => { if (cur) DS().ui.round = cur.id; view.setTab('readers'); } }, el('small', {}, cur ? `${cur.name} · ${cur.version}` : 'Readers'), el('b', {}, cur ? `${cur.sends.filter((s) => s.status === 'Feedback in').length}/${cur.sends.length}` : '—'), el('span', {}, cur ? `feedback in · ${p.comments.filter((c) => c.round === cur.id && !c.resolved).length} open notes` : 'no reader rounds yet')),
    el('div', { class: 'ds-stat is-click', onclick: () => { if (next) p.checklistTab = next.list; view.setTab('checklist'); } }, el('small', {}, next ? `Next step · ${CHECKLIST_NAMES[next.list]}` : 'Next step'), el('b', { class: 'is-text' }, next ? next.it.t : 'Nothing dated'), el('span', {}, next ? `${next.it.due} · ${daysText(next.it.due)}` : 'add target dates in the checklist'))));

  const plotOrder = DSS().followPlotOrder && novel;
  const tools = el('div', { class: 'ds-row' }, el('h2', { class: 'ds-grow' }, 'Chapters'),
    btn('+ New chapter', () => new FormModal('New chapter', [{ key: 'title', label: 'Title', required: true }, { key: 'pov', label: 'POV (optional)' }], 'Create', async (v) => { const f = await createChapter(p, v.title.trim(), { pov: v.pov }); openFile(f); }).open()),
    novel ? btn('↻ Chapters from Plot Weaver', async () => { const n = await chaptersFromPlot(p); notice(n ? `Created ${n} chapter note${n === 1 ? '' : 's'} from Plot Weaver.` : 'Every Plot Weaver chapter already has a note.'); setTimeout(() => view.render(), 400); }, '', 'Create a note for each Plot Weaver chapter that has none') : null,
    btn('Draft history', () => draftHistoryModal(p)),
    btn(`Start draft #${p.draft + 1}`, () => new FormModal(`Start manuscript draft #${p.draft + 1}`, [{ key: 'note', label: 'What is this draft for?', placeholder: 'e.g. Post-beta revision' }, { key: 'bump', label: 'Also add 1 to every chapter’s draft number', type: 'checkbox', value: false }], 'Start draft', (v) => startManuscriptDraft(p, v.note, v.bump),
      `A read-only copy of all ${chs.length} chapter notes is saved to ${projectSub(p, 'snapshotFolder')}/Draft ${p.draft}/ first.`).open(), 'mod-cta'));
  body.append(tools);
  if (!chs.length) {
    body.append(card(null, el('p', {}, `No chapter notes yet. Draftsmith looks for notes in `, el('code', {}, chaptersFolder(p)), '.'),
      hint('Create chapters here, move existing chapter notes into that folder, or point the project at another folder in Book details → Project.')));
    return;
  }
  const K = DSS().keys; const sk = statusKey();
  const tbl = el('table', { class: 'ds-table' }, el('thead', {}, el('tr', {}, ['#', 'Chapter', 'Draft', 'Status', 'Words', 'POV', 'Plot Weaver', 'Notes', ''].map((x) => el('th', {}, x)))));
  const tb = el('tbody'); tbl.append(tb);
  chs.forEach((c, i) => {
    const st = el('select', { class: 'dropdown ds-st' }, el('option', { value: '' }, '—'), statusDefs().map((d) => el('option', { selected: statusDef(c.status)?.name === d.name }, d.name)), c.status && !statusDef(c.status) ? el('option', { selected: true }, c.status) : null);
    const def = statusDef(c.status); if (def) st.style.setProperty('--c', def.color || '#888');
    st.addEventListener('change', () => setFm(c.file, (fm) => { fm[sk] = st.value; }));
    const cards = cardsForChapter(p, c); const open = p.comments.filter((x) => x.ch === c.file.path && !x.resolved).length;
    const move = (d) => async () => { const a = chs.slice(); const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; a.forEach((x, k) => { x.n = k + 1; }); await renumberChapters(a); };
    tb.append(el('tr', {},
      el('td', { class: 'ds-num' }, String(c.n), plotOrder ? null : el('span', { class: 'ds-move' }, el('a', { onclick: move(-1), title: 'Move up' }, '↑'), el('a', { onclick: move(1), title: 'Move down' }, '↓'))),
      el('td', {}, el('a', { class: 'ds-link', onclick: () => openFile(c.file) }, c.title)),
      el('td', {}, pill('D' + c.draft, 'is-draft'), el('a', { class: 'ds-mini', title: 'Save this version and start the next chapter draft', onclick: async () => { await bumpChapterDraft(p, c); } }, '+')),
      el('td', {}, st), el('td', { class: 'ds-r' }, c.words == null ? '—' : fmtN(c.words)), el('td', {}, c.pov || '—'),
      el('td', {}, cards.length ? cards.slice(0, 4).map((x) => el('span', { class: 'ds-pw', title: `${x.plotline ? x.plotline.name + ': ' : ''}${x.b.title}${x.pov ? ' · POV ' + x.pov.name : ''} — open on the board`, onclick: () => HOST.plot.openBoard(novel.id, x.b.id) }, el('i', { style: { background: (x.plotline && x.plotline.color) || '#888' } }), x.b.title.length > 28 ? x.b.title.slice(0, 27) + '…' : x.b.title)) : c.pwChapter ? hint('no cards') : el('a', { class: 'ds-mini', onclick: () => linkChapterToPlot(p, c) }, novel ? 'link…' : '—')),
      el('td', {}, open ? pill(`${open} open`, 'is-warn') : '—'),
      el('td', {}, el('a', { class: 'ds-mini', title: 'Open', onclick: () => openFile(c.file) }, '↗'))));
  });
  body.append(el('div', { class: 'ds-tablewrap' }, tbl));
  body.append(hint(`Status and words use Plot Weaver’s fields (“${sk}”, “${wordsKey()}”), so all three sections read the same properties. ${plotOrder ? 'Order follows the Plot Weaver board; reorder chapters there.' : `Order comes from the “${K.chapter}” property.`}`));
}
function daysText(iso) { const d = daysUntil(iso); return d == null ? '' : d < 0 ? `${-d} days overdue` : d === 0 ? 'today' : `in ${d} days`; }
function nextDatedStep(p) {
  const all = []; for (const [list, gs] of Object.entries(p.checklists)) for (const g of gs) for (const it of g.items) if (it.due && !itemDone(p, it)) all.push({ list, it });
  return all.sort((a, b) => a.it.due.localeCompare(b.it.due))[0] || null;
}
function draftHistoryModal(p) {
  const m = new Modal(SG.app); m.contentEl.addClass('ds-modal');
  m.contentEl.append(el('h3', {}, 'Manuscript draft history'), el('div', { class: 'ds-hist' }, p.draftHistory.map((h) => el('div', {}, el('span', {}, el('b', {}, `Draft ${h.n}`), ' · ', h.note || ''), el('span', { class: 'ds-hint' }, `${h.date} · ${h.words == null ? 'in progress' : fmtN(h.words) + ' words'}`)))),
    hint(`Snapshots of earlier drafts are in ${projectSub(p, 'snapshotFolder')}/.`));
  m.open();
}
function linkChapterToPlot(p, c) {
  const n = linkedNovel(p); if (!n) return;
  const secs = (n.chapters || []).filter((x) => SCENE_KINDS.includes(x.kind || 'chapter'));
  new FormModal(`Link “${c.title}” to Plot Weaver`, [{ key: 'id', label: 'Plot Weaver chapter', type: 'select', options: secs.map((x) => [x.id, x.title]) }], 'Link', (v) => setFm(c.file, (fm) => { fm[DSS().keys.pwChapter] = v.id; })).open();
}
