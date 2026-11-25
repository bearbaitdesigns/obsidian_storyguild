/* =====================================================================
   Wordwright: constructed languages as notes of their own.
   A Language note (Worldkeeper) is the language as your world knows it:
   who speaks it, where, its history. Its conlang lives in a Wordwright
   note (type: conlang) linked both ways:
     Language note  → conlang: "[[Old Tide (conlang)]]"
     conlang note   → language: "[[Old Tide]]"
   Notes that mention a language always link the Language note; the
   conlang's name ends in "(conlang)" so links never get mixed up.
   ===================================================================== */
const WW_TYPE = 'conlang';
const VIEW_WW = 'worldkeeper-wordwright';
const WW_BLOCK = 'wordwright';
const WW_PH = { consonants: '', vowels: '', patterns: 'CV CVC', forbidden: '', minSyl: 1, maxSyl: 2 };
const isConlang = (f) => !!f && f.extension === 'md' && String(arr(S.fm(f).type)[0] ?? '').toLowerCase() === WW_TYPE;
const isLanguage = (f) => !!f && S.typeIdOf(f) === 'language';

const WW = {
  all() { return S.files().filter(isConlang).sort(byName); },
  folder() { return normalizePath(String(ST().conlangFolder || '{root}/Conlangs').replace('{root}', ST().root)); },
  languageOf(c) { return c ? S.linkFiles(c, 'language').find(isLanguage) || S.linkFiles(c, 'language')[0] || null : null; },
  conlangOf(lang) {
    if (!lang) return null;
    const own = S.linkFiles(lang, 'conlang').find(isConlang); if (own) return own;
    return WW.all().find((c) => { const l = WW.languageOf(c); return l && l.path === lang.path; }) || null;
  },
  /** a name that can never be confused with a Language note's name */
  safeName(name) {
    let nm = safeName(String(name || '').trim()); if (!nm) return '';
    const clash = S.notesOf('language').some((l) => l.basename.toLowerCase() === nm.toLowerCase());
    if (clash && !/\(conlang\)$/i.test(nm)) nm += ' (conlang)';
    return nm;
  },
  async create(name, { language = null, open = true, data = {} } = {}) {
    const nm = WW.safeName(name || (language ? language.basename + ' (conlang)' : '')); if (!nm) return null;
    const folder = WW.folder(); await S.ensureFolder(folder);
    const path = normalizePath(`${folder}/${nm}.md`);
    let f = app().vault.getAbstractFileByPath(path);
    if (!(f instanceof TFile)) {
      f = await app().vault.create(path, '```wordwright\n```\n');
      await S.write(f, (fm) => { fm.type = WW_TYPE; fm.phonology = Object.assign({}, WW_PH, data.phonology || {}); fm.lexicon = arr(data.lexicon); fm.affixes = arr(data.affixes); for (const k of ['wordOrder', 'morphology', 'script']) if (data[k]) fm[k] = data[k]; fm.links = []; });
    }
    if (language) await WW.link(f, language);
    S.dirty();
    if (open) await app().workspace.getLeaf(false).openFile(f);
    return f;
  },
  /** link a conlang and a Language note both ways (and undo any older pairing on either side) */
  async link(c, lang) {
    const oldLang = WW.languageOf(c); const oldC = S.linkFiles(lang, 'conlang').find(isConlang);
    if (oldLang && oldLang.path !== lang.path) await S.write(oldLang, (x) => { delete x.conlang; });
    if (oldC && oldC.path !== c.path) await S.write(oldC, (x) => { delete x.language; });
    await S.write(c, (x) => { x.language = S.link(lang, c.path); });
    await S.write(lang, (x) => { x.conlang = S.link(c, lang.path); });
    await WW.syncTypology(c);
  },
  async unlink(c) {
    const lang = WW.languageOf(c);
    await S.write(c, (x) => { delete x.language; });
    if (lang) await S.write(lang, (x) => { delete x.conlang; });
  },
  /** word order, morphology and script are tiles on the Language note too: keep them the same */
  async syncTypology(c) {
    const lang = WW.languageOf(c); if (!lang) return; const cf = S.fm(c); const lf = S.fm(lang);
    const ks = ['wordOrder', 'morphology', 'script'].filter((k) => cf[k] && cf[k] !== lf[k]);
    const pull = ['wordOrder', 'morphology', 'script'].filter((k) => !cf[k] && lf[k]);
    if (ks.length) await S.write(lang, (x) => { for (const k of ks) x[k] = cf[k]; });
    if (pull.length) await S.write(c, (x) => { for (const k of pull) x[k] = lf[k]; });
  },
  /** notes linking to this note (any kind) */
  backlinks(f) {
    const rl = app().metadataCache.resolvedLinks || {}; const out = [];
    for (const [src, tgts] of Object.entries(rl)) if (tgts && tgts[f.path] && src !== f.path) { const x = app().vault.getAbstractFileByPath(src); if (x instanceof TFile) out.push(x); }
    return out.sort(byName);
  },
};

