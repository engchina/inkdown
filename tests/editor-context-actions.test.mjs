import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");
const stylesSource = await fs.readFile(new URL("../src/renderer/styles/app.css", import.meta.url), "utf8");

test("editor pane surfaces block-level context and toolbar context", () => {
  assert.match(appSource, /const editorObjectContext = useMemo/);
  assert.match(appSource, /Heading \$\{selection\.\$from\.parent\.attrs\.level/);
  assert.match(appSource, /Code block/);
  assert.match(appSource, /Task item/);
  assert.match(appSource, /pane: "Editor"/);
  assert.match(appSource, /label: editorObjectContext\?\.label \|\| "Paragraph"/);
});

test("styles define toolbar context action layout", () => {
  assert.match(stylesSource, /\.toolbar-context-actions \{/);
  assert.match(stylesSource, /\.toolbar-context-action \{/);
});
