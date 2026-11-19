/* =====================================================================
   Publish: gather the book and write the file
   ===================================================================== */
function compileChapters(p) {
  const o = p.compile; const all = listChapters(p);
  if (o.chapters === 'status' && o.statusFilter) return all.filter((c) => statusDef(c.status)?.name === o.statusFilter);
  if (o.chapters === 'pick') { const set = new Set(o.picked || []); return all.filter((c) => set.has(c.file.path)); }
  return all;
}
const roundsForPublish = (p) => p.rounds.filter((r) => r.includeInCompile && r.questions.length);

async function gatherBook(p) {
  const o = p.compile; const chs = compileChapters(p); const smart = o.smartQuotes !== false;
  const chapters = [];
  let words = 0;
  for (let i = 0; i < chs.length; i++) {
    const c = chs[i]; const md = await app().vault.cachedRead(c.file); words += countWords(md);
    chapters.push({ title: c.title, heading: chapterHeading(o.heading, i + 1, c.title), blocks: mdToBlocks(md, c.title, { smart }) });
  }
  let cover = null;
  if (p.cover && o.format !== 'docx') {
    const f = app().vault.getAbstractFileByPath(normalizePath(p.cover));
    if (f instanceof TFile) { const ext = f.extension.toLowerCase() === 'jpeg' ? 'jpg' : f.extension.toLowerCase(); const mime = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }[ext]; if (mime) cover = { ext, mime, bytes: new Uint8Array(await app().vault.readBinary(f)) }; }
  }
  const back = [];
  if (o.frontMatter && !o.manuscriptFormat) {
    if (String(p.acknowledgments || '').trim()) back.push({ title: 'Acknowledgments', blocks: plainBlocks(p.acknowledgments) });
    if (String(p.bio || '').trim()) back.push({ title: 'About the Author', blocks: plainBlocks(p.bio) });
  }
  let questions = null;
  if (o.includeQuestions) {
    const r = roundsForPublish(p).find((x) => x.id === o.questionsRound) || roundsForPublish(p).slice(-1)[0];
    if (r) questions = { title: o.questionsTitle || 'Questions for Readers', intro: r.focus ? `Thank you for reading! ${r.focus}` : 'Thank you for reading! Please keep these questions in mind as you read.', items: r.questions.filter((q) => q.text.trim()) };
  }
  const author = p.penName || p.author || 'Author';
  return {
    opts: o, words, cover, chapters, back, questions, dedication: o.frontMatter && !o.manuscriptFormat ? String(p.dedication || '').trim() : '',
    meta: {
      title: p.title, subtitle: p.subtitle, author, legalName: p.author || author, contact: o.contact || '', shortTitle: o.shortTitle || '',
      seriesLine: p.series ? `${p.series}${p.seriesNo ? `, Book ${p.seriesNo}` : ''}` : '', language: p.language || 'en', publisher: p.publisher, isbn: o.format === 'epub' ? p.isbnEbook : p.isbnPrint || p.isbnEbook,
      date: p.pubDate, copyright: p.copyright, description: p.blurb, subjects: fieldList(p.genre), uuid: p.id.padEnd(32, '0').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, '$1-$2-$3-$4-$5'),
      draftLine: o.draftStamp ? `Draft ${p.draft} · ${today()}` : '',
    },
  };
}

function bookMarkdown(book) {
  const L = [`# ${book.meta.title}`, book.meta.subtitle ? `*${book.meta.subtitle}*` : '', '', `by ${book.meta.author}`, ''];
  const md = (bl) => bl.map((b) => b.t === 'break' ? `\n${book.opts.sceneBreak}\n` : b.t === 'h' ? `\n### ${b.text}\n` : b.runs.map((r) => (r.b && r.i ? `***${r.text}***` : r.b ? `**${r.text}**` : r.i ? `*${r.text}*` : r.text)).join('') + '\n').join('\n');
  if (book.dedication) L.push(`*${book.dedication}*`, '');
  for (const c of book.chapters) L.push(`## ${c.heading}`, '', md(c.blocks), '');
  for (const s of book.back) L.push(`## ${s.title}`, '', md(s.blocks), '');
  if (book.questions) { L.push(`## ${book.questions.title}`, '', book.questions.intro, ''); book.questions.items.forEach((q, i) => L.push(`${i + 1}. ${q.text}`)); }
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
  else if (ext === 'docx') await writeBinary(path, buildDocx(book));
  else { const r = buildPdf(book); await writeBinary(path, r.bytes); info = ` · ${r.pages} pages`; }
  p.lastCompiled = [{ path, at: new Date().toISOString(), words: book.words }, ...(p.lastCompiled || []).filter((x) => x.path !== path)].slice(0, 8);
  SG.saveSoon();
  notice(`Published ${path} (${fmtN(book.words)} words${info})`, 8000);
  return path;
}
