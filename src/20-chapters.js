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

function listChapters(p) {
  if (!p) return [];
  const folder = chaptersFolder(p) + '/'; const K = DSS().keys; const sk = statusKey(); const wkKeys = fieldList(plotSettings().wordsField || 'words');
  const novel = linkedNovel(p); const pwIndex = new Map(((novel && novel.chapters) || []).map((c, i) => [c.id, i]));
  const out = app().vault.getMarkdownFiles().filter((f) => f.path.startsWith(folder)).map((f) => {
    const fm = fmOf(f);
    let w = null; for (const k of wkKeys) if (fm[k] != null && fm[k] !== '') { w = +String(fm[k]).replace(/[,\s_]/g, ''); break; }
    if (!Number.isFinite(w)) w = SG.wordCache.has(f.path) ? SG.wordCache.get(f.path) : null;
    const status = Array.isArray(fm[sk]) ? fm[sk][0] : fm[sk];
    return {
      file: f, title: fm.title || f.basename, order: Number(fm[K.chapter]), draft: Number(fm[K.draft]) || 1,
      status: status == null ? '' : String(status), words: w, pov: fm[K.pov] == null ? '' : String(fm[K.pov]), pwChapter: fm[K.pwChapter] ? String(fm[K.pwChapter]) : '',
      pwIndex: fm[K.pwChapter] && pwIndex.has(String(fm[K.pwChapter])) ? pwIndex.get(String(fm[K.pwChapter])) : null,
    };
  });
  const byPlot = DSS().followPlotOrder && novel;
  out.sort((a, b) => {
    if (byPlot && a.pwIndex != null && b.pwIndex != null) return a.pwIndex - b.pwIndex;
    if (byPlot && (a.pwIndex != null) !== (b.pwIndex != null)) return a.pwIndex != null ? -1 : 1;
    const ao = Number.isFinite(a.order) ? a.order : 1e9, bo = Number.isFinite(b.order) ? b.order : 1e9;
    return ao - bo || a.file.basename.localeCompare(b.file.basename, undefined, { numeric: true });
  });
  out.forEach((c, i) => { c.n = i + 1; });
  return out;
}
const totalWords = (p) => listChapters(p).reduce((a, c) => a + (c.words || 0), 0);

/** Plot Weaver cards placed in a chapter's column. */
function cardsForChapter(p, c) {
  const n = linkedNovel(p); if (!n || !c.pwChapter) return [];
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
  const next = listChapters(p).filter((c) => c.file.path !== path).reduce((m, c) => Math.max(m, Number.isFinite(c.order) ? c.order : 0), 0) + 1;
  await setFm(f, (fm) => {
    const put = (k, v) => { if (k && (fm[k] === undefined || fm[k] === null || fm[k] === '')) fm[k] = v; };
    put(K.project, `[[${p.title}]]`); put(K.chapter, extra.order || next); put(K.draft, 1); put(statusKey(), statusDefs()[0].name); put(wordsKey(), 0);
    if (K.pov) put(K.pov, extra.pov || ''); if (extra.pwChapter) put(K.pwChapter, extra.pwChapter);
  });
  return f;
}
/** Make a chapter note for every Plot Weaver chapter, prologue, interlude and epilogue that has none yet. */
async function chaptersFromPlot(p) {
  const n = linkedNovel(p); if (!n) { notice('Link this project to a Plot Weaver novel first (Book details).'); return 0; }
  const have = new Set(listChapters(p).map((c) => c.pwChapter).filter(Boolean)); let made = 0;
  const secs = (n.chapters || []).filter((c) => SCENE_KINDS.includes(c.kind || 'chapter'));
  for (let i = 0; i < secs.length; i++) { const c = secs[i]; if (have.has(c.id)) continue; await createChapter(p, c.title || `Chapter ${i + 1}`, { pwChapter: c.id, order: i + 1 }); made++; }
  return made;
}
async function renumberChapters(chs) { const K = DSS().keys; for (const c of chs) if (c.order !== c.n) await setFm(c.file, (fm) => { fm[K.chapter] = c.n; }); }

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
async function recount(f) {
  if (!isChapterFile(f)) return;
  const n = countWords(await app().vault.cachedRead(f)); SG.wordCache.set(f.path, n);
  if (DSS().autoWords) {
    const fm = fmOf(f); const k = wordsKey(); const cur = fm[k] == null ? null : +String(fm[k]).replace(/[,\s_]/g, '');
    if (cur !== n) await setFm(f, (x) => { x[k] = n; });
  }
  SG.refreshDraftsmithSoon();
}
