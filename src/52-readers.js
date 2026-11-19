/* =====================================================================
   Readers tab — rounds, sends, attachments, questions & answers, notes
   ===================================================================== */
const STATUS_COLORS = { 'Not sent': '#888', Sent: '#5aa6e0', Reading: '#e0b04f', Finished: '#a882ff', 'Feedback in': '#5fb98a', Dropped: '#e06c6c' };
const roundOf = (p, id) => p.rounds.find((r) => r.id === id);
const readerOf = (p, id) => p.readers.find((r) => r.id === id) || { name: 'Reader', color: '#888', contact: '' };
const versions = (p) => Array.from({ length: p.draft }, (_, i) => `Draft ${i + 1}`);
const save = () => { SG.saveSoon(); syncRoundsToWorld(); };

function renderReaders(view, p, body) {
  const ui = DS().ui; let rd = roundOf(p, ui.round) || p.rounds[p.rounds.length - 1];
  body.append(el('div', { class: 'ds-row' }, el('p', { class: 'ds-hint ds-grow' }, 'Group readers into as many alpha and beta rounds as you need. Each send records when, in what format and which version of the manuscript a reader got. Rounds also show on Worldkeeper’s Milestones card.'),
    btn('+ New round', () => newRoundModal(view, p)), btn('+ Send to a reader', () => sendModal(view, p, rd), 'mod-cta')));
  if (!rd) { body.append(card(null, el('p', {}, 'No reader rounds yet.'), btn('Create the first round', () => newRoundModal(view, p), 'mod-cta'))); readerDirectory(view, p, body); return; }
  ui.round = rd.id;
  body.append(el('div', { class: 'ds-chips' }, p.rounds.map((r) => el('button', { class: 'ds-chip' + (r.id === rd.id ? ' is-on' : ''), onclick: () => { ui.round = r.id; SG.saveSoon(); view.render(); } },
    el('i', { class: 'is-' + r.type }), r.name, el('small', {}, ` · ${r.version} · ${r.sends.length}`)))));

  // round settings
  const inp = (k, type = 'text', cls = '') => { const i = el('input', { type, value: rd[k] || '', class: cls }); i.addEventListener('change', () => { rd[k] = i.value; save(); view.render(); }); return i; };
  const type = el('select', { class: 'dropdown' }, [['alpha', 'Alpha'], ['beta', 'Beta']].map(([v, l]) => el('option', { value: v, selected: rd.type === v }, l))); type.addEventListener('change', () => { rd.type = type.value; save(); view.render(); });
  const ver = el('select', { class: 'dropdown' }, [...new Set([...versions(p), rd.version])].map((v) => el('option', { selected: v === rd.version }, v))); ver.addEventListener('change', () => { rd.version = ver.value; save(); });
  const fb = rd.sends.filter((s) => s.status === 'Feedback in').length; const live = rd.sends.filter((s) => s.status !== 'Dropped').length;
  body.append(card(null,
    el('div', { class: 'ds-roundgrid' },
      el('div', { class: 'ds-field' }, el('label', {}, 'Round'), inp('name')), el('div', { class: 'ds-field' }, el('label', {}, 'Type'), type),
      el('div', { class: 'ds-field' }, el('label', {}, 'Manuscript version'), ver), el('div', { class: 'ds-field' }, el('label', {}, 'Feedback due'), inp('due', 'date')),
      el('div', { class: 'ds-field is-wide' }, el('label', {}, 'Focus for this round'), inp('focus'))),
    el('div', { class: 'ds-row' }, el('span', { class: 'ds-hint ds-grow' }, `${fb}/${live} readers have sent feedback · ${p.comments.filter((c) => c.round === rd.id).length} notes`),
      btn('Export round to note', () => exportRound(p, rd)), btn('Delete round…', () => new ConfirmModal(`Delete “${rd.name}”?`, 'Its sends, answers and notes are removed from Draftsmith. Attached files stay in your vault.', 'Delete', () => { p.rounds = p.rounds.filter((x) => x !== rd); p.comments = p.comments.filter((c) => c.round !== rd.id); ui.round = ''; save(); view.render(); }).open(), 'mod-warning')),
    el('div', { class: 'ds-bar' }, el('i', { style: { width: (live ? (fb / live) * 100 : 0) + '%' } }))));

  // sends
  const tbl = el('table', { class: 'ds-table' }, el('thead', {}, el('tr', {}, ['Reader', 'Sent', 'Format', 'Version', 'Due', 'Status', 'Attachments', ''].map((x) => el('th', {}, x)))));
  const tb = el('tbody'); tbl.append(tb);
  rd.sends.forEach((s, i) => {
    const r = readerOf(p, s.r); const d = daysUntil(s.due); const late = d != null && d < 0 && !['Feedback in', 'Dropped'].includes(s.status);
    const set = (k) => (e) => { s[k] = e.target.value; save(); if (k === 'status') view.render(); };
    const st = el('select', { class: 'dropdown ds-st', style: { '--c': STATUS_COLORS[s.status] } }, SEND_STATUS.map((x) => el('option', { selected: x === s.status }, x))); st.addEventListener('change', set('status'));
    const fmt = el('select', { class: 'dropdown' }, [...new Set([...FORMATS, s.format])].map((x) => el('option', { selected: x === s.format }, x))); fmt.addEventListener('change', set('format'));
    const sent = el('input', { type: 'date', value: s.sent || '' }); sent.addEventListener('change', set('sent'));
    const due = el('input', { type: 'date', value: s.due || '' }); due.addEventListener('change', set('due'));
    const v = el('input', { type: 'text', value: s.version || '', class: 'ds-w90' }); v.addEventListener('change', set('version'));
    const files = el('div', { class: 'ds-files' }, s.files.map((path, fi) => fileChip(view, p, rd, s, path, fi)), el('a', { class: 'ds-mini', title: 'Attach the reader’s comments: PDF, Markdown, Word, text, images…', onclick: (e) => attachMenu(e, view, p, rd, s) }, '📎 attach'));
    tb.append(el('tr', {},
      el('td', {}, el('div', { class: 'ds-who' }, el('span', { class: 'ds-av', style: { '--c': r.color } }, r.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2)), el('div', {}, el('b', {}, r.name), r.contact ? el('small', {}, r.contact) : null))),
      el('td', {}, sent), el('td', {}, fmt), el('td', {}, v), el('td', {}, due, late ? el('small', { class: 'ds-late' }, `${-d}d overdue`) : null), el('td', {}, st), el('td', {}, files),
      el('td', {}, el('div', { class: 'ds-row ds-nowrap' }, btn('Answers', () => answersModal(view, p, rd, s), 'ds-sm', 'Enter this reader’s answers'), btn('+ Note', () => noteModal(view, p, rd, s.r), 'ds-sm'),
        btn('✕', () => new ConfirmModal(`Remove ${r.name} from this round?`, 'Their answers in this round are removed too. Notes and attached files stay.', 'Remove', () => { rd.sends.splice(i, 1); save(); view.render(); }).open(), 'clickable-icon ds-sm')))));
  });
  body.append(rd.sends.length ? el('div', { class: 'ds-tablewrap' }, tbl) : card(null, el('p', {}, 'Nobody in this round yet.'), btn('Send the manuscript to someone', () => sendModal(view, p, rd), 'mod-cta')));

  renderQuestions(view, p, rd, body);
  renderAnswers(view, p, rd, body);

  // notes
  const notes = p.comments.filter((c) => c.round === rd.id);
  body.append(el('div', { class: 'ds-row' }, el('h2', { class: 'ds-grow' }, 'Reader notes'), btn('+ Add note', () => noteModal(view, p, rd))));
  body.append(notes.length ? el('div', {}, notes.map((c) => noteEl(view, p, c))) : hint('No notes yet. Add them by hand, or import the bullet points from a Markdown or text attachment (📎 → click the file).'));
  readerDirectory(view, p, body);
}

