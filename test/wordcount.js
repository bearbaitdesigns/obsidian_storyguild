// Word-count rules: node test/wordcount.js (run from the repo root)
const fs = require('fs'); const src = fs.readFileSync('src/00-core.js', 'utf8');
const pick = (name) => src.slice(src.indexOf('function ' + name), src.indexOf('\n}\n', src.indexOf('function ' + name)) + 2);
eval(pick('splitFrontmatter') + pick('countWords') + 'global.countWords = countWords;');
const T = [
 ['---\nstatus: Not started\nwords: 0\npov: Mara\nmanuscript: "[[The Salt Lantern]]"\n---\nOne two three.', 3],
 ['---\n---\nOne two.', 2],
 ['﻿---\r\nstatus: done\r\nwords: 12\r\n---\r\nOne two three four.', 4],
 ['---  \ntags: [a, b]\n---  \nOne.', 1],
 ['Hello [[Tide Court|the Court]] and ![[img.png]] world.', 3],
 ['Text\n```\ncode here ok\n```\nmore', 2],
 ["Text\n'''\nhidden words here\n'''\nmore", 2],
 ['Text\n```js\nunclosed code to the end', 1],
 ['Some `inline code` words', 2],
 ['%% secret note %% visible', 1],
 ['> [!note] Callout title\n> body words', 2],
 ['She didn’t go -- she ran. Well-known #tag', 6],
 ['---\nwords: 5\n---\n', 0],
 ['See [the site](https://example.com) now.', 4],
 ['**Bold** and *italic* text.', 4],
 ['Price: 42 dollars.', 3],
];
let bad = 0; for (const [t, want] of T) { const got = countWords(t); if (got !== want) { bad++; console.log('FAIL', JSON.stringify(t), got, 'want', want); } }
console.log(bad ? bad + ' failed' : 'all ' + T.length + ' passed'); process.exit(bad ? 1 : 0);
