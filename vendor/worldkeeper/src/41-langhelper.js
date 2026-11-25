/* =====================================================================
   Language helper: an optional, step-by-step guide to building a new
   language on a language note. Nothing is written until the last step.
   ===================================================================== */
const LH_FEELS = [
  { id: 'flowing', icon: '🌿', name: 'Flowing & lyrical', blurb: 'Soft sounds, lots of vowels, open syllables. Elegant, old, musical.',
    ph: { consonants: 'l r n m th s v f h y', vowels: 'a e i o u ae ia', patterns: 'CV CV V CVC', forbidden: 'yi', minSyl: 2, maxSyl: 3 }, order: 'SVO', morph: 'Fusional' },
  { id: 'harsh', icon: '🪓', name: 'Harsh & guttural', blurb: 'Hard stops and throaty sounds, closed syllables. Warlike, blunt.',
    ph: { consonants: 'k g kh gh r d t z sh q b', vowels: 'a o u e', patterns: 'CVC CVC CV CVCC', forbidden: 'qk kq', minSyl: 1, maxSyl: 2 }, order: 'SOV', morph: 'Agglutinative' },
  { id: 'northern', icon: '❄️', name: 'Cold & northern', blurb: 'Short, sturdy words with clustered consonants. Sea-raiders, mountain halls.',
    ph: { consonants: 'th d g k s t r l n m v f j h', vowels: 'a e i o u ei au y', patterns: 'CVC CVCC CV', forbidden: 'jj', minSyl: 1, maxSyl: 2 }, order: 'SVO', morph: 'Fusional' },
  { id: 'desert', icon: '🏜️', name: 'Desert & ancient', blurb: 'Deep consonants and long vowels. Old kingdoms, scripture, trade roads.',
    ph: { consonants: 'k q h s sh z d t r m n b l y', vowels: 'a i u aa ii', patterns: 'CVC CV CV', forbidden: 'yy', minSyl: 2, maxSyl: 3 }, order: 'VSO', morph: 'Fusional' },
  { id: 'island', icon: '🌊', name: 'Open & island-like', blurb: 'Few consonants, every syllable ends in a vowel. Warm, rhythmic, easy to say.',
    ph: { consonants: 'k l m n p h w t', vowels: 'a e i o u', patterns: 'CV V', forbidden: 'wu', minSyl: 2, maxSyl: 4 }, order: 'VSO', morph: 'Isolating' },
  { id: 'imperial', icon: '🏛️', name: 'Stately & imperial', blurb: 'Balanced, formal words with clear endings. Law courts, empires, scholars.',
    ph: { consonants: 'c t r s l n m p v d qu', vowels: 'a e i o u ae', patterns: 'CV CVC VC', forbidden: 'quu', minSyl: 2, maxSyl: 3 }, order: 'SOV', morph: 'Fusional' },
  { id: 'whisper', icon: '🐍', name: 'Sibilant & secretive', blurb: 'Hissing and breathy sounds. Fae courts, serpents, cults, the uncanny.',
    ph: { consonants: 's sh z zh th h l r n', vowels: 'i e a ii ia', patterns: 'CV CVC VC', forbidden: 'shsh zhzh', minSyl: 2, maxSyl: 3 }, order: 'OVS', morph: 'Agglutinative' },
];
const LH_ORDER_HELP = {
  SOV: 'Subject, object, verb: “the fox the bread eats”. The most common order in the world.',
  SVO: 'Subject, verb, object: “the fox eats the bread”, like English.',
  VSO: 'Verb first: “eats the fox the bread”. Sounds formal or poetic to English readers.',
  VOS: 'Verb, object, subject: “eats the bread the fox”. Rare.',
  OVS: 'Object first: “the bread eats the fox”. Very rare, feels alien.',
  OSV: 'Object, subject, verb: “the bread the fox eats”. Very rare, feels alien.',
  Free: 'Any order. Endings on the words show who does what to whom.',
};
const LH_MORPH_HELP = {
  Isolating: 'One idea per word. Tense and plural are separate little words (“fox many”, “eat before”).',
  Agglutinative: 'Clear pieces glued on in a row: fox-many-of, eat-before-not. Easy to read and to build.',
  Fusional: 'One ending carries several meanings at once, as in Latin or Spanish. Feels old and irregular.',
  Polysynthetic: 'Whole phrases become one long word. Striking, but hard to keep consistent.',
};
const LH_WORDS = [
  { id: 'people', name: 'People & pronouns', on: true, words: ['I', 'you', 'we', 'they', 'person', 'mother', 'father', 'child', 'friend', 'enemy', 'king', 'god'] },
  { id: 'nature', name: 'World & nature', on: true, words: ['sun', 'moon', 'star', 'sky', 'water', 'fire', 'earth', 'wind', 'sea', 'river', 'tree', 'stone', 'mountain', 'night', 'day'] },
  { id: 'actions', name: 'Actions', on: true, pos: 'verb', words: ['go', 'come', 'see', 'speak', 'hear', 'eat', 'drink', 'sleep', 'know', 'give', 'take', 'make', 'fight', 'love', 'die'] },
  { id: 'qualities', name: 'Qualities', pos: 'adj', on: true, words: ['big', 'small', 'good', 'bad', 'old', 'new', 'dark', 'bright', 'cold', 'hot', 'true', 'holy'] },
  { id: 'numbers', name: 'Numbers', short: true, pos: 'num', words: ['one', 'two', 'three', 'four', 'five', 'ten', 'hundred'] },
  { id: 'body', name: 'Body', words: ['head', 'eye', 'hand', 'heart', 'blood', 'bone', 'mouth'] },
  { id: 'places', name: 'Places & society', words: ['home', 'city', 'road', 'gate', 'temple', 'war', 'peace', 'name', 'word', 'law'] },
  { id: 'small', name: 'Little words', short: true, pos: 'particle', words: ['and', 'not', 'with', 'in', 'to', 'of', 'yes', 'no'] },
];
const LH_AFFIXES = [
  { m: 'plural', on: true }, { m: 'past tense', on: true }, { m: 'future tense', on: false }, { m: 'negation (not)', on: true },
  { m: 'one who does (agent)', on: true }, { m: 'place of', on: false }, { m: 'small (diminutive)', on: false },
];

