/* =====================================================================
   Wordwright in Draftsmith
   - select words in a chapter (or any note) → right-click → Translate to a conlang;
     missing words are coined from the language's rules and you're told which
   - Publish → Language guides: a conlang's guide at the back of the book
   - the Word / PDF language guide export from a conlang note
   ===================================================================== */
const WWA = () => (HOST.world && WorldkeeperModule.storyguild && WorldkeeperModule.storyguild.wordwright) || null;
function conlangs() { const a = WWA(); try { return a ? a.WW.all() : []; } catch (e) { return []; } }
const conlangName = (c) => c.basename.replace(/\s*\(conlang\)$/i, '');

/** translate the editor's selection into a conlang and put the translation in its place */
/** mode "replace" swaps the selection for the translation; "copy" leaves the text and copies the translation */
async function translateSelection(editor, conlang, mode = 'replace') {
  const a = WWA(); const text = editor.getSelection(); if (!a || !text.trim()) return null;
  const r = await a.translateAndSave(conlang, text, { coin: true });
  if (mode === 'copy') { try { await navigator.clipboard.writeText(r.text); } catch (e) { /* clipboard not allowed */ } }
  else editor.replaceSelection(r.text);
  DS().ui.lastConlang = conlang.path; SG.saveSoon();
  const order = r.arranged && r.order ? ` in ${r.order} word order` : '';
  if (!r.coined.length) notice(`${mode === 'copy' ? 'Copied the translation' : 'Translated'} into ${conlangName(conlang)}${order}${mode === 'copy' ? `: ${r.text.replace(/[.!?]+$/, '')}` : ''}${r.missing.length ? `. Left in [brackets]: ${r.missing.join(', ')} (set up its sounds to coin new words)` : ''}.`, 6000);
  else if (mode === 'copy') notice(`${mode === 'copy' ? 'Copied the translation' : 'Translated'} into ${conlangName(conlang)}${order}${mode === 'copy' ? `: ${r.text.replace(/[.!?]+$/, '')}` : ''}.`, 6000);
  return r;
}
function pickConlang(cb) {
  const all = conlangs(); if (!all.length) { notice('No conlangs yet. Make one in Worldkeeper → Wordwright.'); return; }
  if (all.length === 1) { cb(all[0]); return; }
  const last = DS().ui.lastConlang; const sorted = all.slice().sort((x, y) => (x.path === last ? -1 : y.path === last ? 1 : x.basename.localeCompare(y.basename)));
  const m = new Modal(SG.app); m.titleEl.setText('Translate into…'); m.contentEl.addClass('ds-modal');
  for (const c of sorted) { const b = m.contentEl.createEl('button', { text: `🔤 ${conlangName(c)}`, cls: 'ds-conlang-pick' }); b.addEventListener('click', () => { m.close(); cb(c); }); }
  m.open();
}
/* ---------- glyphs: conlang text → a set's characters, and single signs at the cursor ---------- */
function glyphSets() { const a = WWA(); try { return a && a.sets ? a.sets.all() : []; } catch (e) { return []; } }
function pickGlyphSet(cb, title = 'Write in which glyphs?') {
  const a = WWA(); const all = glyphSets(); if (!all.length) { notice('No glyph sets yet. Make one in Wordwright → + New glyph set.'); return; }
  if (all.length === 1) { cb(all[0]); return; }
  const last = DS().ui.lastGlyphs; const sorted = all.slice().sort((x, y) => (x.path === last ? -1 : y.path === last ? 1 : x.basename.localeCompare(y.basename)));
  const m = new Modal(SG.app); m.titleEl.setText(title); m.contentEl.addClass('ds-modal');
  for (const g of sorted) { const b = m.contentEl.createEl('button', { text: `✒️ ${a.glyphName(g)}`, cls: 'ds-conlang-pick' }); b.addEventListener('click', () => { m.close(); cb(g); }); }
  m.open();
}
async function writeInGlyphs(editor, gf, translate = false) {
  const a = WWA(); let text = editor.getSelection(); if (!a || !text.trim()) return null;
  if (translate) { const c = a.sets.conlangOf(gf); if (c) text = (await a.translateAndSave(c, text, { coin: true })).text; }
  const out = await a.encode(gf, text); editor.replaceSelection(out); DS().ui.lastGlyphs = gf.path; SG.saveSoon();
  notice(`Written in ${a.glyphName(gf)}. It stays text: cut, copy and move it like any words.`, 5000); return out;
}
/** a picker of every sign in a set; the chosen one goes in at the cursor */
function insertGlyph(editor) {
  pickGlyphSet((gf) => {
    const a = WWA(); const items = a.signList(gf); const m = new Modal(SG.app); m.titleEl.setText(`Insert from ${a.glyphName(gf)}`); m.contentEl.addClass('ds-modal', 'ds-glyph-pick');
    const q = m.contentEl.createEl('input', { type: 'text', placeholder: 'Find a sign by its sound, name or meaning…', cls: 'ds-glyph-q' }); const grid = m.contentEl.createDiv({ cls: 'ds-glyph-grid' });
    const draw = () => { grid.empty(); const t = q.value.trim().toLowerCase(); for (const it of items.filter((x) => !t || x.label.toLowerCase().includes(t) || String(x.meaning).toLowerCase().includes(t)).slice(0, 120)) {
      const b = grid.createEl('button', { cls: 'ds-glyph-cell', attr: { title: it.meaning ? `${it.label} · ${it.meaning}` : it.label } }); b.append(it.el(40)); b.createEl('span', { text: it.label });
      b.addEventListener('click', async () => { const cp = await a.codeOf(gf, it.key); if (cp) editor.replaceSelection(String.fromCodePoint(cp)); DS().ui.lastGlyphs = gf.path; SG.saveSoon(); m.close(); }); } };
    q.addEventListener('input', draw); draw(); m.open(); setTimeout(() => q.focus(), 50);
  }, 'Insert from which glyphs?');
}
/** a picture from a glyph set, as a block that draws it here and in the published book */
function insertGlyphPicture(editor) {
  pickGlyphSet((gf) => {
    const a = WWA(); const pics = a.pictures(gf); const name = a.glyphName(gf);
    const put = (body) => { editor.replaceSelection('\n```glyphs\nset: ' + name + '\n' + body + '\n```\n'); DS().ui.lastGlyphs = gf.path; SG.saveSoon(); };
    const sel = editor.getSelection && editor.getSelection().trim();
    const m = new Modal(SG.app); m.titleEl.setText(`Picture from ${name}`); m.contentEl.addClass('ds-modal');
    if (sel) { const b = m.contentEl.createEl('button', { text: `✦ Join the selected words into a picture`, cls: 'ds-conlang-pick' }); b.addEventListener('click', () => { m.close(); put('text: ' + sel.replace(/\n+/g, ' ') + '\njoin: yes'); }); }
    for (const p of pics) { const b = m.contentEl.createEl('button', { text: `🖼 ${p.name}`, cls: 'ds-conlang-pick' }); b.addEventListener('click', () => { m.close(); put('picture: ' + p.name); }); }
    if (!sel && !pics.length) m.contentEl.createEl('p', { text: 'No saved pictures yet. Select some words to join them into one, or make pictures in the glyph set’s note.' });
    m.open();
  }, 'Picture from which glyphs?');
}
function installWordwrightDraftsmith(plugin) {
  plugin.registerEvent(plugin.app.workspace.on('editor-menu', (menu, editor) => {
    if (!WWA() || !editor || !glyphSets().length) return;
    const sel = editor.getSelection && editor.getSelection().trim();
    if (sel) menu.addItem((i) => { i.setTitle('Write in glyphs…').setIcon('pen-tool'); i.onClick(() => pickGlyphSet((g) => writeInGlyphs(editor, g))); });
    if (sel && glyphSets().some((g) => WWA().sets.conlangOf(g))) menu.addItem((i) => { i.setTitle('Translate and write in glyphs…').setIcon('pen-tool'); i.onClick(() => pickGlyphSet((g) => writeInGlyphs(editor, g, true))); });
    menu.addItem((i) => { i.setTitle('Insert a glyph…').setIcon('shapes'); i.onClick(() => insertGlyph(editor)); });
    menu.addItem((i) => { i.setTitle(sel ? 'Join into a glyph picture…' : 'Insert a glyph picture…').setIcon('sparkles'); i.onClick(() => insertGlyphPicture(editor)); });
  }));
  plugin.addCommand({ id: 'write-in-glyphs', name: 'Write the selection in glyphs (Wordwright)', editorCheckCallback: (chk, editor) => { if (!WWA() || !glyphSets().length || !editor.getSelection().trim()) return false; if (!chk) pickGlyphSet((g) => writeInGlyphs(editor, g)); return true; } });
  plugin.addCommand({ id: 'insert-glyph-picture', name: 'Insert a glyph picture (Wordwright)', editorCheckCallback: (chk, editor) => { if (!WWA() || !glyphSets().length) return false; if (!chk) insertGlyphPicture(editor); return true; } });
  plugin.addCommand({ id: 'insert-glyph', name: 'Insert a glyph (Wordwright)', editorCheckCallback: (chk, editor) => { if (!WWA() || !glyphSets().length) return false; if (!chk) insertGlyph(editor); return true; } });

  plugin.registerEvent(plugin.app.workspace.on('editor-menu', (menu, editor) => {
    if (!WWA() || !editor || !editor.getSelection || !editor.getSelection().trim() || !conlangs().length) return;
    const last = conlangs().find((c) => c.path === DS().ui.lastConlang);
    menu.addItem((i) => { i.setTitle('Translate to a conlang…').setIcon('languages'); i.onClick(() => pickConlang((c) => translateSelection(editor, c))); });
    menu.addItem((i) => { i.setTitle('Copy a conlang translation…').setIcon('copy'); i.onClick(() => pickConlang((c) => translateSelection(editor, c, 'copy'))); });
    if (last && conlangs().length > 1) menu.addItem((i) => { i.setTitle(`Translate to ${conlangName(last)}`).setIcon('languages'); i.onClick(() => translateSelection(editor, last)); });
  }));
  plugin.addCommand({ id: 'translate-selection', name: 'Translate the selection to a conlang (Wordwright)', editorCheckCallback: (chk, editor) => {
    if (!WWA() || !conlangs().length || !editor.getSelection().trim()) return false; if (!chk) pickConlang((c) => translateSelection(editor, c)); return true; } });
  plugin.addCommand({ id: 'copy-translation', name: 'Copy a conlang translation of the selection (Wordwright)', editorCheckCallback: (chk, editor) => {
    if (!WWA() || !conlangs().length || !editor.getSelection().trim()) return false; if (!chk) pickConlang((c) => translateSelection(editor, c, 'copy')); return true; } });
  HOST.exportGuide = exportLanguageGuide;
}

