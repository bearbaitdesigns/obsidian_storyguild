/* A small in-browser stand-in for the Obsidian API, enough to load Storyguild,
   open its views and exercise the sections. Not a full implementation. */
(function () {
  // ---- HTMLElement helpers Obsidian adds ----
  const EP = HTMLElement.prototype;
  const mk = (tag, o = {}, parent) => { const e = document.createElement(tag); if (typeof o === 'string') o = { cls: o };
    if (o.cls) e.className = Array.isArray(o.cls) ? o.cls.join(' ') : o.cls; if (o.text != null) e.textContent = o.text; if (o.attr) for (const [k, v] of Object.entries(o.attr)) e.setAttribute(k, v);
    if (o.href) e.href = o.href; if (o.type) e.type = o.type; if (o.value != null) e.value = o.value; if (o.title) e.title = o.title; if (o.placeholder) e.placeholder = o.placeholder;
    if (parent) parent.appendChild(e); return e; };
  EP.createEl = function (t, o, cb) { const e = mk(t, o, this); if (cb) cb(e); return e; };
  EP.createDiv = function (o, cb) { return this.createEl('div', o, cb); };
  EP.createSpan = function (o, cb) { return this.createEl('span', o, cb); };
  EP.empty = function () { while (this.firstChild) this.removeChild(this.firstChild); };
  EP.addClass = function (...c) { this.classList.add(...c.flatMap((x) => String(x).split(' ')).filter(Boolean)); };
  EP.addClasses = function (c) { this.addClass(...c); };
  EP.removeClass = function (...c) { this.classList.remove(...c); };
  EP.toggleClass = function (c, v) { this.classList.toggle(c, v); };
  EP.hasClass = function (c) { return this.classList.contains(c); };
  EP.setText = function (t) { this.textContent = t; };
  EP.setAttr = function (k, v) { this.setAttribute(k, v); };
  EP.detach = function () { this.remove(); };
  EP.isShown = function () { return true; };
  EP.show = function () { this.style.display = ''; }; EP.hide = function () { this.style.display = 'none'; };
  EP.onClickEvent = function (cb) { this.addEventListener('click', cb); };
  EP.instanceOf = function (C) { return this instanceof C; };
  EP.setCssStyles = function (s) { Object.assign(this.style, s); };
  EP.setCssProps = function (s) { for (const [k, v] of Object.entries(s)) this.style.setProperty(k, v); };
  DocumentFragment.prototype.createEl = EP.createEl; DocumentFragment.prototype.createDiv = EP.createDiv;
  SVGElement.prototype.addClass = EP.addClass; SVGElement.prototype.removeClass = EP.removeClass; SVGElement.prototype.empty = EP.empty; SVGElement.prototype.toggleClass = EP.toggleClass;
  window.activeWindow = window; window.activeDocument = document;

  // ---- events ----
  class Events {
    on(name, cb) { (this._ev ||= {})[name] = (this._ev[name] || []).concat(cb); return { e: this, name, cb }; }
    off(name, cb) { if (this._ev && this._ev[name]) this._ev[name] = this._ev[name].filter((x) => x !== cb); }
    offref(ref) { ref.e.off(ref.name, ref.cb); }
    trigger(name, ...a) { for (const cb of (this._ev && this._ev[name]) || []) { try { cb(...a); } catch (e) { console.error('event', name, e); window.__errors.push(String(e && e.stack || e)); } } }
  }
  // ---- files ----
  class TAbstractFile { constructor(path) { this.setPath(path); } setPath(p) { this.path = p; this.name = p.split('/').pop(); } get parent() { const d = this.path.split('/').slice(0, -1).join('/'); return VAULT.folders.get(d) || VAULT.root; } }
  class TFile extends TAbstractFile { setPath(p) { super.setPath(p); const i = this.name.lastIndexOf('.'); this.basename = i > 0 ? this.name.slice(0, i) : this.name; this.extension = i > 0 ? this.name.slice(i + 1) : ''; this.stat = { ctime: Date.now(), mtime: Date.now(), size: 0 }; } }
  class TFolder extends TAbstractFile { get children() { return [...VAULT.files.values(), ...VAULT.folders.values()].filter((f) => f.path.split('/').slice(0, -1).join('/') === this.path); } isRoot() { return this.path === ''; } }
  const normalizePath = (p) => String(p).replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '').trim();

  // ---- tiny YAML ----
  function parseYaml(src) {
    const out = {}; let key = null;
    for (const line of String(src).split('\n')) {
      if (!line.trim()) continue;
      const li = line.match(/^\s+-\s*(.*)$/); if (li && key) { if (!Array.isArray(out[key])) out[key] = []; out[key].push(sc(li[1])); continue; }
      const m = line.match(/^([^:#]+):\s*(.*)$/); if (!m) continue; key = m[1].trim(); const v = m[2].trim();
      out[key] = v === '' ? null : v.startsWith('[') && v.endsWith(']') && !v.startsWith('[[') ? v.slice(1, -1).split(',').map((x) => sc(x.trim())).filter((x) => x !== '') : sc(v);
    }
    return out;
    function sc(v) { if (/^".*"$|^'.*'$/.test(v)) return v.slice(1, -1); if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v); if (v === 'true') return true; if (v === 'false') return false; if (v === 'null' || v === '~') return null; return v; }
  }
  function stringifyYaml(o) {
    const q = (v) => (typeof v === 'string' && (/^[\[{>|*&!%@`#'"]|: | #|^\s|\s$|^$|^(true|false|null|-?\d+(\.\d+)?)$/.test(v)) ? JSON.stringify(v) : String(v));
    return Object.entries(o).map(([k, v]) => Array.isArray(v) ? `${k}:\n${v.map((x) => `  - ${q(x)}`).join('\n')}` : v == null ? `${k}:` : typeof v === 'object' ? `${k}: ${JSON.stringify(v)}` : `${k}: ${q(v)}`).join('\n') + '\n';
  }
  const splitFm = (t) => { const m = String(t).match(/^---\n([\s\S]*?)\n---\n?/); return m ? { fm: parseYaml(m[1]), body: t.slice(m[0].length), raw: m[1] } : { fm: null, body: t }; };

  // ---- vault ----
  class Adapter {
    constructor() { this.data = new Map(); }
    async read(p) { p = normalizePath(p); if (this.data.has(p)) return this.data.get(p); const f = VAULT.files.get(p); if (f) return VAULT.text.get(p); throw new Error('ENOENT ' + p); }
    async write(p, d) { this.data.set(normalizePath(p), d); }
    async exists(p) { p = normalizePath(p); return this.data.has(p) || VAULT.files.has(p) || VAULT.folders.has(p) || [...this.data.keys()].some((k) => k.startsWith(p + '/')); }
    async mkdir(p) { this.data.set(normalizePath(p) + '/.dir', ''); }
    async list(p) { p = normalizePath(p); const files = [...this.data.keys()].filter((k) => k.startsWith(p + '/') && !k.endsWith('/.dir')); return { files, folders: [] }; }
    async remove(p) { this.data.delete(normalizePath(p)); }
    getResourcePath(p) { return 'app://local/' + p; }
  }
  class Vault extends Events {
    constructor() { super(); this.files = new Map(); this.folders = new Map(); this.text = new Map(); this.bin = new Map(); this.adapter = new Adapter(); this.configDir = '.obsidian'; this.root = new TFolder(''); }
    getRoot() { return this.root; }
    getMarkdownFiles() { return [...this.files.values()].filter((f) => f.extension === 'md'); }
    getFiles() { return [...this.files.values()]; }
    getAllLoadedFiles() { return [...this.files.values(), ...this.folders.values()]; }
    getAbstractFileByPath(p) { p = normalizePath(p); return this.files.get(p) || this.folders.get(p) || (p === '' ? this.root : null); }
    getFileByPath(p) { return this.files.get(normalizePath(p)) || null; }
    async read(f) { return this.text.get(f.path) ?? ''; }
    async cachedRead(f) { return this.read(f); }
    async readBinary(f) { const b = this.bin.get(f.path) || new TextEncoder().encode(this.text.get(f.path) || ''); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }
    _parents(p) { const parts = p.split('/'); for (let i = 1; i < parts.length; i++) { const d = parts.slice(0, i).join('/'); if (!this.folders.has(d)) this.folders.set(d, new TFolder(d)); } }
    async create(p, data) { p = normalizePath(p); if (this.files.has(p)) throw new Error('File already exists: ' + p); this._parents(p); const f = new TFile(p); this.files.set(p, f); this.text.set(p, data); MC._index(f); this.trigger('create', f); this.trigger('modify', f); return f; }
    async createBinary(p, buf) { p = normalizePath(p); if (this.files.has(p)) throw new Error('exists ' + p); this._parents(p); const f = new TFile(p); this.files.set(p, f); this.bin.set(p, new Uint8Array(buf)); this.trigger('create', f); return f; }
    async modifyBinary(f, buf) { this.bin.set(f.path, new Uint8Array(buf)); this.trigger('modify', f); }
    async modify(f, data) { this.text.set(f.path, data); MC._index(f); this.trigger('modify', f); }
    async process(f, fn) { const d = fn(await this.read(f)); await this.modify(f, d); return d; }
    async createFolder(p) { p = normalizePath(p); if (this.folders.has(p)) throw new Error('Folder already exists'); this._parents(p + '/x'); this.folders.set(p, new TFolder(p)); }
    async delete(f) { this.files.delete(f.path); this.text.delete(f.path); this.trigger('delete', f); }
    async trash(f) { return this.delete(f); }
    async rename(f, np) { const old = f.path; this.files.delete(old); const t = this.text.get(old); this.text.delete(old); f.setPath(normalizePath(np)); this._parents(f.path); this.files.set(f.path, f); this.text.set(f.path, t); MC._index(f); this.trigger('rename', f, old); }
    async copy(f, np) { return this.create(np, this.text.get(f.path)); }
    getResourcePath(f) { const b = this.bin.get(f.path); if (!b) return 'data:,'; this._urls ||= {}; return (this._urls[f.path] ||= URL.createObjectURL(new Blob([b]))); }
    getConfig() { return null; }
  }
  class MetadataCache extends Events {
    constructor() { super(); this.cache = new Map(); this.resolvedLinks = {}; this.unresolvedLinks = {}; }
    _index(f) {
      if (f.extension !== 'md') return; const t = VAULT.text.get(f.path) || ''; const s = splitFm(t);
      const links = [...t.matchAll(/\[\[([^\]|#]+)/g)].map((m) => ({ link: m[1], original: m[0] }));
      const headings = [...t.matchAll(/^(#{1,6})\s+(.*)$/gm)].map((m) => ({ heading: m[2], level: m[1].length, position: { start: { offset: m.index }, end: { offset: m.index + m[0].length } } }));
      const fmLinks = s.fm ? Object.entries(s.fm).flatMap(([k, v]) => [].concat(v).filter((x) => typeof x === 'string' && /^\[\[/.test(x)).map((x) => ({ key: k, link: x.slice(2, -2).split('|')[0], original: x }))) : [];
      const tags = [...s.body.matchAll(/(^|\s)#([\w/-]+)/g)].map((m) => ({ tag: '#' + m[2] }));
      const listItems = [...t.split('\n').entries()].filter(([, l]) => /^\s*[-*+] \[.\] /.test(l)).map(([i, l]) => ({ task: l.match(/\[(.)\]/)[1], position: { start: { line: i } } }));
      this.cache.set(f.path, { frontmatter: s.fm || undefined, links, headings, frontmatterLinks: fmLinks, tags, listItems, sections: [], frontmatterPosition: s.fm ? { start: { line: 0 }, end: { line: (s.raw || '').split('\n').length + 1 } } : undefined });
      const rl = {}; for (const l of [...links, ...fmLinks]) { const d = this.getFirstLinkpathDest(l.link, f.path); if (d) rl[d.path] = (rl[d.path] || 0) + 1; } this.resolvedLinks[f.path] = rl;
      setTimeout(() => this.trigger('changed', f, t, this.cache.get(f.path)), 0);
    }
    getFileCache(f) { return f ? this.cache.get(f.path) || null : null; }
    getCache(p) { return this.cache.get(p) || null; }
    getFirstLinkpathDest(link, src) { link = normalizePath(String(link).split('#')[0].split('|')[0]); const c = [...VAULT.files.values()]; return c.find((f) => f.path === link || f.path === link + '.md') || c.find((f) => f.basename === link.split('/').pop() || f.name === link.split('/').pop()) || null; }
    fileToLinktext(f, src, omitMd) { return omitMd && f.extension === 'md' ? f.basename : f.name; }
    getTags() { return {}; }
  }
  const VAULT = new Vault(); const MC = new MetadataCache();

  // ---- components ----
  class Component {
    constructor() { this._children = []; this._cleanup = []; this._loaded = false; }
    load() { if (this._loaded) return; this._loaded = true; this.onload(); for (const c of this._children) c.load(); }
    unload() { if (!this._loaded) return; this._loaded = false; for (const c of this._children.slice()) c.unload(); for (const fn of this._cleanup.splice(0)) { try { fn(); } catch (e) { console.error(e); } } this.onunload(); }
    onload() {} onunload() {}
    addChild(c) { this._children.push(c); if (this._loaded) c.load(); return c; }
    removeChild(c) { const i = this._children.indexOf(c); if (i >= 0) { this._children.splice(i, 1); c.unload(); } return c; }
    register(fn) { this._cleanup.push(fn); }
    registerEvent(ref) { this._cleanup.push(() => ref.e.offref(ref)); }
    registerDomEvent(el, t, cb, o) { el.addEventListener(t, cb, o); this._cleanup.push(() => el.removeEventListener(t, cb, o)); }
    registerInterval(id) { this._cleanup.push(() => clearInterval(id)); return id; }
  }
  class Plugin extends Component {
    constructor(app, manifest) { super(); this.app = app; this.manifest = manifest; }
    addCommand(c) { c = Object.assign({}, c, { id: `${this.manifest.id}:${c.id}`, name: `${this.manifest.name}: ${c.name}` }); if (APP.commands.commands[c.id]) throw new Error('Duplicate command ' + c.id); APP.commands.commands[c.id] = c; this.register(() => delete APP.commands.commands[c.id]); return c; }
    addRibbonIcon(icon, title, cb) { const e = document.createElement('div'); e.title = title; e.onclick = cb; document.getElementById('ribbon').append(e); this.register(() => e.remove()); return e; }
    addStatusBarItem() { return document.createElement('div'); }
    addSettingTab(t) { APP.setting.tabs.push(t); this.register(() => { APP.setting.tabs = APP.setting.tabs.filter((x) => x !== t); }); }
    registerView(type, fn) { if (APP.viewRegistry[type]) throw new Error('Attempting to register an existing view type "' + type + '"'); APP.viewRegistry[type] = fn; this.register(() => { delete APP.viewRegistry[type]; for (const l of APP.workspace.leaves.filter((x) => x.view && x.view.getViewType() === type)) l.detach(); }); }
    registerMarkdownCodeBlockProcessor(lang, fn) { if (APP.codeblocks[lang]) throw new Error('Code block processor already registered for ' + lang); APP.codeblocks[lang] = fn; this.register(() => delete APP.codeblocks[lang]); }
    registerMarkdownPostProcessor() {} registerHoverLinkSource() {} registerExtensions() {} registerEditorExtension() {} registerObsidianProtocolHandler() {} registerEditorSuggest() {}
    async loadData() { try { return JSON.parse(await VAULT.adapter.read(`.obsidian/plugins/${this.manifest.id}/data.json`)); } catch (e) { return null; } }
    async saveData(d) { await VAULT.adapter.write(`.obsidian/plugins/${this.manifest.id}/data.json`, JSON.stringify(d)); }
  }
  class View extends Component { constructor(leaf) { super(); this.leaf = leaf; this.app = APP; this.containerEl = document.createElement('div'); this.containerEl.className = 'workspace-leaf-content'; this.contentEl = this.containerEl.createDiv('view-content'); } getDisplayText() { return ''; } getIcon() { return ''; } getState() { return {}; } async setState() {} async onOpen() {} async onClose() {} }
  class ItemView extends View { addAction() { return document.createElement('div'); } }
  class MarkdownRenderChild extends Component { constructor(el) { super(); this.containerEl = el; } }
  class WorkspaceLeaf { constructor() { this.app = APP; this.view = null; this.tabHeaderInnerTitleEl = document.createElement('div'); }
    async setViewState(s) { if (this.view) { await this.view.onClose(); this.view.unload(); this.view.containerEl.remove(); } const fn = APP.viewRegistry[s.type]; if (!fn) throw new Error('no view ' + s.type); this.view = fn(this); document.getElementById('workspace').append(this.view.containerEl); this.view.load(); await this.view.onOpen(); if (s.state && this.view.setState) await this.view.setState(s.state, {}); }
    async openFile(f) { this.file = f; APP.workspace.activeFile = f; }
    getViewState() { return { type: this.view && this.view.getViewType() }; } detach() { if (this.view) { this.view.onClose(); this.view.unload(); this.view.containerEl.remove(); } APP.workspace.leaves = APP.workspace.leaves.filter((l) => l !== this); } updateHeader() {} setPinned() {} }
  class Workspace extends Events {
    constructor() { super(); this.leaves = []; this.activeFile = null; this.containerEl = document.body; }
    getLeavesOfType(t) { return this.leaves.filter((l) => l.view && l.view.getViewType() === t); }
    getLeaf() { const l = new WorkspaceLeaf(); this.leaves.push(l); return l; }
    getRightLeaf() { return this.getLeaf(); } getLeftLeaf() { return this.getLeaf(); } createLeafBySplit() { return this.getLeaf(); }
    revealLeaf() {} async revealLeafAsync() {} setActiveLeaf() {}
    onLayoutReady(cb) { setTimeout(cb, 0); } get layoutReady() { return true; }
    getActiveFile() { return this.activeFile; } getActiveViewOfType() { return null; } iterateAllLeaves(cb) { this.leaves.forEach(cb); } openLinkText() {}
    get activeLeaf() { return this.leaves[0] || null; }
  }
  class Modal { constructor(app) { this.app = app; this.containerEl = document.createElement('div'); this.containerEl.className = 'modal-container'; this.modalEl = this.containerEl.createDiv('modal'); this.titleEl = this.modalEl.createDiv('modal-title'); this.contentEl = this.modalEl.createDiv('modal-content'); this.scope = { register() {} }; }
    open() { document.body.append(this.containerEl); window.__modals.push(this); this.onOpen(); return this; } close() { this.containerEl.remove(); window.__modals = window.__modals.filter((m) => m !== this); this.onClose(); } onOpen() {} onClose() {} setTitle(t) { this.titleEl.textContent = t; return this; } setContent(c) { this.contentEl.append(c); return this; } }
  class SuggestModal extends Modal { setPlaceholder(p) { this.placeholder = p; } setInstructions() {} }
  class FuzzySuggestModal extends SuggestModal { }
  class Notice { constructor(m) { window.__notices.push(String(m instanceof DocumentFragment ? m.textContent : m)); this.noticeEl = document.createElement('div'); } setMessage() { return this; } hide() {} }
  class Menu { constructor() { this.items = []; window.__lastMenu = this; } addItem(cb) { const it = { title: '', cb: null, setTitle(t) { this.title = t; return this; }, setIcon() { return this; }, onClick(c) { this.cb = c; return this; }, setSection() { return this; }, setChecked() { return this; }, setDisabled() { return this; }, setWarning() { return this; } }; cb(it); this.items.push(it); return this; }
    addSeparator() { return this; } showAtMouseEvent() { return this; } showAtPosition() { return this; } hide() {} onHide() {} }
  const comp = (el) => { const c = { inputEl: el, buttonEl: el, selectEl: el, toggleEl: el, _cb: null,
    setValue(v) { if (el.type === 'checkbox') el.checked = !!v; else el.value = v; return c; }, getValue() { return el.type === 'checkbox' ? el.checked : el.value; },
    onChange(cb) { c._cb = cb; el.addEventListener('change', () => cb(c.getValue())); return c; }, setPlaceholder(p) { el.placeholder = p; return c; }, setDisabled(d) { el.disabled = d; return c; },
    setButtonText(t) { el.textContent = t; return c; }, setCta() { return c; }, setWarning() { return c; }, onClick(cb) { el.addEventListener('click', cb); return c; }, setTooltip() { return c; }, setIcon() { return c; },
    addOption(v, l) { el.append(new Option(l, v)); return c; }, addOptions(o) { for (const [v, l] of Object.entries(o)) c.addOption(v, l); return c; }, setLimits() { return c; }, setDynamicTooltip() { return c; }, then(cb) { cb(c); return c; } }; return c; };
  class Setting { constructor(container) { this.settingEl = container.createDiv('setting-item'); this.infoEl = this.settingEl.createDiv('setting-item-info'); this.nameEl = this.infoEl.createDiv('setting-item-name'); this.descEl = this.infoEl.createDiv('setting-item-description'); this.controlEl = this.settingEl.createDiv('setting-item-control'); this.components = []; }
    setName(n) { this.nameEl.append(n); return this; } setDesc(d) { this.descEl.append(d); return this; } setClass(c) { this.settingEl.addClass(c); return this; } setHeading() { return this; } setDisabled() { return this; } setTooltip() { return this; }
    _add(tag, type, cb) { const e = this.controlEl.createEl(tag, type ? { type } : {}); const c = comp(e); this.components.push(c); cb && cb(c); return this; }
    addText(cb) { return this._add('input', 'text', cb); } addTextArea(cb) { return this._add('textarea', null, cb); } addToggle(cb) { return this._add('input', 'checkbox', cb); } addDropdown(cb) { return this._add('select', null, cb); }
    addButton(cb) { return this._add('button', null, cb); } addExtraButton(cb) { return this._add('button', null, cb); } addColorPicker(cb) { return this._add('input', 'color', cb); } addSlider(cb) { return this._add('input', 'range', cb); } addSearch(cb) { return this._add('input', 'text', cb); } addMomentFormat(cb) { return this._add('input', 'text', cb); } }
  class PluginSettingTab { constructor(app, plugin) { this.app = app; this.plugin = plugin; this.containerEl = document.createElement('div'); } display() {} hide() {} }
  const MarkdownRenderer = { render: async (app, md, el) => { el.append(document.createTextNode(md)); }, renderMarkdown: async (md, el) => { el.append(document.createTextNode(md)); } };
  const Keymap = { isModEvent: () => false, isModifier: () => false };
  const setIcon = (el) => { if (el) el.textContent = el.textContent || ''; };

  const APP = window.app = {
    vault: VAULT, metadataCache: MC, workspace: new Workspace(), viewRegistry: {}, codeblocks: {}, setting: { tabs: [] },
    commands: { commands: {}, executeCommandById(id) { const c = this.commands[id]; if (!c) return false; c.callback && c.callback(); return true; } },
    plugins: { manifests: {}, enabledPlugins: new Set(), plugins: {}, async disablePluginAndSave(id) { this.enabledPlugins.delete(id); const p = this.plugins[id]; if (p) { p.unload(); delete this.plugins[id]; } } },
    fileManager: {
      async processFrontMatter(f, fn) { const t = VAULT.text.get(f.path) || ''; const s = splitFm(t); const fm = s.fm || {}; fn(fm); await VAULT.modify(f, `---\n${stringifyYaml(fm)}---\n${s.body}`); },
      generateMarkdownLink(f) { return `[[${f.basename}]]`; }, async renameFile(f, p) { await VAULT.rename(f, p); },
    },
    loadLocalStorage() { return null; }, saveLocalStorage() {},
  };
  window.__notices = []; window.__modals = []; window.__errors = [];
  // Test guard: Element.append(null) prints the word "null" in Obsidian. Flag it.
  for (const P of [Element.prototype, DocumentFragment.prototype]) { const orig = P.append; P.append = function (...a) { if (a.some((x) => x === null || x === undefined || x === false)) window.__errors.push('append(null) into <' + (this.className || this.tagName) + '>: ' + new Error().stack.split('\n').slice(2, 4).join(' | ')); return orig.apply(this, a); }; }
  window.__obsidian = { Plugin, Component, ItemView, View, Modal, SuggestModal, FuzzySuggestModal, Setting, Notice, PluginSettingTab, TFile, TFolder, TAbstractFile, normalizePath, Menu, MarkdownRenderChild, MarkdownRenderer, Keymap, stringifyYaml, parseYaml, setIcon, Events, WorkspaceLeaf,
    debounce: (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }, Platform: window.__MOBILE ? { isMobile: true, isPhone: true, isTablet: false, isDesktop: false, isAndroidApp: true, isMobileApp: true, isDesktopApp: false } : { isMobile: false, isDesktop: true, isDesktopApp: true }, moment: () => ({ format: () => '' }), requestUrl: async () => ({}), getAllTags: () => [], parseFrontMatterAliases: () => [], sanitizeHTMLToDom: (h) => { const d = document.createElement('div'); d.innerHTML = h; const f = document.createDocumentFragment(); f.append(...d.childNodes); return f; } };
  window.require = (m) => { if (m === 'obsidian') return window.__obsidian; throw new Error('require ' + m); };
})();