/* ---------- flair: an optional flavour laid over the chosen sounds ---------- */
const LH_FLAIRS = [
  { id: 'dark', icon: '🌑', name: 'Dark', words: ['dark', 'grim', 'evil', 'shadow', 'gothic', 'sinister', 'menacing'], add: { C: 'gr kr z v th', V: 'u o' }, drop: { C: 'w y h', V: 'ie ia' }, finals: 'oth ul rak goth mor', patterns: 'CVC' },
  { id: 'germanic', icon: '🏰', name: 'Germanic', words: ['german', 'germanic', 'teutonic', 'saxon', 'dutch'], add: { C: 'sch ch k g w z r', V: 'ei au ü ö' }, finals: 'en er heim burg ling wald', patterns: 'CVCC CVC' },
  { id: 'celtic', icon: '☘️', name: 'Celtic', words: ['celtic', 'irish', 'welsh', 'gaelic', 'breton', 'druid'], add: { C: 'bh dh mh ll ch', V: 'ae ai ea ui' }, finals: 'an ach wyn eth mor', patterns: 'CV CVC' },
  { id: 'whisky', icon: '🥃', name: 'Whisky (smoky Highland)', words: ['whisky', 'whiskey', 'smoky', 'smokey', 'highland', 'peat', 'scotch', 'scottish', 'tavern'], add: { C: 'ch gh mh bh', V: 'ai ea oi' }, finals: 'ach aig ie more dhu', patterns: 'CVC' },
  { id: 'elvish', icon: '🧝', name: 'Elvish', words: ['elvish', 'elven', 'elf', 'fair', 'ethereal', 'graceful'], add: { C: 'l r n th v s', V: 'ie ae ë' }, drop: { C: 'k g kh gh q z b x sch' }, finals: 'iel wen ion dil las riel', patterns: 'CV CV V' },
  { id: 'norse', icon: '⚔️', name: 'Norse', words: ['norse', 'viking', 'nordic', 'scandinavian', 'icelandic'], add: { C: 'sk kn rn ð þ', V: 'ø å ei' }, finals: 'heim gard vik ir dr', patterns: 'CVCC CVC' },
  { id: 'latin', icon: '🏛️', name: 'Latin', words: ['latin', 'roman', 'classical', 'imperial', 'legal'], add: { C: 'c qu x', V: 'ae' }, finals: 'us um ia ius or ae', patterns: 'CV CVC' },
  { id: 'slavic', icon: '🌲', name: 'Slavic', words: ['slavic', 'russian', 'polish', 'czech', 'slav'], add: { C: 'zh cz sk ch v', V: 'y' }, finals: 'ov ska ich ek ava', patterns: 'CVC CCVC' },
  { id: 'infernal', icon: '🔥', name: 'Infernal', words: ['infernal', 'demonic', 'demon', 'hell', 'hellish', 'fiendish'], add: { C: 'z x gr kh', V: 'a u' }, drop: { V: 'ie' }, finals: 'oth azz ul gor zak', patterns: 'CVC CVCC' },
  { id: 'fae', icon: '🍄', name: 'Fae', words: ['fae', 'fairy', 'faerie', 'fey', 'whimsical', 'sprite', 'pixie'], add: { C: 'ph l s w', V: 'ee i' }, drop: { C: 'kh gh q x' }, finals: 'ie wyn ette ella', patterns: 'CV CVC' },
  { id: 'oceanic', icon: '🌊', name: 'Sea-worn', words: ['sea', 'ocean', 'oceanic', 'island', 'tidal', 'sailor', 'maritime'], add: { C: 'l m n w h', V: 'a o u' }, drop: { C: 'kh gh z x' }, finals: 'a o ua ali', patterns: 'CV V' },
];
/** flair ids for words in free text ("dark, whisky, elvish"), plus the words nothing matched */
function lhFlairMatch(text) {
  const ws = String(text || '').toLowerCase().split(/[^a-zà-ÿ]+/).filter(Boolean); const ids = new Set(); const unknown = [];
  for (const w of ws) { const f = LH_FLAIRS.find((x) => x.id === w || x.words.includes(w)); if (f) ids.add(f.id); else if (w.length > 2 && !['and', 'with', 'but', 'like', 'very', 'bit', 'touch', 'little', 'some'].includes(w)) unknown.push(w); }
  return { ids: [...ids], unknown };
}
/** the sounds with the chosen flairs laid over them: added and dropped sounds, extra syllable shapes, preferred endings */
function lhApplyFlair(ph, ids) {
  const out = Object.assign({}, ph); if (!ids || !ids.length) return out;
  const sp = (x) => String(x || '').split(/\s+/).filter(Boolean);
  let C = sp(ph.consonants), V = sp(ph.vowels), Pt = sp(ph.patterns), F = sp(ph.finals);
  for (const id of ids) { const fl = LH_FLAIRS.find((x) => x.id === id); if (!fl) continue;
    const dropC = sp(fl.drop && fl.drop.C), dropV = sp(fl.drop && fl.drop.V);
    C = C.filter((x) => !dropC.includes(x)); V = V.filter((x) => !dropV.includes(x));
    for (const x of sp(fl.add && fl.add.C)) if (!C.includes(x)) C.push(x); for (const x of sp(fl.add && fl.add.V)) if (!V.includes(x)) V.push(x);
    for (const x of sp(fl.patterns)) Pt.push(x); for (const x of sp(fl.finals)) if (!F.includes(x)) F.push(x); }
  if (!C.length) C = sp(ph.consonants); if (!V.length) V = sp(ph.vowels);
  return Object.assign(out, { consonants: C.join(' '), vowels: V.join(' '), patterns: Pt.join(' '), finals: F.join(' '), finalRate: 0.35, flair: ids.map((id) => (LH_FLAIRS.find((x) => x.id === id) || {}).name).filter(Boolean).join(', ') });
}

