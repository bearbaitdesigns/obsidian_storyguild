/* =====================================================================
   Draftsmith — chapter notes, drafts and word counts
   Chapters are ordinary notes in the project's chapters folder. Draftsmith
   only reads their properties, and writes a property only when you act
   (new draft, status change) or, if enabled, to keep the word count current.
   ===================================================================== */
const app = () => SG.app;
const fmOf = (f) => (app().metadataCache.getFileCache(f) || {}).frontmatter || {};
const chaptersFolder = (p) => normalizePath(p.chaptersFolder || `${p.folder}/Chapters`);
const projectSub = (p, key) => normalizePath(`${p.folder}/${DSS()[key]}`);
const SCENE_KINDS = ['prologue', 'chapter', 'interlude', 'epilogue'];
/** Draftsmith types: the four Plot Weaver section types, plus Idea — a note kept with the
    manuscript that isn't numbered, isn't linked to Plot Weaver and doesn't count toward words. */
const DS_KINDS = [...SCENE_KINDS, 'idea'];
const KIND_LABEL = { chapter: 'Chapter', prologue: 'Prologue', interlude: 'Interlude', epilogue: 'Epilogue', idea: 'Idea' };
/** Short labels for the # column. */
const KIND_SHORT = { prologue: 'P', interlude: 'I', epilogue: 'E', idea: '💡' };
const normKind = (v) => { const k = String(v || '').trim().toLowerCase(); return DS_KINDS.includes(k) ? k : ''; };
const isIdea = (c) => c.kind === 'idea';
/** Guess a section type from a note name: "Prologue", "00 - Epilogue: After", "Interlude II"… */
const guessKind = (name) => { const m = String(name || '').toLowerCase().match(/\b(prologue|epilogue|interlude|idea)\b/); return m ? m[1] : 'chapter'; };
/** The label in the # column and the number used in “Chapter {n}”: only true chapters are counted. */
const chapterLabel = (c) => (c.kind === 'chapter' ? String(c.num) : KIND_LABEL[c.kind]);

function listChapters(p) {
  if (!p) return [];
  const folder = chaptersFolder(p) + '/'; const K = DSS().keys; const sk = statusKey(); const wkKeys = fieldList(plotSettings().wordsField || 'words');
  const novel = linkedNovel(p); const pwIndex = new Map(((novel && novel.chapters) || []).map((c, i) => [c.id, i])); const pwSec = new Map(((novel && novel.chapters) || []).map((c) => [c.id, c]));
  const out = app().vault.getMarkdownFiles().filter((f) => f.path.startsWith(folder)).map((f) => {
    const fm = fmOf(f);
    let w = null; for (const k of wkKeys) if (fm[k] != null && fm[k] !== '') { w = +String(fm[k]).replace(/[,\s_]/g, ''); break; }
    if (!Number.isFinite(w)) w = SG.wordCache.has(f.path) ? SG.wordCache.get(f.path) : null;
    const status = Array.isArray(fm[sk]) ? fm[sk][0] : fm[sk];
    return {
      file: f, title: fm.title || f.basename, order: Number(fm[K.chapter]), draft: Number(fm[K.draft]) || 1,
      status: status == null ? '' : String(status), words: w, pov: fm[K.pov] == null ? '' : String(fm[K.pov]), pwChapter: fm[K.pwChapter] ? String(fm[K.pwChapter]) : '',
      pwIndex: fm[K.pwChapter] && pwIndex.has(String(fm[K.pwChapter])) ? pwIndex.get(String(fm[K.pwChapter])) : null,
      // A Plot Weaver section's type wins (it is shared); otherwise the note's own property.
      kind: normKind(fm[K.kind]) === 'idea' ? 'idea' : normKind(fm[K.pwChapter] && pwSec.has(String(fm[K.pwChapter])) ? pwSec.get(String(fm[K.pwChapter])).kind || 'chapter' : fm[K.kind]) || 'chapter',
    };
  });
  // Order: the order property first (so ideas and unlinked notes sit wherever you put them);
  // then, if following Plot Weaver, linked chapters are re-sorted into board order within their own slots.
  out.sort((a, b) => { const ao = Number.isFinite(a.order) ? a.order : 1e9, bo = Number.isFinite(b.order) ? b.order : 1e9; return ao - bo || a.file.basename.localeCompare(b.file.basename, undefined, { numeric: true }); });
  if (DSS().followPlotOrder && novel) {
    for (const c of out) if (c.kind === 'idea') c.pwIndex = null;
    const slots = out.map((c, i) => (c.pwIndex != null ? i : -1)).filter((i) => i >= 0);
    const linked = slots.map((i) => out[i]).sort((a, b) => a.pwIndex - b.pwIndex);
    slots.forEach((slot, k) => { out[slot] = linked[k]; });
  }
  let num = 0; out.forEach((c, i) => { c.n = i + 1; c.num = c.kind === 'chapter' ? ++num : null; c.label = chapterLabel(c); });
  return out;
}
const totalWords = (p) => listChapters(p).filter((c) => !isIdea(c)).reduce((a, c) => a + (c.words || 0), 0);

