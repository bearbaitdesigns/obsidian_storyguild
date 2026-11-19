/* =====================================================================
   shared UI: modals, pickers, images, chips, cards
   ===================================================================== */
function closeModal() { document.querySelectorAll('.wk-modal-bg').forEach((m) => m.remove()); }
function modalShell(inner, { wide = false, onClose } = {}) {
  closeModal();
  const bg = h('div', { class: 'wk wk-modal-bg' + (wide ? ' is-wide' : '') });
  const close = () => { bg.remove(); document.removeEventListener('keydown', esc, true); onClose && onClose(); };
  const esc = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  document.addEventListener('keydown', esc, true);
  ap(bg, inner); ap(document.body, bg);
  return close;
}

/**
 * Fuzzy-ish picker. items: strings or {label, sub, value}
 * toggle=true keeps it open and reports the full selection.
 */
function suggest({ title, items, selected = [], source, onPick, toggle = false, create = false, placeholder = 'Find…' }) {
  const norm = items.map((i) => (typeof i === 'string' ? { label: i, value: i } : i));
  const sel = new Set(selected);
  const list = h('div', { class: 'wk-sg-list' });
  const inp = h('input', { type: 'text', placeholder, class: 'wk-sg-input' });
  let active = 0;
  const box = h('div', { class: 'wk-suggest' }, title ? h('div', { class: 'wk-sg-title' }, title) : null, inp, list,
    h('div', { class: 'wk-sg-instr' }, source ? h('span', {}, h('b', {}, 'source '), source) : null, h('span', {}, h('b', {}, '↑↓ '), 'move'), h('span', {}, h('b', {}, '↵ '), toggle ? 'toggle' : 'choose'), h('span', {}, h('b', {}, 'esc '), toggle ? 'done' : 'close')));
  const close = modalShell(box);
  let shown = [];
  const choose = (o) => {
    if (o.create) { close(); onPick(o.value, true); return; }
    if (toggle) { sel.has(o.value) ? sel.delete(o.value) : sel.add(o.value); onPick([...sel]); draw(); }
    else { close(); onPick(o.value, false); }
  };
  const draw = () => {
    const q = inp.value.toLowerCase().trim();
    shown = norm.filter((o) => !q || o.label.toLowerCase().includes(q) || (o.sub || '').toLowerCase().includes(q)).slice(0, 300);
    if (create && q && !norm.some((o) => o.label.toLowerCase() === q)) shown.push({ label: `Create “${inp.value.trim()}”`, value: inp.value.trim(), create: true, sub: 'new note' });
    active = Math.min(active, Math.max(0, shown.length - 1));
    list.replaceChildren(...shown.map((o, i) => h('div', { class: 'wk-sg-opt' + (i === active ? ' is-active' : ''), onmouseenter: () => { active = i; mark(); }, onclick: () => choose(o) },
      h('span', {}, o.label, o.sub ? h('small', {}, o.sub) : null), sel.has(o.value) ? h('span', { class: 'wk-check' }, '✓') : null)));
    if (!shown.length) ap(list, h('div', { class: 'wk-sg-empty' }, 'No matches'));
  };
  const mark = () => [...list.children].forEach((c, i) => c.classList.toggle('is-active', i === active));
  inp.addEventListener('input', () => { active = 0; draw(); });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(shown.length - 1, active + 1); mark(); list.children[active]?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); mark(); list.children[active]?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) choose(shown[active]); }
  });
  draw(); setTimeout(() => inp.focus(), 10);
}
function prompt2(title, placeholder, cb, initial = '') {
  const inp = h('input', { type: 'text', class: 'wk-sg-input', placeholder, value: initial });
  const ok = h('button', { class: 'mod-cta' }, 'OK');
  const box = h('div', { class: 'wk-suggest' }, h('div', { class: 'wk-sg-title' }, title), inp, h('div', { class: 'wk-sg-foot' }, ok));
  const close = modalShell(box);
  const go = () => { const v = inp.value.trim(); if (!v) return; close(); cb(v); };
  ok.addEventListener('click', go); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  setTimeout(() => { inp.focus(); inp.select(); }, 10);
}
function confirm2(title, text, cb, cta = 'Continue') {
  const ok = h('button', { class: 'mod-cta' }, cta);
  const box = h('div', { class: 'wk-suggest wk-confirm' }, h('div', { class: 'wk-sg-title' }, title), h('div', { class: 'wk-confirm-text' }, text), h('div', { class: 'wk-sg-foot' }, h('button', { onclick: () => close() }, 'Cancel'), ok));
  const close = modalShell(box); ok.addEventListener('click', () => { close(); cb(); });
}