function openLanguageHelper(f) {
  const fm0 = S.fm(f); const cur = Object.assign({}, fm0.phonology || {});
  const hasSounds = !!(cur.consonants && cur.vowels);
  const st = {
    step: 0, mode: null, mineText: arr(fm0.lexicon).map((e) => `${e.word} = ${e.meaning || ''}`).join('\n'), englishFirst: false, mine: [], found: null, ans: {}, affType: '',
    feel: hasSounds ? 'keep' : null, flairs: [], flairText: '',
    genderChoice: wwClasses(fm0.genders).length ? 'keep' : ((fm0.grammar || {}).gender && WW_CLASS_SETS[(fm0.grammar || {}).gender] ? (fm0.grammar || {}).gender : ''), markNouns: (fm0.genders || {}).markNouns !== false, agreeAdj: (fm0.genders || {}).agree !== false, info: {},
    ph: hasSounds ? Object.assign({ patterns: 'CV CVC', forbidden: '', minSyl: 1, maxSyl: 2 }, cur) : null,
    order: fm0.wordOrder || '', morph: fm0.morphology || '',
    groups: Object.assign(Object.fromEntries(LH_WORDS.map((g) => [g.id, true])), { more: true }), extra: '', words: {},
    affixes: LH_AFFIXES.map((a) => ({ ...a, form: '' })), samples: [],
  };
  const meaningsOf = (l) => arr(l).flatMap((e) => String(e.meaning || '').toLowerCase().split(/\s*[,;/]\s*/)).filter(Boolean);
  const knownNow = () => new Set([...meaningsOf(fm0.lexicon), ...(st.mode === 'words' ? meaningsOf(st.mine) : [])]);
  const taken = () => new Set([...arr(S.fm(f).lexicon).map((e) => e.word), ...(st.mode === 'words' ? st.mine.map((e) => e.word) : []), ...Object.values(st.words)]);
  /* everyday words stay short, as they do in real languages: little words get one syllable, core words at most one more than the shortest */
  const shortPh = () => Object.assign({}, effPh(), { minSyl: 1, maxSyl: 1, finals: '' });
  const corePh = () => { const mn = Math.max(1, +st.ph.minSyl || 1); return Object.assign({}, effPh(), { minSyl: mn, maxSyl: Math.min(Math.max(mn, +st.ph.maxSyl || mn), mn + 1) }); };
  const phFor = (x) => (x.short ? shortPh() : x.story ? effPh() : corePh());
  /** the sounds new words are made from: the chosen sounds with any flair laid over them */
  const effPh = () => lhApplyFlair(st.ph, st.flairs);
  const sample = () => { const ex = taken(); st.samples = []; for (let i = 0; i < 10; i++) { const w = genWord(effPh(), ex); if (w) { st.samples.push(w); ex.add(w); } } };
  const wantedWords = () => {
    const out = [];
    for (const g of LH_WORDS) if (st.groups[g.id]) for (const m of g.words) out.push({ m, pos: g.pos || (g.id === 'people' && /^(I|you|we|they)$/.test(m) ? 'pron' : 'noun'), short: !!g.short || (g.id === 'people' && /^(I|you|we|they)$/.test(m)) });
    if (st.groups.more) for (const m of WW_MORE_WORDS) out.push({ m, pos: WW_MORE_POS(m), short: false });
    for (const m of st.extra.split(/[\n,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean)) out.push({ m, pos: 'noun', short: false, story: true });
    const kn = knownNow(); const seen = new Set(); return out.filter((x) => { const k = x.m.toLowerCase(); if (kn.has(k) || seen.has(k)) return false; seen.add(k); return true; });
  };
  /* write the stressed vowel with an acute accent, the way Spanish or Greek mark it */
  const ACUTE = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', y: 'ý' };
  const accentWord = (w) => {
    if (!st.ph.acute || /[áéíóúý-]/.test(w)) return w;
    const syl = pronounce(st.ph, w).split('-'); const at = syl.findIndex((x) => /[A-Z]/.test(x) && x === x.toUpperCase()); if (at < 0) return w;
    const toks = sayTokens(st.ph, w); const vi = toks.map((t, i) => (t.k === 'V' ? i : -1)).filter((i) => i >= 0); const t = toks[vi[at]];
    if (!t || !ACUTE[t.s]) return w; // long vowels (ā, aa) already stand out, so they keep their own spelling
    t.s = ACUTE[t.s]; return toks.map((x) => x.s).join('');
  };
  /** the noun classes the new words will use: the conlang's own, or a fresh set for the choice made here */
  const gcfg = () => { if (st.genderChoice === 'keep') return Object.assign({}, fm0.genders, { markNouns: st.markNouns, agree: st.agreeAdj }); return WW_CLASS_SETS[st.genderChoice] ? { classes: wwDefaultClasses(st.genderChoice, effPh()), markNouns: st.markNouns, agree: st.agreeAdj } : null; };
  /** class endings and shared roots for newly coined nouns (king / queen share a stem) */
  const classify = (items, ex) => { const cfg = gcfg(); if (!cfg || !wwClasses(cfg).length) return; const ents = items.map((x) => ({ word: st.words[x.m], pos: x.pos, meaning: x.m }));
    wwGenderize(cfg, ents, ex); ents.forEach((e, i) => { const m = items[i].m; st.words[m] = e.word; st.info[m] = { gender: e.gender, root: e.root }; }); };
  const coinWords = (force) => {
    const ex = taken(); if (force) { for (const w of Object.values(st.words)) ex.delete(w); st.words = {}; st.info = {}; }
    const fresh = [];
    for (const x of wantedWords()) { if (st.words[x.m]) continue; const w0 = genWord(phFor(x), ex); const w = w0 && accentWord(w0); if (w) { st.words[x.m] = w; ex.add(w); fresh.push(x); } }
    classify(fresh, ex);
  };
  const affixType = () => st.affType || (st.order === 'VSO' || st.order === 'VOS' ? 'prefix' : 'suffix');
  const typeOf = (a) => a.type || affixType();
  const coinAffixes = (force) => {
    const ex = new Set(); const base = Object.assign({}, effPh(), { patterns: 'V VC CV', minSyl: 1, maxSyl: 1, finals: '' });
    for (const a of st.affixes) { if (a.detected || (a.form && !force)) { ex.add(a.form); continue; } const w = genWord(base, ex) || 'a'; ex.add(w); a.form = w; }
  };

  const box = h('div', { class: 'wk-suggest lh' }); const close = modalShell(box, { wide: true });
  /* two ways in: build from scratch, or start from a language that already exists (words pasted in, or this conlang's own) */
  const STEP_NAMES = { start: 'Start', mine: 'Your words', found: 'Rules', sound: 'Sound', grammar: 'Grammar', words: 'Words', endings: 'Endings', review: 'Review' };
  const steps = () => (st.mode === 'words' ? ['start', 'mine', 'found', 'sound', 'words', 'endings', 'review'] : ['start', 'sound', 'grammar', 'words', 'endings', 'review']);
  const parseMine = () => lhParse(st.mineText, st.englishFirst);
  const OK = { start: () => !!st.mode, mine: () => parseMine().length >= 3, found: () => !!st.order && !!st.morph, sound: () => !!st.ph, grammar: () => !!st.order && !!st.morph, words: () => true, endings: () => true, review: () => true };
  /** read the user's words and set everything the analysis can tell */
  const analyse = () => {
    st.mine = parseMine().map((e) => ({ ...e, pos: e.pos || lhGuessPos(e.meaning) }));
    st.found = lhAnalyze(st.mine); st.foundPh = Object.assign({}, st.found.ph); st.ph = Object.assign({}, st.found.ph); st.feel = 'detected';
    st.affixes = LH_AFFIXES.map((a) => { const d = st.found.affixes.find((x) => x.m === a.m); return d ? { ...a, on: true, form: d.form, type: d.type, detected: true, ex: d.ex } : { ...a, form: '' }; });
    const pl = st.found.affixes.find((x) => x.m === 'plural' && x.type !== 'word'); st.affType = pl ? pl.type : '';
    if (!st.morph && st.found.affixes.some((x) => x.type !== 'word')) st.morph = 'Agglutinative';
    if (!st.morph && st.found.affixes.length && st.found.affixes.every((x) => x.type === 'word')) st.morph = 'Isolating';
    st.ans = {}; st.words = {}; st.samples = [];
  };
  const draw = () => {
    const ids = steps(); const id = ids[st.step] || 'start';
    const head = h('div', { class: 'lh-head' }, h('div', { class: 'wk-sg-title' }, `🧭 Language helper · ${f.basename}`),
      h('div', { class: 'lh-steps' }, ...ids.map((k, i) => h('span', { class: 'lh-step' + (i === st.step ? ' is-on' : i < st.step ? ' is-done' : '') }, `${i + 1}. ${STEP_NAMES[k]}`))));
    const body = h('div', { class: 'lh-body' });
    ({ start: stepStart, mine: stepMine, found: stepFound, sound: stepSound, grammar: stepGrammar, words: stepWords, endings: stepEndings, review: stepReview })[id](body);
    const back = h('button', { onclick: () => { st.step--; draw(); } }, '← Back'); if (!st.step) back.disabled = true;
    const last = st.step >= ids.length - 1;
    const next = !last ? h('button', { class: 'mod-cta', onclick: () => {
      if (!OK[id]()) return; if (id === 'mine') analyse();
      st.step++; const to = ids[st.step]; if (to === 'words') coinWords(); if (to === 'endings') coinAffixes(); if (to === 'sound' && st.ph) sample(); draw();
    } }, 'Next →') : h('button', { class: 'mod-cta', onclick: apply }, '✓ Add to my language');
    if (!OK[id]()) next.disabled = true;
    box.replaceChildren(head, body, h('div', { class: 'wk-sg-foot lh-foot' }, h('button', { onclick: () => close() }, 'Cancel'), h('span', { class: 'cd-spacer' }), back, next));
    body.scrollTop = 0;
  };
  function stepStart(body) {
    const n = arr(fm0.lexicon).length;
    ap(body, h('p', { class: 'lh-lead' }, 'How would you like to start?'));
    const choice = (mode, icon, title, text) => h('button', { class: 'lh-feel lh-start' + (st.mode === mode ? ' is-on' : ''), onclick: () => { if (st.mode !== mode) { st.mode = mode; st.found = null; st.words = {}; } draw(); } }, h('span', { class: 'lh-feel-ic' }, icon), h('b', {}, title), h('small', {}, text));
    ap(body, h('div', { class: 'lh-feels lh-starts' },
      choice('scratch', '🎲', 'Build from scratch', 'Pick how it should sound, choose its grammar, and let the helper make the words: about 200 to start.'),
      choice('words', '📝', 'Start from an existing language', n ? `Use the ${n} words already in ${f.basename}, or paste in more. The helper works out the sounds, syllables and endings, asks about anything it can’t tell, then makes the rest of the words.` : 'Paste in words you already have with their English meanings. The helper works out the sounds, syllables and endings, asks about anything it can’t tell, then makes the rest of the words to match.')));
    ap(body, tip('Either way, nothing is saved until the last step, and everything stays editable afterwards.'));
  }
  function stepMine(body) {
    ap(body, h('p', { class: 'lh-lead' }, 'Paste or type your words, one per line, each with its English meaning. Use “=”, a colon, a tab or a dash between them.'));
    const ta = h('textarea', { class: 'lh-mine', placeholder: "tal = star\ntalen = stars\nmira = to remember\nmiraso = remembered\nka'el = oath\nnai mira = not remember" }, st.mineText);
    const flip = h('input', { type: 'checkbox', checked: st.englishFirst });
    const preview = h('div', { class: 'lh-mine-preview' }); const nextBtn = () => box.querySelector('.lh-foot .mod-cta');
    const refresh = () => { const list = parseMine(); const lines = st.mineText.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).length;
      preview.replaceChildren(h('div', { class: 'cs-hint' }, `${list.length} word${list.length === 1 ? '' : 's'} read${lines > list.length ? ` · ${lines - list.length} line${lines - list.length === 1 ? '' : 's'} not understood (use “word = meaning”)` : ''}`),
        h('div', { class: 'lh-wordlist' }, ...list.slice(0, 24).map((e) => h('span', { class: 'lh-word' }, h('b', {}, e.word), h('small', {}, e.meaning))), list.length > 24 ? h('span', { class: 'cs-hint' }, `+${list.length - 24} more`) : null));
      const nb = nextBtn(); if (nb) nb.disabled = list.length < 3; };
    ta.addEventListener('input', () => { st.mineText = ta.value; refresh(); });
    flip.addEventListener('change', () => { st.englishFirst = flip.checked; refresh(); });
    ap(body, h('div', { class: 'lh-card' }, ta, h('label', { class: 'lh-check' }, flip, 'My list puts the English first (star = tal)'), preview));
    ap(body, tip('Ten or more words give the best results. Include pairs like star / stars, walk / walked, or remember / not remember, and the helper can find the endings too. “to …” meanings are read as verbs.'));
    setTimeout(refresh, 0);
  }
  function stepFound(body) {
    const fd = st.found; const sx = fd.stats;
    const posCount = {}; for (const e of st.mine) posCount[e.pos] = (posCount[e.pos] || 0) + 1;
    const row = (label, ...val) => h('div', { class: 'lh-found-row' }, h('b', {}, label), h('span', {}, ...val));
    ap(body, h('p', { class: 'lh-lead' }, `Here’s what ${sx.words} words show. New words will follow these rules; answer a few questions to fill in what words alone can’t tell.`));
    ap(body, h('div', { class: 'lh-card' }, h('h4', {}, 'Found in your words'),
      row('Consonants', fd.ph.consonants || '—'), row('Vowels', fd.ph.vowels || '—'),
      sx.digraphs.length ? row('Two-letter sounds', sx.digraphs.join(', ')) : null,
      row('Syllable shapes', sx.shapes.map(([sh, n]) => `${sh} ×${n}`).join(' · ') || '—'),
      row('Word length', sx.sylMin === sx.sylMax ? `${sx.sylMin} syllable${sx.sylMin === 1 ? '' : 's'}` : `${sx.sylMin}–${sx.sylMax} syllables`),
      row('Word types (guessed)', Object.entries(posCount).map(([k, n]) => `${n} ${POS_PLURAL[k] ? POS_PLURAL[k].toLowerCase() : k}`).join(', ')),
      sx.acute ? row('Stress', 'An accent (á) marks the stressed syllable') : null,
      row('Endings', fd.affixes.length ? h('span', {}, ...fd.affixes.map((a, i) => h('span', { class: 'lh-found-aff' }, i ? ' · ' : '', h('b', {}, a.type === 'prefix' ? `${a.form}-` : a.type === 'word' ? `${a.form} …` : `-${a.form}`), ` ${a.m}`, h('small', {}, ` (${a.ex})`)))) : 'None found. Pairs like star / stars would show them.'),
      ...fd.notes.map((n) => h('div', { class: 'cs-hint' }, n))));
    // questions for what the words can't tell
    const q = (title, help, opts, cur, set) => h('div', { class: 'lh-card' }, h('h4', {}, title), help ? h('div', { class: 'cs-hint' }, help) : null,
      h('div', { class: 'lh-opts' }, ...opts.map(([v, l, d]) => h('button', { class: 'lh-opt' + (cur === v ? ' is-on' : ''), onclick: () => { set(v); draw(); } }, h('b', {}, l), d ? h('small', {}, d) : null))));
    const dv = (k) => (T().language.domain.find((x) => x.key === k) || { values: [] }).values;
    ap(body, h('h3', { class: 'lh-qtitle' }, 'A few questions'));
    ap(body, q('What order do the main words go in?', 'Words alone can’t show this. Think of how “the fox eats the bread” would be said.', dv('wordOrder').map((v) => [v, v, LH_ORDER_HELP[v]]), st.order, (v) => { st.order = v; }));
    ap(body, q('How do words change?', fd.affixes.some((a) => a.type !== 'word') ? 'Your words add endings, so Agglutinative is picked for you. Change it if that’s not right.' : '', dv('morphology').map((v) => [v, v, LH_MORPH_HELP[v]]), st.morph, (v) => { st.morph = v; }));
    ap(body, classesCard());
    if (!sx.acute) ap(body, q('Which syllable is stressed?', 'This sets the pronunciation guide for every word.', [['first', 'The first', 'TA-len'], ['penult', 'Second-to-last', 'ta-LEN-ra'], ['last', 'The last', 'ta-len-RA'], ['none', 'All even', 'ta-len-ra']], st.ph.stress || 'penult', (v) => { st.ph.stress = v; }));
    const howMade = (m, title, eg) => { if (fd.affixes.some((a) => a.m === m)) return null;
      return q(title, '', [['suffix', 'An ending', eg[0]], ['prefix', 'A beginning', eg[1]], ['word', 'A separate word', eg[2]], ['none', 'Not marked', 'context shows it']], st.ans[m] || '', (v) => { st.ans[m] = v; const a = st.affixes.find((x) => x.m === m); if (!a) return; a.on = v !== 'none'; a.type = v === 'word' ? 'word' : v === 'none' ? '' : v; if (m === 'plural' && (v === 'suffix' || v === 'prefix')) st.affType = v; }); };
    ap(body, howMade('plural', 'How do you show more than one?', ['star → stars', 'star → s-star', 'many star']));
    ap(body, howMade('past tense', 'How do you show the past?', ['walk → walked', 'walk → ge-walk', 'did walk']));
    ap(body, q('How long should new words be?', `Yours are ${sx.sylMin === sx.sylMax ? sx.sylMin : `${sx.sylMin}–${sx.sylMax}`} syllable${sx.sylMax === 1 ? '' : 's'}.`, [['same', 'About the same'], ['shorter', 'A little shorter'], ['longer', 'A little longer']], st.ans.len || 'same', (v) => {
      st.ans.len = v; const b = st.foundPh; st.ph.minSyl = Math.max(1, b.minSyl + (v === 'shorter' ? -1 : v === 'longer' ? 1 : 0)); st.ph.maxSyl = Math.max(st.ph.minSyl, b.maxSyl + (v === 'shorter' ? -1 : v === 'longer' ? 1 : 0)); }));
    const extra = ['l', 'n', 'm', 's', 't', 'k', 'r', 'v', 'd', 'h'].filter((c) => !String(fd.ph.consonants).split(/\s+/).includes(c)).slice(0, 3);
    if (extra.length) ap(body, q('Should new words use only the sounds in your words?', `Your words use ${String(fd.ph.consonants).split(/\s+/).filter(Boolean).length} consonants.`, [['only', 'Only my sounds'], ['more', `Add a few more (${extra.join(', ')})`]], st.ans.sounds || 'only', (v) => {
      st.ans.sounds = v; const base = String(st.foundPh.consonants).split(/\s+/).filter(Boolean); st.ph.consonants = (v === 'more' ? [...base, ...extra] : base).join(' '); }));
  }
  const tip = (t) => h('div', { class: 'lh-tip' }, h('b', {}, '💡 '), t);

  function flairCard() {
    const toggle = (id) => { st.flairs = st.flairs.includes(id) ? st.flairs.filter((x) => x !== id) : [...st.flairs, id]; st.words = {}; sample(); draw(); };
    const txt = h('input', { type: 'text', class: 'lh-flair-in', value: st.flairText, placeholder: 'Or describe it: dark, whisky, elvish…' });
    const msg = h('div', { class: 'cs-hint' });
    txt.addEventListener('change', () => { st.flairText = txt.value; const m = lhFlairMatch(txt.value); for (const id of m.ids) if (!st.flairs.includes(id)) st.flairs.push(id); st.flairNote = m.unknown.length ? `No flair for “${m.unknown.join('”, “')}” yet; try one of the chips.` : ''; st.words = {}; sample(); draw(); });
    const E = effPh(); const base = String(st.ph.consonants).split(/\s+/); const added = String(E.consonants).split(/\s+/).filter((x) => x && !base.includes(x));
    return h('div', { class: 'lh-card' }, h('h4', {}, 'Flair (optional)'), h('div', { class: 'cs-hint' }, 'Give the language a flavour on top of its sounds. Pick one or mix a few.'),
      h('div', { class: 'lh-flairs' }, ...LH_FLAIRS.map((fl) => h('button', { class: 'lh-flair' + (st.flairs.includes(fl.id) ? ' is-on' : ''), onclick: () => toggle(fl.id) }, fl.icon + ' ' + fl.name))),
      txt, st.flairNote ? h('div', { class: 'cs-hint' }, st.flairNote) : null,
      st.flairs.length ? h('div', { class: 'lh-flair-sum' }, `${E.flair}: `, added.length ? `adds ${added.join(' ')}; ` : '', `words often end in ${String(E.finals).split(/\s+/).slice(0, 8).map((x) => '-' + x).join(' ')}`) : null);
  }
  function stepSound(body) {
    ap(body, h('p', { class: 'lh-lead' }, st.found ? 'These sounds and syllable shapes come from your words. New words will follow them; tune anything that looks off, or try a different feel.' : 'Start with how the language sounds. Readers judge a language by its sounds long before its grammar, so pick a feel and tune it until the sample words sound right for the people who speak it.'));
    const feels = [...(st.found ? [{ id: 'detected', icon: '📝', name: 'From your words', blurb: `The ${st.found.stats.words} words you gave: their sounds, syllables and length.`, ph: st.foundPh }] : []), ...(hasSounds ? [{ id: 'keep', icon: '🔊', name: 'Keep my sounds', blurb: 'Use the consonants and vowels already on this note.', ph: cur }] : []), ...LH_FEELS];
    ap(body, h('div', { class: 'lh-feels' }, ...feels.map((x) => h('button', { class: 'lh-feel' + (st.feel === x.id ? ' is-on' : ''), onclick: () => {
      st.feel = x.id; st.ph = Object.assign({ patterns: 'CV CVC', forbidden: '', minSyl: 1, maxSyl: 2 }, x.ph);
      if (x.order && !fm0.wordOrder) st.order = x.order; if (x.morph && !fm0.morphology) st.morph = x.morph; st.words = {}; sample(); draw();
    } }, h('span', { class: 'lh-feel-ic' }, x.icon), h('b', {}, x.name), h('small', {}, x.blurb)))));
    if (!st.ph) return;
    if (!st.samples.length) sample();
    const fld = (k, label, hint) => { const i = h('input', { type: 'text', value: st.ph[k] ?? '' }); i.addEventListener('change', () => { st.ph[k] = i.value.trim(); st.words = {}; sample(); draw(); }); return h('label', { class: 'lh-fld' }, h('span', {}, label, h('small', {}, hint)), i); };
    const num = (k) => { const i = h('input', { type: 'number', min: 1, max: 6, value: st.ph[k], class: 'cl-num' }); i.addEventListener('change', () => { st.ph[k] = Math.max(1, +i.value || 1); if (+st.ph.maxSyl < +st.ph.minSyl) st.ph.maxSyl = st.ph.minSyl; st.words = {}; sample(); draw(); }); return i; };
    ap(body, h('div', { class: 'lh-card' }, h('h4', {}, 'Tune the sounds'),
      fld('consonants', 'Consonants', 'space-separated; digraphs like th or sh count as one sound'), fld('vowels', 'Vowels', 'add ae, ia… for diphthongs'),
      fld('patterns', 'Syllable shapes', 'C = consonant, V = vowel; repeat a shape to make it more common'), fld('forbidden', 'Never allow', 'letter pairs that look wrong'),
      h('div', { class: 'lh-fld cl-inline' }, h('span', {}, 'Syllables per word'), num('minSyl'), h('span', {}, 'to'), num('maxSyl'))));
    const sp = (x) => String(x || '').split(/\s+/).filter(Boolean);
    const flag = (label, on, set) => { const c = h('input', { type: 'checkbox', checked: on }); c.addEventListener('change', () => { set(c.checked); st.words = {}; sample(); draw(); }); return h('label', { class: 'lh-check' }, c, label); };
    const MAC = { a: 'ā', e: 'ē', i: 'ī', o: 'ō', u: 'ū' }; const hasMac = sp(st.ph.vowels).some((v) => Object.values(MAC).includes(v));
    const hasApos = /'/.test(st.ph.patterns || ''); const hasAcute = !!st.ph.acute;
    ap(body, h('div', { class: 'lh-card' }, h('h4', {}, 'Accents & marks (optional)'),
      flag('Long vowels written with a line on top (ā ē ī ō ū)', hasMac, (on) => { const v = sp(st.ph.vowels).filter((x) => !Object.values(MAC).includes(x)); st.ph.vowels = (on ? [...v, ...v.filter((x) => MAC[x]).map((x) => MAC[x])] : v).join(' '); }),
      flag('Apostrophes for a catch in the voice (ka\u2019el)', hasApos, (on) => { const p = sp(st.ph.patterns).filter((x) => !/'/.test(x)); st.ph.patterns = (on ? [...p, "CV'V"] : p).join(' '); }),
      flag('Show the stressed vowel with an accent (talássa)', hasAcute, (on) => { st.ph.acute = on; }),
      h('div', { class: 'cs-hint' }, 'Hyphens are for compound words; type them into your own words (sea-lantern) or add - to a syllable shape.')));
    ap(body, flairCard());
    ap(body, h('div', { class: 'lh-card' }, h('h4', {}, 'Sample words'), h('div', { class: 'cl-gen' }, ...st.samples.map((w) => h('span', { class: 'lh-sample' }, w, h('small', {}, pronounce(st.ph, w))))),
      h('div', { class: 'cl-actions' }, h('button', { onclick: () => { sample(); draw(); } }, '🎲 New samples'))));
    ap(body, tip('Fewer sounds make a language feel more distinct. Around 10–15 consonants and 3–6 vowels is plenty. If a word looks unpronounceable, add the clumsy pair to “Never allow”.'));
  }
  function classesCard() {
    const opts = [...(wwClasses(fm0.genders).length ? [['keep', 'Keep this conlang’s classes', wwClasses(fm0.genders).map((c) => c.name).join(' / ')]] : []), ['', 'None', 'Nouns have no gender'], ...Object.keys(WW_CLASS_SETS).map((k) => [k, k, k === 'Animate / inanimate' ? 'Living things and objects' : k === 'Many classes' ? 'Four classes to name yourself' : ''])];
    const tg = (k, label) => { const c = h('input', { type: 'checkbox', checked: st[k] }); c.addEventListener('change', () => { st[k] = c.checked; st.words = {}; st.info = {}; }); return h('label', { class: 'lh-check' }, c, label); };
    const cfg = gcfg();
    return h('div', { class: 'lh-card' }, h('h4', {}, 'Gender (noun classes)'), h('div', { class: 'cs-hint' }, 'Optional. Gendered nouns get their own ending, and pairs like king / queen grow from one root.'),
      h('div', { class: 'lh-opts' }, ...opts.map(([v, l, d]) => h('button', { class: 'lh-opt' + (st.genderChoice === v ? ' is-on' : ''), onclick: () => { st.genderChoice = v; st.words = {}; st.info = {}; draw(); } }, h('b', {}, l), d ? h('small', {}, d) : null))),
      cfg && wwClasses(cfg).length ? h('div', { class: 'cs-hint' }, 'Endings: ', wwClasses(cfg).map((c) => `${c.name} ${c.marker ? '-' + c.marker : '(none)'}`).join(' · ')) : null,
      cfg && wwClasses(cfg).length ? tg('markNouns', 'Nouns end in their class ending') : null, cfg && wwClasses(cfg).length ? tg('agreeAdj', 'Describing words take the ending of their noun') : null);
  }
  function stepGrammar(body) {
    ap(body, h('p', { class: 'lh-lead' }, 'Two choices shape every sentence: the order of the main words, and how words change. You can keep it simple; these mostly guide how you write lines of dialogue.'));
    const opts = (key, help, values) => h('div', { class: 'lh-opts' }, ...values.map((v) => h('button', { class: 'lh-opt' + (st[key] === v ? ' is-on' : ''), onclick: () => { st[key] = v; draw(); } }, h('b', {}, v), h('small', {}, help[v] || ''))));
    const dv = (k) => (T().language.domain.find((x) => x.key === k) || { values: [] }).values;
    ap(body, h('div', { class: 'lh-card' }, h('h4', {}, 'Word order'), opts('order', LH_ORDER_HELP, dv('wordOrder'))));
    ap(body, h('div', { class: 'lh-card' }, h('h4', {}, 'How words change'), opts('morph', LH_MORPH_HELP, dv('morphology'))));
    ap(body, classesCard());
    ap(body, tip('Different from English is good, but not everywhere at once. One unusual choice (say, verb-first sentences) is memorable; five makes your readers work too hard.'));
  }
  function stepWords(body) {
    ap(body, h('p', { class: 'lh-lead' }, 'Coin a starter vocabulary. Common words come first because they turn up in names, places and oaths. Everyday words come out short, the way they are in real languages; your own story words can be longer.'));
    const moreC = h('input', { type: 'checkbox', checked: st.groups.more }); moreC.addEventListener('change', () => { st.groups.more = moreC.checked; coinWords(); draw(); });
    ap(body, h('div', { class: 'lh-groups' }, h('label', { class: 'lh-group lh-group-more' }, moreC, h('b', {}, `${WW_MORE_WORDS.length} more everyday words`), h('small', {}, WW_MORE_WORDS.slice(0, 8).join(', ') + '…')), ...LH_WORDS.map((g) => { const c = h('input', { type: 'checkbox', checked: st.groups[g.id] }); c.addEventListener('change', () => { st.groups[g.id] = c.checked; coinWords(); draw(); });
      return h('label', { class: 'lh-group' }, c, h('b', {}, g.name), h('small', {}, g.words.slice(0, 6).join(', ') + (g.words.length > 6 ? '…' : ''))); })));
    const ta = h('textarea', { class: 'lh-extra', placeholder: 'Your own story words, one per line or comma-separated: lantern, tide, oath…' }, st.extra);
    ta.addEventListener('change', () => { st.extra = ta.value; coinWords(); draw(); });
    ap(body, h('div', { class: 'lh-card' }, h('h4', {}, 'Words from your story'), ta));
    const list = wantedWords();
    ap(body, h('div', { class: 'lh-card' }, h('h4', {}, `Preview · ${list.length} new words`, h('span', { class: 'cd-spacer' }), h('button', { class: 'lh-mini', onclick: () => { coinWords(true); draw(); } }, '🎲 Reroll all')),
      list.length ? h('div', { class: 'lh-wordlist' }, ...list.map((x) => h('button', { class: 'lh-word', title: 'Tap for a different word', onclick: () => { const ex = taken(); ex.delete(st.words[x.m]); const w0 = genWord(phFor(x), ex); const w = w0 && accentWord(w0); if (w) { st.words[x.m] = w; delete st.info[x.m]; classify([x], ex); } draw(); } }, h('b', {}, st.words[x.m] || '—'), h('small', {}, x.m + (st.info[x.m] && st.info[x.m].gender ? ` · ${st.info[x.m].gender}` : '')))))
        : h('div', { class: 'cs-hint' }, knownNow().size ? 'Every word you picked is already in the lexicon.' : 'Pick a group above or add your own words.'),
      knownNow().size ? h('div', { class: 'cs-hint cs-mt' }, st.mode === 'words' ? 'Meanings you already have a word for are skipped.' : 'Meanings already in your lexicon are skipped.') : null));
    ap(body, tip('Tap any word to roll a new one. Words for important things in your story (a god, the sea, a city) are worth rerolling until they feel right.'));
  }
  function stepEndings(body) {
    ap(body, h('p', { class: 'lh-lead' }, st.found && st.affixes.some((a) => a.detected) ? `Endings marked “from your words” were found in your list and are kept as they are. The others are new; turn on the ones you want.` : st.morph === 'Isolating' ? 'Your language is isolating, so these become small separate words placed next to the word they change, rather than endings.' : `Endings (or beginnings) change a word's meaning. With ${st.order || 'your'} word order they work best as ${affixType()}es.`));
    ap(body, h('div', { class: 'lh-card' }, h('h4', {}, 'Pieces to add', h('span', { class: 'cd-spacer' }), h('button', { class: 'lh-mini', onclick: () => { coinAffixes(true); draw(); } }, '🎲 Reroll')),
      ...st.affixes.map((a) => { const c = h('input', { type: 'checkbox', checked: a.on }); c.addEventListener('change', () => { a.on = c.checked; draw(); }); const ty = typeOf(a);
        const fi = h('input', { type: 'text', class: 'lh-affix', value: a.form }); fi.addEventListener('change', () => { a.form = fi.value.trim().replace(/^-|-$/g, ''); a.detected = false; draw(); });
        const ex = st.words.star || st.words.person || st.words.stone || (st.mine[0] || {}).word || Object.values(st.words)[0]; const shown = ty === 'word' ? `${a.form} …` : ty === 'prefix' ? `${a.form}-` : `-${a.form}`;
        return h('label', { class: 'lh-affrow' + (a.on ? '' : ' is-off') + (a.detected ? ' is-found' : '') }, c, h('span', { class: 'lh-affm' }, a.m, a.detected ? h('small', { class: 'lh-found' }, ` from your words: ${a.ex}`) : null), fi, h('small', {}, st.morph === 'Isolating' && ty !== 'word' ? '' : shown + (ex ? ` · ${ty === 'word' ? a.form + ' ' + ex : ty === 'prefix' ? a.form + ex : ex + a.form}` : ''))); })));
    ap(body, tip('The Translator uses the plural and past-tense pieces automatically, so “stars” and “walked” translate once those exist.'));
  }
  function stepReview(body) {
    const words = wantedWords().filter((x) => st.words[x.m]); const aff = st.affixes.filter((a) => a.on && a.form);
    const opt = (k, label, on = true) => { if (!(k in st)) st[k] = on; const c = h('input', { type: 'checkbox', checked: st[k] }); c.addEventListener('change', () => { st[k] = c.checked; }); return h('label', { class: 'lh-check' }, c, label); };
    ap(body, h('p', { class: 'lh-lead' }, 'Here is what will be added to this note. Everything stays editable afterwards on the Sounds, Lexicon and Grammar tabs.'));
    ap(body, h('div', { class: 'lh-card' },
      opt('doSounds', `Sound settings: ${String(st.ph.consonants).split(/\s+/).filter(Boolean).length} consonants, ${String(st.ph.vowels).split(/\s+/).filter(Boolean).length} vowels, shapes ${st.ph.patterns}`, true),
      opt('doGrammar', `Word order ${st.order} · ${st.morph}`, true),
      st.mode === 'words' && st.mine.length ? opt('doMine', `${st.mine.length} of your own words${arr(fm0.lexicon).length ? ' (new ones only)' : ''}`, true) : null,
      opt('doWords', `${words.length} new words in the lexicon`, true),
      opt('doAffixes', st.morph === 'Isolating' ? `${aff.length} marker words (as particles)` : `${aff.length} ${affixType()}es`, true)));
    const w = (m) => st.words[m] || (arr(fm0.lexicon).find((e) => String(e.meaning || '').toLowerCase().split(/\s*[,;/]\s*/).includes(m)) || {}).word;
    if (w('I') && w('see') && w('water')) {
      const parts = { S: w('I'), V: w('see'), O: w('water') }; const ord = /^[SVO]{3}$/.test(st.order) ? st.order : 'SVO';
      ap(body, h('div', { class: 'lh-card' }, h('h4', {}, 'A first sentence'), h('div', { class: 'lh-sentence' }, ord.split('').map((k) => parts[k]).join(' ') + '.'), h('div', { class: 'cs-hint' }, `“I see water”, in ${ord} order.`)));
    }
    ap(body, tip('Next: open the Translator tab, write a line your characters would say, and coin any missing words in one tap.'));
  }
  async function apply() {
    const words = wantedWords().filter((x) => st.words[x.m]); const aff = st.affixes.filter((a) => a.on && a.form); const isol = st.morph === 'Isolating';
    await S.write(f, (x) => {
      const E = effPh();
      if (st.doSounds !== false) { x.phonology = Object.assign({}, x.phonology || {}, { consonants: E.consonants, vowels: E.vowels, patterns: E.patterns, forbidden: E.forbidden || '', minSyl: +E.minSyl || 1, maxSyl: +E.maxSyl || 2 }, E.stress ? { stress: E.stress } : {}); if (E.finals) { x.phonology.finals = E.finals; x.phonology.finalRate = E.finalRate; x.phonology.flair = E.flair; } else { delete x.phonology.finals; delete x.phonology.flair; } }
      if (st.doGrammar !== false) { if (st.order) x.wordOrder = st.order; if (st.morph) x.morphology = st.morph; }
      x.lexicon = arr(x.lexicon); x.affixes = arr(x.affixes);
      if (st.mode === 'words' && st.doMine !== false) { const have = new Set(x.lexicon.map((e) => String(e.word).toLowerCase())); for (const e of st.mine) if (!have.has(String(e.word).toLowerCase())) { x.lexicon.push({ word: e.word, pos: e.pos || lhGuessPos(e.meaning), meaning: e.meaning }); have.add(String(e.word).toLowerCase()); } }
      const cfg = gcfg(); if (cfg && wwClasses(cfg).length) { x.genders = { classes: wwClasses(cfg), markNouns: cfg.markNouns !== false, agree: cfg.agree !== false }; if (st.genderChoice !== 'keep') x.grammar = Object.assign({}, x.grammar || {}, { gender: st.genderChoice }); }
      if (st.doWords !== false) for (const y of words) { const inf = st.info[y.m] || {}; const e = { word: st.words[y.m], pos: y.pos, meaning: y.m }; if (inf.gender) e.gender = inf.gender; if (inf.root) e.root = inf.root; x.lexicon.push(e); }
      if (st.doAffixes !== false) for (const a of aff) {
        const ty = typeOf(a);
        if (isol || ty === 'word') { if (!x.lexicon.some((e) => e.word === a.form)) x.lexicon.push({ word: a.form, pos: 'particle', meaning: a.m + ' marker' }); }
        else if (!x.affixes.some((b) => b.meaning === a.m)) x.affixes.push({ affix: ty === 'prefix' ? a.form + '-' : '-' + a.form, type: ty, meaning: a.m });
      }
    });
    await WW.syncTypology(f);
    close(); toast(`${f.basename}: added ${st.doWords !== false ? words.length : 0} words${st.doAffixes !== false && aff.length ? ` and ${aff.length} ${isol ? 'markers' : 'endings'}` : ''}`);
  }
  if (st.ph) sample();
  draw();
}

/* ---------- “start from words I already have”: read a word list, work out the rules it follows ---------- */
/** "word = meaning" per line (also :, tab, " - ", —, or a comma). englishFirst flips the two sides. */
function lhParse(text, englishFirst = false) {
  const out = [];
  for (const raw of String(text || '').split(/\n+/)) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(.+?)\s*(?:=|—|–|:|\t| - |,)\s*(.+)$/); if (!m) continue;
    let [w, mean] = englishFirst ? [m[2], m[1]] : [m[1], m[2]];
    w = w.trim().normalize('NFC'); mean = mean.trim().replace(/^["“']|["”']$/g, '');
    if (!w || !mean) continue;
    let pos = '';
    if (/^to\s+\w/i.test(mean)) { mean = mean.replace(/^to\s+/i, ''); pos = 'verb'; }
    out.push({ word: w, meaning: mean, pos });
  }
  return out;
}
/** guess a part of speech from the English meaning */
function lhGuessPos(meaning) {
  const m = String(meaning).toLowerCase().split(/\s*[,;/]\s*/)[0];
  const g = LH_WORDS.find((x) => x.words.some((w) => w.toLowerCase() === m)); if (g) return g.pos || (/^(i|you|we|they)$/.test(m) ? 'pron' : 'noun');
  if (typeof WW_MORE_WORDS !== 'undefined' && WW_MORE_WORDS.includes(m)) return WW_MORE_POS(m);
  if (typeof WW_FUNC !== 'undefined') for (const [k, l] of Object.entries(WW_FUNC)) if (l.includes(m)) return k;
  if (/ly$/.test(m)) return 'adv'; if (/(ed|ing)$/.test(m)) return 'verb';
  return 'noun';
}
const LH_DERIV = [
  { m: 'plural', test: (a, b) => b === a + 's' || b === a + 'es' || (/y$/.test(a) && b === a.slice(0, -1) + 'ies') || b === 'many ' + a || b === a + ' (plural)' },
  { m: 'past tense', test: (a, b) => b === a + 'ed' || b === a + 'd' || (/y$/.test(a) && b === a.slice(0, -1) + 'ied') || b === 'did ' + a || b === a + ' (past)' },
  { m: 'future tense', test: (a, b) => b === 'will ' + a },
  { m: 'negation (not)', test: (a, b) => b === 'not ' + a || b === 'un' + a || b === 'no ' + a },
  { m: 'one who does (agent)', test: (a, b) => b === a + 'er' || b === a + 'r' || b === 'one who ' + a + 's' || b === 'one who ' + a },
  { m: 'place of', test: (a, b) => b === 'place of ' + a || b === a + ' place' },
  { m: 'small (diminutive)', test: (a, b) => b === 'little ' + a || b === 'small ' + a },
];
/**
 * Work out sounds, syllable shapes, word length, stress marks and word endings from a word list.
 * Returns { ph, affixes: [{ m, form, type, ex }], stats, notes }.
 */
function lhAnalyze(entries) {
  const words = entries.map((e) => String(e.word).toLowerCase().normalize('NFC'));
  const parts = words.flatMap((w) => w.split(/-+/)).filter(Boolean);
  // two-letter sounds: accept the ones that turn up more than once
  const cands = [...new Set([...Object.keys(SAY_DEFAULTS.C), ...Object.keys(SAY_DEFAULTS.V)].filter((x) => [...x].length === 2 && !/['’ʼ]/.test(x)))];
  const count = (x) => parts.reduce((n, w) => n + (w.split(x).length - 1), 0);
  const diph = ['ae', 'ai', 'ei', 'ey', 'au', 'ou', 'oi', 'ia', 'ie', 'io', 'iu', 'ua'];
  const digraphs = cands.filter((x) => count(x) >= (diph.includes(x) ? 3 : 2));
  const isV = (c) => /[aeiouyæøåœ]/.test(c.normalize('NFD')[0]);
  const tokens = (w) => {
    const t = []; const ds = digraphs.slice().sort((a, b) => b.length - a.length);
    for (let i = 0; i < w.length;) {
      if (/['’ʼ]/.test(w[i])) { t.push({ s: "'", k: 'G' }); i++; continue; }
      if (/[\s.]/.test(w[i])) { i++; continue; }
      const d = ds.find((x) => w.startsWith(x, i)); if (d) { t.push({ s: d, k: [...d].every(isV) ? 'V' : 'C' }); i += d.length; continue; }
      const c = w[i]; let k = isV(c) ? 'V' : 'C';
      if (c === 'y') k = w[i + 1] && isV(w[i + 1]) ? 'C' : (i > 0 && !isV(w[i - 1]) ? 'V' : 'C');
      t.push({ s: c, k }); i++;
    }
    return t;
  };
  const C = new Map(), V = new Map(), shapes = new Map(); const sylCounts = [];
  for (const w of parts) {
    const t = tokens(w); for (const x of t) { if (x.k === 'C') C.set(x.s, (C.get(x.s) || 0) + 1); else if (x.k === 'V') V.set(x.s, (V.get(x.s) || 0) + 1); }
    const vi = t.map((x, i) => (x.k === 'V' ? i : -1)).filter((i) => i >= 0); if (!vi.length) continue; sylCounts.push(vi.length);
    const starts = vi.map((v, n) => { if (n === 0) return 0; let a = v; if (t[v - 1] && t[v - 1].k !== 'V' && v - 1 > vi[n - 1]) a = v - 1; if (t[a - 1] && t[a - 1].k === 'G' && a - 1 > vi[n - 1]) a -= 1; return a; });
    starts.forEach((a, n) => { const z = n + 1 < starts.length ? starts[n + 1] : t.length; const sh = t.slice(a, z).map((x) => (x.k === 'G' ? "'" : x.k)).join(''); shapes.set(sh, (shapes.get(sh) || 0) + 1); });
  }
  const byCount = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  const top = byCount(shapes).filter(([s]) => /V/.test(s)).slice(0, 5);
  const patterns = top.flatMap(([s, n], i) => (i === 0 && n >= 3 ? [s, s] : [s])).join(' ') || 'CV CVC';
  sylCounts.sort((a, b) => a - b);
  const pct = (p) => sylCounts.length ? sylCounts[Math.min(sylCounts.length - 1, Math.floor(p * (sylCounts.length - 1)))] : 1;
  const ph = { consonants: byCount(C).map(([s]) => s).join(' '), vowels: byCount(V).map(([s]) => s).join(' '), patterns, forbidden: '', minSyl: Math.max(1, pct(0.1)), maxSyl: Math.min(4, Math.max(pct(0.9), pct(0.1))) };
  const acute = words.some((w) => /[áéíóúý]/.test(w));
  if (acute) ph.acute = true;
  // word endings: pairs whose meanings differ by "-s", "-ed", "not …"…
  const found = new Map();
  for (const a of entries) for (const b of entries) {
    if (a === b) continue; const am = String(a.meaning).toLowerCase().trim(), bm = String(b.meaning).toLowerCase().trim();
    const d = LH_DERIV.find((x) => x.test(am, bm)); if (!d) continue;
    const aw = String(a.word).toLowerCase(), bw = String(b.word).toLowerCase(); let form = null, type = null;
    if (/\s/.test(bw) && !/\s/.test(aw)) { const ws = bw.split(/\s+/); if (ws.includes(aw)) { form = ws.filter((x) => x !== aw).join(' '); type = 'word'; } }
    else if (bw.startsWith(aw) && bw.length > aw.length) { form = bw.slice(aw.length).replace(/^-/, '').trim(); type = 'suffix'; }
    else if (bw.endsWith(aw) && bw.length > aw.length) { form = bw.slice(0, bw.length - aw.length).replace(/-$/, '').trim(); type = 'prefix'; }
    if (!form) continue; const k = d.m + '|' + type + '|' + form;
    const cur = found.get(k) || { m: d.m, form, type, n: 0, ex: `${a.word} → ${b.word} (${am} → ${bm})` }; cur.n++; found.set(k, cur);
  }
  const affixes = []; for (const x of [...found.values()].sort((a, b) => b.n - a.n)) if (!affixes.some((y) => y.m === x.m)) affixes.push(x);
  const notes = [];
  if (words.some((w) => /['’ʼ]/.test(w))) notes.push('Apostrophes in your words are read as a catch in the voice (as in uh-oh).');
  if (words.some((w) => /-/.test(w))) notes.push('Hyphenated words are read as compounds; each part is said on its own.');
  return { ph, affixes, notes, stats: { words: entries.length, shapes: top, sylMin: ph.minSyl, sylMax: ph.maxSyl, digraphs, acute } };
}
