/* =====================================================================
   the sheet: ```worldkeeper``` code block
   ===================================================================== */
class SheetChild extends MarkdownRenderChild {
  constructor(el, file) { super(el); this.file = file; this.sub = null; }
  onload() {
    this.run = liveRender(this, this.containerEl, () => this.render());
    this.run();
  }
  async render() {
    if (this.sub) { this.removeChild(this.sub); this.sub = null; }
    this.sub = this.addChild(new obsidian.Component());
    const el = this.containerEl;
    const id = S.typeIdOf(this.file);
    if (!id) {
      el.replaceChildren(h('div', { class: 'wk' }, h('div', { class: 'cs-root' }, h('div', { class: 'cv-callout' },
        h('div', {}, h('b', {}, 'This note doesn’t use a Worldkeeper template yet.'), h('div', { class: 'cs-hint' }, 'Convert it to map its properties onto a template.')),
        h('button', { class: 'mod-cta', onclick: () => openConverter([this.file]) }, '⇪ Convert…')))));
      return;
    }
    el.replaceChildren(h('div', { class: 'wk' }, await renderSheet(this.file, id, this.sub)));
  }
}

async function renderSheet(f, id, comp) {
  const s = ST(), t = T()[id], fm = S.fm(f), src = f.path;
  const write = (fn) => S.write(f, fn);
  const root = h('div', { class: 'wk cs-root', style: s.accentColor ? { '--cs-accent': s.accentColor } : {} });

  /* ---------- hero ---------- */
  const badge = t.domain.find((d) => !d.multi && when(d, f));
  const bannerSrc = S.imageSrc(fm[s.bannerKey], src);
  const portraitSrc = S.imageSrc(fm[s.imageKey], src);
  const bStyle = fm[s.bannerKey + '_style'] || s.defaultBannerStyle;
  const bY = fm[s.bannerKey + '_position'] ?? 50;
  const setImg = (key, file) => write((x) => { x[key] = S.link(file, src); if (key === s.bannerKey && x[s.bannerKey + '_position'] == null) x[s.bannerKey + '_position'] = 50; });

  const avatar = h('div', { class: 'cs-avatar' + (portraitSrc ? '' : ' is-empty' + (id === 'character' ? '' : ' is-emblem')), title: portraitSrc ? 'Change image' : 'Add image' },
    portraitSrc ? h('img', { src: portraitSrc, alt: f.basename }) : [h('span', { class: 'cs-avatar-init' }, id === 'character' ? initials(f.basename) : t.icon), h('span', { class: 'cs-avatar-add' }, id === 'character' ? '+ portrait' : '+ image')],
    portraitSrc ? h('span', { class: 'cs-avatar-x', title: 'Remove', onclick: (e) => { e.stopPropagation(); write((x) => { x[s.imageKey] = null; }); } }, '✕') : null);
  avatar.addEventListener('click', async (e) => { const [img] = await chooseImages(e, f); if (img) setImg(s.imageKey, img); });

  const main = h('div', { class: 'cs-hero-main' });
  ap(main, h('div', { class: 'cs-name-row' }, s.showTitle ? h('div', { class: 'cs-name' }, f.basename) : null, badge && fm[badge.key] ? h('span', { class: 'cs-badge' }, String(arr(fm[badge.key])[0])) : null));
  for (const tf of t.text.filter((x) => !x.tile)) {
    const row = h('div', { class: 'cs-aka' }, h('span', { class: 'cs-aka-label' }, tf.label === 'Alias' ? 'a.k.a.' : tf.label));
    arr(fm[tf.key]).forEach((v, i) => ap(row, h('span', { class: 'cs-chip is-plain' }, String(v), h('span', { class: 'cs-x', onclick: (e) => { e.stopPropagation(); write((x) => { x[tf.key] = arr(x[tf.key]).filter((_, j) => j !== i); }); } }, '✕'))));
    ap(row, h('button', { class: 'cs-add', title: 'Add ' + tf.label, onclick: () => prompt2(`Add ${tf.label.toLowerCase()}`, tf.label + '…', (v) => write((x) => { x[tf.key] = [...arr(x[tf.key]), v]; })) }, '+'));
    ap(main, row);
  }
  for (const lf of t.links.filter((l) => l.placement === 'header')) {
    const row = h('div', { class: 'cs-crumbs' }, h('span', { class: 'cs-crumbs-label', title: lf.label }, lf.icon || '📍'), h('span', { class: 'cs-aka-label' }, lf.label));
    linkChips(row, f, lf, comp, '›');
    const single = lf.single && names(fm[lf.key]).length;
    ap(row, h('button', { class: 'cs-add', title: single ? 'Change' : 'Add ' + lf.label, onclick: () => openLinkPicker(f, lf) }, single ? '⇄' : '+'));
    ap(main, row);
  }
  const tools = h('div', { class: 'cs-banner-tools', 'data-key': f.path }, pencilToggle());
  const bannerBtn = h('button', {}, bannerSrc ? '🖼 Change banner' : '🖼 Add banner');
  bannerBtn.addEventListener('click', async (e) => {
    const gal = names(fm[s.galleryKey]);
    const [img] = await chooseImages(e, f, { extra: gal.length ? [{ title: 'Use a gallery image…', icon: 'images', run: () => suggest({ items: gal.map(display), placeholder: 'Gallery image…', onPick: (v) => { const g = S.imageFile(gal.find((x) => display(x) === v), src); if (g) setImg(s.bannerKey, g); } }) }] : [] });
    if (img) setImg(s.bannerKey, img);
  });
  ap(tools, bannerBtn);
  if (bannerSrc) {
    const range = h('input', { type: 'range', min: 0, max: 100, value: bY });
    range.addEventListener('input', () => root.querySelector('.cs-hero').style.setProperty('--cs-banner-y', range.value + '%'));
    range.addEventListener('change', () => write((x) => { x[s.bannerKey + '_position'] = +range.value; }));
    ap(tools, h('label', { class: 'cs-banner-pos', title: 'Vertical focus' }, '↕', range),
      h('button', { onclick: () => write((x) => { x[s.bannerKey + '_style'] = bStyle === 'blurred' ? 'clear' : 'blurred'; }) }, bStyle === 'blurred' ? '◐ Blurred' : '◑ Clear'),
      h('button', { title: 'Remove banner', onclick: () => write((x) => { x[s.bannerKey] = null; }) }, '✕'));
  }
  const hs = { '--cd-hue': String(hashHue(f.basename)), '--cs-banner-y': bY + '%' };
  if (bannerSrc) hs['--cs-hero-img'] = `url("${bannerSrc}")`; else if (portraitSrc) hs['--cs-hero-img'] = `url("${portraitSrc}")`;
  const hero = h('div', { class: 'cs-hero' + (bannerSrc ? ' has-banner is-' + bStyle : ''), style: hs }, h('div', { class: 'cs-hero-bg' }),
    h('span', { class: 'cs-type-pill', title: `Open the ${t.plural} dashboard`, onclick: () => P.openDashboards(id) }, `${t.icon} ${t.label}`), tools, avatar, main);
  dropImages(hero, f, ([img]) => setImg(s.bannerKey, img));
  ap(root, hero);

  /* ---------- tiles (one row) ---------- */
  const tl = tilesOf(id, f);
  if (tl.length) {
    const tiles = h('div', { class: 'cs-tiles cs-tiles-row', style: { 'grid-template-columns': `repeat(${tl.length}, minmax(118px, 1fr))` } });
    for (const d of tl) {
      const body = h('div', { class: 'cs-tile-body' });
      if (d.kind === 'domain') domainControl(body, f, d.def, fm);
      else if (d.kind === 'text') textTile(body, f, d.def, fm);
      else { linkChips(body, f, d.def, comp); ap(body, h('button', { class: 'cs-add', title: 'Add ' + d.def.label, onclick: () => openLinkPicker(f, d.def) }, '+')); }
      ap(tiles, h('div', { class: 'cs-tile' }, h('div', { class: 'cs-tile-label' }, d.def.label), body));
    }
    ap(root, h('div', { class: 'cs-tiles-scroll' }, tiles));
  }

  /* ---------- tabs ---------- */
  const pwx = ST().plotweaver.enabled ? await pwLoad() : { data: null }; const pwCards = pwx.data ? pwCardsFor(pwx, f) : [];
  const TB = tabsOf(id, f); if (pwCards.length) { const li = TB.findIndex((x) => x.mod === 'linked'); TB.splice(li < 0 ? TB.length : li, 0, { id: 'mod:Scenes', label: 'Scenes', icon: '🧵', mod: 'scenes' }); }
  let act = P.tabState.get(f.path); if (!TB.find((x) => x.id === act)) act = TB[0].id;
  const count = (x) => x.lf ? names(fm[x.lf.key]).length : x.id === 'details' ? Object.keys(fm[s.detailsKey] || {}).length : x.mod === 'relationships' ? arr(fm[s.relationshipKey]).length
    : x.mod === 'linked' ? S.backlinks(f).length : x.mod === 'contains' ? S.descendants(f).length : x.mod === 'rules' ? arr(fm.rules).length : x.mod === 'spellbook' ? arr(fm.spells).length
      : x.mod === 'conlang' ? arr(fm.lexicon).length : x.mod === 'gods' ? arr(fm.gods).length : x.mod === 'worship' ? worshipOf(f).length : x.mod === 'scenes' ? pwCards.length : typeof x.mod === 'object' ? S.refsOf(f, x.mod).length : 0;
  ap(root, h('div', { class: 'cs-tabs' }, ...TB.map((x) => { const c = count(x); return h('button', { class: 'cs-tab' + (x.id === act ? ' is-active' : ''), onclick: (e) => { P.tabState.set(f.path, x.id); wkRerender(e.currentTarget); } }, h('span', { class: 'cs-tab-icon' }, x.icon), h('span', {}, x.label), c ? h('span', { class: 'cs-tab-count' }, String(c)) : null); })));
  const panel = h('div', { class: 'cs-panel' }); const x = TB.find((y) => y.id === act);
  if (x.body) await renderTextTab(panel, f, x.body, comp);
  else if (x.id === 'details') ap(panel, renderDetails(f, fm));
  else if (x.lf) {
    const g = h('div', { class: 'cs-cards' });
    S.links(f, x.lf.key).forEach((l, i) => ap(g, miniCard(l.file, { name: l.name, src, onX: () => write((y) => { y[x.lf.key] = arr(y[x.lf.key]).filter((_, j) => j !== i); }) })));
    ap(g, h('button', { class: 'cs-card cs-card-add', onclick: () => openLinkPicker(f, x.lf) }, `+ Add ${x.lf.label.toLowerCase()}`));
    ap(panel, g);
  } else if (x.mod === 'relationships') ap(panel, renderRelationships(f, fm));
  else if (x.mod === 'contains') ap(panel, renderContains(f));
  else if (x.mod === 'linked') ap(panel, renderLinked(f));
  else if (x.mod === 'conlang') ap(panel, renderConlang(f, fm));
  else if (x.mod === 'rules') ap(panel, renderRules(f, fm));
  else if (x.mod === 'spellbook') ap(panel, renderSpellbook(f, fm));
  else if (x.mod === 'gods') ap(panel, renderGods(f, fm));
  else if (x.mod === 'worship') ap(panel, renderWorship(f));
  else if (x.mod === 'scenes') ap(panel, renderScenes(f, pwx));
  else if (typeof x.mod === 'object') ap(panel, renderRefs(f, x.mod));
  ap(root, panel, renderGallery(f, fm));
  return root;
}

