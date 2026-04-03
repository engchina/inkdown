import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");
const footnotesSource = await fs.readFile(new URL("../src/renderer/utils/footnotes.mjs", import.meta.url), "utf8");

test("fenced code parsing recognizes both backtick and tilde fences in preprocessing and outline extraction", () => {
  assert.ok(appSource.includes('const fenceMatch = /^(?<delimiter>`{3}|~{3})(?<language>[^\\s`~]+)?\\s*$/.exec(line);'));
  assert.ok(appSource.includes('const fenceMatch = /^(?<delimiter>`{3}|~{3})(?:[^\\s`~]+)?\\s*$/.exec(line);'));
  assert.ok(appSource.includes('if (new RegExp(`^${fenceDelimiter}\\\\s*$`).test(line)) {'));
});

test("fenced code smart transforms accept broader language identifiers", () => {
  assert.ok(appSource.includes('const codeFenceMatch = /^(?:```|~~~)([^\\s`~]+)?$/.exec(prevText);'));
  assert.ok(appSource.includes('const escapedFenceMatch = /^\\\\((?:```|~~~)([^\\s`~]+)?)$/.exec(beforeCursor);'));
  assert.ok(appSource.includes('const codeFenceMatch = /^(?:```|~~~)([^\\s`~]+)?$/.exec(beforeCursor);'));
});

test("footnote extraction ignores content inside both fence styles", () => {
  assert.ok(footnotesSource.includes('const fenceMatch = /^(?<delimiter>`{3}|~{3})(?:[^\\s`~]+)?\\s*$/.exec(line);'));
  assert.ok(footnotesSource.includes('if (new RegExp(`^${fenceDelimiter}\\\\s*$`).test(line)) {'));
});
