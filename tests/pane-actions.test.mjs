import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");
const previewSource = await fs.readFile(new URL("../src/renderer/components/MarkdownPreview.jsx", import.meta.url), "utf8");
const stylesSource = await fs.readFile(new URL("../src/renderer/styles/app.css", import.meta.url), "utf8");

test("source and preview panes expose lightweight toolbar actions", () => {
  assert.match(appSource, /const toolbarContextActions = useMemo/);
  assert.match(appSource, /Copy HTML/);
  assert.match(appSource, /Allow HTTP Media/);
  assert.match(appSource, /Block HTTP Media/);
  assert.match(appSource, /edit-link/);
  assert.match(appSource, /replace-image/);
});

test("preview component notifies the app when the preview is interacted with", () => {
  assert.match(previewSource, /onActivate = null/);
  assert.match(previewSource, /onActivate\?\.\(\)/);
});

test("styles define toolbar action button treatments used by side panes", () => {
  assert.match(stylesSource, /\.toolbar-context-actions \{/);
  assert.match(stylesSource, /\.toolbar-context-action \{/);
  assert.match(stylesSource, /\.toolbar-context-action:hover \{/);
});