/* ---------- translation (English → conlang) ---------- */
const WW_ARTICLES = ['the', 'a', 'an'];
const wwSplit = (m) => String(m || '').toLowerCase().split(/\s*[,;/]\s*/).map((x) => x.trim()).filter(Boolean);
function wwFind(lex, meaning) { const w = String(meaning).toLowerCase(); return lex.find((e) => wwSplit(e.meaning).includes(w)) || null; }
const wwAff = (fm, re) => arr(fm.affixes).find((a) => re.test(a.meaning || ''));
const wwApply = (a, b) => (a.type === 'prefix' ? String(a.affix).replace(/-$/, '') + b : b + String(a.affix).replace(/^-/, ''));
/** One English word or phrase → { out, gloss } using the lexicon and the plural / past-tense affixes; null if unknown. */
function wwLookup(fm, word) {
  const lex = arr(fm.lexicon); const w = String(word).toLowerCase(); const first = (e) => wwSplit(e.meaning)[0] || '';
  const e = wwFind(lex, w); if (e) return { out: e.word, gloss: first(e), entry: e };
  const pl = wwAff(fm, /plural/i);
  if (/s$/.test(w)) { const b = wwFind(lex, w.replace(/(ies)$/, 'y')) || wwFind(lex, w.replace(/(es|s)$/, '')) || wwFind(lex, w.slice(0, -1)); if (b && b.pos === 'verb') return { out: b.word, gloss: first(b), entry: b }; if (b && pl) return { out: wwApply(pl, b.word), gloss: first(b) + '-PL', entry: b }; }
  const pt = wwAff(fm, /past/i);
  if (pt && /ed$/.test(w)) { const b = wwFind(lex, w.replace(/ied$/, 'y')) || wwFind(lex, w.replace(/ed$/, '')) || wwFind(lex, w.replace(/d$/, '')); if (b) return { out: wwApply(pt, b.word), gloss: 'PST-' + first(b), entry: b }; }
  return null;
}
const WW_FUNC = { prep: ['in', 'on', 'at', 'to', 'of', 'from', 'with', 'by', 'for', 'into', 'under', 'over', 'through', 'without', 'near'], conj: ['and', 'or', 'but', 'if', 'because', 'so'], pron: ['i', 'me', 'you', 'he', 'him', 'she', 'her', 'it', 'we', 'us', 'they', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that'], particle: ['not', 'no', 'yes'] };
const wwPos = (w) => { for (const [k, l] of Object.entries(WW_FUNC)) if (l.includes(w)) return k; return /ly$/.test(w) ? 'adv' : /(ed|ing)$/.test(w) ? 'verb' : 'noun'; };
/**
 * Translate English text. Words in the lexicon are swapped in (longest phrase first); articles can be dropped;
 * capitalised words inside a sentence are treated as names and kept. With coin = true, missing words get new
 * words built from the language's sounds (the base form, with the plural / past affix added when there is one).
 * Returns { text, tokens, coined, missing }. Nothing is written; see wwTranslateAndSave.
 */
const WW_AUX = ['will', 'would', 'shall', 'did', 'do', 'does', 'can', 'could', 'must', 'may', 'might', 'should', 'is', 'are', 'was', 'were', 'am', 'be', 'been', 'has', 'have', 'had'];
/** the part of speech a translated word plays in its English sentence */
function wwRole(lw, entry, fallback) {
  if (WW_AUX.includes(lw)) return 'aux';
  if (['not', 'never', "don't", "didn't", "won't", "can't"].includes(lw)) return 'neg';
  if (entry && entry.pos) return entry.pos;
  return fallback || (typeof lhGuessPos === 'function' ? lhGuessPos(lw) : wwPos(lw));
}
/**
 * Put one clause's words into the language's word order. Subject = the words before the verb, verb = the verb with
 * any helping words and "not" next to it, object = what follows up to the first preposition, the rest (places,
 * times) goes before the verb in verb-final orders and at the end otherwise. Adjectives follow their noun when the
 * grammar says so. Clauses without a verb, and "Free" order, keep the English order.
 */
function wwReorder(words, order, adjAfter) {
  let w = words.slice();
  if (adjAfter) for (let i = 0; i < w.length - 1; i++) if (w[i].role === 'adj' && ['noun', 'name', 'pron'].includes(w[i + 1].role)) { const t = w[i]; w[i] = w[i + 1]; w[i + 1] = t; i++; }
  if (!/^[SVO]{3}$/.test(order || '')) return w;
  const v = w.findIndex((x) => x.role === 'verb'); if (v < 0) return w;
  let a = v, z = v;
  while (a > 0 && ['aux', 'neg', 'adv'].includes(w[a - 1].role)) a--;
  while (z + 1 < w.length && ['verb', 'aux', 'neg'].includes(w[z + 1].role) && w[z + 1].role !== 'neg') z++;
  const S = w.slice(0, a), V = w.slice(a, z + 1), after = w.slice(z + 1);
  const pi = after.findIndex((x) => x.role === 'prep');
  const O = pi < 0 ? after : after.slice(0, pi), X = pi < 0 ? [] : after.slice(pi);
  const groups = { S, V, O }; const out = [];
  for (const k of order) { if (k === 'V' && order.endsWith('V')) out.push(...X); out.push(...groups[k]); }
  if (!order.endsWith('V')) out.push(...X);
  return out;
}
/**
 * Translate English text. Words in the lexicon are swapped in (longest phrase first); articles can be dropped;
 * capitalised words inside a sentence are treated as names and kept. With coin = true, missing words get new
 * words built from the language's sounds (the base form, with the plural / past affix added when there is one).
 * With arrange = true (the default) each clause is put into the language's word order.
 * Returns { text, tokens, coined, missing, arranged }. Nothing is written; see wwTranslateAndSave.
 */
function wwTranslate(fm, text, { coin = false, drop = true, arrange = true } = {}) {
  const ph = Object.assign({}, WW_PH, fm.phonology || {}); const lex = arr(fm.lexicon).slice(); const fmx = Object.assign({}, fm, { lexicon: lex });
  const parts = String(text || '').match(/[A-Za-zÀ-ÖØ-öø-ÿ'’]+|[^A-Za-zÀ-ÖØ-öø-ÿ'’]+/g) || [];
  const isWord = (p) => /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(p);
  const existing = new Set(lex.map((e) => e.word)); const coined = []; const missing = [];
  const canCoin = coin && sayInventory(ph).C.length && sayInventory(ph).V.length;
  const order = arrange ? fm.wordOrder : ''; const adjAfter = arrange && /after/i.test(String((fm.grammar || {}).adjPos || ''));
  // sentences: [{ words: [{ o, gloss, role, name, cap, punct }], end }]
  const sentences = []; let cur = { words: [], lead: '', cap: false, end: '' }; let sentenceStart = true; let capNext = false; let arranged = false;
  const flush = (end) => { if (cur.words.length || end.trim()) { cur.end = end; sentences.push(cur); } else if (end) { if (sentences.length) sentences[sentences.length - 1].end += end; else cur.lead += end; } cur = { words: [], lead: cur.words.length ? '' : cur.lead, cap: false, end: '' }; };
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!isWord(p)) {
      if (/[.!?;:\n]/.test(p)) { flush(p); sentenceStart = true; continue; }
      const punct = p.replace(/\s+/g, ''); if (punct && cur.words.length) cur.words[cur.words.length - 1].punct += punct; else if (!cur.words.length && !sentences.length) cur.lead += p.replace(/\s+/g, ' ').trimStart();
      continue;
    }
    const lw = p.toLowerCase().replace(/’/g, "'");
    if (drop && WW_ARTICLES.includes(lw)) { if (/^[A-Z]/.test(p) && sentenceStart) cur.cap = true; if (parts[i + 1] && /^\s+$/.test(parts[i + 1])) i++; continue; }
    if (sentenceStart && /^[A-Z]/.test(p)) cur.cap = true;
    // longest phrase: up to three words joined by single spaces
    let hit = null; let used = 0;
    for (let n = 3; n >= 2 && !hit; n--) {
      const seq = []; let j = i; let ok = true;
      for (let k = 0; k < n; k++) { if (!parts[j] || !isWord(parts[j])) { ok = false; break; } seq.push(parts[j].toLowerCase()); if (k < n - 1) { if (!parts[j + 1] || !/^ +$/.test(parts[j + 1])) { ok = false; break; } j += 2; } }
      if (!ok) continue; const e = wwFind(lex, seq.join(' ')); if (e) { hit = { out: e.word, gloss: wwSplit(e.meaning)[0], entry: e }; used = (n - 1) * 2; }
    }
    if (!hit) hit = wwLookup(fmx, lw);
    if (hit && hit.gloss && /^PST-/.test(hit.gloss)) hit.role = 'verb';
    const isName = !sentenceStart && /^[A-Z]/.test(p) && lw !== 'i';
    sentenceStart = false;
    if (!hit && isName) { cur.words.push({ o: p, src: p, gloss: 'name', role: 'name', name: true, punct: '' }); continue; }
    if (!hit && canCoin) {
      const pl = wwAff(fmx, /plural/i), pt = wwAff(fmx, /past/i);
      let base = lw, aff = null;
      if (pl && /[^s]s$/.test(lw) && lw.length > 3 && wwRole(lw.replace(/s$/, ''), null) !== 'verb') { base = lw.replace(/ies$/, 'y').replace(/(?<=[sxz]|ch|sh)es$/, '').replace(/s$/, ''); aff = pl; }
      else if (pt && /ed$/.test(lw) && lw.length > 4) { base = lw.replace(/ied$/, 'y').replace(/ed$/, ''); aff = pt; }
      else if (/[^s]s$/.test(lw) && lw.length > 3 && wwRole(lw.replace(/s$/, ''), null) === 'verb') base = lw.replace(/s$/, '');
      const ex = wwFind(lex, base);
      const w = ex ? ex.word : genWord(ph, existing);
      if (w) {
        let entry = ex;
        if (!ex) { existing.add(w); entry = { word: w, pos: aff === pt && aff ? 'verb' : wwRole(base, null), meaning: base }; if (WW_AUX.includes(base)) entry.pos = 'verb'; lex.push(entry); coined.push(entry); }
        hit = { out: aff ? wwApply(aff, w) : w, gloss: aff === pl && aff ? base + '-PL' : aff ? 'PST-' + base : base, coined: !ex, entry, role: aff === pt && aff ? 'verb' : null };
      }
    }
    if (!hit) { missing.push(lw); cur.words.push({ o: `[${p}]`, src: p, gloss: '?', role: wwRole(lw, null), unknown: true, punct: '' }); continue; }
    cur.words.push({ o: hit.out, src: used ? parts.slice(i, i + used + 1).join('') : p, gloss: hit.gloss, coined: !!hit.coined, role: hit.role || wwRole(lw, hit.entry), punct: '' });
    i += used;
  }
  flush('');
  // arrange each sentence, then write it out
  const tokens = []; let outText = '';
  for (const sn of sentences) {
    const ws = arrange ? wwReorder(sn.words, order, adjAfter) : sn.words;
    if (ws.some((x, i) => x !== sn.words[i])) arranged = true;
    // commas stay where they were in the sentence: re-attach them by position
    const commas = sn.words.map((x) => x.punct);
    const line = ws.map((x, i) => { let o = x.o; if (i === 0 && sn.cap && !x.name) o = o.charAt(0).toUpperCase() + o.slice(1); return o + (commas[i] || ''); }).join(' ');
    outText += (sn.lead || '') + line + (sn.end || '');
    for (const x of ws) tokens.push({ src: x.src, out: x.unknown ? null : x.o, gloss: x.gloss, coined: x.coined, name: x.name, unknown: x.unknown, role: x.role });
  }
  return { text: outText.replace(/ {2,}/g, ' ').replace(/^ +/, '').replace(/ +([.!?;:,])/g, '$1'), tokens, coined, missing: [...new Set(missing)], arranged, order: order || '' };
}
/** copy text to the clipboard, with a small confirmation */
function wwCopy(text, what = 'Translation') { try { navigator.clipboard.writeText(text).then(() => toast(`${what} copied`), () => toast('Couldn’t copy; select the text and copy it instead')); } catch (e) { toast('Couldn’t copy; select the text and copy it instead'); } }
/** translate, add any coined words to the conlang's lexicon, and say so */
async function wwTranslateAndSave(c, text, opts = {}) {
  const r = wwTranslate(S.fm(c), text, opts);
  if (r.coined.length) {
    await S.write(c, (x) => { x.lexicon = arr(x.lexicon); const have = new Set(x.lexicon.map((e) => e.word)); for (const e of r.coined) if (!have.has(e.word)) x.lexicon.push(e); });
    toast(`${c.basename}: ${r.coined.length === 1 ? 'a new word was' : r.coined.length + ' new words were'} created: ${r.coined.map((e) => `${e.word} = ${e.meaning}`).join(', ')}`);
  }
  return r;
}

