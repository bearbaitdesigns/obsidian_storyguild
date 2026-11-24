const VIEW_MAP = 'worldkeeper-map-editor';
const VIEW_LIB = 'worldkeeper-maps-library';
const BLOCK = 'worldkeeper-map';
const BLOCK_LIST = 'worldkeeper-maps';
const SVGNS = 'http://www.w3.org/2000/svg';
/** every map is drawn in "map units": 1000 wide, height follows the image's shape */
const MAP_W = 1000;


/* ---------- small helpers for maps ---------- */
const MS = () => P.settings.maps;
const mDisplay = (v) => { const n = linkName(v); return n.split('/').pop().replace(/\.md$/, ''); };
const fmtD = (n, d = 0) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: d });
function s(tag, a = {}, ...kids) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(a || {})) { if (v === false || v == null) continue; if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat(4)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return e;
}
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const pathLen = (pts, closed) => { let L = 0; for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]); if (closed && pts.length > 2) L += dist(pts[pts.length - 1], pts[0]); return L; };
function debounce(fn, ms) { let t = null; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; d.flush = (...a) => { clearTimeout(t); return fn(...a); }; d.cancel = () => clearTimeout(t); return d; }

/* ---------- settings ---------- */
const UNITS = { mi: 'miles', km: 'kilometres', lea: 'leagues', m: 'metres', ft: 'feet', day: 'days of travel' };
const MAP_DEFAULTS = {
  mapsFolder: '{root}/Maps',
  imagesFolder: '{root}/Maps/Images',
  exportsFolder: '{root}/Maps/Exports',
  defaultUnit: 'mi',
  speeds: [{ name: 'On foot', perDay: 24 }, { name: 'On horseback', perDay: 40 }, { name: 'Wagon', perDay: 18 }, { name: 'Sailing ship', perDay: 100 }],
  pinSize: 26,
  showNames: true,
  pdfWidth: 3000,
  exportScale: 2,
  view: { lib: 'grid' },
};
function mergeMapSettings(saved) { const s = Object.assign(clone(MAP_DEFAULTS), saved || {}); s.view = Object.assign(clone(MAP_DEFAULTS.view), (saved || {}).view || {}); return s; }
/** a folder setting with {root} filled in */
const mapFolder = (k) => normalizePath(String(MS()[k] || MAP_DEFAULTS[k]).replace('{root}', P.settings.root || 'World'));

/* ---------- pin icons ----------
   Each icon is drawn in a 24×24 box centred on the pin: a coloured badge with a white glyph. */