/* ---------- language guides as a book (standalone) or as back matter ---------- */
function guideOpts(format) {
  const p = activeProject();
  return Object.assign(clone(DEFAULT_COMPILE), p ? p.compile : {}, { format, toc: true, titlePage: true, frontMatter: false, manuscriptFormat: false, draftStamp: false, includeQuestions: false, includeCover: false, maps: [], footerCopyright: false, footerAi: false });
}
async function exportLanguageGuide(conlang, format = 'pdf', sections) {
  const a = WWA(); if (!a) return null;
  const secs = a.guide(conlang, sections); if (!secs.length) { notice('Nothing to export yet: add some sounds or words first.'); return null; }
  const p = activeProject(); const name = conlangName(conlang); const o = guideOpts(format);
  const book = {
    opts: o, words: 0, cover: null, back: [], questions: null, maps: [], mapsPlace: 'front', dedication: '',
    chapters: secs.map((s) => ({ title: s.title, kind: 'chapter', heading: s.title, blocks: s.blocks })),
    meta: { title: name, subtitle: 'A Language Guide', author: p ? p.penName || p.author || '' : '', legalName: p ? p.author || '' : '', contact: '', shortTitle: name, seriesLine: '', language: 'en', publisher: '', isbn: '', date: '', copyright: '', description: `A guide to ${name}.`, subjects: [],
      uuid: uid().padEnd(32, '0').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, '$1-$2-$3-$4-$5'), draftLine: '', copyLines: [], footer: [] },
  };
  if (a.glyphImages) { try { const imgs = await a.glyphImages(conlang); if (imgs.length) { book.maps = imgs; book.mapsPlace = 'back'; } } catch (e) { console.error(e); } }
  const folder = normalizePath(`${a.WW.folder()}/Exports`); const path = normalizePath(`${folder}/${safeName(name)} - Language Guide.${format === 'docx' ? 'docx' : 'pdf'}`);
  let info = '';
  if (format === 'docx') await writeBinary(path, buildDocx(book));
  else { const r = buildPdf(book); await writeBinary(path, r.bytes); info = ` · ${r.pages} pages`; }
  notice(`Saved ${path}${info}`, 8000);
  return path;
}
/** Publish: the guides picked for this book, as back-matter sections */
function languageGuideBack(p) {
  const a = WWA(); const o = p.compile; if (!a || o.manuscriptFormat) return [];
  const all = conlangs(); const out = [];
  for (const path of arrOf(o.langGuides)) {
    const c = all.find((x) => x.path === path); if (!c) continue;
    const secs = a.guide(c); if (!secs.length) continue;
    const blocks = []; for (const s of secs) { blocks.push({ t: 'h', text: s.title }); blocks.push(...s.blocks); }
    out.push({ title: `${conlangName(c)}: A Language Guide`, blocks });
  }
  return out;
}
function renderLanguageGuidesCard(p, set) {
  const o = p.compile;
  if (!HOST.world) return card('Language guides', hint('Turn on the Worldkeeper section to add conlang guides from Wordwright.'));
  const all = conlangs();
  if (!all.length) return card('Language guides', hint('No conlangs yet. Build one in Worldkeeper → Wordwright, then add its guide to the back of the book here.'));
  if (o.manuscriptFormat) return card('Language guides', hint('Standard manuscript format leaves out back matter like this. Turn it off to include a language guide.'));
  const chosen = new Set(arrOf(o.langGuides));
  const list = el('div', { class: 'ds-pick' }, all.map((c) => el('label', { class: 'ds-map-opt' },
    ((cb) => { cb.addEventListener('change', () => { const next = arrOf(o.langGuides).filter((x) => x !== c.path); if (cb.checked) next.push(c.path); set('langGuides', next); }); return cb; })(el('input', { type: 'checkbox', checked: chosen.has(c.path) })),
    el('span', {}, `🔤 ${conlangName(c)}`))));
  return card(`Language guides · ${[...chosen].filter((x) => all.some((c) => c.path === x)).length} of ${all.length}`, list, hint('Each guide goes after the story: sounds and pronunciation, grammar, numbers, a dictionary both ways, the phrasebook and names.'));
}
