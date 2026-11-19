/* =====================================================================
   Storyguild settings tab (Worldkeeper and Plot Weaver keep their own tabs)
   ===================================================================== */
class StoryguildSettingTab extends PluginSettingTab {
  constructor(plugin) { super(plugin.app, plugin); this.plugin = plugin; }
  display() {
    const c = this.containerEl; c.empty(); c.addClass('ds-settings');
    const d = SG.data; const s = DSS(); const save = () => SG.saveSoon();
    c.createEl('h2', { text: 'Storyguild' });
    c.createEl('p', { cls: 'setting-item-description', text: 'Draftsmith, Worldkeeper and Plot Weaver in one plugin. Worldkeeper and Plot Weaver have their own settings tabs in the list on the left.' });

    c.createEl('h3', { text: 'Sections' });
    for (const [key, name, desc] of [['world', 'Worldkeeper', 'Worldbuilding sheets, dashboards, encyclopedia, Home, milestones and to-do list.'], ['plot', 'Plot Weaver', 'Plotlines × chapters board, POVs, off-screen events, cause and effect.']]) {
      const old = this.plugin.oldEnabled(key);
      const status = old ? `Paused: the separate ${name} plugin is still turned on.` : HOST[key] ? 'Running.' : 'Off.';
      new Setting(c).setName(name).setDesc(`${desc} ${status}`).addToggle((t) => t.setValue(!!d.modules[key]).setDisabled(old).onChange(async (v) => { d.modules[key] = v; await SG.saveNow(); if (v) await SG.loadSections(); else SG.unloadSection(key); this.display(); }));
    }
    new Setting(c).setName('Import from the separate plugins').setDesc(d.migration.state === 'done' ? `Done ${d.migration.at ? new Date(d.migration.at).toLocaleString() : ''}${d.migration.backup ? ` · backup in ${d.migration.backup}` : ''}. Run it again to re-import (a new backup is made first).` : 'Copy settings and outlines from Worldkeeper and Plot Weaver into Storyguild. Notes are never changed.')
      .addButton((b) => b.setButtonText('Import…').onClick(async () => { const f = await detectOld(); if (!f.world && !f.plot) { notice('Worldkeeper and Plot Weaver were not found in this vault.'); return; } new MigrationModal(f, true).open(); }));

    c.createEl('h3', { text: 'Shared note properties' });
    c.createEl('p', { cls: 'setting-item-description', text: `All three sections read the same status and word-count properties. They come from Plot Weaver’s settings (now: status “${statusKey()}”, words “${wordsKey()}”) and its status list (${statusDefs().map((x) => x.name).join(', ')}).` });
    const key = (k, name, desc) => new Setting(c).setName(name).setDesc(desc).addText((t) => t.setValue(s.keys[k] || '').onChange((v) => { s.keys[k] = v.trim(); save(); }));
    key('chapter', 'Chapter order property', 'A number that sets the order of chapters (when not following Plot Weaver).');
    key('kind', 'Chapter type property', 'chapter, prologue, interlude or epilogue. For chapters linked to Plot Weaver, the board’s section type is used.');
    key('draft', 'Chapter draft property', 'The draft number of each chapter.');
    key('pov', 'POV property', 'Optional. Shown on the Manuscript tab.');
    key('pwChapter', 'Plot Weaver chapter property', 'Links a chapter note to a chapter on the Plot Weaver board.');
    key('project', 'Project property', 'Added to new chapter notes, linking them to the book.');
    new Setting(c).setName('Keep word counts up to date').setDesc(`Writes the word count of each chapter note into its “${wordsKey()}” property as you write, so Worldkeeper and Plot Weaver always see current numbers. Only notes in a project’s chapters folder are changed.`)
      .addToggle((t) => t.setValue(!!s.autoWords).onChange((v) => { s.autoWords = v; save(); }));
    new Setting(c).setName('Chapter order follows Plot Weaver').setDesc('When a project is linked to a Plot Weaver novel, chapters are listed in board order.').addToggle((t) => t.setValue(!!s.followPlotOrder).onChange((v) => { s.followPlotOrder = v; save(); SG.refreshDraftsmith(); }));
    new Setting(c).setName('Word count on Worldkeeper Home').setDesc('Where the Home dashboard’s word count comes from.').addDropdown((dd) => dd.addOptions({ auto: 'Draftsmith chapters (if any), else Worldkeeper', chapters: 'Draftsmith chapters', world: 'Worldkeeper (Plot Weaver scene notes or manual)' }).setValue(s.wordSource).onChange((v) => { s.wordSource = v; save(); HOST.world && HOST.world.refreshSoon(50); }));

    c.createEl('h3', { text: 'Draftsmith folders' });
    c.createEl('p', { cls: 'setting-item-description', text: 'Inside each project’s folder (set per project in Book details).' });
    const folder = (k, name) => new Setting(c).setName(name).addText((t) => t.setValue(s[k]).onChange((v) => { s[k] = v.trim() || DEFAULT_DS_SETTINGS[k]; save(); }));
    folder('snapshotFolder', 'Draft snapshots'); folder('readersFolder', 'Readers’ files & exported rounds'); folder('assetsFolder', 'Images (cover)'); folder('compiledFolder', 'Published books');
    new Setting(c).setName('Chapter template').setDesc('Optional note used for new chapters. {{title}}, {{date}} and {{novel}} are filled in; Draftsmith adds its properties without overwriting yours.')
      .addText((t) => t.setPlaceholder('Templates/Chapter.md').setValue(s.chapterTemplate).onChange((v) => { s.chapterTemplate = v.trim(); save(); }));
  }
}
