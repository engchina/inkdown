import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");
const stylesSource = await fs.readFile(new URL("../src/renderer/styles/app.css", import.meta.url), "utf8");

test("editor pane surfaces block-level context and focus action", () => {
  assert.match(appSource, /const editorObjectContext = useMemo/);
  assert.match(appSource, /Heading \$\{selection\.\$from\.parent\.attrs\.level/);
  assert.match(appSource, /Code block/);
  assert.match(appSource, /Task item/);
  assert.match(appSource, /Focus Editor/);
  assert.match(appSource, /Rich Text/);
});

test("styles define editor pane header and action layout", () => {
  assert.match(stylesSource, /\.editor-pane-header-row \{/);
  assert.match(stylesSource, /\.editor-pane-actions \{/);
});