/** Plot Weaver cards placed in a chapter's column. */
function cardsForChapter(p, c) {
  const n = linkedNovel(p); if (!n || !c.pwChapter || isIdea(c)) return [];
  return (n.beats || []).filter((b) => b.chapterId === c.pwChapter && (!b.status || b.status === 'active'))
    .map((b) => ({ b, plotline: (n.plotlines || []).find((x) => x.id === b.plotlineId), pov: (n.povs || []).find((x) => x.id === b.povId) }));
}

/* ---------- folders & files ---------- */
async function ensureFolder(path) {
  path = normalizePath(path); if (!path || path === '/') return;
  const parts = path.split('/'); let cur = '';
  for (const part of parts) { cur = cur ? `${cur}/${part}` : part; if (!app().vault.getAbstractFileByPath(cur)) { try { await app().vault.createFolder(cur); } catch (e) { /* exists */ } } }
}
async function uniquePath(path) {
  path = normalizePath(path); if (!(await app().vault.adapter.exists(path))) return path;
  const dot = path.lastIndexOf('.'); const base = dot > 0 ? path.slice(0, dot) : path; const ext = dot > 0 ? path.slice(dot) : '';
  for (let i = 2; ; i++) { const p = `${base} (${i})${ext}`; if (!(await app().vault.adapter.exists(p))) return p; }
}
async function writeBinary(path, bytes) {
  await ensureFolder(path.split('/').slice(0, -1).join('/'));
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const f = app().vault.getAbstractFileByPath(path);
  if (f instanceof TFile) await app().vault.modifyBinary(f, buf); else await app().vault.createBinary(path, buf);
  return path;
}
async function writeText(path, text) {
  await ensureFolder(path.split('/').slice(0, -1).join('/'));
  const f = app().vault.getAbstractFileByPath(path);
  if (f instanceof TFile) await app().vault.modify(f, text); else await app().vault.create(path, text);
  return path;
}
const setFm = (f, fn) => app().fileManager.processFrontMatter(f, fn);

