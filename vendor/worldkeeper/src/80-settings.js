/* =====================================================================
   settings tab
   ===================================================================== */
class WorldkeeperSettingTab extends PluginSettingTab {
  constructor(plugin) { super(plugin.app, plugin); this.tab = 'folders'; this.type = 'character'; }
  display() {
    const c = this.containerEl; c.replaceChildren(); c.classList.add('wk-settings-host');
    const s = ST(); const root = h('div', { class: 'wk-st' }); ap(c, h('div', { class: 'wk' }, root));
    const save = () => P.saveSettings(); const redraw = async () => { await save(); this.display(); };
    const txt = (o, k, ph, cb, cls) => { const i = h('input', { type: 'text', value: o[k] ?? '', placeholder: ph || '', class: cls || '' }); i.addEventListener('change', () => { o[k] = i.value.trim(); save(); cb && cb(); }); return i; };
    const row = (name, desc, ...ctl) => h('div', { class: 'st-row' }, h('div', { class: 'st-lbl' }, h('b', {}, name), desc ? h('span', {}, desc) : null), ...ctl);
    const head = (x, d) => h('div', { class: 'st-head' }, x, d ? h('small', {}, d) : null);
    const area = (get, set) => { const t = h('textarea', {}, get()); t.addEventListener('change', () => { set(lines(t.value)); save(); }); return t; };
    const toggle = (o, k, cb) => { const b = h('button', { class: 'wk-toggle' + (o[k] ? ' is-on' : ''), onclick: () => { o[k] = !o[k]; b.classList.toggle('is-on', o[k]); save(); cb && cb(); } }); return b; };
    const btn = (label, fn, cta) => h('button', { class: cta ? 'mod-cta' : '', onclick: fn }, label);

    ap(root, h('div', { class: 'st-title' }, '🌍 Worldkeeper'), h('div', { class: 'cs-hint' }, 'by bearbaitdesigns · Changes apply to sheets and dashboards straight away.'));
    const tabs = [['folders', '📁 Folders'], ['types', '🧩 Templates & fields'], ['novel', '🧵 Novel & Plot Weaver'], ['general', '⚙ General']];
    ap(root, h('div', { class: 'st-nav' }, ...tabs.map(([k, l]) => h('button', { class: this.tab === k ? 'is-on' : '', onclick: () => { this.tab = k; this.display(); } }, l))));

    if (this.tab === 'folders') {
      const tree = h('div', { class: 'ftree' });
      const refresh = () => {
        const paths = [...S.ix().type.keys()].map((p) => app().vault.getAbstractFileByPath(p)).filter(Boolean).map((f) => S.pathFor(f)).sort();
        const seen = new Set(); tree.replaceChildren();
        for (const p of paths) { const parts = p.split('/'); parts.forEach((seg, i) => { const key = parts.slice(0, i + 1).join('/'); if (seen.has(key)) return; seen.add(key); ap(tree, h('div', { class: i < parts.length - 1 ? 'is-folder' : '' }, '  '.repeat(i) + (i < parts.length - 1 ? '📁 ' : '📄 ') + seg)); }); }
        if (!paths.length) ap(tree, h('div', { class: 'cs-hint' }, 'No Worldkeeper notes yet.'));
        root.querySelectorAll('.st-example[data-t]').forEach((e) => { const ex = S.notesOf(e.dataset.t)[0]; e.textContent = ex ? 'e.g. ' + S.pathFor(ex) : 'e.g. ' + S.folderFor(e.dataset.t, []) + '/…'; });
      };
      const mode = h('select', { class: 'dropdown' }, h('option', { value: 'flat', selected: s.folderMode === 'flat' }, 'Flat, by type'), h('option', { value: 'nested', selected: s.folderMode === 'nested' }, 'Nested, by geography'));
      mode.addEventListener('change', () => { s.folderMode = mode.value; redraw(); });
      ap(root, head('Folder organization', 'Where each template’s notes live. Tokens: {root} = world folder, {path} = the note’s place in the hierarchy (for shared types, its first region), {type} = plural name.'),
        row('World root folder', '', txt(s, 'root', 'World', refresh)),
        row('Layout', 'Flat keeps one folder per type. Nested mirrors Planet › Continent › Kingdom › Place.', mode),
        ...Object.keys(T()).map((id) => { const k = s.folderMode === 'nested' ? 'nested' : 'folder'; return h('div', { class: 'st-row' }, h('div', { class: 'st-lbl' }, h('b', {}, `${T()[id].icon} ${T()[id].plural}`), h('div', { class: 'st-example', 'data-t': id })), txt(T()[id], k, '', refresh, 'wk-mono wk-wide')); }),
        row('📚 Encyclopedia', 'Tokens: {root}, {category}', txt(s, 'encFolder', '', null, 'wk-mono wk-wide')),
        row('Templates folder', 'Where “Write template files” puts them. Notes here are ignored by dashboards.', txt(s, 'templatesFolder', 'Templates')),
        row('Move existing notes', 'Move notes to match these folders. Obsidian updates links automatically.', btn('Reorganize vault…', () => reorganize())),
        head('Resulting vault layout'), tree);
      setTimeout(refresh);
    } else if (this.tab === 'types') {
      const t = T()[this.type];
      ap(root, h('div', { class: 'tchips' }, ...Object.keys(T()).map((id) => h('button', { class: this.type === id ? 'is-on' : '', onclick: () => { this.type = id; this.display(); } }, `${T()[id].icon} ${T()[id].label}`))));
      const icon = h('input', { type: 'text', value: t.icon, class: 'wk-icon-in' }); icon.addEventListener('change', () => { t.icon = icon.value; save(); });
      ap(root, head(`${t.icon} ${t.label} template`), row('Name', 'Singular and plural', txt(t, 'label'), txt(t, 'plural')), row('Icon', '', icon), row('Identifier', `A note uses this template when its type property is “${t.typeValue}”.`, txt(t, 'typeValue')),
        row('Custom template file', 'Optional. Your own note to copy for new notes; {{title}} is replaced with the name.', txt(t, 'template', `${s.templatesFolder}/${t.label}.md`, null, 'wk-wide')));
      ap(root, head('Value-list fields', 'Single = dropdown, multi = checklist. One value per line.'));
      t.domain.forEach((df, i) => ap(root, h('div', { class: 'st-card' },
        row(df.label, df.when === 'demon' ? 'Only shown on demon characters' : '', txt(df, 'label', 'Label'), txt(df, 'key', 'property'), h('span', { class: 'cs-hint' }, 'Multi'), toggle(df, 'multi'),
          h('button', { class: 'st-ico', title: 'Move up', disabled: !i, onclick: () => { [t.domain[i - 1], t.domain[i]] = [t.domain[i], t.domain[i - 1]]; redraw(); } }, '↑'), h('button', { class: 'st-ico', title: 'Remove', onclick: () => { t.domain.splice(i, 1); redraw(); } }, '🗑')),
        row('Values', '', area(() => df.values.join('\n'), (v) => { df.values = v; })))));
      ap(root, btn('+ Add value-list field', () => { t.domain.push(D('newField', 'New field', ['Option A', 'Option B'])); redraw(); }));
      ap(root, head('Link fields', 'Store [[links]] in a property. Choose which templates the + picker offers.'));
      t.links.forEach((lf, i) => {
        const pl = h('select', { class: 'dropdown' }, ...[['header', 'Banner'], ['tile', 'Tile'], ['tab', 'Own tab']].map(([v, l]) => h('option', { value: v, selected: lf.placement === v }, l))); pl.addEventListener('change', () => { lf.placement = pl.value; save(); });
        const targets = h('div', { class: 'st-targets' }, ...Object.keys(T()).map((x) => { const cb = h('input', { type: 'checkbox', checked: lf.targets.includes(x) }); cb.addEventListener('change', () => { lf.targets = cb.checked ? [...lf.targets, x] : lf.targets.filter((y) => y !== x); save(); }); return h('label', {}, cb, `${T()[x].icon} ${T()[x].label}`); }));
        const other = h('input', { type: 'text', placeholder: 'other type values, comma-separated', value: lf.targets.filter((x) => !T()[x]).join(', ') });
        other.addEventListener('change', () => { lf.targets = [...lf.targets.filter((x) => T()[x]), ...other.value.split(',').map((x) => x.trim()).filter(Boolean)]; save(); });
        ap(root, h('div', { class: 'st-card' }, row(lf.label, t.parentKey === lf.key ? 'Hierarchy parent' : '', txt(lf, 'label', 'Label'), txt(lf, 'key', 'property'), pl, h('button', { class: 'st-ico', title: 'Remove', onclick: () => { t.links.splice(i, 1); redraw(); } }, '🗑')),
          row('Links to', 'Templates the picker offers', targets), row('Other note types', 'e.g. occupation', other), lf.where ? row('Only notes where', Object.entries(lf.where).map(([k, v]) => `${k} = ${v}`).join(', ')) : null));
      });
      ap(root, btn('+ Add link field', () => { t.links.push(L('newLink', 'New link', 'tile', ['character'])); redraw(); }));
      ap(root, head('Layout'),
        row('Banner text lists', '“property:Label”, one per line. Add “:tile” to show it as a card in the row below the banner instead (e.g. occupation:Occupation:tile)', area(() => t.text.map((x) => `${x.key}:${x.label}${x.tile ? ':tile' : ''}`).join('\n'), (v) => { t.text = v.map((x) => { const [k, l, p] = x.split(':'); return { key: k.trim(), label: (l || k).trim(), ...(String(p || '').trim() === 'tile' ? { tile: true } : {}) }; }); })),
        row('Text tabs', '“Name|icon”, one per line. Each is a tab you write in. Its text is kept in the note body as a hidden “> [!wk-tab] Name” block.', area(() => t.body.map((b) => `${b.heading}|${b.icon}`).join('\n'), (v) => { t.body = v.map((x) => { const [a, b] = x.split('|'); return { heading: a.trim(), icon: (b || '📄').trim() }; }); })),
        row('Tab order', 'Labels in order; anything unlisted goes last', area(() => (t.tabOrder || []).join('\n'), (v) => { t.tabOrder = v; })));
      if (this.type === 'magic') ap(root, head('Magic system lists'), row('Rule kinds', 'Columns on the Rules & limits tab', area(() => s.ruleKinds.map((r) => r.k).join('\n'), (v) => { s.ruleKinds = v.map((k, i) => s.ruleKinds.find((r) => r.k === k) || { k, c: ['#5b9bd5', '#d9a85a', '#d9534f', '#9b6bd3', '#5fc27e'][i % 5], i: '•' }); })));
      if (this.type === 'language') ap(root, head('Conlang lists'), row('Parts of speech', '', area(() => s.posList.join('\n'), (v) => { s.posList = v; })));
      if (this.type === 'pantheon') ap(root, head('Pantheon lists'), row('Divine ranks', '', area(() => s.divineRanks.join('\n'), (v) => { s.divineRanks = v; })));
      if (this.type === 'character') ap(root, head('Relationships'), row('Relationship types', '', area(() => s.relationshipTypes.join('\n'), (v) => { s.relationshipTypes = v; })));
      ap(root, head('Template file', 'Generated from the fields above. New notes and conversions use it unless you set a custom template file.'), h('pre', { class: 'st-tpl' }, templateText(this.type)),
        h('div', { class: 'wk-row' }, btn('⧉ Copy', () => navigator.clipboard.writeText(templateText(this.type)).then(() => toast('Template copied'))), btn(`Write all template files to ${s.templatesFolder}/`, () => writeTemplates())),
        head('Reset'), row(`Reset the ${t.label} template`, 'Restores its default fields and layout.', btn('Reset', () => confirm2(`Reset ${t.label}?`, 'Its fields, lists and layout go back to the defaults. Your notes are not changed.', () => { if (DEFAULT_TYPES[this.type]) { s.types[this.type] = clone(DEFAULT_TYPES[this.type]); redraw(); } }, 'Reset'))));
    } else if (this.tab === 'novel') {
      const nv = s.novel, pw = s.plotweaver;
      const scopeSel = h('select', { class: 'dropdown' }, ...[['all', 'All notes'], ['worldkeeper', 'Worldkeeper notes only'], ['off', 'Only my to-do list']].map(([v, l]) => h('option', { value: v, selected: (s.todoScope || 'all') === v }, l))); scopeSel.addEventListener('change', () => { s.todoScope = scopeSel.value; save(); });
      const scopeRow = row('Tasks from other notes', 'Checkbox tasks (- [ ]) written in notes also appear on the Home to-do card', scopeSel);
      const pwStatusRow = row('Status', 'Checking…', h('span', { class: 'wk-pill' }, '…'));
      const novelSel = h('select', { class: 'dropdown' }, h('option', { value: '' }, 'Plot Weaver’s current novel'));
      novelSel.addEventListener('change', () => { pw.novel = novelSel.value; save(); });
      const pwNovelRow = row('Novel', 'Which Plot Weaver novel the Home dashboard tracks', novelSel);
      const pwFieldsRow = row('Status & word-count fields', 'Read from Plot Weaver’s own settings, so they always match', h('code', {}, '…'));
      pwLoad().then((x) => {
        pwStatusRow.replaceWith(row('Status', x.installed ? `Detected plot-weaver ${x.version}${x.enabled ? '' : ' (disabled; reading its saved data)'}` : 'Not installed', h('span', { class: 'wk-pill ' + (x.installed && x.enabled ? 'ok' : 'warn') }, x.installed ? (x.enabled ? 'connected' : 'disabled') : 'missing')));
        for (const n of (x.data && x.data.novels) || []) ap(novelSel, h('option', { value: n.title, selected: pw.novel === n.title }, n.title + (x.data.activeNovelId === n.id ? ' (current)' : '')));
        if (pw.novel && !((x.data && x.data.novels) || []).some((n) => n.title === pw.novel)) ap(novelSel, h('option', { value: pw.novel, selected: true }, pw.novel + ' (not found)'));
        pwFieldsRow.querySelector('code').textContent = `status: ${x.settings.statusField} · words: ${x.settings.wordsField}`;
      });
      const goal = h('input', { type: 'number', value: nv.goal }); goal.addEventListener('change', () => { nv.goal = +goal.value; save(); });
      const dl = h('input', { type: 'date', value: nv.deadline || '' }); dl.addEventListener('change', () => { nv.deadline = dl.value; save(); });
      const stage = h('select', { class: 'dropdown' }, ...['Planning', 'First draft', 'Second draft', 'Revising', 'Editing', 'Querying', 'Published'].map((v) => h('option', { selected: nv.stage === v }, v))); stage.addEventListener('change', () => { nv.stage = stage.value; save(); });
      ap(root, head('Novel', 'Shown on the Home dashboard. Edit the logline and summary from Home.'), row('Title', '', txt(nv, 'title')), row('Series line', 'e.g. Book 1 of the …', txt(nv, 'series')), row('Word goal', '', goal), row('Deadline', '', dl), row('Stage', '', stage),
        head('Plot Weaver', 'Worldkeeper reads Plot Weaver’s cards (chapters, POVs, plotlines, cause → effect links, off-screen events) and each card’s linked scene note.'),
        pwStatusRow, row('Use Plot Weaver stats', 'Off = enter word counts by hand on Home', toggle(pw, 'enabled')), pwNovelRow, pwFieldsRow,
        head('To-do'), row('To-do file', 'Tasks are saved here as a Markdown checklist', txt(s, 'todoFile', '', null, 'wk-wide')), scopeRow, row('To-do properties', 'Frontmatter property names whose values count as tasks (comma-separated). Start a value with [x] to mark it done.', txt(s, 'todoFields', 'To-Do, todo, todos', null, 'wk-wide')), row('Tags', 'One per line', area(() => s.todoTags.join('\n'), (v) => { s.todoTags = v; })),
        row('Reset writing history', 'Clears the saved daily word counts used by the activity chart.', btn('Clear', () => confirm2('Clear writing history?', 'The activity chart starts again from today.', () => { s.history = {}; save(); }, 'Clear'))));
    } else {
      const bs = h('select', { class: 'dropdown' }, ...[['clear', 'Clear image'], ['blurred', 'Blurred backdrop']].map(([v, l]) => h('option', { value: v, selected: s.defaultBannerStyle === v }, l))); bs.addEventListener('change', () => { s.defaultBannerStyle = bs.value; save(); });
      const color = h('input', { type: 'color', value: s.accentColor || '#c8963e' }); color.addEventListener('change', () => { s.accentColor = color.value; save(); });
      ap(root, head('Sheets'), row('Show the name in the banner', 'Turn off if you prefer Obsidian’s inline title only.', toggle(s, 'showTitle')), row('Default banner style', '', bs),
        row('Home tab name', 'Shown on the tab of the Worldkeeper home dashboard', ((i) => { i.addEventListener('change', async () => { s.homeTitle = i.value.trim() || 'Worldkeeper home'; await P.saveSettingsQuiet(); P.updateHomeTitle(); }); return i; })(h('input', { type: 'text', value: s.homeTitle || 'Worldkeeper home', placeholder: 'Worldkeeper home' }))),
        row('Accent colour', 'Follows your theme unless set', color, btn('Use theme', () => { s.accentColor = ''; redraw(); })),
        row('White links between notes', 'In dark themes, links to other notes show as white text everywhere: Worldkeeper views and all your notes. Light themes use the normal text colour.', toggle(s, 'whiteLinks', () => P.applyLinkStyle())),
        head('Shared properties'), row('Image property', 'Portrait, emblem or map', txt(s, 'imageKey')), row('Banner property', 'Plus <property>_position and <property>_style', txt(s, 'bannerKey')),
        row('Gallery property', '', txt(s, 'galleryKey')), row('Details property', '', txt(s, 'detailsKey')), row('Relationships property', '', txt(s, 'relationshipKey')),
        head('Encyclopedia'), row('Entry type value', 'Encyclopedia notes have type: <this>', txt(s, 'entryType')), row('Categories', 'One per line', area(() => s.encCategories.join('\n'), (v) => { s.encCategories = v; })),
        head('Tools'), row('Convert existing notes', 'Map old properties onto any template in bulk', btn('⇪ Open converter', () => openConverter([]), true)),
        row('Template files', `Write a template note for every type to ${s.templatesFolder}/`, btn('Write template files', () => writeTemplates())),
        row('Move headings into tabs', 'Older notes kept Notes/Backstory text under headings in the body. Move it all into the tabs.', btn('Move headings…', () => migrateHeadings())));
    }
  }
}
