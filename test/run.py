"""End-to-end test of Storyguild in headless Chrome with a mock Obsidian API.
python3 test/run.py   (after node scripts/build.mjs)"""
import asyncio, base64, io, json, os, sys
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
MOBILE = bool(os.environ.get('MOBILE'))  # Galaxy S22 Ultra: 384×824 CSS px, touch
OUT = os.path.join(HERE, 'out-phone' if MOBILE else 'out'); os.makedirs(OUT, exist_ok=True)

def jpeg_b64():
    from PIL import Image, ImageDraw
    im = Image.new('RGB', (400, 600), (20, 50, 70)); d = ImageDraw.Draw(im); d.rectangle([180, 200, 220, 300], fill=(230, 180, 90))
    b = io.BytesIO(); im.save(b, 'JPEG'); return base64.b64encode(b.getvalue()).decode()

CH1 = """# Low Water

The sea had gone out and forgotten to come back.

Mara stood at the end of the Brineholt pier with her boots in the cracked silt where water should have been, and counted the lanterns along the harbor wall. Eight. There had always been *nine*.

%% note to self: foreshadow the bells %%

* * *

Behind her the town was waking the way it always did -- badly. Shutters complained. "Not today," she said, and pulled her father's **ledger** tighter against her ribs. See [[Tide Court|the Court]].
"""
CH2 = """Teodor Varr did not believe in debts he could not see written down.

He believed in saltglass, in tide tables, and in the weight of a purse at the end of a long night. Anything else was a story told by people who wanted something.

---

The shipment came in at the turn of the tide, wrapped in oilcloth and silence.
"""

SEED = r"""
async ({ jpg }) => {
  const enc = new TextEncoder();
  const wk = { novel: { title: 'The Salt Lantern', series: 'Tidebound, Book 1', genre: ['Fantasy', 'Gaslamp'], audience: 'Adult', logline: 'A lamplighter must relight a drowned city.', synopsis: 'Mara inherits her father’s keys and debts.', goal: 95000, deadline: '2026-12-31', stage: 'Second draft', manualWords: 0, banner: '', milestones: [
      { id: 'm1', name: 'First draft', kind: 'Drafting', status: 'done', due: '2025-11-30', progress: 0, readers: [] },
      { id: 'm2', name: 'Beta readers', kind: 'Beta readers', status: 'active', due: '2026-12-10', start: '2026-10-20', progress: 0, readers: [{ name: 'Maeve O’Connell', status: 2 }, { name: 'Dev Kapoor', status: 1 }] } ] },
    plotweaver: { enabled: true, novel: 'The Salt Lantern' }, todoFile: 'Worldkeeper/To-do.md', history: Object.fromEntries(Array.from({ length: 40 }, (_, i) => { const d = new Date(Date.now() - (40 - i) * 864e5); return [d.toISOString().slice(0, 10), 20 + i * 3 + (i % 5 ? 0 : 6)]; })) };
  const pw = { novels: [{ id: 'n1', title: 'The Salt Lantern', plotlines: [{ id: 'pl1', name: 'Mara’s Vow', color: '#a882ff' }, { id: 'pl2', name: 'The Smugglers', color: '#e0b04f' }], povs: [{ id: 'pv1', name: 'Mara' }, { id: 'pv2', name: 'Teodor' }],
      chapters: [{ id: 'plan', title: 'Planning', kind: 'planning' }, { id: 'c1', title: 'Low Water', kind: 'chapter' }, { id: 'c2', title: 'Saltglass', kind: 'chapter' }, { id: 'c3', title: 'Spring Tide', kind: 'epilogue' }],
      beats: [{ id: 'b1', title: 'Mara finds the ninth lantern dark', plotlineId: 'pl1', chapterId: 'c1', povId: 'pv1' }, { id: 'b2', title: 'Varr calls in the debt', plotlineId: 'pl2', chapterId: 'c2', povId: 'pv2' }, { id: 'b3', title: 'Saltglass changes hands', plotlineId: 'pl2', chapterId: 'c2', povId: 'pv2' }] }],
    activeNovelId: 'n1', settings: { statusField: 'status', wordsField: 'words, wordcount' } };
  await app.vault.adapter.write('.obsidian/plugins/worldkeeper/data.json', JSON.stringify(wk));
  await app.vault.adapter.write('.obsidian/plugins/plot-weaver/data.json', JSON.stringify(pw));
  app.plugins.manifests.worldkeeper = { id: 'worldkeeper', name: 'Worldkeeper', version: '1.0.6' };
  app.plugins.manifests['plot-weaver'] = { id: 'plot-weaver', name: 'Plot Weaver', version: '1.8.0' };
  app.plugins.enabledPlugins.add('worldkeeper'); app.plugins.enabledPlugins.add('plot-weaver');
  await app.vault.create('Story/Characters/Mara Vell.md', '---\ntype: character\nrole: Primary\n---\n```worldkeeper\n```\n');
  await app.vault.create('Worldkeeper/To-do.md', '# To-do\n\n- [ ] Map the harbour 📅 2026-12-01\n');
  await app.vault.create('Readers/jonah-notes.md', '# Notes\n\n- Ch 1: Loved the opening image\n- The ending of Act II felt rushed\n- Ch 2: Who owns the saltglass?\n');
  const bin = Uint8Array.from(atob(jpg), (c) => c.charCodeAt(0)); await app.vault.createBinary('Assets/cover.jpg', bin.buffer);
  window.SGP = new module.exports(app, { id: 'storyguild', name: 'Storyguild', version: '1.0.0', dir: '.obsidian/plugins/storyguild' });
  SGP.load();
  await new Promise((r) => setTimeout(r, 400));
  return { modals: __modals.map((m) => m.contentEl.textContent.slice(0, 200)), views: Object.keys(app.viewRegistry), blocks: Object.keys(app.codeblocks), notices: __notices };
}
"""

