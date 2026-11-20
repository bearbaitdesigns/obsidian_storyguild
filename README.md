# Storyguild

Write, plan and build your novel in one Obsidian plugin. Storyguild has three sections:

- **Draftsmith** — your manuscript: chapter notes, draft numbers, book details, alpha/beta reader rounds with questions and answers, publishing checklists, and publishing to PDF, Word, EPUB or Markdown.
- **Worldkeeper** — worldbuilding sheets, dashboards, encyclopedia, Home, milestones and to-do list. The Home banner has Plot Weaver and Draftsmith pills under the book's details. On the right, the goal ring sits above the Encyclopedia and World Atlas pills.
- **Plot Weaver** — plotlines × chapters board, POVs, off-screen events, cause and effect.

All three sections share **books and series**. The current book is the same everywhere. You can start a new book, create a series, or add an existing book to a series from **📚 Books & series**. It's on the ribbon, in the Draftsmith header, on the Worldkeeper Home banner and in the command palette (**New book…**, **New series…**, **Add a book to a series…**, **Switch book…**). A novel created in Plot Weaver becomes a book automatically, and switching novels in Plot Weaver switches the book everywhere.

Worldkeeper and Plot Weaver work exactly as they did as separate plugins. Their views, code blocks (`worldkeeper`, `worldkeeper-home`, `worldkeeper-dashboard`, `worldkeeper-entry`, `plot-weaver`), commands and hotkeys keep the same names.

## Installing

1. **Back up your vault** first. Copying the whole vault folder is enough.
2. Copy `main.js`, `manifest.json` and `styles.css` into `<your vault>/.obsidian/plugins/storyguild/`. You can also install it with BRAT.
3. Turn on **Storyguild** in Settings → Community plugins.

## Switching from Worldkeeper and Plot Weaver

When Storyguild starts for the first time, it checks whether Worldkeeper or Plot Weaver is in your vault. If it finds either one, it asks what to do:

- **Import and switch** copies their settings and outlines into Storyguild and turns the old plugins off.
- **Start fresh** imports nothing and turns the old plugins off.
- **Not now** changes nothing. The Worldkeeper and Plot Weaver sections stay paused while the old plugins are on.

You can run the import again later with the command **Import from Worldkeeper / Plot Weaver…** or from Settings → Storyguild.

What the import does and doesn't do:

- **Notes are never changed.** Sheets, scene notes, the to-do file and code blocks keep working unchanged.
- **Data is copied, not moved.** `.obsidian/plugins/worldkeeper/` and `.obsidian/plugins/plot-weaver/` are left exactly as they were. To go back, turn Storyguild off and turn the old plugins on.
- **Backups come first.** Every settings file involved is saved to `.obsidian/plugins/storyguild/backups/<date-time>/` before anything else happens.
- **The old plugins are turned off, not uninstalled.** They can't run at the same time as Storyguild, because both would try to register the same views and code blocks. Don't turn them back on while Storyguild is on.
- Worldkeeper's novel settings become a Draftsmith project. The Plot Weaver novel it tracked is linked to that project. Worldkeeper's reader milestones become Draftsmith reader rounds.

## Shared fields

One set of book details serves all three sections:

