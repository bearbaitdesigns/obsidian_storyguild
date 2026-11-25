/* =====================================================================
   conlang (language notes)
   ===================================================================== */
const WORD_MARKS = /^['’ʼ-]$/;
/** Letters with their accents taken off, for searching and sorting (“á” finds “a”). */
const foldMarks = (x) => String(x || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
function genWord(ph, existing) {
  const sp = (x) => String(x || '').split(/\s+/).filter(Boolean);
  const C = sp(ph.consonants), V = sp(ph.vowels), Pt = sp(ph.patterns), F = sp(ph.forbidden);
  if (!C.length || !V.length || !Pt.length) return null;
  const mn = Math.max(1, +ph.minSyl || 1), mx = Math.max(mn, +ph.maxSyl || 2);
  for (let tries = 0; tries < 300; tries++) {
    const k = mn + Math.floor(Math.random() * (mx - mn + 1)); let w = '';
    for (let i = 0; i < k; i++) for (const ch of pick(Pt)) w += ch === 'C' ? pick(C) : ch === 'V' ? pick(V) : WORD_MARKS.test(ch) ? (ch === '-' ? '-' : '\'') : '';
    w = w.replace(/^['’ʼ-]+|['’ʼ-]+$/g, '').replace(/(['’ʼ-])['’ʼ-]+/g, '$1');
    if (!F.some((x) => w.includes(x)) && !existing.has(w)) return w;
  }
  return null;
}
function lookup(fm, word) {
  const lex = arr(fm.lexicon); const w = word.toLowerCase();
  const find = (x) => lex.find((e) => String(e.meaning || '').toLowerCase().split(/\s*[,;/]\s*/).includes(x));
  const first = (e) => String(e.meaning).split(',')[0].trim();
  let e = find(w); if (e) return { out: e.word, gloss: first(e) };
  const aff = (re) => arr(fm.affixes).find((a) => re.test(a.meaning || ''));
  const apply = (a, b) => (a.type === 'prefix' ? String(a.affix).replace(/-$/, '') + b : b + String(a.affix).replace(/^-/, ''));
  const pl = aff(/plural/i);
  if (pl && /s$/.test(w)) { const b = find(w.replace(/(es|s)$/, '')) || find(w.slice(0, -1)); if (b) return { out: apply(pl, b.word), gloss: first(b) + '-PL' }; }
  const pt = aff(/past/i);
  if (pt && /ed$/.test(w)) { const b = find(w.replace(/ed$/, '')) || find(w.replace(/d$/, '')); if (b) return { out: apply(pt, b.word), gloss: 'PST-' + first(b) }; }
  return null;
}
/* ---------- pronunciation: a respelling English readers can say ("tah-LAHS-sah") ---------- */
const SAY_DEFAULTS = {
  V: { a: ['ah', 'father'], e: ['eh', 'bed'], i: ['ee', 'see'], o: ['oh', 'go'], u: ['oo', 'moon'], y: ['ih', 'myth'], ae: ['eye', 'eye'], ai: ['eye', 'eye'], ei: ['ay', 'day'], ey: ['ay', 'day'],
    au: ['ow', 'cow'], ou: ['oo', 'soup'], oi: ['oy', 'boy'], ia: ['yah', 'yard'], ie: ['yeh', 'yes'], io: ['yoh', 'yoke'], iu: ['yoo', 'you'], ua: ['wah', 'water'],
    aa: ['aah', 'spa, held long'], ee: ['ay', 'day'], ii: ['eee', 'see, held long'], oo: ['oh', 'go, held long'], uu: ['ooo', 'moon, held long'],
    á: ['ah', 'father, stressed'], é: ['eh', 'bed, stressed'], í: ['ee', 'see, stressed'], ó: ['oh', 'go, stressed'], ú: ['oo', 'moon, stressed'], ý: ['ee', 'see, stressed'],
    à: ['ah', 'father'], è: ['eh', 'bed, open'], ì: ['ee', 'see'], ò: ['aw', 'law'], ù: ['oo', 'moon'],
    ā: ['aah', 'spa, held long'], ē: ['ehh', 'bed, held long'], ī: ['eee', 'see, held long'], ō: ['ohh', 'go, held long'], ū: ['ooo', 'moon, held long'], ȳ: ['eee', 'see, held long'],
    â: ['aah', 'spa, held long'], ê: ['ehh', 'bed, held long'], î: ['eee', 'see, held long'], ô: ['ohh', 'go, held long'], û: ['ooo', 'moon, held long'],
    ä: ['eh', 'bed'], ë: ['eh', 'bed, said on its own'], ï: ['ee', 'see, said on its own'], ö: ['ur', 'fur (German ö)'], ü: ['ew', 'few (French u)'], ÿ: ['ee', 'see'],
    å: ['aw', 'law'], æ: ['a', 'cat'], ø: ['ur', 'fur'], œ: ['ur', 'fur'], ã: ['ahn', 'a nasal ah'], õ: ['ohn', 'a nasal oh'] },
  C: { th: ['th', 'thin'], dh: ['th', 'this'], sh: ['sh', 'ship'], zh: ['zh', 'measure'], kh: ['kh', 'Scottish loch'], gh: ['gh', 'a throaty g, like a French r'], ch: ['ch', 'church'],
    ng: ['ng', 'sing'], ts: ['ts', 'cats'], tz: ['ts', 'cats'], qu: ['kw', 'queen'], q: ['k', 'a k made deep in the throat'], x: ['kh', 'Scottish loch'], c: ['k', 'cat'], j: ['j', 'jam'],
    y: ['y', 'yes'], w: ['w', 'wet'], r: ['r', 'a tapped r, as in Spanish pero'], g: ['g', 'go'], s: ['s', 'sun'], z: ['z', 'zoo'], h: ['h', 'hat'], f: ['f', 'fish'], v: ['v', 'van'],
    p: ['p', 'pin'], b: ['b', 'bat'], t: ['t', 'top'], d: ['d', 'dog'], k: ['k', 'kite'], l: ['l', 'lamp'], m: ['m', 'moon'], n: ['n', 'net'],
    ñ: ['ny', 'canyon'], ç: ['s', 'façade'], š: ['sh', 'ship'], ž: ['zh', 'measure'], č: ['ch', 'church'], ć: ['ch', 'church'], ś: ['sh', 'ship'], ź: ['zh', 'measure'], ğ: ['gh', 'a throaty g'],
    ř: ['rzh', 'a rolled r and zh together'], ð: ['th', 'this'], þ: ['th', 'thin'], ł: ['w', 'wet'], ŋ: ['ng', 'sing'], ħ: ['h', 'a breathy h from the throat'], ʃ: ['sh', 'ship'], ʒ: ['zh', 'measure'],
    "'": ['’', 'a catch in the voice, as in uh-oh'] },
};
const STRESS = [['penult', 'Second-to-last syllable'], ['first', 'First syllable'], ['last', 'Last syllable'], ['none', 'Even (no stress)']];
function sayInventory(ph) {
  const sp = (x) => String(x || '').toLowerCase().split(/\s+/).filter(Boolean);
  return { C: sp(ph.consonants), V: sp(ph.vowels) };
}
/** How one sound is respelled and what it sounds like: the note's own key first, then the defaults. */
function soundSay(ph, sound, kind) {
  const own = (ph.say || {})[sound]; const d = (SAY_DEFAULTS[kind] || {})[sound] || (SAY_DEFAULTS[kind === 'V' ? 'C' : 'V'] || {})[sound];
  return { say: own != null && own !== '' ? String(own) : d ? d[0] : sound, hint: d ? d[1] : '' };
}
const isApos = (c) => /['’ʼʔ]/.test(c);
/** Split one part of a word into sounds, longest match first. Apostrophes are a catch in the voice that starts a new syllable. */
function sayTokens(ph, w) {
  const inv = sayInventory(ph); const known = [...inv.V.map((x) => [x, 'V']), ...inv.C.map((x) => [x, 'C'])].filter(([x]) => !isApos(x)).sort((a, b) => b[0].length - a[0].length);
  const toks = [];
  for (let i = 0; i < w.length;) {
    const c = w[i];
    if (/\s/.test(c)) { i++; continue; }
    if (isApos(c)) { toks.push({ s: "'", k: 'C', g: true }); i++; continue; }
    const hit = known.find(([x]) => w.startsWith(x, i));
    if (hit) { toks.push({ s: hit[0], k: hit[1] }); i += hit[0].length; continue; }
    const two = w.slice(i, i + 2); const dv = two.length === 2 && SAY_DEFAULTS.V[two] && !inv.C.includes(two) ? 'V' : two.length === 2 && SAY_DEFAULTS.C[two] ? 'C' : null;
    if (dv) { toks.push({ s: two, k: dv }); i += 2; continue; }
    const base = c.normalize('NFD')[0];
    toks.push({ s: c, k: /[aeiouyæøåœ]/.test(base) && !inv.C.includes(c) ? 'V' : 'C' }); i++;
  }
  return toks;
}
/** How a sound is said: the note's own key, then the defaults, then (for an accented letter) its plain letter. */
function tokSay(ph, t) {
  const d = soundSay(ph, t.s, t.k); if (d.say !== t.s || SAY_DEFAULTS[t.k][t.s] || SAY_DEFAULTS.C[t.s]) return d.say;
  const base = t.s.normalize('NFD').replace(/\p{M}/gu, ''); return base && base !== t.s ? soundSay(ph, base, t.k).say : d.say;
}
/** A respelling English readers can say: syllables joined by hyphens, the stressed one in capitals, parts of a hyphenated word joined by “·”. */
function pronounce(ph, word) {
  const w = String(word || '').normalize('NFC').toLowerCase().trim(); if (!w) return '';
  const parts = w.split(/\s*-+\s*/).filter(Boolean); if (parts.length > 1) return parts.map((x) => pronounce(ph, x)).join(' · ');
  const toks = sayTokens(ph, w);
  const vi = toks.map((t, i) => (t.k === 'V' ? i : -1)).filter((i) => i >= 0);
  if (!vi.length) return toks.map((t) => tokSay(ph, t)).join('');
  const starts = vi.map((v, n) => { if (n === 0) return 0; let a = v; if (toks[v - 1] && toks[v - 1].k === 'C' && v - 1 > vi[n - 1]) a = v - 1; if (toks[a - 1] && toks[a - 1].g && a - 1 > vi[n - 1]) a -= 1; for (let j = vi[n - 1] + 1; j < a; j++) if (toks[j].g) { a = j; break; } return a; });
  const ranges = starts.map((a, n) => [a, n + 1 < starts.length ? starts[n + 1] : toks.length]);
  const syl = ranges.map(([a, z]) => toks.slice(a, z).map((t) => tokSay(ph, t)).join(''));
  const accented = ranges.findIndex(([a, z]) => toks.slice(a, z).some((t) => t.k === 'V' && /́/.test(t.s.normalize('NFD'))));
  const rule = ph.stress || 'penult';
  const at = syl.length < 2 || rule === 'none' ? -1 : accented >= 0 ? accented : rule === 'first' ? 0 : rule === 'last' ? syl.length - 1 : syl.length - 2;
  return syl.map((x, n) => (n === at ? x.toUpperCase() : x)).join('-');
}
/* special letters: accents, apostrophes and hyphens are hard to type, on phones above all */
const CHAR_SETS = [['Accents', 'á é í ó ú à è ì ò ù â ê î ô û'], ['Long & umlaut', 'ā ē ī ō ū ä ë ï ö ü å æ ø œ'], ['Consonants', 'ñ ç š ž č ð þ ł ŋ ř ʃ'], ['Marks', "' ʼ -"]];
function charPalette(scope, st) {
  let last = null; scope.addEventListener('focusin', (e) => { const t = e.target; if (t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && /^(text|search|)$/.test(t.type || '')))) last = t; });
  const keep = (e) => e.preventDefault();
  const put = (ch) => { const t = last && last.isConnected ? last : scope.querySelector('input[type=text], input:not([type])'); if (!t) return; const a = t.selectionStart ?? t.value.length, z = t.selectionEnd ?? a; t.setRangeText(ch, a, z, 'end'); t.focus(); t.dispatchEvent(new Event('input', { bubbles: true }));
    // typed-in text saves when the box loses focus; inserted letters need the same nudge
    if (!t.__sgDirty) { t.__sgDirty = true; t.addEventListener('blur', () => { t.__sgDirty = false; t.dispatchEvent(new Event('change', { bubbles: true })); }, { once: true }); } };
  const box = h('div', { class: 'cl-chars' + (st.chars ? ' is-open' : '') });
  const toggle = h('button', { class: 'cl-chars-toggle', onmousedown: keep, onclick: () => { st.chars = !st.chars; box.classList.toggle('is-open', st.chars); } }, 'áʼ Special letters');
  ap(box, toggle, h('div', { class: 'cl-chars-sets' }, ...CHAR_SETS.map(([label, set]) => h('div', { class: 'cl-chars-row' }, h('span', { class: 'cs-hint' }, label),
    ...set.split(' ').map((ch) => { const b = h('button', { class: 'cl-char', title: ch === "'" ? 'Apostrophe: a catch in the voice (ka’el)' : ch === 'ʼ' ? 'Glottal stop' : ch === '-' ? 'Hyphen: joins the parts of a compound word' : 'Insert ' + ch, onclick: () => put(ch) }, ch); b.addEventListener('mousedown', keep); b.addEventListener('pointerdown', keep); return b; }))),
    h('div', { class: 'cs-hint' }, 'Tap a box above, then a letter to insert it. An acute accent (á) marks the stressed syllable; an apostrophe is a catch in the voice; a hyphen joins the parts of a compound word.')));
  return box;
}
const sayOf = (ph, e) => (e && e.say ? String(e.say) : pronounce(ph, e && e.word));
function speakSay(text) {
  try { if (!window.speechSynthesis || !text) return false; const u = new SpeechSynthesisUtterance(String(text).replace(/-/g, ' ').toLowerCase()); u.rate = 0.8; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); return true; } catch (e) { return false; }
}
const canSpeak = () => { try { return !!window.speechSynthesis; } catch (e) { return false; } };
const POS_PLURAL = { noun: 'Nouns', verb: 'Verbs', adj: 'Adjectives', adv: 'Adverbs', pron: 'Pronouns', prep: 'Prepositions', conj: 'Conjunctions', particle: 'Particles', num: 'Numbers' };

function renderConlang(f, fm) {
  const s = ST(); const st = P.mem(f.path, 'conlang', { tab: 'phon', gen: [], q: '', input: 'I walk to the deep sea and remember home', skip: true });
  const ph = Object.assign({ consonants: '', vowels: '', patterns: 'CV CVC', forbidden: '', minSyl: 1, maxSyl: 2 }, fm.phonology || {});
  const lex = arr(fm.lexicon), affixes = arr(fm.affixes);
  const existing = new Set(lex.map((e) => e.word));
  const W = (fn) => S.write(f, (x) => { x.phonology = Object.assign({}, ph, x.phonology || {}); x.lexicon = arr(x.lexicon); x.affixes = arr(x.affixes); fn(x); });
  let wrapRef = null; const rerender = () => wkRerender(wrapRef);
  const wrap = h('div', {}); wrapRef = wrap;
  const sp = (x) => String(x || '').split(/\s+/).filter(Boolean);
  ap(wrap, h('div', { class: 'cs-stat-row' },
    h('div', { class: 'cs-stat' }, h('b', {}, String(lex.length)), h('span', {}, 'Words')),
    h('div', { class: 'cs-stat' }, h('b', {}, String(sp(ph.consonants).length + sp(ph.vowels).length)), h('span', {}, 'Phonemes')),
    h('div', { class: 'cs-stat' }, h('b', {}, String(affixes.length)), h('span', {}, 'Affixes')),
    h('div', { class: 'cs-stat' }, h('b', {}, fm.wordOrder || '—'), h('span', {}, 'Word order')),
    h('div', { class: 'cs-stat' }, h('b', {}, fm.morphology || '—'), h('span', {}, 'Morphology'))));
  const sub = [['phon', '🔊 Sounds & generator'], ['lex', '📖 Lexicon'], ['gram', '🧩 Grammar'], ['tr', '🔁 Translator']];
  if (!lex.length && !(ph.consonants && ph.vowels)) ap(wrap, h('div', { class: 'cv-callout lh-intro' }, h('div', {}, h('b', {}, 'Building a language from scratch?'), h('div', { class: 'cs-hint' }, 'The language helper walks you through it: how it sounds, its grammar, a starter vocabulary and word endings. Optional; nothing is saved until the last step.')),
    h('button', { class: 'mod-cta', onclick: () => openLanguageHelper(f) }, '🧭 Start the helper')));
  ap(wrap, h('div', { class: 'cs-subnav' }, ...sub.map(([k, l]) => h('button', { class: st.tab === k ? 'is-on' : '', onclick: () => { st.tab = k; rerender(); } }, l)),
    h('button', { class: 'lh-open', title: 'Step-by-step guide to building this language', onclick: () => openLanguageHelper(f) }, '🧭 Language helper')));
  const addWord = (word, meaning = '', pos = 'noun') => W((x) => { x.lexicon.push({ word, pos, meaning }); });

  if (st.tab === 'phon' || st.tab === 'lex') ap(wrap, charPalette(wrap, st));
  if (st.tab === 'phon') {
    const fld = (k, label, hint) => { const i = h('input', { type: 'text', value: ph[k] ?? '' }); i.addEventListener('change', () => W((x) => { x.phonology[k] = i.value.trim(); })); return h('div', { class: 'cl-row' }, h('label', {}, label + (hint ? ' — ' + hint : '')), i); };
    const chips = (v) => h('div', { class: 'cl-phon' }, ...sp(v).map((x) => h('span', {}, x)));
    const regen = () => { st.gen = []; const ex = new Set(existing); for (let i = 0; i < 14; i++) { const w = genWord(ph, ex); if (w) { st.gen.push(w); ex.add(w); } } rerender(); };
    if (!st.gen.length && ph.consonants && ph.vowels) { const ex = new Set(existing); for (let i = 0; i < 14; i++) { const w = genWord(ph, ex); if (w) { st.gen.push(w); ex.add(w); } } }
    const num = (k) => { const i = h('input', { type: 'number', min: 1, max: 6, value: ph[k], class: 'cl-num' }); i.addEventListener('change', () => W((x) => { x.phonology[k] = +i.value; })); return i; };
    ap(wrap, h('div', { class: 'cl-grid' },
      h('div', { class: 'cl-card' }, h('h4', {}, 'Phonology'), fld('consonants', 'Consonants', 'space-separated'), chips(ph.consonants), fld('vowels', 'Vowels'), chips(ph.vowels),
        fld('patterns', 'Syllable shapes', "C = consonant, V = vowel; ' and - are kept as written"), fld('forbidden', 'Forbidden sequences', 'never generated'),
        h('div', { class: 'cl-row cl-inline' }, h('label', {}, 'Syllables'), num('minSyl'), h('span', {}, 'to'), num('maxSyl'))),
      h('div', { class: 'cl-card' }, h('h4', {}, 'Word generator'), h('div', { class: 'cs-hint' }, ph.consonants && ph.vowels ? 'Words built from your sounds and syllable shapes. Click one to add it to the lexicon.' : 'Add consonants and vowels to start generating words.'),
        h('div', { class: 'cl-gen' }, ...st.gen.map((w) => h('button', { title: 'Add to lexicon', onclick: () => prompt2(`Meaning of “${w}”`, 'e.g. river, to swim…', (m) => { st.gen = st.gen.filter((x) => x !== w); addWord(w, m); toast(`Added “${w}” = ${m}`); }) }, w))),
        h('div', { class: 'cl-actions' }, h('button', { class: 'mod-cta', onclick: regen }, '🎲 Generate'), h('button', { onclick: () => { const w = genWord(ph, existing); if (w) prompt2(`Meaning of “${w}”`, 'meaning…', (m) => addWord(w, m)); } }, '+ One word')))));
    const inv = sayInventory(ph);
    const extraSounds = []; { const seen = new Set([...inv.C, ...inv.V].filter((x) => !isApos(x))); const words = [...lex.map((e) => e.word), ...(/['’ʼ]/.test(ph.patterns || '') || inv.C.some(isApos) ? ["'"] : [])];
      for (const w of words) for (const part of String(w || '').normalize('NFC').toLowerCase().split('-')) for (const t of sayTokens(ph, part)) if (!seen.has(t.s)) { seen.add(t.s); extraSounds.push([t.s, t.k]); } }
    if (inv.C.length || inv.V.length) {
      const keyRow = (sound, kind) => { const d = soundSay(Object.assign({}, ph, { say: {} }), sound, kind); const cur = (ph.say || {})[sound] || '';
        const i = h('input', { type: 'text', class: 'cl-say', value: cur, placeholder: d.say, 'aria-label': `Say ${sound} as` });
        i.addEventListener('change', () => W((x) => { const say = Object.assign({}, x.phonology.say || {}); const v = i.value.trim(); if (v && v !== d.say) say[sound] = v; else delete say[sound]; x.phonology.say = say; }));
        return h('div', { class: 'cl-keyrow' }, h('b', {}, sound), i, h('small', {}, cur ? 'your spelling' : d.hint ? (/^(a|an) /.test(d.hint) ? d.hint : 'as in ' + d.hint) : '')); };
      const stressSel = h('select', { class: 'dropdown' }, ...STRESS.map(([v, l]) => h('option', { value: v, selected: (ph.stress || 'penult') === v }, l)));
      stressSel.addEventListener('change', () => W((x) => { x.phonology.stress = stressSel.value; }));
      const ex = (lex.length ? lex.slice(0, 4).map((e) => e.word) : st.gen.slice(0, 4)).filter(Boolean);
      ap(wrap, h('div', { class: 'cl-card cs-mt cl-saykey' }, h('h4', {}, 'Pronunciation key'),
        h('div', { class: 'cs-hint cs-mb' }, 'How each sound is spelled out for English readers. Change any of them; every word in the lexicon follows unless you set its pronunciation by hand.'),
        h('div', { class: 'cl-keygrid' }, ...inv.V.map((x) => keyRow(x, 'V')), ...inv.C.filter((x) => !isApos(x)).map((x) => keyRow(x, 'C')), ...extraSounds.map(([x, k]) => keyRow(x, k))),
        extraSounds.length ? h('div', { class: 'cs-hint cs-mt' }, `Also in your words: ${extraSounds.map(([x]) => x).join(' ')}`) : null,
        h('div', { class: 'cl-row cl-inline cs-mt' }, h('label', {}, 'Stress falls on the'), stressSel),
        ex.length ? h('div', { class: 'cl-sayex' }, ...ex.map((w) => h('span', {}, h('b', {}, w), ' → ', pronounce(ph, w)))) : null));
    }
  } else if (st.tab === 'lex') {
    const search = h('input', { type: 'search', placeholder: 'Search word, meaning or sound…', value: st.q });
    const groupsEl = h('div', { class: 'cl-lexgroups' });
    search.addEventListener('input', () => { st.q = search.value; groupsEl.replaceChildren(...build()); });
    ap(wrap, h('div', { class: 'cl-tools' }, search,
      h('button', { onclick: () => addWord(genWord(ph, existing) || '', '') }, '+ Add word'),
      h('button', { onclick: () => { const md = '| Word | Say it | Type | Meaning |\n|---|---|---|---|\n' + sorted(lex.map((e, i) => [e, i])).map(([e]) => `| ${e.word} | ${sayOf(ph, e)} | ${e.pos} | ${e.meaning} |`).join('\n'); navigator.clipboard.writeText(md).then(() => toast('Lexicon copied as a Markdown table')); } }, '⧉ Copy as table')));
    function sorted(rows) { return rows.slice().sort((x, y) => String(x[0].word).localeCompare(String(y[0].word), undefined, { sensitivity: 'base' })); }
    function build() {
      const qq = foldMarks(st.q).trim();
      const rows = lex.map((e, i) => [e, i]).filter(([e]) => !qq || foldMarks(e.word).includes(qq) || foldMarks(e.meaning).includes(qq) || foldMarks(sayOf(ph, e)).includes(qq));
      if (!rows.length) return [empty(lex.length ? 'No words match.' : 'No words yet. Generate some on the Sounds tab, or use the 🧭 Language helper.')];
      const order = [...s.posList, ...new Set(rows.map(([e]) => e.pos || '').filter((p) => p && !s.posList.includes(p)))];
      const by = new Map(); for (const r of rows) { const k = order.includes(r[0].pos) ? r[0].pos : ''; if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
      return [...order, ''].filter((k) => by.has(k)).map((k) => {
        const list = sorted(by.get(k));
        const trs = list.map(([e, i]) => {
          const wi = h('input', { class: 'w', value: e.word || '', 'aria-label': 'Word' }); wi.addEventListener('change', () => W((x) => { x.lexicon[i].word = wi.value.trim(); }));
          const auto = pronounce(ph, e.word);
          const si = h('input', { class: 'cl-say', value: e.say || '', placeholder: auto, title: 'How to say it. Leave empty to use the pronunciation key on the Sounds tab.', 'aria-label': 'Pronunciation' });
          si.addEventListener('change', () => W((x) => { const v = si.value.trim(); if (v && v !== auto) x.lexicon[i].say = v; else delete x.lexicon[i].say; }));
          const hear = canSpeak() ? h('button', { class: 'cl-hear', title: 'Hear an approximation (your device voice)', onclick: () => speakSay(si.value.trim() || auto) }, '🔊') : null;
          const ps = h('select', { 'aria-label': 'Type' }, e.pos ? null : h('option', { value: '', selected: true }, '—'), ...[...new Set([...s.posList, e.pos].filter(Boolean))].map((p) => h('option', { value: p, selected: p === e.pos }, p))); ps.addEventListener('change', () => W((x) => { x.lexicon[i].pos = ps.value; }));
          const mi = h('input', { value: e.meaning || '', placeholder: 'meaning (comma-separate synonyms)', 'aria-label': 'Meaning' }); mi.addEventListener('change', () => W((x) => { x.lexicon[i].meaning = mi.value; }));
          return h('tr', {}, h('td', {}, wi), h('td', { class: 'cl-saycell' }, si, hear), h('td', {}, mi), h('td', {}, ps), h('td', {}, h('span', { class: 'cs-x is-visible', title: 'Delete', onclick: () => W((x) => { x.lexicon.splice(i, 1); }) }, '✕')));
        });
        return h('section', { class: 'cl-lexgroup' }, groupTitle(k ? POS_PLURAL[k] || k[0].toUpperCase() + k.slice(1) : 'No type yet', list.length),
          h('table', { class: 'cl-table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Word'), h('th', {}, 'Say it'), h('th', {}, 'Meaning'), h('th', {}, 'Type'), h('th', {}))), h('tbody', {}, ...trs)));
      });
    }
    groupsEl.replaceChildren(...build());
    ap(wrap, groupsEl);
    if (lex.length) ap(wrap, h('div', { class: 'cs-hint cs-mt' }, 'Grey pronunciations come from the pronunciation key on the Sounds tab; type over one to set it for that word only. Capitals mark the stressed syllable.'));
  } else if (st.tab === 'gram') {
    const typ = h('div', { class: 'cl-card' }, h('h4', {}, 'Typology'), h('div', { class: 'cs-hint cs-mb' }, 'Same fields as the tiles above.'));
    for (const k of ['wordOrder', 'morphology', 'script']) {
      const d = T().language.domain.find((x) => x.key === k); if (!d) continue;
      const sel = h('select', { class: 'dropdown' }, h('option', { value: '' }, '—'), ...d.values.map((v) => h('option', { selected: fm[k] === v }, v)));
      sel.addEventListener('change', () => S.write(f, (x) => { x[k] = sel.value || null; }));
      ap(typ, h('div', { class: 'cl-row' }, h('label', {}, d.label), sel));
    }
    const at = h('table', { class: 'cl-table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Affix'), h('th', {}, 'Type'), h('th', {}, 'Meaning'), h('th', {}))));
    affixes.forEach((a, i) => {
      const ai = h('input', { class: 'w', value: a.affix || '' }); ai.addEventListener('change', () => W((x) => { x.affixes[i].affix = ai.value; }));
      const ty = h('select', {}, ...['prefix', 'suffix', 'infix', 'circumfix'].map((v) => h('option', { selected: a.type === v }, v))); ty.addEventListener('change', () => W((x) => { x.affixes[i].type = ty.value; }));
      const mi = h('input', { value: a.meaning || '' }); mi.addEventListener('change', () => W((x) => { x.affixes[i].meaning = mi.value; }));
      ap(at, h('tr', {}, h('td', {}, ai), h('td', {}, ty), h('td', {}, mi), h('td', {}, h('span', { class: 'cs-x is-visible', onclick: () => W((x) => { x.affixes.splice(i, 1); }) }, '✕'))));
    });
    ap(wrap, h('div', { class: 'cl-grid' }, typ, h('div', { class: 'cl-card' }, h('h4', {}, 'Affixes'), at,
      h('button', { class: 'cs-mt', onclick: () => W((x) => { x.affixes.push({ affix: '-', type: 'suffix', meaning: '' }); }) }, '+ Add affix'),
      h('div', { class: 'cs-hint cs-mt' }, 'The translator uses affixes whose meaning includes “plural” or “past”.'))));
  } else {
    const toks = st.input.match(/[A-Za-z']+|[^A-Za-z']+/g) || []; const SKIP = ['the', 'a', 'an'];
    const out = h('div', { class: 'cl-out' }); const unknown = []; const sayLine = [];
    for (const tk of toks) {
      if (!/[A-Za-z]/.test(tk)) continue; if (st.skip && SKIP.includes(tk.toLowerCase())) continue;
      const r = lookup(fm, tk);
      if (r) { ap(out, h('span', { class: 'cl-tok' }, h('b', {}, r.out), h('small', {}, r.gloss))); const e = lex.find((x) => x.word === r.out); sayLine.push(e ? sayOf(ph, e) : pronounce(ph, r.out)); }
      else { unknown.push(tk.toLowerCase()); ap(out, h('span', { class: 'cl-tok is-unk', title: 'Not in the lexicon. Click to coin a word.' }, h('b', { onclick: () => { const w = genWord(ph, existing); if (w) { addWord(w, tk.toLowerCase()); toast(`Coined “${w}” = ${tk.toLowerCase()}`); } else toast('Set up consonants, vowels and syllable shapes first'); } }, tk), h('small', {}, '?'))); }
    }
    const ta = h('textarea', { class: 'cl-in' }, st.input); ta.addEventListener('input', () => { st.input = ta.value; });
    const skip = h('input', { type: 'checkbox', checked: st.skip }); skip.addEventListener('change', () => { st.skip = skip.checked; rerender(); });
    const uniq = [...new Set(unknown)];
    ap(wrap, h('div', { class: 'cl-card' }, h('h4', {}, 'English'), ta,
      h('div', { class: 'cl-actions' }, h('button', { class: 'mod-cta', onclick: rerender }, 'Translate'), h('label', { class: 'cs-hint cl-inline' }, skip, 'Drop articles (the, a, an)'),
        uniq.length ? h('button', { onclick: () => W((x) => { const ex = new Set(x.lexicon.map((e) => e.word)); for (const u of uniq) { const w = genWord(ph, ex); if (w) { ex.add(w); x.lexicon.push({ word: w, pos: 'noun', meaning: u }); } } toast(`Coined ${uniq.length} words. Check their part of speech in the lexicon`); }) }, `🎲 Coin ${uniq.length} missing`) : null)),
      h('div', { class: 'cl-card cs-mt' }, h('h4', {}, `${f.basename} · word-by-word gloss`), out, sayLine.length ? h('div', { class: 'cl-sayline' }, h('span', { class: 'cs-hint' }, 'Say it: '), sayLine.join(' '), canSpeak() ? h('button', { class: 'cl-hear', title: 'Hear an approximation', onclick: () => speakSay(sayLine.join(' ')) }, '🔊') : null) : null, h('div', { class: 'cs-hint cs-mt' }, `Glossed in the original order. Rearrange for ${fm.wordOrder || 'your'} word order when writing.`)));
  }
  return wrap;
}

/* =====================================================================
   magic: rules & limits, magic list
   ===================================================================== */
function renderRules(f, fm) {
  const s = ST(); const rules = arr(fm.rules); const hard = fm.hardness ?? 50;
  const label = (v) => (v < 25 ? 'Soft · mysterious' : v < 50 ? 'Mostly soft' : v < 75 ? 'Mostly hard' : 'Hard · rule-bound');
  const W = (fn) => S.write(f, (x) => { x.rules = arr(x.rules); fn(x); });
  const out = h('b', {}, label(hard));
  const range = h('input', { type: 'range', min: 0, max: 100, value: hard });
  range.addEventListener('input', () => { out.textContent = label(+range.value); });
  range.addEventListener('change', () => S.write(f, (x) => { x.hardness = +range.value; }));
  const wrap = h('div', {}, h('div', { class: 'mg-hard' }, h('span', { class: 'cs-hint' }, 'Soft'), range, h('span', { class: 'cs-hint' }, 'Hard'), out));
  ap(wrap, h('div', { class: 'mg-cols', style: { 'grid-template-columns': `repeat(${Math.max(1, s.ruleKinds.length)}, minmax(0,1fr))` } }, ...s.ruleKinds.map((K) => h('div', { class: 'mg-col' },
    h('h4', { style: { color: K.c } }, `${K.i} ${K.k}s`, h('span', { class: 'cs-tab-count' }, String(rules.filter((r) => r.kind === K.k).length))),
    ...rules.map((r, i) => [r, i]).filter(([r]) => r.kind === K.k).map(([r, i]) => {
      const ti = h('input', { value: r.title || '', placeholder: 'Title' }); ti.addEventListener('change', () => W((x) => { x.rules[i].title = ti.value; }));
      const tx = h('textarea', { placeholder: 'Describe it…' }, r.text || ''); tx.addEventListener('change', () => W((x) => { x.rules[i].text = tx.value; }));
      return h('div', { class: 'mg-rule', style: { '--k': K.c } }, ti, tx, h('span', { class: 'cs-x', title: 'Delete', onclick: () => W((x) => { x.rules.splice(i, 1); }) }, '✕'));
    }),
    h('button', { class: 'mg-add', onclick: () => W((x) => { x.rules.push({ kind: K.k, title: '', text: '' }); }) }, '+ Add ' + K.k.toLowerCase())))));
  return wrap;
}
function renderSpellbook(f, fm) {
  const spells = arr(fm.spells); const st = P.mem(f.path, 'spells', { q: '' });
  const prac = S.notesOf('character').filter((c) => S.has(c, 'magic', f));
  const W = (fn) => S.write(f, (x) => { x.spells = arr(x.spells); fn(x); });
  const search = h('input', { type: 'search', placeholder: 'Search the magic list…', value: st.q });
  const tbody = h('tbody', {});
  const build = () => {
    const q = st.q.toLowerCase();
    tbody.replaceChildren(...spells.map((sp, i) => [sp, i]).filter(([sp]) => !q || [sp.name, sp.cost, sp.effect, ...names(sp.knownBy).map(display)].join(' ').toLowerCase().includes(q)).map(([sp, i]) => {
      const inp = (k, ph, bold) => { const e = h('input', { value: sp[k] || '', placeholder: ph, class: bold ? 'is-bold' : '' }); e.addEventListener('change', () => W((x) => { x.spells[i][k] = e.value; })); return e; };
      const known = h('div', { class: 'cs-tile-body' }, ...names(sp.knownBy).map((n, j) => chip(n, f.path, { onX: () => W((x) => { x.spells[i].knownBy = arr(x.spells[i].knownBy).filter((_, k) => k !== j); }) })),
        h('button', { class: 'cs-add', onclick: () => {
          const all = S.notesOf('character').filter((c) => S.fm(c).role !== 'Deity'); const order = [...prac, ...all.filter((c) => !prac.includes(c))];
          const sel = names(sp.knownBy).map((n) => S.resolve(n, f.path)?.path).filter(Boolean); let next = sel;
          suggest({ items: order.map((c) => ({ label: c.basename, sub: prac.includes(c) ? 'practitioner' : '', value: c.path })), selected: sel, toggle: true, source: 'Characters', placeholder: 'Who knows it? (esc when done)', onPick: (v) => { next = v; } });
          const obs = new MutationObserver(() => { if (!document.querySelector('.wk-modal-bg')) { obs.disconnect(); W((x) => { x.spells[i].knownBy = next.map((p) => S.link(app().vault.getAbstractFileByPath(p), f.path)); }); } });
          obs.observe(document.body, { childList: true });
        } }, '+'));
      return h('tr', {}, h('td', {}, inp('name', 'Name', true)), h('td', {}, inp('cost', 'Cost')), h('td', {}, inp('effect', 'Effect')), h('td', {}, known), h('td', {}, h('span', { class: 'cs-x is-visible', onclick: () => W((x) => { x.spells.splice(i, 1); }) }, '✕')));
    }));
  };
  search.addEventListener('input', () => { st.q = search.value; build(); });
  build();
  return h('div', {}, h('div', { class: 'cl-tools' }, search, h('span', { class: 'cs-hint' }, `${spells.length} entries · ${prac.length} practitioners`),
    h('button', { class: 'mod-cta', onclick: () => W((x) => { x.spells.push({ name: '', cost: '', effect: '', knownBy: [] }); }) }, '+ Add to magic list')),
  h('table', { class: 'cl-table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Cost'), h('th', {}, 'Effect'), h('th', {}, 'Known by'), h('th', {}))), tbody),
  spells.length ? null : empty('No entries yet. Add spells, rituals, techniques or abilities.'));
}