/* ---------- the master word list: groups from the helper plus 100 more everyday words ---------- */
const WW_MORE_WORDS = ['house', 'door', 'window', 'bread', 'salt', 'meat', 'fish', 'bird', 'dog', 'horse', 'wolf', 'snake', 'flower', 'grass', 'leaf', 'seed', 'root', 'sand', 'ice', 'snow',
  'rain', 'cloud', 'storm', 'gold', 'iron', 'silver', 'ship', 'boat', 'sword', 'shield', 'bow', 'arrow', 'ring', 'crown', 'knife', 
  'book', 'song', 'dream', 'spirit', 'soul', 'death', 'life', 'time', 'year', 'morning', 'evening', 'food', 'bridge', 'island', 'forest', 'field', 'lake', 'shore', 'cave', 'hill',
  'valley', 'village', 'run', 'walk', 'sit', 'stand', 'fall', 'fly', 'swim', 'sing', 'cry', 'laugh', 'think', 'remember', 'forget', 'ask', 'answer', 'hold', 'carry', 'build',
  'break', 'burn', 'open', 'close', 'find', 'lose', 'wait', 'live', 'hunt', 'grow', 'long', 'short', 'high', 'low', 'heavy', 'sharp', 'soft', 'hard', 'wet', 'dry', 'full', 'empty',
  'strong', 'weak', 'young', 'fast', 'slow', 'quiet', 'loud', 'beautiful', 'strange', 'wild', 'free', 'red', 'black', 'white', 'green', 'blue', 'yellow'];
