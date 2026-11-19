/* =====================================================================
   plugin
   ===================================================================== */
function parseOptions(src) { const o = {}; for (const line of String(src).split('\n')) { const m = line.match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ''); } return o; }

class WorldkeeperPlugin extends Plugin {
  async onload() {
    P = this;
    this.settings = mergeSettings(await this.loadData()); this.applyLinkStyle();
    this.tabState = new Map(); this._mem = new Map(); this._t = null;

    this.registerHoverLinkSource(HOVER, { display: 'Worldkeeper', defaultMod: true });
    this.registerView(VIEW_HOME, (leaf) => new HomeView(leaf));
    this.registerView(VIEW_DASH, (leaf) => new DashboardsView(leaf));
    this.registerView(VIEW_ENC, (leaf) => new EncyclopediaView(leaf));

    this.registerMarkdownCodeBlockProcessor('worldkeeper', (src, el, ctx) => {
      const f = app().vault.getAbstractFileByPath(ctx.sourcePath); if (!(f instanceof TFile)) return;
      ctx.addChild(new SheetChild(el, f));
    });
    this.registerMarkdownCodeBlockProcessor('worldkeeper-entry', (src, el, ctx) => {
      const f = app().vault.getAbstractFileByPath(ctx.sourcePath); if (!(f instanceof TFile)) return;
      ctx.addChild(new EntryChild(el, f));
    });
    this.registerMarkdownCodeBlockProcessor('worldkeeper-dashboard', (src, el, ctx) => {
      const o = parseOptions(src); const id = Object.keys(T()).find((k) => k === o.type || T()[k].label.toLowerCase() === String(o.type || '').toLowerCase()) || 'character';
      const child = new MarkdownRenderChild(el); ctx.addChild(child);
      const st = newDashState(o); for (const d of T()[id].domain) if (o[d.key]) st.filters[d.key] = o[d.key];
      if (o.in) { const r = S.resolve(linkName(o.in), ctx.sourcePath); if (r) st.region = r.path; }
      st._root = el; const run = liveRender(child, el, () => el.replaceChildren(h('div', { class: 'wk' }, renderTypeDash(id, st, { compact: true })))); st._rerender = run; run();
    });
    this.registerMarkdownCodeBlockProcessor('worldkeeper-home', (src, el, ctx) => {
      const child = new MarkdownRenderChild(el); ctx.addChild(child); const state = {};
      const run = liveRender(child, el, async () => el.replaceChildren(h('div', { class: 'wk' }, await renderHome(state)))); state.rerender = run; run();
    });

    this.addRibbonIcon('globe', 'Worldkeeper home', () => this.openHome());
    this.addRibbonIcon('layout-dashboard', 'Worldkeeper dashboards', () => this.openDashboards());
    this.addRibbonIcon('library', 'Worldkeeper encyclopedia', () => this.openEncyclopedia());

    this.addCommand({ id: 'open-home', name: 'Open home', callback: () => this.openHome() });
    this.addCommand({ id: 'open-dashboards', name: 'Open dashboards', callback: () => this.openDashboards() });
    this.addCommand({ id: 'open-encyclopedia', name: 'Open encyclopedia', callback: () => this.openEncyclopedia() });
    this.addCommand({ id: 'new-note', name: 'Create new…', callback: () => suggest({ items: Object.keys(T()).map((id) => ({ label: `${T()[id].icon} ${T()[id].label}`, value: id })), placeholder: 'What do you want to create?', onPick: (id) => prompt2(`New ${T()[id].label.toLowerCase()}`, `${T()[id].label} name`, (v) => createNote(id, v)) }) });
    for (const id of TYPE_ORDER) this.addCommand({ id: `new-${id}`, name: `Create new ${DEFAULT_TYPES[id].label.toLowerCase()}`, callback: () => prompt2(`New ${T()[id].label.toLowerCase()}`, `${T()[id].label} name`, (v) => createNote(id, v)) });
    this.addCommand({ id: 'new-entry', name: 'Create new encyclopedia entry', callback: () => prompt2('New encyclopedia entry', 'Entry title', async (v) => { const f = await createEntry(v); if (f) this.openEncyclopedia(f); }) });
    this.addCommand({ id: 'convert-notes', name: 'Convert notes to a template…', callback: () => openConverter([]) });
    this.addCommand({ id: 'convert-current', name: 'Convert current note to a template…', checkCallback: (check) => { const f = app().workspace.getActiveFile(); if (!f || f.extension !== 'md' || S.managed(f)) return false; if (!check) openConverter([f]); return true; } });
    this.addCommand({ id: 'insert-sheet', name: 'Insert sheet block', editorCallback: (ed) => ed.replaceSelection('```worldkeeper\n```\n') });
    this.addCommand({ id: 'reorganize', name: 'Reorganize vault to match folder settings', callback: () => reorganize() });
    this.addCommand({ id: 'move-headings-into-tabs', name: 'Move note headings (Notes, Backstory…) into their tabs', callback: () => migrateHeadings() });
    this.addCommand({ id: 'write-templates', name: 'Write template files', callback: () => writeTemplates() });
    this.addCommand({ id: 'add-todo', name: 'Add to-do', callback: () => prompt2('New to-do', 'Task… use [[Name]] to link a note', async (v) => { const l = await readTodos(); l.unshift({ done: false, text: v, due: '', tag: '' }); await writeTodos(l); toast('Added to your to-do list'); this.refreshSoon(100); }) });

    this.registerEvent(app().workspace.on('file-menu', (menu, file) => {
      if (!(file instanceof TFile) || file.extension !== 'md' || S.managed(file) || S.isEntry(file)) return;
      menu.addItem((i) => i.setTitle('Convert with Worldkeeper…').setIcon('globe').onClick(() => openConverter([file])));
    }));

    const dirty = () => { S.dirty(); this.refreshSoon(); };
    this.registerEvent(app().metadataCache.on('changed', dirty));
    this.registerEvent(app().metadataCache.on('resolved', () => { if (!S._idx) this.refreshSoon(); }));
    this.registerEvent(app().vault.on('delete', dirty));
    this.registerEvent(app().vault.on('rename', dirty));
    this.registerEvent(app().vault.on('create', dirty));

    this.addSettingTab(new WorldkeeperSettingTab(this));
  }
  updateHomeTitle() { for (const l of app().workspace.getLeavesOfType(VIEW_HOME)) { if (typeof l.updateHeader === 'function') l.updateHeader(); else if (l.tabHeaderInnerTitleEl) l.tabHeaderInnerTitleEl.setText(l.view.getDisplayText()); } }
  applyLinkStyle() { document.body.classList.toggle('wk-white-links', !!(this.settings && this.settings.whiteLinks)); }
  onunload() { document.body.classList.remove('wk-white-links'); clearTimeout(this._t); closeModal(); document.getElementById('wk-file')?.remove(); }

  mem(path, key, init) { const k = path + '::' + key; if (!this._mem.has(k)) this._mem.set(k, init); return this._mem.get(k); }
  refreshSoon(ms = 250) { clearTimeout(this._t); this._t = setTimeout(() => { if (P === this) app().workspace.trigger(REFRESH); }, ms); }
  async saveSettings() { await this.saveData(this.settings); S.dirty(); this.refreshSoon(50); }
  async saveSettingsQuiet() { await this.saveData(this.settings); }

  async openView(type) {
    const ex = app().workspace.getLeavesOfType(type)[0];
    if (ex) { app().workspace.revealLeaf(ex); return ex.view; }
    const leaf = app().workspace.getLeaf('tab'); await leaf.setViewState({ type, active: true }); app().workspace.revealLeaf(leaf); return leaf.view;
  }
  async openHome() { return this.openView(VIEW_HOME); }
  async openDashboards(id) { const v = await this.openView(VIEW_DASH); if (id && v && v.setType) v.setType(id); return v; }
  async openEncyclopedia(f) { const v = await this.openView(VIEW_ENC); if (v && v.show) v.show(f || null); return v; }
}

module.exports = WorldkeeperPlugin;
