/* =====================================================================
   converting existing notes to a template
   ===================================================================== */
const SYN = { alias: ['aka', 'alias', 'aliases', 'nickname', 'title', 'also called'], location: ['home', 'hometown', 'lives', 'location', 'base'], parent: ['region', 'parent', 'in', 'part of', 'kingdom', 'continent', 'located in'],
  regions: ['region', 'regions', 'base', 'homeland', 'found in'], occupation: ['job', 'profession', 'occupation', 'work', 'trade', 'class'], gender: ['gender', 'sex'], age: ['age'], connections: ['faction', 'factions', 'guild', 'organization', 'house', 'affiliation'],
  orgType: ['kind', 'type'], placeType: ['kind', 'type'], hubType: ['kind', 'type'], itemType: ['kind', 'type'], planetType: ['kind', 'type'], classification: ['kind', 'type'], source: ['kind', 'source'], owner: ['owner', 'held by'], leader: ['leader', 'head'],
  [`image`]: ['image', 'portrait', 'picture', 'avatar', 'cover'] };
function targetsFor(id) { const t = T()[id]; return [...t.links.map((l) => ({ key: l.key, label: `${l.label} (link)`, kind: 'link', def: l })), ...t.domain.map((d) => ({ key: d.key, label: `${d.label} (${d.multi ? 'multi' : 'list'})`, kind: 'domain', def: d })), ...t.text.map((x) => ({ key: x.key, label: `${x.label} (text)`, kind: 'text' })), { key: ST().imageKey, label: 'Image', kind: 'raw' }]; }
function guessTarget(id, p) { const pl = p.toLowerCase(); if (['tags', 'aliases', 'cssclasses'].includes(pl)) return '__keep'; const keys = targetsFor(id).map((t) => t.key); for (const [k, syn] of Object.entries(SYN)) if (syn.includes(pl) && keys.includes(k)) return k; return keys.includes(p) ? p : '__keep'; }
function guessType(f) { const fm = S.fm(f); const tags = [...arr(fm.tags), ...((app().metadataCache.getFileCache(f) || {}).tags || []).map((t) => t.tag)].map((t) => String(t).replace(/^#/, '').toLowerCase());
  const has = (...k) => k.some((x) => tags.includes(x)); if (has('npc', 'character', 'person', 'pc')) return 'character'; if (has('location', 'place', 'city', 'town')) return 'place'; if (has('faction', 'organization', 'guild')) return 'organization';
  for (const id of Object.keys(T())) if (has(id, T()[id].label.toLowerCase())) return id; if (fm.job || fm.profession) return 'character'; if (fm.region) return 'place'; return 'character'; }
function convertFm(src, id, mapping) {
  const out = { ...templateFm(id) }; const tg = Object.fromEntries(targetsFor(id).map((t) => [t.key, t])); const notes = [];
  for (const [k, v] of Object.entries(src || {})) {
    if (k === 'position') continue; const to = mapping[k] || '__keep';
    if (to === '__drop') { notes.push(`removed ${k}`); continue; } if (to === '__keep') { if (k !== 'type') out[k] = v; continue; }
    const t = tg[to]; const vals = arr(v).map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x)));
    if (t.kind === 'link') { const res = vals.map((x) => { const f = S.resolve(linkName(x), ''); return f ? S.link(f) : `[[${linkName(x)}]]`; }); res.forEach((r) => { if (!S.resolve(linkName(r), '')) notes.push(`“${linkName(r)}” has no note yet, so it’s linked unresolved`); }); out[to] = t.def.single ? [res[0]] : [...new Set([...arr(out[to]), ...res])]; }
    else if (t.kind === 'domain') { const c = vals.map((x) => t.def.values.find((o) => o.toLowerCase() === x.toLowerCase()) || x); c.filter((x) => !t.def.values.includes(x)).forEach((x) => notes.push(`“${x}” kept and marked “not in list” for ${t.def.label}`)); out[to] = t.def.multi ? c : c[0]; }
    else if (t.kind === 'text') out[to] = [...arr(out[to]), ...vals]; else out[to] = v;
    if (to !== k) notes.push(`${k} → ${to}`);
  }
  out.type = T()[id].typeValue; return { fm: out, notes };
}
function convertCandidates(all) {
  const tf = normalizePath(ST().todoFile); const tpl = normalizePath(ST().templatesFolder || 'Templates') + '/';
  const pwInst = app().plugins?.plugins?.[PW_ID]; const sceneNotes = new Set(); for (const n of (pwInst && pwInst.data && pwInst.data.novels) || []) for (const b of n.beats || []) if (b.notePath) sceneNotes.add(b.notePath);
  return S.files().filter((f) => {
    if (S.managed(f) || S.isEntry(f) || f.path === tf || f.path.startsWith(tpl) || f.path.startsWith(app().vault.configDir)) return false;
    if (all) return true;
    const fm = S.fm(f); if (fm.type != null && fm.type !== '') return false;
    if (sceneNotes.has(f.path) || fm['plot-weaver-id'] != null) return false;
    return true;
  }).sort((a, b) => b.stat.mtime - a.stat.mtime);
}
function openConverter(pre) {
  let showAll = false; let cands = convertCandidates(false); const sel = new Set(pre.map((f) => f.path));
  let id = pre.length ? guessType(pre[0]) : 'character'; const mapping = {}; const opts = { body: true, move: true }; let q = '';
  const box = h('div', { class: 'cv' }); const close = modalShell(box, { wide: true });
  const draw = () => {
    const files = [...sel].map((p) => app().vault.getAbstractFileByPath(p)).filter(Boolean);
    const props = [...new Set(files.flatMap((f) => Object.keys(S.fm(f)).filter((k) => k !== 'position')))];
    props.forEach((p) => { if (!(p in mapping)) mapping[p] = guessTarget(id, p); });
    const first = files[0]; const res = first ? convertFm(S.fm(first), id, mapping) : null;
    const typeSel = h('select', { class: 'dropdown' }, ...Object.keys(T()).map((t) => h('option', { value: t, selected: t === id }, `${T()[t].icon} ${T()[t].label} template`)));
    typeSel.addEventListener('change', () => { id = typeSel.value; for (const k in mapping) delete mapping[k]; draw(); });
    const search = h('input', { type: 'search', placeholder: 'Filter notes…', value: q });
    search.addEventListener('input', () => { q = search.value; const p = search.selectionStart; draw(); const i = box.querySelector('.cv-col input[type=search]'); i.focus(); i.setSelectionRange(p, p); });
    const shown = cands.filter((f) => !q || f.path.toLowerCase().includes(q.toLowerCase())).slice(0, 200);
    const tagBtn = (tg) => h('button', { onclick: () => { sel.clear(); cands.filter((f) => [...arr(S.fm(f).tags), ...((app().metadataCache.getFileCache(f) || {}).tags || []).map((t) => t.tag)].map((t) => String(t).replace(/^#/, '').toLowerCase()).includes(tg)).forEach((f) => sel.add(f.path)); if (sel.size) id = guessType(app().vault.getAbstractFileByPath([...sel][0])); for (const k in mapping) delete mapping[k]; draw(); } }, '#' + tg);
    box.replaceChildren(
      h('div', { class: 'cv-head' }, h('div', {}, h('b', {}, 'Convert notes'), h('div', { class: 'cs-hint' }, 'Pick notes and a template, check how their properties map, then convert. The note text is kept.')), typeSel, h('button', { class: 'cv-x', onclick: () => close() }, '✕')),
      h('div', { class: 'cv-body' },
        h('div', { class: 'cv-col' }, h('div', { class: 'cv-label' }, `1 · Notes (${sel.size} selected)`), search,
          h('div', { class: 'cv-quick' }, ...['npc', 'character', 'location', 'faction'].map(tagBtn), h('button', { onclick: () => { sel.clear(); draw(); } }, 'None')),
          ((cb) => { cb.addEventListener('change', () => { showAll = cb.checked; cands = convertCandidates(showAll); draw(); }); return h('label', { class: 'cv-opt cs-hint' }, cb, 'Show all notes (including ones with a type or Plot Weaver scenes)'); })(h('input', { type: 'checkbox', checked: showAll })),
          h('div', { class: 'cv-list' }, ...shown.map((f) => { const cb = h('input', { type: 'checkbox', checked: sel.has(f.path) }); cb.addEventListener('change', () => { cb.checked ? sel.add(f.path) : sel.delete(f.path); draw(); });
            return h('label', { class: 'cv-note' + (sel.has(f.path) ? ' is-on' : '') }, cb, h('span', {}, f.basename), h('small', {}, (f.parent && f.parent.path !== '/' ? f.parent.path + ' · ' : '') + (Object.keys(S.fm(f)).filter((k) => k !== 'position').join(', ') || 'no properties'))); })),
          cands.length > 200 && shown.length === 200 ? h('div', { class: 'cs-hint' }, 'Showing 200. Filter to find more.') : null, cands.length ? null : h('div', { class: 'cs-hint' }, 'Every note already uses a template.')),
        h('div', { class: 'cv-col' }, h('div', { class: 'cv-label' }, `2 · Map properties → ${T()[id].label}`),
          props.length ? h('div', { class: 'cv-map' }, ...props.flatMap((p) => { const s2 = h('select', { class: 'dropdown' }, h('option', { value: '__keep', selected: mapping[p] === '__keep' }, 'Keep as-is'), h('option', { value: '__drop', selected: mapping[p] === '__drop' }, 'Remove'), h('optgroup', { label: T()[id].label + ' fields' }, ...targetsFor(id).map((t) => h('option', { value: t.key, selected: mapping[p] === t.key }, t.label)))); s2.addEventListener('change', () => { mapping[p] = s2.value; draw(); }); return [h('code', {}, p), h('span', { class: 'cs-hint' }, '→'), s2]; })) : h('div', { class: 'cs-hint' }, 'Select notes to see their properties.'),
          h('div', { class: 'cv-label cs-mt' }, '3 · Options'),
          ((cb) => { cb.addEventListener('change', () => { opts.body = cb.checked; }); return h('label', { class: 'cv-opt' }, cb, 'Move the note’s existing text into its Notes tab'); })(h('input', { type: 'checkbox', checked: opts.body })),
          ((cb) => { cb.addEventListener('change', () => { opts.move = cb.checked; }); return h('label', { class: 'cv-opt' }, cb, 'Move into the folder set in Worldkeeper settings → Folders'); })(h('input', { type: 'checkbox', checked: opts.move }))),
        h('div', { class: 'cv-col' }, h('div', { class: 'cv-label' }, first ? `Preview · ${first.basename}` : 'Preview'), res ? [h('pre', { class: 'cv-yaml' }, '---\n' + stringifyYaml(res.fm) + '---'), res.notes.length ? h('ul', { class: 'cv-notes' }, ...res.notes.map((x) => h('li', {}, x))) : null] : h('div', { class: 'cs-hint' }, 'Nothing selected.'))),
      h('div', { class: 'cv-foot' }, h('span', { class: 'cs-hint' }, 'Notes keep their names, so links and backlinks stay intact.'), h('button', { onclick: () => close() }, 'Cancel'),
        h('button', { class: 'mod-cta', disabled: !sel.size, onclick: async () => { close(); const n = await convertFiles(files, id, mapping, opts); toast(`Converted ${n} note${n === 1 ? '' : 's'} to ${T()[id].plural}`); if (files.length === 1) openFile(app().vault.getAbstractFileByPath(files[0].path) || files[0]); } }, `Convert ${sel.size} note${sel.size === 1 ? '' : 's'}`)));
  };
  draw();
}
async function convertFiles(files, id, mapping, opts) {
  let n = 0;
  for (const f of files) {
    const res = convertFm(S.fm(f), id, mapping);
    await S.write(f, (fm) => { for (const k of Object.keys(fm)) delete fm[k]; Object.assign(fm, res.fm); });
    // move the note's existing text into its first text tab (a hidden wk-tab callout), leaving the body clean
    const firstTab = T()[id].body[0] && T()[id].body[0].heading;
    await processNote(f, (txt) => {
      const m = txt.match(/^---\n[\s\S]*?\n---\n?/); const head = m ? m[0] : ''; let body = txt.slice(head.length);
      const rest = body.replace(/```worldkeeper\s*\n```\s*\n?/, '').trim();
      if (opts.body && firstTab && rest && !TAB_HEAD_RE.test(rest.split('\n')[0])) return head + '```worldkeeper\n```\n\n' + encodeTab(firstTab, rest);
      if (!/```worldkeeper\s*\n/.test(body)) body = '```worldkeeper\n```\n' + (body.startsWith('\n') ? '' : '\n') + body;
      return head + body;
    });
    if (opts.move) {
      const t = T()[id]; let chain = [];
      const hl = t.parentKey ? t.parentKey : (t.links.find((l) => l.placement === 'header' && l.chain) || {}).key;
      const pf = hl && S.resolve(names(res.fm[hl])[0], f.path); if (pf) chain = GEO.includes(id) ? [...S.ancestors(pf), pf].map((x) => x.basename) : [...S.ancestors(pf), pf].map((x) => x.basename);
      const folder = S.folderFor(id, chain); const to = normalizePath((folder === '/' ? '' : folder + '/') + f.name);
      if (to !== f.path && !app().vault.getAbstractFileByPath(to)) { await S.ensureFolder(folder); await app().fileManager.renameFile(f, to); }
    }
    n++;
  }
  S.dirty(); P.refreshSoon(300); return n;
}

/* ---------- reorganize vault to match folder settings ---------- */
function plannedMoves() { return [...S.ix().type.keys()].map((p) => app().vault.getAbstractFileByPath(p)).filter(Boolean).map((f) => [f, S.pathFor(f)]).filter(([f, to]) => to !== f.path); }
function reorganize() {
  const moves = plannedMoves();
  if (!moves.length) { toast('Every note is already in the right folder'); return; }
  confirm2(`Move ${moves.length} note${moves.length === 1 ? '' : 's'}?`, h('div', {}, h('p', {}, 'Obsidian updates links to moved notes automatically.'), h('pre', { class: 'cv-yaml' }, moves.slice(0, 12).map(([f, to]) => `${f.path}\n  → ${to}`).join('\n') + (moves.length > 12 ? `\n…and ${moves.length - 12} more` : ''))), async () => {
    let n = 0; for (const [f, to] of moves) { if (app().vault.getAbstractFileByPath(to)) continue; await S.ensureFolder(to.split('/').slice(0, -1).join('/')); await app().fileManager.renameFile(f, to); n++; }
    toast(`Moved ${n} notes`); S.dirty(); P.refreshSoon(300);
  }, 'Move notes');
}
/** move "## Heading" sections in every Worldkeeper note into their text tabs */
async function migrateHeadings() {
  const todo = [];
  for (const id of Object.keys(T())) for (const f of S.notesOf(id)) for (const b of T()[id].body) { const sec = await headingSection(f, b.heading); if (sec) todo.push([f, b.heading, sec.body]); }
  if (!todo.length) { toast('No notes have section headings to move'); return; }
  const notes = new Set(todo.map((x) => x[0].path)).size;
  confirm2(`Move ${todo.length} section${todo.length === 1 ? '' : 's'} into tabs?`, h('div', {}, h('p', {}, `${notes} note${notes === 1 ? '' : 's'} have text under headings like “## Notes” or “## Backstory”. Each section moves into its tab (kept in the note body as a hidden block) and the heading is removed.`),
    h('pre', { class: 'cv-yaml' }, todo.slice(0, 10).map(([f, hd]) => `${f.basename} → ${hd}`).join('\n') + (todo.length > 10 ? `\n…and ${todo.length - 10} more` : ''))), async () => {
    let n = 0; for (const [f, hd] of todo) { if (await moveHeadingIntoTab(f, hd)) n++; await new Promise((r) => setTimeout(r, 30)); }
    toast(`Moved ${n} sections into tabs`); S.dirty(); P.refreshSoon(200);
  }, 'Move sections');
}
async function writeTemplates() {
  const folder = normalizePath(ST().templatesFolder || 'Templates'); await S.ensureFolder(folder); let n = 0;
  for (const id of Object.keys(T())) {
    const path = normalizePath(`${folder}/${T()[id].label}.md`); const txt = templateText(id); const ex = app().vault.getAbstractFileByPath(path);
    if (ex instanceof TFile) await app().vault.modify(ex, txt); else await app().vault.create(path, txt); n++;
  }
  toast(`Wrote ${n} templates to ${folder}/`);
}
