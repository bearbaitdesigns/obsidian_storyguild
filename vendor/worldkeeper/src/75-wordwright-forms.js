/* =====================================================================
   Wordwright: noun classes (gender) and root words (word families)
     fm.genders = { classes: [{ name, short, marker, type }], markNouns, agree }
     lexicon entry: gender: "f"   (the class's short name)
                    root:   "kral" (the stem it is built from; the root word itself has word === root)
   ===================================================================== */
const WW_FEM = ['woman', 'mother', 'daughter', 'girl', 'sister', 'wife', 'queen', 'princess', 'lady', 'goddess', 'priestess', 'she', 'her', 'aunt', 'niece', 'bride', 'widow', 'duchess', 'empress', 'witch', 'mare', 'hen', 'cow', 'maiden', 'grandmother'];
const WW_MASC = ['man', 'father', 'son', 'boy', 'brother', 'husband', 'king', 'prince', 'lord', 'god', 'priest', 'he', 'him', 'uncle', 'nephew', 'groom', 'duke', 'emperor', 'wizard', 'stallion', 'bull', 'rooster', 'grandfather'];
const WW_ANIMATE = ['person', 'people', 'child', 'friend', 'enemy', 'spirit', 'soul', 'bird', 'dog', 'horse', 'wolf', 'snake', 'fish', 'cat', 'dragon', 'beast', 'animal', 'warrior', 'hunter', 'healer', 'stranger', 'guest', 'baby', 'i', 'you', 'we', 'they'];
const WW_PAIRS = [['king', 'queen'], ['man', 'woman'], ['father', 'mother'], ['son', 'daughter'], ['boy', 'girl'], ['brother', 'sister'], ['husband', 'wife'], ['prince', 'princess'], ['lord', 'lady'], ['god', 'goddess'], ['priest', 'priestess'], ['uncle', 'aunt'], ['nephew', 'niece'], ['duke', 'duchess'], ['emperor', 'empress'], ['wizard', 'witch'], ['stallion', 'mare'], ['bull', 'cow'], ['grandfather', 'grandmother']];
const WW_CLASS_SETS = {
  'Masculine / feminine': [['Masculine', 'm'], ['Feminine', 'f']],
  'Masculine / feminine / neuter': [['Masculine', 'm'], ['Feminine', 'f'], ['Neuter', 'n']],
  'Animate / inanimate': [['Animate', 'an'], ['Inanimate', 'in']],
  'Many classes': [['Class 1', '1'], ['Class 2', '2'], ['Class 3', '3'], ['Class 4', '4']],
};
const wwSp = (x) => String(x || '').split(/\s+/).filter(Boolean);
const wwHash = (x) => { let n = 7; for (const c of String(x)) n = (n * 31 + c.codePointAt(0)) >>> 0; return n; };
const wwFirstMeaning = (m) => String(m || '').toLowerCase().split(/\s*[,;/(]\s*/)[0].trim();
/** the classes on a conlang (or a helper's draft config) */
function wwClasses(cfg) { return arr((cfg && cfg.classes) || []).filter((c) => c && c.name); }
const wwGenderCfg = (fm) => fm.genders || {};
/** a fresh set of classes for a grammar choice, each marked with a different vowel from the language */
function wwDefaultClasses(choice, ph) {
  const set = WW_CLASS_SETS[choice]; if (!set) return [];
  const V = wwSp(ph && ph.vowels).filter((v) => [...v].length === 1 && /[aeiou]/.test(v));
  const pref = { m: ['o', 'u', 'a'], f: ['a', 'e', 'i'], n: ['e', 'u', 'i'], an: ['i', 'a'], in: ['u', 'o'], 1: ['a'], 2: ['i'], 3: ['u'], 4: ['o'] };
  const used = new Set();
  return set.map(([name, short]) => { const v = (pref[short] || []).find((x) => V.includes(x) && !used.has(x)) || V.find((x) => !used.has(x)) || ''; if (v) used.add(v); return { name, short, marker: v, type: 'suffix' }; });
}
const wwKind = (c) => (/fem/i.test(c.name) ? 'f' : /masc/i.test(c.name) ? 'm' : /^inanim/i.test(c.name) ? 'in' : /^anim/i.test(c.name) ? 'an' : /neut/i.test(c.name) ? 'n' : '');
function wwNatural(meaning) { const m = wwFirstMeaning(meaning); return WW_FEM.includes(m) ? 'f' : WW_MASC.includes(m) ? 'm' : WW_ANIMATE.includes(m) ? 'an' : ''; }
/** the class a noun with this meaning falls into: women and men by sex, people and animals as animate, the rest spread evenly */
function wwClassFor(cfg, meaning) {
  const cl = wwClasses(cfg); if (!cl.length) return null; const nat = wwNatural(meaning);
  let c = null;
  if (nat === 'f' || nat === 'm') c = cl.find((x) => wwKind(x) === nat) || cl.find((x) => wwKind(x) === 'an');
  if (!c && nat) c = cl.find((x) => wwKind(x) === 'an');
  if (!c && cl.some((x) => wwKind(x) === 'in')) c = cl.find((x) => wwKind(x) === 'in');
  return c || cl[wwHash(wwFirstMeaning(meaning)) % cl.length];
}
const wwClassByShort = (cfg, short) => wwClasses(cfg).find((c) => c.short === short || c.name === short) || null;
/** add a class marker to a stem: a vowel marker replaces a final vowel, so kralo + a → krala */
function wwMark(word, c) {
  const m = String((c && c.marker) || '').replace(/^-+|-+$/g, ''); const w = String(word || ''); if (!m || !w) return w;
  const V = /[aeiouyáéíóúāēīōū]/i;
  if ((c.type || 'suffix') === 'prefix') { if (w.startsWith(m)) return w; return V.test(m.slice(-1)) && V.test(w[0]) ? m + w.replace(/^[aeiouyáéíóúāēīōū]+/i, '') : m + w; }
  if (w.endsWith(m)) return w;
  return V.test(m[0]) && V.test(w.slice(-1)) ? w.replace(/[aeiouyáéíóúāēīōū]+$/i, '') + m : w + m;
}
/** the stem of a marked word (krala → kral) */
function wwStem(word, cfg) {
  let w = String(word || '');
  for (const c of wwClasses(cfg)) { const m = String(c.marker || '').replace(/^-+|-+$/g, ''); if (!m) continue; if ((c.type || 'suffix') === 'prefix' ? w.startsWith(m) && w.length > m.length + 1 : w.endsWith(m) && w.length > m.length + 1) { w = (c.type || 'suffix') === 'prefix' ? w.slice(m.length) : w.slice(0, -m.length); break; } }
  return w;
}
/**
 * Give freshly coined nouns their class (and, when nouns show it, the class ending); pairs like king / queen
 * share one stem and become a word family. entries: [{ word, pos, meaning }] (changed in place).
 */
function wwGenderize(cfg, entries, existing = new Set()) {
  const cl = wwClasses(cfg); if (!cl.length) return entries;
  for (const e of entries) { if (e.pos !== 'noun' || e.gender) continue; const c = wwClassFor(cfg, e.meaning); if (!c) continue; e.gender = c.short; if (cfg.markNouns && c.marker) { const w = wwMark(e.word, c); if (w !== e.word && !existing.has(w)) { existing.add(w); e.word = w; } } }
  const by = new Map(entries.map((e) => [wwFirstMeaning(e.meaning), e]));
  const M = cl.find((x) => wwKind(x) === 'm'), F = cl.find((x) => wwKind(x) === 'f');
  if (M && F && M.marker && F.marker) for (const [a, b] of WW_PAIRS) {
    const em = by.get(a), ef = by.get(b); if (!em || !ef || em.root || ef.root) continue;
    const stem = wwStem(em.word, cfg); const wm = wwMark(stem, M), wf = wwMark(stem, F); if (wm === wf) continue;
    em.word = wm; ef.word = wf; em.root = ef.root = stem; em.gender = M.short; ef.gender = F.short;
  }
  return entries;
}
/** describing words take the class ending of the noun they go with (when the grammar says they agree) */
function wwAgree(cfg, words, adjAfter) {
  if (!cfg || !cfg.agree || !wwClasses(cfg).length) return words;
  for (let i = 0; i < words.length; i++) {
    const w = words[i]; if (w.role !== 'adj' || w.unknown) continue;
    const order = adjAfter ? [words[i - 1], words[i + 1]] : [words[i + 1], words[i - 1]];
    const n = order.find((x) => x && x.role === 'noun' && x.gender); if (!n) continue;
    const c = wwClassByShort(cfg, n.gender); if (!c || !c.marker) continue;
    w.o = wwMark(w.o, c); w.gloss = `${w.gloss}.${String(c.short).toUpperCase()}`;
  }
  return words;
}

/* ---------- roots and word families ---------- */
/** Map(root → entries), the root word first */
function wwFamilies(lex) {
  const by = new Map();
  for (const e of arr(lex)) { if (!e.root) continue; if (!by.has(e.root)) by.set(e.root, []); by.get(e.root).push(e); }
  for (const e of arr(lex)) if (by.has(e.word) && !by.get(e.word).includes(e)) by.get(e.word).unshift(e);
  for (const [r, l] of by) l.sort((a, b) => (a.word === r ? -1 : b.word === r ? 1 : String(a.word).localeCompare(String(b.word))));
  return by;
}
/** suggest families: words built on another word (talen on tal), and gendered pairs sharing a stem (kralo / krala) */
function wwFindFamilies(fm) {
  const lex = arr(fm.lexicon); const out = []; const cfg = wwGenderCfg(fm);
  const words = lex.map((e, i) => [String(e.word || '').toLowerCase(), i]).filter(([w]) => w.length >= 2);
  for (const [w, i] of words) {
    if (lex[i].root) continue;
    let best = null;
    for (const [b, j] of words) { if (j === i || b.length < 3 || b.length >= w.length) continue; const d = w.length - b.length; if (d > 5) continue; if ((w.startsWith(b) || w.endsWith(b)) && (!best || b.length > best.length)) best = b; }
    if (best) { out.push({ i, root: best }); continue; }
    const st = wwStem(w, cfg); if (st !== w && st.length >= 2 && words.some(([b, j]) => j !== i && wwStem(b, cfg) === st)) out.push({ i, root: st });
  }
  return out;
}
/** a new word from a root: with an affix, a class ending, or joined to another word */
function wwDerive(fm, base, how) {
  if (!base) return '';
  if (how.kind === 'affix') return wwApply(how.affix, base);
  if (how.kind === 'class') return wwMark(wwStem(base, wwGenderCfg(fm)), how.cls);
  if (how.kind === 'compound') return base + String(how.with || '').trim();
  return base;
}
/** the English meaning a derived word probably has */
function wwDeriveMeaning(meaning, how) {
  const m = wwFirstMeaning(meaning); if (!m) return '';
  if (how.kind === 'class') { const pair = WW_PAIRS.find(([a, b]) => a === m || b === m); const k = wwKind(how.cls); if (pair && (k === 'f' || k === 'm')) return k === 'f' ? pair[1] : pair[0]; return `${m} (${String(how.cls.name).toLowerCase()})`; }
  if (how.kind === 'compound') return `${m} ${how.withMeaning || ''}`.trim();
  const a = String((how.affix && how.affix.meaning) || '').toLowerCase();
  if (/plural/.test(a)) return /(s|x|ch|sh)$/.test(m) ? m + 'es' : /[^aeiou]y$/.test(m) ? m.slice(0, -1) + 'ies' : m + 's';
  if (/past/.test(a)) return /e$/.test(m) ? m + 'd' : m + 'ed';
  if (/future/.test(a)) return 'will ' + m;
  if (/not|negat/.test(a)) return 'not ' + m;
  if (/agent|one who/.test(a)) return /e$/.test(m) ? m + 'r' : m + 'er';
  if (/place/.test(a)) return 'place of ' + m;
  if (/small|dimin/.test(a)) return 'little ' + m;
  return `${m} (${a || 'derived'})`;
}

/* ---------- the Roots tab ---------- */
function renderRootsTab(f, fm, st, W) {
  const wrap = h('div', {}); const lex = arr(fm.lexicon); const ph = Object.assign({}, WW_PH, fm.phonology || {}); const cfg = wwGenderCfg(fm);
  const fams = wwFamilies(lex); const dl = h('datalist', { id: 'ww-words-dl' }, ...lex.map((e) => h('option', { value: e.word }, e.meaning || '')));
  st.derive = st.derive || { base: '', how: '', with: '', meaning: '' };
  const D = st.derive;
  // derive card
  const base = h('input', { type: 'text', list: 'ww-words-dl', value: D.base, placeholder: 'a word or stem, e.g. kral' });
  const opts = [...arr(fm.affixes).map((a, i) => [`aff:${i}`, `${a.affix} · ${a.meaning || a.type}`]), ...wwClasses(cfg).filter((c) => c.marker).map((c, i) => [`cls:${i}`, `${c.name} form (${c.type === 'prefix' ? c.marker + '-' : '-' + c.marker})`]), ['cmp', 'Joined with another word…']];
  if (!D.how && opts.length) D.how = opts[0][0];
  const how = h('select', { class: 'dropdown' }, ...opts.map(([v, l]) => h('option', { value: v, selected: D.how === v }, l)));
  const withIn = h('input', { type: 'text', list: 'ww-words-dl', value: D.with, placeholder: 'second word' });
  const meaning = h('input', { type: 'text', value: D.meaning, placeholder: 'English meaning' });
  const preview = h('div', { class: 'ww-derive-preview' });
  const howObj = () => { const v = D.how; if (v.startsWith('aff:')) return { kind: 'affix', affix: arr(fm.affixes)[+v.slice(4)] }; if (v.startsWith('cls:')) return { kind: 'class', cls: wwClasses(cfg).filter((c) => c.marker)[+v.slice(4)] };
    const we = lex.find((e) => e.word === D.with); return { kind: 'compound', with: D.with, withMeaning: we ? wwFirstMeaning(we.meaning) : '' }; };
  const upd = (fromMeaning) => {
    D.base = base.value.trim(); D.how = how.value; D.with = withIn.value.trim(); withIn.style.display = D.how === 'cmp' ? '' : 'none';
    const be = lex.find((e) => e.word === D.base); const w = wwDerive(fm, D.base, howObj());
    if (!fromMeaning && be) { D.meaning = wwDeriveMeaning(be.meaning, howObj()); meaning.value = D.meaning; } else D.meaning = meaning.value;
    preview.replaceChildren(w ? h('span', {}, h('b', { class: 'ww-w' }, w), h('span', { class: 'cs-hint' }, ` · ${pronounce(ph, w)}`)) : h('span', { class: 'cs-hint' }, 'Pick a word to build on.'));
  };
  base.addEventListener('input', () => upd(false)); how.addEventListener('change', () => upd(false)); withIn.addEventListener('input', () => upd(false)); meaning.addEventListener('input', () => upd(true));
  const add = h('button', { class: 'mod-cta', onclick: () => {
    const w = wwDerive(fm, D.base, howObj()); if (!w || !D.meaning) { toast('Pick a word and give the new one a meaning'); return; }
    if (lex.some((e) => e.word === w)) { toast(`“${w}” is already in the lexicon`); return; }
    const h0 = howObj(); const be = lex.find((e) => e.word === D.base); const root = be && be.root ? be.root : h0.kind === 'class' ? wwStem(D.base, cfg) : D.base;
    const entry = { word: w, pos: h0.kind === 'affix' && /agent|place|small|plural/i.test(String(h0.affix.meaning)) ? 'noun' : h0.kind === 'affix' && /past|future|not|negat/i.test(String(h0.affix.meaning)) ? 'verb' : (be && be.pos) || 'noun', meaning: D.meaning, root };
    if (h0.kind === 'class') entry.gender = h0.cls.short; else if (be && be.gender && entry.pos === 'noun') entry.gender = be.gender;
    W((x) => { x.lexicon = arr(x.lexicon); const bi = x.lexicon.findIndex((e) => e.word === D.base); if (bi >= 0 && !x.lexicon[bi].root) x.lexicon[bi].root = root; x.lexicon.push(entry); });
    toast(`Added ${w} = ${D.meaning}`); D.meaning = ''; } }, '+ Add to lexicon');
  ap(wrap, h('div', { class: 'cl-card' }, h('h4', {}, 'Build a word from a root'), dl,
    h('div', { class: 'cs-hint cs-mb' }, 'Most words in a real language grow from a few roots: sing → singer, song; king → queen. Pick a root, how to build on it, and check the meaning.'),
    h('div', { class: 'ww-derive' }, h('label', {}, 'Root', base), h('label', {}, 'Build with', how), h('label', {}, ' ', withIn), h('label', {}, 'Meaning', meaning)), preview, h('div', { class: 'cl-actions cs-mt' }, add)));
  setTimeout(() => upd(!!D.meaning), 0);
  // families
  const loose = lex.filter((e) => !e.root && !fams.has(e.word)).length;
  const find = h('button', { onclick: () => { const sug = wwFindFamilies(fm); if (!sug.length) { toast('No new word families found'); return; }
    confirm2(`Link ${sug.length} word${sug.length === 1 ? '' : 's'} to their roots?`, h('div', {}, h('p', {}, 'Words built on another word, or sharing a stem with a class ending, are grouped under that root. You can change any of them in the Lexicon.'),
      h('div', { class: 'ww-kept' }, ...sug.slice(0, 40).map((x) => h('span', { class: 'cs-chip is-plain' }, `${lex[x.i].word} ← ${x.root}`)))), () => W((y) => { for (const x of sug) if (y.lexicon[x.i] && !y.lexicon[x.i].root) y.lexicon[x.i].root = x.root; }), 'Link them'); } }, '🔍 Find word families');
  ap(wrap, h('div', { class: 'cl-tools cs-mt' }, find, h('span', { class: 'cs-hint' }, `${fams.size} famil${fams.size === 1 ? 'y' : 'ies'} · ${loose} word${loose === 1 ? '' : 's'} on their own`)));
  if (!fams.size) ap(wrap, empty('No word families yet. Build a word from a root above, find families in your lexicon, or set a word’s root in the Lexicon.'));
  const famCards = [...fams.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([r, list]) => h('div', { class: 'ww-fam' },
    h('div', { class: 'ww-fam-h' }, h('b', { class: 'ww-w' }, r), h('span', { class: 'cs-hint' }, ` ${pronounce(ph, r)}`), h('span', { class: 'cd-spacer' }), h('button', { class: 'ww-mini', onclick: () => { st.derive = { base: list[0].word, how: D.how, with: '', meaning: '' }; wkRerender(wrap); } }, '＋ derive')),
    ...list.map((e) => h('div', { class: 'ww-fam-row' + (e.word === r ? ' is-root' : '') }, h('b', {}, e.word), h('span', {}, ` ${e.meaning || ''}`), h('small', { class: 'cs-hint' }, ` ${[e.pos, e.gender ? (wwClassByShort(cfg, e.gender) || {}).name || e.gender : ''].filter(Boolean).join(', ')}`)))));
  if (famCards.length) ap(wrap, h('div', { class: 'ww-fams' }, ...famCards));
  return wrap;
}

/* ---------- the Noun classes card on the Grammar tab ---------- */
function renderClassesCard(f, fm, W) {
  const cfg = wwGenderCfg(fm); const cl = wwClasses(cfg); const g = fm.grammar || {}; const ph = Object.assign({}, WW_PH, fm.phonology || {});
  const setCfg = (fn) => W((x) => { const c = Object.assign({ classes: [], markNouns: true, agree: true }, x.genders || {}); c.classes = arr(c.classes).map((y) => Object.assign({}, y)); fn(c); x.genders = c; });
  const card = h('div', { class: 'cl-card cs-mt ww-classes' }, h('h4', {}, 'Noun classes (gender)'));
  if (!cl.length) {
    ap(card, h('div', { class: 'cs-hint cs-mb' }, 'Give nouns a gender or class (masculine, feminine, animate…). Each class can have its own ending, and describing words can change to match.'),
      h('div', { class: 'cl-gen' }, ...Object.keys(WW_CLASS_SETS).map((k) => h('button', { onclick: () => W((x) => { x.grammar = Object.assign({}, x.grammar || {}, { gender: k }); x.genders = { classes: wwDefaultClasses(k, ph), markNouns: true, agree: true }; }) }, k))));
    return card;
  }
  const lex = arr(fm.lexicon); const nouns = lex.filter((e) => e.pos === 'noun'); const unassigned = nouns.filter((e) => !e.gender).length;
  const rows = cl.map((c, i) => {
    const nm = h('input', { type: 'text', value: c.name }); nm.addEventListener('change', () => setCfg((x) => { x.classes[i].name = nm.value.trim() || c.name; }));
    const sh = h('input', { type: 'text', class: 'ww-short', value: c.short, title: 'Short label used in the lexicon and glosses' }); sh.addEventListener('change', () => setCfg((x) => { x.classes[i].short = sh.value.trim() || c.short; }));
    const mk = h('input', { type: 'text', class: 'ww-w', value: c.marker || '', placeholder: 'none' }); mk.addEventListener('change', () => setCfg((x) => { x.classes[i].marker = mk.value.trim().replace(/^-+|-+$/g, ''); }));
    const ty = h('select', {}, ...['suffix', 'prefix'].map((v) => h('option', { selected: (c.type || 'suffix') === v }, v))); ty.addEventListener('change', () => setCfg((x) => { x.classes[i].type = ty.value; }));
    const n = nouns.filter((e) => e.gender === c.short).length;
    return h('tr', {}, h('td', {}, nm), h('td', {}, sh), h('td', {}, mk), h('td', {}, ty), h('td', { class: 'cs-hint' }, `${n} noun${n === 1 ? '' : 's'}`), h('td', {}, h('span', { class: 'cs-x is-visible', title: 'Remove this class', onclick: () => setCfg((x) => { x.classes.splice(i, 1); }) }, '✕')));
  });
  const tog = (k, label) => { const c = h('input', { type: 'checkbox', checked: cfg[k] !== false }); c.addEventListener('change', () => setCfg((x) => { x[k] = c.checked; })); return h('label', { class: 'lh-check' }, c, label); };
  const sample = (() => { const adj = lex.find((e) => e.pos === 'adj'); const ns = cl.map((c) => nouns.find((e) => e.gender === c.short)).filter(Boolean); if (!adj || !ns.length || cfg.agree === false) return null;
    const after = /after/i.test(String(g.adjPos || ''));
    return h('div', { class: 'cs-hint cs-mt' }, 'For example: ', ...ns.map((n, i) => { const c = wwClassByShort(cfg, n.gender); const a = wwMark(adj.word, c); return h('span', {}, i ? ' · ' : '', h('b', { class: 'ww-w' }, after ? `${n.word} ${a}` : `${a} ${n.word}`), ` (${wwFirstMeaning(adj.meaning)} ${wwFirstMeaning(n.meaning)})`); })); })();
  ap(card, h('div', { class: 'cs-hint cs-mb' }, g.gender ? `${g.gender}. ` : '', 'Endings are added to the stem; a vowel ending replaces a final vowel (kralo → krala).'),
    h('table', { class: 'ww-ptable' }, h('thead', {}, h('tr', {}, h('th', {}, 'Class'), h('th', {}, 'Short'), h('th', {}, 'Ending'), h('th', {}, 'Where'), h('th', {}), h('th', {}))), h('tbody', {}, ...rows)),
    h('div', { class: 'cl-actions cs-mt' }, h('button', { onclick: () => setCfg((x) => { x.classes.push({ name: `Class ${x.classes.length + 1}`, short: String(x.classes.length + 1), marker: '', type: 'suffix' }); }) }, '+ Add class'),
      unassigned ? h('button', { class: 'mod-cta', onclick: () => W((x) => { const c = Object.assign({}, x.genders || {}); for (const e of arr(x.lexicon)) if (e.pos === 'noun' && !e.gender) { const k = wwClassFor(c, e.meaning); if (k) e.gender = k.short; } }) }, `Give ${unassigned} noun${unassigned === 1 ? '' : 's'} a class`) : null,
      h('button', { onclick: () => confirm2('Remove noun classes?', h('p', {}, 'The classes and each noun’s class are cleared. Words keep their spelling.'), () => W((x) => { delete x.genders; for (const e of arr(x.lexicon)) delete e.gender; x.grammar = Object.assign({}, x.grammar || {}, { gender: 'None' }); }), 'Remove') }, 'Remove classes')),
    tog('markNouns', 'New nouns end in their class ending'), tog('agree', 'Describing words take the ending of their noun'), sample,
    h('div', { class: 'cs-hint cs-mt' }, 'Women and men (queen, father…) get the feminine or masculine class, people and animals the animate one, and other nouns are spread across the classes. Pairs like king / queen share one root.'));
  return card;
}
