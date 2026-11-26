/* =====================================================================
   Publish tab
   ===================================================================== */
function renderCompile(view, p, body) {
  const o = p.compile; const chs = listChapters(p); const sel = compileChapters(p);
  const set = (k, v, redraw = true) => { o[k] = v; SG.saveSoon(); if (redraw) view.render(); };
  const toggle = (k, label, desc) => el('div', { class: 'ds-opt' }, el('div', {}, el('div', {}, label), desc ? el('small', { class: 'ds-hint' }, desc) : null),
    ((c) => { c.addEventListener('change', () => set(k, c.checked)); return c; })(el('input', { type: 'checkbox', checked: !!o[k] })));
  const select = (k, label, options) => el('div', { class: 'ds-opt' }, el('div', {}, label), ((s) => { s.addEventListener('change', () => set(k, s.value)); return s; })(el('select', { class: 'dropdown' }, options.map((x) => { const [v, l] = Array.isArray(x) ? x : [x, x]; return el('option', { value: v, selected: String(o[k]) === String(v) }, l); }))));
  const textOpt = (k, label, ph, redraw = true) => el('div', { class: 'ds-opt' }, el('div', {}, label), ((i) => { i.addEventListener('change', () => set(k, i.value, redraw)); return i; })(el('input', { type: 'text', value: o[k] || '', placeholder: ph || '' })));
  const toggleVal = (k, label, desc, value) => el('div', { class: 'ds-opt' }, el('div', {}, el('div', {}, label), desc ? el('small', { class: 'ds-hint' }, desc) : null),
    ((c) => { c.addEventListener('change', () => set(k, c.checked)); return c; })(el('input', { type: 'checkbox', checked: !!value })));

  put(body, el('p', { class: 'ds-hint' }, 'Stitch your chapter notes into one book. Properties, comments, callouts and Obsidian links are left out; *italics* and **bold** are kept, and scene breaks (***, ---, #) become your scene-break mark.'));
  const grid = el('div', { class: 'ds-pubgrid' }); put(body, grid);
  const left = el('div', {});
  put(left, card('Format', el('div', { class: 'ds-fmt' }, [['pdf', 'PDF', 'print & share'], ['docx', 'Word', '.docx'], ['epub', 'EPUB', 'e-readers'], ['md', 'Markdown', 'one note']].map(([k, l, s]) =>
    el('button', { class: o.format === k ? 'is-on' : '', onclick: () => set('format', k) }, el('b', {}, l), el('small', {}, s))))));
  const pick = o.chapters === 'pick' ? el('div', { class: 'ds-pick' }, chs.map((c) => el('label', {}, ((cb) => { cb.addEventListener('change', () => { const s2 = new Set(o.picked || []); cb.checked ? s2.add(c.file.path) : s2.delete(c.file.path); o.picked = [...s2]; SG.saveSoon(); view.render(); }); return cb; })(el('input', { type: 'checkbox', checked: (o.picked || []).includes(c.file.path) })), ` ${c.label}. ${c.title}`))) : null;
  put(left, card(`Chapters · ${sel.length} of ${chs.length}`,
    select('chapters', 'Include', [['all', 'All chapters'], ['status', 'Chapters with a status…'], ['pick', 'Let me pick']]),
    o.chapters === 'status' ? select('statusFilter', 'Status', [['', '—'], ...statusDefs().map((d) => d.name)]) : null, pick,
    o.chapters !== 'pick' && chs.some(isIdea) ? toggle('includeIdeas', `Include ideas (${chs.filter(isIdea).length})`, 'Printed where they sit in the list, under their own title, without a number') : null,
    textOpt('heading', 'Chapter heading', '{n} number · {N} in words · {title}'), select('sceneBreak', 'Scene break', ['* * *', '#', '~', '⁂', '❧', '§'])));
  const msfAllowed = o.format === 'pdf' || o.format === 'docx';
  put(left, card('Layout',
    msfAllowed ? toggle('manuscriptFormat', 'Standard manuscript format', 'Courier 12, double-spaced, 1-inch margins, name / TITLE / page header — what agents and editors expect.') : null,
    msfAllowed && o.manuscriptFormat ? [textOpt('contact', 'Contact block (title page)', 'email · phone · agent'), textOpt('shortTitle', 'Short title for the header', p.title)] : null,
    !(msfAllowed && o.manuscriptFormat) ? [p.cover ? toggle('includeCover', 'Cover page', o.format === 'epub' ? 'The cover image from Book details' : 'The cover from Book details, fitted inside a 1-inch margin without stretching') : el('div', { class: 'ds-opt' }, el('div', {}, el('div', {}, 'Cover page'), el('small', { class: 'ds-hint' }, 'Add a cover image in Book details to include it'))), toggle('titlePage', 'Title page'), toggle('toc', 'Table of contents'), toggle('frontMatter', 'Copyright, dedication, acknowledgments & author bio', 'Taken from Book details')] : null,
    msfAllowed && !o.manuscriptFormat ? [select('pageSize', 'Page size', [['6x9', '6 × 9 in (trade)'], ['5.5x8.5', '5.5 × 8.5 in'], ['5x8', '5 × 8 in'], ['letter', 'US Letter'], ['a4', 'A4']]), select('fontSize', 'Font size', ['10', '10.5', '11', '11.5', '12'].map((x) => [x, x + ' pt']))] : null,
    o.format === 'docx' && !o.manuscriptFormat ? select('font', 'Font', ['Times', 'Garamond', 'Georgia']) : null,
    toggle('draftStamp', 'Stamp the draft number and word count', `Adds “Draft ${p.draft} · ${fmtN(totalWords(p))} words” to the copyright page, and the draft to the file name`),
    toggle('smartQuotes', 'Curly quotes and dashes', 'Turns "straight" quotes into “curly” ones and -- into —'),
    textOpt('folder', 'Save to folder', projectSub(p, 'compiledFolder'), false)));
  put(left, card('Copyright & notices',
    toggleVal('draftNotice', 'Draft copyright notice', `Uses your draft notice from Book details on the copyright page${o.draftNotice == null ? ` (on automatically while the stage isn’t Published)` : ''}`, draftNoticeOn(p)),
    toggle('footerCopyright', 'Short copyright on every page', fillTokens(p.shortCopyright || DEFAULT_LEGAL.shortCopyright, p)),
    toggle('footerAi', 'AI notice on every page', fillTokens(p.aiNotice || DEFAULT_LEGAL.aiNotice, p)),
    hint(o.format === 'epub' ? 'E-books have no fixed pages, so these notices end every chapter instead.' : 'Wording is set in Book details → Copyright & notices.')));
  // reader questions
  const qRounds = roundsForPublish(p);
  put(left, card('Reader questions',
    qRounds.length ? [toggle('includeQuestions', 'Add reader questions', 'For alpha, beta and ARC reader copies. They’re printed before the table of contents.'),
      o.includeQuestions ? select('questionsRound', 'Questions from', qRounds.map((r) => [r.id, `${r.name} (${r.questions.length})`]).reverse()) : null]
      : hint(p.rounds.some((r) => r.questions.length) ? 'Your rounds have questions, but none are set to “Include in Publish”. Turn that on in Readers.' : 'Add questions to a reader round (Readers tab) to offer them here.')));
  put(left, renderMapsCard(p, set));
  put(left, renderLanguageGuidesCard(p, set));
  put(left, el('div', { class: 'ds-row ds-pubbar' }, btn(`Publish ${({ pdf: 'PDF', docx: 'Word', epub: 'EPUB', md: 'Markdown' })[o.format]}`, async (e) => { e.target.disabled = true; try { await compileProject(p); } catch (err) { console.error(err); notice('Publishing failed: ' + err.message); } view.render(); }, 'mod-cta ds-big')));

  // right: preview + recent
  const right = el('div', {});
  put(right, previewPage(p, sel));
  if ((p.lastCompiled || []).length) put(right, card('Recently published', (p.lastCompiled || []).map((x) => { const f = app().vault.getAbstractFileByPath(x.path);
    return el('div', { class: 'ds-row ds-recent' }, f ? el('a', { class: 'ds-link', onclick: () => openFile(f) }, x.path.split('/').pop()) : el('span', { class: 'ds-hint' }, x.path.split('/').pop() + ' (moved)'), el('small', { class: 'ds-hint' }, `${new Date(x.at).toLocaleString()} · ${fmtN(x.words)} words`)); })));
  put(grid, left, right);
}

