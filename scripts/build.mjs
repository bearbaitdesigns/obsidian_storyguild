// Builds main.js and styles.css for Storyguild. No dependencies.
//   node scripts/build.mjs
//
// Layout
//   vendor/worldkeeper/src/*.js   Worldkeeper source (unchanged files)
//   vendor/plot-weaver/main.js    Plot Weaver source (unchanged file)
//   src/*.js                      Storyguild host + Draftsmith
//
// Worldkeeper and Plot Weaver are each wrapped in their own function scope so
// their top-level names never collide. A few small, named patches connect
// them to the host; each must match exactly once or the build fails, so an
// upstream change can never be patched silently in the wrong place.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(join(root, ...p), 'utf8');
const manifest = JSON.parse(read('manifest.json'));

function patch(src, name, find, replace) {
  const n = src.split(find).length - 1;
  if (n !== 1) throw new Error(`Patch "${name}" matched ${n} times (expected 1)`);
  return src.replace(find, () => replace);
}

/* ------------------------------ Worldkeeper ------------------------------ */
const wkDir = join(root, 'vendor', 'worldkeeper', 'src');
let wk = readdirSync(wkDir).filter((f) => f.endsWith('.js')).sort()
  .map((f) => `/* ---- worldkeeper/${f} ---- */\n` + readFileSync(join(wkDir, f), 'utf8')).join('\n');

// Plot Weaver is now a section of the same plugin: read it from the host.
wk = patch(wk, 'wk:pwLoad', `  const installed = !!(a.plugins && (a.plugins.manifests?.[PW_ID] || a.plugins.plugins?.[PW_ID]));
  const inst = a.plugins?.plugins?.[PW_ID] || null;
  const version = a.plugins?.manifests?.[PW_ID]?.version || '';`,
`  const inst = HOST.plot || null;
  const installed = !!inst;
  const version = HOST.plotVersion || '';`);
wk = patch(wk, 'wk:convert-pw', 'const pwInst = app().plugins?.plugins?.[PW_ID];', 'const pwInst = HOST.plot;');
// Word count shared with Draftsmith (chapter notes) when a project has chapters.
wk = patch(wk, 'wk:words', 'const words = usePW ? pw.words : Number(nv.manualWords) || 0;',
  'const words = HOST.sharedWords(usePW ? pw.words : Number(nv.manualWords) || 0);');
// Home banner falls back to the shared book cover.
wk = patch(wk, 'wk:banner', "const bnSrc = S.imageSrc(nv.banner, '');", "const bnSrc = S.imageSrc(nv.banner || HOST.coverPath(), '');");
// Reader milestones that mirror a Draftsmith reader round are read-only here.
wk = patch(wk, 'wk:ms-readers', `    if (MS_READERS.has(m.kind)) {
      m.readers = m.readers || [];`,
`    if (MS_READERS.has(m.kind) && m.roundId) {
      readers = h('div', { class: 'ms-f' }, h('label', {}, 'Readers'), h('span', { class: 'cs-hint' }, \`Synced from Draftsmith → Readers (\${(m.readers || []).length} readers). Edit them there.\`));
    } else if (MS_READERS.has(m.kind)) {
      m.readers = m.readers || [];`);
// Home banner: Plot Weaver and Draftsmith pills under the book info; on the right the
// goal ring sits above the Encyclopedia and World Atlas pills (same bottom line); a
// Books & series button.
wk = patch(wk, 'wk:hero-sections', `daysLeft != null ? h('span', {}, \`\${daysLeft} days left\`) : null)),`,
  `daysLeft != null ? h('span', {}, \`\${daysLeft} days left\`) : null), HOST.sectionPills()),`);
wk = patch(wk, 'wk:hero-corner', `h('small', {}, 'of goal'))), h('div', { class: 'hd-pills' }, enc, atlas)));`,
  `h('small', {}, 'of goal'))), h('div', { class: 'hd-side-pills' }, enc, atlas)));`);