| Field | Draftsmith | Worldkeeper | Plot Weaver |
|---|---|---|---|
| Title | Book details | Home, novel settings | linked novel's name |
| Series and book number | Books & series / Book details | Home banner (“Series · Book 2”) | each book draws on the earlier books (linked novels) |
| Genre, audience, logline, summary | Book details | Home, novel settings | — |
| Banner, milestones, manual word count | — | Home, one set per book | — |
| Target word count, deadline, stage | Book details / header | Home goal ring, deadline, stage badge | — |
| Cover | Book details | Home banner when no banner is set | — |
| Word count | chapter notes | Home words and activity chart | stats strip |
| Status and words properties on notes | same fields | same fields | Plot Weaver's own field settings |
| Reader rounds | Readers tab | Milestones card (read-only there) | — |
| Checklist steps marked 🎯 | Publishing checklist | Milestones & deadlines card (the step's date is the deadline; ticking either side ticks both) | — |

Edit a shared field anywhere and it changes everywhere.

## Draftsmith

- **Manuscript** — Every note in the project's chapters folder is a chapter. Chapter order comes from a `chapter` property, or follows the Plot Weaver board. Each chapter has its own `draft` number, and the whole manuscript has one too.
  - **Start draft #N** saves a copy of every chapter to `Drafts/Draft N/` before the new draft begins.
  - Word counts are written to the `words` property as you type. You can turn this off.
    - Only prose is counted. Left out: frontmatter properties, fenced blocks (```, ''' or ~~~), inline code, [[wiki links]] and ![[embeds]], comments (%% %% and <!-- -->), callout titles, #tags and URLs.
    - Counts are refreshed for every chapter after an update. The command **Recount words in all chapters** does it any time.
  - Each entry has a **type**: Chapter, Prologue, Interlude or Epilogue. Only chapters are numbered. In the # column a prologue shows as P, an interlude as I, an epilogue as E and an idea as 💡; the first real chapter is 1.
    - In Publish, headings follow the type, for example “Prologue: The Drowning” or “Chapter 1: Low Water”.
    - For chapters linked to Plot Weaver, the type is shared with the board's section.
  - **Idea** is a fifth type, for a scene or fragment you want to keep with the manuscript.
    - It isn't numbered, isn't linked to Plot Weaver, doesn't count toward the word count or the checklist, and can sit anywhere in the list.
    - Turning a linked chapter into an idea removes its link to Plot Weaver. The board's section is left as it is.
    - In Publish, ideas are left out unless you turn on **Include ideas**. They're then printed in place under their own title.
    - To promote an idea, change its type, then use **link…** to tie it to an existing Plot Weaver chapter or add a new one to the board in the right place.
  - **Reorder** by dragging rows by their ⋮⋮ handle. When the book is linked to Plot Weaver, the board's chapters are reordered to match. Parts and Planning sections stay where they are.
  - **Chapters from Plot Weaver** creates a note for each chapter on the board.
  - **⇪ Import chapter notes** turns notes you already have into chapters.
    - Pick a folder (or single notes) and set the order. Then either move the notes into the book's chapters folder, where Obsidian keeps every link working, or keep them where they are and use that folder as the chapters folder.
    - Your text and properties are kept. Draftsmith only adds the chapter number, draft, status and word count.
    - Notes can be matched to Plot Weaver chapters with the same title, or get a new Plot Weaver chapter.
    - The command **Add this note as a chapter** does the same for the note you have open.
- **Book details** — cover, title, subtitle, series, author and pen name, genre, audience, logline, blurb, short and full synopsis, comps, keywords, ISBNs, imprint, dates, dedication, acknowledgments and bio. You can add your own fields, and all property names are configurable.
- **Readers** — Run any number of alpha and beta rounds.
  - Each send records the date it was sent, the format, the manuscript version, the due date and its status.
  - Attach readers' files (PDF, Markdown, Word, text, images). Bullet points in a Markdown or text file can be imported as notes, and a line starting `Ch 5:` is linked to chapter 5.
  - Each round has its own set of questions. Readers' answers are shown side by side under each question.
  - When you add a round's first questions, Draftsmith asks whether to include them in Publish.
  - **Export round to note** writes the whole round to Markdown.
- **Publishing checklist** — three tabs: **Drafting & Revision**, **Traditional** and **Self-publishing**. Steps marked ⚡ tick themselves from your data. You can add, remove or date any step. 🎯 turns a dated step into a milestone on the Worldkeeper Home Milestones & deadlines card. The to-do list keeps only to-dos from your notes and the to-do file.
- **Publish** — PDF (book layout or standard manuscript format), Word (.docx), EPUB 3 or one Markdown note.
  - Options: title page, contents, front and back matter, chapter heading template (`{n}`, `{N}`, `{title}`), scene-break mark, page size and curly quotes.
  - A round's questions can be added at the end of a reader copy as a plain list, with no space for answers (readers answer separately).

### Publishing limits

- **PDF text:** uses the built-in PDF fonts (Times and Courier), so it supports Western European characters only. Anything else prints as `?`. For other scripts, publish to Word or EPUB.
- **PDF cover:** only a JPEG cover is placed in a PDF. EPUB takes JPEG, PNG, GIF or WebP.
- **Word contents page:** Word fills in the page numbers when the file is opened.

## Releasing

```
node scripts/bump.mjs 1.0.1        # sets the version in manifest.json, package.json, versions.json and rebuilds
git commit -am "Release 1.0.1" && git tag 1.0.1 && git push && git push origin 1.0.1
```

The **Release** GitHub Action builds the plugin and publishes `main.js`, `manifest.json` and `styles.css` as a release. You can also run it by hand from the Actions tab.

## Development

```
node scripts/build.mjs      # builds main.js and styles.css
python3 test/run.py         # end-to-end test in headless Chrome with a mock Obsidian API
```

- `vendor/worldkeeper/src/` and `vendor/plot-weaver/main.js` are the original plugins, unchanged. Each is wrapped in its own scope.
- `scripts/build.mjs` makes five small, named patches to Worldkeeper. Each patch must match exactly once, so if the original code changes, the build stops instead of patching in the wrong place.
- `src/` is the Storyguild host and Draftsmith.

MIT © bearbaitdesigns
