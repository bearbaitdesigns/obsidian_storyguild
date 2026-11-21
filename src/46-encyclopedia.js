/* =====================================================================
   Encyclopedia extras: Mermaid diagrams and canvases
   Hooked into Worldkeeper's encyclopedia through HOST (see scripts/build.mjs, "wk:enc-…" patches).
   ===================================================================== */
const DIAGRAMS = [
  ['Flowchart — cause and effect', 'Events that lead to one another, with a choice', `flowchart TD
  A[The ninth lantern goes dark] --> B[The Guild calls in the debt]
  B --> C{Does Mara pay?}
  C -- yes --> D[She loses the house]
  C -- no --> E[The Tide Court takes the town]`],
  ['Timeline', 'Eras and what happened in each', `timeline
  title History of the world
  Age of Myth : The sea gods walk the shore
  Age of Crowns : The city is founded : The nine lanterns are lit
  Modern age : The ninth lantern goes dark`],
  ['Family tree', 'Parents, children and marriages', `flowchart TD
  A[Aldo Vell] --- B[Maren Vell]
  A --> C[Mara Vell]
  A --> D[Ilse Vell]
  B --> C
  B --> D`],
  ['Relationships', 'Who is what to whom', `flowchart LR
  Mara((Mara)) -- sister --> Ilse((Ilse))
  Mara -- owes a debt to --> Teodor((Teodor))
  Teodor -- works for --> Guild[Lamplighters’ Guild]
  Ilse -. secretly serves .-> Court[The Tide Court]`],
  ['Hierarchy', 'Ranks, an order or a government', `flowchart TB
  Q[The Tide Queen] --> H1[High Warden]
  Q --> H2[Keeper of Bells]
  H1 --> W1[Wardens]
  H2 --> B1[Bellwrights]`],
  ['Mind map', 'Ideas around one subject', `mindmap
  root((Saltglass))
    Making
      Sea water
      Lantern fire
    Uses
      Lanterns
      Trade
    Dangers
      Madness
      Theft`],
  ['Sequence', 'An exchange between characters, step by step', `sequenceDiagram
  participant M as Mara
  participant T as Teodor
  M->>T: I can pay half now
  T-->>M: The Guild wants all of it
  M->>T: Then the lantern stays dark`],
  ['Blank diagram', 'Start from an empty flowchart', `flowchart TD
  A[Start] --> B[Next]`],
];
const canvasFiles = () => app().vault.getFiles().filter((f) => f.extension === 'canvas');

/** Put text into the entry editor at the cursor, on its own lines, and save. */
function insertAtCursor(ta, text) {
  const s = ta.selectionStart ?? ta.value.length; const before = ta.value.slice(0, s); const after = ta.value.slice(ta.selectionEnd ?? s);
  const pre = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
  const post = after.startsWith('\n') ? '\n' : '\n\n';
  ta.value = before + pre + text + post + after.replace(/^\n+/, '');
  const at = (before + pre + text).length; ta.focus(); ta.setSelectionRange(at, at);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}
class CanvasPick extends FuzzySuggestModal {
  constructor(onPick, placeholder) { super(SG.app); this.onPick = onPick; this.setPlaceholder(placeholder || 'Choose a canvas…'); }
  getItems() { return canvasFiles(); }
  getItemText(f) { return f.path.replace(/\.canvas$/, ''); }
  onChooseItem(f) { this.onPick(f); }
}
async function newCanvas(entry) {
  return new Promise((resolve) => new FormModal('New canvas', [{ key: 'name', label: 'Name', required: true, value: `${entry.basename} canvas` }], 'Create', async (v) => {
    const folder = entry.parent && entry.parent.path !== '/' ? entry.parent.path : '';
    let path = normalizePath(`${folder ? folder + '/' : ''}${v.name.trim().replace(/[\\/:*?"<>|#^[\]]/g, '')}.canvas`);
    for (let i = 2; app().vault.getAbstractFileByPath(path); i++) path = path.replace(/( \d+)?\.canvas$/, ` ${i}.canvas`);
    const f = await app().vault.create(path, JSON.stringify({ nodes: [], edges: [] }, null, '\t')); resolve(f);
  }).open());
}
const linkTo = (f, src) => app().metadataCache.fileToLinktext(f, src, true);

