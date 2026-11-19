/* =====================================================================
   Plot Weaver integration
   Plot Weaver keeps its outline (novels → cards, chapters, POVs, plotlines,
   influences) in its own data. Each card can link a scene note via `notePath`;
   status and word count are read from that note's properties using Plot
   Weaver's own field settings (statusField, wordsField — comma-separated).
   We read the live plugin instance when it's loaded, else its data.json.
   ===================================================================== */
const PW_ID = 'plot-weaver';
const PW_DEFAULT_STATUSES = [
  { name: 'Not started', match: 'not started, todo, to do, idea, planned', color: '#9a9aa3' },
  { name: 'In progress', match: 'in progress, drafting, writing, wip, draft, started', color: '#e0a030' },
  { name: 'Revising', match: 'revising, revision, editing, needs revision, edit', color: '#9b6ad6' },
  { name: 'Completed', match: 'completed, complete, done, finished, final', color: '#5cb85c' },
];
const PW_DEFAULT_SETTINGS = { statusField: 'status', wordsField: 'words, wordcount, word-count, word_count' };
const PW_SCENE_KINDS = ['prologue', 'chapter', 'interlude', 'epilogue'];

async function pwLoad() {
  const a = app();
  const installed = !!(a.plugins && (a.plugins.manifests?.[PW_ID] || a.plugins.plugins?.[PW_ID]));
  const inst = a.plugins?.plugins?.[PW_ID] || null;
  const version = a.plugins?.manifests?.[PW_ID]?.version || '';
  let data = inst && inst.data && Array.isArray(inst.data.novels) ? inst.data : null;
  if (!data && installed) {
    try { const d = JSON.parse(await a.vault.adapter.read(`${a.vault.configDir}/plugins/${PW_ID}/data.json`)); if (d && Array.isArray(d.novels)) data = d; } catch (e) { /* not saved yet */ }
  }
  const settings = Object.assign({}, PW_DEFAULT_SETTINGS, (data && data.settings) || {});
  if (!Array.isArray(settings.statuses) || !settings.statuses.length) settings.statuses = PW_DEFAULT_STATUSES;
  return { installed, enabled: !!inst, version, inst, data, settings };
}

/* --- Plot Weaver's own rules, mirrored --- */
const pwKind = (c) => (c && c.kind) || 'chapter';
const pwChapter = (n, id) => (n.chapters || []).find((c) => c.id === id) || null;
const pwPlotline = (n, id) => (n.plotlines || []).find((p) => p.id === id) || null;
const pwPov = (n, id) => (n.povs || []).find((p) => p.id === id) || null;
function pwOnBoard(n, b) {
  if (b.status && b.status !== 'active') return false;
  const p = pwPlotline(n, b.plotlineId); if (!p || p.archived) return false;
  return !!pwChapter(n, b.chapterId) || !!b.staged;
}
function pwIsScene(n, b) { if (!pwOnBoard(n, b) || b.offscreen) return false; const c = pwChapter(n, b.chapterId); return !c || PW_SCENE_KINDS.includes(pwKind(c)); }

function pwNoteMeta(pw, b) {
  if (!b || !b.notePath) return null;
  if (pw.inst && typeof pw.inst.noteMeta === 'function') { try { const m = pw.inst.noteMeta(b); if (m) return { status: m.status, words: m.words, def: m.def || null }; } catch (e) { /* fall back */ } }
  const f = app().vault.getAbstractFileByPath(b.notePath); if (!(f instanceof TFile)) return null;
  const fm = S.fm(f); const keys = Object.keys(fm);
  const read = (list) => { for (const want of String(list || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)) { const k = keys.find((x) => x.toLowerCase() === want); if (k !== undefined && fm[k] !== null && fm[k] !== '') return fm[k]; } return undefined; };
  let raw = read(pw.settings.statusField); if (Array.isArray(raw)) raw = raw[0];
  const status = raw === undefined ? '' : String(raw).trim();
  let w = read(pw.settings.wordsField); if (Array.isArray(w)) w = w[0];
  const num = w === undefined ? NaN : +String(w).replace(/[,\s_]/g, '');
  const key = status.toLowerCase();
  const def = key ? pw.settings.statuses.find((d) => String(d.match || '').split(',').map((x) => x.trim().toLowerCase()).concat([String(d.name || '').toLowerCase()]).includes(key)) : null;
  return { status, words: Number.isFinite(num) ? Math.round(num) : null, def: def || null };
}

