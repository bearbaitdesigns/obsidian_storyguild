/* =====================================================================
   Publishing checklist tab — Drafting & Revision · Traditional · Self-publishing
   ===================================================================== */
function autoChecks(p) {
  const chs = listChapters(p); const fin = finalStatus();
  const lastOf = (t) => [...p.rounds].reverse().find((r) => r.type === t);
  const roundDone = (r, notes) => !!r && r.sends.filter((s) => s.status !== 'Dropped').length > 0 && r.sends.every((s) => s.status === 'Feedback in' || s.status === 'Dropped') && (!notes || !p.comments.some((c) => c.round === r.id && !c.resolved));
  const filled = (k) => !!String(p[k] || '').trim();
  const S = HOST.world && WorldkeeperModule.storyguild.S;
  return {
    logline: ['Book details › Logline', () => filled('logline')],
    outline: ['Plot Weaver › linked novel has cards on the board', () => { const n = linkedNovel(p); return !!n && (n.beats || []).some((b) => b.chapterId && (!b.status || b.status === 'active')); }],
    characters: ['Worldkeeper › at least 3 character sheets', () => { try { return !!S && S.notesOf('character').length >= 3; } catch (e) { return false; } }],
    chapters: ['Manuscript › chapter notes exist', () => chs.length > 0],
    alpha: ['Readers › latest alpha round: all feedback in', () => roundDone(lastOf('alpha'))],
    beta: ['Readers › latest beta round: all feedback in, notes resolved', () => roundDone(lastOf('beta'), true)],
    target: ['Manuscript › total words within 10% of target', () => p.targetWords > 0 && Math.abs(totalWords(p) - p.targetWords) / p.targetWords <= 0.1],
    final: [`Manuscript › every chapter’s status is “${fin}” (ideas aside)`, () => chs.some((c) => !isIdea(c)) && chs.filter((c) => !isIdea(c)).every((c) => statusDef(c.status)?.name === fin)],
    drafting: ['Drafting & Revision tab › every step done', () => p.checklists.draft.every((g) => g.items.every((it) => it.auto === 'drafting' || itemDone(p, it)))],
    synopsis: ['Book details › Full synopsis', () => filled('synopsis')], comps: ['Book details › Comparable titles', () => filled('comps')], bio: ['Book details › About the author', () => filled('bio')],
    cover: ['Book details › Cover', () => filled('cover')], dedication: ['Book details › Dedication', () => filled('dedication')], publisher: ['Book details › Publisher / imprint', () => filled('publisher')],
    isbn: ['Book details › an ISBN', () => filled('isbnEbook') || filled('isbnPrint')], blurb: ['Book details › Blurb', () => filled('blurb')], keywords: ['Book details › Keywords', () => filled('keywords')],
  };
}
function itemDone(p, it) { if (!it.auto) return !!it.done; const a = autoChecks(p)[it.auto]; try { return a ? !!a[1]() : !!it.done; } catch (e) { return false; } }

