/* =====================================================================
   store: read frontmatter through Obsidian's metadata cache, write through
   processFrontMatter, and keep an index of types / hierarchy / backlinks.
   ===================================================================== */
/** wait for Obsidian to re-read a note's metadata (or give up after a moment) */
function afterMeta(f, ms = 1500) {
  return new Promise((res) => { const mc = app().metadataCache; let t = null; const ref = mc.on('changed', (x) => { if (x && x.path === f.path) { mc.offref(ref); clearTimeout(t); setTimeout(res, 0); } }); t = setTimeout(() => { mc.offref(ref); res(); }, ms); });
}
/** the editor showing this note in Source / Live Preview, if any */
function openEditorFor(f) {
  let view = null;
  app().workspace.iterateAllLeaves((l) => { const v = l.view; if (!view && v && v.file && v.file.path === f.path && v.editor && typeof v.getMode === 'function' && v.getMode() === 'source') view = v; });
  return view;
}
/** current text of a note, from its open editor when there is one (the editor may be ahead of the file on disk) */
async function readNote(f) { const v = openEditorFor(f); return v ? v.editor.getValue() : app().vault.read(f); }
/** change a note's text. When the note is open in an editor the change goes through that editor,
    so the editor never saves an older copy over it. Only the changed part is replaced. */
