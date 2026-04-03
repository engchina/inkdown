import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const toolbarSource = await fs.readFile(new URL("../src/renderer/components/Toolbar.jsx", import.meta.url), "utf8");
const stylesSource = await fs.readFile(new URL("../src/renderer/styles/app.css", import.meta.url), "utf8");

test("toolbar exposes utility actions in the app shell", () => {
  assert.match(toolbarSource, /toolbar-section-utility/);
  assert.match(toolbarSource, /title="Save"/);
  assert.match(toolbarSource, /title="Command Palette"/);
  assert.doesNotMatch(toolbarSource, /<ToolbarMenu label="Insert"/);
  assert.doesNotMatch(toolbarSource, /buildInsertMenuItems/);
});

test("format toolbar carries the core insertion actions inline", () => {
  assert.match(toolbarSource, /title="Insert Link"/);
  assert.match(toolbarSource, /title="Insert Image"/);
  assert.match(toolbarSource, /title="Insert Table"/);
  assert.match(toolbarSource, /title="Horizontal Rule"/);
});

test("format toolbar exposes heading levels one through six inline", () => {
  assert.match(toolbarSource, /title="Heading 1"/);
  assert.match(toolbarSource, /title="Heading 2"/);
  assert.match(toolbarSource, /title="Heading 3"/);
  assert.match(toolbarSource, /title="Heading 4"/);
  assert.match(toolbarSource, /title="Heading 5"/);
  assert.match(toolbarSource, /title="Heading 6"/);
});

test("format toolbar groups commands by writing task", () => {
  assert.match(toolbarSource, /<ToolbarSection title="Text"/);
  assert.match(toolbarSource, /<ToolbarSection title="Blocks"/);
  assert.match(toolbarSource, /<ToolbarSection title="Structure"/);
  assert.match(toolbarSource, /<ToolbarSection title="Insert"/);
  assert.match(toolbarSource, /<ToolbarSection title="Review"/);
});

test("toolbar keeps utility and contextual sections responsive", () => {
  assert.match(toolbarSource, /toolbar-section-utility/);
  assert.match(toolbarSource, /toolbar-context-actions/);
  assert.match(stylesSource, /@media \(max-width: 1024px\)/);
  assert.match(stylesSource, /\.format-toolbar \{/);
  assert.match(stylesSource, /\.toolbar-section \{/);
});

test("toolbar supports contextual emphasis and action pills", () => {
  assert.match(toolbarSource, /resolveToolbarSectionEmphasis/);
  assert.match(toolbarSource, /toolbar-context-actions/);
  assert.match(stylesSource, /\.toolbar-section\.active \{/);
  assert.match(stylesSource, /\.toolbar-context-actions \{/);
  assert.match(stylesSource, /\.toolbar-context-action \{/);
});

test("toolbar removes the previous writing mode box and menu-based insert trigger", () => {
  assert.doesNotMatch(toolbarSource, /toolbar-toggle-group-writing/);
  assert.doesNotMatch(toolbarSource, /title="Focus Mode"/);
  assert.doesNotMatch(toolbarSource, /title="Typewriter Mode"/);
  assert.doesNotMatch(toolbarSource, /aria-haspopup="menu"/);
  assert.doesNotMatch(toolbarSource, /aria-expanded=\{open\}/);
});
