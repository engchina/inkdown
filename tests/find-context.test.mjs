import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");
const findBarSource = await fs.readFile(new URL("../src/renderer/components/FindReplaceBar.jsx", import.meta.url), "utf8");
const statusSource = await fs.readFile(new URL("../src/renderer/components/StatusBar.jsx", import.meta.url), "utf8");
const stylesSource = await fs.readFile(new URL("../src/renderer/styles/app.css", import.meta.url), "utf8");

test("find bar and status bar receive active pane context", () => {
  assert.match(appSource, /<FindReplaceBar\s+activePane=\{activePane\}/);
  assert.match(appSource, /<StatusBar\s+activePane=\{activePane\}/);
  assert.match(appSource, /positionSummary=\{activePane === "source" \? sourceSelectionMeta\.statusLabel : null\}/);
  assert.match(findBarSource, /const activePaneLabel/);
  assert.match(statusSource, /const activePaneLabel/);
  assert.match(statusSource, /positionSummary/);
});

test("source and preview context route through toolbar state", () => {
  assert.match(appSource, /const toolbarContext = useMemo/);
  assert.match(appSource, /pane: "Source"/);
  assert.match(appSource, /pane: "Preview"/);
  assert.match(appSource, /sourceSelectionMeta\.statusLabel/);
  assert.match(appSource, /HTTP media blocked/);
});

test("styles define find summary chips and toolbar context actions", () => {
  assert.match(stylesSource, /\.find-bar-summary-chip \{/);
  assert.match(stylesSource, /\.find-scope-chip \{/);
  assert.match(stylesSource, /\.toolbar-context-actions \{/);
  assert.match(stylesSource, /\.toolbar-context-action \{/);
});
