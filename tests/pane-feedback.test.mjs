import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");
const stylesSource = await fs.readFile(new URL("../src/renderer/styles/app.css", import.meta.url), "utf8");

test("app marks active panes in split editing layouts", () => {
  assert.match(appSource, /const \[activePane, setActivePane\]/);
  assert.match(appSource, /className=\{`editor-pane.*pane-active/);
  assert.match(appSource, /className=\{`side-pane source-pane\$\{activePane === "source"/);
  assert.match(appSource, /className=\{`side-pane preview-pane\$\{activePane === "preview"/);
});

test("styles define focused pane treatments for editor, source, and preview", () => {
  assert.match(stylesSource, /\.editor-pane\.pane-active \.paper \{/);
  assert.match(stylesSource, /\.side-pane\.pane-active \{/);
  assert.match(stylesSource, /\.side-pane\.pane-active \.side-pane-header \{/);
  assert.match(stylesSource, /\.source-pane\.pane-active \.source-editor-shell,/);
});