const G = {
  star: 'M12 5.2l1.9 4.1 4.5.5-3.4 3 1 4.4L12 15l-3.9 2.2 1-4.4-3.4-3 4.5-.5z',
  city: 'M6 18V10h3V7h2v3h2V6h2v4h3v8z',
  dot: 'M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6z',
  castle: 'M7 18v-8h1.6V8.2h1.6V10h1.2V8.2h1.2V10h1.2V8.2h1.6V10H17v8h-3.4v-3a1.6 1.6 0 0 0-3.2 0v3z',
  fort: 'M12 5.5l5.5 2v4.2c0 3.2-2.4 5.4-5.5 6.8-3.1-1.4-5.5-3.6-5.5-6.8V7.5z',
  anchor: 'M12 5.5a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zM11.2 8.7h1.6v7.6c1.7-.2 3-1.2 3.5-2.6l-1.2-.4 2.4-1.6.8 2.7-1.1-.4c-.8 2.3-3 3.7-5.2 3.7s-4.4-1.4-5.2-3.7l-1.1.4.8-2.7 2.4 1.6-1.2.4c.5 1.4 1.8 2.4 3.5 2.6zM9.4 10h5.2v1.2H9.4z',
  temple: 'M12 5l6.5 3.6v1.2h-13V8.6zM7 11h1.6v5H7zm3.2 0h1.6v5h-1.6zm3.2 0H15v5h-1.6zM6 16.6h12V18H6z',
  ruin: 'M7 18v-7.5h2V18zm4 0v-5l2-1v6zm4 0v-9.5h2V18zM6 9h4v1H6zm8-1.5h4v1h-4z',
  cave: 'M5.5 18c0-5 2.9-9 6.5-9s6.5 4 6.5 9h-3.4c0-3-1.4-5.2-3.1-5.2S8.9 15 8.9 18z',
  mountain: 'M4.5 18l5.2-9 2.4 4 1.8-2.8L19.5 18z',
  forest: 'M12 4.8l4.6 6.4h-2.4l3 4H13v3h-2v-3H6.8l3-4H7.4z',
  camp: 'M12 6l6.8 12H5.2zm0 4.4L9.2 16h5.6z',
  swords: 'M6.2 5.4l6.1 6.1-1 1-6.1-6.1zm11.6 0l1 1-8.9 8.9-1-1zm-12 10.6l2.2-2.2 1 1-2.2 2.2zm9.4-1.2l1-1 3 3-1 1zM7 13l1 1-2.3 2.3-1-1zm4.1 1l1 1-1 1-1-1z',
  poi: 'M12 5.5l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z',
  danger: 'M12 5.5l6.8 12H5.2zM11.2 10v4h1.6v-4zm0 5v1.4h1.6V15z',
  person: 'M12 6a2.8 2.8 0 1 1 0 5.6A2.8 2.8 0 0 1 12 6zm-5 11.5c.4-2.9 2.5-4.6 5-4.6s4.6 1.7 5 4.6z',
  tower: 'M9.5 18l.8-9H9V6.5h1.5v1.2h1V6.5h1v1.2h1V6.5H15V9h-1.3l.8 9z',
  bridge: 'M4.5 13.5h15v1.4h-1.6V17h-1.6v-1.5c0-1.6-2-3-4.3-3s-4.3 1.4-4.3 3V17H6.1v-2.1H4.5zM6 11h12v1.2H6z',
  mine: 'M6.5 17.5l6.8-6.8 1 1-6.8 6.8zM10.5 6c3.4-.6 6.5 1 7.8 3.8-2.4-1.3-5.2-1.6-7.8-1.1z',
  ship: 'M6 15h12l-2 3H8zM11.2 6h1.6v8.2h-1.6zm2.2 1.2l3.8 5.6h-3.8zM10.4 9l-3 3.8h3z',
  skull: 'M12 5.5c3.2 0 5.4 2.2 5.4 5.1 0 1.8-.9 3-2 3.6V17h-1.8v-1.5h-1v1.5h-1.2v-1.5h-1V17H8.6v-2.8c-1.1-.6-2-1.8-2-3.6 0-2.9 2.2-5.1 5.4-5.1zM9.8 10.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm4.4 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z',
  flag: 'M8 5.5h1.4V18H8zm1.4.6h8l-2 3 2 3h-8z',
};
const ICONS = {
  capital: { label: 'Capital', glyph: 'star', color: '#b8322f', ring: true },
  city: { label: 'City', glyph: 'city', color: '#8a3b8f' },
  town: { label: 'Town', glyph: 'dot', color: '#3b6fb6' },
  village: { label: 'Village', glyph: 'dot', color: '#4f8a4a', small: true },
  castle: { label: 'Castle', glyph: 'castle', color: '#6b5b4b' },
  fort: { label: 'Fort / outpost', glyph: 'fort', color: '#7a6a3a' },
  tower: { label: 'Tower', glyph: 'tower', color: '#55607a' },
  port: { label: 'Port', glyph: 'anchor', color: '#1f6f8b' },
  temple: { label: 'Temple / shrine', glyph: 'temple', color: '#b0892b' },
  ruin: { label: 'Ruins', glyph: 'ruin', color: '#7d7468' },
  cave: { label: 'Cave / dungeon', glyph: 'cave', color: '#4a4038' },
  mine: { label: 'Mine', glyph: 'mine', color: '#6e5a3c' },
  mountain: { label: 'Mountain / peak', glyph: 'mountain', color: '#6f6f6f' },
  forest: { label: 'Forest / grove', glyph: 'forest', color: '#2f7a46' },
  bridge: { label: 'Bridge / crossing', glyph: 'bridge', color: '#7a5c3c' },
  camp: { label: 'Camp', glyph: 'camp', color: '#a36a2f' },
  battle: { label: 'Battle', glyph: 'swords', color: '#9b2d2d' },
  ship: { label: 'Ship / wreck', glyph: 'ship', color: '#2d5f86' },
  danger: { label: 'Danger', glyph: 'danger', color: '#c2571a' },
  lair: { label: 'Lair', glyph: 'skull', color: '#3b3b3b' },
  person: { label: 'Character', glyph: 'person', color: '#5a4fb0' },
  flag: { label: 'Event / marker', glyph: 'flag', color: '#c0392b' },
  poi: { label: 'Point of interest', glyph: 'poi', color: '#d08a1e' },
};
const ICON_GROUPS = [['Settlements', ['capital', 'city', 'town', 'village', 'port']], ['Strongholds', ['castle', 'fort', 'tower']], ['Places', ['temple', 'ruin', 'cave', 'mine', 'bridge', 'camp']], ['Land & sea', ['mountain', 'forest', 'ship']], ['Story', ['person', 'battle', 'flag', 'danger', 'lair', 'poi']]];
/** a Worldkeeper note type suggests a pin icon */
const ICON_FOR_TYPE = { kingdom: 'capital', place: 'town', hub: 'poi', character: 'person', organization: 'flag', item: 'poi', magic: 'poi', culture: 'flag', species: 'flag', demon: 'lair', pantheon: 'temple', continent: 'flag', planet: 'flag' };

