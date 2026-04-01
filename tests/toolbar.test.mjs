import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const toolbarSource = await fs.readFile(new URL("../src/renderer/components/Toolbar.jsx", import.meta.url), "utf8");
const stylesSource = await fs.readFile(new URL("../src/renderer/styles/app.css", import.meta.url), "utf8");

test("toolbar exposes theme switching and direct save action in the app shell", () => {
  assert.match(toolbarSource, /toolbar-theme-switch/);
  assert.match(toolbarSource, /title="Save"/);
  assert.doesNotMatch(toolbarSource, /<ToolbarMenu label="Insert"/);
  assert.doesNotMatch(toolbarSource, /buildInsertMenuItems/);
});

test("toolbar keeps theme chips available for quick switching", () => {
  assert.match(toolbarSource, /const themeOptions = \[/);
  assert.match(toolbarSource, /\{ value: "paper", label: "Paper" \}/);
  assert.match(toolbarSource, /\{ value: "forest", label: "Forest" \}/);
  assert.match(toolbarSource, /\{ value: "midnight", label: "Midnight" \}/);
  assert.match(stylesSource, /\.toolbar-theme-switch \{/);
  assert.match(stylesSource, /\.toolbar-theme-chip \{/);
});

test("format toolbar carries the core insertion actions inline", () => {
  assert.match(toolbarSource, /title="Insert Link"/);
  assert.match(toolbarSource, /title="Insert Image"/);
  assert.match(toolbarSource, /title="Insert Table"/);
  assert.match(toolbarSource, /title="Horizontal Rule"/);
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

test("toolbar removes the previous writing mode box and menu-based insert trigger", () => {
  assert.doesNotMatch(toolbarSource, /toolbar-toggle-group-writing/);
  assert.doesNotMatch(toolbarSource, /title="Focus Mode"/);
  assert.doesNotMatch(toolbarSource, /title="Typewriter Mode"/);
  assert.doesNotMatch(toolbarSource, /aria-haspopup="menu"/);
  assert.doesNotMatch(toolbarSource, /aria-expanded=\{open\}/);
});
