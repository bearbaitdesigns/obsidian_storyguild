/* =====================================================================
   Publish → PDF (no libraries)
   Uses the PDF standard fonts (Times, Courier), so text must be in the
   Windows-1252 (Western European) character set; other characters print
   as “?”. For other scripts, publish to Word or EPUB instead.
   ===================================================================== */
const PDF_WIDTHS = {
  'Times-Roman': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278,500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541,350,500,350,333,500,444,1000,500,500,333,1000,556,333,889,350,611,350,350,333,333,444,444,350,500,1000,333,980,389,333,722,350,444,722,250,333,500,500,500,500,200,500,333,760,276,500,564,333,760,333,400,564,300,300,333,500,453,250,333,300,310,500,750,750,750,444,722,722,722,722,722,722,889,667,611,611,611,611,333,333,333,333,722,722,722,722,722,722,722,564,722,722,722,722,722,722,556,500,444,444,444,444,444,444,667,444,444,444,444,444,278,278,278,278,500,500,500,500,500,500,500,564,500,500,500,500,500,500,500,500],
  'Times-Italic': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,250,333,420,500,500,833,778,214,333,333,500,675,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,675,675,675,500,920,611,611,667,722,611,611,722,722,333,444,667,556,833,667,722,611,722,611,500,556,722,611,833,611,556,556,389,278,389,422,500,333,500,500,444,500,444,278,500,500,278,278,444,278,722,500,500,500,500,389,389,278,500,444,667,444,444,389,400,275,400,541,350,500,350,333,500,556,889,500,500,333,1000,500,333,944,350,556,350,350,333,333,556,556,350,500,889,333,980,389,333,667,350,389,556,250,389,500,500,500,500,275,500,333,760,276,500,675,333,760,333,400,675,300,300,333,500,523,250,333,300,310,500,750,750,750,500,611,611,611,611,611,611,889,667,611,611,611,611,333,333,333,333,722,667,722,722,722,722,722,675,722,722,722,722,722,556,611,500,500,500,500,500,500,500,667,444,444,444,444,444,278,278,278,278,500,500,500,500,500,500,500,675,500,500,500,500,500,444,500,444],
  'Times-Bold': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,250,333,555,500,500,1000,833,278,333,333,500,570,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,570,570,570,500,930,722,667,722,722,667,611,778,778,389,500,778,667,944,722,778,611,778,722,556,667,722,722,1000,722,722,667,333,278,333,581,500,333,500,556,444,556,444,333,500,556,278,333,556,278,833,556,500,556,556,444,389,333,556,500,722,500,500,444,394,220,394,520,350,500,350,333,500,500,1000,500,500,333,1000,556,333,1000,350,667,350,350,333,333,500,500,350,500,1000,333,1000,389,333,722,350,444,722,250,333,500,500,500,500,220,500,333,747,300,500,570,333,747,333,400,570,300,300,333,556,540,250,333,300,330,500,750,750,750,500,722,722,722,722,722,722,1000,722,667,667,667,667,389,389,389,389,722,722,778,778,778,778,778,570,778,722,722,722,722,722,611,556,500,500,500,500,500,500,722,444,444,444,444,444,278,278,278,278,500,556,500,500,500,500,500,570,500,556,556,556,556,500,556,500],
  'Times-BoldItalic': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,250,389,555,500,500,833,778,278,333,333,500,570,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,570,570,570,500,832,667,667,667,722,667,667,722,778,389,500,667,611,889,722,722,611,722,667,556,611,722,667,889,667,611,611,333,278,333,570,500,333,500,500,444,500,444,333,500,556,278,278,500,278,778,556,500,500,500,389,389,278,556,444,667,500,444,389,348,220,348,570,350,500,350,333,500,500,1000,500,500,333,1000,556,333,944,350,611,350,350,333,333,500,500,350,500,1000,333,1000,389,333,722,350,389,611,250,389,500,500,500,500,220,500,333,747,266,500,606,333,747,333,400,570,300,300,333,576,500,250,333,300,300,500,750,750,750,500,667,667,667,667,667,667,944,667,667,667,667,667,389,389,389,389,722,722,722,722,722,722,722,570,722,722,722,722,722,611,611,500,500,500,500,500,500,500,722,444,444,444,444,444,278,278,278,278,500,556,500,500,500,500,500,570,500,556,556,556,556,444,500,444],
};
const WIN_EXTRA = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f };
/** Unicode → a "binary string" of Windows-1252 codes. */
function toWin(s) {
  let o = ''; for (const ch of String(s).normalize('NFC')) {
    const c = ch.codePointAt(0);
    if (c === 0x2002 || c === 0x2003 || c === 0x2009 || c === 0x202f) o += ' ';
    else if ((c >= 32 && c < 127) || (c >= 0xa0 && c <= 0xff)) o += String.fromCharCode(c);
    else if (WIN_EXTRA[ch]) o += String.fromCharCode(WIN_EXTRA[ch]);
    else if (c === 0x2011 || c === 0x2010) o += '-'; else if (c === 0x2032) o += "'"; else if (c === 0x2033) o += '"';
    else o += '?';
  }
  return o;
}
const pdfStr = (bin) => '(' + bin.replace(/[\\()]/g, (m) => '\\' + m) + ')';
const latin1 = (s) => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff; return b; };
const PDF_PAGES = { '6x9': [432, 648, 54, 50], '5x8': [360, 576, 50, 45], '5.5x8.5': [396, 612, 54, 50], letter: [612, 792, 72, 72], a4: [595.28, 841.89, 72, 68] };