wk = patch(wk, 'wk:hero-books', `pencilToggle(), changeBanner, renameTab);`, `pencilToggle(), changeBanner, renameTab, HOST.booksButton());`);
// Gods and demons (individuals) get their own sheet templates, grouped with Characters
// under Story. Existing characters with role Deity / Demon keep working everywhere.
wk = patch(wk, 'wk:type-order', `const TYPE_ORDER = ['character', ...GEO, ...CROSS, ...DIVINE, 'item'];`, `const TYPE_ORDER = ['character', 'god', 'fiend', ...GEO, ...CROSS, ...DIVINE, 'item'];`);
wk = patch(wk, 'wk:god-fiend-types', `  planet: { label: 'Planet', plural: 'Planets',`, `  god: { label: 'God', plural: 'Gods', icon: '☀️', typeValue: 'god', folder: 'Story/Gods', nested: 'Story/Gods', template: '',
    text: [{ key: 'alias', label: 'Also called' }, { key: 'domains', label: 'Domains', tile: true }, { key: 'symbol', label: 'Holy symbol', tile: true }],
    domain: [D('rank', 'Rank', ['Primordial', 'Greater god', 'Lesser god', 'Demigod', 'Saint']), D('gender', 'Gender', ['Female', 'Male', 'Non-binary', 'Genderless', 'Unknown']), D('alignment', 'Nature', ['Benevolent', 'Neutral', 'Capricious', 'Malevolent']), D('status', 'Worship', ['Worshipped', 'Waning', 'Forgotten', 'Forbidden', 'Ascendant'])],
    links: [L('realm', 'Dwells in', 'header', GEO, { icon: '☁️', chain: true }), L('pantheon', 'Pantheon', 'tile', ['pantheon']), L('magic', 'Grants magic', 'tile', ['magic']), L('opposes', 'Opposed by', 'tile', ['fiend', 'demon', 'god', 'character']),
      L('items', 'Relics', 'tab', ['item'], { icon: '🗡️' }), L('connections', 'Orders & cults', 'tab', ['organization'], { icon: '🛡️' })],
    body: [{ heading: 'Notes', icon: '✏️' }, { heading: 'Mythology', icon: '📜' }], modules: ['relationships', 'linked'],
    tabOrder: ['Notes', 'Mythology', 'Details', 'Relationships', 'Relics', 'Orders & cults', 'Linked here'] },
  fiend: { label: 'Demon', plural: 'Demons', icon: '👹', typeValue: 'fiend', folder: 'Story/Demons', nested: 'Story/Demons', template: '',
    text: [{ key: 'alias', label: 'Known as' }, { key: 'title', label: 'Title', tile: true }, { key: 'trueName', label: 'True name', tile: true }],
    domain: [D('rank', 'Rank', ['Archdemon', 'Greater', 'Lesser', 'Fiend', 'Imp']), D('binding', 'Status', ['Free', 'Bound', 'Dormant', 'Banished', 'Slain']), D('gender', 'Gender', ['Female', 'Male', 'Non-binary', 'Genderless', 'Unknown'])],
    links: [L('location', 'Location', 'header', GEO, { icon: '📍', chain: true }), L('species', 'Demon species', 'tile', ['demon']), L('master', 'Serves', 'tile', ['fiend', 'god', 'character']), L('boundTo', 'Bound to', 'tile', ['character', 'item']), L('magic', 'Magic', 'tile', ['magic']),
      L('items', 'Items', 'tab', ['item'], { icon: '🗡️' })],
    body: [{ heading: 'Notes', icon: '✏️' }, { heading: 'Backstory', icon: '📜' }], modules: ['relationships', 'linked'],
    tabOrder: ['Notes', 'Backstory', 'Details', 'Relationships', 'Items', 'Linked here'] },
  planet: { label: 'Planet', plural: 'Planets',`);
// Links meant for gods also accept God sheets; links meant for demons accept Demon sheets.
{ const re = /\['character'\](, \{[^{}]*where: \{ role: 'Deity' \} \})/g; const n = (wk.match(re) || []).length; if (n !== 5) throw new Error(`Patch "wk:deity-targets" matched ${n} times (expected 5)`); wk = wk.replace(re, "['god', 'character']$1"); }
wk = patch(wk, 'wk:pantheon-opposes', `L('opposes', 'Opposed by', 'tile', ['demon', 'pantheon', 'character'])`, `L('opposes', 'Opposed by', 'tile', ['demon', 'fiend', 'pantheon', 'character'])`);
wk = patch(wk, 'wk:demon-opposes', `L('opposes', 'Opposes', 'tile', ['pantheon', 'character'])`, `L('opposes', 'Opposes', 'tile', ['pantheon', 'god', 'character'])`);
wk = patch(wk, 'wk:demon-individuals', `modules: [{ ref: 'Individuals', icon: '👹', from: 'character', via: 'species', create: { role: 'Demon', binding: 'Free' } }, 'linked'],`,
  `modules: [{ ref: 'Individuals', icon: '👹', from: ['fiend', 'character'], via: 'species', create: { binding: 'Free' } }, 'linked'],`);