const WW_MORE_POS = (m) => (['run', 'walk', 'sit', 'stand', 'fall', 'fly', 'swim', 'sing', 'cry', 'laugh', 'think', 'remember', 'forget', 'ask', 'answer', 'hold', 'carry', 'build', 'break', 'burn', 'open', 'close', 'find', 'lose', 'wait', 'live', 'hunt', 'grow'].includes(m) ? 'verb'
  : ['long', 'short', 'high', 'low', 'heavy', 'sharp', 'soft', 'hard', 'wet', 'dry', 'full', 'empty', 'strong', 'weak', 'young', 'fast', 'slow', 'quiet', 'loud', 'beautiful', 'strange', 'wild', 'free', 'red', 'black', 'white', 'green', 'blue', 'yellow'].includes(m) ? 'adj' : 'noun');
/** every starter meaning, in order, with its part of speech and whether it should be a short word */
function wwMasterList() {
  const seen = new Set(); const out = [];
  for (const g of LH_WORDS) for (const m of g.words) { const k = m.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push({ m, pos: g.pos || (g.id === 'people' && /^(I|you|we|they)$/.test(m) ? 'pron' : 'noun'), short: !!g.short || /^(I|you|we|they)$/.test(m) }); }
  for (const m of WW_MORE_WORDS) { if (seen.has(m)) continue; seen.add(m); out.push({ m, pos: WW_MORE_POS(m), short: false }); }
  return out;
}
/** coin up to n words for starter meanings the lexicon doesn't have yet */
function wwCoinMore(fm, n = 100) {
  const ph = Object.assign({}, WW_PH, fm.phonology || {}); const lex = arr(fm.lexicon);
  const known = new Set(lex.flatMap((e) => wwSplit(e.meaning))); const existing = new Set(lex.map((e) => e.word)); const out = [];
  const mn = Math.max(1, +ph.minSyl || 1); const core = Object.assign({}, ph, { maxSyl: Math.min(Math.max(mn, +ph.maxSyl || mn), mn + 1) }); const short = Object.assign({}, ph, { minSyl: 1, maxSyl: 1 });
  for (const x of wwMasterList()) { if (out.length >= n) break; if (known.has(x.m.toLowerCase())) continue; const w = genWord(x.short ? short : core, existing); if (!w) break; existing.add(w); out.push({ word: w, pos: x.pos, meaning: x.m }); }
  return out;
}

/* ---------- grammar features, numbers, phrasebook, names ---------- */
const WW_GRAMMAR = [
  { k: 'gender', label: 'Noun classes', opts: ['None', 'Masculine / feminine', 'Masculine / feminine / neuter', 'Animate / inanimate', 'Many classes'], help: 'Groups that nouns fall into. Words that go with a noun change to match its class.' },
  { k: 'number', label: 'Number', opts: ['None (context shows it)', 'Singular / plural', 'Singular / dual / plural', 'Singular / few / many'], help: 'Whether nouns show one, two or many.' },
  { k: 'cases', label: 'Cases', opts: ['None (word order shows who does what)', 'Subject / object', 'Ergative (doer marked)', 'Many cases (five or more)'], help: 'Endings that show a noun’s role: doer, receiver, place, owner…' },
  { k: 'articles', label: 'Articles', opts: ['None', 'Definite only (the)', 'Definite and indefinite (the, a)', 'Shown by an affix'], help: 'Little words like “the” and “a”, or none at all.' },
  { k: 'adjPos', label: 'Describing words', opts: ['Before the noun (red house)', 'After the noun (house red)'], help: 'Where adjectives go.' },
  { k: 'possession', label: 'Possession', opts: ['Owner first (Ilsa’s house)', 'Owned thing first (house of Ilsa)', 'An affix on the noun'], help: 'How to say whose something is.' },
  { k: 'tense', label: 'Tense', opts: ['None (context shows it)', 'Past / not past', 'Past / present / future', 'Many tenses'], help: 'Whether verbs show when something happens.' },
  { k: 'aspect', label: 'Aspect', opts: ['None', 'Finished / ongoing', 'Many aspects'], help: 'Whether verbs show if an action is finished, ongoing or habitual.' },
  { k: 'questions', label: 'Yes/no questions', opts: ['Rising voice only', 'A question word at the start', 'A question word at the end', 'The verb moves first'], help: 'How a statement becomes a question.' },
  { k: 'negation', label: 'Saying “not”', opts: ['A word before the verb', 'A word after the verb', 'An affix on the verb'], help: 'Where “not” goes.' },
];
const WW_PRONOUNS = [['1st person', 'I', 'we'], ['2nd person', 'you', 'you (plural)'], ['3rd person', 'he, she, it', 'they']];
const WW_BASES = { 10: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'hundred', 'thousand'], 12: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'gross'], 20: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'four hundred'], 5: ['one', 'two', 'three', 'four', 'five', 'twenty-five'] };
const WW_NUMVAL = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, 'twenty-five': 25, hundred: 100, gross: 144, 'four hundred': 400, thousand: 1000 };
const WW_BASE_WORD = { 10: 'ten', 12: 'twelve', 20: 'twenty', 5: 'five' };
const WW_BIG_WORD = { 10: 'hundred', 12: 'gross', 20: 'four hundred', 5: 'twenty-five' };
/** spell a number with the language's number words, e.g. 23 in base 10 → two-ten-three */
function wwNumber(fm, n) {
  const base = +fm.numberBase || 10; const lex = arr(fm.lexicon); const w = (m) => (wwFind(lex, m) || {}).word;
  const unit = (d) => (d === 0 ? '' : WW_BASES[base][d - 1] ? w(WW_BASES[base][d - 1]) : null);
  if (n <= 0) return null; if (n < base) return unit(n) || null;
  const big = base * base; const parts = []; let rest = n;
  if (rest >= big) { const k = Math.floor(rest / big); if (k > 1) parts.push(unit(k)); parts.push(w(WW_BIG_WORD[base])); rest %= big; }
  if (rest >= base) { const k = Math.floor(rest / base); if (k > 1) parts.push(unit(k)); parts.push(w(WW_BASE_WORD[base])); rest %= base; }
  if (rest) parts.push(unit(rest));
  return parts.every(Boolean) ? parts.join('-') : null;
}
const WW_PHRASES = ['hello', 'goodbye', 'thank you', 'please', 'yes', 'no', 'welcome', 'good morning', 'good night', 'my name is …', 'what is your name?', 'where is …?', 'I do not understand', 'help!', 'be well', 'until we meet again'];
/** names: given names from the sounds, place names from meaningful words */
function wwNames(fm, kind, count = 12) {
  const ph = Object.assign({}, WW_PH, fm.phonology || {}); const lex = arr(fm.lexicon); const ex = new Set(lex.map((e) => e.word)); const out = [];
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  if (kind === 'place' || kind === 'family') {
    const nouns = lex.filter((e) => (e.pos === 'noun' || e.pos === 'adj') && e.word && !/\s/.test(e.word));
    const place = wwAff(fm, /place/i); const agent = wwAff(fm, /agent|one who/i);
    for (let i = 0; i < count * 3 && out.length < count && nouns.length; i++) {
      const a = pick(nouns), b = pick(nouns); if (a === b && nouns.length > 1) continue;
      let word = a.word + b.word; let meaning = `${wwSplit(a.meaning)[0]} ${wwSplit(b.meaning)[0]}`;
      if (kind === 'place' && place && Math.random() < 0.4) { word = wwApply(place, a.word); meaning = `place of ${wwSplit(a.meaning)[0]}`; }
      if (kind === 'family' && agent && Math.random() < 0.5) { word = wwApply(agent, a.word); meaning = `one who ${wwSplit(a.meaning)[0]}`; }
      if (!out.some((x) => x.name === cap(word))) out.push({ name: cap(word), meaning, kind });
    }
    return out;
  }
  const nm = Object.assign({}, ph, { minSyl: 2, maxSyl: 3 });
  for (let i = 0; i < count; i++) { const w = genWord(nm, ex); if (!w) break; ex.add(w); out.push({ name: cap(w), meaning: '', kind }); }
  return out;
}

