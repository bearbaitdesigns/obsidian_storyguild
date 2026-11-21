/* =====================================================================
   Storyguild plugin — loads Draftsmith, Worldkeeper and Plot Weaver
   ===================================================================== */
class StoryguildPlugin extends Plugin {
  async onload() {
    SG = this; HOST.plugin = this; HOST.sharedWords = sharedWords; HOST.coverPath = coverPath; HOST.sectionPills = sectionPills; HOST.booksButton = booksButton; HOST.isPhone = isPhone; HOST.phoneBoard = phoneBoard; HOST.canvasFiles = canvasFiles; HOST.encTools = encTools; HOST.encPreview = encPreview; HOST.encEnhance = encEnhance; HOST.draftPlot = draftPlot;
    this.wordCache = new Map(); this.sections = {}; this._timers = {};
    const raw = (await this.loadData()) || {};
    this.data = Object.assign(clone(DEFAULT_DATA), raw);
    this.data.modules = Object.assign({ world: true, plot: true }, raw.modules);
    this.data.migration = raw.migration || { state: 'new' };
    const ms = this.data.manuscript = Object.assign(clone(DEFAULT_DATA.manuscript), raw.manuscript || {});
    ms.settings = Object.assign(clone(DEFAULT_DS_SETTINGS), ms.settings || {}); ms.settings.keys = Object.assign(clone(DEFAULT_DS_SETTINGS.keys), (raw.manuscript && raw.manuscript.settings && raw.manuscript.settings.keys) || {});
    ms.ui = Object.assign({ tab: 'manuscript', round: '' }, ms.ui || {});
    ms.projects = (ms.projects || []).map(normalizeProject); ms.series = Array.isArray(ms.series) ? ms.series : [];
    adoptLegacySeries();
    applyPhoneClass(); if (isPhone()) tapToHideTips();

    /** A small public API (also used by the tests). */
    this.api = { importChapters: (files, opts) => importChapters(ensureProject(), files, opts), activeBook: () => activeProject(), books: () => DS().projects, series: () => allSeries(), createBook, createSeries, addToSeries, removeFromSeries, setActiveProject, openLibrary, newBookModal, newSeriesModal };
    this.registerView(VIEW_DS, (leaf) => new DraftsmithView(leaf));
    this.addRibbonIcon('feather', 'Open Draftsmith', () => this.openDraftsmith());
    const cmd = (id, name, fn) => this.addCommand({ id, name, callback: fn });
    cmd('open-draftsmith', 'Open Draftsmith', () => this.openDraftsmith());
    cmd('new-chapter', 'Draftsmith: new chapter', () => newChapterModal(ensureProject()));
    cmd('start-draft', 'Draftsmith: start a new manuscript draft', () => { const p = ensureProject(); new ConfirmModal(`Start draft #${p.draft + 1}?`, 'A copy of every chapter note is saved as a snapshot first.', 'Start draft', () => startManuscriptDraft(p, '', false)).open(); });
    cmd('publish', 'Draftsmith: publish with the current settings', () => compileProject(ensureProject()));
    cmd('recount-words', 'Draftsmith: recount words in all chapters', async () => notice(`Recounted ${await recountAll()} chapter notes.`));
    cmd('import-chapters', 'Draftsmith: import existing chapter notes…', () => new ImportChaptersModal(ensureProject()).open());
    this.addCommand({ id: 'add-note-as-chapter', name: 'Draftsmith: add this note as a chapter', checkCallback: (check) => { const f = this.app.workspace.getActiveFile(); if (!f || f.extension !== 'md' || isChapterFile(f)) return false; if (!check) new ConfirmModal(`Add “${f.basename}” as a chapter?`, `It moves into ${chaptersFolder(ensureProject())} of “${ensureProject().title}” (links stay intact) and becomes the last chapter.`, 'Add chapter', async () => { await importChapters(ensureProject(), [f], { mode: 'move', matchPlot: true, append: true }); notice(`“${f.basename}” is now a chapter.`); }).open(); return true; } });
    cmd('chapters-from-plot', 'Draftsmith: create chapter notes from Plot Weaver', async () => { const n = await chaptersFromPlot(ensureProject()); notice(`Created ${n} chapter notes.`); });
    cmd('open-readers', 'Draftsmith: open readers', () => { DS().ui.tab = 'readers'; this.openDraftsmith(); });
    cmd('open-checklist', 'Draftsmith: open publishing checklist', () => { DS().ui.tab = 'checklist'; this.openDraftsmith(); });
    cmd('new-book', 'New book…', () => newBookModal());
    cmd('new-series', 'New series…', () => newSeriesModal());
    cmd('add-book-to-series', 'Add a book to a series…', () => addBookToSeriesModal(null));
    cmd('books-and-series', 'Books & series…', () => openLibrary());
    cmd('switch-book', 'Switch book…', () => new BookSwitcher().open());
    this.addRibbonIcon('library-big', 'Books & series', () => openLibrary());
    cmd('convert-divine', 'Worldkeeper: give Deity and Demon characters their own God and Demon sheets', () => {
      if (!HOST.world) { notice('Turn on the Worldkeeper section first.'); return; }
      const S = WorldkeeperModule.storyguild.S; const list = S.notesOf('character').filter((c) => ['Deity', 'Demon'].includes(String((this.app.metadataCache.getFileCache(c) || {}).frontmatter?.role || '')));
      if (!list.length) { notice('No characters with role Deity or Demon were found.'); return; }
      const gods = list.filter((c) => this.app.metadataCache.getFileCache(c).frontmatter.role === 'Deity').length;
      new ConfirmModal(`Move ${list.length} character${list.length === 1 ? '' : 's'} to God and Demon sheets?`, `${gods} with role Deity become God sheets and ${list.length - gods} with role Demon become Demon sheets. Only their “type” property changes: notes stay where they are, and links, relationships and text are kept.`, 'Convert', async () => {
        for (const c of list) await this.app.fileManager.processFrontMatter(c, (fm) => { fm.type = fm.role === 'Deity' ? 'god' : 'fiend'; });
        HOST.world.refreshSoon(200); notice(`Converted ${list.length} note${list.length === 1 ? '' : 's'}.`);
      }).open();
    });
    cmd('import-old', 'Import from Worldkeeper / Plot Weaver…', async () => { const f = await detectOld(); if (!f.world && !f.plot) notice('Worldkeeper and Plot Weaver were not found in this vault.'); else new MigrationModal(f, true).open(); });
    this.addSettingTab(new StoryguildSettingTab(this));

    this.registerEvent(this.app.vault.on('modify', (f) => { if (!isChapterFile(f)) return; clearTimeout(this._timers[f.path]); this._timers[f.path] = setTimeout(() => recount(f), 1500); }));
    this.registerEvent(this.app.metadataCache.on('changed', (f) => { if (isChapterFile(f)) this.refreshDraftsmithSoon(); }));
    this.registerEvent(this.app.vault.on('create', (f) => { if (isChapterFile(f)) this.refreshDraftsmithSoon(); }));
    this.registerEvent(this.app.vault.on('delete', (f) => { if (f instanceof TFile && this.wordCache.delete(f.path)) this.refreshDraftsmithSoon(); }));
    this.registerEvent(this.app.vault.on('rename', (f, old) => this.onRename(f, old)));

    this.app.workspace.onLayoutReady(() => this.startup().catch((e) => { console.error('Storyguild startup', e); notice('Storyguild: ' + e.message); }));
  }

