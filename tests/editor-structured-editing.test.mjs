import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { getEmptyListEnterStrategy } from "../src/renderer/utils/editorStructuredEditing.mjs";

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

test("editor Enter handlers clear inline marks for new paragraphs and list items", () => {
  assert.match(appSource, /function clearStoredEditorMarks\(tr, schema\)/);
  assert.match(appSource, /tr\.removeStoredMark\(markType\);/);
  assert.match(appSource, /tr\.setStoredMarks\(\[\]\);/);
  assert.match(appSource, /function splitEditorBlockWithoutMarks\(\)/);
  assert.match(appSource, /splitBlock\(\{ keepMarks: false \}\)/);
  assert.match(appSource, /function splitEditorListItemWithoutMarks\(itemType\)/);
  assert.match(appSource, /splitListItem\(itemType\)/);
  assert.match(appSource, /clearStoredEditorMarks\(tr, state\.schema\);/);
});

test("heading Enter path also clears inline marks in the inserted paragraph", () => {
  assert.match(appSource, /function insertParagraphAfterCurrentBlock\(view\)/);
  assert.match(appSource, /clearStoredEditorMarks\(tr, state\.schema\);/);
});
