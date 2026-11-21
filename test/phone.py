"""Screenshots of every Storyguild screen at Galaxy S22 Ultra size (384 x 824, touch, Obsidian's is-phone).
python3 test/phone.py   (after node scripts/build.mjs) -> test/out-phone/p-*.png
Fails if any screen is wider than the phone (horizontal overflow) or a page error happens."""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run import SEED, CH1, CH2, jpeg_b64, HERE

OUT = os.path.join(HERE, 'out-phone'); os.makedirs(OUT, exist_ok=True)
W, H = 384, 824

WAIT = 'new Promise(r => setTimeout(r, %d))'

async def main():
    errors, wide = [], []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--allow-file-access-from-files'])
        page = await b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, is_mobile=True, has_touch=True)
        await page.add_init_script('window.__MOBILE = true')
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        page.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' else None)
        await page.goto('file://' + os.path.join(HERE, 'harness.html'))
        ev = page.evaluate
        await ev(SEED, {'jpg': jpeg_b64()})
        await ev("""async () => { const m = __modals[0]; [...m.contentEl.querySelectorAll('button')].find(b => b.textContent === 'Import and switch').click(); await %s;
          await SGP.openDraftsmith(); await %s;
          [...document.querySelectorAll('.ds-root button, .ds-root .ds-menu')].find(b => /Chapters from Plot Weaver/.test(b.textContent))?.click(); await %s;
          if (!app.vault.getMarkdownFiles().some(f => f.path.startsWith('Novels/'))) await SGP.api.chaptersFromPlot?.();
        }""" % (WAIT % 800, WAIT % 400, WAIT % 900))
        await ev("""async ({a, b}) => { const fs = app.vault.getMarkdownFiles().filter(f => f.path.startsWith('Novels/'));
            for (const [f, t] of [[fs[0], a], [fs[1], b]]) if (f) { const x = await app.vault.read(f); await app.vault.modify(f, x + '\\n' + t); }
            const p = SGP.data.manuscript.projects[0]; p.cover = 'Assets/cover.jpg'; p.author = 'Rhea Ashdown';
            await new Promise(r => setTimeout(r, 2600)); }""", {'a': CH1, 'b': CH2})

        async def shot(name, sel=None):
            await page.wait_for_timeout(250)
            ow = await ev("""() => { const v = [...document.querySelectorAll('.workspace-leaf-content')].pop(); const m = [...document.querySelectorAll('.modal-container')].pop();
              const docW = document.documentElement.scrollWidth; const root = m || v; let worst = null;
              for (const e of root.querySelectorAll('*')) { const r = e.getBoundingClientRect(); if (r.width && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed') { let p = e.parentElement, clipped = false; while (p && p !== root) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { clipped = true; break; } p = p.parentElement; } if (!clipped && (!worst || r.right > worst[1])) worst = [e.className || e.tagName, Math.round(r.right)]; } }
              return { docW, worst }; }""")
            if ow['docW'] > W + 1 or ow['worst']:
                wide.append((name, ow))
            await ev("() => { const ls = [...document.querySelectorAll('#workspace > .workspace-leaf-content')]; ls.forEach((l, i) => l.style.display = i === ls.length - 1 ? '' : 'none'); }")
            await page.screenshot(path=f'{OUT}/p-{name}.png', full_page=True)

        view = "app.workspace.getLeavesOfType('storyguild-draftsmith')[0].view"
        for tab in ['manuscript', 'details', 'readers', 'checklist', 'stats', 'compile']:
            await ev(f"async () => {{ {view}.setTab('{tab}'); await {WAIT % 350}; window.scrollTo(0, 0); }}")
            await shot('ds-' + tab)
        # a chapter's bottom sheet and the More menu
        await ev(f"async () => {{ {view}.setTab('manuscript'); await {WAIT % 200}; const c = document.querySelector('.ds-chcard'); if (c) c.click(); await {WAIT % 200}; }}")
        await shot('ds-chapter-sheet')
        r = await ev(f"""async () => {{ const m = [...__modals].pop(); m && m.close(); const v = {view}; const names = () => [...document.querySelectorAll('.ds-chcard .ds-chmain > b')].map(b => b.textContent);
          const before = names(); [...document.querySelectorAll('.sg-chtools button')].find(b => b.textContent.includes('Reorder')).click(); await {WAIT % 150};
          document.querySelector('.ds-mv button[aria-label="Move down"]').click(); await {WAIT % 1200}; const after = names();
          [...document.querySelectorAll('.sg-chtools button')].find(b => b.textContent.includes('Done')).click(); await {WAIT % 150};
          document.querySelector('.sg-chtools button[aria-label=More]').click(); const menu = __lastMenu ? __lastMenu.items.map(i => i.title) : [];
          return {{ before, after, menu }}; }}""")
        print('reorder:', r)
        assert r['after'][:2] == [r['before'][1], r['before'][0]], 'down should swap the first two chapters'
        assert any('New idea' in x for x in r['menu']) and any('Start draft' in x for x in r['menu'])
        await ev("() => { const m = [...__modals].pop(); m && m.close(); }")
        # Worldkeeper
        await ev(f"async () => {{ app.commands.executeCommandById('worldkeeper:open-home'); await {WAIT % 900}; }}")
        await shot('wk-home')
        await ev(f"""async () => {{ await app.vault.create('Story/Places/Brineholt.md', '---\\ntype: place\\nplaceType: Port\\nsize: Large\\n---\\n```worldkeeper\\n```\\n\\n## Notes\\n\\nClings to the cliffs.\\n');
          app.commands.executeCommandById('worldkeeper:open-dashboards'); await {WAIT % 800}; }}""")
        await shot('wk-dashboards')
        for name, path in [('wk-character', 'Story/Characters/Mara Vell.md'), ('wk-place', 'Story/Places/Brineholt.md')]:
            await ev(f"""async (path) => {{ document.querySelectorAll('.sg-sheet-test').forEach(e => e.remove()); const leaf = app.workspace.getLeaf(); const wrap = document.createElement('div'); wrap.className = 'workspace-leaf-content sg-sheet-test'; const inner = wrap.appendChild(document.createElement('div')); inner.className = 'view-content markdown-preview-view';
              document.getElementById('workspace').append(wrap); const ctx = {{ sourcePath: path, addChild(c) {{ c.load(); }}, getSectionInfo() {{ return null; }} }};
              await app.codeblocks['worldkeeper']('', inner, ctx); await {WAIT % 600}; wrap.scrollIntoView(); }}""", path)
            await shot(name)
        await ev("() => document.querySelectorAll('.sg-sheet-test').forEach(e => e.remove())")
        await ev(f"""async () => {{ await app.vault.create('Worldkeeper/Encyclopedia/Lantern Law.md', '---\\ntype: entry\\ncategory: Law & custom\\ntags: [guild]\\nlinks: []\\nseeAlso: []\\n---\\n```worldkeeper-entry\\n```\\n\\n## Origins\\n\\nEvery lantern on the harbour wall was lit by a keeper.\\n\\n## The Nine Lanterns\\n\\nEight still burn.\\n');
          await app.vault.create('Worldkeeper/Encyclopedia/Saltglass.md', '---\\ntype: entry\\ncategory: Materials\\n---\\n```worldkeeper-entry\\n```\\n\\nGlass that remembers the sea.\\n');
          app.commands.executeCommandById('worldkeeper:open-encyclopedia'); await {WAIT % 900}; }}""")
        await shot('wk-encyclopedia')
        await ev(f"async () => {{ const b = [...document.querySelectorAll('.enc-item')].find(x => x.textContent.includes('Lantern Law')); b && b.click(); await {WAIT % 700}; }}")
        await shot('wk-entry')
        # Plot Weaver
        await ev(f"async () => {{ app.commands.executeCommandById('plot-weaver:open-board'); await {WAIT % 800}; }}")
        await shot('pw-board')
        r = await ev(f"async () => {{ const chips = document.querySelectorAll('.sg-pw-chips button'); chips[2].click(); await {WAIT % 700}; const st = document.querySelector('.sg-pw-lanes'); return {{ left: st.scrollLeft, w: st.clientWidth, on: document.querySelector('.sg-pw-chips .is-on').textContent, cards: [...st.children[2].querySelectorAll('.pw-card-title')].map(x => x.textContent) }}; }}")
        print('board chip:', r)
        assert r['left'] >= r['w'] * 1.5 and r['cards']
        r = await ev(f"async () => {{ const c = document.querySelector('.sg-pw-col .pw-card, .pw-card'); if (!c) return 'no card'; c.click(); await {WAIT % 300}; const m = [...__modals].pop(); return m ? m.titleEl.textContent : 'no modal'; }}")
        print('tap card ->', r)
        await shot('pw-card-tap')
        await ev("() => { const m = [...__modals].pop(); m && m.close(); }")
        await ev(f"async () => {{ app.commands.executeCommandById('storyguild:open-library'); SGP.api.openLibrary(); await {WAIT % 300}; }}")
        await shot('library')
        errors += await ev('() => __errors')
        await b.close()
    print('screens wider than the phone:', len(wide)); [print('  ', w) for w in wide]
    print('ERRORS:', len(errors)); [print('  ', e[:300]) for e in errors]
    return 1 if errors or wide else 0

if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
