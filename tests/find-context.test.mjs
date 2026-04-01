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

test("source and preview headers render contextual chips", () => {
  assert.match(appSource, /side-pane-header-row/);
  assert.match(appSource, /side-pane-chip/);
  assert.match(appSource, /sourceSelectionMeta\.lineLabel/);
  assert.match(appSource, /sourceSelectionMeta\.columnLabel/);
  assert.match(appSource, /HTTP Media Blocked/);
});

test("styles define pane header chips and find scope chip", () => {
  assert.match(stylesSource, /\.side-pane-header-row \{/);
  assert.match(stylesSource, /\.side-pane-chip \{/);
  assert.match(stylesSource, /\.side-pane-chip\.position-chip,/);
  assert.match(stylesSource, /\.find-scope-chip \{/);
});
