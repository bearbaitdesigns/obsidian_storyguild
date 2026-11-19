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
  if (o.titlePage) {
    if (msf) {
      body.push(wp('NoInd', wrun(m.legalName || m.author)), ...(m.contact ? m.contact.split('\n').map((l) => wp('NoInd', wrun(l))) : []));
      body.push(wp('NoInd', wrun(`About ${fmtN(Math.round(book.words / 1000) * 1000)} words`), '<w:jc w:val="right"/>'));
      body.push(wp('NoInd', '', '<w:spacing w:before="3600"/>'), wp('Title', wrun(m.title.toUpperCase())), m.subtitle ? wp('Subtitle', wrun(m.subtitle)) : '', wp('Subtitle', wrun(`by ${m.author}`)), pageBreak);
    } else {
      body.push(wp('NoInd', '', '<w:spacing w:before="2800"/>'), wp('Title', wrun(m.title)), m.subtitle ? wp('Subtitle', wrun(m.subtitle)) : '', m.seriesLine ? wp('Subtitle', wrun(m.seriesLine)) : '', wp('Author', wrun(m.author)), pageBreak);
    }
  }
  if (o.frontMatter && !msf) {
    const copy = [`Copyright © ${m.copyright || new Date().getFullYear()} ${m.author}`, 'All rights reserved.', m.isbn ? `ISBN ${m.isbn}` : '', m.publisher ? `Published by ${m.publisher}` : '', m.draftLine || ''].filter(Boolean);
    body.push(wp('NoInd', '', '<w:spacing w:before="4000"/>'), ...copy.map((l) => wp('Center', wrun(l))), pageBreak);
    if (book.dedication) body.push(wp('NoInd', '', '<w:spacing w:before="3000"/>'), ...book.dedication.split(/\n+/).map((l) => wp('Center', wrun(l, '<w:i/>'))), pageBreak);
  }
  if (o.toc && !msf) {
    body.push(wp('TOCHeading', wrun('Contents')),
      `<w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-1" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${book.chapters.map((c) => `</w:p><w:p><w:pPr><w:pStyle w:val="NoInd"/></w:pPr>${wrun(c.heading)}`).join('')}<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`, pageBreak);
  }
  const blocks = (bl) => bl.map((b) => b.t === 'break' ? wp('SceneBreak', wrun(o.sceneBreak || '#')) : b.t === 'h' ? wp('Sub', wrun(b.text)) : wp(b.first ? 'NoInd' : '', wruns(b.runs))).join('');
  book.chapters.forEach((c) => body.push(wp('Heading1', wrun(c.heading)), blocks(c.blocks)));
  book.back.forEach((s) => body.push(wp('Heading1', wrun(s.title)), blocks(s.blocks)));
  if (book.questions) {
    const q = book.questions; body.push(wp('Heading1', wrun(q.title)), q.intro ? wp('NoInd', wrun(q.intro, '<w:i/>')) : '');
    q.items.forEach((it, i) => {
      body.push(wp('Question', wrun(`${i + 1}. ${it.text}`)));
      for (let k = 0; k < 4; k++) body.push(wp('AnswerLine', ''));
    });
  }
  if (msf) body.push(wp('Center', wrun('THE END'), '<w:spacing w:before="480"/>'));
  const surname = String(m.author || '').trim().split(/\s+/).pop() || 'Author';
  const header = msf ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/></w:pPr>${wrun(`${surname} / ${(m.shortTitle || m.title).toUpperCase()} / `)}<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:hdr>` : null;
  const footer = !msf ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>` : null;
  const sect = `<w:sectPr>${header ? '<w:headerReference w:type="default" r:id="rIdHdr"/>' : ''}${footer ? '<w:footerReference w:type="default" r:id="rIdFtr"/>' : ''}<w:pgSz w:w="${pw}" w:h="${ph}"/><w:pgMar w:top="${mar}" w:right="${mar}" w:bottom="${mar}" w:left="${mar}" w:header="${Math.round(mar / 2)}" w:footer="${Math.round(mar / 2)}" w:gutter="0"/>${msf && o.titlePage ? '<w:titlePg/>' : ''}</w:sectPr>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body.join('')}${sect}</w:body></w:document>`;
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
${style('Sub', 'Subheading', '<w:keepNext/><w:ind w:firstLine="0"/><w:jc w:val="center"/><w:spacing w:before="240" w:after="120"/>', '<w:b/>', 'NoInd')}
${style('SceneBreak', 'Scene Break', '<w:keepNext/><w:ind w:firstLine="0"/><w:jc w:val="center"/><w:spacing w:before="120" w:after="120"/>', '', 'NoInd')}
${style('Question', 'Reader Question', '<w:keepNext/><w:ind w:firstLine="0"/><w:jc w:val="left"/><w:spacing w:before="360" w:after="120"/>', '<w:b/>', 'NoInd')}
${style('AnswerLine', 'Answer Line', '<w:ind w:firstLine="0"/><w:spacing w:before="200"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="999999"/></w:pBdr>', '', 'AnswerLine')}
</w:styles>`;
  const rels = [header ? '<Relationship Id="rIdHdr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' : '', footer ? '<Relationship Id="rIdFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' : '',
    '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>', '<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>'].join('');
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
${header ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : ''}${footer ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : ''}
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
    { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>` },
    { name: 'word/document.xml', data: doc }, { name: 'word/styles.xml', data: styles },
    { name: 'word/settings.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${o.toc && !msf ? '<w:updateFields w:val="true"/>' : ''}<w:defaultTabStop w:val="720"/><w:compat/></w:settings>` },
    { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(m.title)}</dc:title><dc:creator>${esc(m.author)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created></cp:coreProperties>` },
  ];
  if (header) files.push({ name: 'word/header1.xml', data: header });
  if (footer) files.push({ name: 'word/footer1.xml', data: footer });
  return makeZip(files);
}
