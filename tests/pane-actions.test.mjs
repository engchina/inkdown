import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");
const previewSource = await fs.readFile(new URL("../src/renderer/components/MarkdownPreview.jsx", import.meta.url), "utf8");
const stylesSource = await fs.readFile(new URL("../src/renderer/styles/app.css", import.meta.url), "utf8");

test("source and preview pane headers expose lightweight context actions", () => {
  assert.match(appSource, /Focus Source/);
  assert.match(appSource, /Copy HTML/);
  assert.match(appSource, /HTTP Media Off/);
  assert.match(appSource, /side-pane-actions/);
});

test("preview component notifies the app when the preview is interacted with", () => {
  assert.match(previewSource, /onActivate = null/);
  assert.match(previewSource, /onActivate\?\.\(\)/);
});

test("styles define side pane action button treatments", () => {
  assert.match(stylesSource, /\.side-pane-actions \{/);
  assert.match(stylesSource, /\.side-pane-action-button \{/);
  assert.match(stylesSource, /\.side-pane-action-button:hover,/);
});