function jpegInfo(b) {
  if (!b || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2; while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; } const mk = b[i + 1]; const len = (b[i + 2] << 8) | b[i + 3];
    if (mk >= 0xc0 && mk <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(mk)) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8], comps: b[i + 9] };
    i += 2 + len;
  }
  return null;
}

function buildPdf(book) {
  const o = book.opts; const m = book.meta; const msf = !!o.manuscriptFormat;
  const [PW, PH, MV, MH] = msf ? PDF_PAGES.letter : PDF_PAGES[o.pageSize] || PDF_PAGES['6x9'];
  const fs = msf ? 12 : Number(o.fontSize) || 11; const lead = msf ? 24 : fs * 1.42; const indent = msf ? 36 : fs * 1.6;
  // Footer: short copyright and AI notice on every page, page number above them (book layout).
  const FOOT = (m.footer || []).filter(Boolean); const footSize = msf ? 8 : Math.max(6, fs * 0.62); const footFont = 'F1';
  const footBase = MV * 0.3; const pageNumY = footBase + FOOT.length * footSize * 1.35 + (FOOT.length ? 3 : 0);
  const top = PH - MV, bottom = Math.max(MV + (msf ? 0 : 12), (msf ? footBase + FOOT.length * footSize * 1.35 : pageNumY + fs) + 6), left = MH, right = PW - MH, W = right - left;
  const FAM = msf ? ['F5', 'F6', 'F7', 'F8'] : ['F1', 'F2', 'F3', 'F4'];
  const fontOf = (r) => FAM[(r.i ? 1 : 0) + (r.b ? 2 : 0)];
  const WT = { F1: 'Times-Roman', F2: 'Times-Italic', F3: 'Times-Bold', F4: 'Times-BoldItalic' };
  const width = (bin, f, size) => { if (!WT[f]) return bin.length * 0.6 * size; const t = PDF_WIDTHS[WT[f]]; let w = 0; for (let i = 0; i < bin.length; i++) w += t[bin.charCodeAt(i)] || 500; return (w / 1000) * size; };

  const pages = []; let cur = null; let y = 0;
  const newPage = (kind = 'body') => { cur = { ops: [], kind, num: null }; pages.push(cur); y = top; return cur; };
  const text = (bin, f, size, x0, y0) => cur.ops.push(`BT 0 Tw /${f} ${size} Tf ${x0.toFixed(2)} ${y0.toFixed(2)} Td ${pdfStr(bin)} Tj ET`);
  const center = (s, f, size, y0) => { const b = toWin(s); text(b, f, size, left + (W - width(b, f, size)) / 2, y0); };
  /** wrap plain text into centred lines */
  const centerWrap = (s, f, size, gap) => { const words = toWin(s).split(' '); let line = ''; const out = []; for (const w of words) { const t = line ? line + ' ' + w : w; if (width(t, f, size) > W && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); for (const l of out) { text(l, f, size, left + (W - width(l, f, size)) / 2, y); y -= gap; } };
  const ensure = (h) => { if (y - h < bottom) newPage(); };

  /** Lay out one paragraph of runs, justified (book) or ragged (manuscript). */
  function para(runs, first, opts = {}) {
    const words = []; let curW = null;
    for (const r of runs) { const f = opts.font || fontOf(r); const parts = toWin(r.text).split(' ');
      parts.forEach((p, i) => { if (i > 0) { if (curW) words.push(curW); curW = null; } if (p) { if (!curW) curW = []; curW.push({ s: p, f }); } }); }
    if (curW) words.push(curW);
    if (!words.length) return;
    const size = opts.size || fs; const sp = (f) => width(' ', f, size);
    const ww = (w) => w.reduce((a, p) => a + width(p.s, p.f, size), 0);
    let i = 0; let lineNo = 0;
    while (i < words.length) {
      const ind = lineNo === 0 && !first && !opts.noIndent ? indent : 0; const avail = W - ind - (opts.inset || 0) * 2;
      const line = [words[i]]; let lw = ww(words[i]); i++;
      while (i < words.length) { const add = sp(line[line.length - 1].slice(-1)[0].f) + ww(words[i]); if (lw + add > avail) break; line.push(words[i]); lw += add; i++; }
      ensure(lead); y -= lineNo === 0 && opts.before ? opts.before : 0;
      const last = i >= words.length; const gaps = line.length - 1;
      const just = !msf && !last && gaps > 0 && !opts.center ? (avail - lw) / gaps : 0;
      let x0 = left + ind + (opts.inset || 0) + (opts.center ? (avail - lw) / 2 : 0);
      // group consecutive same-font pieces into one string; spaces stretch through Tw
      let ops = `BT ${just.toFixed(3)} Tw ${x0.toFixed(2)} ${(y - fs).toFixed(2)} Td`; let f0 = null; let buf = '';
      const flush = () => { if (buf) ops += ` /${f0} ${size} Tf ${pdfStr(buf)} Tj`; buf = ''; };
      line.forEach((w, wi) => { w.forEach((p, pi) => { const pre = wi > 0 && pi === 0 ? ' ' : ''; if (p.f !== f0) { if (pre) buf += pre; flush(); f0 = p.f; buf = p.s; } else buf += pre + p.s; }); });
      flush(); cur.ops.push(ops + ' ET');
      y -= lead; lineNo++;
    }
  }
  const outline = [];
  function chapterStart(title, kind = 'chapter') {
    newPage(kind); outline.push({ title, page: pages.length - 1 });
    if (msf) { y = top - (PH - 2 * MV) / 3 + 72; center(title, 'F5', 12, y - fs); y -= lead * 2; }
    else { y = top - (PH - 2 * MV) * 0.2; centerWrap(title, 'F1', fs * 1.6, fs * 2); y -= lead * 1.5; }
  }
  function blocks(bl) {
    for (const b of bl) {
      if (b.t === 'break') { ensure(lead * 3); y -= lead * 0.3; center(o.sceneBreak || '* * *', FAM[0], fs, y - fs); y -= lead * 1.3; }
      else if (b.t === 'h') { ensure(lead * 3); y -= lead * 0.5; para([{ text: b.text, b: true }], true, { center: true, noIndent: true }); y -= lead * 0.2; }
      else para(b.runs, b.first);
    }
  }

  /* ---- cover, title, copyright, dedication ---- */
  let coverImg = null;
  if (book.cover && book.cover.ext === 'jpg' && !msf) { const ji = jpegInfo(book.cover.bytes); if (ji && (ji.comps === 3 || ji.comps === 1)) { coverImg = Object.assign(ji, { bytes: book.cover.bytes }); newPage('cover'); cur.ops.push(`q ${PW} 0 0 ${PH} 0 0 cm /Im1 Do Q`); } }
  if (o.titlePage) {
    newPage('title');
    if (msf) {
      y = top; for (const l of [m.legalName || m.author, ...(m.contact ? m.contact.split('\n') : [])]) { text(toWin(l), 'F5', 12, left, y - 12); y -= 14; }
      const wc = `About ${aboutWords(book.words)} words`; text(toWin(wc), 'F5', 12, right - width(toWin(wc), 'F5', 12), top - 12);
      y = PH / 2 + 24; center(m.title.toUpperCase(), 'F5', 12, y); y -= 24; if (m.subtitle) { center(m.subtitle, 'F5', 12, y); y -= 24; } center(`by ${m.author}`, 'F5', 12, y);
    } else {
      y = top - (PH - 2 * MV) * 0.25; centerWrap(m.title, 'F1', fs * 2.4, fs * 2.8); y -= fs;
      if (m.subtitle) { centerWrap(m.subtitle, 'F2', fs * 1.3, fs * 1.8); }
      if (m.seriesLine) { y -= fs * 0.5; centerWrap(m.seriesLine, 'F2', fs, fs * 1.5); }
      center(m.author, 'F1', fs * 1.4, MV + (PH - 2 * MV) * 0.25);
      if (m.publisher) center(m.publisher, 'F1', fs * 0.9, MV + fs);
    }
  }
  if (o.frontMatter && !msf) {
    newPage('front'); const copy = m.copyLines || [];
    const cs = fs * 0.85; const wrapped = []; for (const l of copy) { const words = toWin(l).split(' '); let line = ''; for (const w of words) { const t = line ? line + ' ' + w : w; if (width(t, 'F1', cs) > W * 0.9 && line) { wrapped.push(line); line = w; } else line = t; } wrapped.push(line); wrapped.push(''); }
    wrapped.pop(); y = bottom + wrapped.length * cs * 1.45 + fs * 2;
    for (const l of wrapped) { if (l) text(l, 'F1', cs, left + (W - width(l, 'F1', cs)) / 2, y); y -= cs * 1.45; }
    if (book.dedication) { newPage('front'); y = top - (PH - 2 * MV) * 0.3; for (const l of book.dedication.split(/\n+/)) centerWrap(l, 'F2', fs * 1.05, fs * 1.6); }
  }
  // Questions for (ARC) readers come before the contents, so readers see them first.
  if (book.questions) {
    const q = book.questions; chapterStart(q.title, 'questions');
    if (q.intro) { para([{ text: q.intro, i: true }], true); y -= lead * 0.5; }
    q.items.forEach((it, i) => { ensure(lead * 2); y -= lead * 0.4; para([{ text: `${i + 1}. ${it.text}`, b: true }], true, { noIndent: true }); });
  }
  // contents (page numbers filled in once the body is laid out)
  const tocStart = pages.length; const perToc = Math.floor((top - bottom - fs * 6) / (fs * 1.7));
  const tocEntries = [...book.chapters.map((c) => c.heading), ...book.back.map((s) => s.title)];
  const tocPages = o.toc && !msf ? Math.max(1, Math.ceil(tocEntries.length / perToc)) : 0;
  for (let i = 0; i < tocPages; i++) newPage('toc');

  /* ---- body ---- */
  const firstBody = pages.length;
  for (const c of book.chapters) { chapterStart(c.heading); blocks(c.blocks); }
  if (msf && book.chapters.length) { ensure(lead * 3); y -= lead; center('THE END', 'F5', 12, y - fs); }
  for (const s of book.back) { chapterStart(s.title, 'back'); blocks(s.blocks); }

  /* ---- page numbers, footers, headers, contents ----
     Every page is counted; the number is printed on all but the cover and title page.
     The short copyright and AI notice go at the foot of every page except the cover. */
  const coverPages = pages.filter((pg) => pg.kind === 'cover').length;
  pages.forEach((pg, i) => { pg.num = i - coverPages + 1; });
  const surname = String(m.author || '').trim().split(/\s+/).pop() || 'Author';
  pages.forEach((pg) => {
    if (pg.kind === 'cover') return; cur = pg; const isTitle = pg.kind === 'title';
    FOOT.forEach((l, k) => { const b = toWin(l); text(b, footFont, footSize, left + (W - width(b, footFont, footSize)) / 2, footBase + (FOOT.length - 1 - k) * footSize * 1.35); });
    if (isTitle) return;
    if (msf) { const h = toWin(`${surname} / ${(m.shortTitle || m.title).toUpperCase()} / ${pg.num}`); text(h, 'F5', 12, right - width(h, 'F5', 12), PH - MV / 2 - 6); }
    else { const n = toWin(String(pg.num)); text(n, 'F1', fs * 0.85, left + (W - width(n, 'F1', fs * 0.85)) / 2, pageNumY); }
  });
  if (tocPages) {
    const list = outline.filter((e) => e.page >= firstBody); let k = 0;
    for (let t = 0; t < tocPages; t++) {
      cur = pages[tocStart + t]; y = top - fs * 2;
      if (t === 0) { center('Contents', 'F1', fs * 1.5, y); y -= fs * 3.5; }
      for (; k < list.length && y > bottom + fs; k++) {
        const e = list[k]; const label = toWin(e.title); const num = toWin(String(pages[e.page].num));
        const lw = width(label, 'F1', fs), nw = width(num, 'F1', fs); const dotW = width('.', 'F1', fs);
        const dots = Math.max(0, Math.floor((W - lw - nw - fs) / dotW));
        text(label, 'F1', fs, left, y); text('.'.repeat(dots), 'F1', fs, right - nw - fs * 0.4 - dots * dotW, y); text(num, 'F1', fs, right - nw, y); y -= fs * 1.7;
      }
    }
  }

  /* ---- serialize ---- */
  const objs = []; const add = (s) => { objs.push(s); return objs.length; };
  const catalogId = add(null); const pagesId = add(null);
  const fontIds = {}; const FONTS = { F1: 'Times-Roman', F2: 'Times-Italic', F3: 'Times-Bold', F4: 'Times-BoldItalic', F5: 'Courier', F6: 'Courier-Oblique', F7: 'Courier-Bold', F8: 'Courier-BoldOblique' };
  for (const [k, n] of Object.entries(FONTS)) fontIds[k] = add(`<< /Type /Font /Subtype /Type1 /BaseFont /${n} /Encoding /WinAnsiEncoding >>`);
  const imgId = coverImg ? add({ dict: `<< /Type /XObject /Subtype /Image /Width ${coverImg.w} /Height ${coverImg.h} /ColorSpace /${coverImg.comps === 1 ? 'DeviceGray' : 'DeviceRGB'} /BitsPerComponent 8 /Filter /DCTDecode /Length ${coverImg.bytes.length} >>`, bytes: coverImg.bytes }) : null;
  const res = `<< /Font << ${Object.entries(fontIds).map(([k, id]) => `/${k} ${id} 0 R`).join(' ')} >>${imgId ? ` /XObject << /Im1 ${imgId} 0 R >>` : ''} >>`;
  const resId = add(res);
  const pageIds = [];
  for (const pg of pages) { const s = pg.ops.join('\n'); const cId = add({ dict: `<< /Length ${s.length} >>`, bin: s }); pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources ${resId} 0 R /Contents ${cId} 0 R >>`)); }
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let outlinesRef = '';
  if (outline.length) {
    const rootId = add(null); const ids = outline.map(() => add(null));
    outline.forEach((e, i) => { objs[ids[i] - 1] = `<< /Title ${pdfStr(toWin(e.title))} /Parent ${rootId} 0 R${i ? ` /Prev ${ids[i - 1]} 0 R` : ''}${i < ids.length - 1 ? ` /Next ${ids[i + 1]} 0 R` : ''} /Dest [${pageIds[e.page]} 0 R /XYZ null null null] >>`; });
    objs[rootId - 1] = `<< /Type /Outlines /First ${ids[0]} 0 R /Last ${ids[ids.length - 1]} 0 R /Count ${ids.length} >>`; outlinesRef = ` /Outlines ${rootId} 0 R /PageMode /UseOutlines`;
  }
  objs[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R${outlinesRef} >>`;
  const infoId = add(`<< /Title ${pdfStr(toWin(m.title))} /Author ${pdfStr(toWin(m.author))} /Creator (Storyguild Draftsmith) >>`);
  const chunks = [latin1('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')]; let off = chunks[0].length; const xref = [];
  objs.forEach((ob, i) => {
    xref.push(off); let parts;
    if (typeof ob === 'string') parts = [latin1(`${i + 1} 0 obj\n${ob}\nendobj\n`)];
    else parts = [latin1(`${i + 1} 0 obj\n${ob.dict}\nstream\n`), ob.bytes || latin1(ob.bin), latin1('\nendstream\nendobj\n')];
    for (const p of parts) { chunks.push(p); off += p.length; }
  });
  const xr = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${xref.map((o2) => String(o2).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${off}\n%%EOF\n`;
  chunks.push(latin1(xr));
  return { bytes: concatBytes(chunks), pages: pages.length, outline: outline.map((e) => ({ title: e.title, num: pages[e.page].num })) };
}
