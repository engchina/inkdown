import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");
const stylesSource = await fs.readFile(new URL("../src/renderer/styles/app.css", import.meta.url), "utf8");

test("editor context still describes current block and routes through toolbar state", () => {
  assert.match(appSource, /const editorObjectContext = useMemo/);
  assert.match(appSource, /const toolbarContext = useMemo/);
  assert.match(appSource, /pane: "Editor"/);
  assert.match(appSource, /kind: editorObjectContext\?\.kind \|\| "paragraph"/);
  assert.match(appSource, /label: editorObjectContext\?\.label \|\| "Paragraph"/);
});

test("styles keep shared toolbar emphasis states", () => {
  assert.match(stylesSource, /\.toolbar-section\.active \{/);
  assert.match(stylesSource, /\.toolbar-section\.active \.toolbar-section-label \{/);
});

test("smart heading transform and slash commands support heading levels four through six", () => {
  assert.match(appSource, /const headingShortcut = \/\^\(#\{1,6\}\)\$\/\.exec\(beforeCursor\)/);
  assert.match(appSource, /applyHeadingShortcut\(shortcutFrom, selection\.from, level\)/);
  assert.match(appSource, /id: "heading-4"/);
  assert.match(appSource, /id: "heading-5"/);
  assert.match(appSource, /id: "heading-6"/);
  assert.match(appSource, /toggleHeading\(\{ level: 4 \}\)/);
  assert.match(appSource, /toggleHeading\(\{ level: 5 \}\)/);
  assert.match(appSource, /toggleHeading\(\{ level: 6 \}\)/);
  assert.match(appSource, /togglePrefixedSourceLines\("#### "/);
  assert.match(appSource, /togglePrefixedSourceLines\("##### "/);
  assert.match(appSource, /togglePrefixedSourceLines\("###### "/);
});