/* ---------- language guide: the content for Word / PDF / book appendix ---------- */
const P_ = (text, extra = {}) => ({ t: 'p', runs: Array.isArray(text) ? text : [{ text: String(text) }], first: true, ...extra });
const H_ = (text) => ({ t: 'h', text: String(text) });
const B_ = (text) => ({ text: String(text), b: true }); const I_ = (text) => ({ text: String(text), i: true }); const T_ = (text) => ({ text: String(text) });
const WW_SECTIONS = [['intro', 'About the language'], ['sounds', 'Sounds & pronunciation'], ['grammar', 'Grammar'], ['numbers', 'Numbers'], ['lexicon', 'Dictionary'], ['index', 'English index'], ['phrases', 'Phrasebook'], ['names', 'Names'], ['writing', 'Writing']];
/** [{ title, blocks }] for the chosen sections */
function wwGuide(c, sections = WW_SECTIONS.map(([k]) => k)) {
  const fm = S.fm(c); const ph = Object.assign({}, WW_PH, fm.phonology || {}); const lex = arr(fm.lexicon).slice().sort((a, b) => String(a.word).localeCompare(String(b.word), undefined, { sensitivity: 'base' }));
  const lang = WW.languageOf(c); const name = lang ? lang.basename : c.basename.replace(/\s*\(conlang\)$/i, '');
  const want = new Set(sections); const out = [];
  const add = (k, title, blocks) => { if (want.has(k) && blocks.length) out.push({ title, blocks }); };
  { const L = [];
    const lf = lang ? S.fm(lang) : {};
    L.push(P_([T_(`${name} has ${lex.length} recorded words`), T_(arr(fm.affixes).length ? ` and ${arr(fm.affixes).length} word endings.` : '.')]));
    const facts = [['Status', lf.status], ['Word order', fm.wordOrder], ['Word building', fm.morphology], ['Script', fm.script]].filter(([, v]) => v);
    for (const [k, v] of facts) L.push(P_([B_(k + ': '), T_(v)]));
    const where = lang ? names(lf.regions).map(display) : []; if (where.length) L.push(P_([B_('Spoken in: '), T_(where.join(', '))]));
    if (fm.wordOrder && LH_ORDER_HELP[fm.wordOrder]) L.push(P_([I_(LH_ORDER_HELP[fm.wordOrder])]));
    add('intro', 'About the language', L); }
  { const L = []; const inv = sayInventory(ph);
    if (inv.V.length) { L.push(H_('Vowels')); for (const v of inv.V) { const d = soundSay(ph, v, 'V'); L.push(P_([B_(v), T_(` — say “${d.say}”`), d.hint ? I_(`, as in ${d.hint}`) : T_('')])); } }
    if (inv.C.length) { L.push(H_('Consonants')); for (const x of inv.C) { const d = soundSay(ph, isApos(x) ? "'" : x, 'C'); L.push(P_([B_(x), T_(` — say “${d.say}”`), d.hint ? I_(/^(a|an) /.test(d.hint) ? `, ${d.hint}` : `, as in ${d.hint}`) : T_('')])); } }
    L.push(H_('Stress')); L.push(P_(`Stress falls on the ${(STRESS.find(([k]) => k === (ph.stress || 'penult')) || STRESS[0])[1].toLowerCase()}${(STRESS.find(([k]) => k === (ph.stress || 'penult')) || [])[0] === 'none' ? '' : ''}. An acute accent (á) always marks the stressed syllable. In the pronunciations, the stressed syllable is in capitals.`));
    if (ph.patterns) L.push(P_([B_('Syllable shapes: '), T_(`${ph.patterns} (C = consonant, V = vowel)`)]));
    if (/['’ʼ]/.test(ph.patterns || '') || lex.some((e) => /['’ʼ]/.test(e.word))) L.push(P_('An apostrophe is a short catch in the voice, as in “uh-oh”.'));
    if (lex.some((e) => /-/.test(e.word))) L.push(P_('A hyphen joins the parts of a compound word; each part is said on its own.'));
    add('sounds', 'Sounds & pronunciation', L); }
  { const L = []; const g = fm.grammar || {};
    if (fm.wordOrder) L.push(P_([B_('Word order: '), T_(`${fm.wordOrder}. ${LH_ORDER_HELP[fm.wordOrder] || ''}`)]));
    if (fm.morphology) L.push(P_([B_('Word building: '), T_(`${fm.morphology}. ${LH_MORPH_HELP[fm.morphology] || ''}`)]));
    for (const x of WW_GRAMMAR) if (g[x.k] || (g.notes || {})[x.k]) L.push(P_([B_(x.label + ': '), T_([g[x.k], (g.notes || {})[x.k]].filter(Boolean).join('. '))]));
    const pr = WW_PRONOUNS.map(([p, s, pl]) => [p, wwFind(arr(fm.lexicon), s), wwFind(arr(fm.lexicon), pl), s, pl]).filter(([, a, b]) => a || b);
    if (pr.length) { L.push(H_('Pronouns')); for (const [p, a, b, s, pl] of pr) L.push(P_([B_(p + ': '), T_(`${a ? a.word : '—'} (${s}), ${b ? b.word : '—'} (${pl})`)])); }
    if (arr(fm.affixes).length) { L.push(H_('Word endings')); for (const a of arr(fm.affixes)) L.push(P_([B_(a.affix), T_(` — ${a.meaning || ''} (${a.type || 'suffix'})`)])); }
    if (g.notes && g.notes.general) L.push(P_(g.notes.general));
    add('grammar', 'Grammar', L); }
  { const L = []; const base = +fm.numberBase || 10; const list = WW_BASES[base] || WW_BASES[10];
    const rows = list.map((m) => [m, wwFind(arr(fm.lexicon), m)]).filter(([, e]) => e);
    if (rows.length) { L.push(P_(`Counting is in base ${base}.`)); for (const [m, e] of rows) L.push(P_([B_(e.word), T_(` — ${m}`)])); const ex = [base + 1, base * 2 + 3].map((n) => [n, wwNumber(fm, n)]).filter(([, w]) => w); if (ex.length) L.push(P_([I_('For example: '), T_(ex.map(([n, w]) => `${n} = ${w}`).join(' · '))])); }
    add('numbers', 'Numbers', L); }
  { const L = []; const order = [...ST().posList, '']; const by = new Map();
    for (const e of lex) { const k = order.includes(e.pos) ? e.pos : ''; if (!by.has(k)) by.set(k, []); by.get(k).push(e); }
    for (const k of order) if (by.has(k)) { L.push(H_(k ? POS_PLURAL[k] || k : 'Other words')); for (const e of by.get(k)) L.push(P_([B_(e.word), T_(` (${sayOf(ph, e)}) `), I_(e.pos || ''), T_(` — ${e.meaning || ''}`)])); }
    add('lexicon', `Dictionary: ${name} to English`, L); }
  { const L = []; const pairs = []; for (const e of lex) for (const m of wwSplit(e.meaning)) pairs.push([m, e]);
    pairs.sort((a, b) => a[0].localeCompare(b[0])); for (const [m, e] of pairs) L.push(P_([B_(m), T_(` — ${e.word}`)]));
    add('index', `English to ${name}`, L); }
  { const L = []; for (const x of arr(fm.phrases)) if (x && x.en) { const t = x.cl || wwTranslate(fm, x.en).text; L.push(P_([B_(x.en), T_(' — '), I_(t), T_(` (${t.split(/\s+/).filter((w) => w && !/^\[|\]$/.test(w)).map((w) => pronounce(ph, w.replace(/[^\p{L}'’ʼ-]/gu, ''))).filter(Boolean).join(' ')})`)])); }
    add('phrases', 'Phrasebook', L); }
  { const L = []; const ns = arr(fm.names); const kinds = [['given', 'Given names'], ['family', 'Family names'], ['place', 'Place names']];
    for (const [k, t] of kinds) { const l = ns.filter((x) => x.kind === k); if (!l.length) continue; L.push(H_(t)); for (const x of l) L.push(P_([B_(x.name), x.meaning ? T_(` — ${x.meaning}`) : T_('')])); }
    add('names', 'Names', L); }
  { const L = []; const wr = fm.writing || {};
    if (fm.script) L.push(P_([B_('Script: '), T_(fm.script)])); if (wr.direction) L.push(P_([B_('Direction: '), T_(wr.direction)]));
    if (wr.romanization) { L.push(H_('Romanization')); L.push(P_(wr.romanization)); } if (wr.notes) { L.push(H_('Notes')); L.push(P_(wr.notes)); }
    add('writing', 'Writing', L); }
  return out;
}
function wwGuideMarkdown(c, sections) {
  const L = [`# ${c.basename.replace(/\s*\(conlang\)$/i, '')}: a language guide`, ''];
  for (const s of wwGuide(c, sections)) { L.push(`## ${s.title}`, ''); for (const b of s.blocks) L.push(b.t === 'h' ? `### ${b.text}` : b.runs.map((r) => (r.b ? `**${r.text}**` : r.i ? `*${r.text}*` : r.text)).join(''), ''); }
  return L.join('\n');
}