/* ---------- field controls ---------- */
function linkChips(parent, f, lf, comp, sep) {
  const fm = S.fm(f); const vals = names(fm[lf.key]);
  if (lf.chain && vals[0]) { const first = S.resolve(vals[0], f.path); if (first) for (const a of S.ancestors(first)) ap(parent, chip(a.path, '', { file: a, cls: 'is-ancestor', label: a.basename }), h('span', { class: 'cs-sep-char' }, '›')); }
  vals.forEach((v, i) => {
    if (sep && i) ap(parent, h('span', { class: 'cs-sep-char' }, lf.chain ? '·' : sep));
    ap(parent, chip(v, f.path, { onX: () => S.write(f, (x) => { x[lf.key] = arr(x[lf.key]).filter((_, j) => j !== i); }) }));
  });
}
function openLinkPicker(f, lf) {
  const fm = S.fm(f); const current = names(fm[lf.key]).map((n) => S.resolve(n, f.path)?.path).filter(Boolean);
  const files = S.candidates(lf, f);
  const items = files.map((x) => ({ label: x.basename, sub: typeLabel(x) + (S.ancestors(x).length ? ' · ' + S.ancestors(x).slice(-2).map((a) => a.basename).join(' › ') : ''), value: x.path }));
  suggest({ items, selected: current, create: true, placeholder: `Add ${lf.label.toLowerCase()}…`,
    source: lf.targets.map((t) => T()[t]?.plural || t).join(', ') + (lf.where ? ' where ' + Object.entries(lf.where).map(([k, v]) => `${k} = ${v}`).join(', ') : ''),
    onPick: async (v, isNew) => {
      let target;
      if (isNew) {
        const tid = lf.targets.find((t) => T()[t]);
        if (tid) target = await createNote(tid, v, lf.where || {}, { open: false });
        else { const folder = f.parent ? f.parent.path : ''; target = await app().vault.create(normalizePath(`${folder}/${safeName(v)}.md`), `---\ntype: ${lf.targets[0]}\n---\n`); }
        if (target) toast(`Created ${target.path}`);
      } else target = app().vault.getAbstractFileByPath(v);
      if (!target) return;
      await S.write(f, (x) => { const link = S.link(target, f.path); const cur = arr(x[lf.key]); if (lf.single) x[lf.key] = [link]; else if (!cur.some((c) => S.resolve(linkName(c), f.path)?.path === target.path)) x[lf.key] = [...cur, link]; });
    } });
}
/** plain-text tile (e.g. Occupation): values are kept as text in the properties, never as links */
function textTile(parent, f, tf, fm) {
  arr(fm[tf.key]).forEach((v, i) => ap(parent, h('span', { class: 'cs-chip is-plain' }, display(linkName(v)), h('span', { class: 'cs-x', title: 'Remove', onclick: (e) => { e.stopPropagation(); S.write(f, (x) => { x[tf.key] = arr(x[tf.key]).filter((_, j) => j !== i); }); } }, '✕'))));
  ap(parent, h('button', { class: 'cs-add', title: 'Add ' + tf.label, onclick: () => prompt2(`Add ${tf.label.toLowerCase()}`, tf.label + '…', (v) => S.write(f, (x) => { x[tf.key] = [...arr(x[tf.key]), v]; })) }, '+'));
}
function domainControl(parent, f, df, fm) {
  if (!df.multi) {
    const cur = arr(fm[df.key])[0] ?? '';
    const sel = h('select', { class: 'dropdown cs-select' }, h('option', { value: '' }, '—'), ...df.values.map((v) => h('option', { value: v, selected: v === cur }, v)),
      cur && !df.values.includes(cur) ? h('option', { value: cur, selected: true }, cur + ' (not in list)') : null);
    sel.addEventListener('change', () => S.write(f, (x) => { x[df.key] = sel.value || null; }));
    ap(parent, sel); return;
  }
  const vals = arr(fm[df.key]).map(String);
  vals.forEach((v) => ap(parent, h('span', { class: 'cs-chip is-plain' }, v, h('span', { class: 'cs-x', onclick: (e) => { e.stopPropagation(); S.write(f, (x) => { x[df.key] = arr(x[df.key]).filter((y) => String(y) !== v); }); } }, '✕'))));
  let next = vals;
  ap(parent, h('span', { class: 'cs-multi', title: 'Choose ' + df.label, onclick: () => {
    suggest({ placeholder: `Choose ${df.label.toLowerCase()}…`, items: df.values, selected: vals, toggle: true, source: `${df.values.length} values`, onPick: (v) => { next = v; } });
    const obs = new MutationObserver(() => { if (!document.querySelector('.wk-modal-bg')) { obs.disconnect(); if (next.join('|') !== vals.join('|')) S.write(f, (x) => { x[df.key] = next; }); } });
    obs.observe(document.body, { childList: true });
  } }, vals.length ? null : h('span', { class: 'cs-null' }, 'null'), '☰'));
}