/* ---------- questions ---------- */
function renderQuestions(view, p, rd, body) {
  const qs = rd.questions;
  const inc = rd.includeInCompile;
  body.append(el('div', { class: 'ds-row' }, el('h2', { class: 'ds-grow' }, 'Questions for this round'),
    qs.length ? el('label', { class: 'ds-toggle', title: 'Add these questions at the end of reader copies made in Publish' }, ((c) => { c.addEventListener('change', () => { rd.includeInCompile = c.checked; save(); }); return c; })(el('input', { type: 'checkbox', checked: !!inc })), ' Include in Publish') : null));
  const box = card(null, hint('Ask every reader in this round the same questions. Their answers appear below, side by side.'));
  qs.forEach((q, i) => {
    const t = el('input', { type: 'text', value: q.text, class: 'ds-grow', placeholder: 'Question…' }); t.addEventListener('change', () => { q.text = t.value; save(); });
    const mv = (d) => () => { const j = i + d; if (j < 0 || j >= qs.length) return; [qs[i], qs[j]] = [qs[j], qs[i]]; save(); view.render(); };
    box.append(el('div', { class: 'ds-q' }, el('span', { class: 'ds-qn' }, `${i + 1}.`), t, btn('↑', mv(-1), 'clickable-icon ds-sm'), btn('↓', mv(1), 'clickable-icon ds-sm'), btn('✕', () => { qs.splice(i, 1); save(); view.render(); }, 'clickable-icon ds-sm')));
  });
  const add = (texts) => {
    const was = qs.length;
    for (const t of texts) qs.push({ id: uid(), text: typeof t === 'string' ? t : t.text });
    save(); view.render();
    if (!was && qs.length && rd.includeInCompile == null) askIncludeInPublish(view, rd);
  };
  const others = p.rounds.filter((r) => r !== rd && r.questions.length);
  box.append(el('div', { class: 'ds-row' }, btn('+ Add question', () => add([''])), qs.length ? null : btn(`Use suggested ${rd.type} questions`, () => add(DEFAULT_QUESTIONS[rd.type])),
    others.length ? btn('Copy from another round…', () => new FormModal('Copy questions', [{ key: 'r', label: 'From round', type: 'select', options: others.map((r) => [r.id, `${r.name} (${r.questions.length})`]) }], 'Copy', (v) => add(roundOf(p, v.r).questions.map((q) => q.text))).open()) : null));
  if (qs.length) box.append(hint(rd.includeInCompile ? 'These questions are added at the end of reader copies you make in Publish.' : 'Not included in Publish. Turn on “Include in Publish” to add them to reader copies.'));
  body.append(box);
}
function askIncludeInPublish(view, rd) {
  new ConfirmModal('Include these questions in Publish?', `When you make a reader copy in Publish, Draftsmith can add “${rd.name}” questions at the end, so readers answer them as they finish. You can change this any time with the “Include in Publish” switch.`,
    'Yes, include them', () => { rd.includeInCompile = true; save(); view.render(); }, 'No', () => { rd.includeInCompile = false; save(); view.render(); }).open();
}