  async startup() {
    const found = await detectOld();
    const anyOld = Object.values(found).some(Boolean);
    if (this.data.migration.state === 'new' && !anyOld) { this.data.migration = { state: 'done', mode: 'none', at: new Date().toISOString() }; this.saveSoon(); }
    await this.loadSections();
    if (this.data.migration.state === 'new' && anyOld) new MigrationModal(found, false).open();
    else this.pausedNotice();
  }
  oldEnabled(key) { const id = OLD_IDS[key]; return !!(this.app.plugins && this.app.plugins.enabledPlugins && this.app.plugins.enabledPlugins.has(id)); }
  pausedNotice() {
    const paused = ['plot', 'world'].filter((k) => this.data.modules[k] && this.oldEnabled(k)).map((k) => (k === 'world' ? 'Worldkeeper' : 'Plot Weaver'));
    if (paused.length) notice(`Storyguild: the ${paused.join(' and ')} section${paused.length > 1 ? 's are' : ' is'} paused while the separate plugin${paused.length > 1 ? 's are' : ' is'} turned on. Run “Import from Worldkeeper / Plot Weaver…” when you’re ready to switch.`, 12000);
  }

  /** Load Plot Weaver, then Worldkeeper (which reads Plot Weaver), each as a child of this plugin. */
  async loadSections() {
    if (this.data.migration.state !== 'new') ensureProject();
    if (this.data.modules.plot && !HOST.plot && !this.oldEnabled('plot')) {
      const sub = await this.loadSection('plot', PlotWeaverModule, 'Plot Weaver');
      if (sub) {
        HOST.plot = sub; sub._sgCommit = sub.commit.bind(sub);
        sub.commit = () => { sub._sgCommit(); try { onPlotCommit(); } catch (e) { console.error(e); } };
        const addNovel = sub.addNovel.bind(sub); sub.addNovel = (n) => { addNovel(n); try { adoptPlotNovel(n); } catch (e) { console.error(e); } };
        const delNovel = sub.deleteNovel.bind(sub); sub.deleteNovel = (id) => { delNovel(id); for (const p of DS().projects) if (p.pwNovelId === id) p.pwNovelId = ''; SG.saveSoon(); SG.refreshDraftsmith(); };
        this._pwActive = sub.data.activeNovelId;
        for (const p of DS().projects) if (!p.pwNovelId && plotNovels().length && this.data.migration.mode !== 'fresh') { const n = plotNovels().find((x) => x.title === p.title); if (n) p.pwNovelId = n.id; }
      }
    }
    if (this.data.modules.world && !HOST.world && !this.oldEnabled('world')) {
      const sub = await this.loadSection('world', WorldkeeperModule, 'Worldkeeper');
      if (sub) { HOST.world = sub; bindWorldNovel(sub); syncRoundsToWorld(); }
    }
    syncSeries();
    if (HOST.world && !this.data.checklistMilestones) { this.data.checklistMilestones = 1; this.saveSoon(); moveChecklistTodosToMilestones().then((n) => { if (n) notice(`Storyguild: ${n} checklist step${n === 1 ? '' : 's'} moved from the Worldkeeper to-do list to Milestones & deadlines.`, 8000); }).catch((e) => console.error(e)); }
    // Counting rules can change between versions: bring every chapter's words property up to date once per version.
    if (this.data.countedWith !== this.manifest.version) { this.data.countedWith = this.manifest.version; this.saveSoon(); setTimeout(() => recountAll().catch((e) => console.error('Storyguild recount', e)), 3000); }
    const cur = activeProject(); const n = cur && linkedNovel(cur);
    if (n && HOST.plot && HOST.plot.data.activeNovelId !== n.id) { HOST.plot.data.activeNovelId = n.id; this._pwActive = n.id; HOST.plot._sgCommit(); }
    this.refreshAll();
  }
  async loadSection(key, Cls, name) {
    const manifest = Object.assign({}, this.manifest, { id: OLD_IDS[key], name, version: key === 'plot' ? HOST.plotVersion : HOST.worldVersion });
    const sub = new Cls(this.app, manifest);
    sub.loadData = async () => this.data[key];
    sub.saveData = async (d) => { this.data[key] = d; if (key === 'world') { const p = activeProject(); if (p && reflectChecklistMilestones(p)) this.refreshDraftsmithSoon(); } await this.saveNow(); };
    let ready = Promise.resolve();
    const orig = sub.onload;
    sub.onload = function () { ready = Promise.resolve().then(() => orig.call(sub)); return ready; };
    this.addChild(sub);
    try { await ready; } catch (e) { console.error(`Storyguild: ${name} failed to load`, e); notice(`Storyguild: the ${name} section failed to load (${e.message}). Your data is safe.`); this.removeChild(sub); return null; }
    this.sections[key] = sub; return sub;
  }
  unloadSection(key) { const sub = this.sections[key]; if (!sub) return; this.removeChild(sub); delete this.sections[key]; HOST[key] = null; this.refreshAll(); }

