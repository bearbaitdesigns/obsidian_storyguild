/* =====================================================================
   Publish: a tiny ZIP writer (stored entries) and Markdown → book text
   ===================================================================== */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
const utf8 = (s) => new TextEncoder().encode(s);
/** files: [{ name, data: string|Uint8Array }] → Uint8Array (no compression, which EPUB and DOCX both allow). */
function makeZip(files) {
  const parts = []; const central = []; let offset = 0;
  const d = new Date(); const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1); const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    const name = utf8(f.name); const data = typeof f.data === 'string' ? utf8(f.data) : f.data; const crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
  return concatBytes([...parts, ...central, new Uint8Array(e.buffer)]);
}
function concatBytes(list) { const n = list.reduce((a, b) => a + b.length, 0); const out = new Uint8Array(n); let o = 0; for (const b of list) { out.set(b, o); o += b.length; } return out; }

/* ---------- Markdown → blocks ----------
   block: { t: 'p', runs: [{ text, i, b }], first } | { t: 'break' } | { t: 'h', text }   */
function smartQuotes(s) {
  return s.replace(/(^|[\s(\[{“‘—–-])"/g, '$1“').replace(/"/g, '”').replace(/(^|[\s(\[{“—–-])'/g, '$1‘').replace(/'/g, '’').replace(/---/g, '—').replace(/--/g, '—').replace(/\.\.\./g, '…');
}
function parseInline(s, smart) {
  if (smart) s = smartQuotes(s);
  const runs = []; const re = /(\*\*\*|___)(.+?)\1|(\*\*|__)(.+?)\3|(\*|_)(?=\S)(.+?)(?<=\S)\5|==(.+?)==/g; let last = 0; let m;
  while ((m = re.exec(s))) {
    if (m.index > last) runs.push({ text: s.slice(last, m.index) });
    if (m[2]) runs.push({ text: m[2], i: true, b: true }); else if (m[4]) runs.push({ text: m[4], b: true }); else if (m[6]) runs.push({ text: m[6], i: true }); else runs.push({ text: m[7] });
    last = re.lastIndex;
  }
  if (last < s.length) runs.push({ text: s.slice(last) });
  return runs.map((r) => Object.assign(r, { text: r.text.replace(/\\([*_\\#])/g, '$1') })).filter((r) => r.text);
}
const BREAK_RE = /^\s*(\*\s*\*\s*\*|(?:\*\s*){3,}|-{3,}|_{3,}|#|~+|⁂|❧|§)\s*$/;
function mdToBlocks(md, title, opts = {}) {
  let b = splitFrontmatter(md).body; const gblocks = [];
  b = b.replace(/^\s*```glyphs[^\n]*\n([\s\S]*?)```/gm, (m0, src) => { gblocks.push(src); return `\n\u2063GLYPHBLOCK${gblocks.length - 1}\u2063\n`; });
  b = b.replace(/%%[\s\S]*?%%/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/```[\s\S]*?```/g, '').replace(/^\s*```[^\n]*\n[\s\S]*$/m, '')
    .replace(/!\[\[[^\]]*\]\]/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(^|\s)#[A-Za-z][\w/-]*/g, '$1').replace(/<[^>]+>/g, '');
  const out = []; let afterBreak = true; let skippedTitle = false;
  for (let line of b.split(/\r?\n/)) {
    if (/^\s*>\s*\[![^\]]*\]/.test(line)) continue; // callout header
    line = line.replace(/^\s*>\s?/, '');
    if (!line.trim()) continue;
    { const gm = line.match(/\u2063GLYPHBLOCK(\d+)\u2063/); if (gm) { out.push({ t: 'glyphs', src: gblocks[+gm[1]] }); afterBreak = true; continue; } }
    if (BREAK_RE.test(line)) { if (out.length && out[out.length - 1].t !== 'break') out.push({ t: 'break' }); afterBreak = true; continue; }
    line = line.replace(/^\s*[-*+]\s+\[.\]\s+/, '').replace(/^\s*(?:[-*+]|\d+[.)])\s+(?=\S)/, '');
    const h = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (h) {
      const text = h[2].replace(/\s+#+\s*$/, '').trim();
      if (!skippedTitle && !out.length && text.toLowerCase() === String(title || '').toLowerCase()) { skippedTitle = true; continue; }
      out.push({ t: 'h', text: opts.smart !== false ? smartQuotes(text) : text }); afterBreak = true; continue;
    }
    out.push({ t: 'p', runs: parseInline(line.trim(), opts.smart !== false), first: afterBreak }); afterBreak = false;
  }
  while (out.length && out[out.length - 1].t === 'break') out.pop();
  return out;
}
const plainBlocks = (text) => String(text || '').split(/\n+/).map((x) => x.trim()).filter(Boolean).map((x, i) => ({ t: 'p', runs: parseInline(x, true), first: i === 0 }));
const runsText = (runs) => runs.map((r) => r.text).join('');

const NUM_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function numWord(n) { if (n < 20) return NUM_WORDS[n]; if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + NUM_WORDS[n % 10] : ''); return String(n); }
function chapterHeading(tpl, n, title) {
  return String(tpl || '{title}').replace(/\{n\}/g, String(n)).replace(/\{N\}/g, numWord(n)).replace(/\{title\}/g, title).replace(/^\s*[:.\-–—]\s*|\s*[:.\-–—]\s*$/g, '').trim() || title;
}
