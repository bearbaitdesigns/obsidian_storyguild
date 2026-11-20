/* =====================================================================
   Stats tab
   ---------------------------------------------------------------------
   Daily history: each book keeps { 'YYYY-MM-DD': total words } — the book's
   total (ideas not counted) saved once a day whenever counts change. Words
   written on a day = that day's total minus the previous saved total.
   Worldkeeper's own daily history (same format) is imported once, so charts
   aren't empty on the first day.
   ===================================================================== */
const STAT_RANGES = [['7', 'Week', 7], ['30', '30 days', 30], ['90', '90 days', 90], ['365', '12 months', 365], ['all', 'All time', 0]];
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseDay = (s) => new Date(s + 'T12:00:00');
const addDay = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const shortDate = (d, opts = { day: 'numeric', month: 'short' }) => d.toLocaleDateString(undefined, opts);
const pctOf = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/** Save today's total for a book (called when chapter counts change). */
function recordHistory(p) {
  if (!p) return; p.history = p.history || {};
  const t = totalWords(p); const k = today();
  if (p.history[k] !== t) { p.history[k] = t; SG.saveSoon(2000); }
}
/** One-time: bring in Worldkeeper's daily word history for a book that has none. */
function importWorldHistory(p) {
  if (!p || p.historyImported) return; p.historyImported = true;
  const wk = (HOST.world && HOST.world.settings && HOST.world.settings.history) || (SG.data.world && SG.data.world.history) || {};
  p.history = p.history || {}; let n = 0;
  for (const [k, v] of Object.entries(wk)) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && p.history[k] == null && Number.isFinite(+v)) { p.history[k] = +v; n++; }
  if (n) SG.saveSoon();
}
/** Daily series from the first saved day to today: { d, date, total, words } */
function dailySeries(p) {
  const h = p.history || {}; const keys = Object.keys(h).sort(); const now = new Date(); now.setHours(12, 0, 0, 0);
  if (!keys.length) return [];
  const out = []; let prev = null; let i = 0;
  for (let d = parseDay(keys[0]); d <= now; d = addDay(d, 1)) {
    const k = isoDay(d); let total = prev;
    while (i < keys.length && keys[i] <= k) { total = h[keys[i]]; i++; }
    out.push({ d, date: k, total: total ?? 0, words: prev == null ? 0 : (total ?? 0) - prev }); prev = total ?? prev;
  }
  return out;
}

/* ---------- tiny SVG + tooltip helpers ---------- */
const SVGNS = 'http://www.w3.org/2000/svg';
function sv(tag, a = {}, text) { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; }
function statTip() { let t = document.body.querySelector(':scope > .ds-stat-tip'); if (!t) { t = el('div', { class: 'ds-stat-tip' }); document.body.append(t); } return t; }
function tipShow(e, html) { const t = statTip(); t.empty(); put(t, ...html); t.style.opacity = '1'; const x = Math.min(e.clientX + 14, window.innerWidth - t.offsetWidth - 8); t.style.left = `${x}px`; t.style.top = `${e.clientY + 14}px`; }
const tipHide = () => { const t = document.body.querySelector(':scope > .ds-stat-tip'); if (t) t.style.opacity = '0'; };
function hover(node, fn) { node.addEventListener('mousemove', (e) => tipShow(e, fn())); node.addEventListener('mouseleave', tipHide); return node; }
function niceTicks(min, max, n = 4) {
  const raw = Math.max(1, (max - min) / n); const p = 10 ** Math.floor(Math.log10(raw)); const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= raw);
  const out = []; for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) out.push(v); if (out[out.length - 1] < max) out.push(out[out.length - 1] + step); return out;
}
const roundedBar = (x, y0, w, y1, r = 4) => { const top = Math.min(y0, y1), h = Math.abs(y1 - y0); const rr = Math.min(r, w / 2, h); return y1 <= y0
  ? `M${x},${y0} V${top + rr} Q${x},${top} ${x + rr},${top} H${x + w - rr} Q${x + w},${top} ${x + w},${top + rr} V${y0} Z`
  : `M${x},${y0} H${x + w} V${y1 - rr} Q${x + w},${y1} ${x + w - rr},${y1} H${x + rr} Q${x},${y1} ${x},${y1 - rr} Z`; };