/* ---------- text tabs (Notes, Backstory, History…) ----------
   Each tab's text lives in the note body as a hidden callout:
     > [!wk-tab] Backstory
     > text…
   Worldkeeper hides these blocks in reading view / Live Preview and edits them in the tab,
   so long text stays out of the frontmatter while links and search keep working.
   Older notes that kept text under a "## Heading" can move it in with one click. */
const TAB_HEAD_RE = /^>\s*\[!wk-tab\][+-]?\s*(.*?)\s*$/i;
/** all wk-tab blocks in a note's text → Map(lowercase name → {name, text, start, end}) */
function parseTabs(txt) {
  const out = new Map(); const ls = txt.split('\n'); let off = 0; let i = 0;
  const offs = []; for (const l of ls) { offs.push(off); off += l.length + 1; }
  while (i < ls.length) {
    const m = ls[i].match(TAB_HEAD_RE);
    if (!m) { i++; continue; }
    const start = offs[i]; let j = i + 1; const body = [];
    while (j < ls.length && /^>/.test(ls[j])) { body.push(ls[j].replace(/^>\s?/, '')); j++; }
    const end = j < ls.length ? offs[j] : txt.length;
    out.set(m[1].trim().toLowerCase(), { name: m[1].trim(), text: body.join('\n').trim(), start, end });
    i = j;
  }
  return out;
}
const encodeTab = (name, text) => `> [!wk-tab] ${name}\n` + text.split('\n').map((l) => (l.trim() ? '> ' + l : '>')).join('\n') + '\n';
/** where a new tab block goes: after the last wk-tab block, else right after the sheet block, else at the end */
function insertTabBlock(txt, enc) {
  const blocks = [...parseTabs(txt).values()];
  if (blocks.length) { const at = Math.max(...blocks.map((b) => b.end)); return (txt.slice(0, at).replace(/\s*$/, '\n') + '\n' + enc + txt.slice(at)).replace(/\n{3,}/g, '\n\n'); }
  const m = txt.match(/```worldkeeper\s*\n```[ \t]*\n?/);
  if (m) { const at = m.index + m[0].length; return (txt.slice(0, at) + '\n' + enc + '\n' + txt.slice(at).replace(/^\n+/, '')).replace(/\n{3,}/g, '\n\n'); }
  return txt.replace(/\s*$/, '') + '\n\n' + enc;
}
async function readTab(f, heading) { const b = parseTabs(await readNote(f)).get(String(heading).trim().toLowerCase()); return b ? b.text : ''; }
async function writeTab(f, heading, text) {
  await processNote(f, (txt) => {
    const b = parseTabs(txt).get(String(heading).trim().toLowerCase()); const v = String(text || '').replace(/\s+$/, '');
    const enc = v.trim() ? encodeTab(String(heading).trim(), v) : '';
    if (b) return (txt.slice(0, b.start) + enc + txt.slice(b.end)).replace(/\n{3,}/g, '\n\n');
    return enc ? insertTabBlock(txt, enc) : txt;
  });
}
/** text under a "## heading" in the note body (older notes) */
async function headingSection(f, heading) {
  const hs = ((app().metadataCache.getFileCache(f) || {}).headings) || [];
  const i = hs.findIndex((x) => x.heading.trim().toLowerCase() === String(heading).trim().toLowerCase()); if (i < 0) return null;
  const hd = hs[i]; const next = hs.slice(i + 1).find((y) => y.level <= hd.level);
  const txt = await app().vault.cachedRead(f);
  let end = next ? next.position.start.offset : txt.length; const tab = txt.slice(hd.position.end.offset, end).search(/^>\s*\[!wk-tab\]/mi); if (tab >= 0) end = hd.position.end.offset + tab;
  return { body: txt.slice(hd.position.end.offset, end).trim() };
}
async function moveHeadingIntoTab(f, heading) {
  let moved = false;
  await processNote(f, (txt) => {
    const re = new RegExp(`^#{1,6}\\s+${String(heading).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'mi'); const m = re.exec(txt); if (!m) return txt;
    const after = txt.slice(m.index + m[0].length); const nx = after.search(/^(#{1,6}\s|>\s*\[!wk-tab\])/mi); const end = nx < 0 ? txt.length : m.index + m[0].length + nx;
    const sec = txt.slice(m.index + m[0].length, end).trim(); let out = (txt.slice(0, m.index).replace(/\s*$/, '\n') + txt.slice(end)).replace(/\n{3,}/g, '\n\n');
    const b = parseTabs(out).get(String(heading).trim().toLowerCase()); const merged = [b ? b.text : '', sec].filter((t) => t && t.trim()).join('\n\n');
    if (merged) { const enc = encodeTab(String(heading).trim(), merged); out = b ? out.slice(0, b.start) + enc + out.slice(b.end) : insertTabBlock(out, enc); }
    moved = true; return out.replace(/\n{3,}/g, '\n\n');
  });
  return moved;
}
/** delete an old "## heading" section (heading + its text) from the note body; tab blocks are never touched */
async function removeHeadingSection(f, heading) {
  let removed = false;
  await processNote(f, (txt) => {
    const re = new RegExp(`^#{1,6}\\s+${String(heading).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'mi'); const m = re.exec(txt); if (!m) return txt;
    const after = txt.slice(m.index + m[0].length); const nx = after.search(/^(#{1,6}\s|>\s*\[!wk-tab\])/mi); const end = nx < 0 ? txt.length : m.index + m[0].length + nx;
    removed = true; return (txt.slice(0, m.index).replace(/\s*$/, '\n') + '\n' + txt.slice(end)).replace(/\n{3,}/g, '\n\n');
  });
  return removed;
}
async function renderTextTab(panel, f, heading, comp) {
  const text = await readTab(f, heading); const key = String(heading).trim();
  const st = P.mem(f.path, 'edit:' + key, { editing: false });
  const legacy = await headingSection(f, heading);
  if (legacy && legacy.body) ap(panel, h('div', { class: 'cv-callout wk-legacy' }, h('div', {}, h('b', {}, `This note has text under a “## ${heading}” heading.`), h('div', { class: 'cs-hint' }, 'Move it into this tab so it lives here instead of under a heading.')),
    h('div', { class: 'wk-legacy-btns' },
      h('button', { class: 'mod-cta', onclick: async () => { await moveHeadingIntoTab(f, heading); toast(`Moved “${heading}” into its tab`); wkRerender(panel); } }, 'Move into tab'),
      h('button', { onclick: () => confirm2(`Delete the old “${heading}” section?`, h('p', {}, `Removes the “## ${heading}” heading and the text under it from the note. What you wrote in this tab is kept.`), async () => { await removeHeadingSection(f, heading); toast(`Deleted the old “${heading}” section`); wkRerender(panel); }, 'Delete old section') }, 'Delete old section'))));
  if (st.editing) {
    const ta = h('textarea', { class: 'cs-text-edit', placeholder: `Write ${heading.toLowerCase()}… Markdown and [[links]] work.` }, text);
    let t = null; let saved = text;
    const flush = async () => { clearTimeout(t); if (ta.value !== saved) { saved = ta.value; await writeTab(f, heading, ta.value); } };
    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.max(180, ta.scrollHeight + 4) + 'px'; };
    let closing = false;
    const done = async () => { if (closing) return; closing = true; st.editing = false; await flush(); wkRerender(ta); ta.blur(); };
    ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(flush, 900); grow(); });
    ta.addEventListener('blur', (e) => { if (e.relatedTarget && e.relatedTarget.classList && e.relatedTarget.classList.contains('wk-done')) return; flush(); });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(); } });
    ta.addEventListener('input', () => { const pos = ta.selectionStart; if (ta.value.slice(0, pos).endsWith('[[')) suggest({ items: S.files().filter((x) => S.managed(x) || S.isEntry(x)).sort(byName).map((x) => ({ label: x.basename, sub: typeLabel(x), value: x.basename })), placeholder: 'Link a note…', onPick: (n) => { ta.value = ta.value.slice(0, pos) + n + ']]' + ta.value.slice(pos); ta.focus(); ta.setSelectionRange(pos + n.length + 2, pos + n.length + 2); flush(); } }); });
    const doneBtn = h('button', { class: 'mod-cta wk-done' }, '✓ Done');
    // act on mousedown and keep focus in the text box, so the save can't redraw the tab before the click lands
    doneBtn.addEventListener('mousedown', (e) => { e.preventDefault(); done(); });
    doneBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); done(); } });
    ap(panel, h('div', { class: 'cs-section-actions' }, h('span', { class: 'cs-hint' }, 'Saves as you type · Esc to finish'), doneBtn), ta);
    setTimeout(() => { grow(); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 20);
    return;
  }
  const edit = () => { st.editing = true; wkRerender(panel); };
  ap(panel, h('div', { class: 'cs-section-actions' }, h('button', { onclick: edit }, '✎ Edit')));
  if (!text) { const e = empty(`Nothing here yet. Click to write ${heading.toLowerCase()}.`); e.classList.add('is-clickable'); e.addEventListener('click', edit); ap(panel, e); return; }
  const md = h('div', { class: 'cs-section-md markdown-rendered', title: 'Double-click to edit' }); ap(panel, md);
  md.addEventListener('dblclick', (e) => { if (!e.target.closest('a')) edit(); });
  await MarkdownRenderer.render(app(), text, md, f.path, comp);
}

