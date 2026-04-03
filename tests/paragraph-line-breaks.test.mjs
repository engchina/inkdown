import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Marked } from "marked";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");

test("app markdown renderers keep soft breaks as plain paragraph whitespace", () => {
  assert.ok(appSource.includes('const editorMarked = new Marked({ gfm: true, breaks: false });'));
  assert.ok(appSource.includes('const previewMarked = new Marked({ gfm: true, breaks: false });'));

  const marked = new Marked({ gfm: true, breaks: false });
  assert.equal(marked.parse("line 1\nline 2").trim(), "<p>line 1\nline 2</p>");
  assert.equal(marked.parse("line 1  \nline 2").trim(), "<p>line 1<br>line 2</p>");
});

test("source mode advertises and handles Shift+Enter hard breaks", () => {
  assert.ok(appSource.includes('if (event.key === "Enter" && event.shiftKey) {'));
  assert.ok(appSource.includes('const update = buildSourceHardBreakInsertion('));
});
