/* =====================================================================
   Publish: gather the book and write the file
   ===================================================================== */
/** “Prologue”, or “Prologue: The Drowning” when the note has its own title. */
function sectionHeading(c) {
  const label = KIND_LABEL[c.kind]; const t = titleFromName(String(c.title || '')).replace(new RegExp(`^\\s*${label}\\s*[:.\\-–—]?\\s*`, 'i'), '').trim();
  return t ? `${label}: ${t}` : label;
}
/** Manuscript-format word count: to the nearest thousand (exact below 1,000). */
const aboutWords = (w) => fmtN(w < 1000 ? w : Math.round(w / 1000) * 1000);
function compileChapters(p) {
  const o = p.compile; const all0 = listChapters(p); const all = o.chapters === 'pick' || o.includeIdeas ? all0 : all0.filter((c) => !isIdea(c));
  if (o.chapters === 'status' && o.statusFilter) return all.filter((c) => statusDef(c.status)?.name === o.statusFilter);
  if (o.chapters === 'pick') { const set = new Set(o.picked || []); return all.filter((c) => set.has(c.file.path)); }
  return all;
}
const roundsForPublish = (p) => p.rounds.filter((r) => r.includeInCompile && r.questions.length);

async function gatherBook(p) {
  const o = p.compile; const chs = compileChapters(p); const smart = o.smartQuotes !== false;
  const chapters = [];
  let words = 0;
  let num = 0;
  for (let i = 0; i < chs.length; i++) {
    const c = chs[i]; const md = await app().vault.cachedRead(c.file); if (!isIdea(c)) words += countWords(md);
    const heading = c.kind === 'chapter' ? chapterHeading(o.heading, ++num, titleFromName(c.title)) : isIdea(c) ? titleFromName(c.title) : sectionHeading(c);
    chapters.push({ title: c.title, kind: c.kind, heading, blocks: mdToBlocks(md, c.title, { smart }) });
  }
  let cover = null;
  if (p.cover && o.includeCover !== false && !(o.manuscriptFormat && o.format !== 'epub')) {
    const f = app().vault.getAbstractFileByPath(normalizePath(p.cover));
    if (f instanceof TFile) { const ext = f.extension.toLowerCase() === 'jpeg' ? 'jpg' : f.extension.toLowerCase(); const mime = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }[ext]; if (mime) cover = { ext, mime, bytes: new Uint8Array(await app().vault.readBinary(f)) }; }
  }
  p._mapWarnings = []; const maps = await renderBookMaps(p);
  const back = [];
  if (o.frontMatter && !o.manuscriptFormat) {
    if (String(p.acknowledgments || '').trim()) back.push({ title: 'Acknowledgments', blocks: plainBlocks(p.acknowledgments) });
    if (String(p.bio || '').trim()) back.push({ title: 'About the Author', blocks: plainBlocks(p.bio) });
  }
  for (const g of languageGuideBack(p)) back.push(g);
  let questions = null;
  if (o.includeQuestions) {
    const r = roundsForPublish(p).find((x) => x.id === o.questionsRound) || roundsForPublish(p).slice(-1)[0];
    if (r) questions = { title: o.questionsTitle || 'Questions for Readers', intro: r.focus ? `Thank you for reading! ${r.focus}` : 'Thank you for reading! Please keep these questions in mind as you read.', items: r.questions.filter((q) => q.text.trim()) };
  }
  const author = p.penName || p.author || 'Author';
  const fill = (t) => fillTokens(t, p);
  const draftLine = o.draftStamp ? `Draft ${p.draft} · ${fmtN(words)} words · ${today()}` : '';
  const isbn = o.format === 'epub' ? p.isbnEbook : p.isbnPrint || p.isbnEbook;
  const useDraft = draftNoticeOn(p);
  // Copyright page: the custom draft notice while the book is a draft, the standard lines once published.
  const copyLines = [
    ...(useDraft ? fill(p.draftCopyright || DEFAULT_LEGAL.draftCopyright).split(/\n+/) : [`Copyright © ${p.copyright || new Date().getFullYear()} ${author}`, 'All rights reserved.']),
    isbn ? `ISBN ${isbn}` : '', p.publisher ? `Published by ${p.publisher}` : '', draftLine,
  ].map((x) => x.trim()).filter(Boolean);
  // Printed at the foot of every page (PDF, Word) or the end of every section (EPUB).
  const footer = [o.footerCopyright !== false ? fill(p.shortCopyright || DEFAULT_LEGAL.shortCopyright) : '', o.footerAi !== false ? fill(p.aiNotice || DEFAULT_LEGAL.aiNotice) : ''].map((x) => x.trim()).filter(Boolean);
  return {
    opts: o, words, cover, chapters, back, questions, maps, mapsPlace: o.mapsPlace === 'back' ? 'back' : 'front', warnings: p._mapWarnings.length ? p._mapWarnings.slice() : undefined, dedication: o.frontMatter && !o.manuscriptFormat ? String(p.dedication || '').trim() : '',
    meta: {
      title: p.title, subtitle: p.subtitle, author, legalName: p.author || author, contact: o.contact || '', shortTitle: o.shortTitle || '',
      seriesLine: p.series ? `${p.series}${p.seriesNo ? `, Book ${p.seriesNo}` : ''}` : '', language: p.language || 'en', publisher: p.publisher, isbn: o.format === 'epub' ? p.isbnEbook : p.isbnPrint || p.isbnEbook,
      date: p.pubDate, copyright: p.copyright, description: p.blurb, subjects: fieldList(p.genre), uuid: p.id.padEnd(32, '0').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, '$1-$2-$3-$4-$5'),
      draftLine, copyLines, footer,
    },
  };
}

