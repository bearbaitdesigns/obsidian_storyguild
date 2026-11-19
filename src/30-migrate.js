/* =====================================================================
   First-run detection and migration from the separate plugins
   ---------------------------------------------------------------------
   Safe by design:
   • Notes are never touched. Only the old plugins' settings files are read.
   • Data is COPIED. The old plugin folders stay exactly as they are, so you
     can go back to the separate plugins at any time.
   • Before anything changes, every settings file involved is backed up to
     .obsidian/plugins/storyguild/backups/<date-time>/.
   • The old plugins are turned off (not uninstalled), because two plugins
     can't register the same views and code blocks at once.
   ===================================================================== */
async function readJson(path) { try { return JSON.parse(await app().vault.adapter.read(path)); } catch (e) { return null; } }

async function detectOld() {
  const a = app(); const out = {};
  for (const [key, id] of Object.entries(OLD_IDS)) {
    const dir = `${a.vault.configDir}/plugins/${id}`; const dataPath = `${dir}/data.json`;
    const manifest = a.plugins?.manifests?.[id] || null;
    const enabled = !!(a.plugins?.enabledPlugins && a.plugins.enabledPlugins.has(id));
    const data = await readJson(dataPath);
    const folder = await a.vault.adapter.exists(dir);
    if (!manifest && !data && !folder) { out[key] = null; continue; }
    let summary = [];
    if (key === 'world' && data) {
      const nv = data.novel || {};
      summary = [`Novel: “${nv.title || 'My Novel'}”`, `${(nv.milestones || []).length} milestones`, `To-do file: ${data.todoFile || 'Worldkeeper/To-do.md'}`, `${Object.keys(data.types || {}).length} customized sheet types`];
    }
    if (key === 'plot' && data) {
      const nv = data.novels || [];
      summary = [`${nv.length} novel${nv.length === 1 ? '' : 's'}: ${nv.map((n) => `“${n.title}”`).join(', ')}`, `${nv.reduce((x, n) => x + (n.beats || []).length, 0)} cards`, `${nv.reduce((x, n) => x + (n.chapters || []).length, 0)} chapters & sections`];
    }
    out[key] = { id, name: key === 'world' ? 'Worldkeeper' : 'Plot Weaver', version: manifest?.version || '', enabled, dataPath, data, summary };
  }
  return out;
}

async function backupAll(found) {
  const a = app(); const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = `${a.vault.configDir}/plugins/${SG_ID}/backups/${stamp}`;
  await a.vault.adapter.mkdir(dir);
  for (const x of Object.values(found)) if (x && x.data) await a.vault.adapter.write(`${dir}/${x.id}.data.json`, JSON.stringify(x.data, null, 2));
  await a.vault.adapter.write(`${dir}/storyguild.data.json`, JSON.stringify(SG.data, null, 2));
  return dir;
}

/** Build a Draftsmith project from Worldkeeper's novel settings and link the Plot Weaver novel. */
function projectFromOld(worldData, plotData) {
  const nv = (worldData && worldData.novel) || {};
  const novels = (plotData && plotData.novels) || [];
  const wantPW = worldData && worldData.plotweaver && worldData.plotweaver.novel;
  const pwN = (wantPW && novels.find((n) => n.title === wantPW || n.id === wantPW)) || novels.find((n) => n.id === (plotData && plotData.activeNovelId)) || novels[0] || null;
  const p = makeProject(worldData ? nv.title || 'My Novel' : pwN ? pwN.title : 'My Novel');
  if (worldData) Object.assign(p, {
    series: nv.series || '', genre: Array.isArray(nv.genre) ? nv.genre.join(', ') : nv.genre || '', audience: nv.audience || '',
    logline: nv.logline || '', synopsisShort: nv.synopsis || '', targetWords: Number(nv.goal) || 80000, deadline: nv.deadline || '', stage: nv.stage || 'First draft',
  });
  if (pwN) p.pwNovelId = pwN.id;
  if (worldData) { p.wk = {}; for (const k of Object.keys(WORLD_PER_BOOK)) p.wk[k] = nv[k] !== undefined ? clone(nv[k]) : clone(WORLD_PER_BOOK[k]); }
  if (p.stage === 'Second draft') { p.draft = 2; p.draftHistory = [{ n: 1, date: '', words: null, note: 'First draft' }, { n: 2, date: today(), words: null, note: 'Second draft' }]; }
  // Worldkeeper reader milestones become Draftsmith reader rounds (and stay in sync from now on).
  for (const m of ((p.wk && p.wk.milestones) || nv.milestones || [])) {
    if (!['Alpha readers', 'Beta readers'].includes(m.kind)) continue;
    const type = m.kind === 'Alpha readers' ? 'alpha' : 'beta';
    const r = { id: uid(), type, name: m.name || (type === 'alpha' ? 'Alpha round' : 'Beta round'), version: `Draft ${p.draft}`, due: m.due || '', focus: m.note || '', questions: [], includeInCompile: null, sends: [] };
    for (const rd of (m.readers || [])) {
      let reader = p.readers.find((x) => x.name === rd.name);
      if (!reader) { reader = { id: uid(), name: rd.name, contact: '', color: READER_COLORS[p.readers.length % READER_COLORS.length] }; p.readers.push(reader); }
      r.sends.push({ r: reader.id, sent: m.start || '', format: 'Other', version: r.version, status: ['Not sent', 'Reading', 'Feedback in'][rd.status] || 'Not sent', due: m.due || '', files: [], answers: {} });
    }
    p.rounds.push(r); m.roundId = r.id; m.projectId = p.id;
  }
  return p;
}