async def main():
    errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--allow-file-access-from-files'])
        page = await b.new_page(viewport={'width': 384, 'height': 824}, device_scale_factor=2, is_mobile=True, has_touch=True) if MOBILE else await b.new_page(viewport={'width': 1280, 'height': 1000})
        if MOBILE: await page.add_init_script('window.__MOBILE = true')
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        page.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' else None)
        await page.goto('file://' + os.path.join(HERE, 'harness.html'))
        ev = page.evaluate
        r = await ev(SEED, {'jpg': jpeg_b64()})
        print('1. startup (old plugins on):', json.dumps(r)[:600])
        assert r['modals'] and 'Welcome to Storyguild' in r['modals'][0], 'migration prompt should appear'
        assert 'storyguild-draftsmith' in r['views'] and 'plot-weaver-board' not in r['views'], 'sections must stay paused while old plugins are on'
        await page.screenshot(path=f'{OUT}/01-migration.png')

        r = await ev("""async () => { const m = __modals[0]; [...m.contentEl.querySelectorAll('button')].find(b => b.textContent === 'Import and switch').click();
          await new Promise(r => setTimeout(r, 800));
          return { enabled: [...app.plugins.enabledPlugins], views: Object.keys(app.viewRegistry), blocks: Object.keys(app.codeblocks), mig: SGP.data.migration,
            backups: [...app.vault.adapter.data.keys()].filter(k => k.includes('backups')), oldStill: await app.vault.adapter.exists('.obsidian/plugins/plot-weaver/data.json'),
            projects: SGP.data.manuscript.projects.map(p => ({ title: p.title, pw: p.pwNovelId, rounds: p.rounds.map(r => r.name + ':' + r.sends.map(s => s.status).join('/')), target: p.targetWords, stage: p.stage, genre: p.genre })),
            wkNovelTitle: SGP.sections.world.settings.novel.title, wkGoal: SGP.sections.world.settings.novel.goal, notices: __notices.slice(-2) }; }""")
        print('2. after import:', json.dumps(r, ensure_ascii=False)[:1500])
        assert not r['enabled'], 'old plugins should be turned off'
        assert {'worldkeeper', 'plot-weaver', 'worldkeeper-home'} <= set(r['blocks'])
        assert len(r['backups']) >= 3 and r['oldStill']
        assert r['projects'][0]['pw'] == 'n1' and r['projects'][0]['rounds'] and r['wkGoal'] == 95000

        # Draftsmith: chapters from Plot Weaver, then write
        r = await ev("""async () => { await SGP.openDraftsmith(); await new Promise(r => setTimeout(r, 400));
          const btn = [...document.querySelectorAll('.ds-root button')].find(b => b.textContent.includes('Chapters from Plot Weaver')); btn.click();
          await new Promise(r => setTimeout(r, 900));
          const files = app.vault.getMarkdownFiles().filter(f => f.path.startsWith('Novels/')).map(f => f.path);
          return { files, notices: __notices.slice(-2) }; }""")
        print('3. chapters:', r)
        assert len(r['files']) == 3
        await ev("""async ({a, b}) => { const fs = app.vault.getMarkdownFiles().filter(f => f.path.startsWith('Novels/'));
            const f1 = fs.find(f => f.basename === 'Low Water'), f2 = fs.find(f => f.basename === 'Saltglass');
            const t1 = await app.vault.read(f1); await app.vault.modify(f1, t1 + '\\n' + a); const t2 = await app.vault.read(f2); await app.vault.modify(f2, t2 + '\\n' + b);
            await new Promise(r => setTimeout(r, 2600)); }""", {'a': CH1, 'b': CH2})
        r = await ev("""async () => { const fs = app.vault.getMarkdownFiles().filter(f => f.path.startsWith('Novels/'));
            return fs.map(f => [f.basename, app.metadataCache.getFileCache(f).frontmatter]); }""")
        print('4. chapter props:', json.dumps(r, ensure_ascii=False))
        assert any(x[1].get('words', 0) > 50 for x in r), 'word count property should update'
        # Import existing chapter notes through the dialog
        r = await ev("""async () => {
          await app.vault.create('Manuscript/01 - Prologue.md', 'The harbor remembers.\\n');
          await app.vault.create('Manuscript/02 - Ballast.md', '---\\nstatus: Revising\\npov: Teodor\\n---\\nTeodor counted crates.\\n');
          await app.vault.create('Manuscript/10 - Spring Tide.md', 'The water came back.\\n');
          const v = app.workspace.getLeavesOfType('storyguild-draftsmith')[0].view; v.setTab('manuscript'); await new Promise(r => setTimeout(r, 200));
          [...document.querySelectorAll('.ds-root button')].find(b => b.textContent.includes('Import chapter notes')).click(); await new Promise(r => setTimeout(r, 100));
          const m = __modals[__modals.length - 1]; const sel = m.contentEl.querySelector('select'); sel.value = 'Manuscript'; sel.dispatchEvent(new Event('change'));
          await new Promise(r => setTimeout(r, 50));
          const order = [...m.contentEl.querySelectorAll('.ds-import-row')].map(x => x.textContent.slice(0, 30));
          const boxes = m.contentEl.querySelectorAll('input[type=checkbox]'); const create = [...m.contentEl.querySelectorAll('label.ds-toggle')].find(l => l.textContent.includes('Add a Plot Weaver chapter')).querySelector('input'); create.checked = true; create.dispatchEvent(new Event('change'));
          [...m.contentEl.querySelectorAll('button')].find(b => b.textContent.startsWith('Import 3')).click(); await new Promise(r => setTimeout(r, 900));
          const fs = app.vault.getMarkdownFiles().filter(f => f.path.startsWith('Novels/The Salt Lantern/Chapters/'));
          return { order, files: fs.map(f => [f.basename, app.metadataCache.getFileCache(f).frontmatter]), pwChapters: SGP.sections.plot.data.novels[0].chapters.map(c => c.title), notice: __notices[__notices.length - 1], left: app.vault.getMarkdownFiles().filter(f => f.path.startsWith('Manuscript/')).length };
        }""")
        print('4b. import chapters:', json.dumps(r, ensure_ascii=False))
        assert r['left'] == 0 and len(r['files']) == 6 and 'Prologue' in r['pwChapters']
        ball = [f for f in r['files'] if f[0] == '02 - Ballast'][0][1]
        assert ball['status'] == 'Revising' and ball['pov'] == 'Teodor' and ball['chapter'] == 5
        # Chapter types + reorder by drag: Prologue moves to the top and isn't numbered
        r = await ev("""async () => { const v = app.workspace.getLeavesOfType('storyguild-draftsmith')[0].view; v.render(); await new Promise(r => setTimeout(r, 150));
          const rows = () => [...document.querySelectorAll('.ds-chtable tbody tr')].map(tr => tr.children[1].textContent.replace(/[↑↓]/g, '') + '|' + tr.children[2].textContent);
          const before = rows(); const trs = [...document.querySelectorAll('.ds-chtable tbody tr')];
          const src = trs.find(tr => tr.textContent.includes('01 - Prologue')); const dst = trs[0];
          const dt = new DataTransfer(); src.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt })); dst.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, cancelable: true })); dst.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, cancelable: true }));
          await new Promise(r => setTimeout(r, 800)); v.render(); await new Promise(r => setTimeout(r, 100));
          // change "10 - Spring Tide" to an interlude via its type select
          const tr2 = [...document.querySelectorAll('.ds-chtable tbody tr')].find(tr => tr.textContent.includes('10 - Spring Tide')); const ks = tr2.querySelector('.ds-kind'); ks.value = 'interlude'; ks.dispatchEvent(new Event('change'));
          await new Promise(r => setTimeout(r, 600)); v.render(); await new Promise(r => setTimeout(r, 100));
          const n = SGP.sections.plot.data.novels[0];
          return { before, after: rows(), pw: n.chapters.map(c => c.title + ':' + c.kind) }; }""")
        print('4c. types & order:', json.dumps(r, ensure_ascii=False))
        assert r['after'][0].startswith('P|01 - Prologue') and r['after'][1].startswith('1|Low Water')
        assert r['pw'].index('Prologue:prologue') < r['pw'].index('Low Water:chapter') and 'Spring Tide:interlude' in r['pw']
        # Idea: unlinked, unnumbered, placeable anywhere, convertible back and linkable
        r = await ev("""async () => { const v = app.workspace.getLeavesOfType('storyguild-draftsmith')[0].view; const wait = (ms) => new Promise(r => setTimeout(r, ms));
          const rows = () => [...document.querySelectorAll('.ds-chtable tbody tr')].map(tr => tr.children[1].textContent.replace(/[↑↓]/g, '') + '|' + tr.children[2].textContent);
          const row = (t) => [...document.querySelectorAll('.ds-chtable tbody tr')].find(tr => tr.children[2].textContent === t);
          let ks = row('02 - Ballast').querySelector('.ds-kind'); ks.value = 'idea'; ks.dispatchEvent(new Event('change')); await wait(500); v.render(); await wait(100);
          const fm = () => app.metadataCache.getFileCache(app.vault.getMarkdownFiles().find(f => f.basename === '02 - Ballast')).frontmatter;
          const asIdea = { rows: rows(), fm: Object.assign({}, fm()) };
          // drag the idea to just after the Prologue
          const trs = [...document.querySelectorAll('.ds-chtable tbody tr')]; const dt = new DataTransfer();
          row('02 - Ballast').dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt })); trs[1].dispatchEvent(new DragEvent('drop', { dataTransfer: dt, cancelable: true })); await wait(700); v.render(); await wait(100);
          const moved = rows();
          // convert back to a chapter and put it on the board as a new chapter
          ks = row('02 - Ballast').querySelector('.ds-kind'); ks.value = 'chapter'; ks.dispatchEvent(new Event('change')); await wait(500); v.render(); await wait(100);
          [...row('02 - Ballast').querySelectorAll('a')].find(a => a.textContent === 'link…').click(); await wait(100);
          const m = __modals[__modals.length - 1]; [...m.contentEl.querySelectorAll('button')].find(b => b.textContent === 'Link').click(); await wait(600); v.render(); await wait(100);
          return { asIdea, moved, final: rows(), fm: fm(), pw: SGP.sections.plot.data.novels[0].chapters.map(c => c.title + ':' + c.kind) }; }""")
        print('4d. idea:', json.dumps(r, ensure_ascii=False))
        assert 'plotweaver-chapter' not in r['asIdea']['fm'] and any(x.startswith('💡|02 - Ballast') for x in r['asIdea']['rows'])
        assert r['moved'][1].startswith('💡|02 - Ballast') and r['moved'][2].startswith('1|Low Water')
        assert r['final'][1].startswith('1|02 - Ballast') and r['fm'].get('plotweaver-chapter') and r['pw'].index('Ballast:chapter') < r['pw'].index('Low Water:chapter')
        await page.wait_for_timeout(500)
        await page.screenshot(path=f'{OUT}/02-manuscript.png', full_page=True)

        # Readers: suggested questions → include prompt → answers → attachment import
        r = await ev("""async () => { const v = app.workspace.getLeavesOfType('storyguild-draftsmith')[0].view; v.setTab('readers'); await new Promise(r => setTimeout(r, 200));
          [...document.querySelectorAll('.ds-root button')].find(b => b.textContent.startsWith('Use suggested')).click(); await new Promise(r => setTimeout(r, 200));
          const prompt = __modals.find(m => m.contentEl.textContent.includes('Include these questions in Publish'));
          const had = !!prompt; [...prompt.contentEl.querySelectorAll('button')].find(b => b.textContent.startsWith('Yes')).click(); await new Promise(r => setTimeout(r, 200));
          const p = SGP.data.manuscript.projects[0]; const rd = p.rounds[0];
          // answers for first reader via modal
          [...document.querySelectorAll('.ds-root button')].find(b => b.textContent === 'Answers').click(); await new Promise(r => setTimeout(r, 100));
          const m = __modals[__modals.length - 1]; const ins = m.contentEl.querySelectorAll('textarea, select');
          ins.forEach((i, k) => { if (i.tagName === 'SELECT') i.value = i.options[i.options.length - 2].value; else i.value = 'Answer ' + (k + 1); });
          [...m.contentEl.querySelectorAll('button')].find(b => b.textContent === 'Save answers').click(); await new Promise(r => setTimeout(r, 200));
          // attach a vault file to second reader and import bullets
          rd.sends[1].files.push('Readers/jonah-notes.md'); v.render(); await new Promise(r => setTimeout(r, 100));
          document.querySelector('.ds-file').click(); const it = __lastMenu.items.find(i => i.title.startsWith('Import bullet')); await it.cb(); await new Promise(r => setTimeout(r, 300));
          return { prompt: had, include: rd.includeInCompile, q: rd.questions.map(q => q.type), answers: rd.sends[0].answers, notes: p.comments.map(c => [c.ch, c.text]), wkMs: SGP.sections.world.settings.novel.milestones.map(m => [m.name, m.roundId ? 'synced' : '', (m.readers||[]).length]) }; }""")
        print('5. readers:', json.dumps(r, ensure_ascii=False))
        assert r['prompt'] and r['include'] is True and len(r['answers']) == 5 and len(r['notes']) == 3
        await page.screenshot(path=f'{OUT}/03-readers.png', full_page=True)

        # Book details + checklist + WK todo
        r = await ev("""async () => { const v = app.workspace.getLeavesOfType('storyguild-draftsmith')[0].view; const p = SGP.data.manuscript.projects[0];
          setProjectFieldTest = null; p.cover = 'Assets/cover.jpg'; p.author = 'Rhea Ashdown'; p.dedication = 'For my father.'; p.bio = 'Rhea writes by the sea.'; p.synopsis = 'Full synopsis here.';
          v.setTab('details'); await new Promise(r => setTimeout(r, 200));
          const title = [...document.querySelectorAll('.ds-form input')][0]; title.value = 'The Salt Lantern (rev)'; title.dispatchEvent(new Event('change'));
          await new Promise(r => setTimeout(r, 300));
          const out = { pwTitle: SGP.sections.plot.data.novels[0].title, wkTitle: SGP.sections.world.settings.novel.title };
          v.setTab('checklist'); await new Promise(r => setTimeout(r, 200));
          const it = p.checklists.draft[1].items[1]; it.due = '2026-12-31'; v.render(); await new Promise(r => setTimeout(r, 100));
          const row = [...document.querySelectorAll('.ds-ck')].find(r => r.querySelector('.ds-ghost').value === it.t); row.querySelector('.ds-wk').click(); await new Promise(r => setTimeout(r, 300));
          out.todo = await app.vault.read(app.vault.getAbstractFileByPath('Worldkeeper/To-do.md'));
          const ms = SGP.sections.world.settings.novel.milestones; const m = ms.find(x => x.checklistId === it.id);
          out.milestone = m ? [m.name, m.kind, m.due, m.status] : null;
          // tick it on Worldkeeper Home's side → the checklist step is ticked
          m.status = 'done'; await SGP.sections.world.saveSettings(); await new Promise(r => setTimeout(r, 200)); v.render(); await new Promise(r => setTimeout(r, 100));
          out.tickedBack = it.done;
          out.auto = p.checklists.trad[1].items.map(i => [i.t, itemDoneTest(p, i)]);
          return out; }""".replace('setProjectFieldTest = null;', '').replace('itemDoneTest(p, i)', 'null'))
        print('6. shared title + todo:', json.dumps(r, ensure_ascii=False))
        assert r['pwTitle'] == 'The Salt Lantern (rev)' and r['wkTitle'] == 'The Salt Lantern (rev)'
        assert '#draftsmith' not in r['todo'] and r['milestone'] == ['Draft 1 complete', 'Drafting', '2026-12-31', 'planned'] and r['tickedBack'] is True
        await page.screenshot(path=f'{OUT}/04-checklist.png', full_page=True)
        await ev("""async () => { app.workspace.getLeavesOfType('storyguild-draftsmith')[0].view.setTab('details'); await new Promise(r => setTimeout(r, 200)); }""")
        await page.screenshot(path=f'{OUT}/05-details.png', full_page=True)

        # Books & series across all sections
        r = await ev("""async () => { const A = SGP.api; const b1 = A.activeBook();
          const s = A.createSeries('Tidebound', [b1.id]);
          const b2 = A.createBook({ title: 'The Ninth Bell', seriesId: s.id }); await new Promise(r => setTimeout(r, 300));
          const pw = SGP.sections.plot.data; const n2 = pw.novels.find(n => n.id === b2.pwNovelId);
          const out = { b1: [b1.series, b1.seriesNo], b2: [b2.series, b2.seriesNo], n2links: n2.links, active: A.activeBook().title, pwActive: pw.activeNovelId === n2.id, wkSeries: SGP.sections.world.settings.novel.series, wkTitle: SGP.sections.world.settings.novel.title };
          pw.activeNovelId = 'n1'; SGP.sections.plot.commit(); await new Promise(r => setTimeout(r, 100));
          out.afterPwSwitch = A.activeBook().title;
          SGP.sections.plot.addNovel({ id: 'side', title: 'Side Story', plotlines: [], povs: [], slots: [], chapters: [], beats: [], manuscriptOrder: [], links: [] });
          out.adopted = A.books().map(b => b.title); A.setActiveProject(b1.id);
          SGP.openLibrary = null; A.openLibrary(); await new Promise(r => setTimeout(r, 100)); out.lib = __modals[__modals.length-1].contentEl.textContent.slice(0, 160);
          return out; }""")
        print('6b. books & series:', json.dumps(r, ensure_ascii=False))
        assert r['b2'] == ['Tidebound', '2'] and 'n1' in r['n2links'] and r['active'] == 'The Ninth Bell' and r['pwActive'] and r['wkSeries'] == 'Tidebound · Book 2'
        assert r['afterPwSwitch'] == 'The Salt Lantern (rev)' and 'Side Story' in r['adopted']
        await page.screenshot(path=f'{OUT}/07-library.png')
        await ev("() => { const m = __modals[__modals.length-1]; m.close(); }")

        # Stats tab: imports Worldkeeper history, draws its charts, sits before Publish
        r = await ev("""async () => { const v = app.workspace.getLeavesOfType('storyguild-draftsmith')[0].view; v.setTab('stats'); await new Promise(r => setTimeout(r, 300));
          const tabs = [...document.querySelectorAll('.ds-tabs button')].map(b => b.textContent);
          const cards = [...document.querySelectorAll('.ds-sgrid .ds-sch h3')].map(h => h.textContent);
          const kpis = [...document.querySelectorAll('.ds-stats .ds-stat small')].map(x => x.textContent);
          const p = SGP.data.manuscript.projects[0]; const nHist = Object.keys(p.history).length;
          // table toggle and range switch
          document.querySelector('.ds-stt').click(); await new Promise(r => setTimeout(r, 150)); const table = !!document.querySelector('.ds-stable');
          document.querySelector('.ds-stt').click(); [...document.querySelectorAll('.ds-sfilters .ds-seg button')].find(b => b.textContent === '12 months').click(); await new Promise(r => setTimeout(r, 200));
          return { tabs, cards, kpis, nHist, table, svgs: document.querySelectorAll('.ds-sgrid svg').length }; }""")
        print('6c. stats:', json.dumps(r, ensure_ascii=False))
        assert r['tabs'].index('Stats') == r['tabs'].index('Publish') - 1 and r['nHist'] >= 40 and r['table'] and r['svgs'] >= 6
        await ev("async () => { [...document.querySelectorAll('.ds-sfilters .ds-seg button')].find(b => b.textContent === '30 days').click(); await new Promise(r => setTimeout(r, 200)); }")
        await page.screenshot(path=f'{OUT}/14-stats.png', full_page=True)

        # Publish all formats
        outs = {}
        for fmt, extra in [('pdf', {}), ('docx', {}), ('epub', {}), ('md', {}), ('pdf', {'manuscriptFormat': True}), ('docx', {'manuscriptFormat': True})]:
            r = await ev("""async ({fmt, extra}) => { const p = SGP.data.manuscript.projects[0]; Object.assign(p.compile, { format: fmt, includeQuestions: true, manuscriptFormat: false, toc: true }, extra);
              const v = app.workspace.getLeavesOfType('storyguild-draftsmith')[0].view; v.setTab('compile'); await new Promise(r => setTimeout(r, 200));
              const btn = [...document.querySelectorAll('.ds-root button')].find(b => b.textContent.startsWith('Publish ')); btn.click(); await new Promise(r => setTimeout(r, 700));
              const path = p.lastCompiled[0].path; const f = app.vault.getAbstractFileByPath(path);
              const bytes = app.vault.bin.get(path) || new TextEncoder().encode(app.vault.text.get(path));
              let s = ''; for (const x of bytes) s += String.fromCharCode(x); return { path, b64: btoa(s), notice: __notices[__notices.length - 1] }; }""", {'fmt': fmt, 'extra': extra})
            name = os.path.basename(r['path']).replace(' ', '_')
            open(os.path.join(OUT, name), 'wb').write(base64.b64decode(r['b64'])); outs[name] = r['notice']
        # PNG cover in a PDF, and turning the cover off
        from PIL import Image as _I; _b = io.BytesIO(); _I.new('RGB', (300, 480), (120, 30, 40)).save(_b, 'PNG')
        r = await ev("""async (png) => { const bin = Uint8Array.from(atob(png), (c) => c.charCodeAt(0)); await app.vault.createBinary('Assets/cover.png', bin.buffer);
          const p = SGP.data.manuscript.projects[0]; p.cover = 'Assets/cover.png'; Object.assign(p.compile, { format: 'pdf', manuscriptFormat: false, includeCover: true });
          const v = app.workspace.getLeavesOfType('storyguild-draftsmith')[0].view; v.setTab('compile'); await new Promise(r => setTimeout(r, 200));
          [...document.querySelectorAll('.ds-root button')].find(b => b.textContent.startsWith('Publish ')).click(); await new Promise(r => setTimeout(r, 700));
          const withCover = __notices.slice(-2); p.compile.includeCover = false; v.render(); await new Promise(r => setTimeout(r, 100));
          [...document.querySelectorAll('.ds-root button')].find(b => b.textContent.startsWith('Publish ')).click(); await new Promise(r => setTimeout(r, 700));
          const path = p.lastCompiled[0].path; const bytes = app.vault.bin.get(path); let s = ''; for (const x of bytes) s += String.fromCharCode(x);
          const pngPdf = p.lastCompiled.find(x => true); p.compile.includeCover = true; p.cover = 'Assets/cover.jpg'; return { withCover, noCover: __notices[__notices.length - 1], b64: btoa(s) }; }""", base64.b64encode(_b.getvalue()).decode())
        print('7b. covers:', r['withCover'], '|', r['noCover'])
        assert '13 pages' in r['withCover'][-1] and '12 pages' in r['noCover'] and not any('left out' in n for n in r['withCover'])
        print('7. published:', outs)
        # Maps from Wayfinder (Worldkeeper) in every format
        _m = io.BytesIO(); _im = _I.new('RGB', (900, 560), (182, 200, 204)); from PIL import ImageDraw as _D; _D.Draw(_im).ellipse([200, 120, 700, 460], fill=(233, 220, 190)); _im.save(_m, 'JPEG')
        r = await ev("""async (jpg) => { const bin = Uint8Array.from(atob(jpg), (c) => c.charCodeAt(0)); await app.vault.createBinary('World/Maps/Images/brineholt.jpg', bin.buffer);
          const data = '{"v":1,"scale":{"per":5,"unit":"mi"},"items":[\\n{"id":"p1","k":"pin","icon":"capital","name":"Brineholt","x":500,"y":300},\\n{"id":"l1","k":"line","style":"route","name":"Mara\u2019s walk","pts":[[300,250],[450,320],[600,280]]}\\n]}';
          await app.vault.create('World/Maps/Brineholt.md', '---\\ntype: map\\nmap-image: "[[brineholt.jpg]]"\\n---\\n```worldkeeper-map\\n' + data + '\\n```\\n'); await new Promise(r => setTimeout(r, 300));
          const p = SGP.data.manuscript.projects[0]; const v = app.workspace.getLeavesOfType('storyguild-draftsmith')[0].view;
          Object.assign(p.compile, { format: 'pdf', manuscriptFormat: false, includeQuestions: false, maps: [], mapsPlace: 'front' }); v.setTab('compile'); await new Promise(r => setTimeout(r, 300));
          const card = [...document.querySelectorAll('.ds-card')].find(c => c.textContent.startsWith('Maps')); const cardText = card ? card.textContent.slice(0, 60) : null;
          card.querySelector('.ds-map-opt input').click(); await new Promise(r => setTimeout(r, 300));
          const picked = p.compile.maps.slice(); const previewMap = !!document.querySelector('.ds-pp-map');
          const out = {}; const pub = async (fmt, place) => { Object.assign(p.compile, { format: fmt, mapsPlace: place }); v.render(); await new Promise(r => setTimeout(r, 200));
            [...document.querySelectorAll('.ds-root button')].find(b => b.textContent.startsWith('Publish ')).click(); await new Promise(r => setTimeout(r, 1500));
            const path = p.lastCompiled[0].path; const bytes = app.vault.bin.get(path) || new TextEncoder().encode(app.vault.text.get(path)); let s = ''; for (const x of bytes) s += String.fromCharCode(x); out[fmt + '-' + place] = { path, b64: btoa(s), notice: __notices[__notices.length - 1] }; };
          await pub('pdf', 'front'); await pub('docx', 'front'); await pub('epub', 'back'); await pub('md', 'back');
          p.compile.maps = []; return { cardText, picked, previewMap, out, views: !!app.workspace.getLeavesOfType }; }""", base64.b64encode(_m.getvalue()).decode())
        import zipfile
        mres = {}
        for k, x in r['out'].items():
            fn = os.path.join(OUT, 'maps-' + os.path.basename(x['path']).replace(' ', '_')); open(fn, 'wb').write(base64.b64decode(x['b64'])); mres[k] = (fn, x['notice'])
        pdfb = open(mres['pdf-front'][0], 'rb').read(); docx = zipfile.ZipFile(mres['docx-front'][0]); epub = zipfile.ZipFile(mres['epub-back'][0]); md = open(mres['md-back'][0]).read()
        print('7c. maps:', r['cardText'], r['picked'], 'preview', r['previewMap'], '| pdf /M1:', b'/M1 ' in pdfb, mres['pdf-front'][1], '| docx:', [n for n in docx.namelist() if 'map' in n], '| epub:', [n for n in epub.namelist() if 'map' in n], '| md:', '![[World/Maps/Brineholt]]' in md)
        assert r['picked'] == ['World/Maps/Brineholt.md'] and b'/M1 ' in pdfb and 'word/media/map1.jpeg' in docx.namelist() and 'OEBPS/map1.xhtml' in epub.namelist() and '![[World/Maps/Brineholt]]' in md
        _opf = epub.read('OEBPS/content.opf').decode(); assert _opf.index('idref="ch1"') < _opf.index('idref="map1"'), 'back maps follow the chapters'
        # Wayfinder is part of Storyguild: commands, views, Draftsmith header button, Home pill, Maps tab
        r = await ev("""async () => { const v = app.workspace.getLeavesOfType('storyguild-draftsmith')[0].view; v.setTab('compile'); await new Promise(r => setTimeout(r, 200));
          const hb = [...document.querySelectorAll('.ds-head button')].find(b => b.textContent.startsWith('🧭 Wayfinder')); const headBtn = hb ? hb.textContent : null; app.commands.executeCommandById('worldkeeper:open-wayfinder'); await new Promise(r => setTimeout(r, 900));
          const lib = app.workspace.getLeavesOfType('worldkeeper-maps-library').length; const cards = [...document.querySelectorAll('.wkm-mcard-name')].map(x => x.textContent);
          await HOST_WORLD().openMap(app.vault.getAbstractFileByPath('World/Maps/Brineholt.md')); await new Promise(r => setTimeout(r, 1200));
          const ed = app.workspace.getLeavesOfType('worldkeeper-map-editor').map(l => l.view.d && l.view.d.items.length);
          const cmds = Object.keys(app.commands.commands).filter(k => /map|wayfinder/i.test(k));
          app.commands.executeCommandById('worldkeeper:open-home'); await new Promise(r => setTimeout(r, 900));
          const pill = [...document.querySelectorAll('.hd-side-pills button')].map(b => b.textContent); const under = [...document.querySelectorAll('.hd-sections button')].map(b => b.textContent);
          return { headBtn, lib, cards, ed, cmds, pill, under }; }""".replace('HOST_WORLD()', 'SGP.sections.world'))
        print('7d. wayfinder in storyguild:', json.dumps(r, ensure_ascii=False))
        assert r['headBtn'] is None and r['lib'] and 'Brineholt' in r['cards'] and r['ed'] == [2] and 'worldkeeper:open-wayfinder' in r['cmds'] and all(n in x for n, x in zip(['World Atlas', 'Encyclopedia', 'Wayfinder', 'Wordwright'], r['pill'])) and len(r['pill']) == 4 and 'Plot Weaver' in r['under'][0] and 'Draftsmith' in r['under'][1]
        # Settings → Worldkeeper → Wayfinder → Pins: add a custom pin and change a built-in one
        r = await ev("""async () => { const tab = app.setting.tabs.find(t => t.constructor.name === 'WorldkeeperSettingTab'); tab.tab = 'maps'; tab.display();
          // Obsidian 1.15 can show Settings in its own window: put it in a separate document
          const fr = document.createElement('iframe'); document.body.append(fr); await new Promise(r => setTimeout(r, 100)); fr.contentDocument.body.append(tab.containerEl); window.activeDocument = fr.contentDocument; await new Promise(r => setTimeout(r, 200));
          const W = SGP.sections.world.settings.maps; const add = [...tab.containerEl.querySelectorAll('button')].find(b => b.textContent.includes('Add a custom pin')); add.click(); await new Promise(r => setTimeout(r, 300));
          const name = [...tab.containerEl.querySelectorAll('.wkm-cp.is-open input')].find(i => i.placeholder.startsWith('Name')); name.value = 'Tavern'; name.dispatchEvent(new Event('input')); name.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 200));
          [...tab.containerEl.querySelectorAll('.wkm-cp-row')].find(x => x.textContent.startsWith('Town')).click(); await new Promise(r => setTimeout(r, 200));
          const tn = [...tab.containerEl.querySelectorAll('.wkm-cp.is-open input')].find(i => i.placeholder === 'Town'); tn.value = 'Market town'; tn.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 200));
          const saved = SGP.data.world.maps; const reopened = !!tab.containerEl.querySelector('.wkm-cp.is-open'); tab.containerEl.remove(); fr.remove(); window.activeDocument = document;
          return { custom: W.customPins.map(c => c.label), town: (W.pinOverrides.town || {}).label, saved: !!(saved && saved.customPins && saved.customPins.length), reopened }; }""")
        print('7e. pins settings (own window):', r); assert r['custom'] == ['Tavern'] and r['town'] == 'Market town' and r['saved'] and r['reopened']
        for name, extra in [('10-preview-book', {'format': 'pdf', 'manuscriptFormat': False, 'pageSize': '6x9'}), ('11-preview-msf', {'format': 'docx', 'manuscriptFormat': True}), ('12-preview-epub', {'format': 'epub'})]:
            await ev("""async (extra) => { const p = SGP.data.manuscript.projects[0]; Object.assign(p.compile, { includeQuestions: true, toc: true, titlePage: true, frontMatter: true, draftStamp: true }, extra);
              const v = app.workspace.getLeavesOfType('storyguild-draftsmith')[0].view; v.setTab('compile'); await new Promise(r => setTimeout(r, 400)); }""", extra)
            pv = await page.query_selector('.ds-preview')
            await pv.screenshot(path=f'{OUT}/{name}.png')
        await page.screenshot(path=f'{OUT}/06-publish.png', full_page=True)

        # Worldkeeper home + Plot Weaver board still work
        r = await ev("""async () => { app.commands.executeCommandById('worldkeeper:open-home'); await new Promise(r => setTimeout(r, 900));
          const home = document.querySelector('.wk-home'); const t = home ? home.querySelector('h1').textContent : null;
          const ms = home ? home.textContent.includes('Beta readers') : false;
          app.commands.executeCommandById('plot-weaver:open-board'); await new Promise(r => setTimeout(r, 600));
          await app.vault.create('Story/Gods/Thalassa.md', '---\\ntype: god\\nrank: Greater god\\n---\\n'); await app.vault.create('Story/Demons/Varrow.md', '---\\ntype: fiend\\nrank: Lesser\\n---\\n');
          app.commands.executeCommandById('worldkeeper:open-dashboards'); await new Promise(r => setTimeout(r, 700));
          const nav = [...document.querySelectorAll('.anav')].pop(); const story = nav ? nav.textContent : '';
          window.__homeShot = true; return { story: story.slice(0, 80), homeTitle: t, milestones: ms, board: !!document.querySelector('.workspace-leaf-content [class*=pw]'), cmds: Object.keys(app.commands.commands).length }; }""")
        print('8. other sections:', r)
        await ev("async () => { app.commands.executeCommandById('worldkeeper:open-home'); await new Promise(r => setTimeout(r, 600)); document.querySelector('.wk-home').scrollIntoView(); }")
        el = await page.query_selector('.wk-home .hd-hero')
        await el.screenshot(path=f'{OUT}/08-wk-banner.png')
        assert r['homeTitle'] == 'The Salt Lantern (rev)'
        st = r['story']; assert st.index('Story') < st.index('Characters') < st.index('Gods1') < st.index('Demons1') < st.index('Geography')
        nav = await page.query_selector_all('.anav')
        await nav[-1].screenshot(path=f'{OUT}/09-wk-nav.png')

        # Encyclopedia: Mermaid diagram tools, live preview, canvases
        r = await ev("""async () => { const W = (ms) => new Promise(r => setTimeout(r, ms));
          await app.vault.create('Worldkeeper/Encyclopedia/Lantern Law.md', '---\\ntype: entry\\ncategory: Law & custom\\n---\\n```worldkeeper-entry\\n```\\n\\nEvery lantern is a debt.\\n');
          await app.vault.create('Maps/Harbour.canvas', '{\"nodes\":[],\"edges\":[]}');
          app.commands.executeCommandById('worldkeeper:open-encyclopedia'); await W(700);
          [...document.querySelectorAll('.enc-item')].find(x => x.textContent.includes('Lantern Law')).click(); await W(500);
          [...document.querySelectorAll('.enc-title-row button')].find(b => b.textContent.includes('Edit')).click(); await W(400);
          const tools = [...document.querySelectorAll('.enc-editor .cs-section-actions button')].map(b => b.textContent);
          const ta = document.querySelector('.enc-editor textarea');
          [...document.querySelectorAll('.enc-editor button')].find(b => b.textContent.includes('Diagram')).click();
          const diagrams = __lastMenu.items.map(i => i.title); await __lastMenu.items.find(i => i.title === 'Text: Family tree').cb(); await W(900);
          const hasMermaid = /```mermaid\\nflowchart TD/.test(ta.value); const preview = document.querySelector('.sg-enc-dpreview'); const pv = preview && preview.style.display !== 'none' && preview.textContent.includes('Aldo Vell');
          [...document.querySelectorAll('.enc-editor button')].find(b => b.textContent.includes('Canvas')).click(); const canvasMenu = __lastMenu.items.map(i => i.title);
          const canvases = SGP.sections.world && HOST_canvas();
          return { tools, diagrams: diagrams.length, hasMermaid, pv, canvasMenu, canvases }; }""".replace('HOST_canvas()', "app.vault.getFiles().filter(f => f.extension === 'canvas').map(f => f.path)"))
        r2 = await ev("""async () => { const W = (ms) => new Promise(r => setTimeout(r, ms)); const A = SGP.api;
          const parsed = {};
          const samples = {
            cause: 'flowchart TD\\n  A[The ninth lantern goes dark] --> B[The Guild calls in the debt]\\n  B --> C{Does Mara pay?}\\n  C -- yes --> D[She loses the house]\\n  C -- no --> E[The Tide Court takes the town]\\n',
            rel: 'flowchart LR\\n  Mara((Mara)) -- sister --> Ilse((Ilse))\\n  Mara -- owes a debt to --> Teodor((Teodor))\\n  Ilse -. secretly serves .-> Court[The Tide Court]\\n',
            chain: 'graph TD\\n  subgraph act2["Act II"]\\n  a("Start") -->|then| b[Middle] --> c>Note]\\n  end\\n  class a,b purple\\n',
            timeline: 'timeline\\n  title x\\n  A : b\\n' };
          for (const [k, v] of Object.entries(samples)) { const d = A.diagramFromMermaid(v); parsed[k] = d ? { cards: d.cards.map(c => c.k + ':' + c.t + ':' + c.c), edges: d.edges.map(e => (e.l || '') + (e.dash ? '~' : '')), groups: d.groups.map(g => g.t + ':' + g.ids.length), layout: d.layout } : null; }
          // draw → save → read back the same drawing
          let saved = null; A.editDiagram(null, (b) => { saved = b; }); await W(200);
          const m = __modals[__modals.length - 1]; const cv = m.canvas; cv.addCard(); document.activeElement.textContent = 'Then this'; document.activeElement.blur(); cv.P.edges.push({ id: 'q', a: cv.P.cards[0].id, b: cv.P.cards[1].id, l: 'so' });
          [...m.contentEl.querySelectorAll('button')].find(b => b.textContent === 'Save diagram').click(); await W(50);
          const back = A.diagramFromMermaid(saved.replace(/^```mermaid\\n|```$/g, ''));
          return { parsed, saved: saved.split('\\n').slice(0, 5), back: back && back.cards.map(c => c.t), backEdges: back && back.edges.map(e => e.l) }; }""")
        print('10b. diagrams:', json.dumps(r2, ensure_ascii=False))
        pz = r2['parsed']
        assert pz['cause']['cards'][2].startswith('choice:Does Mara pay?') and pz['cause']['edges'] == ['', '', 'yes', 'no']
        assert pz['rel']['cards'][0] == 'idea:Mara:grey' and 'secretly serves~' in pz['rel']['edges'] and pz['rel']['layout'] == 'LR'
        assert pz['chain']['groups'] == ['Act II:3'] and pz['chain']['cards'][0] == 'event:Start:purple' and pz['chain']['cards'][2].startswith('note:Note') and pz['timeline'] is None
        assert r2['back'] == ['Start here', 'Then this'] and r2['backEdges'] == ['so']
        print('10. encyclopedia extras:', json.dumps(r, ensure_ascii=False))
        assert 'Diagram' in ' '.join(r['tools']) and 'Canvas' in ' '.join(r['tools']) and r['diagrams'] >= 8 and r['hasMermaid'] and r['pv']
        assert any('Show a canvas' in x for x in r['canvasMenu']) and 'Maps/Harbour.canvas' in r['canvases']

        # Plot Weaver · Draft plot: a scratch canvas not linked to anything
        r = await ev("""async () => { const W = (ms) => new Promise(r => setTimeout(r, ms));
          app.commands.executeCommandById('plot-weaver:open-board'); await W(500);
          const beatsBefore = SGP.sections.plot.data.novels.reduce((a, n) => a + n.beats.length, 0);
          [...document.querySelectorAll('.pw-toolbar button')].find(b => b.textContent.includes('Draft plot')).click(); await W(400);
          const dp = app.workspace.getLeavesOfType('plot-weaver-board')[0].view._dp; const st = dp.stage;
          const out = { mode: SGP.sections.plot.data.ui ? SGP.sections.plot.data.ui.mode : app.workspace.getLeavesOfType('plot-weaver-board')[0].view.ui.mode, cards0: dp.P.cards.length };
          dp.addCard(); await W(50); document.activeElement.textContent = 'Second card'; document.activeElement.blur(); await W(50);
          const [a, b] = dp.P.cards; dp.P.edges.push({ id: 'x1', a: a.id, b: b.id }); dp.draw();
          dp.edgeWords(dp.P.edges[0]); const inl = st.querySelector('.sg-dp-inl'); inl.value = 'because'; inl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); await W(50);
          dp.sel = { type: 'card', id: a.id }; dp.addGroup(); await W(50); const g = dp.P.groups[0];
          dp.cardEl(b.id).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 })); await W(50);
          const picked = g.ids.slice(); st.querySelector('.sg-dp-banner button').click(); await W(50);
          dp.renameGroup(g); const gi = st.querySelector('.sg-dp-inl'); gi.value = 'Act I'; gi.blur(); await W(50);
          dp.setLayout('TD'); await W(700);
          const mm = dp.mermaid();
          await SGP.saveNow(); const saved = JSON.parse(app.vault.adapter.data.get('.obsidian/plugins/storyguild/data.json')).draftPlots;
          const beatsAfter = SGP.sections.plot.data.novels.reduce((a, n) => a + n.beats.length, 0);
          Object.assign(out, { cards: dp.P.cards.map(c => c.t), label: dp.P.edges[0].l, picked, group: g.t, layout: dp.P.layout, mm: mm.split('\\n').slice(0, 6), savedPlots: Object.values(saved)[0].plots.length, beatsSame: beatsBefore === beatsAfter, svgEdges: st.querySelectorAll('.sg-dp-line').length });
          return out; }""")
        print('11. draft plot:', json.dumps(r, ensure_ascii=False))
        assert r['cards'] == ['Start here', 'Second card'] and r['label'] == 'because' and len(r['picked']) == 2 and r['group'] == 'Act I' and r['layout'] == 'TD'
        assert any('subgraph' in x and 'Act I' in x for x in r['mm']) and any('|"because"|' in x for x in r['mm']) and r['savedPlots'] == 1 and r['beatsSame'] and r['svgEdges'] == 1
        await page.screenshot(path=f'{OUT}/15-draft-plot.png')

        # ---- Wordwright: conlangs as their own notes ----
        W_ = "new Promise(r => setTimeout(r, %d))"
        RENDER = """async ([lang, path]) => { document.querySelectorAll('.ww-test').forEach(e => e.remove()); const box = document.createElement('div'); box.className = 'ww-test'; document.body.append(box);
          await app.codeblocks[lang]('', box, { sourcePath: path, addChild(c) { c.load(); }, getSectionInfo() { return null; } }); await new Promise(r => setTimeout(r, 400)); return true; }"""
        # 12. a Language note: its Conlang tab offers Wordwright; creating one links both ways and opens the helper
        await ev("async () => { await app.vault.create('Story/Languages/Old Tide.md', '---\\ntype: language\\nstatus: Living\\n---\\n```worldkeeper\\n```\\n'); await new Promise(r => setTimeout(r, 300)); }")
        await ev(RENDER, ['worldkeeper', 'Story/Languages/Old Tide.md'])
        r = await ev("""async () => { const box = document.querySelector('.ww-test'); [...box.querySelectorAll('.cs-tab')].find(t => t.textContent.includes('Conlang')).click(); await new Promise(r => setTimeout(r, 300));
          const offer = box.textContent.includes('Give Old Tide a constructed language'); [...box.querySelectorAll('button')].find(b => b.textContent.includes('Create a conlang')).click(); await new Promise(r => setTimeout(r, 1200));
          const helper = !!document.querySelector('.lh'); const btn = (t) => [...document.querySelectorAll('.lh-foot button')].find(b => b.textContent.includes(t));
          [...document.querySelectorAll('.lh-start')].find(b => b.textContent.includes('Build from scratch')).click(); await new Promise(r => setTimeout(r, 50)); btn('Next').click(); await new Promise(r => setTimeout(r, 50));
          [...document.querySelectorAll('.lh-feel')].find(b => b.textContent.includes('Harsh')).click(); await new Promise(r => setTimeout(r, 50));
          const fin = document.querySelector('.lh-flair-in'); fin.value = 'dark whisky blorpish'; fin.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 60));
          window.__flair = { on: [...document.querySelectorAll('.lh-flair.is-on')].map(b => b.textContent), sum: (document.querySelector('.lh-flair-sum') || {}).textContent, note: [...document.querySelectorAll('.lh-card .cs-hint')].map(x => x.textContent).find(t => t.includes('No flair')) };
          btn('Next').click(); await new Promise(r => setTimeout(r, 50));
          [...document.querySelectorAll('.lh-opt')].find(b => b.querySelector('b').textContent === 'Masculine / feminine').click(); await new Promise(r => setTimeout(r, 50));
          btn('Next').click(); await new Promise(r => setTimeout(r, 80));
          const preview = (document.querySelector('.lh-card h4:last-of-type') || {}).textContent; const more = !!document.querySelector('.lh-group-more input:checked');
          for (let i = 0; i < 2; i++) { btn('Next').click(); await new Promise(r => setTimeout(r, 50)); } btn('Add to my language').click(); await new Promise(r => setTimeout(r, 800));
          const c = app.vault.getMarkdownFiles().find(f => (app.metadataCache.getFileCache(f)?.frontmatter || {}).type === 'conlang'); const cf = app.metadataCache.getFileCache(c).frontmatter;
          const lf = app.metadataCache.getFileCache(app.vault.getAbstractFileByPath('Story/Languages/Old Tide.md')).frontmatter;
          const kq = (cf.lexicon || []).filter(e => ['father', 'mother'].includes(e.meaning)).map(e => [e.meaning, e.word, e.gender, e.root]);
          return { kq, classes: (cf.genders || {}).classes, gram: (cf.grammar || {}).gender, flair: window.__flair, phFlair: cf.phonology.flair, finals: cf.phonology.finals, offer, helper, more, preview, path: c.path, langLink: cf.language, back: lf.conlang, words: (cf.lexicon || []).length, order: [cf.wordOrder, lf.wordOrder], legacy: 'lexicon' in lf || 'phonology' in lf }; }""")
        print('12. wordwright create:', json.dumps(r, ensure_ascii=False))
        CONLANG = r['path']
        assert len(r['classes']) == 2 and r['gram'] == 'Masculine / feminine' and len(r['kq']) == 2 and r['kq'][0][3] and r['kq'][0][3] == r['kq'][1][3] and {x[2] for x in r['kq']} == {'m', 'f'}, r['kq']
        assert len(r['flair']['on']) == 2 and 'Dark' in r['phFlair'] and 'Whisky' in r['phFlair'] and 'goth' in r['finals'] and 'blorpish' in (r['flair']['note'] or '')
        assert r['offer'] and r['helper'] and r['more'] and r['langLink'] == '[[Old Tide]]' and r['back'] == '[[Old Tide (conlang)]]' and r['words'] >= 190 and r['order'] == ['SOV', 'SOV'] and not r['legacy'], r
        # 12b. the helper can start from words you already have: it works out the rules, asks about the rest, then makes the words
        await ev("async () => { await app.vault.create('World/Conlangs/Sindral (conlang).md', '---\\ntype: conlang\\nlexicon: []\\n---\\n```wordwright\\n```\\n'); await new Promise(r => setTimeout(r, 300)); }")
        await ev(RENDER, ['wordwright', 'World/Conlangs/Sindral (conlang).md'])
        r = await ev("""async () => { const W = (ms) => new Promise(r => setTimeout(r, ms)); const box = document.querySelector('.ww-test');
          [...box.querySelectorAll('.ww-hero button')].find(b => b.textContent.includes('Language helper')).click(); await W(200);
          const btn = (t) => [...document.querySelectorAll('.lh-foot button')].find(b => b.textContent.includes(t));
          [...document.querySelectorAll('.lh-start')].find(b => b.textContent.includes('existing language')).click(); await W(50); btn('Next').click(); await W(80);
          const ta = document.querySelector('.lh-mine'); ta.value = "tal = star\\ntalen = stars\\nmira = to remember\\nmiraso = remembered\\nlusa = sea\\nlusaen = seas\\nnai mira = not remember\\nka'el = oath\\nvenna = moon\\noris = fire\\nalun = river\\nselith = night\\nmora = mother\\ntirel = tree\\nsona = walk\\nsonaso = walked\\nnot a pair line";
          ta.dispatchEvent(new Event('input')); await W(80); const readTxt = document.querySelector('.lh-mine-preview').textContent; btn('Next').click(); await W(100);
          const found = Object.fromEntries([...document.querySelectorAll('.lh-found-row')].map(r => [r.querySelector('b').textContent, r.querySelector('span').textContent]));
          const blocked = btn('Next').disabled; const qs = [...document.querySelectorAll('.lh-card h4')].map(h => h.textContent);
          [...document.querySelectorAll('.lh-opt')].find(b => b.querySelector('b').textContent === 'VSO').click(); await W(50);
          [...document.querySelectorAll('.lh-opt')].find(b => b.querySelector('b').textContent === 'The first').click(); await W(50);
          btn('Next').click(); await W(80); const feel = (document.querySelector('.lh-feel.is-on') || {}).textContent;
          btn('Next').click(); await W(120); const preview = [...document.querySelectorAll('.lh-card h4')].map(h => h.textContent).find(t => t.startsWith('Preview'));
          btn('Next').click(); await W(80); const kept = [...document.querySelectorAll('.lh-affrow.is-found')].map(r => r.querySelector('.lh-affm').firstChild.textContent);
          btn('Next').click(); await W(80); btn('Add to my language').click(); await W(800);
          const fm = app.metadataCache.getFileCache(app.vault.getAbstractFileByPath('World/Conlangs/Sindral (conlang).md')).frontmatter;
          return { readTxt, found, blocked, qs, feel, preview, kept, order: fm.wordOrder, morph: fm.morphology, stress: fm.phonology.stress, cons: fm.phonology.consonants, words: fm.lexicon.length, mine: fm.lexicon.filter(e => ['tal', 'miraso', "ka'el"].includes(e.word)).map(e => e.word + ':' + e.pos + ':' + e.meaning), affixes: fm.affixes.map(a => a.affix + ' ' + a.meaning), nai: fm.lexicon.filter(e => e.word === 'nai').map(e => e.meaning) }; }""")
        print('12b. helper from words:', json.dumps(r, ensure_ascii=False))
        assert '16 words read' in r['readTxt'] and '1 line not understood' in r['readTxt'] and 'stars' in r['found']['Endings'] and '-en' in r['found']['Endings'] and '-so' in r['found']['Endings'] and 'nai' in r['found']['Endings']
        assert r['blocked'] and any('order' in q for q in r['qs']) and 'From your words' in r['feel'] and set(r['kept']) >= {'plural', 'past tense', 'negation (not)'}
        assert r['order'] == 'VSO' and r['morph'] == 'Agglutinative' and r['stress'] == 'first' and r['words'] >= 190 and "tal:noun:star" in r['mine'] and 'miraso:verb:remembered' in r['mine'] and "ka'el:noun:oath" in r['mine']
        assert '-en plural' in r['affixes'] and '-so past tense' in r['affixes'] and r['nai'] == ['negation (not) marker'], (r['affixes'], r['nai'])
        # 13. the conlang note: grouped lexicon, grammar features, numbers, phrasebook, names, export, links
        await ev(RENDER, ['wordwright', CONLANG])
        r = await ev("""async () => { const box = document.querySelector('.ww-test'); const tab = async (t) => { [...box.querySelectorAll('.ww-subnav button')].find(b => b.textContent.includes(t)).click(); await new Promise(r => setTimeout(r, 400)); };
          const out = { title: box.querySelector('.ww-title').textContent, lang: box.querySelector('.ww-hero-sub').textContent, tabs: [...box.querySelectorAll('.ww-subnav button')].map(b => b.textContent.replace(/^\\W+/, '')) };
          await tab('Lexicon'); out.groups = [...box.querySelectorAll('.cl-lexgroup .cs-group-title')].map(g => g.firstChild.textContent);
          const before = box.querySelectorAll('.cl-lexgroup tbody tr').length; [...box.querySelectorAll('.cl-tools button')].find(b => b.textContent.includes('Add 100')).click(); await new Promise(r => setTimeout(r, 900));
          out.added = box.querySelectorAll('.cl-lexgroup tbody tr').length - before; out.addNotice = __notices.slice(-1)[0];
          await tab('Grammar'); out.features = box.querySelectorAll('.ww-feat').length; out.pron = box.querySelectorAll('.ww-ptable tbody tr').length;
          const sel = box.querySelector('.ww-feat select'); sel.value = sel.options[2].value; sel.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 500));
          await tab('Numbers'); const coin = [...box.querySelectorAll('button')].find(b => /number word/.test(b.textContent)); if (coin) { coin.click(); await new Promise(r => setTimeout(r, 600)); } out.numex = [...box.querySelectorAll('.ww-numex')].map(x => x.textContent);
          await tab('Phrasebook'); [...box.querySelectorAll('button')].find(b => b.textContent.includes('Start a phrasebook')).click(); await new Promise(r => setTimeout(r, 600)); out.phrases = box.querySelectorAll('.ww-phrases tbody tr').length;
          await tab('Names'); out.names = box.querySelectorAll('.cl-gen button').length; box.querySelector('.cl-gen button').click(); await new Promise(r => setTimeout(r, 600));
          await tab('Links'); out.linksCard = box.textContent.includes('Spoken as');
          return out; }""")
        print('13. conlang note:', json.dumps(r, ensure_ascii=False))
        cf = await ev("(p) => app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(p)).frontmatter", CONLANG)
        assert r['title'] == 'Old Tide' and 'Old Tide' in r['lang'] and len(r['tabs']) == 11 and r['groups'][:2] == ['Nouns', 'Verbs'] and (r['added'] > 0 or 'Every starter meaning' in r['addNotice']) and r['features'] == 10 and r['pron'] == 5
        assert all('-' in x or '=' in x for x in r['numex']) and r['phrases'] == 16 and r['names'] > 0 and r['linksCard'] and cf['grammar']['gender'] and len(cf['phrases']) == 16 and len(cf['names']) == 1, cf.get('grammar')
        # 14. the Language note's tab: summary and a quick translate (coining on request)
        await ev(RENDER, ['worldkeeper', 'Story/Languages/Old Tide.md'])
        r = await ev("""async () => { const box = document.querySelector('.ww-test'); [...box.querySelectorAll('.cs-tab')].find(t => t.textContent.includes('Conlang')).click(); await new Promise(r => setTimeout(r, 300));
          const card = box.querySelector('.ww-lang-name').textContent; const ta = box.querySelector('.ww-quick-in'); ta.value = 'the sun and the moon remember Ilsa'; ta.dispatchEvent(new Event('input'));
          [...box.querySelectorAll('.ww-quick button')].find(b => b.textContent === 'Translate').click(); await new Promise(r => setTimeout(r, 300));
          const first = box.querySelector('.ww-quick-text').textContent; const toks = [...box.querySelectorAll('.ww-quick .cl-tok small')].map(x => x.textContent);
          ta.value = 'the zorblat sings'; ta.dispatchEvent(new Event('input')); box.querySelector('.ww-quick input[type=checkbox]').click(); window.__memA = JSON.stringify(SGP.sections.world.mem('Story/Languages/Old Tide.md', 'quick-tr', {})); window.__nq = box.querySelectorAll('.ww-quick').length; [...box.querySelectorAll('.ww-quick button')].find(b => b.textContent === 'Translate').click(); await new Promise(r => setTimeout(r, 900));
          return { card, first, toks, coinedNotice: __notices.slice(-1)[0], after: (box.querySelector('.ww-quick-text') || {}).textContent, checked: box.querySelector('.ww-quick input[type=checkbox]').checked, errs: __errors.slice(-2), memA: window.__memA, nq: window.__nq }; }""")
        print('14. language tab:', json.dumps(r, ensure_ascii=False))
        assert r['card'] == 'Old Tide (conlang)' and 'Ilsa' in r['first'] and 'name' in r['toks'] and any(t.startswith('sun') for t in r['toks']) and 'new word' in r['coinedNotice'] and 'zorblat' in r['coinedNotice']
        # 15. Draftsmith: translate a selection; missing words are coined with a notice
        r = await ev("""async (p) => { const c = app.vault.getAbstractFileByPath(p); const ed = { sel: 'The sea remembers the glimmerfang.', getSelection() { return this.sel; }, replaceSelection(t) { this.out = t; } };
          const res = await SGP.api.translateSelection(ed, c); return { out: ed.out, coined: res.coined.map(e => e.meaning), notice: __notices.slice(-1)[0], menu: typeof SGP.api.conlangs === 'function' && SGP.api.conlangs().length }; }""", CONLANG)
        print('15. draftsmith translate:', json.dumps(r, ensure_ascii=False))
        assert r['out'] and r['out'].endswith('.') and r['out'][0].isupper() and 'glimmerfang' in r['coined'] and 'glimmerfang' in r['notice'] and r['menu'] == 2
        # 15b. translations follow the language's word order (Draftsmith too)
        r = await ev("""async () => { const path = 'World/Conlangs/Order Test (conlang).md'; await app.vault.create(path, '---\\ntype: conlang\\n---\\n```wordwright\\n```\\n'); await new Promise(r => setTimeout(r, 200));
          const f = app.vault.getAbstractFileByPath(path); const set = async (o) => { await app.fileManager.processFrontMatter(f, (fm) => { Object.assign(fm, o); }); await new Promise(r => setTimeout(r, 150)); };
          await set({ phonology: { consonants: 't k r', vowels: 'a o' }, lexicon: [{ word: 'vul', pos: 'noun', meaning: 'fox' }, { word: 'esa', pos: 'verb', meaning: 'eat' }, { word: 'brak', pos: 'noun', meaning: 'bread' }, { word: 'mi', pos: 'pron', meaning: 'I' }, { word: 'nu', pos: 'particle', meaning: 'not' }, { word: 'ira', pos: 'verb', meaning: 'go' }, { word: 'ad', pos: 'prep', meaning: 'to' }, { word: 'sel', pos: 'noun', meaning: 'sea' }, { word: 'ruda', pos: 'adj', meaning: 'red' }, { word: 'hus', pos: 'noun', meaning: 'house' }, { word: 'sor', pos: 'verb', meaning: 'see' }] });
          const tr = async (t) => { const ed = { sel: t, getSelection() { return this.sel; }, replaceSelection(x) { this.out = x; } }; await SGP.api.translateSelection(ed, f); return ed.out; };
          const out = {};
          for (const o of ['SVO', 'SOV', 'VSO', 'VOS', 'OVS', 'OSV', 'Free']) { await set({ wordOrder: o }); out[o] = await tr('The fox eats the bread.'); }
          await set({ wordOrder: 'SOV' }); out.sovPlace = await tr('I not go to the sea.');
          await set({ wordOrder: 'SVO', grammar: { adjPos: 'After the noun (house red)' } }); out.adj = await tr('I see the red house, the fox eats bread.');
          const ed2 = { sel: 'The fox eats the bread.', getSelection() { return this.sel; }, replaceSelection(x) { this.out = x; } }; await set({ wordOrder: 'OSV' }); const r2 = await SGP.api.translateSelection(ed2, f, 'copy'); out.copyKept = ed2.out === undefined; out.copyNotice = __notices.slice(-1)[0];
          return out; }""")
        print('15b. word order:', json.dumps(r, ensure_ascii=False))
        assert r['SVO'] == 'Vul esa brak.' and r['SOV'] == 'Vul brak esa.' and r['VSO'] == 'Esa vul brak.' and r['VOS'] == 'Esa brak vul.' and r['OVS'] == 'Brak esa vul.' and r['OSV'] == 'Brak vul esa.' and r['Free'] == 'Vul esa brak.'
        assert r['sovPlace'] == 'Mi ad sel nu ira.' and r['adj'] == 'Mi sor hus ruda, vul esa brak.' and r['copyKept'] and 'OSV word order' in r['copyNotice'] and 'Brak vul esa.' in r['copyNotice'] and '..' not in r['copyNotice'], r
        # 15c. noun classes (gender) and root words
        r = await ev("""async () => { const W = (ms) => new Promise(r => setTimeout(r, ms)); const path = 'World/Conlangs/Order Test (conlang).md'; const f = app.vault.getAbstractFileByPath(path);
          const set = async (fn) => { await app.fileManager.processFrontMatter(f, fn); await W(150); };
          await set((fm) => { fm.wordOrder = 'SVO'; fm.lexicon.push({ word: 'brakar', pos: 'noun', meaning: 'baker' }, { word: 'kral', pos: 'noun', meaning: 'king' }); });
          document.querySelectorAll('.ww-test').forEach(e => e.remove()); const box = document.createElement('div'); box.className = 'ww-test'; document.body.append(box);
          await app.codeblocks['wordwright']('', box, { sourcePath: path, addChild(c) { c.load(); }, getSectionInfo() { return null; } }); await W(300);
          const tab = async (t) => { [...box.querySelectorAll('.ww-subnav button')].find(b => b.textContent.includes(t)).click(); await W(350); };
          await tab('Grammar'); [...box.querySelectorAll('.ww-classes button')].find(b => b.textContent === 'Masculine / feminine').click(); await W(500);
          const made = (app.metadataCache.getFileCache(f).frontmatter.genders || {}).classes;
          [...box.querySelectorAll('.ww-classes button')].find(b => /Give \\d+ nouns? a class/.test(b.textContent)).click(); await W(500);
          let fm = app.metadataCache.getFileCache(f).frontmatter; const king = fm.lexicon.find(e => e.meaning === 'king').gender;
          await set((x) => { x.genders.classes = [{ name: 'Masculine', short: 'm', marker: 'o', type: 'suffix' }, { name: 'Feminine', short: 'f', marker: 'el', type: 'suffix' }]; x.lexicon.find(e => e.meaning === 'house').gender = 'f'; });
          const tr = async (t) => { const ed = { sel: t, getSelection() { return this.sel; }, replaceSelection(x) { this.out = x; } }; await SGP.api.translateSelection(ed, f); return ed.out; };
          const agree = await tr('I see the red house.');
          const coin = await tr('The queen sees the prince and the princess.'); fm = app.metadataCache.getFileCache(f).frontmatter;
          const pp = fm.lexicon.filter(e => ['prince', 'princess'].includes(e.meaning)).map(e => [e.meaning, e.word, e.gender, e.root]);
          await tab('Lexicon'); const lexCols = [...box.querySelectorAll('.cl-lexgroup thead th')].slice(0, 7).map(t => t.textContent);
          await W(700); await tab('Roots'); await W(700); const famsBefore = box.querySelectorAll('.ww-fam').length;
          const q = (sel, i = 0) => box.querySelectorAll(sel)[i];
          q('.ww-derive input').value = 'sel'; q('.ww-derive input').dispatchEvent(new Event('input')); await W(30);
          q('.ww-derive select').value = 'cmp'; q('.ww-derive select').dispatchEvent(new Event('change')); await W(30);
          q('.ww-derive input', 1).value = 'hus'; q('.ww-derive input', 1).dispatchEvent(new Event('input')); await W(50); const meaning = q('.ww-derive input', 2).value; const howNow = q('.ww-derive select').value;
          [...box.querySelectorAll('button')].find(b => b.textContent.includes('Add to lexicon')).click(); await W(900);
          [...box.querySelectorAll('button')].find(b => b.textContent.includes('Find word families')).click(); await W(100);
          const m = [...document.querySelectorAll('.wk-modal-bg')].pop(); const sug = m ? m.textContent : ''; const ok = m && [...m.querySelectorAll('button')].find(b => b.textContent === 'Link them'); if (ok) ok.click(); await W(500);
          fm = app.metadataCache.getFileCache(f).frontmatter; const roots = Object.fromEntries(fm.lexicon.filter(e => e.root).map(e => [e.word, e.root]));
          await tab('Roots'); const fams = [...box.querySelectorAll('.ww-fam-h b')].map(b => b.textContent);
          return { made, king, agree, coin, pp, lexCols, famsBefore, meaning, howNow, sug: sug.slice(0, 120), roots, fams }; }""")
        print('15c. classes & roots:', json.dumps(r, ensure_ascii=False))
        assert len(r['made']) == 2 and r['king'] == 'm' and r['agree'] == 'Mi sor hus rudel.' and 'Class' in r['lexCols'] and 'Root' in r['lexCols']
        assert len(r['pp']) == 2 and r['pp'][0][3] == r['pp'][1][3] and {x[2] for x in r['pp']} == {'m', 'f'} and any(x[1].endswith('el') for x in r['pp']) and any(x[1].endswith('o') for x in r['pp'])
        assert r['meaning'] == 'sea house' and r['roots'].get('selhus') == 'sel' and r['roots'].get('brakar') == 'brak' and 'brak' in r['fams'] and 'sel' in r['fams']
        # 15d. several conlang words for one English word (synonyms, a preferred one) and several English words for one conlang word
        r = await ev("""async () => { const W = (ms) => new Promise(r => setTimeout(r, ms)); const path = 'World/Conlangs/Order Test (conlang).md'; const f = app.vault.getAbstractFileByPath(path);
          await app.fileManager.processFrontMatter(f, (fm) => { fm.wordOrder = 'SVO'; fm.lexicon.push({ word: 'mor', pos: 'noun', meaning: 'sea, ocean' }, { word: 'tavel', pos: 'particle', meaning: 'thank you' }, { word: 'nai sor', pos: 'verb', meaning: 'ignore, overlook' }); }); await W(200);
          const tr = async (t) => { const ed = { sel: t, getSelection() { return this.sel; }, replaceSelection(x) { this.out = x; } }; await SGP.api.translateSelection(ed, f); return ed.out; };
          const out = { a: await tr('I ignore the sea.'), b: await tr('Thank you, I overlook the ocean.') };
          document.querySelectorAll('.ww-test').forEach(e => e.remove()); const box = document.createElement('div'); box.className = 'ww-test'; document.body.append(box);
          await app.codeblocks['wordwright']('', box, { sourcePath: path, addChild(c) { c.load(); }, getSectionInfo() { return null; } }); await W(400);
          const tab = async (t) => { [...box.querySelectorAll('.ww-subnav button')].find(b => b.textContent.includes(t)).click(); await W(400); };
          await tab('Translator'); const ta = box.querySelector('.cl-in'); ta.value = 'I see the sea'; ta.dispatchEvent(new Event('input')); [...box.querySelectorAll('.cl-actions button')].find(b => b.textContent === 'Translate').click(); await W(300);
          out.before = box.querySelector('.ww-out-text').textContent; box.querySelector('.ww-alt').click(); await W(300); out.after = box.querySelector('.ww-out-text').textContent;
          await tab('Lexicon'); const row = [...box.querySelectorAll('.cl-lexgroup tbody tr')].find(tr => tr.querySelector('input.w').value === 'mor'); out.syn = row.querySelector('.ww-syn').textContent; row.querySelector('.ww-pref').click(); await W(600);
          out.pref = await tr('I see the sea.'); return out; }""")
        print('15d. synonyms:', json.dumps(r, ensure_ascii=False))
        assert r['a'] == 'Mi nai sor sel.' and r['b'] == 'Tavel, mi nai sor mor.' and r['before'] == 'Mi sor sel' and r['after'] == 'Mi sor mor' and r['syn'] == '= sel' and r['pref'] == 'Mi sor mor.', r
        # 16. language guide: Word and PDF from the conlang, and as an appendix in a published book
        r = await ev("""async (p) => { const c = app.vault.getAbstractFileByPath(p); const a = await SGP.api.exportGuide(c, 'pdf'); const b = await SGP.api.exportGuide(c, 'docx');
          const bk = SGP.data.manuscript.projects[0]; Object.assign(bk.compile, { langGuides: [p], format: 'md', manuscriptFormat: false });
          const v = app.workspace.getLeavesOfType('storyguild-draftsmith')[0].view; v.setTab('compile'); await new Promise(r => setTimeout(r, 200));
          const cardTxt = [...document.querySelectorAll('.ds-card')].map(x => x.textContent).find(t => t.startsWith('Language guides')) || '';
          [...document.querySelectorAll('.ds-root button')].find(b => b.textContent.startsWith('Publish ')).click(); await new Promise(r => setTimeout(r, 900));
          const md = app.vault.text.get(bk.lastCompiled[0].path) || ''; bk.compile.langGuides = []; bk.compile.format = 'pdf';
          return { pdf: a, docx: b, pdfSize: (app.vault.bin.get(a) || []).length, docxSize: (app.vault.bin.get(b) || []).length, cardTxt: cardTxt.slice(0, 60), appendix: md.includes('Old Tide: A Language Guide'), dict: md.includes('Dictionary') }; }""", CONLANG)
        print('16. guide export:', json.dumps(r, ensure_ascii=False))
        assert r['pdf'].endswith('Old Tide - Language Guide.pdf') and r['docx'].endswith('.docx') and r['pdfSize'] > 2000 and r['docxSize'] > 2000 and 'Old Tide' in r['cardTxt'] and r['appendix'] and r['dict']
        pdfb = await ev("(p) => Array.from(app.vault.bin.get(p)).map(c => String.fromCharCode(c)).join('')", r['pdf'])
        assert 'A Language Guide' in pdfb and 'Dictionary' in pdfb
        # 17. old conlang data on a Language note moves into its own conlang note
        r = await ev("""async () => { await app.vault.create('Story/Languages/Deep Speech.md', '---\\ntype: language\\n---\\n```worldkeeper\\n```\\n'); await new Promise(r => setTimeout(r, 200));
          const f = app.vault.getAbstractFileByPath('Story/Languages/Deep Speech.md'); await app.fileManager.processFrontMatter(f, (fm) => { fm.phonology = { consonants: 'k r th', vowels: 'a u' }; fm.lexicon = [{ word: 'kru', pos: 'noun', meaning: 'deep' }]; fm.affixes = []; });
          await new Promise(r => setTimeout(r, 300)); const moved = await SGP.sections.world.wordwrightMigrate(); await new Promise(r => setTimeout(r, 300));
          const lf = app.metadataCache.getFileCache(f).frontmatter; const c = app.metadataCache.getFirstLinkpathDest('Deep Speech (conlang)', ''); const cf = c ? app.metadataCache.getFileCache(c).frontmatter : {};
          return { moved, link: lf.conlang, stripped: !('lexicon' in lf) && !('phonology' in lf), words: (cf.lexicon || []).map(e => e.word), back: cf.language }; }""")
        print('17. migration:', json.dumps(r, ensure_ascii=False))
        assert r['moved'] == ['Deep Speech'] and r['link'] == '[[Deep Speech (conlang)]]' and r['stripped'] and r['words'] == ['kru'] and r['back'] == '[[Deep Speech]]'
        # 18. Wordwright library view and the encyclopedia can link a conlang
        r = await ev("""async () => { app.commands.executeCommandById('worldkeeper:open-wordwright'); await new Promise(r => setTimeout(r, 600));
          const cards = [...document.querySelectorAll('.ww-card-name')].map(x => x.textContent); return { cards, cmds: Object.keys(app.commands.commands).filter(k => /conlang|wordwright|translate/.test(k)) }; }""")
        print('18. library:', json.dumps(r, ensure_ascii=False))
        assert set(r['cards']) == {'Old Tide', 'Deep Speech', 'Sindral', 'Order Test'} and 'storyguild:translate-selection' in r['cmds'] and 'worldkeeper:open-wordwright' in r['cmds']
        await ev("() => document.querySelectorAll('.ww-test').forEach(e => e.remove())")
        # Unload cleanly
        r = await ev("""async () => { SGP.unload(); await new Promise(r => setTimeout(r, 300)); return { views: Object.keys(app.viewRegistry), blocks: Object.keys(app.codeblocks), cmds: Object.keys(app.commands.commands).length, saved: JSON.parse(app.vault.adapter.data.get('.obsidian/plugins/storyguild/data.json')).manuscript.projects.length }; }""")
        print('9. unload:', r)
        assert not r['views'] and not r['blocks'] and r['cmds'] == 0
        errs = await ev('() => __errors')
        errors += errs
        await b.close()
    print('\nERRORS:', len(errors)); [print(' ', e[:400]) for e in errors]
    return 1 if errors else 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