/* ---------- migration: conlang data that used to live on Language notes ---------- */
async function wwMigrate() {
  const moved = [];
  for (const lang of S.notesOf('language')) {
    const fm = S.fm(lang); if (!('phonology' in fm || 'lexicon' in fm || 'affixes' in fm)) continue;
    const ph = fm.phonology || {}; const has = arr(fm.lexicon).length || arr(fm.affixes).length || (ph.consonants && ph.vowels);
    try {
      if (has) {
        let c = WW.conlangOf(lang);
        if (!c) { c = await WW.create(lang.basename + ' (conlang)', { language: lang, open: false, data: { phonology: ph, lexicon: fm.lexicon, affixes: fm.affixes, wordOrder: fm.wordOrder, morphology: fm.morphology, script: fm.script } }); }
        else await S.write(c, (x) => { const have = new Set(arr(x.lexicon).map((e) => e.word)); x.lexicon = [...arr(x.lexicon), ...arr(fm.lexicon).filter((e) => !have.has(e.word))]; if (!x.phonology || !x.phonology.consonants) x.phonology = Object.assign({}, WW_PH, ph); if (!arr(x.affixes).length) x.affixes = arr(fm.affixes); });
        if (!c) continue; moved.push(lang.basename);
      }
      await S.write(lang, (x) => { delete x.phonology; delete x.lexicon; delete x.affixes; });
    } catch (e) { console.error('[Wordwright] could not move the conlang of', lang.path, e); }
  }
  if (moved.length) { toast(`Wordwright: moved the conlang of ${moved.join(', ')} into ${moved.length === 1 ? 'its own note' : 'their own notes'} (${WW.folder()}). The Language notes link to them.`); S.dirty(); P.refreshSoon(100); }
  return moved;
}