/* ---------- details ---------- */
function renderDetails(f, fm) {
  const key = ST().detailsKey; const d = fm[key] && typeof fm[key] === 'object' && !Array.isArray(fm[key]) ? fm[key] : {};
  const g = h('div', { class: 'cs-kv' });
  for (const k of Object.keys(d)) {
    const inp = h('input', { type: 'text', value: d[k] == null ? '' : String(d[k]), placeholder: '—' });
    inp.addEventListener('change', () => S.write(f, (x) => { x[key] = { ...(x[key] || {}), [k]: inp.value }; }));
    ap(g, h('div', { class: 'cs-kv-cell' }, h('div', { class: 'cs-kv-key' }, k), inp, h('span', { class: 'cs-x', title: 'Remove', onclick: () => S.write(f, (x) => { const n = { ...(x[key] || {}) }; delete n[k]; x[key] = n; }) }, '✕')));
  }
  ap(g, h('button', { class: 'cs-kv-cell cs-kv-add', onclick: () => prompt2('Add detail', 'e.g. Height, Population, Founded…', (k) => S.write(f, (x) => { const cur = x[key] && typeof x[key] === 'object' && !Array.isArray(x[key]) ? x[key] : {}; if (!(k in cur)) cur[k] = ''; x[key] = cur; })) }, '+ Add detail'));
  return g;
}

