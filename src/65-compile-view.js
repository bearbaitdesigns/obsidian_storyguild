/* =====================================================================
   Publish tab
   ===================================================================== */
function renderCompile(view, p, body) {
  const o = p.compile; const chs = listChapters(p); const sel = compileChapters(p);
  const set = (k, v, redraw = true) => { o[k] = v; SG.saveSoon(); if (redraw) view.render(); };
  const toggle = (k, label, desc) => el('div', { class: 'ds-opt' }, el('div', {}, el('div', {}, label), desc ? el('small', { class: 'ds-hint' }, desc) : null),
    ((c) => { c.addEventListener('change', () => set(k, c.checked)); return c; })(el('input', { type: 'checkbox', checked: !!o[k] })));
  const select = (k, label, options) => el('div', { class: 'ds-opt' }, el('div', {}, label), ((s) => { s.addEventListener('change', () => set(k, s.value)); return s; })(el('select', { class: 'dropdown' }, options.map((x) => { const [v, l] = Array.isArray(x) ? x : [x, x]; return el('option', { value: v, selected: String(o[k]) === String(v) }, l); }))));
  const textOpt = (k, label, ph) => el('div', { class: 'ds-opt' }, el('div', {}, label), ((i) => { i.addEventListener('change', () => set(k, i.value, false)); return i; })(el('input', { type: 'text', value: o[k] || '', placeholder: ph || '' })));

  body.append(el('p', { class: 'ds-hint' }, 'Stitch your chapter notes into one book. Properties, comments, callouts and Obsidian links are left out; *italics* and **bold** are kept, and scene breaks (***, ---, #) become your scene-break mark.'));
  const grid = el('div', { class: 'ds-pubgrid' }); body.append(grid);
  const left = el('div', {});
  left.append(card('Format', el('div', { class: 'ds-fmt' }, [['pdf', 'PDF', 'print & share'], ['docx', 'Word', '.docx'], ['epub', 'EPUB', 'e-readers'], ['md', 'Markdown', 'one note']].map(([k, l, s]) =>
    el('button', { class: o.format === k ? 'is-on' : '', onclick: () => set('format', k) }, el('b', {}, l), el('small', {}, s))))));
  const pick = o.chapters === 'pick' ? el('div', { class: 'ds-pick' }, chs.map((c) => el('label', {}, ((cb) => { cb.addEventListener('change', () => { const s2 = new Set(o.picked || []); cb.checked ? s2.add(c.file.path) : s2.delete(c.file.path); o.picked = [...s2]; SG.saveSoon(); view.render(); }); return cb; })(el('input', { type: 'checkbox', checked: (o.picked || []).includes(c.file.path) })), ` ${c.label}. ${c.title}`))) : null;
  left.append(card(`Chapters · ${sel.length} of ${chs.length}`,
    select('chapters', 'Include', [['all', 'All chapters'], ['status', 'Chapters with a status…'], ['pick', 'Let me pick']]),
    o.chapters === 'status' ? select('statusFilter', 'Status', [['', '—'], ...statusDefs().map((d) => d.name)]) : null, pick,
    textOpt('heading', 'Chapter heading', '{n} number · {N} in words · {title}'), select('sceneBreak', 'Scene break', ['* * *', '#', '~', '⁂', '❧', '§'])));
  const msfAllowed = o.format === 'pdf' || o.format === 'docx';
  left.append(card('Layout',
    msfAllowed ? toggle('manuscriptFormat', 'Standard manuscript format', 'Courier 12, double-spaced, 1-inch margins, name / TITLE / page header — what agents and editors expect.') : null,
    msfAllowed && o.manuscriptFormat ? [textOpt('contact', 'Contact block (title page)', 'email · phone · agent'), textOpt('shortTitle', 'Short title for the header', p.title)] : null,
    !(msfAllowed && o.manuscriptFormat) ? [toggle('titlePage', 'Title page'), toggle('toc', 'Table of contents'), toggle('frontMatter', 'Copyright, dedication, acknowledgments & author bio', 'Taken from Book details')] : null,
    msfAllowed && !o.manuscriptFormat ? [select('pageSize', 'Page size', [['6x9', '6 × 9 in (trade)'], ['5.5x8.5', '5.5 × 8.5 in'], ['5x8', '5 × 8 in'], ['letter', 'US Letter'], ['a4', 'A4']]), select('fontSize', 'Font size', ['10', '10.5', '11', '11.5', '12'].map((x) => [x, x + ' pt']))] : null,
    o.format === 'docx' && !o.manuscriptFormat ? select('font', 'Font', ['Times', 'Garamond', 'Georgia']) : null,
    toggle('draftStamp', 'Stamp the draft number', `Adds “Draft ${p.draft}” to the copyright page and file name`),
    toggle('smartQuotes', 'Curly quotes and dashes', 'Turns "straight" quotes into “curly” ones and -- into —'),
    textOpt('folder', 'Save to folder', projectSub(p, 'compiledFolder'))));
  // reader questions
  const qRounds = roundsForPublish(p);
  left.append(card('Reader questions',
    qRounds.length ? [toggle('includeQuestions', 'Add reader questions at the end', 'For alpha and beta reader copies'),
      o.includeQuestions ? select('questionsRound', 'Questions from', qRounds.map((r) => [r.id, `${r.name} (${r.questions.length})`]).reverse()) : null]
      : hint(p.rounds.some((r) => r.questions.length) ? 'Your rounds have questions, but none are set to “Include in Publish”. Turn that on in Readers.' : 'Add questions to a reader round (Readers tab) to offer them here.')));
  left.append(el('div', { class: 'ds-row' }, btn(`Publish ${({ pdf: 'PDF', docx: 'Word', epub: 'EPUB', md: 'Markdown' })[o.format]}`, async (e) => { e.target.disabled = true; try { await compileProject(p); } catch (err) { console.error(err); notice('Publishing failed: ' + err.message); } view.render(); }, 'mod-cta ds-big')));

  // right: preview + recent
  const right = el('div', {});
  right.append(previewPage(p, sel));
  if ((p.lastCompiled || []).length) right.append(card('Recently published', (p.lastCompiled || []).map((x) => { const f = app().vault.getAbstractFileByPath(x.path);
    return el('div', { class: 'ds-row ds-recent' }, f ? el('a', { class: 'ds-link', onclick: () => openFile(f) }, x.path.split('/').pop()) : el('span', { class: 'ds-hint' }, x.path.split('/').pop() + ' (moved)'), el('small', { class: 'ds-hint' }, `${new Date(x.at).toLocaleString()} · ${fmtN(x.words)} words`)); })));
  grid.append(left, right);
}