/* ---------- the Language note's Conlang tab: a link, a summary and a quick translate ---------- */
function renderLanguageConlang(f, fm) {
  const c = WW.conlangOf(f); const wrap = h('div', { class: 'ww-lang' });
  if (!c) {
    const free = WW.all().filter((x) => !WW.languageOf(x));
    ap(wrap, h('div', { class: 'cv-callout' }, h('div', {}, h('b', {}, `Give ${f.basename} a constructed language`), h('div', { class: 'cs-hint' }, 'Wordwright keeps the sounds, words, grammar and phrasebook in a conlang note of its own, linked to this Language. Notes that mention the language keep linking here.')),
      h('div', { class: 'wk-legacy-btns' }, h('button', { class: 'mod-cta', onclick: async () => { const x = await WW.create(f.basename + ' (conlang)', { language: f, open: true }); if (x) setTimeout(() => openLanguageHelper(x), 400); } }, '🔤 Create a conlang'),
        free.length ? h('button', { onclick: () => suggest({ items: free.map((x) => ({ label: x.basename, value: x.path })), placeholder: 'Link which conlang?', source: 'Wordwright', onPick: async (p) => { await WW.link(app().vault.getAbstractFileByPath(p), f); wkRerender(wrap); } }) }, '🔗 Link a conlang') : null)));
    return wrap;
  }
  const cf = S.fm(c); const ph = Object.assign({}, WW_PH, cf.phonology || {}); const lex = arr(cf.lexicon); const sp = (x) => String(x || '').split(/\s+/).filter(Boolean);
  const st = P.mem(f.path, 'quick-tr', { input: '', coin: false, res: null });
  const openBtn = h('button', { class: 'mod-cta', onclick: (e) => openFile(c, e) }, '🔤 Open in Wordwright');
  ap(wrap, h('div', { class: 'ww-lang-card' },
    h('div', { class: 'ww-lang-head' }, h('div', {}, h('div', { class: 'cs-tile-label' }, 'Conlang'), h('a', { class: 'wk-link ww-lang-name', onclick: (e) => openFile(c, e) }, c.basename)), h('span', { class: 'cd-spacer' }), openBtn,
      h('button', { title: 'Unlink this conlang', onclick: () => confirm2(`Unlink ${c.basename}?`, h('p', {}, 'The conlang note stays; it just stops being linked to this Language.'), async () => { await WW.unlink(c); wkRerender(wrap); }, 'Unlink') }, 'Unlink')),
    h('div', { class: 'cs-stat-row' }, h('div', { class: 'cs-stat' }, h('b', {}, String(lex.length)), h('span', {}, 'Words')), h('div', { class: 'cs-stat' }, h('b', {}, String(sp(ph.consonants).length + sp(ph.vowels).length)), h('span', {}, 'Sounds')),
      h('div', { class: 'cs-stat' }, h('b', {}, String(arr(cf.affixes).length)), h('span', {}, 'Endings')), h('div', { class: 'cs-stat' }, h('b', {}, cf.wordOrder || '—'), h('span', {}, 'Word order'))),
    lex.length ? h('div', { class: 'cl-sayex' }, ...lex.slice(0, 6).map((e) => h('span', {}, h('b', {}, e.word), ` ${e.meaning || ''} · ${sayOf(ph, e)}`))) : h('div', { class: 'cs-hint' }, 'No words yet. Open it in Wordwright to build the language.')));
  // quick translate
  const ta = h('textarea', { class: 'cl-in ww-quick-in', placeholder: `English to ${f.basename}…` }, st.input); ta.addEventListener('input', () => { st.input = ta.value; });
  const coin = h('input', { type: 'checkbox', checked: st.coin }); coin.addEventListener('change', () => { st.coin = coin.checked; });
  const outBox = h('div', { class: 'ww-quick-out' });
  const sayOf_ = (r) => r.tokens.filter((t) => t.out && !t.name).map((t) => pronounce(ph, t.out)).join(' ');
  const show = (r) => { if (!r) return outBox.replaceChildren(); outBox.replaceChildren(h('div', { class: 'ww-quick-text' }, h('span', { class: 'ww-out-text' }, r.text), canSpeak() ? h('button', { class: 'cl-hear', title: 'Hear an approximation', onclick: () => speakSay(sayOf_(r)) }, '🔊') : null),
    h('div', { class: 'ww-copy-row' }, h('button', { class: 'ww-copy', onclick: () => wwCopy(r.text) }, '⧉ Copy'), h('button', { class: 'ww-copy', onclick: () => wwCopy(`${r.text}\n(${sayOf_(r)})`, 'Translation and pronunciation') }, '⧉ Copy with pronunciation'),
      h('span', { class: 'cs-hint' }, r.order && /^[SVO]{3}$/.test(r.order) ? `Arranged for ${r.order} word order.` : 'Set a word order on the conlang’s Grammar tab and translations follow it.')),
    h('div', { class: 'cl-out' }, ...r.tokens.map((t) => h('span', { class: 'cl-tok' + (t.unknown ? ' is-unk' : '') + (t.coined ? ' is-new' : '') }, h('b', {}, t.out || t.src), h('small', {}, t.unknown ? '?' : t.gloss)))),
    ...(r.missing.length ? [h('div', { class: 'cs-hint' }, `Not in the lexicon yet: ${r.missing.join(', ')}. Tick “Create missing words” or add them in Wordwright.`)] : [])); };
  const go = async () => { st.res = st.coin ? await wwTranslateAndSave(c, st.input, { coin: true }) : wwTranslate(cf, st.input); show(st.res); };
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); go(); } });
  ap(wrap, h('div', { class: 'cl-card cs-mt ww-quick' }, h('h4', {}, '🔁 Quick translate'), ta,
    h('div', { class: 'cl-actions' }, h('button', { class: 'mod-cta', onclick: go }, 'Translate'), h('label', { class: 'cs-hint cl-inline' }, coin, 'Create missing words')), outBox));
  if (st.res) show(st.res);
  return wrap;
}

