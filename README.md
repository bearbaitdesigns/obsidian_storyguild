# Storyguild

Write, plan and build your novel in one Obsidian plugin. Storyguild has three sections:

- **Draftsmith** — your manuscript: chapter notes, draft numbers, book details, alpha/beta reader rounds with questions and answers, publishing checklists, and publishing to PDF, Word, EPUB or Markdown.
- **Worldkeeper** — worldbuilding sheets, dashboards, encyclopedia, Home, milestones and to-do list.
  - **Gods** and **Demons** have their own sheet templates, listed with Characters under **Story** on the dashboard.
  - Pantheons, magic patrons, faiths and demon species accept them.
  - The command **Give Deity and Demon characters their own God and Demon sheets** converts existing characters with role Deity or Demon. Only their `type` property changes. The Home banner has Plot Weaver and Draftsmith pills under the book's details. On the right, the goal ring sits above the Encyclopedia and World Atlas pills.
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
  - The **POV** column shows the note's `pov` property, or, if that's empty, the POV tags of the chapter's Plot Weaver cards.
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
- **Stats** (between Publishing checklist and Publish) — how the book is going:
  - **Top numbers:** total words against the target, today's words against your daily goal, words written in the chosen period, daily average, writing streak, and a projected finish date at your 30-day pace. A note compares the projection with your draft deadline and says how many words a day would make it.
  - **Charts:** words written per day with the goal line, manuscript growth with the target and projection, a 12-month writing calendar, words by chapter (coloured by status), words by POV, Plot Weaver cards by plotline, and words by weekday.
  - **Tables:** draft history and reader-round summary, plus “at a glance” facts (reading time, estimated pages, average, longest and shortest chapter, best day).
  - Choose a range (week, 30 or 90 days, 12 months, all time) and set the book's daily goal there. Every chart has a Table view.
  - Daily history: Draftsmith saves each book's total once a day, with ideas not counted. Worldkeeper's existing daily history is imported once, so the charts start with your past days.
- **Publishing checklist** — three tabs: **Drafting & Revision**, **Traditional** and **Self-publishing**. Steps marked ⚡ tick themselves from your data. You can add, remove or date any step. 🎯 turns a dated step into a milestone on the Worldkeeper Home Milestones & deadlines card. The to-do list keeps only to-dos from your notes and the to-do file.
- **Publish** — PDF (book layout or standard manuscript format), Word (.docx), EPUB 3 or one Markdown note.
  - Options: title page, contents, front and back matter, chapter heading template (`{n}`, `{N}`, `{title}`), scene-break mark, page size and curly quotes.
  - A round's questions can be added to a reader (alpha, beta or ARC) copy as a plain list, **before the table of contents**, with no space for answers.
  - **Cover page** (optional): the cover image from Book details.
    - In PDF and Word it's fitted inside a 1-inch margin, centred, and never stretched or cropped. EPUB uses it as the e-book cover.
    - PDF takes JPEG and PNG covers without transparency. Word takes JPEG, PNG and GIF.
  - **Page numbers**: PDF and Word number every page except the cover and title page. The contents list the page each chapter starts on. In Word the contents are a real contents field, pre-filled with the right numbers and refreshed by Word when you open the file.
  - **Copyright & notices** (wording in Book details):
    - The **draft copyright notice** replaces the standard copyright lines while the book's stage isn't Published. You can switch this per publish.
    - A **short copyright line** and an **AI notice** (not to be used for AI training, prompting or development) are printed at the foot of every page. In EPUB, which has no fixed pages, they end every chapter.
  - **Stamp the draft number and word count** adds e.g. “Draft 3 · 84,210 words” to the copyright page. The Draftsmith header also shows the total word count next to the draft number.
  - The **preview** shows miniature pages that follow every option: format, page size, font size, manuscript format, title page, copyright page, reader questions, contents with estimated page numbers, chapter heading, scene breaks, curly quotes and the notices on every page.

### Publishing limits

- **PDF text:** uses the built-in PDF fonts (Times and Courier), so it supports Western European characters only. Anything else prints as `?`. For other scripts, publish to Word or EPUB.
- **PDF cover:** JPEG, or PNG without transparency. EPUB takes JPEG, PNG, GIF or WebP.
- **Word contents page:** Word fills in the page numbers when the file is opened.

## On a phone

Storyguild has a layout made for phones in all three sections. It switches on by itself in Obsidian for Android and iPhone. Settings → Storyguild → **Phone layout** can also turn it on everywhere (handy in a narrow pane on a tablet) or off.

- **Moving around:** a Draftsmith / Worldkeeper / Plot Weaver switcher sits at the top. Draftsmith's tabs are one row that scrolls sideways and stays on screen.
- **Chapters:** one card per chapter with its number, status, draft, POV and words. Tap a card for its type, status, new draft, POV and Plot Weaver cards. **Reorder** gives each card ↑ ↓ buttons, since dragging doesn't work well on a touchscreen. **＋** adds a chapter; **⋯** holds the other actions.
- **Wide tables** (readers, reader directory) become one card per row, each value labelled.
- **Book details:** one column of sections that open and close, each showing how many fields are filled.
- **Checklists:** the date sits under each step so the step's name has room.
- **Stats:** charts are full width; tap a bar or a point to see its numbers.
- **Publish:** the preview comes first as a row of pages you swipe through, and the Publish button stays on screen.
- **Worldkeeper Home:** the banner stacks, with the goal ring in the corner and the Plot Weaver, Draftsmith, Encyclopedia and World Atlas buttons in a 2 × 2 grid.
- **Dashboards:** the categories are one row you swipe; the notes are below.
- **Sheets** (characters, gods, demons and every worldbuilding type): tiles in two columns, tabs that scroll sideways and stay on screen, details as a list, gallery three across.
- **Encyclopedia:** the list of entries first, then the entry you tap, with **‹ All entries** to go back. Its contents fold into a **Contents** button.
- **Plot Weaver:** the board shows one chapter at a time. Swipe sideways or tap a chapter at the top. Cards are grouped by plotline; tap one to edit it or move it to another chapter or plotline. **＋ Add a card here** adds to the chapter you're looking at.

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
python3 test/phone.py       # every screen at phone size (Galaxy S22 Ultra); fails if anything is wider than the screen
```

- `vendor/worldkeeper/src/` and `vendor/plot-weaver/main.js` are the original plugins, unchanged. Each is wrapped in its own scope.
- `scripts/build.mjs` makes small, named patches to Worldkeeper and Plot Weaver. Each patch must match exactly once, so if the original code changes, the build stops instead of patching in the wrong place.
- `src/` is the Storyguild host and Draftsmith.

MIT © bearbaitdesigns