  onunload() { document.body.classList.remove('sg-phone'); untapToHideTips(); for (const t of Object.values(this._timers)) clearTimeout(t); if (this._saveT) { clearTimeout(this._saveT); this.saveData(this.data); } HOST.world = HOST.plot = null; }

  saveSoon(ms = 400) { clearTimeout(this._saveT); this._saveT = setTimeout(() => { this._saveT = null; this.saveNow(); }, ms); }
  saveNow() { clearTimeout(this._saveT); this._saveT = null; this._saving = (this._saving || Promise.resolve()).then(() => this.saveData(this.data)).catch((e) => console.error('Storyguild save', e)); return this._saving; }

  refreshDraftsmith() { for (const l of this.app.workspace.getLeavesOfType(VIEW_DS)) if (l.view instanceof DraftsmithView) { l.view.render(); if (l.updateHeader) l.updateHeader(); } }
  refreshDraftsmithSoon() { clearTimeout(this._timers.__ds); this._timers.__ds = setTimeout(() => this.refreshDraftsmith(), 300); }
  refreshAll() { this.refreshDraftsmithSoon(); if (HOST.world) HOST.world.refreshSoon(150); if (HOST.plot) HOST.plot.refreshViewsSoon(); }

  async openDraftsmith() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_DS)[0];
    if (!leaf) { leaf = this.app.workspace.getLeaf('tab'); await leaf.setViewState({ type: VIEW_DS, active: true }); }
    this.app.workspace.revealLeaf(leaf); if (leaf.view instanceof DraftsmithView) leaf.view.render();
  }

  onRename(f, old) {
    let hit = false;
    for (const p of DS().projects) {
      if (p.cover === old) { p.cover = f.path; hit = true; }
      for (const c of p.comments) if (c.ch === old) { c.ch = f.path; hit = true; }
      for (const r of p.rounds) for (const s of r.sends) s.files = s.files.map((x) => (x === old ? ((hit = true), f.path) : x));
      if (p.compile.picked) p.compile.picked = p.compile.picked.map((x) => (x === old ? ((hit = true), f.path) : x));
    }
    if (DSS().chapterTemplate === old) { DSS().chapterTemplate = f.path; hit = true; }
    if (this.wordCache.has(old)) { this.wordCache.set(f.path, this.wordCache.get(old)); this.wordCache.delete(old); }
    if (hit) this.saveSoon();
    if (hit || isChapterFile(f)) this.refreshDraftsmithSoon();
  }
}