const cardBox = (title, sub, ...kids) => el('div', { class: 'ds-card ds-scard' }, el('div', { class: 'ds-sch' }, el('h3', {}, title), sub ? el('span', { class: 'ds-hint' }, sub) : null), ...kids);
const legend = (items) => el('div', { class: 'ds-slegend' }, items.map(([label, color, dashed]) => el('span', {}, el('i', { class: dashed ? 'is-dash' : '', style: dashed ? { 'border-color': color } : { background: color } }), label)));
function withTable(view, key, chart, rows, cols) {
  const ui = DS().ui; ui.statTables = ui.statTables || {}; const on = !!ui.statTables[key];
  const btnEl = el('a', { class: 'ds-mini ds-stt', onclick: () => { ui.statTables[key] = !on; SG.saveSoon(); view.render(); } }, on ? 'Chart' : 'Table');
  return { btn: btnEl, body: on ? el('table', { class: 'ds-table ds-stable' }, el('thead', {}, el('tr', {}, cols.map((c, i) => el('th', { class: i ? 'ds-r' : '' }, c)))), el('tbody', {}, rows.map((r) => el('tr', {}, r.map((v, i) => el('td', { class: i ? 'ds-r' : '' }, v)))))) : chart };
}

/* ---------- the tab ---------- */
function renderStats(view, p, body) {
  importWorldHistory(p); recordHistory(p);
  const ui = DS().ui; const range = STAT_RANGES.some((r) => r[0] === ui.statsRange) ? ui.statsRange : '30'; const goal = Number.isFinite(+p.dailyGoal) ? +p.dailyGoal : 500;
  const all = dailySeries(p); const total = totalWords(p);
  const n = range === 'all' ? all.length : STAT_RANGES.find((r) => r[0] === range)[2]; const rangeLabel = STAT_RANGES.find((r) => r[0] === range)[1];
  // pad the front so short histories still show the whole period
  const r = all.slice(-n); while (range !== 'all' && r.length < n && r.length) r.unshift({ d: addDay(r[0].d, -1), date: isoDay(addDay(r[0].d, -1)), total: r[0].total - r[0].words, words: 0, empty: true });

  const goalInput = el('input', { type: 'number', min: 0, step: 50, value: goal, class: 'ds-w90' });
  goalInput.addEventListener('change', () => { p.dailyGoal = Math.max(0, Number(goalInput.value) || 0); SG.saveSoon(); view.render(); });
  put(body, el('div', { class: 'ds-row ds-sfilters' },
    el('div', { class: 'ds-seg' }, STAT_RANGES.map(([k, l]) => el('button', { class: k === range ? 'is-on' : '', onclick: () => { ui.statsRange = k; SG.saveSoon(); view.render(); } }, l))),
    el('label', { class: 'ds-toggle' }, 'Daily goal ', goalInput, ' words'), el('span', { class: 'ds-grow' }),
    el('span', { class: 'ds-hint' }, all.length ? `Tracking since ${shortDate(all[0].d, { day: 'numeric', month: 'short', year: 'numeric' })}. Ideas aren’t counted.` : 'Daily tracking starts today. Ideas aren’t counted.')));

  // headline numbers
  const last30 = all.slice(-30); const avg30 = last30.length ? last30.reduce((a, d) => a + d.words, 0) / Math.max(1, last30.length) : 0;
  const todayWords = all.length ? all[all.length - 1].words : 0; const written = r.reduce((a, d) => a + Math.max(0, d.words), 0); const net = r.reduce((a, d) => a + d.words, 0);
  let cur = 0; for (let i = all.length - 1; i >= 0; i--) { if (all[i].words > 0) cur++; else if (i === all.length - 1) continue; else break; }
  let best = 0, run = 0; for (const d of all) { run = d.words > 0 ? run + 1 : 0; best = Math.max(best, run); }
  const left = Math.max(0, (p.targetWords || 0) - total); const daysToFinish = avg30 > 0 ? Math.ceil(left / avg30) : Infinity;
  const tooFar = left > 0 && daysToFinish > 1825; // over 5 years: not a useful projection
  const finish = left === 0 ? new Date() : avg30 > 0 && !tooFar ? addDay(new Date(), daysToFinish) : null;
  const kpi = (label, value, sub, extra) => el('div', { class: 'ds-stat' }, el('small', {}, label), el('b', {}, value), el('span', {}, sub), extra || null);
  put(body, el('div', { class: 'ds-stats' },
    kpi('Total words', fmtN(total), p.targetWords ? `of ${fmtN(p.targetWords)} · ${pctOf(total, p.targetWords)}%` : 'no target set', p.targetWords ? el('div', { class: 'ds-bar' }, el('i', { style: { width: Math.min(100, pctOf(total, p.targetWords)) + '%' } })) : null),
    kpi('Today', fmtN(todayWords), goal ? (todayWords >= goal ? `✓ goal met (${fmtN(goal)})` : `${fmtN(goal - todayWords)} to go`) : ''),
    kpi(rangeLabel, fmtN(written), `written · net ${net >= 0 ? '+' : ''}${fmtN(net)}`),
    kpi('Daily average', fmtN(r.length ? Math.round(net / r.length) : 0), goal ? `${r.filter((d) => d.words >= goal).length} of ${r.length} days at goal` : ''),
    kpi('Streak', `${cur} day${cur === 1 ? '' : 's'}`, `longest ${best} day${best === 1 ? '' : 's'}`),
    kpi('Projected finish', left === 0 ? 'Reached!' : finish ? shortDate(finish, { day: 'numeric', month: 'short', year: 'numeric' }) : tooFar ? '5+ years' : '—', left === 0 ? 'target met' : avg30 > 0 ? `at your 30-day pace (${fmtN(Math.round(avg30))}/day)` : 'write a little to see a pace')));
  if (p.deadline && left > 0) {
    const dl = parseDay(p.deadline); const daysLeft = Math.round((dl - new Date()) / 864e5); const need = daysLeft > 0 ? Math.ceil(left / daysLeft) : null;
    const late = (finish && finish > dl) || tooFar;
    put(body, el('div', { class: 'ds-callout' + (late ? ' is-late' : '') }, daysLeft < 0 ? `📅 Your draft deadline (${shortDate(dl, { day: 'numeric', month: 'short', year: 'numeric' })}) has passed, with ${fmtN(left)} words to go.`
      : late ? `📅 Your draft deadline is ${shortDate(dl, { day: 'numeric', month: 'short', year: 'numeric' })} (${daysLeft} days). ${finish ? `At your current pace you’d finish about ${Math.round((finish - dl) / 864e5)} days later.` : 'At your current pace you’d need years more.'} To make it, write about ${fmtN(need)} words a day${goal && need > goal ? ` (${fmtN(need - goal)} more than your daily goal)` : ''}.`
        : `📅 On track: at your current pace you’ll reach ${fmtN(p.targetWords)} words before your deadline (${shortDate(dl, { day: 'numeric', month: 'short', year: 'numeric' })}).`));
  }

  const grid = el('div', { class: 'ds-sgrid' }); put(body, grid);
  const W = () => Math.max(320, (body.clientWidth || 900) - 40);

  /* words per day */
  {
    const weekly = r.length > 90; let pts = r;
    if (weekly) { pts = []; for (let i = 0; i < r.length; i += 7) { const s = r.slice(i, i + 7); pts.push({ d: s[0].d, words: s.reduce((a, x) => a + x.words, 0) }); } }
    const g = weekly ? goal * 7 : goal; const w = W(), H = 210, L = 46, R = 8, T = 8, B = 24; const pw = w - L - R, ph = H - T - B;
    const tk = niceTicks(Math.min(0, ...pts.map((x) => x.words)), Math.max(g * 1.15, 10, ...pts.map((x) => x.words))); const min = tk[0], max = tk[tk.length - 1];
    const y = (v) => T + (ph * (max - v)) / (max - min); const bw = pw / Math.max(1, pts.length); const gap = Math.min(2, bw * 0.25);
    const svg = sv('svg', { viewBox: `0 0 ${w} ${H}`, height: H, class: 'ds-svg', role: 'img', 'aria-label': 'Words written per day' });
    for (const v of tk) { put(svg, sv('line', { x1: L, x2: w - R, y1: y(v), y2: y(v), class: 'ds-grid' }), sv('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, fmtN(v))); }
    put(svg, sv('line', { x1: L, x2: w - R, y1: y(0), y2: y(0), class: 'ds-axis' }));
    pts.forEach((pt, i) => {
      const x = L + i * bw + gap / 2, bwid = Math.max(1, bw - gap);
      if (pt.words) put(svg, sv('path', { d: roundedBar(x, y(0), bwid, y(pt.words)), class: pt.words < 0 ? 'ds-bar-cut' : pt.words >= g && g ? 'ds-bar-on' : 'ds-bar-soft' }));
      put(svg, hover(sv('rect', { x: L + i * bw, y: T, width: bw, height: ph, fill: 'transparent' }), () => [el('b', {}, (weekly ? 'Week of ' : '') + shortDate(pt.d, weekly ? { day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric', month: 'short' })), `${pt.words > 0 ? '+' : ''}${fmtN(pt.words)} words`, g ? el('span', { class: 'ds-hint' }, ` · goal ${fmtN(g)}`) : null]));
    });
    if (g) put(svg, sv('line', { x1: L, x2: w - R, y1: y(g), y2: y(g), class: 'ds-goal' }));
    const step = Math.ceil(pts.length / 8); pts.forEach((pt, i) => { if (i % step === 0) put(svg, sv('text', { x: L + i * bw + bw / 2, y: H - 6, 'text-anchor': 'middle' }, shortDate(pt.d))); });
    const t = withTable(view, 'daily', svg, r.slice().reverse().filter((d) => !d.empty).map((d) => [shortDate(d.d, { weekday: 'short', day: 'numeric', month: 'short' }), `${d.words > 0 ? '+' : ''}${fmtN(d.words)}`, fmtN(d.total)]), ['Date', 'Words', 'Total']);
    const c = cardBox('Words written per day', `${rangeLabel.toLowerCase()} · net words (cuts show below the line)${weekly ? ' · weekly' : ''}`, legend([['Words written', 'var(--interactive-accent)'], ...(g ? [['Daily goal', 'var(--text-faint)', true]] : [])]), all.length < 2 ? hint('Write for a day or two and your daily words appear here.') : t.body);
    c.classList.add('is-wide'); c.querySelector('.ds-sch').append(t.btn); put(grid, c);
  }

  /* manuscript growth */
  if (all.length) {
    const w = W(), H = 230, L = 56, R = 64, T = 12, B = 24; const pw = w - L - R, ph = H - T - B;
    const pts = r.filter((d) => !d.empty); const target = p.targetWords || 0;
    const left2 = Math.max(0, target - total); const fullDays = avg30 > 0 && left2 > 0 ? Math.ceil(left2 / avg30) : 0;
    // Show at most a year ahead (or to the deadline); a longer projection just runs off the edge.
    const horizon = Math.max(60, p.deadline ? Math.ceil((parseDay(p.deadline) - Date.now()) / 864e5) + 14 : 0); const finDays = Math.min(fullDays, Math.max(horizon, Math.min(fullDays, 365)));
    const projEnd = addDay(new Date(), finDays);
    const t0 = (pts[0] || all[all.length - 1]).d.getTime(); const t1 = Math.max(projEnd.getTime(), p.deadline ? parseDay(p.deadline).getTime() : 0, Date.now() + 864e5);
    const x = (d) => L + (pw * (d.getTime() - t0)) / (t1 - t0);
    const lo = Math.floor(Math.min(...pts.map((d) => d.total), total) / 10000) * 10000; const hi = Math.max(lo + 10000, Math.ceil((Math.max(target, total) * 1.05) / 10000) * 10000);
    const y = (v) => T + (ph * (hi - v)) / (hi - lo);
    const svg = sv('svg', { viewBox: `0 0 ${w} ${H}`, height: H, class: 'ds-svg', role: 'img', 'aria-label': 'Manuscript growth' });
    for (const v of niceTicks(lo, hi)) { if (v < lo || v > hi) continue; put(svg, sv('line', { x1: L, x2: w - R, y1: y(v), y2: y(v), class: 'ds-grid' }), sv('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, fmtN(v))); }
    if (target) put(svg, sv('line', { x1: L, x2: w - R, y1: y(target), y2: y(target), class: 'ds-goal' }), sv('text', { x: w - R + 6, y: y(target) + 4 }, 'Target'));
    let dx = -999; if (p.deadline) { dx = x(parseDay(p.deadline)); put(svg, sv('line', { x1: dx, x2: dx, y1: T, y2: T + ph, class: 'ds-deadline' }), sv('text', { x: dx, y: H - 6, 'text-anchor': 'middle', class: 'ds-strong' }, 'Deadline')); }
    if (pts.length > 1) put(svg, sv('path', { d: 'M' + pts.map((d) => `${x(d.d).toFixed(1)},${y(d.total).toFixed(1)}`).join(' L'), class: 'ds-line' }));
    const nowX = x(new Date());
    if (finDays) { put(svg, sv('line', { x1: nowX, y1: y(total), x2: x(projEnd), y2: y(Math.min(target, total + avg30 * finDays)), class: 'ds-proj' })); if (finDays === fullDays) put(svg, sv('text', { x: Math.min(x(projEnd) + 6, w - R + 6), y: y(target) + 18 }, shortDate(projEnd))); }
    put(svg, sv('circle', { cx: nowX, cy: y(total), r: 4.5, class: 'ds-dot' }), sv('text', { x: nowX - 8, y: y(total) - 10, 'text-anchor': 'end', class: 'ds-strong' }, fmtN(total)));
    const cross = sv('line', { y1: T, y2: T + ph, class: 'ds-cross', opacity: 0 }); const dot = sv('circle', { r: 4, class: 'ds-dot', opacity: 0 }); put(svg, cross, dot);
    if (pts.length) {
      const hit = sv('rect', { x: L, y: T, width: Math.max(1, nowX - L), height: ph, fill: 'transparent' }); put(svg, hit);
      hit.addEventListener('mousemove', (e) => { const bb = svg.getBoundingClientRect(); const mx = ((e.clientX - bb.left) * w) / bb.width; const tt = t0 + ((mx - L) / pw) * (t1 - t0); let b = pts[0]; for (const d of pts) if (Math.abs(d.d - tt) < Math.abs(b.d - tt)) b = d;
        cross.setAttribute('x1', x(b.d)); cross.setAttribute('x2', x(b.d)); cross.setAttribute('opacity', 1); dot.setAttribute('cx', x(b.d)); dot.setAttribute('cy', y(b.total)); dot.setAttribute('opacity', 1);
        tipShow(e, [el('b', {}, shortDate(b.d, { day: 'numeric', month: 'short', year: 'numeric' })), `${fmtN(b.total)} words`, target ? el('span', { class: 'ds-hint' }, ` · ${pctOf(b.total, target)}% of target`) : null]); });
      hit.addEventListener('mouseleave', () => { tipHide(); cross.setAttribute('opacity', 0); dot.setAttribute('opacity', 0); });
    }
    const months = []; for (let d = new Date(new Date(t0).getFullYear(), new Date(t0).getMonth() + 1, 1); d.getTime() <= t1; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(d);
    let lastX = -99; for (const d of months) { const mx = x(d); if (mx - lastX < 56 || Math.abs(mx - dx) < 40) continue; lastX = mx; put(svg, sv('text', { x: mx, y: H - 6, 'text-anchor': 'middle' }, `${d.toLocaleDateString(undefined, { month: 'short' })} ’${String(d.getFullYear()).slice(2)}`)); }
    const t = withTable(view, 'growth', svg, pts.filter((_, i) => (pts.length - 1 - i) % 7 === 0).reverse().map((d) => [shortDate(d.d, { day: 'numeric', month: 'short', year: 'numeric' }), fmtN(d.total)]), ['Week ending', 'Total words']);
    const c = cardBox('Manuscript growth', 'total words, with the target and your projected finish', legend([['Total words', 'var(--interactive-accent)'], ...(finDays ? [['Projection at your 30-day pace', 'var(--interactive-accent)', true]] : []), ...(target ? [[`Target ${fmtN(target)}`, 'var(--text-faint)', true]] : [])]), t.body);
    c.classList.add('is-wide'); c.querySelector('.ds-sch').append(t.btn); put(grid, c);
  }

  /* writing calendar */
  if (all.length) {
    const last = all.slice(-371); const start = Math.max(0, last.findIndex((d) => d.d.getDay() === 1)); const cells = last.slice(start);
    const lvl = (v) => (v <= 0 ? 0 : !goal ? 3 : v < goal * 0.5 ? 1 : v < goal ? 2 : v < goal * 1.5 ? 3 : v < goal * 2 ? 4 : 5);
    const weeks = Math.ceil(cells.length / 7); const w = W(); const gap = w < 560 ? 2 : 3; const c = Math.max(3, Math.min(15, (w - 30) / Math.max(weeks, 20) - gap)); const H = 7 * (c + gap) + 18;
    const svg = sv('svg', { viewBox: `0 0 ${w} ${H}`, height: H, class: 'ds-svg', role: 'img', 'aria-label': 'Writing calendar' });
    ['Mon', '', 'Wed', '', 'Fri', '', ''].forEach((l, i) => { if (l) put(svg, sv('text', { x: 0, y: 18 + i * (c + gap) + c - 2 }, l)); });
    let lastMonth = -1, lastLX = -99;
    cells.forEach((d, i) => { const wk = Math.floor(i / 7), dow = i % 7; const x = 30 + wk * (c + gap), yy = 16 + dow * (c + gap);
      if (dow === 0 && d.d.getMonth() !== lastMonth) { lastMonth = d.d.getMonth(); if (x - lastLX >= 26) { lastLX = x; put(svg, sv('text', { x, y: 10 }, d.d.toLocaleDateString(undefined, { month: 'short' }))); } }
      put(svg, hover(sv('rect', { x, y: yy, width: c, height: c, rx: 2.5, class: `ds-heat l${lvl(d.words)}` }), () => [el('b', {}, shortDate(d.d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })), d.words ? `${d.words > 0 ? '+' : ''}${fmtN(d.words)} words` : 'No writing'])); });
    const c2 = cardBox('Writing calendar', 'last 12 months', svg, el('div', { class: 'ds-slegend' }, 'Less', [0, 1, 2, 3, 4, 5].map((l) => el('i', { class: `ds-heat-key l${l}` })), 'More', el('span', { class: 'ds-hint' }, goal ? ' · brightest = at least twice your daily goal' : '')));
    c2.classList.add('is-wide'); put(grid, c2);
  }

  /* horizontal bar helper */
  const hbars = (rows, opts = {}) => {
    const w = Math.max(280, ((body.clientWidth || 900) - 60) / (window.innerWidth < 900 ? 1 : 2)); const rh = opts.rh || 22, L = opts.L || 150, R = 64, H = rows.length * rh + 4; const max = Math.max(1, ...rows.map((x) => x.value)); const sum = rows.reduce((a, x) => a + x.value, 0);
    const svg = sv('svg', { viewBox: `0 0 ${w} ${H}`, height: H, class: 'ds-svg', role: 'img' });
    rows.forEach((row, i) => { const yy = i * rh + 3, h = rh - 7; const bw = row.value ? Math.max(2, ((w - L - R) * row.value) / max) : 0;
      put(svg, sv('text', { x: L - 8, y: yy + h / 2 + 4, 'text-anchor': 'end', class: 'ds-label' }, row.label.length > 24 ? row.label.slice(0, 23) + '…' : row.label));
      if (bw) put(svg, sv('path', { d: `M${L},${yy} H${L + bw - Math.min(4, bw)} Q${L + bw},${yy} ${L + bw},${yy + Math.min(4, h / 2)} V${yy + h - Math.min(4, h / 2)} Q${L + bw},${yy + h} ${L + bw - Math.min(4, bw)},${yy + h} H${L} Z`, fill: row.color }));
      put(svg, sv('text', { x: L + bw + 6, y: yy + h / 2 + 4 }, row.value ? fmtN(row.value) : '—'));
      put(svg, hover(sv('rect', { x: 0, y: yy, width: w, height: rh - 2, fill: 'transparent' }), () => [el('b', {}, row.label), `${fmtN(row.value)} ${opts.unit || 'words'}`, el('span', { class: 'ds-hint' }, ` · ${pctOf(row.value, sum)}%${row.extra ? ' · ' + row.extra : ''}`)])); });
    return svg;
  };
  const tableRows = (rows) => { const sum = rows.reduce((a, x) => a + x.value, 0); return rows.map((x) => [x.label, fmtN(x.value), `${pctOf(x.value, sum)}%`]); };

  /* words by chapter */
  const chs = listChapters(p).filter((c) => !isIdea(c));
  {
    const rows = chs.map((c) => ({ label: `${c.kind === 'chapter' ? c.num : KIND_SHORT[c.kind]}  ${c.title}`, value: c.words || 0, color: (statusDef(c.status) || {}).color || '#888', extra: statusDef(c.status)?.name || c.status || 'no status' }));
    const t = withTable(view, 'chapters', rows.length ? hbars(rows, { L: 170 }) : hint('No chapters yet.'), tableRows(rows), ['Chapter', 'Words', 'Share']);
    const c = cardBox('Words by chapter', 'coloured by status', legend(statusDefs().map((d) => [d.name, d.color || '#888'])), t.body); c.querySelector('.ds-sch').append(t.btn); put(grid, c);
  }
  /* POV + plotlines */
  {
    const novel = linkedNovel(p); const pov = new Map();
    for (const c of chs) {
      let names = c.pov ? [{ name: c.pov, color: null }] : [];
      if (!names.length) { const seen = new Map(); for (const x of cardsForChapter(p, c)) if (x.pov) seen.set(x.pov.id, x.pov); names = [...seen.values()]; }
      for (const nm of names) { const e = pov.get(nm.name) || { label: nm.name, value: 0, color: nm.color }; e.value += Math.round((c.words || 0) / names.length); pov.set(nm.name, e); }
    }
    const povColors = new Map(((novel && novel.povs) || []).map((x) => [x.name, x.color]));
    const PALETTE = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'];
    const povRows = [...pov.values()].sort((a, b) => b.value - a.value).map((x, i) => Object.assign(x, { color: x.color || povColors.get(x.label) || PALETTE[i % PALETTE.length] }));
    const plotRows = novel ? (novel.plotlines || []).filter((pl) => !pl.archived).map((pl) => ({ label: pl.name, value: (novel.beats || []).filter((b) => b.plotlineId === pl.id && b.chapterId && (!b.status || b.status === 'active')).length, color: pl.color || '#888' })).filter((x) => x.value) : [];
    const t1 = withTable(view, 'pov', povRows.length ? hbars(povRows, { L: 100 }) : hint('No POV yet: set a pov property on chapters, or tag Plot Weaver cards with a POV.'), tableRows(povRows), ['POV', 'Words', 'Share']);
    const t2 = withTable(view, 'plot', plotRows.length ? hbars(plotRows, { L: 120, unit: 'cards' }) : hint(novel ? 'No cards placed in chapters yet.' : 'Link this book to a Plot Weaver novel to see its plotlines.'), tableRows(plotRows), ['Plotline', 'Cards', 'Share']);
    const c = cardBox('Words by POV', 'pov property, else Plot Weaver POV tags', t1.body, el('div', { class: 'ds-sch', style: { 'margin-top': '14px' } }, el('h3', {}, 'Plot Weaver cards by plotline'), t2.btn), t2.body);
    c.querySelector('.ds-sch').append(t1.btn); put(grid, c);
  }
  /* weekday */
  if (all.length) {
    const by = [0, 0, 0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0, 0, 0]; r.filter((d) => !d.empty).forEach((d) => { by[d.d.getDay()] += Math.max(0, d.words); cnt[d.d.getDay()]++; });
    const names = [1, 2, 3, 4, 5, 6, 0].map((i) => ({ i, label: new Date(2024, 0, 7 + i).toLocaleDateString(undefined, { weekday: 'short' }) }));
    const rows = names.map(({ i, label }) => ({ label, value: cnt[i] ? Math.round(by[i] / cnt[i]) : 0, color: 'var(--interactive-accent)', extra: 'average' }));
    const bestDay = rows.reduce((a, x) => (x.value > a.value ? x : a));
    put(grid, cardBox('Words by weekday', `average for the ${rangeLabel.toLowerCase()}${bestDay.value ? ` · best: ${bestDay.label}` : ''}`, hbars(rows, { L: 48, rh: 24 })));
  }
  /* drafts */
  {
    const hist = (p.draftHistory || []).map((h) => ({ ...h, words: h.n === p.draft ? total : h.words }));
    put(grid, cardBox('Drafts', 'words when each draft ended', el('table', { class: 'ds-table ds-stable' }, el('thead', {}, el('tr', {}, el('th', {}, 'Draft'), el('th', {}, 'Ended'), el('th', { class: 'ds-r' }, 'Words'), el('th', { class: 'ds-r' }, 'Change'))),
      el('tbody', {}, hist.map((h, i) => { const prev = i ? hist[i - 1].words : null; const nextStart = hist[i + 1] && hist[i + 1].date;
        return el('tr', {}, el('td', {}, el('b', {}, `Draft ${h.n}`), h.note ? el('span', { class: 'ds-hint' }, ` · ${h.note}`) : null), el('td', {}, h.n === p.draft ? el('span', { class: 'ds-cur' }, 'current') : nextStart ? shortDate(parseDay(nextStart), { day: 'numeric', month: 'short', year: 'numeric' }) : '—'),
          el('td', { class: 'ds-r' }, h.words == null ? '—' : fmtN(h.words)), el('td', { class: 'ds-r' }, prev == null || h.words == null ? '—' : `${h.words - prev >= 0 ? '+' : ''}${fmtN(h.words - prev)}`)); })))));
  }
  /* readers */
  {
    const sent = p.rounds.reduce((a, x) => a + x.sends.filter((s) => s.status !== 'Dropped').length, 0); const back = p.rounds.reduce((a, x) => a + x.sends.filter((s) => s.status === 'Feedback in').length, 0);
    const kinds = {}; for (const c of p.comments) kinds[c.type] = (kinds[c.type] || 0) + 1;
    const rows = Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v, color: '#3987e5' }));
    put(grid, cardBox('Readers', 'all rounds',
      el('div', { class: 'ds-facts is-3' }, el('div', {}, el('span', {}, 'Rounds'), el('b', {}, String(p.rounds.length))), el('div', {}, el('span', {}, 'Feedback in'), el('b', {}, `${back}/${sent}`)), el('div', {}, el('span', {}, 'Open notes'), el('b', {}, String(p.comments.filter((c) => !c.resolved).length)))),
      p.rounds.length ? el('table', { class: 'ds-table ds-stable' }, el('thead', {}, el('tr', {}, el('th', {}, 'Round'), el('th', {}, 'Version'), el('th', { class: 'ds-r' }, 'Feedback'))), el('tbody', {}, p.rounds.map((x) => el('tr', {}, el('td', {}, x.name), el('td', {}, x.version), el('td', { class: 'ds-r' }, `${x.sends.filter((s) => s.status === 'Feedback in').length}/${x.sends.filter((s) => s.status !== 'Dropped').length}`))))) : hint('No reader rounds yet.'),
      rows.length ? el('div', { style: { 'margin-top': '10px' } }, hbars(rows, { L: 96, unit: 'notes', rh: 20 })) : null));
  }
  /* at a glance */
  {
    const real = chs.filter((c) => c.words > 0); const avg = real.length ? real.reduce((a, c) => a + c.words, 0) / real.length : 0;
    const longest = real.reduce((a, c) => (!a || c.words > a.words ? c : a), null), shortest = real.reduce((a, c) => (!a || c.words < a.words ? c : a), null);
    const bestD = all.reduce((a, d) => (!a || d.words > a.words ? d : a), null); const mins = Math.round(total / 250);
    const wpp = (WORDS_PER_PAGE[p.compile.pageSize] || 300) * (11 / (Number(p.compile.fontSize) || 11)) ** 2; const kinds = chs.filter((c) => c.kind !== 'chapter').map((c) => c.label.toLowerCase());
    const facts = [['Reading time', `${Math.floor(mins / 60)} h ${mins % 60} min`], [`Pages (${PAGE_LABEL[p.compile.pageSize] || '6 × 9 in'})`, `≈ ${fmtN(Math.ceil(total / wpp))}`], ['Average chapter', `${fmtN(Math.round(avg))} words`],
      ['Longest chapter', longest ? `${longest.title} · ${fmtN(longest.words)}` : '—'], ['Shortest chapter', shortest ? `${shortest.title} · ${fmtN(shortest.words)}` : '—'],
      ['Best day', bestD && bestD.words > 0 ? `${shortDate(bestD.d, { day: 'numeric', month: 'short', year: 'numeric' })} · ${fmtN(bestD.words)}` : '—'], ['Days written (12 months)', String(all.slice(-365).filter((d) => d.words > 0).length)],
      ['Chapters', `${chs.filter((c) => c.kind === 'chapter').length}${kinds.length ? ' + ' + [...new Set(kinds)].join(' & ') : ''}`], ['Ideas', String(listChapters(p).filter(isIdea).length)]];
    put(grid, cardBox('At a glance', null, el('div', { class: 'ds-facts' }, facts.map(([k, v]) => el('div', {}, el('span', {}, k), el('b', {}, v))))));
  }
}
