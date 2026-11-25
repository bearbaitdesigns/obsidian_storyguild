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

function openLanguageHelper(f) {
  const fm0 = S.fm(f); const cur = Object.assign({}, fm0.phonology || {});
  const hasSounds = !!(cur.consonants && cur.vowels);
  const st = {
    step: 0, feel: hasSounds ? 'keep' : null,
    ph: hasSounds ? Object.assign({ patterns: 'CV CVC', forbidden: '', minSyl: 1, maxSyl: 2 }, cur) : null,
    order: fm0.wordOrder || '', morph: fm0.morphology || '',
    groups: Object.fromEntries(LH_WORDS.map((g) => [g.id, !!g.on])), extra: '', words: {},
    affixes: LH_AFFIXES.map((a) => ({ ...a, form: '' })), samples: [],
  };
  const known = new Set(arr(fm0.lexicon).flatMap((e) => String(e.meaning || '').toLowerCase().split(/\s*[,;/]\s*/)).filter(Boolean));
  const taken = () => new Set([...arr(S.fm(f).lexicon).map((e) => e.word), ...Object.values(st.words)]);
  /* everyday words stay short, as they do in real languages: little words get one syllable, core words at most one more than the shortest */
  const shortPh = () => Object.assign({}, st.ph, { minSyl: 1, maxSyl: 1 });
  const corePh = () => { const mn = Math.max(1, +st.ph.minSyl || 1); return Object.assign({}, st.ph, { minSyl: mn, maxSyl: Math.min(Math.max(mn, +st.ph.maxSyl || mn), mn + 1) }); };
  const phFor = (x) => (x.short ? shortPh() : x.story ? st.ph : corePh());
  const sample = () => { const ex = taken(); st.samples = []; for (let i = 0; i < 10; i++) { const w = genWord(st.ph, ex); if (w) { st.samples.push(w); ex.add(w); } } };
  const wantedWords = () => {
    const out = [];
    for (const g of LH_WORDS) if (st.groups[g.id]) for (const m of g.words) out.push({ m, pos: g.pos || (g.id === 'people' && /^(I|you|we|they)$/.test(m) ? 'pron' : 'noun'), short: !!g.short || (g.id === 'people' && /^(I|you|we|they)$/.test(m)) });
    for (const m of st.extra.split(/[\n,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean)) out.push({ m, pos: 'noun', short: false, story: true });
    const seen = new Set(); return out.filter((x) => { const k = x.m.toLowerCase(); if (known.has(k) || seen.has(k)) return false; seen.add(k); return true; });
  };
  const coinWords = (force) => {
    const ex = taken(); if (force) { for (const w of Object.values(st.words)) ex.delete(w); st.words = {}; }
    for (const x of wantedWords()) { if (st.words[x.m]) continue; const w = genWord(phFor(x), ex); if (w) { st.words[x.m] = w; ex.add(w); } }
  };
  const affixType = () => (st.order === 'VSO' || st.order === 'VOS' ? 'prefix' : 'suffix');
  const coinAffixes = (force) => {
    const ex = new Set(); const base = Object.assign({}, st.ph, { patterns: 'V VC CV', minSyl: 1, maxSyl: 1 });
    for (const a of st.affixes) { if (a.form && !force) { ex.add(a.form); continue; } const w = genWord(base, ex) || 'a'; ex.add(w); a.form = w; }
  };

  const box = h('div', { class: 'wk-suggest lh' }); const close = modalShell(box, { wide: true });
  const STEPS = ['Sound', 'Grammar', 'Words', 'Endings', 'Review'];
  const draw = () => {
    const head = h('div', { class: 'lh-head' }, h('div', { class: 'wk-sg-title' }, `🧭 Language helper · ${f.basename}`),
      h('div', { class: 'lh-steps' }, ...STEPS.map((n, i) => h('span', { class: 'lh-step' + (i === st.step ? ' is-on' : i < st.step ? ' is-done' : '') }, `${i + 1}. ${n}`))));
    const body = h('div', { class: 'lh-body' }); const nextOk = [() => !!st.ph, () => !!st.order && !!st.morph, () => true, () => true, () => true][st.step];
    if (st.step === 0) stepSound(body); else if (st.step === 1) stepGrammar(body); else if (st.step === 2) stepWords(body); else if (st.step === 3) stepEndings(body); else stepReview(body);
    const back = h('button', { onclick: () => { st.step--; draw(); } }, '← Back'); if (!st.step) back.disabled = true;
    const next = st.step < 4 ? h('button', { class: 'mod-cta', onclick: () => { if (!nextOk()) return; st.step++; if (st.step === 2) coinWords(); if (st.step === 3) coinAffixes(); draw(); } }, 'Next →') : h('button', { class: 'mod-cta', onclick: apply }, '✓ Add to my language');
    if (!nextOk()) next.disabled = true;
    box.replaceChildren(head, body, h('div', { class: 'wk-sg-foot lh-foot' }, h('button', { onclick: () => close() }, 'Cancel'), h('span', { class: 'cd-spacer' }), back, next));
    body.scrollTop = 0;
  };
  const tip = (t) => h('div', { class: 'lh-tip' }, h('b', {}, '💡 '), t);

  function stepSound(body) {
    ap(body, h('p', { class: 'lh-lead' }, 'Start with how the language sounds. Readers judge a language by its sounds long before its grammar, so pick a feel and tune it until the sample words sound right for the people who speak it.'));
    const feels = hasSounds ? [{ id: 'keep', icon: '🔊', name: 'Keep my sounds', blurb: 'Use the consonants and vowels already on this note.', ph: cur }, ...LH_FEELS] : LH_FEELS;
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
    ap(body, h('div', { class: 'lh-card' }, h('h4', {}, 'Sample words'), h('div', { class: 'cl-gen' }, ...st.samples.map((w) => h('span', { class: 'lh-sample' }, w))),
      h('div', { class: 'cl-actions' }, h('button', { onclick: () => { sample(); draw(); } }, '🎲 New samples'))));
    ap(body, tip('Fewer sounds make a language feel more distinct. Around 10–15 consonants and 3–6 vowels is plenty. If a word looks unpronounceable, add the clumsy pair to “Never allow”.'));
  }
  function stepGrammar(body) {
    ap(body, h('p', { class: 'lh-lead' }, 'Two choices shape every sentence: the order of the main words, and how words change. You can keep it simple; these mostly guide how you write lines of dialogue.'));
    const opts = (key, help, values) => h('div', { class: 'lh-opts' }, ...values.map((v) => h('button', { class: 'lh-opt' + (st[key] === v ? ' is-on' : ''), onclick: () => { st[key] = v; draw(); } }, h('b', {}, v), h('small', {}, help[v] || ''))));
    const dv = (k) => (T().language.domain.find((x) => x.key === k) || { values: [] }).values;
    ap(body, h('div', { class: 'lh-card' }, h('h4', {}, 'Word order'), opts('order', LH_ORDER_HELP, dv('wordOrder'))));
    ap(body, h('div', { class: 'lh-card' }, h('h4', {}, 'How words change'), opts('morph', LH_MORPH_HELP, dv('morphology'))));
    ap(body, tip('Different from English is good, but not everywhere at once. One unusual choice (say, verb-first sentences) is memorable; five makes your readers work too hard.'));
  }
  function stepWords(body) {
    ap(body, h('p', { class: 'lh-lead' }, 'Coin a starter vocabulary. Common words come first because they turn up in names, places and oaths. Everyday words come out short, the way they are in real languages; your own story words can be longer.'));
    ap(body, h('div', { class: 'lh-groups' }, ...LH_WORDS.map((g) => { const c = h('input', { type: 'checkbox', checked: st.groups[g.id] }); c.addEventListener('change', () => { st.groups[g.id] = c.checked; coinWords(); draw(); });
      return h('label', { class: 'lh-group' }, c, h('b', {}, g.name), h('small', {}, g.words.slice(0, 6).join(', ') + (g.words.length > 6 ? '…' : ''))); })));
    const ta = h('textarea', { class: 'lh-extra', placeholder: 'Your own story words, one per line or comma-separated: lantern, tide, oath…' }, st.extra);
    ta.addEventListener('change', () => { st.extra = ta.value; coinWords(); draw(); });
    ap(body, h('div', { class: 'lh-card' }, h('h4', {}, 'Words from your story'), ta));
    const list = wantedWords();
    ap(body, h('div', { class: 'lh-card' }, h('h4', {}, `Preview · ${list.length} new words`, h('span', { class: 'cd-spacer' }), h('button', { class: 'lh-mini', onclick: () => { coinWords(true); draw(); } }, '🎲 Reroll all')),
      list.length ? h('div', { class: 'lh-wordlist' }, ...list.map((x) => h('button', { class: 'lh-word', title: 'Tap for a different word', onclick: () => { const ex = taken(); ex.delete(st.words[x.m]); const w = genWord(phFor(x), ex); if (w) st.words[x.m] = w; draw(); } }, h('b', {}, st.words[x.m] || '—'), h('small', {}, x.m))))
        : h('div', { class: 'cs-hint' }, known.size ? 'Every word you picked is already in the lexicon.' : 'Pick a group above or add your own words.'),
      known.size ? h('div', { class: 'cs-hint cs-mt' }, 'Meanings already in your lexicon are skipped.') : null));
    ap(body, tip('Tap any word to roll a new one. Words for important things in your story (a god, the sea, a city) are worth rerolling until they feel right.'));
  }
  function stepEndings(body) {
    ap(body, h('p', { class: 'lh-lead' }, st.morph === 'Isolating' ? 'Your language is isolating, so these become small separate words placed next to the word they change, rather than endings.' : `Endings (or beginnings) change a word's meaning. With ${st.order || 'your'} word order they work best as ${affixType()}es.`));
    ap(body, h('div', { class: 'lh-card' }, h('h4', {}, 'Pieces to add', h('span', { class: 'cd-spacer' }), h('button', { class: 'lh-mini', onclick: () => { coinAffixes(true); draw(); } }, '🎲 Reroll')),
      ...st.affixes.map((a) => { const c = h('input', { type: 'checkbox', checked: a.on }); c.addEventListener('change', () => { a.on = c.checked; draw(); });
        const fi = h('input', { type: 'text', class: 'lh-affix', value: a.form }); fi.addEventListener('change', () => { a.form = fi.value.trim().replace(/^-|-$/g, ''); draw(); });
        const ex = st.words.star || st.words.person || st.words.stone || Object.values(st.words)[0]; const shown = affixType() === 'prefix' ? `${a.form}-` : `-${a.form}`;
        return h('label', { class: 'lh-affrow' + (a.on ? '' : ' is-off') }, c, h('span', { class: 'lh-affm' }, a.m), fi, h('small', {}, st.morph === 'Isolating' ? '' : shown + (ex ? ` · ${affixType() === 'prefix' ? a.form + ex : ex + a.form}` : ''))); })));
    ap(body, tip('The Translator uses the plural and past-tense pieces automatically, so “stars” and “walked” translate once those exist.'));
  }
  function stepReview(body) {
    const words = wantedWords().filter((x) => st.words[x.m]); const aff = st.affixes.filter((a) => a.on && a.form);
    const opt = (k, label, on = true) => { if (!(k in st)) st[k] = on; const c = h('input', { type: 'checkbox', checked: st[k] }); c.addEventListener('change', () => { st[k] = c.checked; }); return h('label', { class: 'lh-check' }, c, label); };
    ap(body, h('p', { class: 'lh-lead' }, 'Here is what will be added to this note. Everything stays editable afterwards on the Sounds, Lexicon and Grammar tabs.'));
    ap(body, h('div', { class: 'lh-card' },
      opt('doSounds', `Sound settings: ${String(st.ph.consonants).split(/\s+/).filter(Boolean).length} consonants, ${String(st.ph.vowels).split(/\s+/).filter(Boolean).length} vowels, shapes ${st.ph.patterns}`, true),
      opt('doGrammar', `Word order ${st.order} · ${st.morph}`, true),
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
      if (st.doSounds !== false) x.phonology = { consonants: st.ph.consonants, vowels: st.ph.vowels, patterns: st.ph.patterns, forbidden: st.ph.forbidden || '', minSyl: +st.ph.minSyl || 1, maxSyl: +st.ph.maxSyl || 2 };
      if (st.doGrammar !== false) { if (st.order) x.wordOrder = st.order; if (st.morph) x.morphology = st.morph; }
      x.lexicon = arr(x.lexicon); x.affixes = arr(x.affixes);
      if (st.doWords !== false) for (const y of words) x.lexicon.push({ word: st.words[y.m], pos: y.pos, meaning: y.m });
      if (st.doAffixes !== false) for (const a of aff) {
        if (isol) x.lexicon.push({ word: a.form, pos: 'particle', meaning: a.m + ' marker' });
        else if (!x.affixes.some((b) => b.meaning === a.m)) x.affixes.push({ affix: affixType() === 'prefix' ? a.form + '-' : '-' + a.form, type: affixType(), meaning: a.m });
      }
    });
    close(); toast(`${f.basename}: added ${st.doWords !== false ? words.length : 0} words${st.doAffixes !== false && aff.length ? ` and ${aff.length} ${isol ? 'markers' : 'endings'}` : ''}`);
  }
  if (st.ph) sample();
  draw();
}
