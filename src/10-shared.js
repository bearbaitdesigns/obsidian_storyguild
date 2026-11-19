/* =====================================================================
   Shared fields between Draftsmith, Worldkeeper and Plot Weaver
   ---------------------------------------------------------------------
   One "project" (Draftsmith) is the single source of truth for the book's
   title, series, genre, audience, logline, summary, word target, deadline,
   stage and cover. Worldkeeper's novel settings read and write those same
   values; Plot Weaver's linked novel shares the title. Status and word
   properties on notes use Plot Weaver's field names everywhere.
   ===================================================================== */
let SG = null; // the running host plugin

const DS = () => SG.data.manuscript;
const DSS = () => SG.data.manuscript.settings;
function activeProject() {
  const m = DS(); let p = m.projects.find((x) => x.id === m.activeId);
  if (!p && m.projects.length) { p = m.projects[0]; m.activeId = p.id; }
  return p || null;
}
function ensureProject() {
  let p = activeProject();
  if (!p) { p = makeProject(SG.data.world?.novel?.title || 'My Novel'); DS().projects.push(p); DS().activeId = p.id; SG.saveSoon(); }
  return p;
}

/* ---------- note fields shared with Plot Weaver ---------- */
function plotSettings() { return (HOST.plot && HOST.plot.data && HOST.plot.data.settings) || (SG.data.plot && SG.data.plot.settings) || {}; }
const fieldList = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
function statusKey() { return fieldList(plotSettings().statusField || 'status')[0] || 'status'; }
function wordsKey() { return fieldList(plotSettings().wordsField || 'words')[0] || 'words'; }
function statusDefs() {
  const s = plotSettings().statuses;
  return Array.isArray(s) && s.length ? s : [
    { name: 'Not started', match: 'not started, todo, to do, idea, planned, outlined', color: '#9a9aa3' },
    { name: 'In progress', match: 'in progress, drafting, writing, wip, draft, started', color: '#e0a030' },
    { name: 'Revising', match: 'revising, revision, editing, needs revision, edit', color: '#9b6ad6' },
    { name: 'Completed', match: 'completed, complete, done, finished, final', color: '#5cb85c' },
  ];
}
/** The status definition a property value belongs to (Plot Weaver's matching rules). */
function statusDef(v) {
  const k = String(v || '').trim().toLowerCase(); if (!k) return null;
  return statusDefs().find((d) => [String(d.name).toLowerCase(), ...fieldList(d.match).map((x) => x.toLowerCase())].includes(k)) || null;
}
const finalStatus = () => statusDefs()[statusDefs().length - 1].name;

/* ---------- Plot Weaver novel linked to a project ---------- */
function plotNovels() { return (HOST.plot && HOST.plot.data && HOST.plot.data.novels) || []; }
function linkedNovel(p) { p = p || activeProject(); return p && p.pwNovelId ? plotNovels().find((n) => n.id === p.pwNovelId) || null : null; }
function setProjectField(p, key, value) {
  p[key] = value;
  if (key === 'title') { const n = linkedNovel(p); if (n && n.title !== value) { n.title = value; HOST.plot._sgCommit(); } }
  SG.saveSoon(); SG.refreshAll();
}
/** Plot Weaver changed something: pick up a renamed novel and refresh Draftsmith. */
function onPlotCommit() {
  let changed = false;
  // Switched novel in Plot Weaver → switch book everywhere.
  const act = HOST.plot && HOST.plot.data.activeNovelId;
  if (act && act !== SG._pwActive) {
    SG._pwActive = act; const p = DS().projects.find((x) => x.pwNovelId === act);
    if (p && p.id !== DS().activeId) { DS().activeId = p.id; changed = true; syncRoundsToWorld(p); if (HOST.world) HOST.world.refreshSoon(100); }
  }
  for (const p of DS().projects) { const n = linkedNovel(p); if (n && n.title && n.title !== p.title) { p.title = n.title; changed = true; } }
  if (changed) SG.saveSoon();
  SG.refreshDraftsmith();
}