/* ---------- relationships ---------- */
function renderRelationships(f, fm) {
  const s = ST(); const key = s.relationshipKey; const rels = arr(fm[key]); const g = h('div', { class: 'cs-cards' });
  rels.forEach((r, i) => {
    const nm = linkName(typeof r === 'object' ? r.name : r); const type = typeof r === 'object' ? r.type : '';
    const tf = S.resolve(nm, f.path); const types = s.relationshipTypes.includes(type) || !type ? s.relationshipTypes : [...s.relationshipTypes, type];
    const sel = h('select', { class: 'dropdown cs-select cs-rel-select' }, ...types.map((v) => h('option', { selected: v === type }, v)));
    sel.addEventListener('click', (e) => e.stopPropagation());
    sel.addEventListener('change', () => S.write(f, (x) => { const l = arr(x[key]); const c = l[i]; l[i] = { name: typeof c === 'object' ? c.name : c, type: sel.value }; x[key] = l; }));
    const card = miniCard(tf, { name: nm, src: f.path, round: true, onX: () => S.write(f, (x) => { x[key] = arr(x[key]).filter((_, j) => j !== i); }) });
    card.querySelector('.cs-card-sub').replaceWith(sel);
    ap(g, card);
  });
  ap(g, h('button', { class: 'cs-card cs-card-add', onclick: () => suggest({ items: S.notesOf('character').filter((c) => c.path !== f.path).map((c) => ({ label: c.basename, value: c.path })), source: 'Characters', placeholder: 'Add relationship…',
    onPick: (p) => { const c = app().vault.getAbstractFileByPath(p); S.write(f, (x) => { x[key] = [...arr(x[key]), { name: S.link(c, f.path), type: s.relationshipTypes[0] || '' }]; }); } }) }, '+ Add relationship'));
  return g;
}

