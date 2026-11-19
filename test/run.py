"""End-to-end test of Storyguild in headless Chrome with a mock Obsidian API.
python3 test/run.py   (after node scripts/build.mjs)"""
import asyncio, base64, io, json, os, sys
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)

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
    plotweaver: { enabled: true, novel: 'The Salt Lantern' }, todoFile: 'Worldkeeper/To-do.md', history: {} };
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
        page = await b.new_page(viewport={'width': 1280, 'height': 1000})
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
          const wkb = document.querySelectorAll('.ds-wk')[4]; wkb.click(); await new Promise(r => setTimeout(r, 400));
          out.todo = await app.vault.read(app.vault.getAbstractFileByPath('Worldkeeper/To-do.md'));
          out.auto = p.checklists.trad[1].items.map(i => [i.t, itemDoneTest(p, i)]);
          return out; }""".replace('setProjectFieldTest = null;', '').replace('itemDoneTest(p, i)', 'null'))
        print('6. shared title + todo:', json.dumps(r, ensure_ascii=False))
        assert r['pwTitle'] == 'The Salt Lantern (rev)' and r['wkTitle'] == 'The Salt Lantern (rev)' and 'Draftsmith' not in r['todo'] or '#draftsmith' in r['todo']
        await page.screenshot(path=f'{OUT}/04-checklist.png', full_page=True)
        await ev("""async () => { app.workspace.getLeavesOfType('storyguild-draftsmith')[0].view.setTab('details'); await new Promise(r => setTimeout(r, 200)); }""")
        await page.screenshot(path=f'{OUT}/05-details.png', full_page=True)

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
        print('7. published:', outs)
        await page.screenshot(path=f'{OUT}/06-publish.png', full_page=True)

        # Worldkeeper home + Plot Weaver board still work
        r = await ev("""async () => { app.commands.executeCommandById('worldkeeper:open-home'); await new Promise(r => setTimeout(r, 900));
          const home = document.querySelector('.wk-home'); const t = home ? home.querySelector('h1').textContent : null;
          const ms = home ? home.textContent.includes('Beta readers') : false;
          app.commands.executeCommandById('plot-weaver:open-board'); await new Promise(r => setTimeout(r, 600));
          return { homeTitle: t, milestones: ms, board: !!document.querySelector('.workspace-leaf-content [class*=pw]'), cmds: Object.keys(app.commands.commands).length }; }""")
        print('8. other sections:', r)
        assert r['homeTitle'] == 'The Salt Lantern (rev)'

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