/* ---------- Worldkeeper novel settings ⇄ current book ---------- */
const WORLD_SHARED = {
  title: ['title'], audience: ['audience'], logline: ['logline'], synopsis: ['synopsisShort'],
  goal: ['targetWords', (v) => Number(v) || 0], deadline: ['deadline'], stage: ['stage'],
  genre: ['genre', null, (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean), (v) => (Array.isArray(v) ? v.join(', ') : String(v || ''))],
};
/** Worldkeeper Home values that belong to each book rather than to the world. */
const WORLD_PER_BOOK = { milestones: [], banner: '', bannerPosition: 60, bannerStyle: 'clear', manualWords: 0, pov: '' };
function bindWorldNovel(world) {
  const nv = world.settings && world.settings.novel; if (!nv) return;
  const first = activeProject();
  if (first && !first.wk) { first.wk = {}; for (const k of Object.keys(WORLD_PER_BOOK)) first.wk[k] = nv[k] !== undefined ? nv[k] : clone(WORLD_PER_BOOK[k]); }
  for (const [wkKey, [pKey, num, toWorld, fromWorld]] of Object.entries(WORLD_SHARED)) {
    Object.defineProperty(nv, wkKey, {
      enumerable: true, configurable: true,
      get: () => { const p = activeProject(); const v = p ? p[pKey] : ''; return toWorld ? toWorld(v) : v; },
      set: (v) => { const p = ensureProject(); let x = fromWorld ? fromWorld(v) : v; if (num) x = num(x); if (p[pKey] !== x) setProjectField(p, pKey, x); },
    });
  }
  // The series line: shown as "Series · Book N"; typing a series name in Worldkeeper puts the book in that series.
  Object.defineProperty(nv, 'series', {
    enumerable: true, configurable: true, get: () => seriesLine(activeProject()),
    set: (v) => {
      const p = ensureProject(); const name = String(v || '').replace(/[\s,·:–—-]*\bbook\s*\d+\s*$/i, '').trim();
      if (!name) { if (seriesOf(p)) removeFromSeries(p); return; }
      if (seriesOf(p) && seriesOf(p).name === name) return;
      const s = allSeries().find((x) => x.name.toLowerCase() === name.toLowerCase()) || createSeries(name);
      addToSeries(p, s.id);
    },
  });
  for (const k of Object.keys(WORLD_PER_BOOK)) {
    Object.defineProperty(nv, k, {
      enumerable: true, configurable: true,
      get: () => { const p = activeProject(); if (!p) return clone(WORLD_PER_BOOK[k]); p.wk = p.wk || {}; if (p.wk[k] === undefined) p.wk[k] = clone(WORLD_PER_BOOK[k]); return p.wk[k]; },
      set: (v) => { const p = ensureProject(); p.wk = p.wk || {}; p.wk[k] = v; SG.saveSoon(); },
    });
  }
  // Worldkeeper's Home tracks the Plot Weaver novel linked to the current book.
  const pwc = world.settings.plotweaver;
  if (pwc) Object.defineProperty(pwc, 'novel', { enumerable: true, configurable: true, get: () => { const n = linkedNovel(); return n ? n.title : ''; }, set: () => {} });
}

/** Words for Worldkeeper's Home and Draftsmith: chapters when a project has chapter notes, else Worldkeeper's own source. */
function sharedWords(fallback) {
  const src = DSS().wordSource;
  if (src === 'world') return fallback;
  const p = activeProject(); if (!p) return fallback;
  const ch = listChapters(p); if (!ch.length && src === 'auto') return fallback;
  return ch.filter((c) => !isIdea(c)).reduce((a, c) => a + (c.words || 0), 0);
}
function coverPath() { const p = activeProject(); return p && p.cover ? p.cover : ''; }

/* ---------- reader rounds → Worldkeeper milestones ---------- */
function syncRoundsToWorld(p) {
  const w = HOST.world; if (!w || !w.settings || !w.settings.novel) return;
  p = p || activeProject(); if (!p) return;
  const nv = w.settings.novel; if (!Array.isArray(nv.milestones)) nv.milestones = [];
  const ms = nv.milestones; const ids = new Set(p.rounds.map((r) => r.id));
  for (let i = ms.length - 1; i >= 0; i--) if (ms[i].roundId && ms[i].projectId === p.id && !ids.has(ms[i].roundId)) ms.splice(i, 1);
  for (const r of p.rounds) {
    let m = ms.find((x) => x.roundId === r.id);
    if (!m) { m = { id: 'sg' + r.id, roundId: r.id, projectId: p.id, progress: 0 }; ms.push(m); }
    const live = r.sends.filter((s) => s.status !== 'Dropped');
    m.name = r.name; m.kind = r.type === 'alpha' ? 'Alpha readers' : 'Beta readers'; m.due = r.due || ''; m.start = live.map((s) => s.sent).filter(Boolean).sort()[0] || '';
    m.readers = live.map((s) => ({ name: readerName(p, s.r), status: s.status === 'Feedback in' ? 2 : ['Reading', 'Finished'].includes(s.status) ? 1 : 0 }));
    m.status = live.length && live.every((s) => s.status === 'Feedback in') ? 'done' : live.some((s) => s.status !== 'Not sent') ? 'active' : 'planned';
  }
  w.saveSettingsQuiet(); w.refreshSoon(100);
}
const readerName = (p, id) => (p.readers.find((r) => r.id === id) || {}).name || 'Reader';

/* ---------- checklist steps ⇄ Worldkeeper to-do list ---------- */
const todoText = (p, it) => `${it.t} — ${p.title}`;
async function worldTodos() { const api = WorldkeeperModule.storyguild; if (!HOST.world) return null; try { return await api.readTodos(); } catch (e) { return null; } }
async function pushTodo(p, it, on) {
  const api = WorldkeeperModule.storyguild; if (!HOST.world) { notice('Turn on the Worldkeeper section to send steps to its to-do list.'); return false; }
  const list = (await api.readTodos()) || []; const text = todoText(p, it);
  const i = list.findIndex((t) => t.text.trim() === text || (it.wkText && t.text.trim() === it.wkText));
  if (on) { const row = { done: !!it.done, text, due: it.due || '', tag: 'Draftsmith' }; if (i >= 0) list[i] = Object.assign(list[i], row); else list.push(row); it.wkText = text; }
  else if (i >= 0) list.splice(i, 1);
  await api.writeTodos(list); HOST.world.refreshSoon(100); return true;
}
