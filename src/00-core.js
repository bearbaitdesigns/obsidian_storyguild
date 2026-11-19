/* =====================================================================
   Storyguild host + Draftsmith — core helpers and defaults
   ===================================================================== */
const ob = require('obsidian');
const { Plugin, ItemView, Modal, Setting, Notice, PluginSettingTab, TFile, TFolder, normalizePath, FuzzySuggestModal, Menu } = ob;

const SG_ID = 'storyguild';
const VIEW_DS = 'storyguild-draftsmith';
const OLD_IDS = { world: 'worldkeeper', plot: 'plot-weaver' };

/* ---------- tiny DOM builder (Draftsmith uses ds- classes) ---------- */
function el(tag, a = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(a || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [p, q] of Object.entries(v)) e.style.setProperty(p, q); }
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v;
    else if (k === 'checked' || k === 'selected' || k === 'disabled' || k === 'multiple') e[k] = !!v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(5)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return e;
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const daysUntil = (iso) => (iso ? Math.round((new Date(iso + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 864e5) : null);
const fmtN = (n) => Number(n || 0).toLocaleString();
const clone = (o) => JSON.parse(JSON.stringify(o));
const safeName = (s) => String(s || '').replace(/[\\/:*?"<>|#^[\]]/g, '').trim() || 'Untitled';
const notice = (m, t) => new Notice(m, t);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Markdown helpers ---------- */
function splitFrontmatter(text) {
  const m = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return m ? { fm: m[1], body: text.slice(m[0].length) } : { fm: '', body: String(text) };
}
/** Prose words in a note body: ignores frontmatter, comments, code, link targets and markup. */
function countWords(text) {
  let b = splitFrontmatter(text).body;
  b = b.replace(/%%[\s\S]*?%%/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[\[[^\]]*\]\]/g, ' ').replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*>\s*\[![^\]]*\][+-]?/gm, ' ').replace(/[#*_>`~=|-]+/g, ' ');
  const m = b.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return m ? m.length : 0;
}

/* ---------- Defaults ---------- */
const STAGES = ['Planning', 'First draft', 'Second draft', 'Revising', 'Editing', 'Querying', 'Published'];
const FORMATS = ['PDF', 'Word (.docx)', 'EPUB', 'Google Doc', 'Print copy', 'Other'];
const SEND_STATUS = ['Not sent', 'Sent', 'Reading', 'Finished', 'Feedback in', 'Dropped'];
const NOTE_TYPES = ['Big picture', 'Praise', 'Confusion', 'Pacing', 'Character', 'Plot hole', 'Line', 'Other'];
const READER_COLORS = ['#a882ff', '#5aa6e0', '#e0b04f', '#5fb98a', '#e06c6c', '#c78bd6', '#6fc1d9', '#d9a46f'];

const DEFAULT_QUESTIONS = {
  alpha: ['Did the premise hook you? Where did you start to care?', 'Were there places you were confused about what was happening or why?', 'Which characters felt most and least real?', 'Where did the story drag?', 'Did the ending feel earned?'],
  beta: ['Where (if anywhere) did you put the book down?', 'How did the pacing feel overall?', 'Did any scene or reveal feel unbelievable?', 'Who was your favourite character, and why?', 'Would you recommend this book to a friend? Why or why not?'],
};

/** Publishing checklists. [text, auto-check key?, due?, done?] */
const CHECKLISTS = {
  draft: [
    ['Pre-draft prep', [['Premise & logline written', 'logline'], ['Outline built in Plot Weaver', 'outline'], ['Worldbuilding pass in Worldkeeper'], ['Character sheets for main cast', 'characters'], ['Research notes gathered'], ['Chapter notes set up', 'chapters']]],
    ['Draft 1 — get it down', [['Daily word goal set'], ['Draft 1 complete'], ['Rest the manuscript (2–6 weeks)']]],
    ['Draft 2 — structural revision', [['Read-through & reverse outline'], ['Big-picture fixes: plot, arcs, pacing'], ['Draft 2 complete']]],
    ['Draft 3 — scene & line revision', [['Scene-level revisions'], ['Continuity check against the Worldkeeper encyclopedia'], ['Line edit pass (voice, prose, dialogue)'], ['Draft 3 complete']]],
    ['Reader rounds', [['Latest alpha round: feedback in', 'alpha'], ['Latest beta round: feedback in & notes resolved', 'beta'], ['Revisions from beta feedback']]],
    ['Final polish', [['Read-aloud / text-to-speech pass'], ['Typos & formatting cleanup'], ['Word count within 10% of target', 'target'], ['All chapters at the final status', 'final']]],
  ],
  trad: [
    ['Manuscript ready', [['Drafting & Revision checklist complete', 'drafting'], ['Optional: freelance developmental edit'], ['Full proofread pass']]],
    ['Submission package', [['Query letter (250–350 words)'], ['Synopsis (1–2 pages)', 'synopsis'], ['Comp titles chosen', 'comps'], ['Author bio', 'bio'], ['Sample pages formatted (first 5–50 pages / 3 chapters)']]],
    ['Agent research', [['Build agent list (aim for 50–100)'], ['Check each agent’s current submission guidelines'], ['Personalize queries by agent']]],
    ['Querying', [['Send first batch (10–15)'], ['Track responses & partial/full requests'], ['Revise query if no requests after first batch'], ['Send further batches']]],
    ['Agent & offer', [['Offer call with agent'], ['Notify other agents with materials'], ['Review & sign agency agreement']]],
    ['On submission', [['Agent revision notes done'], ['Submitted to editors'], ['Publishing offer accepted'], ['Contract reviewed & signed']]],
    ['Pre-publication', [['Editorial letter revisions'], ['Copyedits reviewed'], ['First-pass pages reviewed'], ['Cover approved', 'cover'], ['Acknowledgments & dedication delivered', 'dedication'], ['Marketing plan with publicist']]],
    ['Launch', [['Pre-order campaign'], ['Launch event / signing'], ['Thank-you to readers & team']]],
  ],
  self: [
    ['Manuscript ready', [['Drafting & Revision checklist complete', 'drafting'], ['Developmental edit'], ['Copyedit / line edit'], ['Proofread (after formatting)']]],
    ['Business setup', [['Choose imprint name', 'publisher'], ['Buy ISBNs (separate for ebook & print)', 'isbn'], ['Copyright registration (optional)'], ['Set up retailer accounts (e.g. KDP, IngramSpark, Draft2Digital)']]],
    ['Design', [['Ebook cover finalized', 'cover'], ['Full print wrap (spine width from page count)'], ['Interior formatting: ebook (EPUB)'], ['Interior formatting: print (PDF)']]],
    ['Metadata & copy', [['Back-cover blurb', 'blurb'], ['Keywords (7) & categories', 'keywords'], ['Author bio', 'bio'], ['Price set for each format']]],
    ['Distribution', [['Upload ebook files'], ['Upload print files'], ['Order & check physical proof copy'], ['Set pre-order date']]],
    ['Marketing', [['Newsletter / mailing list set up'], ['ARC team recruited & ARCs sent'], ['Cover reveal'], ['Launch plan & ad budget'], ['Reviews requested on release']]],
    ['Launch', [['Release day!'], ['Post-launch: track sales & reviews']]],
  ],
};
const CHECKLIST_NAMES = { draft: 'Drafting & Revision', trad: 'Traditional', self: 'Self-publishing' };
function makeChecklists() {
  const out = {};
  for (const [k, groups] of Object.entries(CHECKLISTS)) out[k] = groups.map(([g, items]) => ({ id: uid(), g, items: items.map(([t, auto]) => ({ id: uid(), t, auto: auto || null, done: false, due: '', wk: false })) }));
  return out;
}

const DEFAULT_COMPILE = {
  format: 'pdf', chapters: 'all', statusFilter: '', titlePage: true, toc: true, frontMatter: true, draftStamp: false,
  heading: 'Chapter {n}: {title}', sceneBreak: '* * *', font: 'Times', fontSize: 11, pageSize: '6x9', manuscriptFormat: false,
  includeQuestions: false, questionsRound: '', folder: '', smartQuotes: true,
};

function makeProject(title) {
  return {
    id: uid(), title: title || 'My Novel', subtitle: '', series: '', seriesNo: '', author: '', penName: '',
    genre: '', subgenre: '', audience: '', language: 'en', targetWords: 80000, deadline: '', stage: 'First draft',
    draft: 1, draftHistory: [{ n: 1, date: today(), words: null, note: 'First draft' }],
    cover: '', logline: '', blurb: '', synopsisShort: '', synopsis: '', comps: '', keywords: '', bisac: '',
    publisher: '', isbnEbook: '', isbnPrint: '', pubDate: '', copyright: String(new Date().getFullYear()),
    dedication: '', acknowledgments: '', bio: '', extra: [],
    folder: `Novels/${safeName(title || 'My Novel')}`, chaptersFolder: '', pwNovelId: '', seriesId: '', pwSeriesLinks: [],
    readers: [], rounds: [], comments: [], checklists: makeChecklists(), checklistTab: 'draft',
    compile: clone(DEFAULT_COMPILE),
  };
}
/** Fill in anything a project saved by an older version is missing. */
function normalizeProject(p) {
  const base = makeProject(p.title);
  for (const k of Object.keys(base)) if (p[k] === undefined) p[k] = base[k];
  p.compile = Object.assign(clone(DEFAULT_COMPILE), p.compile || {});
  for (const k of Object.keys(CHECKLISTS)) if (!Array.isArray(p.checklists[k])) p.checklists[k] = makeChecklists()[k];
  for (const r of p.rounds) { r.questions = r.questions || []; for (const s of r.sends) { s.files = s.files || []; s.answers = s.answers || {}; } }
  return p;
}

const DEFAULT_DS_SETTINGS = {
  keys: { chapter: 'chapter', kind: 'chapter-type', draft: 'draft', pov: 'pov', pwChapter: 'plotweaver-chapter', project: 'manuscript' },
  autoWords: true, followPlotOrder: true, chapterTemplate: '', snapshotFolder: 'Drafts', compiledFolder: 'Compiled',
  readersFolder: 'Readers', assetsFolder: 'Assets', wordSource: 'auto',
};
const DEFAULT_DATA = {
  version: 1,
  modules: { world: true, plot: true },
  migration: { state: 'new' }, // new | postponed | done
  manuscript: { projects: [], series: [], activeId: '', settings: DEFAULT_DS_SETTINGS, ui: { tab: 'manuscript', round: '' } },
  world: null, // Worldkeeper settings (its old data.json)
  plot: null, // Plot Weaver data (its old data.json)
};