async function processNote(f, fn) {
  const v = openEditorFor(f);
  if (!v) return app().vault.process(f, fn);
  const ed = v.editor; const old = ed.getValue(); const nw = fn(old); if (nw === old) return nw;
  let a = 0; while (a < old.length && a < nw.length && old[a] === nw[a]) a++;
  let b = 0; while (b < old.length - a && b < nw.length - a && old[old.length - 1 - b] === nw[nw.length - 1 - b]) b++;
  ed.replaceRange(nw.slice(a, nw.length - b), ed.offsetToPos(a), ed.offsetToPos(old.length - b));
  if (typeof v.save === 'function') await v.save(); else if (typeof v.requestSave === 'function') v.requestSave();
  return nw;
}
const S = {
  _idx: null,
  dirty() { this._idx = null; },

  fm(f) { return (f && app().metadataCache.getFileCache(f)?.frontmatter) || {}; },
  files() { const tpl = normalizePath(ST().templatesFolder || 'Templates') + '/'; return app().vault.getMarkdownFiles().filter((f) => !f.path.startsWith(tpl)); },
  resolve(name, src = '') { if (!name) return null; return app().metadataCache.getFirstLinkpathDest(name, src) || null; },
  link(file, src = '') { return `[[${app().metadataCache.fileToLinktext(file, src, true)}]]`; },
  write(f, fn) { return app().fileManager.processFrontMatter(f, fn); },

  typeIdFromFm(fm) {
    const v = String(arr(fm && fm.type)[0] ?? '').toLowerCase();
    if (!v) return undefined;
    return Object.keys(T()).find((id) => String(T()[id].typeValue).toLowerCase() === v);
  },
  typeIdOf(f) { return f ? this.ix().type.get(f.path) : undefined; },
  isEntry(f) { return !!f && String(arr(this.fm(f).type)[0] ?? '').toLowerCase() === String(ST().entryType).toLowerCase(); },
  notesOf(id) { return (this.ix().byType[id] || []).slice(); },
  entries() { return this.ix().entries.slice(); },
  managed(f) { return !!this.typeIdOf(f); },

  /** linked notes in a property: [{name, file}] */
  links(f, key) { return names(this.fm(f)[key]).map((n) => ({ name: n, file: this.resolve(n, f.path) })); },
  linkFiles(f, key) { return this.links(f, key).map((x) => x.file).filter(Boolean); },
  has(f, key, target) { return this.linkFiles(f, key).some((x) => x.path === target.path); },

  parentOf(f) { return this.ix().parent.get(f.path) || null; },
  ancestors(f) { const out = []; let p = this.parentOf(f), g = 0; while (p && g++ < 15) { out.unshift(p); p = this.parentOf(p); } return out; },
  childrenOf(f) { return (this.ix().children.get(f.path) || []).slice().sort(byName); },
  descendants(f) { const out = [], st = [f]; while (st.length) { for (const k of this.childrenOf(st.pop())) { out.push(k); st.push(k); } } return out; },
  backlinks(f) { return (this.ix().back.get(f.path) || []).slice(); },
  refsOf(f, m) { return this.notesOf(m.from).filter((c) => this.has(c, m.via, f)); },
  isDemonChar(f) { const fm = this.fm(f); return fm.role === 'Demon' || this.linkFiles(f, 'species').some((s) => this.typeIdOf(s) === 'demon'); },

  /** notes the + picker offers for a link field */
  candidates(lf, exclude) {
    const vals = lf.targets.map((t) => (T()[t] ? T()[t].typeValue : t).toLowerCase());
    return this.files().filter((f) => {
      if (exclude && f.path === exclude.path) return false;
      const fm = this.fm(f); const tv = String(arr(fm.type)[0] ?? '').toLowerCase();
      if (!vals.includes(tv)) return false;
      if (lf.where && tv === 'character') return Object.entries(lf.where).every(([k, v]) => arr(fm[k]).includes(v));
      return true;
    }).sort(byName);
  },

  ix() {
    if (this._idx) return this._idx;
    const idx = { byType: {}, type: new Map(), parent: new Map(), children: new Map(), back: new Map(), entries: [] };
    const files = this.files();
    for (const f of files) {
      const fm = this.fm(f); const id = this.typeIdFromFm(fm);
      if (id) { idx.type.set(f.path, id); (idx.byType[id] ??= []).push(f); }
      else if (String(arr(fm.type)[0] ?? '').toLowerCase() === String(ST().entryType).toLowerCase()) idx.entries.push(f);
    }
    for (const k of Object.keys(idx.byType)) idx.byType[k].sort(byName);
    idx.entries.sort(byName);
    const addBack = (target, rec) => { if (!target) return; const l = idx.back.get(target.path) || []; l.push(rec); idx.back.set(target.path, l); };
    for (const f of files) {
      const id = idx.type.get(f.path); const fm = this.fm(f);
      if (id) {
        const t = T()[id];
        if (t.parentKey) {
          const pf = this.resolve(names(fm[t.parentKey])[0], f.path);
          if (pf && pf.path !== f.path) { idx.parent.set(f.path, pf); const c = idx.children.get(pf.path) || []; c.push(f); idx.children.set(pf.path, c); }
        }
        for (const lf of t.links || []) for (const n of names(fm[lf.key])) { const tf = this.resolve(n, f.path); if (tf && tf.path !== f.path) addBack(tf, { from: f, type: id, label: lf.label }); }
        for (const r of arr(fm[ST().relationshipKey])) { const tf = this.resolve(linkName(r && r.name), f.path); if (tf) addBack(tf, { from: f, type: id, label: 'Relationship · ' + (r.type || '') }); }
        for (const sp of arr(fm.spells)) for (const n of names(sp && sp.knownBy)) addBack(this.resolve(n, f.path), { from: f, type: id, label: 'Knows ' + (sp.name || 'a spell') });
        for (const g of arr(fm.gods)) addBack(this.resolve(linkName(g && g.name), f.path), { from: f, type: id, label: 'God · ' + ((g && g.rank) || '') });
      } else if (idx.entries.includes(f)) {
        for (const n of names(fm.links)) addBack(this.resolve(n, f.path), { from: f, type: 'entry', label: 'Encyclopedia · ' + (fm.category || '') });
      }
    }
    this._idx = idx;
    return idx;
  },

  /* ---------- images ---------- */
  imageFile(v, src = '') {
    const raw = String(arr(v)[0] ?? '').trim();
    if (!raw || /^https?:/i.test(raw)) return null;
    const md = raw.match(/^!?\[.*?\]\((.+?)\)$/);
    const n = md ? decodeURI(md[1]) : linkName(raw.replace(/^!/, ''));
    return this.resolve(n, src) || app().vault.getAbstractFileByPath(n);
  },
  imageSrc(v, src = '') {
    const raw = String(arr(v)[0] ?? '').trim();
    if (/^https?:/i.test(raw)) return raw;
    const f = this.imageFile(v, src);
    return f instanceof TFile ? app().vault.getResourcePath(f) : null;
  },

  /* ---------- folders ---------- */
  chainFor(f) {
    const id = this.typeIdOf(f); if (!id) return [];
    if (GEO.includes(id)) return this.ancestors(f).map((x) => x.basename);
    const hl = (T()[id].links || []).find((l) => l.placement === 'header' && l.chain);
    const first = hl && this.linkFiles(f, hl.key)[0];
    return first ? [...this.ancestors(first), first].map((x) => x.basename) : [];
  },
  folderFor(id, chain = []) {
    const t = T()[id]; const pat = ST().folderMode === 'nested' ? t.nested : t.folder;
    return normalizePath(String(pat || '').replace('{root}', ST().root).replace('{path}', chain.map(safeName).join('/')).replace('{type}', t.plural).replace(/\/+/g, '/').replace(/^\/|\/$/g, '') || '/');
  },
  pathFor(f) { const id = this.typeIdOf(f); if (!id) return f.path; const fo = this.folderFor(id, this.chainFor(f)); return normalizePath((fo === '/' ? '' : fo + '/') + f.name); },
  encFolder(category) { return normalizePath(String(ST().encFolder).replace('{root}', ST().root).replace('{category}', safeName(category || 'Miscellany'))); },
  async ensureFolder(path) {
    if (!path || path === '/') return;
    const parts = normalizePath(path).split('/'); let cur = '';
    for (const p of parts) { cur = cur ? cur + '/' + p : p; if (!app().vault.getAbstractFileByPath(cur)) { try { await app().vault.createFolder(cur); } catch (e) { /* exists */ } } }
  },
};

