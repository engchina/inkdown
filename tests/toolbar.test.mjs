import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const toolbarSource = await fs.readFile(new URL("../src/renderer/components/Toolbar.jsx", import.meta.url), "utf8");
const stylesSource = await fs.readFile(new URL("../src/renderer/styles/app.css", import.meta.url), "utf8");

test("toolbar exposes file and insert menus in the app shell", () => {
  assert.match(toolbarSource, /buildFileMenuItems/);
  assert.match(toolbarSource, /buildInsertMenuItems/);
  assert.match(toolbarSource, /<ToolbarMenu label="File"/);
  assert.match(toolbarSource, /<ToolbarMenu label="Insert"/);
});

test("file menu includes key document actions", () => {
  assert.match(toolbarSource, /label: "New Document"/);
  assert.match(toolbarSource, /label: "Open Document"/);
  assert.match(toolbarSource, /label: "Save As"/);
  assert.match(toolbarSource, /label: "Export HTML"/);
  assert.match(toolbarSource, /label: "Export PDF"/);
  assert.match(toolbarSource, /label: "Preferences"/);
});

test("insert menu includes core object insertion actions", () => {
  assert.match(toolbarSource, /label: "Insert Link"/);
  assert.match(toolbarSource, /label: "Insert Image"/);
  assert.match(toolbarSource, /label: "Insert Table"/);
  assert.match(toolbarSource, /label: "Horizontal Rule"/);
  assert.match(toolbarSource, /label: "Code Block"/);
});

test("format toolbar groups commands by writing task", () => {
  assert.match(toolbarSource, /<ToolbarSection title="Text"/);
  assert.match(toolbarSource, /<ToolbarSection title="Blocks"/);
  assert.match(toolbarSource, /<ToolbarSection title="Structure"/);
  assert.match(toolbarSource, /<ToolbarSection title="Insert"/);
  assert.match(toolbarSource, /<ToolbarSection title="Review"/);
});

test("toolbar separates utility and mode controls for responsive layout", () => {
  assert.match(toolbarSource, /document-toolbar-utility/);
  assert.match(toolbarSource, /document-toolbar-modes/);
  assert.match(stylesSource, /\.document-toolbar-utility,/);
  assert.match(stylesSource, /@media \(max-width: 1024px\)/);
  assert.match(stylesSource, /\.format-toolbar \{\s*min-height: 64px;/);
});

test("toolbar supports contextual emphasis and current context pill", () => {
  assert.match(toolbarSource, /resolveToolbarSectionEmphasis/);
  assert.match(toolbarSource, /toolbar-context-pill/);
  assert.match(toolbarSource, /toolbar-context-actions/);
  assert.match(stylesSource, /\.toolbar-section\.active \{/);
  assert.match(stylesSource, /\.toolbar-context-pill \{/);
  assert.match(stylesSource, /\.toolbar-context-action \{/);
});

test("toolbar menus expose keyboard and aria affordances", () => {
  assert.match(toolbarSource, /aria-haspopup="menu"/);
  assert.match(toolbarSource, /aria-expanded=\{open\}/);
  assert.match(toolbarSource, /handleTriggerKeyDown/);
  assert.match(toolbarSource, /handleMenuKeyDown/);
});
