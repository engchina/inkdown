import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { getDelayedParagraphTransform, getEmptyListEnterStrategy } from "../src/renderer/utils/editorStructuredEditing.mjs";

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