/* ---------- answers ---------- */
function renderAnswers(view, p, rd, body) {
  if (!rd.questions.length) return;
  const people = rd.sends.filter((s) => s.status !== 'Dropped');
  body.append(el('h2', {}, 'Answers'));
  if (!people.length) { body.append(hint('Answers show here once readers are added to the round.')); return; }
  const box = el('div', { class: 'ds-answers' });
  rd.questions.forEach((q, i) => {
    const vals = people.map((s) => s.answers[q.id]).filter((v) => v != null && v !== '');
    box.append(el('div', { class: 'ds-ans' }, el('div', { class: 'ds-ans-q' }, el('b', {}, `${i + 1}. ${q.text || '(no text)'}`), el('span', { class: 'ds-hint' }, `${vals.length}/${people.length} answered`)),
      people.map((s) => { const r = readerOf(p, s.r); const v = s.answers[q.id];
        return el('div', { class: 'ds-ans-row' }, el('span', { class: 'ds-ans-who', style: { '--c': r.color } }, r.name),
          v == null || v === '' ? el('span', { class: 'ds-hint ds-click', onclick: () => answersModal(view, p, rd, s) }, 'no answer yet') : el('span', { class: 'ds-ans-text' }, String(v))); })));
  });
  body.append(box);
}
function answersModal(view, p, rd, s) {
  if (!rd.questions.length) { notice('Add questions to this round first.'); return; }
  const r = readerOf(p, s.r);
  new FormModal(`${r.name}’s answers — ${rd.name}`, rd.questions.map((q, i) => ({ key: q.id, label: `${i + 1}. ${q.text}`, type: 'textarea', rows: 3, value: s.answers[q.id] ?? '' })), 'Save answers', (v) => { for (const [k, x] of Object.entries(v)) { if (x === '' || x == null) delete s.answers[k]; else s.answers[k] = x; } save(); view.render(); }).open();
}

