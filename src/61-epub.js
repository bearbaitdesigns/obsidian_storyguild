/* =====================================================================
   Publish → EPUB 3 (with an EPUB 2 table of contents for older readers)
   ===================================================================== */
const xe = (s) => esc(s);
const runsHtml = (runs) => runs.map((r) => { let t = xe(r.text); if (r.b) t = `<strong>${t}</strong>`; if (r.i) t = `<em>${t}</em>`; return t; }).join('');
function blocksHtml(blocks, brk) {
  return blocks.map((b) => b.t === 'break' ? `<p class="brk">${xe(brk)}</p>` : b.t === 'h' ? `<h3>${xe(b.text)}</h3>` : `<p${b.first ? ' class="first"' : ''}>${runsHtml(b.runs)}</p>`).join('\n');
}
const xhtml = (title, lang, body, cls = '') => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${xe(lang)}" lang="${xe(lang)}">
<head><meta charset="UTF-8"/><title>${xe(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body${cls ? ` class="${cls}"` : ''}>
${body}
</body>
</html>`;
const EPUB_CSS = `body{margin:0 5%;font-family:serif;line-height:1.45}
h1,h2{text-align:center;font-weight:normal;margin:3em 0 1.5em;page-break-before:always}
h2.ch{font-size:1.4em}
h3{text-align:center;font-size:1.05em;font-weight:bold;margin:1.5em 0 .8em}
p{margin:0;text-indent:1.4em;text-align:justify}
p.first,p.noind{text-indent:0}
p.brk{text-indent:0;text-align:center;margin:1em 0;letter-spacing:.3em}
.title{text-align:center;margin-top:30%}
.title h1{font-size:2em;margin:0 0 .3em;page-break-before:auto}
.title .sub{font-style:italic;margin-bottom:2em}
.title .by{font-size:1.2em;margin-top:3em}
.copy p,.ded p{text-indent:0;text-align:center}
.copy{margin-top:40%;font-size:.85em}
.ded{margin-top:30%;font-style:italic}
.cover{margin:0;padding:0;text-align:center}
.cover img{max-width:100%;max-height:100%}
.map{text-align:center;margin:1em 0}.map img{max-width:100%;height:auto}
nav ol{list-style:none;padding:0}
nav li{margin:.4em 0}
.q li{margin:0 0 1.2em}
.q .opt{font-size:.9em;color:#555}
.legal{margin-top:3em;font-size:.7em;color:#777;text-align:center}
.legal p,p.legal{text-indent:0;text-align:center}`;

function buildEpub(book) {
  const m = book.meta; const lang = m.language || 'en'; const files = []; const items = []; const spine = []; const toc = [];
  const add = (id, href, type, data, props, inSpine = true, tocTitle = null) => { files.push({ name: 'OEBPS/' + href, data }); items.push({ id, href, type, props }); if (inSpine) spine.push(id); if (tocTitle) toc.push({ href, title: tocTitle }); };
  // E-books have no fixed pages: the short copyright and AI notice end every section instead.
  const legal = (m.footer || []).length ? `<div class="legal">${m.footer.map((l) => `<p>${xe(l)}</p>`).join('')}</div>` : '';
  const uidv = m.isbn ? `urn:isbn:${m.isbn.replace(/[^0-9Xx]/g, '')}` : `urn:uuid:${m.uuid}`;
  if (book.cover) {
    add('cover-img', `images/cover.${book.cover.ext}`, book.cover.mime, book.cover.bytes, 'cover-image', false);
    add('cover', 'cover.xhtml', 'application/xhtml+xml', xhtml('Cover', lang, `<div class="cover"><img src="images/cover.${book.cover.ext}" alt="${xe(m.title)}"/></div>`, 'cover'));
  }
  if (book.opts.titlePage) add('titlepage', 'title.xhtml', 'application/xhtml+xml', xhtml(m.title, lang, `<div class="title"><h1>${xe(m.title)}</h1>${m.subtitle ? `<div class="sub">${xe(m.subtitle)}</div>` : ''}${m.seriesLine ? `<div>${xe(m.seriesLine)}</div>` : ''}<div class="by">${xe(m.author)}</div>${m.publisher ? `<p class="noind" style="text-align:center;margin-top:4em">${xe(m.publisher)}</p>` : ''}</div>`));
  if (book.opts.frontMatter) {
    const copy = m.copyLines || [];
    add('copyright', 'copyright.xhtml', 'application/xhtml+xml', xhtml('Copyright', lang, `<div class="copy">${copy.map((l) => `<p>${xe(l)}</p>`).join('')}${(m.footer || []).map((l) => `<p class="legal">${xe(l)}</p>`).join('')}</div>`));
    if (book.dedication) add('dedication', 'dedication.xhtml', 'application/xhtml+xml', xhtml('Dedication', lang, `<div class="ded">${book.dedication.split(/\n+/).map((l) => `<p>${xe(l)}</p>`).join('')}</div>`), null, true, null);
  }
  // Questions for (ARC) readers come before the contents.
  if (book.questions) {
    const q = book.questions;
    const li = q.items.map((it) => `<li>${xe(it.text)}</li>`).join('\n');
    add('questions', 'questions.xhtml', 'application/xhtml+xml', xhtml(q.title, lang, `<h2>${xe(q.title)}</h2>${q.intro ? `<p class="noind">${xe(q.intro)}</p>` : ''}<ol class="q">${li}</ol>${legal}`), null, true, q.title);
  }
  const tocPos = spine.length; // nav goes here when shown
  const firstChapter = book.chapters.length ? 'ch001.xhtml' : null;
  const mapPages = () => (book.maps || []).forEach((mp, i) => {
    add(`map${i + 1}-img`, `images/map${i + 1}.jpg`, 'image/jpeg', mp.bytes, null, false);
    add(`map${i + 1}`, `map${i + 1}.xhtml`, 'application/xhtml+xml', xhtml(mp.title, lang, `<h2>${xe(mp.title)}</h2><div class="map"><img src="images/map${i + 1}.jpg" alt="${xe(mp.title)}"/></div>${legal}`), null, true, mp.title);
  });
  if (book.mapsPlace === 'front') mapPages();
  book.chapters.forEach((c, i) => { const href = `ch${String(i + 1).padStart(3, '0')}.xhtml`; add('ch' + (i + 1), href, 'application/xhtml+xml', xhtml(c.heading, lang, `<h2 class="ch">${xe(c.heading)}</h2>\n${blocksHtml(c.blocks, book.opts.sceneBreak)}${legal}`), null, true, c.heading); });
  if (book.mapsPlace === 'back') mapPages();
  book.back.forEach((s, i) => add('back' + (i + 1), `back${i + 1}.xhtml`, 'application/xhtml+xml', xhtml(s.title, lang, `<h2>${xe(s.title)}</h2>\n${blocksHtml(s.blocks, book.opts.sceneBreak)}${legal}`), null, true, s.title));
  const navBody = `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${toc.map((t) => `<li><a href="${t.href}">${xe(t.title)}</a></li>`).join('')}</ol></nav>
<nav epub:type="landmarks" hidden=""><ol>${book.cover ? '<li><a epub:type="cover" href="cover.xhtml">Cover</a></li>' : ''}${firstChapter ? `<li><a epub:type="bodymatter" href="${firstChapter}">Start</a></li>` : ''}</ol></nav>`;
  files.push({ name: 'OEBPS/nav.xhtml', data: xhtml('Contents', lang, navBody) }); items.push({ id: 'nav', href: 'nav.xhtml', type: 'application/xhtml+xml', props: 'nav' });
  if (book.opts.toc) spine.splice(tocPos, 0, 'nav');
  files.push({ name: 'OEBPS/style.css', data: EPUB_CSS }); items.push({ id: 'css', href: 'style.css', type: 'text/css' });
  const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${xe(uidv)}"/><meta name="dtb:depth" content="1"/><meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head>
<docTitle><text>${xe(m.title)}</text></docTitle><navMap>${toc.map((t, i) => `<navPoint id="np${i + 1}" playOrder="${i + 1}"><navLabel><text>${xe(t.title)}</text></navLabel><content src="${t.href}"/></navPoint>`).join('')}</navMap></ncx>`;
  files.push({ name: 'OEBPS/toc.ncx', data: ncx }); items.push({ id: 'ncx', href: 'toc.ncx', type: 'application/x-dtbncx+xml' });
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${xe(lang)}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">${xe(uidv)}</dc:identifier>
<dc:title>${xe(m.title)}</dc:title>
<dc:creator>${xe(m.author)}</dc:creator>
<dc:language>${xe(lang)}</dc:language>
${m.publisher ? `<dc:publisher>${xe(m.publisher)}</dc:publisher>` : ''}
${m.date ? `<dc:date>${xe(m.date)}</dc:date>` : ''}
${m.description ? `<dc:description>${xe(m.description)}</dc:description>` : ''}
${(m.subjects || []).map((s) => `<dc:subject>${xe(s)}</dc:subject>`).join('\n')}
<dc:rights>Copyright © ${xe(m.copyright || '')} ${xe(m.author)}</dc:rights>
<meta property="dcterms:modified">${modified}</meta>
${book.cover ? '<meta name="cover" content="cover-img"/>' : ''}
</metadata>
<manifest>
${items.map((i) => `<item id="${i.id}" href="${i.href}" media-type="${i.type}"${i.props ? ` properties="${i.props}"` : ''}/>`).join('\n')}
</manifest>
<spine toc="ncx">
${spine.map((id) => `<itemref idref="${id}"${id === 'cover' ? ' linear="no"' : ''}/>`).join('\n')}
</spine>
</package>`;
  return makeZip([
    { name: 'mimetype', data: 'application/epub+zip' },
    { name: 'META-INF/container.xml', data: '<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>' },
    { name: 'OEBPS/content.opf', data: opf }, ...files,
  ]);
}
