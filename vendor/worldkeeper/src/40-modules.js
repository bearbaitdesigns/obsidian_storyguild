/* =====================================================================
   conlang (language notes)
   ===================================================================== */
function genWord(ph, existing) {
  const sp = (x) => String(x || '').split(/\s+/).filter(Boolean);
  const C = sp(ph.consonants), V = sp(ph.vowels), Pt = sp(ph.patterns), F = sp(ph.forbidden);
  if (!C.length || !V.length || !Pt.length) return null;
  const mn = Math.max(1, +ph.minSyl || 1), mx = Math.max(mn, +ph.maxSyl || 2);
  for (let tries = 0; tries < 300; tries++) {
    const k = mn + Math.floor(Math.random() * (mx - mn + 1)); let w = '';
    for (let i = 0; i < k; i++) for (const ch of pick(Pt)) w += ch === 'C' ? pick(C) : ch === 'V' ? pick(V) : '';
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
  ap(wrap, h('div', { class: 'cs-subnav' }, ...sub.map(([k, l]) => h('button', { class: st.tab === k ? 'is-on' : '', onclick: () => { st.tab = k; rerender(); } }, l))));
  const addWord = (word, meaning = '', pos = 'noun') => W((x) => { x.lexicon.push({ word, pos, meaning }); });

  if (st.tab === 'phon') {
    const fld = (k, label, hint) => { const i = h('input', { type: 'text', value: ph[k] ?? '' }); i.addEventListener('change', () => W((x) => { x.phonology[k] = i.value.trim(); })); return h('div', { class: 'cl-row' }, h('label', {}, label + (hint ? ' — ' + hint : '')), i); };
    const chips = (v) => h('div', { class: 'cl-phon' }, ...sp(v).map((x) => h('span', {}, x)));
    const regen = () => { st.gen = []; const ex = new Set(existing); for (let i = 0; i < 14; i++) { const w = genWord(ph, ex); if (w) { st.gen.push(w); ex.add(w); } } rerender(); };
    if (!st.gen.length && ph.consonants && ph.vowels) { const ex = new Set(existing); for (let i = 0; i < 14; i++) { const w = genWord(ph, ex); if (w) { st.gen.push(w); ex.add(w); } } }
    const num = (k) => { const i = h('input', { type: 'number', min: 1, max: 6, value: ph[k], class: 'cl-num' }); i.addEventListener('change', () => W((x) => { x.phonology[k] = +i.value; })); return i; };
    ap(wrap, h('div', { class: 'cl-grid' },
      h('div', { class: 'cl-card' }, h('h4', {}, 'Phonology'), fld('consonants', 'Consonants', 'space-separated'), chips(ph.consonants), fld('vowels', 'Vowels'), chips(ph.vowels),
        fld('patterns', 'Syllable shapes', 'C = consonant, V = vowel'), fld('forbidden', 'Forbidden sequences', 'never generated'),
        h('div', { class: 'cl-row cl-inline' }, h('label', {}, 'Syllables'), num('minSyl'), h('span', {}, 'to'), num('maxSyl'))),
      h('div', { class: 'cl-card' }, h('h4', {}, 'Word generator'), h('div', { class: 'cs-hint' }, ph.consonants && ph.vowels ? 'Words built from your sounds and syllable shapes. Click one to add it to the lexicon.' : 'Add consonants and vowels to start generating words.'),
        h('div', { class: 'cl-gen' }, ...st.gen.map((w) => h('button', { title: 'Add to lexicon', onclick: () => prompt2(`Meaning of “${w}”`, 'e.g. river, to swim…', (m) => { st.gen = st.gen.filter((x) => x !== w); addWord(w, m); toast(`Added “${w}” = ${m}`); }) }, w))),
        h('div', { class: 'cl-actions' }, h('button', { class: 'mod-cta', onclick: regen }, '🎲 Generate'), h('button', { onclick: () => { const w = genWord(ph, existing); if (w) prompt2(`Meaning of “${w}”`, 'meaning…', (m) => addWord(w, m)); } }, '+ One word')))));
  } else if (st.tab === 'lex') {
    const q = st.q.toLowerCase();
    const rows = lex.map((e, i) => [e, i]).filter(([e]) => !q || String(e.word).includes(q) || String(e.meaning || '').toLowerCase().includes(q)).sort((a, b) => String(a[0].word).localeCompare(String(b[0].word)));
    const search = h('input', { type: 'search', placeholder: 'Search word or meaning…', value: st.q });
    search.addEventListener('input', () => { st.q = search.value; const pos = search.selectionStart; tbody.replaceChildren(...build()); search.focus(); search.setSelectionRange(pos, pos); });
    ap(wrap, h('div', { class: 'cl-tools' }, search,
      h('button', { onclick: () => addWord(genWord(ph, existing) || '', '') }, '+ Add word'),
      h('button', { onclick: () => { const md = '| Word | Part of speech | Meaning |\n|---|---|---|\n' + lex.slice().sort((a, b) => String(a.word).localeCompare(String(b.word))).map((e) => `| ${e.word} | ${e.pos} | ${e.meaning} |`).join('\n'); navigator.clipboard.writeText(md).then(() => toast('Lexicon copied as a Markdown table')); } }, '⧉ Copy as table')));
    const build = () => {
      const qq = st.q.toLowerCase();
      return lex.map((e, i) => [e, i]).filter(([e]) => !qq || String(e.word).includes(qq) || String(e.meaning || '').toLowerCase().includes(qq)).sort((a, b) => String(a[0].word).localeCompare(String(b[0].word))).map(([e, i]) => {
        const wi = h('input', { class: 'w', value: e.word || '' }); wi.addEventListener('change', () => W((x) => { x.lexicon[i].word = wi.value.trim(); }));
        const ps = h('select', {}, ...s.posList.map((p) => h('option', { selected: p === e.pos }, p))); ps.addEventListener('change', () => W((x) => { x.lexicon[i].pos = ps.value; }));
        const mi = h('input', { value: e.meaning || '', placeholder: 'meaning (comma-separate synonyms)' }); mi.addEventListener('change', () => W((x) => { x.lexicon[i].meaning = mi.value; }));
        return h('tr', {}, h('td', {}, wi), h('td', {}, ps), h('td', {}, mi), h('td', {}, h('span', { class: 'cs-x is-visible', onclick: () => W((x) => { x.lexicon.splice(i, 1); }) }, '✕')));
      });
    };
    const tbody = h('tbody', {}, ...build());
    ap(wrap, h('table', { class: 'cl-table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Word'), h('th', {}, 'Part of speech'), h('th', {}, 'Meaning'), h('th', {}))), tbody));
    if (!rows.length) ap(wrap, empty(lex.length ? 'No words match.' : 'No words yet. Generate some on the Sounds tab.'));
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
    const out = h('div', { class: 'cl-out' }); const unknown = [];
    for (const tk of toks) {
      if (!/[A-Za-z]/.test(tk)) continue; if (st.skip && SKIP.includes(tk.toLowerCase())) continue;
      const r = lookup(fm, tk);
      if (r) ap(out, h('span', { class: 'cl-tok' }, h('b', {}, r.out), h('small', {}, r.gloss)));
      else { unknown.push(tk.toLowerCase()); ap(out, h('span', { class: 'cl-tok is-unk', title: 'Not in the lexicon. Click to coin a word.' }, h('b', { onclick: () => { const w = genWord(ph, existing); if (w) { addWord(w, tk.toLowerCase()); toast(`Coined “${w}” = ${tk.toLowerCase()}`); } else toast('Set up consonants, vowels and syllable shapes first'); } }, tk), h('small', {}, '?'))); }
    }
    const ta = h('textarea', { class: 'cl-in' }, st.input); ta.addEventListener('input', () => { st.input = ta.value; });
    const skip = h('input', { type: 'checkbox', checked: st.skip }); skip.addEventListener('change', () => { st.skip = skip.checked; rerender(); });
    const uniq = [...new Set(unknown)];
    ap(wrap, h('div', { class: 'cl-card' }, h('h4', {}, 'English'), ta,
      h('div', { class: 'cl-actions' }, h('button', { class: 'mod-cta', onclick: rerender }, 'Translate'), h('label', { class: 'cs-hint cl-inline' }, skip, 'Drop articles (the, a, an)'),
        uniq.length ? h('button', { onclick: () => W((x) => { const ex = new Set(x.lexicon.map((e) => e.word)); for (const u of uniq) { const w = genWord(ph, ex); if (w) { ex.add(w); x.lexicon.push({ word: w, pos: 'noun', meaning: u }); } } toast(`Coined ${uniq.length} words. Check their part of speech in the lexicon`); }) }, `🎲 Coin ${uniq.length} missing`) : null)),
      h('div', { class: 'cl-card cs-mt' }, h('h4', {}, `${f.basename} · word-by-word gloss`), out, h('div', { class: 'cs-hint cs-mt' }, `Glossed in the original order. Rearrange for ${fm.wordOrder || 'your'} word order when writing.`)));
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
