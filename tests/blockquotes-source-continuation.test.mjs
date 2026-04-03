import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");

test("source continuation checks full markdown context before exiting blockquotes", () => {
  assert.ok(appSource.includes("getMarkdownBlockquoteContinuation(markdownText, selectionStart) || getMarkdownLineContinuation(line)"));
});