/* ---------- Preview ----------
   Miniature pages that follow every choice: format, page size, font and size, manuscript
   format, title page, copyright notices, reader questions, contents with (estimated) page
   numbers, chapter heading, scene break, curly quotes, and the notices at the foot of each page. */
const PREVIEW_W = 250;
const PAGE_LABEL = { '6x9': '6 × 9 in', '5.5x8.5': '5.5 × 8.5 in', '5x8': '5 × 8 in', letter: 'US Letter', a4: 'A4' };
const PAGE_PT = { '6x9': [432, 648], '5.5x8.5': [396, 612], '5x8': [360, 576], letter: [612, 792], a4: [595, 842] };
const WORDS_PER_PAGE = { '6x9': 300, '5.5x8.5': 270, '5x8': 235, letter: 520, a4: 540 };
function previewPage(p, sel) {
  const o = p.compile; const fmt = o.format; const msf = !!o.manuscriptFormat && (fmt === 'pdf' || fmt === 'docx'); const epub = fmt === 'epub';
  const wrap = el('div', { class: 'ds-preview' }, el('div', { class: 'ds-row' }, el('b', { class: 'ds-grow' }, 'Preview'), el('small', { class: 'ds-hint' }, epub ? 'e-reader screens' : fmt === 'md' ? 'one note' : `${msf ? 'US Letter, manuscript format' : PAGE_LABEL[o.pageSize] || PAGE_LABEL['6x9']} · page numbers estimated`)));
  if (!sel.length) { put(wrap, hint('No chapters selected.')); return wrap; }
  const author = p.penName || p.author || 'Author';
  const fs = msf ? 12 : Number(o.fontSize) || 11;
  const [pw, ph] = epub ? [360, 600] : msf ? PAGE_PT.letter : PAGE_PT[o.pageSize] || PAGE_PT['6x9'];
  const k = PREVIEW_W / pw; const px = (pt) => `${(pt * k).toFixed(2)}px`;
  const family = msf ? '"Courier New", Courier, monospace' : epub ? 'Georgia, serif' : fmt === 'docx' && o.font === 'Garamond' ? 'Garamond, "EB Garamond", serif' : fmt === 'docx' && o.font === 'Georgia' ? 'Georgia, serif' : '"Times New Roman", Times, serif';
  const smart = o.smartQuotes !== false; const sq = (t) => (smart ? smartQuotes(t) : t);
  const footer = [o.footerCopyright !== false ? fillTokens(p.shortCopyright || DEFAULT_LEGAL.shortCopyright, p) : '', o.footerAi !== false ? fillTokens(p.aiNotice || DEFAULT_LEGAL.aiNotice, p) : ''].filter(Boolean);
  const qRound = o.includeQuestions ? roundsForPublish(p).find((r) => r.id === o.questionsRound) || roundsForPublish(p).slice(-1)[0] : null;
  if (fmt === 'md') {
    const note = el('div', { class: 'ds-pp is-note', style: { 'font-size': '12px' } }, el('b', {}, `# ${p.title}`), el('div', {}, `by ${author}`), ...footer.map((l) => el('div', { class: 'ds-hint' }, `> ${l}`)),
      qRound ? el('div', {}, el('b', {}, '## Questions for Readers'), ...qRound.questions.slice(0, 3).map((q, i) => el('div', {}, `${i + 1}. ${q.text}`))) : null,
      el('b', {}, `## ${headingFor(sel[0], 1, o)}`), el('div', { class: 'ds-hint' }, '…'));
    put(wrap, note); return wrap;
  }
  // Page plan, mirroring the PDF writer.
  const pages = []; const add = (kind, build) => pages.push({ kind, build });
  const hasCover = !msf && o.includeCover !== false && p.cover && resourceUrl(p.cover);
  if (hasCover) add('cover', (b) => put(b, el('img', { class: 'ds-pp-cover' + (epub ? '' : ' is-fitted'), src: resourceUrl(p.cover) })));
  if (o.titlePage || msf) add('title', (b) => {
    if (msf) { put(b, el('div', { class: 'ds-pp-msfhead' }, el('div', {}, p.author || author, o.contact ? el('div', {}, o.contact) : null), el('div', {}, `About ${aboutWords(totalWords(p))} words`)), el('div', { class: 'ds-pp-center', style: { 'margin-top': '38%' } }, el('div', {}, p.title.toUpperCase()), p.subtitle ? el('div', {}, p.subtitle) : null, el('div', {}, `by ${author}`))); return; }
    put(b, el('div', { class: 'ds-pp-center', style: { 'margin-top': '22%' } }, el('div', { style: { 'font-size': px(fs * 2.4), 'line-height': 1.15 } }, p.title), p.subtitle ? el('i', { style: { 'font-size': px(fs * 1.3) } }, p.subtitle) : null, p.series ? el('i', {}, seriesLine(p)) : null),
      el('div', { class: 'ds-pp-center', style: { position: 'absolute', left: 0, right: 0, bottom: '24%', 'font-size': px(fs * 1.4) } }, author));
  });
  if (o.frontMatter && !msf) {
    const copy = [...(draftNoticeOn(p) ? fillTokens(p.draftCopyright || DEFAULT_LEGAL.draftCopyright, p).split(/\n+/) : [`Copyright © ${p.copyright || new Date().getFullYear()} ${author}`, 'All rights reserved.']), p.isbnPrint || p.isbnEbook ? `ISBN ${epub ? p.isbnEbook || p.isbnPrint : p.isbnPrint || p.isbnEbook}` : '', p.publisher ? `Published by ${p.publisher}` : '', o.draftStamp ? `Draft ${p.draft} · ${fmtN(totalWords(p))} words · ${today()}` : ''].filter(Boolean);
    add('front', (b) => put(b, el('div', { class: 'ds-pp-center', style: { position: 'absolute', left: 0, right: 0, bottom: '6%', 'font-size': px(fs * 0.85) } }, copy.map((l) => el('p', {}, l)), epub ? footer.map((l) => el('p', { class: 'ds-pp-legal-in' }, l)) : null)));
    if (String(p.dedication || '').trim()) add('front', (b) => put(b, el('div', { class: 'ds-pp-center', style: { 'margin-top': '30%', 'font-style': 'italic' } }, p.dedication)));
  }
  if (qRound) add('questions', (b) => { put(b, el('div', { class: 'ds-pp-h' }, o.questionsTitle || 'Questions for Readers'), el('p', { class: 'ds-pp-intro' }, qRound.focus ? `Thank you for reading! ${qRound.focus}` : 'Thank you for reading! Please keep these questions in mind as you read.'), ...qRound.questions.filter((q) => q.text.trim()).map((q, i) => el('p', { class: 'ds-pp-q' }, `${i + 1}. ${q.text}`))); if (epub) put(b, ...footer.map((l) => el('p', { class: 'ds-pp-legal-in' }, l))); });
  const tocAt = pages.length; const showToc = o.toc && !msf;
  // estimate where each chapter starts
  const wpp = msf ? 250 : Math.round((WORDS_PER_PAGE[o.pageSize] || 300) * (11 / fs) ** 2);
  const tocPages = showToc && !epub ? Math.max(1, Math.ceil(sel.length / 18)) : showToc ? 1 : 0;
  let pageNo = pages.length + tocPages - (hasCover ? 1 : 0); const starts = [];
  for (const c of sel) { starts.push(pageNo + 1); pageNo += Math.max(1, Math.ceil(((c.words || 0) + wpp * 0.3) / wpp)); }
  let n = 0; const headings = sel.map((c) => headingFor(c, c.kind === 'chapter' ? ++n : 0, o));
  const back = o.frontMatter && !msf ? [String(p.acknowledgments || '').trim() ? 'Acknowledgments' : '', String(p.bio || '').trim() ? 'About the Author' : ''].filter(Boolean) : [];
  back.forEach(() => { starts.push(pageNo + 1); pageNo += 1; });
  const entries = [...headings, ...back];
  if (showToc) add('toc', (b) => { put(b, el('div', { class: 'ds-pp-h', style: { 'margin-top': '8%' } }, 'Contents'), ...entries.slice(0, 16).map((h, i) => el('div', { class: 'ds-pp-toc' }, el('span', {}, h), epub ? null : el('i'), epub ? null : el('span', {}, String(starts[i])))), ...(entries.length > 16 ? [el('div', { class: 'ds-pp-center' }, '…')] : [])); });
  const pmaps = mapsAllowed(o) ? pickedMaps(p) : [];
  const addMaps = () => pmaps.slice(0, 2).forEach((m) => add('map', (b) => { put(b, el('div', { class: 'ds-pp-h', style: { 'margin-top': '0', 'font-size': px(fs * 1.3) } }, m.basename)); const im = el('img', { class: 'ds-pp-map' }); put(b, im); const w = WF(); if (w) w.loadMapImage(m).then((x) => { if (x) im.src = x.url; }); }));
  if ((o.mapsPlace || 'front') === 'front') addMaps();
  const first = sel[0];
  add('chapter', (b) => {
    put(b, el('div', { class: 'ds-pp-h', style: { 'margin-top': msf ? '28%' : '16%' } }, headings[0]));
    const holder = el('div', { class: 'ds-pp-text' }); put(b, holder);
    app().vault.cachedRead(first.file).then((md) => {
      for (const bl of mdToBlocks(md, first.title, { smart }).slice(0, 14)) put(holder, bl.t === 'break' ? el('div', { class: 'ds-pp-brk' }, o.sceneBreak || '* * *') : bl.t === 'h' ? el('b', {}, bl.text) : bl.t === 'glyphs' ? el('div', { class: 'ds-pp-brk' }, '✒️ glyphs') : el('p', { class: bl.first ? 'is-first' : '' }, bl.runs.map((r) => (r.i ? el('em', {}, r.text) : r.b ? el('b', {}, r.text) : r.text))));
      if (epub) put(holder, ...footer.map((l) => el('p', { class: 'ds-pp-legal-in' }, l)));
    });
  });
  if (o.mapsPlace === 'back') addMaps();
  // draw
  const strip = el('div', { class: 'ds-pp-strip' });
  pages.forEach((pg, i) => {
    const num = i - (hasCover ? 1 : 0) + 1 + (i >= tocAt + (showToc ? 1 : 0) ? tocPages - (showToc ? 1 : 0) : 0);
    const box = el('div', { class: `ds-pp is-${pg.kind}${msf ? ' is-msf' : ''}${epub ? ' is-epub' : ''}`, style: { width: `${PREVIEW_W}px`, height: `${(ph * k).toFixed(0)}px`, 'font-family': family, 'font-size': px(fs), 'line-height': msf ? 2 : 1.42, '--pad-v': px(msf ? 72 : 54), '--pad-h': px(msf ? 72 : 50) } });
    const bodyEl = el('div', { class: 'ds-pp-body' }); pg.build(bodyEl); put(box, bodyEl);
    if (pg.kind !== 'cover' && !epub) {
      if (msf && pg.kind !== 'title') put(box, el('div', { class: 'ds-pp-runhead', style: { 'font-size': px(12) } }, `${(p.author || author).split(/\s+/).pop()} / ${(o.shortTitle || p.title).toUpperCase()} / ${num}`));
      put(box, el('div', { class: 'ds-pp-foot', style: { 'font-size': px(msf ? 8 : Math.max(6, fs * 0.62)) } },
        !msf && pg.kind !== 'title' ? el('div', { class: 'ds-pp-num', style: { 'font-size': px(fs * 0.85) } }, String(num)) : null, footer.map((l) => el('div', {}, l))));
    }
    put(strip, el('div', { class: 'ds-pp-wrap' }, box, el('small', { class: 'ds-hint' }, { cover: 'Cover', title: 'Title page', front: 'Front matter', questions: 'Reader questions', toc: 'Contents', chapter: 'First chapter', map: o.mapsPlace === 'back' ? 'Map (after the story)' : 'Map' }[pg.kind])));
  });
  put(wrap, strip); return wrap;
}
function headingFor(c, num, o) { return c.kind === 'chapter' ? chapterHeading(o.heading, num, titleFromName(c.title)) : isIdea(c) ? titleFromName(c.title) : sectionHeading(c); }