function bookMarkdown(book) {
  const L = [`# ${book.meta.title}`, book.meta.subtitle ? `*${book.meta.subtitle}*` : '', '', `by ${book.meta.author}`, '', ...book.meta.copyLines.map((x) => `> ${x}`), ...book.meta.footer.map((x) => `> *${x}*`), ''];
  const md = (bl) => bl.map((b) => b.t === 'break' ? `\n${book.opts.sceneBreak}\n` : b.t === 'h' ? `\n### ${b.text}\n` : b.runs.map((r) => (r.b && r.i ? `***${r.text}***` : r.b ? `**${r.text}**` : r.i ? `*${r.text}*` : r.text)).join('') + '\n').join('\n');
  if (book.dedication) L.push(`*${book.dedication}*`, '');
  if (book.questions) { L.push(`## ${book.questions.title}`, '', book.questions.intro, ''); book.questions.items.forEach((q, i) => L.push(`${i + 1}. ${q.text}`)); L.push(''); }
  const mapsMd = () => { for (const mp of book.maps || []) L.push(`## ${mp.title}`, '', `![[${mp.path.replace(/\.md$/, '')}]]`, ''); };
  if (book.mapsPlace === 'front') mapsMd();
  for (const c of book.chapters) L.push(`## ${c.heading}`, '', md(c.blocks), '');
  if (book.mapsPlace === 'back') mapsMd();
  for (const s of book.back) L.push(`## ${s.title}`, '', md(s.blocks), '');
  return L.join('\n');
}

async function compileProject(p) {
  const o = p.compile; const book = await gatherBook(p);
  if (!book.chapters.length) { notice('No chapters to publish. Check the chapter selection.'); return null; }
  const ext = { pdf: 'pdf', docx: 'docx', epub: 'epub', md: 'md' }[o.format] || 'pdf';
  const base = `${safeName(p.title)}${o.draftStamp || o.format !== 'epub' ? ` - Draft ${p.draft}` : ''}${o.manuscriptFormat && o.format !== 'epub' ? ' (manuscript)' : ''}`;
  const folder = normalizePath(o.folder || projectSub(p, 'compiledFolder')); const path = normalizePath(`${folder}/${base}.${ext}`);
  let info = '';
  if (ext === 'md') await writeText(path, bookMarkdown(book));
  else if (ext === 'epub') await writeBinary(path, buildEpub(book));
  else if (ext === 'docx') {
    // Pre-fill the contents' page numbers from a PDF layout with the same page size and font size.
    // Word refreshes them when the file opens; LibreOffice and Google Docs show these.
    if (o.toc && !o.manuscriptFormat) { try { book.pageGuess = Object.fromEntries(buildPdf(book).outline.map((e) => [e.title, String(e.num)])); } catch (e) { console.error(e); } }
    await writeBinary(path, buildDocx(book));
  }
  else { const r = buildPdf(book); await writeBinary(path, r.bytes); info = ` · ${r.pages} pages`; }
  p.lastCompiled = [{ path, at: new Date().toISOString(), words: book.words }, ...(p.lastCompiled || []).filter((x) => x.path !== path)].slice(0, 8);
  SG.saveSoon();
  notice(`Published ${path} (${fmtN(book.words)} words${info})`, 8000);
  for (const w of book.warnings || []) notice(w, 10000);
  return path;
}
