/* =====================================================================
   Publish → Word (.docx)
   Book layout, or standard manuscript format (Courier 12, double-spaced,
   1-inch margins, surname / TITLE / page header) for agents and editors.
   ===================================================================== */
const PAGE_TWIPS = { '6x9': [8640, 12960, 1080], '5x8': [7200, 11520, 1008], '5.5x8.5': [7920, 12240, 1080], letter: [12240, 15840, 1440], a4: [11906, 16838, 1440] };
const wrun = (text, rpr = '') => `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
const wruns = (runs) => runs.map((r) => wrun(r.text, (r.b ? '<w:b/>' : '') + (r.i ? '<w:i/>' : ''))).join('');
const wp = (style, inner, extra = '') => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}</w:pPr>${inner}</w:p>`;
const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

function buildDocx(book) {
  const m = book.meta; const o = book.opts; const msf = !!o.manuscriptFormat;
  const [pw, ph, mar] = msf ? PAGE_TWIPS.letter : PAGE_TWIPS[o.pageSize] || PAGE_TWIPS['6x9'];
  const font = msf ? 'Courier New' : o.font === 'Garamond' ? 'Garamond' : o.font === 'Georgia' ? 'Georgia' : 'Times New Roman';
  const size = msf ? 24 : Math.round((o.fontSize || 11) * 2); const line = msf ? 480 : 300; const indent = msf ? 720 : 360;
  const body = [];
  // Cover page: the image fitted inside a 1-inch margin (and the page margins), centred, never stretched.
  let coverPart = null;
  if (book.cover && !msf) {
    const sz = imageSize(book.cover); const ext = book.cover.ext === 'jpg' ? 'jpeg' : book.cover.ext;
    if (sz && ['jpeg', 'png', 'gif'].includes(ext)) {
      const bw = Math.min(pw - 2880, pw - 2 * mar), bh = Math.min(ph - 2880, ph - 2 * mar) - 240; const box = fitInside(sz.w, sz.h, bw, bh);
      const cx = Math.round(box.w * 635), cy = Math.round(box.h * 635); const before = Math.max(0, Math.round((ph - 2 * mar - box.h) / 2) - 120);
      coverPart = { name: `word/media/cover.${ext}`, ext, bytes: book.cover.bytes };
      body.push(`<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="${before}" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Cover"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="cover.${ext}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdCover"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`, pageBreak);
    } else book.warnings = [...(book.warnings || []), 'The cover isn’t a JPEG, PNG or GIF, so Word output leaves it out.'];
  }
  if (o.titlePage) {
    if (msf) {
      body.push(wp('NoInd', wrun(m.legalName || m.author)), ...(m.contact ? m.contact.split('\n').map((l) => wp('NoInd', wrun(l))) : []));
      body.push(wp('NoInd', wrun(`About ${aboutWords(book.words)} words`), '<w:jc w:val="right"/>'));
      body.push(wp('NoInd', '', '<w:spacing w:before="3600"/>'), wp('Title', wrun(m.title.toUpperCase())), m.subtitle ? wp('Subtitle', wrun(m.subtitle)) : '', wp('Subtitle', wrun(`by ${m.author}`)), pageBreak);
    } else {
      body.push(wp('NoInd', '', '<w:spacing w:before="2800"/>'), wp('Title', wrun(m.title)), m.subtitle ? wp('Subtitle', wrun(m.subtitle)) : '', m.seriesLine ? wp('Subtitle', wrun(m.seriesLine)) : '', wp('Author', wrun(m.author)), pageBreak);
    }
  }
  if (o.frontMatter && !msf) {
    const copy = m.copyLines || [];
    body.push(wp('NoInd', '', '<w:spacing w:before="3600"/>'), ...copy.map((l) => wp('Center', wrun(l), '<w:spacing w:after="160"/>')), pageBreak);
    if (book.dedication) body.push(wp('NoInd', '', '<w:spacing w:before="3000"/>'), ...book.dedication.split(/\n+/).map((l) => wp('Center', wrun(l, '<w:i/>'))), pageBreak);
  }
  // Each heading gets a bookmark so the contents can show its page number (PAGEREF).
  let bm = 0; const heads = [];
  const heading = (text, inToc = true) => { const id = ++bm; const name = `_Toc_sg${id}`; if (inToc) heads.push({ name, text }); return `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:bookmarkStart w:id="${id}" w:name="${name}"/>${wrun(text)}<w:bookmarkEnd w:id="${id}"/></w:p>`; };
  // Questions for (ARC) readers come before the contents.
  if (book.questions) {
    const q = book.questions; body.push(heading(q.title, false), q.intro ? wp('NoInd', wrun(q.intro, '<w:i/>')) : '');
    q.items.forEach((it, i) => body.push(wp('Question', wrun(`${i + 1}. ${it.text}`))));
  }
  const tocAt = body.length;
  const blocks = (bl) => bl.map((b) => b.t === 'break' ? wp('SceneBreak', wrun(o.sceneBreak || '#')) : b.t === 'h' ? wp('Sub', wrun(b.text)) : wp(b.first ? 'NoInd' : '', wruns(b.runs))).join('');
  book.chapters.forEach((c) => body.push(heading(c.heading), blocks(c.blocks)));
  book.back.forEach((s) => body.push(heading(s.title), blocks(s.blocks)));
  if (msf) body.push(wp('Center', wrun('THE END'), '<w:spacing w:before="480"/>'));
  if (o.toc && !msf) {
    // A real Word contents field: entries with dotted leaders and PAGEREF page numbers.
    // Word refreshes it on opening (it asks first); LibreOffice works the numbers out itself.
    const tab = pw - 2 * mar; const fld = (instr, cached) => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>${cached}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
    const entries = heads.map((hd, i) => `<w:p><w:pPr><w:pStyle w:val="TOC1"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${tab}"/></w:tabs></w:pPr>${i === 0 ? '<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-1" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' : ''}<w:hyperlink w:anchor="${hd.name}" w:history="1">${wrun(hd.text)}<w:r><w:tab/></w:r>${fld(`PAGEREF ${hd.name} \\h`, (book.pageGuess && book.pageGuess[hd.text]) || '')}</w:hyperlink>${i === heads.length - 1 ? '<w:r><w:fldChar w:fldCharType="end"/></w:r>' : ''}</w:p>`).join('');
    body.splice(tocAt, 0, wp('TOCHeading', wrun('Contents'), '<w:pageBreakBefore/>'), entries || '');
  }
  // A manual page break right before something that already starts a new page would leave a blank page.
  const flat = body.filter((x) => x); for (let i = flat.length - 2; i >= 0; i--) if (flat[i] === pageBreak && /pageBreakBefore|w:val="Heading1"/.test(flat[i + 1].slice(0, 200))) flat.splice(i, 1);
  body.length = 0; body.push(...flat);
  const surname = String(m.author || '').trim().split(/\s+/).pop() || 'Author';
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const pageField = '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
  const legal = (m.footer || []).map((l) => `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/></w:pPr>${wrun(l, '<w:sz w:val="14"/><w:szCs w:val="14"/><w:color w:val="666666"/>')}</w:p>`).join('');
  const centred = (inner) => `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="40" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/></w:pPr>${inner}</w:p>`;
  // Headers & footers: page number on every page (except the title page), notices on every page.
  const header = msf ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr ${NS}><w:p><w:pPr><w:jc w:val="right"/></w:pPr>${wrun(`${surname} / ${(m.shortTitle || m.title).toUpperCase()} / `)}${pageField}</w:p></w:hdr>` : null;
  const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr ${NS}>${msf ? '' : centred(pageField)}${legal || (msf ? '<w:p/>' : '')}</w:ftr>`;
  const firstHeader = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr ${NS}><w:p/></w:hdr>`;
  const firstFooter = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr ${NS}>${legal || '<w:p/>'}</w:ftr>`;
  const titlePg = !!o.titlePage;
  const sect = `<w:sectPr>${header ? '<w:headerReference w:type="default" r:id="rIdHdr"/>' : ''}${titlePg ? '<w:headerReference w:type="first" r:id="rIdHdr1"/><w:footerReference w:type="first" r:id="rIdFtr1"/>' : ''}<w:footerReference w:type="default" r:id="rIdFtr"/><w:pgSz w:w="${pw}" w:h="${ph}"/><w:pgMar w:top="${mar}" w:right="${mar}" w:bottom="${mar}" w:left="${mar}" w:header="${Math.round(mar / 2)}" w:footer="${Math.round(mar / 2)}" w:gutter="0"/>${titlePg ? '<w:titlePg/>' : ''}</w:sectPr>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body.join('')}${sect}</w:body></w:document>`;
  const pPr = (extra) => `<w:pPr>${extra}</w:pPr>`;
  const style = (id, name, ppr, rpr = '', next = 'Normal', extra = '') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="${next}"/>${extra}<w:qFormat/>${pPr(ppr)}${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}</w:style>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:lang w:val="${esc(m.language || 'en')}"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="${line}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:firstLine="${indent}"/>${msf ? '' : '<w:jc w:val="both"/>'}<w:widowControl/></w:pPr></w:style>
${style('NoInd', 'No Indent', '<w:ind w:firstLine="0"/>')}
${style('Center', 'Centered', '<w:ind w:firstLine="0"/><w:jc w:val="center"/>')}
${style('Title', 'Title', '<w:ind w:firstLine="0"/><w:jc w:val="center"/><w:spacing w:after="240"/>', `<w:sz w:val="${msf ? 24 : size * 2 + 8}"/>${msf ? '' : '<w:b/>'}`)}
${style('Subtitle', 'Subtitle', '<w:ind w:firstLine="0"/><w:jc w:val="center"/><w:spacing w:after="200"/>', msf ? '' : '<w:i/>')}
${style('Author', 'Author', '<w:ind w:firstLine="0"/><w:jc w:val="center"/><w:spacing w:before="1200"/>', `<w:sz w:val="${size + 6}"/>`)}
${style('Heading1', 'heading 1', `<w:keepNext/><w:pageBreakBefore/><w:ind w:firstLine="0"/><w:jc w:val="center"/><w:spacing w:before="${msf ? 2880 : 2400}" w:after="${msf ? 480 : 600}"/><w:outlineLvl w:val="0"/>`, msf ? '' : `<w:sz w:val="${size + 10}"/>`, 'NoInd')}
${style('TOCHeading', 'TOC Heading', '<w:ind w:firstLine="0"/><w:jc w:val="center"/><w:spacing w:before="1200" w:after="480"/>', `<w:sz w:val="${size + 8}"/>`)}
${style('TOC1', 'toc 1', '<w:ind w:firstLine="0"/><w:jc w:val="left"/><w:spacing w:after="80"/>', '', 'TOC1')}
${style('Sub', 'Subheading', '<w:keepNext/><w:ind w:firstLine="0"/><w:jc w:val="center"/><w:spacing w:before="240" w:after="120"/>', '<w:b/>', 'NoInd')}
${style('SceneBreak', 'Scene Break', '<w:keepNext/><w:ind w:firstLine="0"/><w:jc w:val="center"/><w:spacing w:before="120" w:after="120"/>', '', 'NoInd')}
${style('Question', 'Reader Question', '<w:keepNext/><w:ind w:firstLine="0"/><w:jc w:val="left"/><w:spacing w:before="360" w:after="120"/>', '<w:b/>', 'NoInd')}
</w:styles>`;
  const rels = [header ? '<Relationship Id="rIdHdr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' : '', '<Relationship Id="rIdFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>', titlePg ? '<Relationship Id="rIdHdr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/><Relationship Id="rIdFtr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/>' : '',
    coverPart ? `<Relationship Id="rIdCover" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/cover.${coverPart.ext}"/>` : '', '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>', '<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>'].join('');
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${coverPart ? `<Default Extension="${coverPart.ext}" ContentType="image/${coverPart.ext}"/>` : ''}
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
${header ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : ''}<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>${titlePg ? '<Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : ''}
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
    { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>` },
    { name: 'word/document.xml', data: doc }, { name: 'word/styles.xml', data: styles },
    { name: 'word/settings.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${o.toc && !msf ? '<w:updateFields w:val="true"/>' : ''}<w:defaultTabStop w:val="720"/><w:compat/></w:settings>` },
    { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(m.title)}</dc:title><dc:creator>${esc(m.author)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created></cp:coreProperties>` },
  ];
  if (header) files.push({ name: 'word/header1.xml', data: header });
  files.push({ name: 'word/footer1.xml', data: footer });
  if (coverPart) files.push({ name: coverPart.name, data: coverPart.bytes });
  if (titlePg) files.push({ name: 'word/header2.xml', data: firstHeader }, { name: 'word/footer2.xml', data: firstFooter });
  return makeZip(files);
}