function pwNovel(pw) {
  if (!pw.data) return null;
  const novels = pw.data.novels; const want = ST().plotweaver.novel;
  return (want && novels.find((n) => n.title === want || n.id === want)) || novels.find((n) => n.id === pw.data.activeNovelId) || novels[0] || null;
}

/** stats for one novel, same rules as Plot Weaver's own stats strip */
function pwStats(pw, n) {
  const empty = { scenes: 0, withNote: 0, words: 0, buckets: [], chapters: [], pov: [], plotlines: 0, influences: 0, offscreen: 0, cards: 0 };
  if (!n) return empty;
  const beats = n.beats || []; const board = beats.filter((b) => pwOnBoard(n, b)); const scenes = board.filter((b) => pwIsScene(n, b));
  const defs = pw.settings.statuses; const counts = new Map(); let withNote = 0; let words = 0;
  const metas = new Map(scenes.map((b) => [b.id, pwNoteMeta(pw, b)]));
  for (const b of scenes) {
    const m = metas.get(b.id); if (m) withNote++; if (m && m.words != null) words += m.words;
    const k = !m ? '__nonote' : m.def ? m.def.name : m.status ? '__other' : '__nostatus';
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const buckets = defs.map((d) => ({ key: d.name, label: d.name, color: d.color || '#888' }))
    .concat([{ key: '__other', label: 'Other status', color: '#6f8bb3' }, { key: '__nostatus', label: 'No status', color: '#555' }, { key: '__nonote', label: 'No note', color: '#3a3a3a' }])
    .map((x) => Object.assign(x, { count: counts.get(x.key) || 0 })).filter((x) => x.count || defs.some((d) => d.name === x.key));
  const order = defs.map((d) => d.name);
  const chapters = (n.chapters || []).filter((c) => PW_SCENE_KINDS.includes(pwKind(c))).map((c) => {
    const inCh = scenes.filter((b) => b.chapterId === c.id); let w = 0; let any = false; let least = null;
    for (const b of inCh) { const m = metas.get(b.id); if (m && m.words != null) { w += m.words; any = true; } const nm = m && m.def ? m.def.name : null; const i = nm ? order.indexOf(nm) : -1; if (least === null || i < least) least = i; }
    const def = least != null && least >= 0 ? defs[least] : null;
    return { name: c.title || 'Untitled', kind: pwKind(c), words: any ? w : 0, scenes: inCh.length, status: def ? def.name : inCh.length ? 'No status' : '', color: def ? def.color : '#555' };
  });
  const staged = scenes.filter((b) => !pwChapter(n, b.chapterId));
  if (staged.length) chapters.push({ name: 'No chapter yet', kind: 'staged', words: staged.reduce((a, b) => a + ((metas.get(b.id) || {}).words || 0), 0), scenes: staged.length, status: '', color: '#555' });
  const povCount = new Map(); for (const b of scenes) { const p = pwPov(n, b.povId); if (p) povCount.set(p.name, (povCount.get(p.name) || 0) + 1); }
  return {
    scenes: scenes.length, withNote, words, buckets, chapters, pov: [...povCount.entries()].sort((x, y) => y[1] - x[1]),
    plotlines: (n.plotlines || []).filter((p) => !p.archived).length,
    influences: board.reduce((a, b) => a + arr(b.influences).length, 0),
    offscreen: board.filter((b) => b.offscreen).length, cards: beats.length,
  };
}

/** character note for a Plot Weaver POV name: exact name/alias, else a unique first-name match */
function charForPov(name) {
  const n = String(name || '').trim().toLowerCase(); if (!n) return null;
  const chars = S.notesOf('character');
  const exact = chars.find((c) => c.basename.toLowerCase() === n || [...arr(S.fm(c).alias), ...arr(S.fm(c).aliases)].some((a) => String(a).toLowerCase() === n));
  if (exact) return exact;
  const first = chars.filter((c) => c.basename.toLowerCase().split(/\s+/)[0] === n);
  return first.length === 1 ? first[0] : null;
}
/** every card (all novels) that relates to a note: POV by name/alias, or the scene note links to it */
function pwCardsFor(pw, f) {
  if (!pw.data || !f) return [];
  const id = S.typeIdOf(f); const fm = S.fm(f);
  const namesSet = new Set([f.basename, ...arr(fm.alias), ...arr(fm.aliases)].map((x) => String(x).toLowerCase()));
  const rl = app().metadataCache.resolvedLinks || {};
  const out = [];
  for (const n of pw.data.novels) for (const b of n.beats || []) {
    if (b.status && b.status !== 'active') continue;
    const why = [];
    const pov = pwPov(n, b.povId); if (id === 'character' && pov && (namesSet.has(String(pov.name).toLowerCase()) || charForPov(pov.name)?.path === f.path)) why.push('POV');
    if (b.notePath && rl[b.notePath] && rl[b.notePath][f.path]) why.push('linked in scene note');
    if (b.notePath === f.path) continue;
    if (why.length) out.push({ n, b, why, pov, chapter: pwChapter(n, b.chapterId), plotline: pwPlotline(n, b.plotlineId), meta: pwNoteMeta(pw, b) });
  }
  return out;
}
function renderScenes(f, pw) {
  const cards = pwCardsFor(pw, f);
  if (!cards.length) return empty('No Plot Weaver scenes mention this yet.');
  const t = h('table', { class: 'cl-table pw-scenes' }, h('thead', {}, h('tr', {}, h('th', {}, 'Scene'), h('th', {}, 'Chapter'), h('th', {}, 'Plotline'), h('th', {}, 'POV'), h('th', {}, 'Status'), h('th', {}, 'Words'), h('th', {}, 'Why'))));
  const tb = h('tbody', {});
  for (const c of cards) {
    const note = c.b.notePath && app().vault.getAbstractFileByPath(c.b.notePath);
    const title = h('a', { class: 'wk-link' }, c.b.title || 'Untitled'); title.addEventListener('click', (e) => (note ? openFile(note, e) : app().commands?.executeCommandById?.(`${PW_ID}:open-board`)));
    if (note) hover(title, note.path, '', title);
    const st = c.meta ? (c.meta.def ? c.meta.def.name : c.meta.status || 'No status') : 'No note';
    const col = c.meta && c.meta.def ? c.meta.def.color : '#666';
    ap(tb, h('tr', {}, h('td', {}, title, pw.data.novels.length > 1 ? h('div', { class: 'cs-hint' }, c.n.title) : null), h('td', {}, c.chapter ? c.chapter.title : '—'),
      h('td', {}, c.plotline ? h('span', { class: 'pw-dot', style: { background: c.plotline.color || '#888' } }) : null, c.plotline ? c.plotline.name : '—'), h('td', {}, c.pov ? c.pov.name : '—'),
      h('td', {}, h('span', { class: 'wk-pill', style: { color: col } }, st)), h('td', {}, c.meta && c.meta.words != null ? fmtN(c.meta.words) : '—'), h('td', { class: 'cs-hint' }, c.why.join(', '))));
  }
  return h('div', {}, h('div', { class: 'cs-hint cs-mb' }, 'Cards from Plot Weaver where this is the POV character, or whose scene note links here.'), ap(t, tb));
}