/* ---------- attachments ---------- */
function attachMenu(e, view, p, rd, s) {
  const folder = `${projectSub(p, 'readersFolder')}/Attachments/${safeName(rd.name)}`;
  const add = (path) => { if (!s.files.includes(path)) s.files.push(path); save(); view.render(); };
  const m = new Menu();
  m.addItem((i) => i.setTitle('Upload from this device…').setIcon('upload').onClick(async () => {
    const files = await chooseLocalFiles(ATTACH_EXT.map((x) => '.' + x).join(','), true); for (const f of files) add(await saveLocalFile(f, folder));
    if (files.length) notice(`Attached ${files.length} file${files.length === 1 ? '' : 's'} → ${folder}`);
  }));
  m.addItem((i) => i.setTitle('Choose a file in the vault…').setIcon('paperclip').onClick(() => new FilePick((f) => ATTACH_EXT.includes(f.extension.toLowerCase()), (f) => add(f.path), 'Attach a file…').open()));
  m.showAtMouseEvent(e);
}
function fileChip(view, p, rd, s, path, fi) {
  const name = path.split('/').pop(); const ext = (name.split('.').pop() || '').toLowerCase(); const f = app().vault.getAbstractFileByPath(path);
  const chip = el('span', { class: 'ds-file' + (f ? '' : ' is-missing'), title: f ? path : `${path} (missing)` }, el('i', { class: 'ds-ext is-' + ext }, ext.slice(0, 4).toUpperCase()), el('span', {}, name));
  chip.addEventListener('click', (e) => {
    const m = new Menu();
    if (f) m.addItem((i) => i.setTitle('Open').setIcon('file').onClick(() => openFile(f)));
    if (f && ['md', 'markdown', 'txt'].includes(ext)) m.addItem((i) => i.setTitle('Import bullet points as notes').setIcon('list').onClick(() => importBullets(view, p, rd, s, f)));
    m.addItem((i) => i.setTitle('Remove from this list (keeps the file)').setIcon('x').onClick(() => { s.files.splice(fi, 1); save(); view.render(); }));
    m.showAtMouseEvent(e);
  });
  return chip;
}
async function importBullets(view, p, rd, s, f) {
  const chs = listChapters(p); let n = 0;
  for (const line of (await app().vault.read(f)).split('\n')) {
    const m = line.match(/^\s*[-*+]\s+(?:\[.\]\s+)?(.+)$/); if (!m) continue;
    let text = m[1].trim(); let ch = null;
    const c = text.match(/^(?:ch(?:apter)?\.?\s*)(\d+)\s*[:.\-–—]\s*(.*)$/i);
    if (c) { const hit = chs.find((x) => x.num === Number(c[1])); if (hit) { ch = hit.file.path; text = c[2]; } }
    p.comments.push({ id: uid(), round: rd.id, r: s.r, ch, type: 'Other', text, quote: '', date: today(), resolved: false, src: f.path }); n++;
  }
  save(); view.render(); notice(n ? `Imported ${n} notes from ${f.name}. Lines starting “Ch 5:” were linked to that chapter.` : 'No bullet points found in that file.');
}