/* ---------- chapters ---------- */
async function createChapter(p, title, extra = {}) {
  const K = DSS().keys; const folder = chaptersFolder(p); await ensureFolder(folder);
  const path = await uniquePath(`${folder}/${safeName(title)}.md`);
  let body = '';
  const tpl = DSS().chapterTemplate && app().vault.getAbstractFileByPath(normalizePath(DSS().chapterTemplate));
  if (tpl instanceof TFile) body = (await app().vault.read(tpl)).replace(/{{title}}/g, title).replace(/{{date}}/g, today()).replace(/{{novel}}/g, p.title);
  const f = await app().vault.create(path, body || '\n');
  if (extra.at != null) { /* placed later by reorderChapters */ }
  const next = listChapters(p).filter((c) => c.file.path !== path).reduce((m, c) => Math.max(m, Number.isFinite(c.order) ? c.order : 0), 0) + 1;
  await setFm(f, (fm) => {
    const put = (k, v) => { if (k && (fm[k] === undefined || fm[k] === null || fm[k] === '')) fm[k] = v; };
    put(K.project, `[[${p.title}]]`); put(K.chapter, extra.order || next); put(K.draft, 1); put(statusKey(), statusDefs()[0].name); put(wordsKey(), 0);
    if (K.pov) put(K.pov, extra.pov || ''); if (extra.pwChapter) put(K.pwChapter, extra.pwChapter);
    if (K.kind) put(K.kind, extra.kind || guessKind(title));
  });
  return f;
}
/** Make a chapter note for every Plot Weaver chapter, prologue, interlude and epilogue that has none yet. */
async function chaptersFromPlot(p) {
  const n = linkedNovel(p); if (!n) { notice('Link this project to a Plot Weaver novel first (Book details).'); return 0; }
  const have = new Set(listChapters(p).map((c) => c.pwChapter).filter(Boolean)); let made = 0;
  const secs = (n.chapters || []).filter((c) => SCENE_KINDS.includes(c.kind || 'chapter'));
  for (let i = 0; i < secs.length; i++) { const c = secs[i]; if (have.has(c.id)) continue; await createChapter(p, c.title || `Chapter ${i + 1}`, { pwChapter: c.id, order: i + 1, kind: c.kind || 'chapter' }); made++; }
  return made;
}
async function renumberChapters(chs) { const K = DSS().keys; for (const c of chs) if (c.order !== c.n) await setFm(c.file, (fm) => { fm[K.chapter] = c.n; }); }
/** Put chapters in a new order: writes the order property, and — for chapters linked to Plot Weaver —
    reorders their sections on the board too, keeping Parts and Planning sections where they are. */
async function reorderChapters(p, list) {
  list.forEach((c, i) => { c.n = i + 1; });
  const n = linkedNovel(p);
  if (n) {
    const linked = list.filter((c) => !isIdea(c) && c.pwChapter && n.chapters.some((s) => s.id === c.pwChapter));
    const slots = n.chapters.map((s, i) => (linked.some((c) => c.pwChapter === s.id) ? i : -1)).filter((i) => i >= 0);
    const secs = linked.map((c) => n.chapters.find((s) => s.id === c.pwChapter));
    const before = n.chapters.map((s) => s.id).join();
    slots.forEach((slot, k) => { n.chapters[slot] = secs[k]; });
    if (n.chapters.map((s) => s.id).join() !== before && HOST.plot) HOST.plot._sgCommit();
  }
  await renumberChapters(list);
  SG.refreshDraftsmithSoon();
}
/** Change a chapter's type (chapter/prologue/interlude/epilogue); also on its Plot Weaver section. */
async function setChapterKind(p, c, kind) {
  const K = DSS().keys; const n = linkedNovel(p); const sec = n && c.pwChapter && n.chapters.find((s) => s.id === c.pwChapter);
  if (kind === 'idea') {
    // An idea links to nothing: drop the Plot Weaver link (the board's section is left as it is).
    await setFm(c.file, (fm) => { fm[K.kind] = 'idea'; delete fm[K.pwChapter]; });
    if (sec) notice(`“${c.title}” is now an idea and no longer linked to Plot Weaver. Its board section “${sec.title}” was left as it is.`, 8000);
  } else {
    if (sec && sec.kind !== kind) { sec.kind = kind; if (HOST.plot) HOST.plot._sgCommit(); }
    await setFm(c.file, (fm) => { fm[K.kind] = kind; });
    if (isIdea(c) && n) notice(`“${c.title}” is now a ${KIND_LABEL[kind].toLowerCase()}. Use “link…” in the Plot Weaver column to put it on the board.`, 6000);
  }
  SG.refreshDraftsmithSoon();
}
/** Link a chapter to a Plot Weaver section — an existing one, or a new one placed after the previous linked chapter. */
async function linkToPlot(p, c, secId) {
  const n = linkedNovel(p); if (!n) return; const K = DSS().keys;
  if (secId === '__new') {
    const chs = listChapters(p); const prev = chs.slice(0, chs.indexOf(chs.find((x) => x.file.path === c.file.path))).reverse().find((x) => x.pwChapter && !isIdea(x));
    const at = prev ? n.chapters.findIndex((s) => s.id === prev.pwChapter) + 1 : n.chapters.findIndex((s) => SCENE_KINDS.includes(s.kind || 'chapter'));
    const sec = { id: Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4), title: titleFromName(c.title), kind: isIdea(c) ? 'chapter' : c.kind };
    n.chapters.splice(at < 0 ? n.chapters.length : at, 0, sec); secId = sec.id; if (HOST.plot) HOST.plot._sgCommit();
  }
  await setFm(c.file, (fm) => { fm[K.pwChapter] = secId; if (fm[K.kind] === 'idea') fm[K.kind] = 'chapter'; });
  SG.refreshDraftsmithSoon();
}

