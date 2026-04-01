import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");
const stylesSource = await fs.readFile(new URL("../src/renderer/styles/app.css", import.meta.url), "utf8");

test("editor pane shows next-step guidance for current block context", () => {
  assert.match(appSource, /const editorObjectGuidance = useMemo/);
  assert.match(appSource, /Enter creates a sibling heading/);
  assert.match(appSource, /Use the table toolbar above/);
  assert.match(appSource, /side-pane-guidance editor-pane-guidance/);
});

test("styles define a shared pane guidance line", () => {
  assert.match(stylesSource, /\.side-pane-guidance \{/);
  assert.match(stylesSource, /\.editor-pane-guidance \{/);
});
