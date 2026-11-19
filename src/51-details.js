/* =====================================================================
   Book details tab — the shared metadata
   ===================================================================== */
const META = [
  ['Title & author', [['title', 'Title'], ['subtitle', 'Subtitle'], ['author', 'Legal author name'], ['penName', 'Pen name (on the cover)']]],
  ['Category', [['genre', 'Genre(s), comma-separated'], ['subgenre', 'Subgenre'], ['audience', 'Audience', ['', 'Adult', 'New Adult', 'Young Adult', 'Middle Grade', 'Children']], ['language', 'Language code (e.g. en, en-GB)'], ['targetWords', 'Target word count', 'number'], ['deadline', 'Draft deadline', 'date']]],
  ['Pitch & copy', [['logline', 'Logline / one-line pitch', 'ta2'], ['blurb', 'Back-cover blurb', 'ta6'], ['synopsisShort', 'Short summary (shown on Worldkeeper Home)', 'ta3'], ['synopsis', 'Full synopsis (1–2 pages, for queries)', 'ta8']]],
  ['Market', [['comps', 'Comparable titles'], ['keywords', 'Keywords (comma-separated)'], ['bisac', 'BISAC codes / categories']]],
  ['Publication', [['publisher', 'Publisher / imprint'], ['isbnEbook', 'ISBN — ebook'], ['isbnPrint', 'ISBN — print'], ['pubDate', 'Publication date', 'date'], ['copyright', 'Copyright year']]],
  ['Front & back matter', [['dedication', 'Dedication', 'ta2'], ['acknowledgments', 'Acknowledgments', 'ta4'], ['bio', 'About the author', 'ta4']]],
];
const SHARED_HINT = { title: 'Worldkeeper · Plot Weaver', genre: 'Worldkeeper', audience: 'Worldkeeper', logline: 'Worldkeeper', synopsisShort: 'Worldkeeper', targetWords: 'Worldkeeper', deadline: 'Worldkeeper' };

function renderDetails(view, p, body) {
  const all = META.flatMap((s) => s[1]); const filled = all.filter(([k]) => String(p[k] ?? '').trim()).length + (p.cover ? 1 : 0);
  body.append(el('div', { class: 'ds-row' }, el('p', { class: 'ds-hint ds-grow' }, 'One set of book details for the whole plugin. Fields marked ⇄ are shared with Worldkeeper or Plot Weaver; edit them anywhere and they change everywhere.'),
    el('div', { class: 'ds-meter' }, el('small', {}, `${filled}/${all.length + 1} filled`), el('div', { class: 'ds-bar' }, el('i', { style: { width: (filled / (all.length + 1)) * 100 + '%' } })))));
  const grid = el('div', { class: 'ds-meta' }); body.append(grid);
  // left column: cover, project, custom fields
  const cov = resourceUrl(p.cover);
  const left = el('div', {},
    card('Cover', el('div', { class: 'ds-cover' }, cov ? el('img', { src: cov }) : el('div', { class: 'ds-cover-ph' }, el('b', {}, p.title), el('span', {}, p.penName || p.author || ''))),
      el('div', { class: 'ds-row ds-center' },
        btn('Choose from vault', () => new FilePick((f) => IMAGE_EXT.includes(f.extension.toLowerCase()), (f) => setProjectField(p, 'cover', f.path), 'Choose a cover image…').open()),
        btn('Upload…', async () => { const [f] = await chooseLocalFiles('image/*', false); if (!f) return; const path = await saveLocalFile(f, projectSub(p, 'assetsFolder')); setProjectField(p, 'cover', path); }),
        p.cover ? btn('Remove', () => setProjectField(p, 'cover', '')) : null),
      hint('Used as the EPUB cover, on the Draftsmith header and as the Worldkeeper Home banner when that has none. Ebook stores like 1600 × 2560 px.'), p.cover ? el('code', { class: 'ds-path' }, p.cover) : null),
    projectCard(view, p),
    card('Your own fields', hint('Anything else you track for this book: content warnings, trim size, narrator…'),
      ...p.extra.map((x, i) => el('div', { class: 'ds-row ds-kv' },
        ((k) => { k.addEventListener('change', () => { x.k = k.value.trim(); SG.saveSoon(); }); return k; })(el('input', { type: 'text', value: x.k, placeholder: 'name' })),
        ((v) => { v.addEventListener('change', () => { x.v = v.value; SG.saveSoon(); }); return v; })(el('input', { type: 'text', value: x.v, placeholder: 'value' })),
        btn('✕', () => { p.extra.splice(i, 1); SG.saveSoon(); view.render(); }, 'clickable-icon'))),
      btn('+ Add field', () => { p.extra.push({ k: '', v: '' }); SG.saveSoon(); view.render(); })));
  const right = el('div', {});
  for (const [sec, fields] of META) {
    const box = el('div', { class: 'ds-form' });
    for (const [k, label, type] of fields) {
      const ta = typeof type === 'string' && type.startsWith('ta'); let i;
      if (Array.isArray(type)) i = el('select', { class: 'dropdown' }, type.map((o) => el('option', { value: o, selected: p[k] === o }, o || '—')));
      else if (ta) i = el('textarea', { rows: type.slice(2) }, p[k] || '');
      else i = el('input', { type: typeof type === 'string' ? type : 'text', value: p[k] ?? '' });
      const wc = ta && ['blurb', 'synopsis', 'synopsisShort', 'bio'].includes(k) ? el('span', { class: 'ds-wc' }, `${countWords(p[k] || '')} words`) : null;
      i.addEventListener('input', () => { if (wc) wc.textContent = `${countWords(i.value)} words`; });
      i.addEventListener('change', () => setProjectField(p, k, type === 'number' ? Number(i.value) || 0 : i.value));
      box.append(el('div', { class: 'ds-field' + (ta ? ' is-wide' : '') }, el('label', {}, label, SHARED_HINT[k] ? el('span', { class: 'ds-shared', title: 'Shared with ' + SHARED_HINT[k] }, ' ⇄') : null, wc), i));
    }
    right.append(card(sec, box));
  }
  grid.append(left, right);
}