/* ---------- hierarchy / references / backlinks ---------- */
function renderContains(f) {
  const wrap = h('div', {}); const id = S.typeIdOf(f); const kids = S.childrenOf(f);
  const childTypes = GEO.filter((g) => T()[g].parentKey && T()[g].links.some((l) => l.key === T()[g].parentKey && l.targets.includes(id)));
  for (const ct of childTypes) {
    const list = kids.filter((k) => S.typeIdOf(k) === ct);
    ap(wrap, groupTitle(`${T()[ct].icon} ${T()[ct].plural}`, list.length));
    const g = h('div', { class: 'cs-cards' }, ...list.map((k) => miniCard(k, { sub: `${T()[ct].label}${S.childrenOf(k).length ? ' · ' + S.childrenOf(k).length + ' inside' : ''}` })));
    ap(g, h('button', { class: 'cs-card cs-card-add', onclick: () => prompt2(`New ${T()[ct].label.toLowerCase()} in ${f.basename}`, `${T()[ct].label} name`, (v) => createNote(ct, v, { [T()[ct].parentKey]: [S.link(f)] }, { chainFrom: f })) }, `+ New ${T()[ct].label.toLowerCase()}`));
    ap(wrap, g);
  }
  const all = new Set([f.path, ...S.descendants(f).map((x) => x.path)]);
  const people = S.notesOf('character').filter((c) => S.linkFiles(c, 'location').some((l) => all.has(l.path)));
  ap(wrap, groupTitle('👤 Characters here (incl. sub-locations)', people.length));
  ap(wrap, people.length ? h('div', { class: 'cs-cards' }, ...people.map((c) => miniCard(c, { round: true, sub: S.links(c, 'location').map((l) => display(l.name)).join(', ') }))) : empty('Nobody is located here yet.'));
  const cross = [...CROSS, ...DIVINE].map((ct) => [ct, S.notesOf(ct).filter((c) => (T()[ct].links || []).filter((l) => l.chain).some((l) => S.linkFiles(c, l.key).some((r) => all.has(r.path))))]).filter(([, l]) => l.length);
  if (cross.length) { ap(wrap, groupTitle('🌐 Found here')); ap(wrap, h('div', { class: 'cs-cards' }, ...cross.flatMap(([ct, l]) => l.map((c) => miniCard(c, { sub: T()[ct].label }))))); }
  return wrap;
}
function renderRefs(f, m) {
  const list = S.refsOf(f, m); const ft = T()[m.from]; const noun = m.create && m.create.role === 'Demon' ? 'demon' : ft.label.toLowerCase();
  const g = h('div', { class: 'cs-cards' }, ...list.map((c) => { const fm = S.fm(c); return miniCard(c, { round: true, sub: [fm.binding || fm.role, S.links(c, 'location').map((l) => display(l.name))[0]].filter(Boolean).join(' · ') }); }));
  ap(g, h('button', { class: 'cs-card cs-card-add', onclick: () => prompt2(`New ${noun} (${f.basename})`, `${ft.label} name`, (v) => createNote(m.from, v, { [m.via]: [S.link(f)], ...(m.create || {}) })) }, `+ New ${noun}`));
  return h('div', {}, h('div', { class: 'cs-hint cs-mb' }, `${ft.plural} whose “${m.via}” links here. Add or remove the link on their sheet.`), g);
}
function renderLinked(f) {
  const bl = S.backlinks(f); if (!bl.length) return empty('Nothing links to this note yet.');
  const merged = new Map(); for (const b of bl) { const m = merged.get(b.from.path); if (m) { if (!m.label.includes(b.label)) m.label += ', ' + b.label; } else merged.set(b.from.path, { ...b }); }
  const wrap = h('div', {}); const by = {}; [...merged.values()].forEach((b) => (by[b.type] ??= []).push(b));
  for (const t of TYPE_ORDER.filter((x) => by[x])) { ap(wrap, groupTitle(`${T()[t].icon} ${T()[t].plural}`, by[t].length)); ap(wrap, h('div', { class: 'cs-cards' }, ...by[t].map((b) => miniCard(b.from, { sub: 'via ' + b.label, round: t === 'character' })))); }
  if (by.entry) { ap(wrap, groupTitle('📚 Encyclopedia', by.entry.length)); ap(wrap, h('div', { class: 'cs-cards' }, ...by.entry.map((b) => miniCard(b.from, { sub: S.fm(b.from).category || 'Entry', onClick: () => P.openEncyclopedia(b.from) })))); }
  return wrap;
}

