import test from "node:test";
import assert from "node:assert/strict";
import { getEmptyListEnterStrategy } from "../src/renderer/utils/editorStructuredEditing.mjs";

test("empty bullet or ordered list items defer Enter to the editor keymap", () => {
  assert.equal(getEmptyListEnterStrategy({ inListItem: true }), "default");
});

test("empty task items still use the local exit behavior", () => {
  assert.equal(getEmptyListEnterStrategy({ inTaskItem: true }), "exit");
});

test("non-list blocks ignore the empty-list Enter strategy", () => {
  assert.equal(getEmptyListEnterStrategy({}), "ignore");
});
