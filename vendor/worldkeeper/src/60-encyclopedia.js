/* =====================================================================
   encyclopedia
   ===================================================================== */
async function createEntry(title, category) {
  const nm = safeName(title); if (!nm) return null;
  const cat = category || 'Miscellany'; const folder = S.encFolder(cat); await S.ensureFolder(folder);
  const path = normalizePath(`${folder}/${nm}.md`);
  const ex = app().vault.getAbstractFileByPath(path); if (ex instanceof TFile) { toast('An entry with that title exists'); return ex; }
  const fm = { type: ST().entryType, category: cat, tags: [], links: [], seeAlso: [] };
  const f = await app().vault.create(path, `---\n${stringifyYaml(fm)}---\n\`\`\`worldkeeper-entry\n\`\`\`\n\n`);
  S.dirty(); return f;
}
function entryRelated(f) {
  const mine = new Set(S.linkFiles(f, 'links').map((x) => x.path));
  return S.entries().filter((o) => o.path !== f.path).map((o) => [o, S.linkFiles(o, 'links').filter((l) => mine.has(l.path))]).filter(([, sh]) => sh.length);
}
/** links panel + see also + related (used in the view and in the entry note's code block) */
function renderEntryMeta(f, opts = {}) {
  const s = ST(); const fm = S.fm(f); const wrap = h('div', { class: 'enc-metawrap' });
  // save, wait for Obsidian to re-read the note, then redraw this panel in place (no need to reopen the entry)
  const W = async (fn) => { const ready = afterMeta(f); await S.write(f, fn); await ready; if (wrap.isConnected) wrap.replaceWith(renderEntryMeta(f, opts)); };
  const catSel = h('select', { class: 'dropdown wk-sm' }, ...s.encCategories.map((c) => h('option', { selected: fm.category === c }, c)), fm.category && !s.encCategories.includes(fm.category) ? h('option', { selected: true }, fm.category) : null);
  catSel.addEventListener('change', () => W((x) => { x.category = catSel.value; }));
  ap(wrap, h('div', { class: 'enc-meta' }, catSel, ...arr(fm.tags).map((t, i) => h('span', { class: 'cs-chip is-plain' }, '#' + t, h('span', { class: 'cs-x', onclick: () => W((x) => { x.tags = arr(x.tags).filter((_, j) => j !== i); }) }, '✕'))),
    h('button', { class: 'cs-add', title: 'Add tag', onclick: () => prompt2('Add tag', 'tag', (v) => W((x) => { x.tags = [...arr(x.tags), v.replace(/^#/, '').toLowerCase().replace(/\s+/g, '-')]; })) }, '#'),
    h('span', { class: 'cs-hint' }, 'Updated ' + new Date(f.stat.mtime).toLocaleDateString())));
  const body = h('div', { class: 'cs-tile-body' });
  const lks = S.links(f, 'links').sort((a, b) => (TYPE_ORDER.indexOf(S.typeIdOf(a.file)) + 1 || 99) - (TYPE_ORDER.indexOf(S.typeIdOf(b.file)) + 1 || 99));
  lks.forEach((l) => ap(body, chip(l.name, f.path, { file: l.file, label: (l.file ? typeIcon(l.file) + ' ' : '') + display(l.name), onX: () => W((x) => { x.links = arr(x.links).filter((y) => linkName(y) !== l.name); }) })));
  ap(body, h('button', { class: 'cs-add', title: 'Link elements', onclick: () => {
    const items = S.files().filter((x) => S.managed(x)).sort(byName).map((x) => ({ label: x.basename, sub: typeIcon(x) + ' ' + typeLabel(x), value: x.path }));
    const sel = lks.map((l) => l.file?.path).filter(Boolean); let next = sel;
    suggest({ items, selected: sel, toggle: true, placeholder: 'Link characters, places, magic… (esc when done)', source: 'any template', onPick: (v) => { next = v; } });
    const obs = new MutationObserver(() => { if (!document.querySelector('.wk-modal-bg')) { obs.disconnect(); if (next.join('|') !== sel.join('|')) W((x) => { const keepUnresolved = arr(x.links).filter((y) => !S.resolve(linkName(y), f.path)); x.links = [...keepUnresolved, ...next.map((p) => S.link(app().vault.getAbstractFileByPath(p), f.path))]; }); } });
    obs.observe(document.body, { childList: true });
  } }, '+'));
  ap(wrap, h('div', { class: 'enc-links' }, h('div', { class: 'cs-tile-label' }, 'Linked to'), body));
  // mentioned in text but not linked
  const linked = new Set(lks.map((l) => l.file?.path));
  const ment = [...new Set(((app().metadataCache.getFileCache(f) || {}).links || []).map((l) => S.resolve(l.link, f.path)).filter((x) => x && S.managed(x) && !linked.has(x.path)).map((x) => x.path))];
  if (ment.length) ap(wrap, h('div', { class: 'enc-sugg' }, h('span', { class: 'cs-hint' }, 'Mentioned but not linked:'), ...ment.map((p) => { const x = app().vault.getAbstractFileByPath(p); return h('button', { onclick: () => W((y) => { y.links = [...arr(y.links), S.link(x, f.path)]; }) }, '+ ' + x.basename); })));
  return wrap;
}
function renderEntryFoot(f, open) {
  let foot = null; const W = async (fn) => { const ready = afterMeta(f); await S.write(f, fn); await ready; if (foot && foot.isConnected) foot.replaceWith(renderEntryFoot(f, open)); };
  const rel = entryRelated(f);
  const see = h('div', { class: 'cs-tile-body' }, ...S.links(f, 'seeAlso').map((l, i) => chip(l.name, f.path, { file: l.file, label: '📚 ' + display(l.name), onX: () => W((x) => { x.seeAlso = arr(x.seeAlso).filter((_, j) => j !== i); }) })),
    h('button', { class: 'cs-add', onclick: () => { const sel = S.linkFiles(f, 'seeAlso').map((x) => x.path); let next = sel;
      suggest({ items: S.entries().filter((o) => o.path !== f.path).map((o) => ({ label: o.basename, sub: S.fm(o).category || '', value: o.path })), selected: sel, toggle: true, placeholder: 'Pick entries… (esc when done)', onPick: (v) => { next = v; } });
      const obs = new MutationObserver(() => { if (!document.querySelector('.wk-modal-bg')) { obs.disconnect(); if (next.join('|') !== sel.join('|')) W((x) => { x.seeAlso = next.map((p) => S.link(app().vault.getAbstractFileByPath(p), f.path)); }); } });
      obs.observe(document.body, { childList: true }); } }, '+'));
  return foot = h('div', { class: 'enc-foot' },
    h('div', {}, groupTitle('See also'), see),
    h('div', {}, h('div', { class: 'cs-group-title' }, 'Related entries', h('span', { class: 'enc-note' }, 'share a linked element')),
      rel.length ? h('div', { class: 'wk-bars' }, ...rel.map(([o, sh]) => { const a = h('a', { class: 'wk-link' }, o.basename); a.addEventListener('click', (e) => open(o, e)); return h('div', { class: 'enc-rel' }, a, h('span', { class: 'cs-hint' }, sh.map((x) => x.basename).join(', '))); })) : h('div', { class: 'cs-hint' }, 'None yet.')));
}
class EntryChild extends MarkdownRenderChild {
  constructor(el, file) { super(el); this.file = file; }
  onload() { this.run = liveRender(this, this.containerEl, () => this.containerEl.replaceChildren(h('div', { class: 'wk' }, h('div', { class: 'cs-root enc-inline' }, renderEntryMeta(this.file), renderEntryFoot(this.file, (o, e) => openFile(o, e)))))); this.run(); }
}

/** headings in an entry's text (skipping fenced code), for its table of contents */
function entryHeadings(text) {
  const out = []; let fence = false;
  for (const line of String(text || '').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; continue; }
    if (fence) continue;
    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/); if (m) out.push({ level: m[1].length, text: m[2].replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2').replace(/[*_`]/g, '') });
  }
  return out;
}
class EncyclopediaView extends ItemView {
  constructor(leaf) { super(leaf); this.cur = null; this.st = { q: '', cat: '', group: 'cat' }; this.comp = null; }
  getViewType() { return VIEW_ENC; }
  getDisplayText() { return 'Encyclopedia'; }
  getIcon() { return 'library'; }
  async onOpen() { this.body = this.contentEl.appendChild(h('div', { class: 'wk wk-view' })); this.run = liveRender(this, this.body, () => this.render()); this.run(); }
  show(f) { this.cur = f ? f.path : this.cur; this.run && this.run(); }
  /** "Contents" box: one link per heading, indented by level; click scrolls to it */
  renderToc(toc, md) {
    const min = Math.min(...toc.map((x) => x.level));
    const items = toc.map((x, i) => {
      const a = h('a', { class: 'enc-toc-item', style: { 'padding-left': (x.level - min) * 14 + 8 + 'px' } }, x.text);
      a.addEventListener('click', () => {
        const hs = [...md.querySelectorAll('h1, h2, h3, h4, h5, h6')]; const target = hs[i] || hs.find((e) => e.textContent.trim() === x.text);
        if (!target) return; target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.classList.add('enc-flash'); setTimeout(() => target.classList.remove('enc-flash'), 1200);
        box.querySelectorAll('.is-current').forEach((e) => e.classList.remove('is-current')); a.classList.add('is-current');
      });
      return a;
    });
    const box = h('nav', { class: 'enc-toc', 'aria-label': 'Contents' }, h('div', { class: 'enc-toc-title' }, 'Contents'), ...items);
    return box;
  }
  /** edit the entry's text right here; saves as you type, Esc or Done to finish */
  renderEditor(f, text) {
    const ta = h('textarea', { class: 'cs-text-edit enc-edit', placeholder: 'Write the entry… Markdown works: ## headings, - lists, **bold**, [[links]].' }, text);
    let t = null; let saved = text; let closing = false;
    const write = async (v) => { await processNote(f, (txt) => { const m = txt.match(/^---\n[\s\S]*?\n---\n?/); const head = m ? m[0] : ''; return head + '```worldkeeper-entry\n```\n\n' + v.replace(/\s+$/, '') + '\n'; }); };
    const flush = async () => { clearTimeout(t); if (ta.value !== saved) { saved = ta.value; await write(ta.value); } };
    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.max(320, ta.scrollHeight + 4) + 'px'; };
    const done = async () => { if (closing) return; closing = true; this.editing = null; await flush(); ta.blur(); this.run(); };
    ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(flush, 900); grow(); });
    ta.addEventListener('blur', (e) => { if (e.relatedTarget && e.relatedTarget.classList && e.relatedTarget.classList.contains('wk-done')) return; flush(); });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(); } });
    ta.addEventListener('input', () => { const pos = ta.selectionStart; if (ta.value.slice(0, pos).endsWith('[[')) suggest({ items: S.files().filter((x) => S.managed(x) || S.isEntry(x)).sort(byName).map((x) => ({ label: x.basename, sub: typeLabel(x), value: x.basename })), placeholder: 'Link a note…', onPick: (n) => { ta.value = ta.value.slice(0, pos) + n + ']]' + ta.value.slice(pos); ta.focus(); ta.setSelectionRange(pos + n.length + 2, pos + n.length + 2); flush(); } }); });
    const doneBtn = h('button', { class: 'mod-cta wk-done' }, '✓ Done');
    doneBtn.addEventListener('mousedown', (e) => { e.preventDefault(); done(); });
    doneBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); done(); } });
    setTimeout(() => { grow(); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 20);
    return h('div', { class: 'enc-editor' }, h('div', { class: 'cs-section-actions' }, h('span', { class: 'cs-hint' }, 'Saves as you type · Esc to finish · links you type are suggested under “Mentioned but not linked”'), doneBtn), ta);
  }
  async render() {
    if (this.comp) this.removeChild(this.comp); this.comp = this.addChild(new obsidian.Component());
    const s = ST(), st = this.st; const all = S.entries();
    let cur = this.cur && app().vault.getAbstractFileByPath(this.cur); const fresh = cur instanceof TFile && this.pending === cur.path;
    if (!(cur instanceof TFile) || !(S.isEntry(cur) || fresh)) cur = all[0] || null; this.cur = cur ? cur.path : null; if (cur && S.isEntry(cur) && this.pending === cur.path) this.pending = null;
    const q = st.q.toLowerCase(); const texts = new Map();
    if (q) for (const f of all) texts.set(f.path, (await app().vault.cachedRead(f)).toLowerCase());
    const list = all.filter((f) => { const fm = S.fm(f); return (!st.cat || fm.category === st.cat) && (!q || f.basename.toLowerCase().includes(q) || (texts.get(f.path) || '').includes(q) || arr(fm.tags).some((t) => String(t).toLowerCase().includes(q)) || names(fm.links).some((l) => l.toLowerCase().includes(q))); });
    const search = h('input', { type: 'search', placeholder: 'Search entries, tags, links…', value: st.q });
    search.addEventListener('input', () => { st.q = search.value; const p = search.selectionStart; this.run().then(() => { const i = this.body.querySelector('.enc-side input'); if (i) { i.focus(); i.setSelectionRange(p, p); } }); });
    const side = h('div', { class: 'enc-side' },
      h('div', { class: 'enc-head' }, h('div', { class: 'cd-h1' }, '📚 Encyclopedia'), h('span', { class: 'cd-count' }, String(all.length))),
      h('button', { class: 'mod-cta enc-new', onclick: () => prompt2('New encyclopedia entry', 'Entry title', async (v) => { const f = await createEntry(v, st.cat || 'Miscellany'); if (f) { this.cur = f.path; this.pending = f.path; this.editing = f.path; this.run(); } }) }, '+ New entry'),
      search,
      h('div', { class: 'enc-cats' }, h('button', { class: st.cat === '' ? 'is-on' : '', onclick: () => { st.cat = ''; this.run(); } }, 'All'), ...s.encCategories.filter((c) => all.some((f) => S.fm(f).category === c)).map((c) => h('button', { class: st.cat === c ? 'is-on' : '', onclick: () => { st.cat = c; this.run(); } }, c))),
      h('div', { class: 'enc-cats' }, h('button', { class: st.group === 'cat' ? 'is-on' : '', onclick: () => { st.group = 'cat'; this.run(); } }, 'By category'), h('button', { class: st.group === 'az' ? 'is-on' : '', onclick: () => { st.group = 'az'; this.run(); } }, 'A–Z')));
    const groups = {}; list.forEach((f) => { const k = st.group === 'az' ? f.basename[0].toUpperCase() : S.fm(f).category || 'Uncategorised'; (groups[k] ??= []).push(f); });
    for (const k of Object.keys(groups).sort()) { ap(side, groupTitle(k, groups[k].length)); for (const f of groups[k]) ap(side, h('button', { class: 'enc-item' + (cur && f.path === cur.path ? ' is-on' : ''), onclick: () => { this.cur = f.path; this.run(); } }, h('span', {}, f.basename), h('small', {}, names(S.fm(f).links).length + ' links'))); }
    if (!list.length) ap(side, h('div', { class: 'cs-hint' }, all.length ? 'No entries match.' : 'No entries yet.'));
    const main = h('div', { class: 'enc-main cs-root' });
    if (!cur) ap(main, empty('Create your first entry to start your encyclopedia.'));
    else {
      ap(main, h('div', { class: 'note-path' }, '📁 ' + cur.path),
        h('div', { class: 'enc-title-row' }, h('h1', { class: 'enc-title' }, cur.basename), h('span', { class: 'sp' }),
          this.editing === cur.path ? null : h('button', { class: 'mod-cta', onclick: () => { this.editing = cur.path; this.run(); } }, '✎ Edit'),
          h('button', { title: 'Open the note itself', onclick: (e) => openFile(cur, e) }, '↗ Open note'),
          h('button', { title: 'Delete entry', onclick: () => confirm2('Delete entry?', `“${cur.basename}” will be moved to the trash.`, async () => { await app().vault.trash(cur, true); this.cur = null; }, 'Delete') }, '🗑')),
        renderEntryMeta(cur, { inView: true }));
      const raw = await app().vault.cachedRead(cur);
      const body = raw.replace(/^---\n[\s\S]*?\n---\n?/, '').replace(/```worldkeeper-entry\s*\n```\s*/g, '').trim();
      if (this.editing === cur.path) ap(main, this.renderEditor(cur, body));
      else {
        const md = h('div', { class: 'enc-md markdown-rendered', title: 'Double-click to edit' });
        const toc = entryHeadings(body);
        if (toc.length) ap(main, h('div', { class: 'enc-body has-toc' }, md, this.renderToc(toc, md)));
        else ap(main, md);
        md.addEventListener('dblclick', (e) => { if (!e.target.closest('a')) { this.editing = cur.path; this.run(); } });
        if (body) await MarkdownRenderer.render(app(), body, md, cur.path, this.comp);
        else { const e = empty('Empty entry. Click to start writing.'); e.classList.add('is-clickable'); e.addEventListener('click', () => { this.editing = cur.path; this.run(); }); ap(md, e); }
      }
      ap(main, renderEntryFoot(cur, (o) => { this.cur = o.path; this.run(); }));
    }
    this.body.replaceChildren(h('div', { class: 'enc' }, side, main));
  }
}