/* ---------- opening & hovering ---------- */
function openFile(f, e) { if (f) app().workspace.getLeaf(e && Keymap.isModEvent(e) ? 'tab' : false).openFile(f); }
function openName(name, src, e) { app().workspace.openLinkText(name, src || '', e ? Keymap.isModEvent(e) : false); }
function hover(el, linktext, src, parent) {
  el.addEventListener('mouseover', (e) => app().workspace.trigger('hover-link', { event: e, source: HOVER, hoverParent: parent || el, targetEl: el, linktext, sourcePath: src || '' }));
}
const typeLabel = (f) => { const id = S.typeIdOf(f); return id ? T()[id].label : S.isEntry(f) ? 'Encyclopedia' : String(arr(S.fm(f).type)[0] ?? 'note'); };
const typeIcon = (f) => { const id = S.typeIdOf(f); return id ? T()[id].icon : S.isEntry(f) ? '📚' : '📄'; };

/* ---------- images ---------- */
const IMG_RE = /^(png|jpe?g|gif|webp|avif|bmp|svg)$/i;
async function importFiles(fileList, src) {
  const out = [];
  for (const f of [...fileList]) {
    if (!f.type.startsWith('image/') && !IMG_RE.test(f.name.split('.').pop())) continue;
    const buf = await f.arrayBuffer();
    const path = await app().fileManager.getAvailablePathForAttachment(f.name.replace(/\s+/g, '-'), src ? src.path : '');
    out.push(await app().vault.createBinary(path, buf));
  }
  return out;
}
function uploadImages(src, multiple) {
  return new Promise((resolve) => {
    let i = document.getElementById('wk-file');
    if (!i) { i = h('input', { type: 'file', id: 'wk-file', accept: 'image/*', style: 'position:fixed;left:-9999px;opacity:0' }); ap(document.body, i); }
    i.multiple = !!multiple; i.value = '';
    i.onchange = async () => resolve(i.files && i.files.length ? await importFiles(i.files, src) : []);
    i.click();
  });
}
function vaultImages(multiple) {
  return new Promise((resolve) => {
    const files = app().vault.getFiles().filter((f) => IMG_RE.test(f.extension)).sort((a, b) => b.stat.mtime - a.stat.mtime);
    const items = files.map((f) => ({ label: f.name, sub: f.parent && f.parent.path !== '/' ? f.parent.path : '', value: f.path }));
    if (multiple) {
      let chosen = [];
      suggest({ items, toggle: true, placeholder: 'Pick images (esc when done)…', source: 'vault images', onPick: (v) => { chosen = v; } });
      const obs = new MutationObserver(() => { if (!document.querySelector('.wk-modal-bg')) { obs.disconnect(); resolve(chosen.map((p) => app().vault.getAbstractFileByPath(p)).filter(Boolean)); } });
      obs.observe(document.body, { childList: true });
    } else suggest({ items, placeholder: 'Pick an image…', source: 'vault images', onPick: (p) => resolve([app().vault.getAbstractFileByPath(p)].filter(Boolean)) });
  });
}
/** menu: upload or pick from vault → Promise<TFile[]> */
function chooseImages(evt, src, { multiple = false, extra = [] } = {}) {
  return new Promise((resolve) => {
    const m = new Menu();
    m.addItem((i) => i.setTitle('Upload from computer…').setIcon('upload').onClick(async () => resolve(await uploadImages(src, multiple))));
    m.addItem((i) => i.setTitle('Choose from vault…').setIcon('image').onClick(async () => resolve(await vaultImages(multiple))));
    for (const x of extra) m.addItem((i) => i.setTitle(x.title).setIcon(x.icon || 'dot').onClick(() => { x.run(); resolve([]); }));
    m.showAtMouseEvent(evt);
  });
}
function dropImages(el, src, cb) {
  el.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); el.classList.add('is-drop'); } });
  el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('is-drop'); });
  el.addEventListener('drop', async (e) => { el.classList.remove('is-drop'); if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); e.stopPropagation(); const fs = await importFiles(e.dataTransfer.files, src); if (fs.length) cb(fs); } });
}