wk = patch(wk, 'wk:refs-multi', `refsOf(f, m) { return this.notesOf(m.from).filter((c) => this.has(c, m.via, f)); },`, `refsOf(f, m) { return [].concat(m.from).flatMap((t) => this.notesOf(t)).filter((c) => this.has(c, m.via, f)); },`);
wk = patch(wk, 'wk:refs-sheet', `const list = S.refsOf(f, m); const ft = T()[m.from]; const noun = m.create && m.create.role === 'Demon' ? 'demon' : ft.label.toLowerCase();`,
  `const list = S.refsOf(f, m); const fromId = [].concat(m.from)[0]; const ft = T()[fromId]; const noun = m.create && m.create.role === 'Demon' ? 'demon' : ft.label.toLowerCase();`);
{ const n = wk.split('createNote(m.from,').length - 1; if (n !== 1) throw new Error(`Patch "wk:refs-create" matched ${n} times (expected 1)`); wk = wk.replace('createNote(m.from,', 'createNote([].concat(m.from)[0],'); }
wk = patch(wk, 'wk:is-demon', `isDemonChar(f) { const fm = this.fm(f); return fm.role === 'Demon' ||`, `isDemonChar(f) { const fm = this.fm(f); return this.typeIdOf(f) === 'fiend' || fm.role === 'Demon' ||`);
wk = patch(wk, 'wk:pantheon-gods', `const items = S.notesOf('character').filter((c) => S.fm(c).role === 'Deity' && !have.has(c.path)).map((c) => ({ label: c.basename, value: c.path }));`,
  `const items = [...S.notesOf('god'), ...S.notesOf('character').filter((c) => S.fm(c).role === 'Deity')].filter((c) => !have.has(c.path)).map((c) => ({ label: c.basename, value: c.path }));`);
wk = patch(wk, 'wk:pantheon-new-god', `const c = isNew ? await createNote('character', v, { role: 'Deity', age: 'Ageless' }, { open: false })`, `const c = isNew ? await createNote('god', v, { pantheon: [S.link(f)] }, { open: false })`);
wk = patch(wk, 'wk:pantheon-hint', `'Gods are character notes with role Deity, so each also gets a full character sheet.'`, `'Each god has its own God sheet (Story → Gods). Characters with role Deity are listed too.'`);
wk = patch(wk, 'wk:pantheon-source', `source: 'characters where role = Deity'`, `source: 'God sheets and characters with role Deity'`);
wk = patch(wk, 'wk:dash-story', `ap(nav, h('div', { class: 'sep' }, 'Story'), btn('character'),`, `ap(nav, h('div', { class: 'sep' }, 'Story'), btn('character'), btn('god'), btn('fiend'),`);
// Phone: the encyclopedia shows the list, then the entry (with a back button); its contents fold away.
wk = patch(wk, 'wk:enc-phone-item', `h('button', { class: 'enc-item' + (cur && f.path === cur.path ? ' is-on' : ''), onclick: () => { this.cur = f.path; this.run(); } }`,
  `h('button', { class: 'enc-item' + (cur && f.path === cur.path ? ' is-on' : ''), onclick: () => { this.cur = f.path; this.phoneEntry = true; this.run(); } }`);
wk = patch(wk, 'wk:enc-phone-new', `if (f) { this.cur = f.path; this.pending = f.path; this.editing = f.path; this.run(); }`,
  `if (f) { this.cur = f.path; this.pending = f.path; this.editing = f.path; this.phoneEntry = true; this.run(); }`);
wk = patch(wk, 'wk:enc-phone-back', `ap(main, h('div', { class: 'note-path' }, '📁 ' + cur.path),`,
  `ap(main, HOST.isPhone() ? h('button', { class: 'sg-back', onclick: () => { this.phoneEntry = false; this.editing = null; this.run(); } }, '‹ All entries') : null, h('div', { class: 'note-path' }, '📁 ' + cur.path),`);
wk = patch(wk, 'wk:enc-phone-mode', `this.body.replaceChildren(h('div', { class: 'enc' }, side, main));`,
  `this.body.replaceChildren(h('div', { class: 'enc' + (HOST.isPhone() ? (this.phoneEntry && cur ? ' sg-enc-entry' : ' sg-enc-list') : '') }, side, main));`);