/* ---------- the conlang note itself ---------- */
function renderConlangNote(f) {
  const fm = S.fm(f); const lang = WW.languageOf(f); const root = h('div', { class: 'cs-root ww-root' });
  const langChip = lang ? h('a', { class: 'wk-link', onclick: (e) => openFile(lang, e) }, '🗣️ ' + lang.basename) : null;
  ap(root, h('div', { class: 'ww-hero' },
    h('div', { class: 'ww-hero-pill' }, '🔤 Wordwright'),
    h('h1', { class: 'ww-title' }, f.basename.replace(/\s*\(conlang\)$/i, '')),
    h('div', { class: 'ww-hero-sub' }, lang ? [h('span', { class: 'cs-hint' }, 'The conlang of '), langChip] : h('span', { class: 'cs-hint' }, 'Not linked to a Language note yet.'),
      h('button', { class: 'ww-mini', onclick: () => suggest({ items: S.notesOf('language').map((x) => ({ label: x.basename, sub: WW.conlangOf(x) && WW.conlangOf(x).path !== f.path ? 'has a conlang' : '', value: x.path })), placeholder: 'Which Language speaks this?', source: 'Languages (Worldkeeper)', create: true,
        onPick: async (v, isNew) => { const l = isNew ? await createNote('language', v, {}, { open: false }) : app().vault.getAbstractFileByPath(v); if (l) { await WW.link(f, l); wkRerender(root); } } }) }, lang ? 'Change' : '🔗 Link a Language'),
      h('button', { class: 'ww-mini', title: 'Step-by-step guide to building this language', onclick: () => openLanguageHelper(f) }, '🧭 Language helper'))));
  ap(root, renderConlang(f, fm));
  return root;
}

/* ---------- library view ---------- */
class WordwrightView extends ItemView {
  constructor(leaf) { super(leaf); }
  getViewType() { return VIEW_WW; }
  getDisplayText() { return 'Wordwright'; }
  getIcon() { return 'languages'; }
  async onOpen() { this.body = this.contentEl.createDiv({ cls: 'wk ww-lib' }); this.run = liveRender(this, this.body, () => this.render()); this.run(); }
  render() {
    const all = WW.all();
    const head = h('div', { class: 'cd-top ww-lib-top' }, h('div', { class: 'cd-h1' }, '🔤 Wordwright'), h('span', { class: 'cd-count' }, `${all.length} conlang${all.length === 1 ? '' : 's'}`), h('span', { class: 'cd-spacer' }),
      h('button', { class: 'mod-cta', onclick: () => newConlangFlow() }, '+ New conlang'));
    const intro = h('div', { class: 'cs-hint ww-lib-intro' }, 'Build the languages of your world: sounds and pronunciation, a dictionary, grammar, numbers, a phrasebook and names. Each conlang links to its Language note in Worldkeeper, and Draftsmith can translate text into it.');
    const cards = all.map((c) => { const fm = S.fm(c); const lang = WW.languageOf(c); const lex = arr(fm.lexicon); const ph = Object.assign({}, WW_PH, fm.phonology || {});
      return h('div', { class: 'ww-card', onclick: (e) => { if (!e.target.closest('button, a')) openFile(c, e); } },
        h('div', { class: 'ww-card-name' }, c.basename.replace(/\s*\(conlang\)$/i, '')),
        h('div', { class: 'cs-hint' }, lang ? ['🗣️ ', h('a', { class: 'wk-link', onclick: (e) => openFile(lang, e) }, lang.basename)] : 'No Language linked'),
        h('div', { class: 'ww-card-stats' }, `${lex.length} words · ${arr(fm.affixes).length} endings${fm.wordOrder ? ' · ' + fm.wordOrder : ''}`),
        lex.length ? h('div', { class: 'ww-card-words' }, ...lex.slice(0, 5).map((e) => h('span', { title: `${e.meaning} · ${sayOf(ph, e)}` }, e.word))) : null,
        h('div', { class: 'ww-card-actions' }, h('button', { onclick: (e) => openFile(c, e) }, 'Open'), h('button', { onclick: () => openLanguageHelper(c) }, '🧭 Helper'))); });
    this.body.replaceChildren(h('div', { class: 'wk-view' }, head, intro, all.length ? h('div', { class: 'ww-grid' }, ...cards) : h('div', { class: 'cs-empty' }, 'No conlangs yet. Start one with “+ New conlang”, or from a Language note’s Conlang tab.')));
  }
}
function newConlangFlow() {
  const langs = S.notesOf('language').filter((l) => !WW.conlangOf(l));
  suggest({ items: [{ label: '✳ A new conlang without a Language note', value: '' }, ...langs.map((l) => ({ label: `For ${l.basename}`, sub: 'Language', value: l.path }))], placeholder: 'Which Language is it for?', source: 'Wordwright',
    onPick: (v) => { if (v) { const l = app().vault.getAbstractFileByPath(v); WW.create(l.basename + ' (conlang)', { language: l }).then((c) => c && setTimeout(() => openLanguageHelper(c), 400)); return; }
      prompt2('New conlang', 'Name, e.g. Old Tide', async (nm) => { const c = await WW.create(nm); if (c) setTimeout(() => openLanguageHelper(c), 400); }); } });
}

/* ---------- wiring ---------- */
function installWordwright(plugin) {
  plugin.registerView(VIEW_WW, (leaf) => new WordwrightView(leaf));
  plugin.registerMarkdownCodeBlockProcessor(WW_BLOCK, (src, el, ctx) => {
    const f = app().vault.getAbstractFileByPath(ctx.sourcePath); if (!(f instanceof TFile)) return;
    const child = new MarkdownRenderChild(el); ctx.addChild(child);
    const run = liveRender(child, el, () => el.replaceChildren(h('div', { class: 'wk ww' }, renderConlangNote(f)))); run();
  });
  plugin.addRibbonIcon('languages', 'Wordwright (conlangs)', () => plugin.openWordwright());
  plugin.addCommand({ id: 'open-wordwright', name: 'Open Wordwright (conlangs)', callback: () => plugin.openWordwright() });
  plugin.addCommand({ id: 'new-conlang', name: 'New conlang…', callback: () => newConlangFlow() });
  plugin.addCommand({ id: 'language-helper', name: 'Language helper for this conlang', checkCallback: (chk) => { const f = app().workspace.getActiveFile(); if (!isConlang(f)) return false; if (!chk) openLanguageHelper(f); return true; } });
  app().workspace.onLayoutReady(() => setTimeout(() => wwMigrate().catch((e) => console.error('[Wordwright]', e)), 1200));
}
const WORDWRIGHT_METHODS = {
  wordwrightMigrate() { return wwMigrate(); },
  async openWordwright() {
    const ex = app().workspace.getLeavesOfType(VIEW_WW)[0]; if (ex) { app().workspace.revealLeaf(ex); return; }
    const leaf = app().workspace.getLeaf('tab'); await leaf.setViewState({ type: VIEW_WW, active: true }); app().workspace.revealLeaf(leaf);
  },
};