/* ---------- banner edit toggle ---------- */
const openTools = new Set();
/** pencil button that reveals the rest of a banner's tools; remembers state per banner */
function pencilToggle(key) {
  const b = h('button', { class: 'wk-pencil', title: 'Edit banner', 'aria-label': 'Edit banner' }, '✎');
  b.addEventListener('click', (e) => { e.stopPropagation(); const box = b.parentElement; const on = !box.classList.contains('is-open'); box.classList.toggle('is-open', on); const k = box.dataset.key; if (k) on ? openTools.add(k) : openTools.delete(k); });
  setTimeout(() => { const box = b.parentElement; if (box && box.dataset.key && openTools.has(box.dataset.key)) box.classList.add('is-open'); });
  return b;
}

/* ---------- chips & cards ---------- */
function chip(name, src, { file, onX, cls = '', label, parent } = {}) {
  const f = file || S.resolve(name, src);
  const c = h('span', { class: 'cs-chip' + (f ? '' : ' is-unresolved') + (cls ? ' ' + cls : ''), title: f ? `[[${display(name)}]] · ${typeLabel(f)}` : `[[${display(name)}]] (no note yet)` },
    h('span', {}, label || display(name)),
    onX ? h('span', { class: 'cs-x', title: 'Remove', onclick: (e) => { e.stopPropagation(); onX(); } }, '✕') : null);
  c.addEventListener('click', (e) => (f ? openFile(f, e) : openName(name, src, e)));
  hover(c, name, src, parent);
  return c;
}
function miniCard(f, { sub, onX, round, name, src, onClick } = {}) {
  const fm = f ? S.fm(f) : {};
  const im = f && (S.imageSrc(fm[ST().imageKey], f.path) || S.imageSrc(fm[ST().bannerKey], f.path));
  const nm = f ? f.basename : display(name);
  const card = h('div', { class: 'cs-card' + (f ? '' : ' is-unresolved') },
    h('div', { class: 'cs-card-thumb' + (round ? ' is-round' : ''), style: im ? { 'background-image': `url("${im}")` } : { '--cd-hue': String(hashHue(nm)) } }, im ? '' : (f && S.typeIdOf(f) && S.typeIdOf(f) !== 'character' ? typeIcon(f) : initials(nm))),
    h('div', { class: 'cs-card-text' }, h('div', { class: 'cs-card-name' }, nm), h('div', { class: 'cs-card-sub' }, sub ?? (f ? typeLabel(f) : 'not created yet'))),
    onX ? h('span', { class: 'cs-x', title: 'Remove', onclick: (e) => { e.stopPropagation(); onX(); } }, '✕') : null);
  card.addEventListener('click', (e) => (onClick ? onClick(e) : f ? openFile(f, e) : openName(name, src, e)));
  if (f) hover(card, f.path, '', card);
  return card;
}
const empty = (text) => h('div', { class: 'cs-empty' }, text);
const groupTitle = (text, count) => h('div', { class: 'cs-group-title' }, text, count != null ? h('span', { class: 'cs-tab-count' }, String(count)) : null);

/* ---------- live refresh plumbing ---------- */
/** ask the nearest live-rendered container to redraw now (used by clicks inside sheets) */
function wkRerender(node) { if (node && node.isConnected) node.dispatchEvent(new CustomEvent('wk-rerender', { bubbles: true })); else P.refreshSoon(0); }
/** re-render `el` via `fn` whenever the vault index changes, without stealing focus while typing */
function liveRender(component, el, fn) {
  let pending = false;
  const typing = () => { if (el.querySelector('.cs-text-edit')) return true; const a = document.activeElement; if (!a || !el.contains(a)) return false; if (a.tagName === 'TEXTAREA') return true; return a.tagName === 'INPUT' && ['text', 'search', 'number', 'date', 'email', 'url', ''].includes((a.getAttribute('type') || '').toLowerCase()); };
  const run = async (force = true) => {
    if (force !== true && typing()) { pending = true; return; }
    pending = false; const y = el.closest('.view-content, .markdown-preview-view, .cm-scroller')?.scrollTop;
    try { await fn(); } catch (e) { console.error('[Worldkeeper]', e); el.replaceChildren(h('div', { class: 'wk cs-empty' }, 'Worldkeeper hit an error rendering this. See the developer console.')); }
    const sc = el.closest('.view-content, .markdown-preview-view, .cm-scroller'); if (sc && y != null) sc.scrollTop = y;
  };
  el.addEventListener('focusout', () => { if (pending) setTimeout(() => run(false), 50); });
  el.addEventListener('wk-rerender', (e) => { e.stopPropagation(); setTimeout(() => run(true), 0); });
  component.registerEvent(app().workspace.on(REFRESH, () => run(false)));
  return run;
}