async function snapshotChapter(p, c) {
  const dir = `${projectSub(p, 'snapshotFolder')}/Chapters`; await ensureFolder(dir);
  const path = await uniquePath(`${dir}/${c.file.basename} — D${c.draft}.md`);
  await app().vault.create(path, await app().vault.read(c.file)); return path;
}
async function bumpChapterDraft(p, c) {
  await snapshotChapter(p, c);
  await setFm(c.file, (fm) => { fm[DSS().keys.draft] = c.draft + 1; });
  notice(`“${c.title}” is now on chapter draft ${c.draft + 1}. Draft ${c.draft} was saved to ${DSS().snapshotFolder}/Chapters.`);
}
async function startManuscriptDraft(p, note, bumpAll) {
  const chs = listChapters(p); const dir = `${projectSub(p, 'snapshotFolder')}/Draft ${p.draft}`; await ensureFolder(dir);
  for (const c of chs) await app().vault.create(await uniquePath(`${dir}/${c.file.basename}.md`), await app().vault.read(c.file));
  const cur = p.draftHistory.find((h) => h.n === p.draft); if (cur) cur.words = totalWords(p); else p.draftHistory.push({ n: p.draft, date: today(), words: totalWords(p), note: '' });
  p.draft += 1; p.draftHistory.push({ n: p.draft, date: today(), words: null, note: note || `Draft ${p.draft}` });
  if (p.draft === 2 && p.stage === 'First draft') p.stage = 'Second draft'; else if (p.draft >= 3 && ['First draft', 'Second draft'].includes(p.stage)) p.stage = 'Revising';
  if (bumpAll) for (const c of chs) await setFm(c.file, (fm) => { fm[DSS().keys.draft] = c.draft + 1; });
  // a checklist section for the new draft
  const D = p.checklists.draft; const at = D.findIndex((g) => g.g === 'Reader rounds');
  D.splice(at < 0 ? D.length : at, 0, { id: uid(), g: `Draft ${p.draft} — revision`, items: [{ id: uid(), t: 'Revision plan from reader notes', auto: null, done: false, due: '', wk: false }, { id: uid(), t: `Draft ${p.draft} complete`, auto: null, done: false, due: '', wk: false }] });
  SG.saveSoon(); SG.refreshAll();
  notice(`Draft ${p.draft} started. ${chs.length} chapters saved to ${dir}.`);
}

