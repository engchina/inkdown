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
  assert.match(appSource, /selection instanceof NodeSelection && selection\.node\?\.type\?\.name === "image"/);
  assert.match(appSource, /kind: "image", label: "Image"/);
});

test("styles keep shared toolbar emphasis states", () => {
  assert.match(stylesSource, /\.toolbar-section\.active \{/);
  assert.match(stylesSource, /\.toolbar-section\.active \.toolbar-section-label \{/);
  assert.match(stylesSource, /\.editor-image-node \{/);
  assert.match(stylesSource, /\.editor-image-markdown-block \{/);
  assert.match(stylesSource, /\.mark-source-editor \{/);
  assert.match(stylesSource, /\.mark-source-input \{/);
  assert.match(stylesSource, /overflow: hidden;/);
  assert.match(stylesSource, /resize: none;/);
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

test("selected editor images expose an inline editable markdown block", () => {
  assert.match(appSource, /function formatMarkdownImageSnippet\(\{ alt = "", url = "", title = "" \} = \{\}\)/);
  assert.match(appSource, /function parseMarkdownImageSnippet\(value\)/);
  assert.match(appSource, /function ImageNodeView\(\{ editor, extension, getPos, node, selected, updateAttributes \}\)/);
  assert.match(appSource, /const currentMarkdown = formatMarkdownImageSnippet\(/);
  assert.match(appSource, /event\.target\.value\.trim\(\) === currentMarkdown\.trim\(\)/);
  assert.match(appSource, /return ReactNodeViewRenderer\(ImageNodeView\)/);
  assert.match(appSource, /className=\{`editor-image-node\$\{shown \? " is-selected" : ""\}`\}/);
  assert.match(appSource, /className="editor-image-markdown-block"/);
  assert.match(appSource, /className=\{`editor-image-markdown-input\$\{draftError \? " invalid" : ""\}`\}/);
  assert.match(appSource, /className="editor-image-markdown-block"[\s\S]*<img/);
  assert.match(appSource, /function applyMarkdown\(nextValue = draft\)/);
  assert.match(appSource, /updateAttributes\(nextAttrs\)/);
});

test("source auto pair is disabled and inline mark source uses editable widgets", () => {
  assert.match(appSource, /autoPair: false/);
  assert.doesNotMatch(appSource, /if \(sourceRules\.autoPair \?\? true\) \{\s*handleSourceAutoPair\(event\);/);
  assert.match(appSource, /function getMarkSignature\(mark\)/);
  assert.match(appSource, /otherMarks: commonMarks/);
  assert.match(appSource, /function applyEditableMarkChange\(view, range, nextValue\)/);
  assert.match(appSource, /className = "mark-source-editor"/);
  assert.match(appSource, /className = "mark-source-input"/);
  assert.match(appSource, /Decoration\.inline\(range\.from, range\.to, \{ class: "mark-source-hidden" \}/);
});

test("inline mark reveal is click-driven and no longer reacts to hover", () => {
  assert.match(appSource, /handleDOMEvents: \{\s*click\(view, event\)/);
  assert.doesNotMatch(appSource, /mousemove\(view, event\)/);
  assert.doesNotMatch(appSource, /mouseleave\(view/);
  assert.match(appSource, /const positions = \[\];/);
  assert.match(appSource, /if \(revealPos !== null\) \{/);
});
