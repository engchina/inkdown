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

test("paragraph space shortcuts cover blockquote, bullet list, ordered list, heading, and task list", () => {
  assert.match(appSource, /function applyEditorParagraphSpaceShortcut\(view, beforeCursor, rangeFrom, rangeTo\)/);
  assert.match(appSource, /beforeCursor === ">"/);
  assert.match(appSource, /chain\.toggleBlockquote\(\)\.run\(\)/);
  assert.match(appSource, /\/\^\[-\*\+\]\$\/\.test\(beforeCursor\)/);
  assert.match(appSource, /chain\.toggleBulletList\(\)\.run\(\)/);
  assert.match(appSource, /\/\^\\d\+\\\.\$\/\.test\(beforeCursor\)/);
  assert.match(appSource, /chain\.toggleOrderedList\(\)\.run\(\)/);
  assert.match(appSource, /chain\.toggleTaskList\(\)\.run\(\)/);
});