/* ---------- live word counts ---------- */
function isChapterFile(f) { return f instanceof TFile && f.extension === 'md' && DS().projects.some((p) => f.path.startsWith(chaptersFolder(p) + '/')); }
/** Recount every chapter note (e.g. after the counting rules change). Writes only counts that differ. */
async function recountAll() { let n = 0; for (const f of app().vault.getMarkdownFiles()) if (isChapterFile(f)) { await recount(f); n++; } return n; }
async function recount(f) {
  if (!isChapterFile(f)) return;
  const n = countWords(await app().vault.cachedRead(f)); SG.wordCache.set(f.path, n);
  if (DSS().autoWords) {
    const fm = fmOf(f); const k = wordsKey(); const cur = fm[k] == null ? null : +String(fm[k]).replace(/[,\s_]/g, '');
    if (cur !== n) await setFm(f, (x) => { x[k] = n; });
  }
  for (const p of DS().projects) if (f.path.startsWith(chaptersFolder(p) + '/')) recordHistory(p);
  SG.refreshDraftsmithSoon();
}

/* ---------- bring existing notes in as chapters ----------
   Two ways: move the notes into the book's chapters folder (Obsidian updates
   every link to them), or make their current folder the chapters folder (nothing
   moves). Draftsmith only adds properties a note is missing, plus the chapter
   order you chose; your text and other properties are left alone. */
const naturalSort = (a, b) => a.basename.localeCompare(b.basename, undefined, { numeric: true, sensitivity: 'base' });
/** “02 - Ballast” → “Ballast”, “Chapter 3: Saltglass” → “Saltglass”; “1984” and “7 Days” stay as they are. */
const titleFromName = (name) => name.replace(/^\s*(?:ch(?:apter)?\.?\s*\d+[\s.)_:–—-]*|\d+\s*[.)_:–—-]+\s*)/i, '').trim() || name;
async function importChapters(p, files, opts = {}) {
  const K = DSS().keys; const novel = linkedNovel(p); let moved = 0, linked = 0, made = 0;
  if (opts.mode === 'folder' && opts.folder) p.chaptersFolder = normalizePath(opts.folder);
  const dest = chaptersFolder(p); if (opts.mode === 'move') await ensureFolder(dest);
  const secs = novel ? (novel.chapters || []).filter((c) => SCENE_KINDS.includes(c.kind || 'chapter')) : [];
  const taken = new Set(listChapters(p).map((c) => c.pwChapter).filter(Boolean));
  const start = opts.append ? listChapters(p).filter((c) => !files.includes(c.file)).length : 0;
  for (let i = 0; i < files.length; i++) {
    let f = files[i];
    if (opts.mode === 'move' && !f.path.startsWith(dest + '/')) { const to = await uniquePath(`${dest}/${f.name}`); await app().fileManager.renameFile(f, to); f = app().vault.getAbstractFileByPath(to) || f; moved++; }
    const text = await app().vault.read(f); const words = countWords(text); SG.wordCache.set(f.path, words);
    const fm0 = fmOf(f); let pwId = fm0[K.pwChapter] ? String(fm0[K.pwChapter]) : '';
    if (!pwId && novel && opts.matchPlot) {
      const want = [f.basename, titleFromName(f.basename), fm0.title].filter(Boolean).map((x) => String(x).toLowerCase());
      const hit = secs.find((c) => !taken.has(c.id) && want.includes(String(c.title || '').toLowerCase()));
      if (guessKind(f.basename) === 'idea') { /* ideas are never linked */ }
      else if (hit) { pwId = hit.id; linked++; }
      else if (opts.createPlot) { const sec = { id: Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4), title: titleFromName(f.basename), kind: normKind(fm0[K.kind]) || guessKind(f.basename) }; novel.chapters.push(sec); pwId = sec.id; made++; }
      if (pwId) taken.add(pwId);
    }
    await setFm(f, (fm) => {
      const put = (k, v) => { if (k && (fm[k] === undefined || fm[k] === null || fm[k] === '')) fm[k] = v; };
      put(K.project, `[[${p.title}]]`); fm[K.chapter] = start + i + 1; put(K.draft, 1); if (K.kind && !pwId) put(K.kind, guessKind(f.basename)); put(statusKey(), statusDefs()[0].name); fm[wordsKey()] = words;
      if (pwId) fm[K.pwChapter] = pwId;
    });
  }
  if (made && HOST.plot) HOST.plot._sgCommit();
  SG.saveSoon(); SG.refreshAll();
  return { count: files.length, moved, linked, made };
}