/** A rough look at the first page, so the options feel concrete. */
function previewPage(p, sel) {
  const o = p.compile; const msf = o.manuscriptFormat && (o.format === 'pdf' || o.format === 'docx');
  const page = el('div', { class: 'ds-page' + (msf ? ' is-msf' : '') + (o.format === 'epub' ? ' is-epub' : '') });
  const first = sel[0];
  if (o.format === 'epub' && p.cover && resourceUrl(p.cover)) page.append(el('img', { class: 'ds-page-cover', src: resourceUrl(p.cover) }));
  if (o.titlePage || msf) page.append(el('div', { class: 'ds-page-title' }, el('b', {}, msf ? p.title.toUpperCase() : p.title), p.subtitle ? el('i', {}, p.subtitle) : null, el('span', {}, (msf ? 'by ' : '') + (p.penName || p.author || 'Author'))));
  if (first) {
    page.append(el('h4', {}, first.kind === 'chapter' ? chapterHeading(o.heading, 1, first.title) : sectionHeading(first)));
    const holder = el('div', { class: 'ds-page-text' }); page.append(holder);
    app().vault.cachedRead(first.file).then((md) => { const bl = mdToBlocks(md, first.title, { smart: o.smartQuotes !== false }).slice(0, 6);
      for (const b of bl) holder.append(b.t === 'break' ? el('div', { class: 'ds-page-brk' }, o.sceneBreak) : b.t === 'h' ? el('b', {}, b.text) : el('p', { class: b.first ? 'is-first' : '' }, b.runs.map((r) => (r.i ? el('em', {}, r.text) : r.b ? el('b', {}, r.text) : r.text)))); });
  } else page.append(el('p', { class: 'ds-hint' }, 'No chapters selected.'));
  return el('div', {}, el('div', { class: 'ds-hint ds-center' }, 'Preview'), page);
}
