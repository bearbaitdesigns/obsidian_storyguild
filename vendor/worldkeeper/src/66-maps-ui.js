/* =====================================================================
   Small UI pieces: modal, picker, prompt, confirm, file chooser
   ===================================================================== */
let CLOSE_MODAL = null;
function mModal(inner, { wide = false, onClose } = {}) {
  if (CLOSE_MODAL) CLOSE_MODAL();
  const bg = h('div', { class: 'wkm wkm-modal-bg' + (wide ? ' is-wide' : '') });
  const close = () => { bg.remove(); document.removeEventListener('keydown', escK, true); if (CLOSE_MODAL === close) CLOSE_MODAL = null; onClose && onClose(); };
  const escK = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  document.addEventListener('keydown', escK, true);
  ap(bg, inner); ap(document.body, bg); CLOSE_MODAL = close;
  return close;
}
/** items: [{label, sub, icon, value}] */
function mSuggest({ title, items, onPick, placeholder = 'Find…', create = null, emptyText = 'Nothing found' }) {
  const list = h('div', { class: 'wkm-sg-list' }); const inp = h('input', { type: 'text', placeholder, class: 'wkm-sg-input' });
  const box = h('div', { class: 'wkm-suggest' }, title ? h('div', { class: 'wkm-sg-title' }, title) : null, inp, list);
  const close = mModal(box); let shown = []; let active = 0;
  const choose = (o) => { close(); onPick(o.value, o); };
  const draw = () => {
    const q = inp.value.trim().toLowerCase();
    shown = items.filter((o) => !q || (o.label + ' ' + (o.sub || '')).toLowerCase().includes(q)).slice(0, 80);
    if (create && q && !items.some((o) => o.label.toLowerCase() === q)) shown.push({ label: `Create “${inp.value.trim()}”`, icon: '＋', value: inp.value.trim(), create: true });
    active = clamp(active, 0, Math.max(0, shown.length - 1));
    list.replaceChildren(...(shown.length ? shown.map((o, i) => h('div', { class: 'wkm-sg-opt' + (i === active ? ' is-active' : ''), onclick: () => choose(o) }, o.icon ? h('span', { class: 'wkm-sg-ic' }, o.icon) : null, h('span', { class: 'wkm-sg-l' }, o.label), o.sub ? h('span', { class: 'wkm-sg-sub' }, o.sub) : null)) : [h('div', { class: 'wkm-sg-empty' }, emptyText)]));
  };
  inp.addEventListener('input', () => { active = 0; draw(); });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active++; draw(); } else if (e.key === 'ArrowUp') { e.preventDefault(); active--; draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) choose(shown[active]); }
  });
  draw(); setTimeout(() => inp.focus(), 0);
}
function mPrompt(title, placeholder, cb, initial = '', { multiline = false, ok = 'OK' } = {}) {
  const inp = multiline ? h('textarea', { class: 'wkm-sg-input wkm-ta', placeholder, rows: 6 }) : h('input', { type: 'text', class: 'wkm-sg-input', placeholder, value: initial });
  if (multiline) inp.value = initial;
  const done = () => { const v = inp.value.trim(); if (!v) return; close(); cb(v); };
  const box = h('div', { class: 'wkm-suggest' }, h('div', { class: 'wkm-sg-title' }, title), inp, h('div', { class: 'wkm-sg-foot' }, h('button', { class: 'mod-cta', onclick: done }, ok)));
  const close = mModal(box);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) { e.preventDefault(); done(); } });
  setTimeout(() => { inp.focus(); inp.select && inp.select(); }, 0);
}
function mConfirm(title, text, cb, cta = 'Continue') {
  const box = h('div', { class: 'wkm-suggest' }, h('div', { class: 'wkm-sg-title' }, title), text ? h('p', { class: 'wkm-hint' }, text) : null,
    h('div', { class: 'wkm-sg-foot' }, h('button', { onclick: () => close() }, 'Cancel'), h('button', { class: 'mod-cta mod-warning', onclick: () => { close(); cb(); } }, cta)));
  const close = mModal(box);
}
/** pick any note (characters, places, encyclopedia entries, maps…) */
function pickNote(title, onPick, { onlyMaps = false, exclude = [] } = {}) {
  const ex = new Set(exclude.map((f) => f.path));
  const files = (onlyMaps ? M.all() : app().vault.getMarkdownFiles()).filter((f) => !ex.has(f.path) && !f.path.startsWith(mapFolder('exportsFolder') + '/'));
  mSuggest({ title, placeholder: onlyMaps ? 'Find a map…' : 'Find a note: character, place, encyclopedia entry…', emptyText: onlyMaps ? 'No other maps yet' : 'No notes found',
    items: files.sort((a, b) => b.stat.mtime - a.stat.mtime).map((f) => ({ label: f.basename, sub: [noteKind(f), f.parent && f.parent.path !== '/' ? f.parent.path : ''].filter(Boolean).join(' · '), icon: noteIcon(f), value: f })),
    onPick: (f) => onPick(f) });
}
/** choose a map image or PDF from the vault, or upload one */
function chooseMapImage(onPick) {
  const files = app().vault.getFiles().filter((f) => MAP_EXT.includes(f.extension.toLowerCase()) && !f.path.startsWith(mapFolder('exportsFolder') + '/'));
  const up = h('input', { type: 'file', accept: MAP_EXT.map((x) => '.' + x).join(','), style: { display: 'none' } });
  up.addEventListener('change', async () => { const file = up.files[0]; if (!file) return; close(); const f = await saveUpload(file); if (f) onPick(f); });
  const grid = h('div', { class: 'wkm-img-grid' }, ...files.sort((a, b) => b.stat.mtime - a.stat.mtime).map((f) => {
    const isPdf = f.extension.toLowerCase() === 'pdf';
    const card = h('button', { class: 'wkm-img-opt', title: f.path, onclick: () => { close(); onPick(f); } },
      isPdf ? h('div', { class: 'wkm-img-pdf' }, 'PDF') : h('img', { src: app().vault.getResourcePath(f), loading: 'lazy' }), h('span', {}, f.name));
    return card;
  }));
  const box = h('div', { class: 'wkm-suggest is-wide' }, h('div', { class: 'wkm-sg-title' }, 'Choose a map image or PDF'),
    h('div', { class: 'wkm-row' }, h('button', { class: 'mod-cta', onclick: () => up.click() }, '⤒ Upload from your device'), h('span', { class: 'wkm-hint' }, 'JPEG, PNG, WebP, GIF or PDF. You can also drop a file here.')),
    files.length ? grid : h('div', { class: 'wkm-empty' }, 'No images or PDFs in your vault yet. Upload one.'), up);
  const close = mModal(box, { wide: true });
  box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('is-drop'); });
  box.addEventListener('dragleave', () => box.classList.remove('is-drop'));
  box.addEventListener('drop', async (e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (!file) return; close(); const f = await saveUpload(file); if (f) onPick(f); });
}
async function saveUpload(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!MAP_EXT.includes(ext)) { toast('Use a JPEG, PNG, WebP, GIF or PDF file'); return null; }
  const folder = mapFolder('imagesFolder'); await mEnsureFolder(folder);
  const path = await mFreePath(folder, file.name.replace(/\.[^.]+$/, ''), ext);
  return app().vault.createBinary(path, await file.arrayBuffer());
}
async function mEnsureFolder(path) { if (!path || path === '/') return; if (app().vault.getAbstractFileByPath(path)) return; const parts = path.split('/'); for (let i = 1; i <= parts.length; i++) { const p = parts.slice(0, i).join('/'); if (!app().vault.getAbstractFileByPath(p)) { try { await app().vault.createFolder(p); } catch (e) { /* exists */ } } } }
async function mFreePath(folder, base, ext) { const clean = String(base).replace(/[\\/:*?"<>|#^[\]]/g, '').trim() || 'Map'; let p = normalizePath(`${folder}/${clean}.${ext}`); let i = 2; while (app().vault.getAbstractFileByPath(p)) p = normalizePath(`${folder}/${clean} ${i++}.${ext}`); return p; }
