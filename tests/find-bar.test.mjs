import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const findBarSource = await fs.readFile(new URL("../src/renderer/components/FindReplaceBar.jsx", import.meta.url), "utf8");
const stylesSource = await fs.readFile(new URL("../src/renderer/styles/app.css", import.meta.url), "utf8");

test("find bar groups query, replace, and action controls", () => {
  assert.match(findBarSource, /find-bar-query-group/);
  assert.match(findBarSource, /find-bar-replace-group/);
  assert.match(findBarSource, /find-bar-actions/);
  assert.match(findBarSource, /find-bar-action-set/);
});

test("find bar exposes explicit field labels and replace-all wording", () => {
  assert.match(findBarSource, /find-bar-label">Find</);
  assert.match(findBarSource, /find-bar-label">Replace</);
  assert.match(findBarSource, /Replace All/);
});

test("styles define structured find bar layout and responsive stacking", () => {
  assert.match(stylesSource, /\.find-bar-group \{/);
  assert.match(stylesSource, /\.find-bar-field \{/);
  assert.match(stylesSource, /\.find-bar-actions \{/);
  assert.match(stylesSource, /@media \(max-width: 560px\)/);
});