/** Buttons above the entry editor: ◇ Diagram and 🧩 Canvas. */
function encTools(ta, entry) {
  const diagram = el('button', { title: 'Insert a Mermaid diagram' }, '◇ Diagram');
  diagram.addEventListener('click', (e) => {
    const m = new Menu();
    for (const [name, desc, code] of DIAGRAMS) m.addItem((it) => it.setTitle(name).onClick(() => insertAtCursor(ta, '```mermaid\n' + code + '\n```')));
    m.addSeparator && m.addSeparator();
    m.addItem((it) => it.setTitle('How to write diagrams (mermaid.js.org)').onClick(() => window.open('https://mermaid.js.org/intro/syntax-reference.html')));
    m.showAtMouseEvent(e);
  });
  const canvas = el('button', { title: 'Link or show a canvas in this entry' }, '🧩 Canvas');
  canvas.addEventListener('click', (e) => {
    const m = new Menu(); const has = canvasFiles().length;
    if (has) {
      m.addItem((it) => it.setTitle('Show a canvas in the entry…').onClick(() => new CanvasPick((f) => insertAtCursor(ta, `![[${linkTo(f, entry.path)}]]`), 'Show which canvas?').open()));
      m.addItem((it) => it.setTitle('Link to a canvas…').onClick(() => new CanvasPick((f) => insertAtCursor(ta, `[[${linkTo(f, entry.path)}|${f.basename}]]`), 'Link to which canvas?').open()));
    }
    m.addItem((it) => it.setTitle('New canvas…').onClick(async () => { const f = await newCanvas(entry); if (f) { insertAtCursor(ta, `![[${linkTo(f, entry.path)}]]`); notice(`Created ${f.path}. Open it from the entry to start drawing.`); } }));
    m.showAtMouseEvent(e);
  });
  return [diagram, canvas];
}

/** While editing, Mermaid diagrams are drawn live under the text, so you can see them as you type. */
function encPreview(ta, entry) {
  const box = el('div', { class: 'sg-enc-dpreview' }); let comp = null; let t = 0; let last = null;
  const draw = async () => {
    const blocks = [...ta.value.matchAll(/```mermaid[^\n]*\n([\s\S]*?)```/g)].map((m) => '```mermaid\n' + m[1] + '```');
    const md = blocks.join('\n\n'); if (md === last) return; last = md;
    if (comp) comp.unload(); box.empty ? box.empty() : (box.innerHTML = '');
    if (!blocks.length) { box.style.display = 'none'; return; }
    box.style.display = ''; put(box, el('div', { class: 'cs-tile-label' }, blocks.length === 1 ? 'Diagram preview' : `Diagram previews (${blocks.length})`));
    const out = el('div', { class: 'enc-md markdown-rendered' }); put(box, out);
    comp = new ob.Component(); comp.load();
    try { await ob.MarkdownRenderer.render(app(), md, out, entry.path, comp); } catch (e) { put(out, el('div', { class: 'cs-hint' }, 'This diagram has a mistake: ' + e.message)); }
  };
  ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(draw, 700); });
  setTimeout(draw, 50);
  return box;
}

/** In the rendered entry: [[links]] open (canvases too) and a tap on a diagram shows it full size. */
function encEnhance(md, entry) {
  md.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a.internal-link');
    if (a) { e.preventDefault(); e.stopPropagation(); app().workspace.openLinkText(a.getAttribute('data-href') || a.getAttribute('href') || a.textContent, entry.path, ob.Keymap ? ob.Keymap.isModEvent(e) : false); return; }
    const d = e.target.closest && e.target.closest('.mermaid');
    if (d && d.querySelector('svg')) { e.stopPropagation(); new DiagramModal(d.querySelector('svg')).open(); }
  });
}
class DiagramModal extends Modal {
  constructor(svg) { super(SG.app); this.svg = svg; this.z = 1; }
  onOpen() {
    this.modalEl.addClass('sg-diagram-modal'); this.titleEl.setText('Diagram');
    const stage = el('div', { class: 'sg-diagram-stage' }); const pic = this.svg.cloneNode(true); pic.removeAttribute('style'); pic.style.maxWidth = 'none';
    const w = this.svg.getBoundingClientRect().width || 600; const fit = () => { pic.style.width = `${Math.round(w * this.z)}px`; pic.style.height = 'auto'; };
    put(stage, pic); fit();
    const zoom = (k) => { this.z = Math.min(6, Math.max(0.3, this.z * k)); fit(); };
    put(this.contentEl, el('div', { class: 'ds-row' }, el('button', { onclick: () => zoom(1 / 1.3) }, '－'), el('button', { onclick: () => zoom(1.3) }, '＋'), el('button', { onclick: () => { this.z = 1; fit(); } }, 'Fit'), el('span', { class: 'ds-hint ds-grow' }, 'Pinch or use ＋ － to zoom; drag to move around.')), stage);
  }
  onClose() { this.contentEl.empty(); }
}
