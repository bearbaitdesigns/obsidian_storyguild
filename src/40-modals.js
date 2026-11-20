/* =====================================================================
   Small dialogs
   ===================================================================== */
class ConfirmModal extends Modal {
  constructor(title, text, okLabel, onOk, cancelLabel = 'Cancel', onCancel = null) { super(SG.app); Object.assign(this, { title, text, okLabel, onOk, cancelLabel, onCancel }); }
  onOpen() {
    const c = this.contentEl; c.addClass('ds-modal'); put(c, el('h3', {}, this.title), this.text ? el('p', {}, this.text) : null,
      el('div', { class: 'ds-modal-actions' },
        el('button', { onclick: () => { this.close(); if (this.onCancel) this.onCancel(); } }, this.cancelLabel),
        el('button', { class: 'mod-cta', onclick: () => { this.close(); this.onOk(); } }, this.okLabel)));
  }
  onClose() { this.contentEl.empty(); }
}

/** A form dialog. fields: [{ key, label, type: text|textarea|date|number|select|checkbox, options, value, placeholder, desc }] */
class FormModal extends Modal {
  constructor(title, fields, okLabel, onOk, intro) { super(SG.app); Object.assign(this, { title, fields, okLabel, onOk, intro }); }
  onOpen() {
    const c = this.contentEl; c.addClass('ds-modal'); put(c, el('h3', {}, this.title), this.intro ? el('p', { class: 'ds-hint' }, this.intro) : null);
    const inputs = {};
    for (const f of this.fields) {
      let i;
      if (f.type === 'textarea') i = el('textarea', { rows: f.rows || 4, placeholder: f.placeholder || '' }, f.value || '');
      else if (f.type === 'select') i = el('select', { class: 'dropdown' }, (f.options || []).map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return el('option', { value: v, selected: String(v) === String(f.value) }, l); }));
      else if (f.type === 'checkbox') i = el('input', { type: 'checkbox', checked: !!f.value });
      else i = el('input', { type: f.type || 'text', value: f.value ?? '', placeholder: f.placeholder || '' });
      inputs[f.key] = i;
      const wrap = el('div', { class: 'ds-field' + (f.type === 'checkbox' ? ' is-check' : '') }, f.type === 'checkbox' ? el('label', {}, i, ' ', f.label) : [el('label', {}, f.label), i], f.desc ? el('div', { class: 'ds-hint' }, f.desc) : null);
      if (f.showIf) { const upd = () => { wrap.style.display = f.showIf(inputs) ? '' : 'none'; }; setTimeout(() => { upd(); Object.values(inputs).forEach((x) => x.addEventListener('change', upd)); }); }
      put(c, wrap);
    }
    const submit = () => {
      const out = {}; for (const f of this.fields) { const i = inputs[f.key]; out[f.key] = f.type === 'checkbox' ? i.checked : f.type === 'number' ? Number(i.value) : i.value; }
      if (this.fields.some((f) => f.required && !String(out[f.key] || '').trim())) { notice('Please fill in the required fields.'); return; }
      this.close(); this.onOk(out);
    };
    put(c, el('div', { class: 'ds-modal-actions' }, el('button', { onclick: () => this.close() }, 'Cancel'), el('button', { class: 'mod-cta', onclick: submit }, this.okLabel || 'Save')));
    const first = Object.values(inputs)[0]; if (first && first.focus) setTimeout(() => first.focus(), 30);
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submit(); } });
  }
  onClose() { this.contentEl.empty(); }
}

/** Pick any vault file matching a filter. */
class FilePick extends FuzzySuggestModal {
  constructor(filter, onPick, placeholder) { super(SG.app); this.filter = filter; this.onPick = onPick; this.setPlaceholder(placeholder || 'Choose a file…'); }
  getItems() { return app().vault.getFiles().filter(this.filter); }
  getItemText(f) { return f.path; }
  onChooseItem(f) { this.onPick(f); }
}
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
const ATTACH_EXT = ['pdf', 'md', 'markdown', 'txt', 'docx', 'doc', 'rtf', 'odt', 'epub', 'csv', ...IMAGE_EXT];

/** Ask the system for files (works on desktop and mobile). Resolves to File[]. */
function chooseLocalFiles(accept, multiple = true) {
  return new Promise((resolve) => {
    const i = el('input', { type: 'file', accept, multiple, style: { display: 'none' } });
    i.addEventListener('change', () => { resolve([...i.files]); i.remove(); });
    put(document.body, i); i.click();
  });
}
async function saveLocalFile(file, folder) {
  await ensureFolder(folder);
  const path = await uniquePath(`${folder}/${file.name.replace(/[\\/:*?"<>|#^[\]]/g, '')}`);
  return writeBinary(path, new Uint8Array(await file.arrayBuffer()));
}
