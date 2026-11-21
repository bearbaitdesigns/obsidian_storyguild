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
          const diagrams = __lastMenu.items.map(i => i.title); await __lastMenu.items.find(i => i.title === 'Family tree').cb(); await W(900);
          const hasMermaid = /```mermaid\\nflowchart TD/.test(ta.value); const preview = document.querySelector('.sg-enc-dpreview'); const pv = preview && preview.style.display !== 'none' && preview.textContent.includes('Aldo Vell');
          [...document.querySelectorAll('.enc-editor button')].find(b => b.textContent.includes('Canvas')).click(); const canvasMenu = __lastMenu.items.map(i => i.title);
          const canvases = SGP.sections.world && HOST_canvas();
          return { tools, diagrams: diagrams.length, hasMermaid, pv, canvasMenu, canvases }; }""".replace('HOST_canvas()', "app.vault.getFiles().filter(f => f.extension === 'canvas').map(f => f.path)"))
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