/* ---------- gallery ---------- */
function renderGallery(f, fm) {
  const s = ST(); const key = s.galleryKey; const g = arr(fm[key]);
  const setG = (fn) => S.write(f, (x) => { x[key] = fn(arr(x[key]).slice()); });
  const move = (a, b) => { if (b < 0 || b >= g.length || a === b) return; setG((l) => { const [it] = l.splice(a, 1); l.splice(b, 0, it); return l; }); };
  const add = (files, at) => setG((l) => { l.splice(at ?? l.length, 0, ...files.map((x) => S.link(x, f.path))); return l; });
  const sec = h('section', { class: 'cs-gallery' });
  const addBtn = h('button', { class: 'cs-gallery-add' }, '+ Add images');
  addBtn.addEventListener('click', async (e) => { const fs = await chooseImages(e, f, { multiple: true }); if (fs.length) add(fs); });
  ap(sec, h('div', { class: 'cs-gallery-head' }, h('span', { class: 'cs-gallery-title' }, '🖼 Gallery'), g.length ? h('span', { class: 'cs-tab-count' }, String(g.length)) : null, h('span', { class: 'cd-spacer' }),
    g.length ? h('span', { class: 'cs-hint' }, 'Drag to reorder · drop files to add') : null, addBtn));
  const grid = h('div', { class: 'cs-gal-grid' }); let dragIdx = null;
  const srcs = g.map((v) => ({ name: display(linkName(v)), src: S.imageSrc(v, f.path), file: S.imageFile(v, f.path) }));
  srcs.forEach((im, i) => {
    const it = h('figure', { class: 'cs-gal-item', draggable: 'true' },
      im.src ? h('img', { src: im.src, alt: im.name, draggable: 'false', onclick: () => lightbox(srcs.filter((x) => x.src), srcs.filter((x) => x.src).indexOf(im)) }) : h('div', { class: 'cs-gal-missing' }, 'missing file'),
      h('div', { class: 'cs-gal-tools' }, h('button', { title: 'Move left', disabled: i === 0, onclick: () => move(i, i - 1) }, '◀'), h('button', { title: 'Move right', disabled: i === g.length - 1, onclick: () => move(i, i + 1) }, '▶'), h('span', { class: 'cd-spacer' }),
        im.file ? h('button', { title: 'Use as image', onclick: () => S.write(f, (x) => { x[s.imageKey] = S.link(im.file, f.path); }) }, '👤') : null,
        im.file ? h('button', { title: 'Use as banner', onclick: () => S.write(f, (x) => { x[s.bannerKey] = S.link(im.file, f.path); }) }, '🏞') : null,
        h('button', { title: 'Remove from gallery (the file stays in your vault)', class: 'is-danger', onclick: () => setG((l) => l.filter((_, j) => j !== i)) }, '✕')),
      h('figcaption', {}, h('span', { class: 'cs-gal-num' }, String(i + 1)), im.name));
    it.addEventListener('dragstart', (e) => { dragIdx = i; it.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/wk-gallery', String(i)); });
    it.addEventListener('dragend', () => { dragIdx = null; it.classList.remove('is-dragging'); });
    it.addEventListener('dragover', (e) => { e.preventDefault(); const r = it.getBoundingClientRect(); const after = e.clientX > r.left + r.width / 2; grid.querySelectorAll('.drop-before,.drop-after').forEach((x) => x.classList.remove('drop-before', 'drop-after')); it.classList.add(after ? 'drop-after' : 'drop-before'); });
    it.addEventListener('dragleave', () => it.classList.remove('drop-before', 'drop-after'));
    it.addEventListener('drop', async (e) => {
      e.preventDefault(); e.stopPropagation(); const after = it.classList.contains('drop-after'); it.classList.remove('drop-before', 'drop-after');
      if (e.dataTransfer.files.length) { const fs = await importFiles(e.dataTransfer.files, f); if (fs.length) add(fs, i + (after ? 1 : 0)); return; }
      if (dragIdx != null) { let to = i + (after ? 1 : 0); if (dragIdx < to) to--; move(dragIdx, to); }
    });
    ap(grid, it);
  });
  const drop = h('button', { class: 'cs-gal-item cs-gal-drop' }, h('span', {}, '＋'), h('small', {}, g.length ? 'Add more' : 'Drop images here or click to add'));
  drop.addEventListener('click', async (e) => { const fs = await chooseImages(e, f, { multiple: true }); if (fs.length) add(fs); });
  ap(grid, drop); ap(sec, grid);
  dropImages(sec, f, (fs) => add(fs));
  return sec;
}
function lightbox(list, start) {
  if (!list.length) return; let i = Math.max(0, start);
  const im = h('img', {}), cap = h('div', { class: 'cs-lb-cap' });
  const show = () => { im.src = list[i].src; cap.textContent = `${i + 1} / ${list.length} · ${list[i].name}`; };
  const go = (d) => { i = (i + d + list.length) % list.length; show(); };
  const stage = h('div', { class: 'cs-lb' }, h('button', { class: 'cs-lb-nav prev', onclick: () => go(-1) }, '‹'), h('div', { class: 'cs-lb-stage' }, im, cap), h('button', { class: 'cs-lb-nav next', onclick: () => go(1) }, '›'));
  const close = modalShell(stage);
  ap(stage, h('button', { class: 'cs-lb-close', onclick: () => close() }, '✕'));
  const key = (e) => { if (!document.body.contains(stage)) return document.removeEventListener('keydown', key); if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); };
  document.addEventListener('keydown', key); show();
}