/* ---------- line presets ---------- */
const LINES = {
  route: { label: 'Route / journey', color: '#d2462e', width: 3, dash: '9 6', arrow: true, smooth: true },
  border: { label: 'Border', color: '#7a2e6e', width: 2.5, dash: '12 4 2 4', arrow: false, smooth: false },
  road: { label: 'Road', color: '#7b5a36', width: 3, dash: '', arrow: false, smooth: true },
  river: { label: 'River', color: '#3d86c6', width: 3.5, dash: '', arrow: false, smooth: true },
  sea: { label: 'Sea lane', color: '#2a6f97', width: 2.5, dash: '3 6', arrow: true, smooth: true },
  custom: { label: 'Plain line', color: '#333333', width: 2.5, dash: '', arrow: false, smooth: false },
};
/** line kinds people travel along: these show travel times */
const TRAVEL_STYLES = new Set(['route', 'road', 'sea', 'custom']);
const AREAS = {
  realm: { label: 'Realm / kingdom', color: '#7a2e6e', fill: 0.14, dash: '12 4 2 4', width: 2.5 },
  region: { label: 'Region', color: '#b07a1e', fill: 0.12, dash: '6 5', width: 2 },
  danger: { label: 'Danger zone', color: '#c0392b', fill: 0.16, dash: '4 4', width: 2 },
  water: { label: 'Water', color: '#3d86c6', fill: 0.22, dash: '', width: 1.5 },
  custom: { label: 'Plain area', color: '#444444', fill: 0.1, dash: '', width: 2 },
};
const LABELS = {
  realm: { label: 'Realm', size: 34, color: '#4a2c1a', font: 'serif', caps: true, spacing: 6, italic: false },
  region: { label: 'Region', size: 22, color: '#5a3d24', font: 'serif', caps: true, spacing: 3, italic: false },
  water: { label: 'Water', size: 22, color: '#1f5f8b', font: 'serif', caps: false, spacing: 2, italic: true },
  place: { label: 'Place', size: 15, color: '#2b2118', font: 'serif', caps: false, spacing: 0, italic: false },
  note: { label: 'Small note', size: 11, color: '#2b2118', font: 'sans', caps: false, spacing: 0, italic: true },
};
const NOTE_COLORS = ['#f6e27a', '#f4b0a0', '#a8d8b0', '#a9c8f0', '#d8b8f0', '#ffffff'];
