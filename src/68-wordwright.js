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
async function translateSelection(editor, conlang) {
  const a = WWA(); const text = editor.getSelection(); if (!a || !text.trim()) return null;
  const r = await a.translateAndSave(conlang, text, { coin: true });
  editor.replaceSelection(r.text);
  DS().ui.lastConlang = conlang.path; SG.saveSoon();
  if (!r.coined.length) notice(`Translated into ${conlangName(conlang)}${r.missing.length ? `. Left in [brackets]: ${r.missing.join(', ')} (set up its sounds to coin new words)` : ''}.`);
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
function installWordwrightDraftsmith(plugin) {
  plugin.registerEvent(plugin.app.workspace.on('editor-menu', (menu, editor) => {
    if (!WWA() || !editor || !editor.getSelection || !editor.getSelection().trim() || !conlangs().length) return;
    const last = conlangs().find((c) => c.path === DS().ui.lastConlang);
    menu.addItem((i) => { i.setTitle('Translate to a conlang…').setIcon('languages'); i.onClick(() => pickConlang((c) => translateSelection(editor, c))); });
    if (last && conlangs().length > 1) menu.addItem((i) => { i.setTitle(`Translate to ${conlangName(last)}`).setIcon('languages'); i.onClick(() => translateSelection(editor, last)); });
  }));
  plugin.addCommand({ id: 'translate-selection', name: 'Translate the selection to a conlang (Wordwright)', editorCheckCallback: (chk, editor) => {
    if (!WWA() || !conlangs().length || !editor.getSelection().trim()) return false; if (!chk) pickConlang((c) => translateSelection(editor, c)); return true; } });
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