/* =====================================================================
   pantheon: gods & worship
   ===================================================================== */
function renderGods(f, fm) {
  const s = ST(); const gods = arr(fm.gods); const W = (fn) => S.write(f, (x) => { x.gods = arr(x.gods); fn(x); });
  const heads = S.linkFiles(f, 'head').map((x) => x.path);
  const g = h('div', { class: 'pn-grid' });
  gods.forEach((gd, i) => {
    const nm = linkName(gd.name); const c = S.resolve(nm, f.path); const cfm = c ? S.fm(c) : {}; const im = c && S.imageSrc(cfm[s.imageKey], c.path);
    const rank = h('select', { class: 'dropdown cs-rel-select' }, ...s.divineRanks.map((r) => h('option', { selected: gd.rank === r }, r))); rank.addEventListener('change', () => W((x) => { x.gods[i].rank = rank.value; }));
    const sym = h('input', { type: 'text', value: gd.symbol || '', placeholder: 'Holy symbol' }); sym.addEventListener('change', () => W((x) => { x.gods[i].symbol = sym.value; }));
    const nameEl = h('a', { class: 'pn-name wk-link' }, display(nm)); nameEl.addEventListener('click', (e) => (c ? openFile(c, e) : openName(nm, f.path, e)));
    const magics = c ? S.notesOf('magic').filter((m) => S.has(m, 'patron', c)).map((m) => '✨ ' + m.basename).join('  ') : '';
    ap(g, h('div', { class: 'pn-god' },
      h('div', { class: 'pn-top' }, h('div', { class: 'cs-card-thumb is-round', style: im ? { 'background-image': `url("${im}")` } : { '--cd-hue': String(hashHue(nm)) } }, im ? '' : initials(display(nm))),
        h('div', { class: 'cs-card-text' }, nameEl, arr(cfm.alias)[0] ? h('div', { class: 'cs-card-sub' }, String(arr(cfm.alias)[0])) : null), rank, c && heads.includes(c.path) ? h('span', { class: 'cs-badge cs-badge-sm' }, 'Head') : null,
        h('span', { class: 'cs-x', title: 'Remove from pantheon', onclick: () => W((x) => { x.gods.splice(i, 1); }) }, '✕')),
      h('div', { class: 'pn-row' }, h('span', { class: 'cs-tile-label' }, 'Domains'), h('div', { class: 'cs-tile-body' }, ...arr(gd.domains).map((d, j) => h('span', { class: 'cs-chip is-plain' }, String(d), h('span', { class: 'cs-x', onclick: () => W((x) => { x.gods[i].domains.splice(j, 1); }) }, '✕'))),
        h('button', { class: 'cs-add', onclick: () => prompt2(`Add a domain for ${display(nm)}`, 'e.g. Sea, Memory, War…', (v) => W((x) => { (x.gods[i].domains ??= []).push(v); })) }, '+'))),
      h('div', { class: 'pn-row' }, h('span', { class: 'cs-tile-label' }, 'Symbol'), sym),
      h('div', { class: 'pn-foot cs-hint' }, magics || 'No magic yet')));
  });
  ap(g, h('button', { class: 'cs-card cs-card-add pn-add', onclick: () => {
    const have = new Set(gods.map((x) => S.resolve(linkName(x.name), f.path)?.path));
    const items = S.notesOf('character').filter((c) => S.fm(c).role === 'Deity' && !have.has(c.path)).map((c) => ({ label: c.basename, value: c.path }));
    suggest({ items, create: true, placeholder: 'Add a god… (type a new name to create one)', source: 'characters where role = Deity', onPick: async (v, isNew) => {
      const c = isNew ? await createNote('character', v, { role: 'Deity', age: 'Ageless' }, { open: false }) : app().vault.getAbstractFileByPath(v);
      if (c) W((x) => { x.gods.push({ name: S.link(c, f.path), rank: s.divineRanks[1] || s.divineRanks[0] || '', domains: [], symbol: '' }); });
    } });
  } }, '+ Add god'));
  return h('div', {}, h('div', { class: 'cs-hint cs-mb' }, 'Gods are character notes with role Deity, so each also gets a full character sheet.'), g);
}
function worshipOf(f) {
  const gods = arr(S.fm(f).gods).map((g) => S.resolve(linkName(g.name), f.path)).filter(Boolean); const gp = new Set(gods.map((g) => g.path));
  const hit = (c, key) => S.linkFiles(c, key).filter((x) => gp.has(x.path));
  const out = [];
  for (const c of S.notesOf('culture')) { const m = hit(c, 'faith'); if (m.length) out.push([c, 'Cultures', 'worships ' + m.map((x) => x.basename).join(', ')]); }
  for (const c of S.notesOf('magic')) { const m = hit(c, 'patron'); if (m.length) out.push([c, 'Magic', 'granted by ' + m.map((x) => x.basename).join(', ')]); }
  for (const c of S.notesOf('organization')) { const m = hit(c, 'patron'); if (m.length) out.push([c, 'Organizations', 'serves ' + m.map((x) => x.basename).join(', ')]); }
  for (const c of S.notesOf('kingdom')) { const m = hit(c, 'religion'); if (m.length) out.push([c, 'Kingdoms', 'state faith']); }
  for (const c of S.notesOf('character')) { const r = arr(S.fm(c)[ST().relationshipKey]).find((r) => r && r.type === 'Worshipper' && gp.has(S.resolve(linkName(r.name), c.path)?.path)); if (r) out.push([c, 'Characters', 'worships ' + display(linkName(r.name))]); }
  return out;
}
function renderWorship(f) {
  const w = worshipOf(f); if (!w.length) return empty('Nothing worships these gods yet. Link a culture’s Faith, a magic’s God patron or a kingdom’s Faith to one of them.');
  const by = {}; w.forEach((x) => (by[x[1]] ??= []).push(x));
  const wrap = h('div', {}, h('div', { class: 'cs-hint cs-mb' }, 'Worked out from other notes that link to this pantheon’s gods.'));
  for (const [k, l] of Object.entries(by)) { ap(wrap, groupTitle(k, l.length), h('div', { class: 'cs-cards' }, ...l.map(([c, , why]) => miniCard(c, { sub: why, round: k === 'Characters' })))); }
  return wrap;
}
