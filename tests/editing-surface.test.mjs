import test from "node:test";
import assert from "node:assert/strict";
import { resolveEditingSurface } from "../src/renderer/utils/editingSurface.mjs";

test("resolveEditingSurface honors explicit single-pane modes", () => {
  assert.equal(resolveEditingSurface("source", "editor"), "source");
  assert.equal(resolveEditingSurface("editor", "source"), "editor");
  assert.equal(resolveEditingSurface("preview", "source"), "preview");
});

test("resolveEditingSurface uses the last active surface in split mode", () => {
  assert.equal(resolveEditingSurface("split", "source"), "source");
  assert.equal(resolveEditingSurface("split", "editor"), "editor");
  assert.equal(resolveEditingSurface("split", "unknown"), "editor");
});
