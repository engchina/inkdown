import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  getDelayedParagraphTransform,
  getDelayedThematicBreakTransform,
  getEmptyListEnterStrategy
} from "../src/renderer/utils/editorStructuredEditing.mjs";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");

test("empty bullet or ordered list items defer Enter to the editor keymap", () => {
  assert.equal(getEmptyListEnterStrategy({ inListItem: true }), "default");
});

test("empty task items still use the local exit behavior", () => {
  assert.equal(getEmptyListEnterStrategy({ inTaskItem: true }), "exit");
});

test("non-list blocks ignore the empty-list Enter strategy", () => {
  assert.equal(getEmptyListEnterStrategy({}), "ignore");
});

test("source Backspace also clears empty heading markers in one step", () => {
  assert.match(appSource, /const markerMatch = \/*\^\(\\s\*\)\(\?:#\{1,6\}\\s\?\|\[-\*\+\]\\s\|\\d\+\\.\\s\|\[-\*\+\]\\s\\\[\(\?: \|x\|X\)\\\]\\s\|\(\?:>\\s\*\)\+\)\$\/u\.exec\(line\);/);
});

test("empty headings, blockquotes, and code blocks normalize to paragraphs on Backspace", () => {
  assert.match(appSource, /function normalizeCurrentEmptyTextblockToParagraph\(view\)/);
  assert.match(appSource, /tr = tr\.setNodeMarkup\(blockFrom, schema\.nodes\.paragraph\);/);
  assert.match(appSource, /const target = liftedRange \? liftTarget\(liftedRange\) : null;/);
  assert.match(appSource, /tr = tr\.lift\(liftedRange, target\);/);
  assert.match(appSource, /tr = tr\.setSelection\(TextSelection\.create\(tr\.doc, paragraphPos \+ 1\)\)\.scrollIntoView\(\);/);
  assert.match(appSource, /if \(event\.key === "Backspace" && cursorAtStart\) \{[\s\S]*?if \(emptyTextblock && state\.inHeading\) \{[\s\S]*?return normalizeCurrentEmptyTextblockToParagraph\(view\);/);
  assert.match(appSource, /if \(emptyTextblock && state\.inBlockquote\) \{[\s\S]*?return normalizeCurrentEmptyTextblockToParagraph\(view\);/);
  assert.match(appSource, /if \(emptyTextblock && state\.inCodeBlock\) \{[\s\S]*?return normalizeCurrentEmptyTextblockToParagraph\(view\);/);
});

test("paragraph space shortcuts only consume escaped literal markers", () => {
  assert.match(appSource, /function applyEditorParagraphSpaceShortcut\(view, beforeCursor, rangeFrom, rangeTo\)/);
  assert.match(appSource, /const escapedSpacePrefix = \/\^\\\\\(#\{1,6\}\|>\|\[-\*\+\]\|\\d\+\\\.\|\[-\*\+\]\\s\\\[\(\?: \|x\|X\)\\\]\)\$\/\.exec\(beforeCursor\)/);
});

test("delayed paragraph transforms wait for content after the markdown marker", () => {
  assert.deepEqual(getDelayedParagraphTransform("- ", "a"), { kind: "bulletList" });
  assert.deepEqual(getDelayedParagraphTransform("1. ", "a"), { kind: "orderedList" });
  assert.deepEqual(getDelayedParagraphTransform("> ", "a"), { kind: "blockquote" });
  assert.deepEqual(getDelayedParagraphTransform("- [ ] ", "a"), { kind: "taskList" });
  assert.equal(getDelayedParagraphTransform("- ", " "), null);
});

test("thematic break transforms wait for Enter on a pure marker line", () => {
  assert.deepEqual(getDelayedThematicBreakTransform("---", true), { marker: "---" });
  assert.deepEqual(getDelayedThematicBreakTransform("---   ", true), { marker: "---" });
  assert.deepEqual(getDelayedThematicBreakTransform("***", true), { marker: "***" });
  assert.deepEqual(getDelayedThematicBreakTransform("***   ", true), { marker: "***" });
  assert.deepEqual(getDelayedThematicBreakTransform("* * *", true), { marker: "***" });
  assert.deepEqual(getDelayedThematicBreakTransform("___", true), { marker: "___" });
  assert.equal(getDelayedThematicBreakTransform("---", false), null);
  assert.equal(getDelayedThematicBreakTransform("*** text", true), null);
  assert.equal(getDelayedThematicBreakTransform("--- text", true), null);
  assert.equal(getDelayedThematicBreakTransform("--", true), null);
});

test("editor handles thematic break smart transforms on Enter", () => {
  assert.match(appSource, /function convertParagraphToHorizontalRule\(view\)/);
  assert.match(appSource, /const horizontalRuleType = schema\.nodes\.horizontalRule;/);
  assert.match(appSource, /Fragment\.fromArray\(\[horizontalRuleNode, paragraphNode\]\)/);
  assert.match(appSource, /getDelayedThematicBreakTransform\(parent\.textContent, true\)/);
  assert.match(appSource, /if \(event\.key === "Enter" && applyEditorDelayedThematicBreakTransform\(view\)\) \{/);
  assert.match(appSource, /setHint\("Horizontal rule\."\);/);
  assert.match(appSource, /thematicBreak: true/);
  assert.match(appSource, /const HorizontalRuleWithDelayedTransform = HorizontalRule\.extend\(\{\s*addInputRules\(\) \{\s*return \[\];\s*\}\s*\}\);/s);
  assert.match(appSource, /StarterKit\.configure\(\{[\s\S]*?horizontalRule: false,/);
});