class ImportChaptersModal extends Modal {
  constructor(p) { super(SG.app); this.p = p; this.folder = ''; this.files = []; this.on = new Set(); this.mode = 'move'; this.matchPlot = true; this.createPlot = false; this.sub = false; }
  onOpen() { this.modalEl.addClass('ds-lib-modal'); this.draw(); }
  onClose() { this.contentEl.empty(); }
  folders() {
    const dest = chaptersFolder(this.p); const set = new Map();
    for (const f of app().vault.getMarkdownFiles()) { const d = f.path.split('/').slice(0, -1).join('/'); if (d.startsWith(app().vault.configDir) || d === dest) continue; set.set(d, (set.get(d) || 0) + 1); }
    return [...set.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }
  load() {
    const d = this.folder; const deep = this.sub;
    this.files = app().vault.getMarkdownFiles().filter((f) => { const dir = f.path.split('/').slice(0, -1).join('/'); return deep ? (d ? f.path.startsWith(d + '/') : true) : dir === d; })
      .filter((f) => !f.path.startsWith(chaptersFolder(this.p) + '/')).sort(naturalSort);
    this.on = new Set(this.files.map((f) => f.path));
  }
  draw() {
    const c = this.contentEl; c.empty(); c.addClass('ds-modal', 'ds-import'); const p = this.p; const novel = linkedNovel(p); const dest = chaptersFolder(p);
    put(c, el('h2', {}, 'Bring in existing chapter notes'), el('p', { class: 'ds-hint' }, `Turn notes you already have into chapters of “${p.title}”. Your text and properties are kept; Draftsmith only adds what’s missing (chapter number, draft, status, word count).`));
    const fsel = el('select', { class: 'dropdown' }, el('option', { value: '' }, 'Choose the folder your chapters are in…'), this.folders().map(([d, n]) => el('option', { value: d || '/', selected: (this.folder || null) === d || (d === '' && this.folder === '/') }, `${d || '(vault root)'} — ${n} note${n === 1 ? '' : 's'}`)));
    fsel.addEventListener('change', () => { this.folder = fsel.value === '/' ? '' : fsel.value; this.picked = !!fsel.value; this.load(); this.draw(); });
    const sub = el('input', { type: 'checkbox', checked: this.sub }); sub.addEventListener('change', () => { this.sub = sub.checked; if (this.picked) this.load(); this.draw(); });
    put(c, el('div', { class: 'ds-field' }, el('label', {}, 'Source folder'), fsel), el('label', { class: 'ds-toggle' }, sub, ' Include notes in sub-folders'),
      el('div', { class: 'ds-row' }, el('span', { class: 'ds-hint ds-grow' }, 'Or add notes one at a time:'), btn('+ Add a note…', () => new FilePick((f) => f.extension === 'md' && !this.files.includes(f) && !f.path.startsWith(dest + '/'), (f) => { this.files.push(f); this.on.add(f.path); this.picked = true; this.draw(); }, 'Add a note as a chapter…').open(), 'ds-sm')));
    if (!this.files.length) { put(c, el('p', { class: 'ds-hint' }, this.picked ? 'No notes there that aren’t chapters already.' : '')); return; }
    const list = el('div', { class: 'ds-import-list' });
    this.files.forEach((f, i) => {
      const cb = el('input', { type: 'checkbox', checked: this.on.has(f.path) }); cb.addEventListener('change', () => { cb.checked ? this.on.add(f.path) : this.on.delete(f.path); this.draw(); });
      const mv = (d) => () => { const j = i + d; if (j < 0 || j >= this.files.length) return; [this.files[i], this.files[j]] = [this.files[j], this.files[i]]; this.draw(); };
      const n = [...this.files.slice(0, i + 1)].filter((x) => this.on.has(x.path)).length;
      put(list, el('div', { class: 'ds-import-row' + (this.on.has(f.path) ? '' : ' is-off') }, cb, el('span', { class: 'ds-lib-no' }, this.on.has(f.path) ? String(n) : '–'),
        el('span', { class: 'ds-grow' }, f.basename, el('small', { class: 'ds-hint' }, `  ${f.path.split('/').slice(0, -1).join('/') || '/'}`)), btn('↑', mv(-1), 'clickable-icon ds-sm'), btn('↓', mv(1), 'clickable-icon ds-sm')));
    });
    put(c, el('div', { class: 'ds-row' }, el('b', { class: 'ds-grow' }, `Chapter order (${this.on.size} selected)`), el('span', { class: 'ds-hint' }, 'Sorted by file name; use ↑ ↓ to change.')), list);
    const oneFolder = new Set(this.files.filter((f) => this.on.has(f.path)).map((f) => f.path.split('/').slice(0, -1).join('/')));
    const canUse = oneFolder.size === 1 && !this.sub && listChapters(p).length === 0;
    if (!canUse && this.mode === 'folder') this.mode = 'move';
    const radio = (v, label, desc, disabled) => { const r = el('input', { type: 'radio', name: 'ds-imp-mode', checked: this.mode === v, disabled }); r.addEventListener('change', () => { this.mode = v; this.draw(); }); return el('label', { class: 'ds-radio' + (disabled ? ' is-off' : '') }, r, el('div', {}, el('b', {}, label), el('div', { class: 'ds-hint' }, desc))); };
    put(c, el('div', { class: 'ds-field' }, el('label', {}, 'How'),
      radio('move', `Move them into ${dest}`, 'Obsidian updates every link to these notes, so nothing breaks.', false),
      radio('folder', `Keep them where they are`, canUse ? `“${[...oneFolder][0] || '/'}” becomes this book’s chapters folder. Nothing moves.` : 'Only when all chosen notes are in one folder (no sub-folders) and this book has no chapters yet.', !canUse)));
    if (novel) {
      const m = el('input', { type: 'checkbox', checked: this.matchPlot }); m.addEventListener('change', () => { this.matchPlot = m.checked; this.draw(); });
      const cp = el('input', { type: 'checkbox', checked: this.createPlot, disabled: !this.matchPlot }); cp.addEventListener('change', () => { this.createPlot = cp.checked; });
      put(c, el('label', { class: 'ds-toggle' }, m, ` Link to Plot Weaver chapters with the same title (“${novel.title}”)`), el('br'), el('label', { class: 'ds-toggle' }, cp, ' Add a Plot Weaver chapter for any note without a match'));
    }
    const chosen = this.files.filter((f) => this.on.has(f.path));
    put(c, el('div', { class: 'ds-modal-actions' }, btn('Cancel', () => this.close()), el('button', { class: 'mod-cta', disabled: !chosen.length, onclick: async () => {
      this.close(); const r = await importChapters(p, chosen, { mode: this.mode, folder: [...oneFolder][0], matchPlot: this.matchPlot, createPlot: this.createPlot, append: true });
      notice(`Imported ${r.count} chapter${r.count === 1 ? '' : 's'}${r.moved ? ` (moved ${r.moved})` : ''}${r.linked ? ` · linked ${r.linked} to Plot Weaver` : ''}${r.made ? ` · ${r.made} new Plot Weaver chapters` : ''}.`, 8000);
    } }, `Import ${chosen.length} chapter${chosen.length === 1 ? '' : 's'}`)));
  }
}