async function runMigration(found, mode) {
  const dir = await backupAll(found);
  if (mode === 'import') {
    const w = found.world && found.world.data ? clone(found.world.data) : null;
    const pl = found.plot && found.plot.data ? clone(found.plot.data) : null;
    if (w) SG.data.world = w;
    if (pl) SG.data.plot = pl;
    if (!DS().projects.length && (w || pl)) { const p = projectFromOld(w, pl); DS().projects.push(p); DS().activeId = p.id; adoptLegacySeries(); syncSeries(); }
  }
  SG.data.migration = { state: 'done', at: new Date().toISOString(), mode, backup: dir, from: Object.values(found).filter(Boolean).map((x) => `${x.id}${x.version ? ' ' + x.version : ''}`) };
  await SG.saveNow();
  for (const x of Object.values(found)) {
    if (x && x.enabled && app().plugins?.disablePluginAndSave) { try { await app().plugins.disablePluginAndSave(x.id); } catch (e) { console.error('Storyguild: could not turn off', x.id, e); } }
  }
  await SG.loadSections();
  notice(mode === 'import' ? `Storyguild: imported your data. Backups are in ${dir}.` : `Storyguild: starting fresh. Your old plugin data is untouched (backup in ${dir}).`, 10000);
  SG.refreshAll();
}

class MigrationModal extends Modal {
  constructor(found, manual) { super(SG.app); this.found = found; this.manual = manual; }
  onOpen() {
    const { contentEl: c } = this; c.addClass('ds-modal', 'ds-migrate'); c.empty();
    const list = Object.values(this.found).filter(Boolean);
    c.append(el('h2', {}, 'Welcome to Storyguild'),
      el('p', {}, 'Storyguild brings ', el('b', {}, 'Draftsmith'), ', ', el('b', {}, 'Worldkeeper'), ' and ', el('b', {}, 'Plot Weaver'), ' together in one plugin. These are already in your vault:'));
    for (const x of list) {
      c.append(el('div', { class: 'ds-mig-card' },
        el('div', { class: 'ds-row' }, el('b', {}, x.name), x.version ? el('span', { class: 'ds-pill' }, 'v' + x.version) : null, el('span', { class: 'ds-pill ' + (x.enabled ? 'is-warn' : '') }, x.enabled ? 'turned on' : 'turned off'), x.data ? null : el('span', { class: 'ds-pill' }, 'no saved data')),
        x.summary.length ? el('ul', {}, x.summary.map((s) => el('li', {}, s))) : null));
    }
    c.append(el('div', { class: 'ds-mig-safe' },
      el('b', {}, 'What happens if you import'),
      el('ul', {},
        el('li', {}, 'Your notes are not changed. Sheets, scene notes, to-do files and code blocks keep working as they are.'),
        el('li', {}, 'Settings and outlines are copied into Storyguild. The original plugin folders are left exactly as they are.'),
        el('li', {}, 'A backup of every settings file is saved first, in .obsidian/plugins/storyguild/backups/.'),
        el('li', {}, 'The separate plugins are turned off (not uninstalled). They can’t run alongside Storyguild, because both would claim the same views and code blocks.'),
        el('li', {}, 'Your novel’s title, word goal, deadline and stage become shared fields, and Worldkeeper reader milestones become Draftsmith reader rounds.'))));
    if (this.manual && SG.data.migration.state === 'done') c.append(el('p', { class: 'ds-warn' }, 'You already set up Storyguild. Importing again replaces the current Worldkeeper and Plot Weaver data inside Storyguild with the data from the old plugins (a backup is made first).'));
    const row = el('div', { class: 'ds-modal-actions' });
    const go = (mode) => async () => { this.close(); await runMigration(this.found, mode); };
    row.append(
      el('button', { onclick: () => { SG.data.migration = { state: 'postponed' }; SG.saveSoon(); this.close(); SG.pausedNotice(); } }, 'Not now'),
      el('button', { onclick: () => { new ConfirmModal('Start fresh?', 'Storyguild won’t import anything. The old plugins are turned off, and their data stays in their own folders untouched.', 'Start fresh', go('fresh')).open(); } }, 'Start fresh'),
      el('button', { class: 'mod-cta', onclick: go('import') }, 'Import and switch'));
    c.append(row);
  }
  onClose() { this.contentEl.empty(); }
}