/* ---------- notes ---------- */
function noteEl(view, p, c) {
  const r = readerOf(p, c.r); const rd = roundOf(p, c.round); const chf = c.ch && app().vault.getAbstractFileByPath(c.ch);
  return el('div', { class: 'ds-note' + (c.resolved ? ' is-resolved' : '') + (rd && rd.type === 'beta' ? ' is-beta' : '') },
    el('div', { class: 'ds-note-h' }, el('b', { style: { color: r.color } }, r.name), el('span', {}, ` · ${c.type}`), chf ? el('a', { class: 'ds-link', onclick: () => openFile(chf) }, ` · ${chf.basename}`) : el('span', {}, ' · whole manuscript'), el('span', { class: 'ds-grow' }), el('small', {}, c.date)),
    c.quote ? el('q', {}, c.quote) : null, el('div', {}, c.text), c.src ? el('small', { class: 'ds-hint' }, `📎 from ${c.src.split('/').pop()}`) : null,
    el('div', { class: 'ds-row' }, el('a', { class: 'ds-mini', onclick: () => { c.resolved = !c.resolved; save(); view.render(); } }, c.resolved ? 'Reopen' : 'Mark resolved'),
      el('a', { class: 'ds-mini', onclick: () => { p.comments = p.comments.filter((x) => x !== c); save(); view.render(); } }, 'Delete')));
}
function noteModal(view, p, rd, readerId) {
  const people = rd.sends.map((s) => [s.r, readerOf(p, s.r).name]); if (!people.length) { notice('Add a reader to this round first.'); return; }
  new FormModal('Add reader note', [
    { key: 'r', label: 'Reader', type: 'select', options: people, value: readerId ?? people[0][0] },
    { key: 'ch', label: 'Chapter', type: 'select', options: [['', '— Whole manuscript —'], ...listChapters(p).map((c) => [c.file.path, `${c.label}. ${c.title}`])] },
    { key: 'type', label: 'Kind of note', type: 'select', options: NOTE_TYPES },
    { key: 'quote', label: 'Quoted passage (optional)' }, { key: 'text', label: 'Note', type: 'textarea', required: true },
  ], 'Save', (v) => { p.comments.push({ id: uid(), round: rd.id, r: v.r, ch: v.ch || null, type: v.type, text: v.text.trim(), quote: v.quote.trim(), date: today(), resolved: false }); save(); view.render(); }).open();
}

/* ---------- rounds & sends ---------- */
function newRoundModal(view, p) {
  const n = (t) => p.rounds.filter((r) => r.type === t).length + 1; const prev = p.rounds[p.rounds.length - 1];
  new FormModal('New reader round', [
    { key: 'type', label: 'Type', type: 'select', options: [['beta', 'Beta'], ['alpha', 'Alpha']] },
    { key: 'name', label: 'Name', placeholder: `Beta round ${n('beta')} / Alpha round ${n('alpha')}` },
    { key: 'version', label: 'Manuscript version', type: 'select', options: versions(p).reverse() },
    { key: 'due', label: 'Feedback due', type: 'date' }, { key: 'focus', label: 'Focus for this round', placeholder: 'e.g. Does the ending land?' },
    prev ? { key: 'copy', label: `Copy readers from “${prev.name}”`, type: 'checkbox' } : null,
    prev && prev.questions.length ? { key: 'copyQ', label: `Copy questions from “${prev.name}”`, type: 'checkbox', value: true } : null,
  ].filter(Boolean), 'Create round', (v) => {
    const r = { id: uid(), type: v.type, name: v.name.trim() || `${v.type === 'alpha' ? 'Alpha' : 'Beta'} round ${n(v.type)}`, version: v.version, due: v.due, focus: v.focus, questions: [], includeInCompile: null, sends: [] };
    if (v.copy) r.sends = prev.sends.filter((s) => s.status !== 'Dropped').map((s) => ({ r: s.r, sent: '', format: s.format, version: v.version, status: 'Not sent', due: v.due, files: [], answers: {} }));
    if (v.copyQ) { r.questions = prev.questions.map((q) => Object.assign({}, q, { id: uid() })); r.includeInCompile = prev.includeInCompile; }
    p.rounds.push(r); DS().ui.round = r.id;
    const G = p.checklists.draft.find((g) => g.g === 'Reader rounds'); if (G) G.items.splice(Math.max(0, G.items.length - 1), 0, { id: uid(), t: `${r.name}: feedback in`, auto: null, done: false, due: v.due || '', wk: false });
    save(); view.render();
  }).open();
}
function sendModal(view, p, rd) {
  if (!p.rounds.length) { newRoundModal(view, p); return; }
  rd = rd || p.rounds[p.rounds.length - 1];
  new FormModal('Send manuscript to a reader', [
    { key: 'round', label: 'Round', type: 'select', options: p.rounds.map((r) => [r.id, `${r.name} (${r.version})`]), value: rd.id },
    { key: 'r', label: 'Reader', type: 'select', options: [...p.readers.map((r) => [r.id, r.name]), ['__new', '+ New reader…']] },
    { key: 'name', label: 'New reader’s name', showIf: (i) => i.r.value === '__new' }, { key: 'contact', label: 'Contact (optional)', showIf: (i) => i.r.value === '__new' },
    { key: 'sent', label: 'Date sent', type: 'date', value: today() }, { key: 'due', label: 'Feedback due', type: 'date', value: rd.due || '' },
    { key: 'format', label: 'Format', type: 'select', options: FORMATS }, { key: 'version', label: 'Manuscript version', value: rd.version },
  ], 'Save', (v) => {
    let id = v.r;
    if (id === '__new') { if (!v.name.trim()) { notice('Enter the reader’s name.'); return; } id = uid(); p.readers.push({ id, name: v.name.trim(), contact: v.contact.trim(), color: READER_COLORS[p.readers.length % READER_COLORS.length] }); }
    const r = roundOf(p, v.round); r.sends.push({ r: id, sent: v.sent, format: v.format, version: v.version || r.version, status: v.sent ? 'Sent' : 'Not sent', due: v.due, files: [], answers: {} });
    DS().ui.round = r.id; save(); view.render();
  }).open();
}
function readerDirectory(view, p, body) {
  if (!p.readers.length) return;
  body.append(el('h2', {}, 'Reader directory'));
  const tbl = el('table', { class: 'ds-table' }, el('thead', {}, el('tr', {}, ['Reader', 'Contact', 'Rounds', 'Notes', ''].map((x) => el('th', {}, x)))));
  const tb = el('tbody'); tbl.append(tb);
  for (const r of p.readers) {
    const rs = p.rounds.filter((x) => x.sends.some((s) => s.r === r.id));
    tb.append(el('tr', {}, el('td', {}, el('span', { class: 'ds-dot', style: { background: r.color } }), ' ', r.name), el('td', { class: 'ds-hint' }, r.contact || '—'),
      el('td', {}, rs.map((x) => pill(x.name))), el('td', {}, String(p.comments.filter((c) => c.r === r.id).length)),
      el('td', {}, btn('Edit', () => new FormModal('Edit reader', [{ key: 'name', label: 'Name', value: r.name, required: true }, { key: 'contact', label: 'Contact', value: r.contact }], 'Save', (v) => { r.name = v.name.trim(); r.contact = v.contact; save(); view.render(); }).open(), 'ds-sm'))));
  }
  body.append(el('div', { class: 'ds-tablewrap' }, tbl));
}