function renderChecklist(view, p, body) {
  reflectChecklistMilestones(p);
  const tab = CHECKLIST_NAMES[p.checklistTab] ? p.checklistTab : 'draft'; const L = p.checklists[tab]; const autos = autoChecks(p);
  const all = L.flatMap((g) => g.items); const done = all.filter((it) => itemDone(p, it)).length;
  body.append(el('div', { class: 'ds-row' }, el('p', { class: 'ds-hint ds-grow' }, tab === 'draft' ? 'Prep, drafts, revisions and reader rounds — everything up to a finished manuscript.' : 'The usual steps from finished manuscript to launch.',
    ' Steps marked ⚡ tick themselves from your data. Add, remove or date any step; 🎯 makes a dated step a milestone on Worldkeeper Home.'),
    el('div', { class: 'ds-seg' }, Object.entries(CHECKLIST_NAMES).map(([k, l]) => el('button', { class: k === tab ? 'is-on' : '', onclick: () => { p.checklistTab = k; SG.saveSoon(); view.render(); } }, l)))));
  body.append(card(null, el('div', { class: 'ds-row' }, el('b', { class: 'ds-grow' }, `${CHECKLIST_NAMES[tab]} · ${done} of ${all.length} done`), el('span', { class: 'ds-hint' }, all.length ? Math.round((done / all.length) * 100) + '%' : '')),
    el('div', { class: 'ds-bar' }, el('i', { style: { width: (all.length ? (done / all.length) * 100 : 0) + '%' } }))));

  L.forEach((g, gi) => {
    const gd = g.items.filter((it) => itemDone(p, it)).length;
    const box = card(el('div', { class: 'ds-row' }, el('input', { type: 'text', value: g.g, class: 'ds-ghost ds-grow', onchange: (e) => { g.g = e.target.value; SG.saveSoon(); } }), el('span', { class: 'ds-hint' }, `${gd}/${g.items.length}`),
      btn('✕', () => new ConfirmModal(`Remove section “${g.g}”?`, `Its ${g.items.length} steps are removed too.`, 'Remove', () => { L.splice(gi, 1); SG.saveSoon(); view.render(); }).open(), 'clickable-icon ds-sm', 'Remove section')));
    g.items.forEach((it, ii) => {
      const isDone = itemDone(p, it);
      const cb = el('input', { type: 'checkbox', checked: isDone, disabled: !!it.auto, title: it.auto ? 'Ticks itself' : '' });
      const sync = () => { if (it.wk) setChecklistMilestone(p, it, tab, g.g, true); };
      cb.addEventListener('change', () => { it.done = cb.checked; SG.saveSoon(); sync(); view.render(); });
      const text = el('input', { type: 'text', value: it.t, class: 'ds-ghost' }); text.addEventListener('change', () => { it.t = text.value; SG.saveSoon(); sync(); });
      const due = el('input', { type: 'date', value: it.due || '', title: 'Target date' }); due.addEventListener('change', () => { it.due = due.value; SG.saveSoon(); sync(); view.render(); });
      const wk = el('button', { class: 'ds-wk' + (it.wk ? ' is-on' : ''), title: it.wk ? 'A milestone on Worldkeeper Home (Milestones & deadlines) — click to remove' : 'Make this a milestone on Worldkeeper Home (Milestones & deadlines)' }, '🎯');
      wk.addEventListener('click', () => {
        const on = !it.wk; if (on && !it.due) { notice('Give the step a target date first — it becomes the milestone’s deadline.'); due.focus(); return; }
        it.wk = on; setChecklistMilestone(p, it, tab, g.g, on);
        notice(on ? `“${it.t}” is now a milestone on Worldkeeper Home.` : `“${it.t}” was removed from Worldkeeper’s milestones.`); view.render();
      });
      const a = it.auto && autos[it.auto];
      box.append(el('div', { class: 'ds-ck' + (isDone ? ' is-done' : '') }, cb, el('div', { class: 'ds-ck-t' }, text, a ? el('small', { class: 'ds-auto' }, '⚡ ' + a[0]) : null), due, wk,
        btn('✕', () => { if (it.wk) setChecklistMilestone(p, it, tab, g.g, false); g.items.splice(ii, 1); SG.saveSoon(); view.render(); }, 'clickable-icon ds-sm', 'Remove step')));
    });
    const add = el('input', { type: 'text', placeholder: 'Add a step…', class: 'ds-grow' });
    const doAdd = () => { const t = add.value.trim(); if (!t) return; g.items.push({ id: uid(), t, auto: null, done: false, due: '', wk: false }); SG.saveSoon(); view.render(); };
    add.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });
    box.append(el('div', { class: 'ds-row' }, add, btn('Add', doAdd, 'ds-sm')));
    body.append(box);
  });
  body.append(el('div', { class: 'ds-row' }, btn('+ Add section', () => new FormModal('New section', [{ key: 'g', label: 'Section name', required: true }], 'Add', (v) => { L.push({ id: uid(), g: v.g.trim(), items: [] }); SG.saveSoon(); view.render(); }).open()),
    btn('Reset this tab to the standard steps…', () => new ConfirmModal(`Reset ${CHECKLIST_NAMES[tab]}?`, 'Your own steps, ticks and dates on this tab are replaced with the standard list.', 'Reset', () => { p.checklists[tab] = makeChecklists()[tab]; SG.saveSoon(); view.render(); }).open())));


}