wk = patch(wk, 'wk:enc-phone-show', `  show(f) { this.cur = f ? f.path : this.cur; this.run && this.run(); }`, `  show(f) { this.cur = f ? f.path : this.cur; if (f) this.phoneEntry = true; this.run && this.run(); }`);
wk = patch(wk, 'wk:enc-toc-fold', `h('div', { class: 'enc-toc-title' }, 'Contents')`, `h('div', { class: 'enc-toc-title', onclick: (e) => e.currentTarget.parentElement.classList.toggle('is-open') }, 'Contents')`);

// Expose a few helpers to the host.
wk += `
WorldkeeperPlugin.storyguild = { readTodos, writeTodos, pwLoad, mergeSettings, DEFAULT_SETTINGS, MS_STANDARD, S };
`;

/* ------------------------------ Plot Weaver ------------------------------ */
let pw = read('vendor', 'plot-weaver', 'main.js');
// The host wraps commit() on the instance; these patches only add the phone layout.
pw = patch(pw, 'pw:phone-board', `    else this.renderBoard(main, n);`, `    else if (HOST.isPhone()) HOST.phoneBoard(this, main, n, NV);
    else this.renderBoard(main, n);`);
pw = patch(pw, 'pw:phone-shelf', `    if (this.ui.shelfCollapsed) this.renderShelfRail(body.createDiv('pw-shelf-rail'), n);`,
  `    if (this.ui.shelfCollapsed) { if (!HOST.isPhone()) this.renderShelfRail(body.createDiv('pw-shelf-rail'), n); }`);
pw = patch(pw, 'pw:phone-tap', `    card.addEventListener('contextmenu', e => {`,
  `    if (HOST.isPhone()) card.addEventListener('click', e => { if (e.target.closest('.pw-icon-btn, .pw-note-status, .pw-link-handle')) return; e.stopPropagation(); if (external) new BeatModal(this.plugin, n, b, false).open(); else this.editBeat(b); });
    card.addEventListener('contextmenu', e => {`);

const wrap = (name, code) => `/* ============================== ${name} ============================== */
const ${name} = (function () {
  const module = { exports: {} };
${code}
  return module.exports;
})();
`;

/* ------------------------------- host ----------------------------------- */
const hostDir = join(root, 'src');
const host = readdirSync(hostDir).filter((f) => f.endsWith('.js')).sort()
  .map((f) => `/* ---- storyguild/${f} ---- */\n` + readFileSync(join(hostDir, f), 'utf8')).join('\n');

const header = `/*
 * Storyguild ${manifest.version} — Draftsmith, Worldkeeper and Plot Weaver in one plugin.
 * by bearbaitdesigns · MIT
 *
 * GENERATED by \`node scripts/build.mjs\`. Edit src/ and vendor/, not this file.
 */
'use strict';
/** Shared state the three sections use to find each other. Filled in by the host plugin. */
const HOST = {
  plugin: null, world: null, plot: null, plotVersion: '${JSON.parse(read('vendor', 'plot-weaver', 'manifest.json')).version}',
  worldVersion: '${JSON.parse(read('vendor', 'worldkeeper', 'manifest.json')).version}',
  sharedWords: (w) => w, coverPath: () => '', sectionPills: () => null, booksButton: () => null, isPhone: () => false, phoneBoard: null,
};
`;
const main = header + wrap('WorldkeeperModule', wk) + wrap('PlotWeaverModule', pw)
  + `/* ============================== Storyguild host + Draftsmith ============================== */
const StoryguildModule = (function () {
${host}
  return StoryguildPlugin;
})();
module.exports = StoryguildModule;
`;
writeFileSync(join(root, 'main.js'), main);

const css = [
  '/* Storyguild — generated by scripts/build.mjs */',
  '/* ---- Draftsmith ---- */', read('src', 'draftsmith.css'),
  '/* ---- Worldkeeper ---- */', read('vendor', 'worldkeeper', 'styles.css'),
  '/* ---- Plot Weaver ---- */', read('vendor', 'plot-weaver', 'styles.css'),
  '/* ---- Storyguild additions to Worldkeeper ---- */', read('src', 'worldkeeper-additions.css'),
].join('\n');
writeFileSync(join(root, 'styles.css'), css);
console.log(`main.js ${(main.length / 1024).toFixed(0)} KB · styles.css ${(css.length / 1024).toFixed(0)} KB`);