function projectCard(view, p) {
  const novels = plotNovels();
  const pwSel = el('select', { class: 'dropdown' }, el('option', { value: '' }, HOST.plot ? '— not linked —' : 'Plot Weaver section is off'), novels.map((n) => el('option', { value: n.id, selected: n.id === p.pwNovelId }, n.title)), HOST.plot ? el('option', { value: '__new' }, '+ New Plot Weaver novel with this title') : null);
  pwSel.addEventListener('change', () => {
    let id = pwSel.value;
    if (id === '__new') { const n = PlotWeaverModule.internals.makeNovel(p.title); HOST.plot.addNovel(n); id = n.id; }
    p.pwNovelId = id; const n = linkedNovel(p); if (n && n.title !== p.title) new ConfirmModal('Use which title?', `The project is “${p.title}” and the Plot Weaver novel is “${n.title}”. Linked titles are kept the same.`, `Use “${p.title}”`, () => setProjectField(p, 'title', p.title), `Use “${n.title}”`, () => setProjectField(p, 'title', n.title)).open();
    SG.saveSoon(); SG.refreshAll();
  });
  const folder = el('input', { type: 'text', value: p.folder }); folder.addEventListener('change', () => { p.folder = normalizePath(folder.value.trim() || p.folder); SG.saveSoon(); view.render(); });
  const chf = el('input', { type: 'text', value: p.chaptersFolder, placeholder: `${p.folder}/Chapters` }); chf.addEventListener('change', () => { p.chaptersFolder = chf.value.trim() ? normalizePath(chf.value.trim()) : ''; SG.saveSoon(); view.render(); });
  const s = seriesOf(p);
  const sSel = el('select', { class: 'dropdown' }, seriesOptions().map(([v, l]) => el('option', { value: v, selected: v === (s ? s.id : '') }, l)));
  sSel.addEventListener('change', () => { if (sSel.value === '__new') { sSel.value = s ? s.id : ''; new FormModal('New series', [{ key: 'name', label: 'Series name', required: true }], 'Create', (v) => addToSeries(p, createSeries(v.name).id)).open(); } else addToSeries(p, sSel.value); });
  const no = s ? el('select', { class: 'dropdown' }, s.books.map((_, i) => el('option', { value: i, selected: i === s.books.indexOf(p.id) }, `Book ${i + 1}`))) : null;
  if (no) no.addEventListener('change', () => addToSeries(p, s.id, Number(no.value)));
  return card('Project',
    el('div', { class: 'ds-field' }, el('label', {}, 'Series ', el('span', { class: 'ds-shared', title: 'Shared with Worldkeeper and Plot Weaver' }, '⇄')), el('div', { class: 'ds-row ds-nowrap' }, sSel, no)),
    el('div', { class: 'ds-row' }, btn('📚 Books & series', () => openLibrary(), 'ds-sm'), btn('+ New book', () => newBookModal(), 'ds-sm')),
    hint('Books in a series share numbering everywhere; in Plot Weaver each book can draw on the books before it.'),
    el('div', { class: 'ds-field' }, el('label', {}, 'Plot Weaver novel'), pwSel), hint('Linked novels share the title, and Plot Weaver chapters can become chapter notes.'),
    el('div', { class: 'ds-field' }, el('label', {}, 'Project folder'), folder), hint('Drafts, readers’ files, assets and compiled books are kept here.'),
    el('div', { class: 'ds-field' }, el('label', {}, 'Chapters folder'), chf), hint('Every note in this folder is a chapter.'),
    el('div', { class: 'ds-row' }, btn('Delete project…', () => new ConfirmModal(`Delete “${p.title}”?`, 'Removes the project from Draftsmith (reader rounds, checklist, book details). Notes and files in the vault are not deleted.', 'Delete', () => {
      DS().projects = DS().projects.filter((x) => x.id !== p.id); DS().activeId = ''; syncSeries(); SG.saveSoon(); SG.refreshAll();
    }).open(), 'mod-warning')));
}