/* ---------- field helpers ---------- */
const when = (x, f) => !x.when || (x.when === 'demon' ? S.isDemonChar(f) : true);
const modKey = (m) => (typeof m === 'object' && m.mod ? m.mod : m);
const MOD_LABEL = { relationships: 'Relationships', contains: 'Contains', linked: 'Linked here', conlang: 'Conlang', rules: 'Rules & limits', spellbook: 'Magic list', gods: 'Gods', worship: 'Worship' };
const MOD_ICON = { relationships: '👥', contains: '🗺️', linked: '🔗', conlang: '🔤', rules: '⚖️', spellbook: '📖', gods: '🌟', worship: '🙏' };
const modLabel = (m) => { m = modKey(m); return typeof m === 'object' ? m.ref : MOD_LABEL[m] || m; };
const modIcon = (m) => { m = modKey(m); return typeof m === 'object' ? m.icon : MOD_ICON[m] || '•'; };
function tilesOf(id, f) { const t = T()[id]; return [...t.domain.filter((d) => when(d, f)).map((d) => ({ kind: 'domain', def: d })), ...t.text.filter((x) => x.tile).map((x) => ({ kind: 'text', def: x })), ...t.links.filter((l) => l.placement === 'tile' && when(l, f)).map((l) => ({ kind: 'link', def: l }))]; }
function tabsOf(id, f) {
  const t = T()[id];
  const all = [...t.body.map((b) => ({ id: 'body:' + b.heading, label: b.heading, icon: b.icon, body: b.heading })), { id: 'details', label: 'Details', icon: '📑' },
    ...t.links.filter((l) => l.placement === 'tab').map((l) => ({ id: 'link:' + l.key, label: l.label, icon: l.icon || '🔗', lf: l })),
    ...t.modules.filter((m) => when(m, f)).map((m) => ({ id: 'mod:' + modLabel(m), label: modLabel(m), icon: modIcon(m), mod: modKey(m) }))];
  const ord = (t.tabOrder || []).map((x) => x.toLowerCase()); const r = (x) => { const i = ord.indexOf(x.label.toLowerCase()); return i < 0 ? 999 : i; };
  return all.map((x, i) => [x, i]).sort((a, b) => r(a[0]) - r(b[0]) || a[1] - b[1]).map((x) => x[0]);
}

/** frontmatter for a brand-new note of a type */
function templateFm(id) {
  const t = T()[id], s = ST(); const fm = { type: t.typeValue }; const mods = t.modules.map(modKey);
  t.links.filter((l) => l.placement === 'header').forEach((l) => { fm[l.key] = l.single ? null : []; });
  t.text.forEach((x) => { fm[x.key] = []; });
  t.domain.filter((d) => !d.when).forEach((d) => { fm[d.key] = d.multi ? [] : null; });
  t.links.filter((l) => l.placement !== 'header').forEach((l) => { fm[l.key] = []; });
  fm[s.imageKey] = null; fm[s.bannerKey] = null; fm[s.galleryKey] = [];
  if (mods.includes('relationships')) fm[s.relationshipKey] = [];
  if (mods.includes('conlang')) { fm.phonology = { consonants: '', vowels: '', patterns: 'CV CVC', forbidden: '', minSyl: 1, maxSyl: 2 }; fm.lexicon = []; fm.affixes = []; }
  if (mods.includes('rules')) { fm.hardness = 50; fm.rules = []; }
  if (mods.includes('spellbook')) fm.spells = [];
  if (mods.includes('gods')) fm.gods = [];
  fm[s.detailsKey] = {};
  return fm;
}
function templateBody(id) { return '```worldkeeper\n```\n'; }
function templateText(id) { return `---\n${stringifyYaml(templateFm(id))}---\n${templateBody(id)}`; }

async function createNote(id, name, extra = {}, { open = true, chainFrom = null } = {}) {
  const nm = safeName(name); if (!nm) return null;
  let chain = [];
  if (chainFrom) chain = [...S.ancestors(chainFrom), chainFrom].map((x) => x.basename);
  const folder = S.folderFor(id, chain); await S.ensureFolder(folder);
  const path = normalizePath((folder === '/' ? '' : folder + '/') + nm + '.md');
  const existing = app().vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) { toast(`${path} already exists`); if (open) app().workspace.getLeaf(false).openFile(existing); return existing; }
  const t = T()[id];
  let content = templateBody(id);
  const tpl = t.template && app().vault.getAbstractFileByPath(normalizePath(t.template));
  if (tpl instanceof TFile) content = (await app().vault.read(tpl)).replace(/\{\{\s*(title|name)\s*\}\}/gi, nm);
  const file = await app().vault.create(path, content);
  await S.write(file, (fm) => { const base = templateFm(id); for (const [k, v] of Object.entries(base)) if (!(k in fm)) fm[k] = v; fm.type = t.typeValue; Object.assign(fm, extra); });
  S.dirty();
  if (open) await app().workspace.getLeaf(false).openFile(file);
  return file;
}