/** Write a round's sends, questions & answers and notes to a Markdown note. */
async function exportRound(p, rd) {
  const L = [`# ${rd.name} — ${p.title}`, '', `- Type: ${rd.type}`, `- Manuscript version: ${rd.version}`, `- Feedback due: ${rd.due || '—'}`, rd.focus ? `- Focus: ${rd.focus}` : '', '', '## Readers', '', '| Reader | Sent | Format | Version | Status |', '|---|---|---|---|---|'];
  for (const s of rd.sends) L.push(`| ${readerOf(p, s.r).name} | ${s.sent || '—'} | ${s.format} | ${s.version} | ${s.status} |`);
  if (rd.questions.length) { L.push('', '## Questions & answers'); rd.questions.forEach((q, i) => { L.push('', `### ${i + 1}. ${q.text}`); for (const s of rd.sends) { const v = s.answers[q.id]; if (v != null && v !== '') L.push(`- **${readerOf(p, s.r).name}:** ${String(v).replace(/\n+/g, ' ')}`); } }); }
  const notes = p.comments.filter((c) => c.round === rd.id);
  if (notes.length) { L.push('', '## Notes'); for (const c of notes) { const ch = c.ch ? `[[${c.ch.replace(/\.md$/, '')}]]` : 'whole manuscript'; L.push(`- [${c.resolved ? 'x' : ' '}] **${readerOf(p, c.r).name}** · ${c.type} · ${ch}: ${c.quote ? `“${c.quote}” — ` : ''}${c.text}`); } }
  const files = rd.sends.flatMap((s) => s.files); if (files.length) { L.push('', '## Attachments'); for (const f of files) L.push(`- [[${f}]]`); }
  const path = await writeText(normalizePath(`${projectSub(p, 'readersFolder')}/${safeName(rd.name)}.md`), L.filter((x) => x !== null).join('\n') + '\n');
  const f = app().vault.getAbstractFileByPath(path); if (f) openFile(f); notice(`Saved ${path}`);
}
