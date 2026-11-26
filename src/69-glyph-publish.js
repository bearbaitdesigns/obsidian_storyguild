/* =====================================================================
   Glyphs in published books
   Text pasted from a glyph set is made of private-use characters
   (U+F0000 + 0x400 per set). Publishing carries the set's font with it:
   PDF embeds it (TrueType, written by glyph number), EPUB packs it with
   a @font-face, Word embeds it the way Word embeds fonts. Glyph code
   blocks (pictures, constellations) become images in the book.
   ===================================================================== */
/** text → [{ t, slot }] runs: slot is the glyph set for private-use characters, null for ordinary text */
function glyphSplit(text) {
  const out = [];
  for (const ch of String(text || '')) {
    const c = ch.codePointAt(0); const slot = c >= 0xf0000 && c <= 0xffffd ? (c - 0xf0000) >> 10 : null;
    const last = out[out.length - 1]; if (last && last.slot === slot) last.t += ch; else out.push({ t: ch, slot });
  }
  return out;
}
/** the fonts of every glyph set a book's text uses */
async function bookGlyphFonts(sections) {
  const a = WWA(); if (!a || !a.fonts || !a.fonts.forPublish) return {};
  const used = new Set(); for (const s of sections) for (const b of s.blocks || []) for (const r of b.runs || []) for (const sg of glyphSplit(r.text)) if (sg.slot != null) used.add(sg.slot);
  if (!used.size) return {};
  try { const all = await a.fonts.forPublish(); const out = {}; for (const k of used) if (all[k]) out[k] = all[k]; return out; } catch (e) { console.error('[Storyguild] glyph fonts', e); return {}; }
}
/** ```glyphs``` blocks in a chapter → pictures */
async function resolveGlyphBlocks(blocks, file) {
  const a = WWA(); const out = [];
  for (const b of blocks) {
    if (b.t !== 'glyphs') { out.push(b); continue; }
    if (!a || !a.blockImage) continue;
    try { const img = await a.blockImage(b.src, file); if (img) out.push({ t: 'img', bytes: img.bytes, w: img.w, h: img.h, alt: img.alt || '', src: b.src }); } catch (e) { console.error('[Storyguild] glyph picture', e); }
  }
  return out;
}
