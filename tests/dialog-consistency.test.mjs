import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const linkDialogSource = await fs.readFile(new URL("../src/renderer/components/LinkDialog.jsx", import.meta.url), "utf8");
const preferencesSource = await fs.readFile(new URL("../src/renderer/components/PreferencesDialog.jsx", import.meta.url), "utf8");
const mergeDialogSource = await fs.readFile(new URL("../src/renderer/components/FrontMatterMergeDialog.jsx", import.meta.url), "utf8");
const paletteSource = await fs.readFile(new URL("../src/renderer/components/CommandPalette.jsx", import.meta.url), "utf8");
const stylesSource = await fs.readFile(new URL("../src/renderer/styles/app.css", import.meta.url), "utf8");

test("primary dialogs share dialog header copy structure", () => {
  assert.match(linkDialogSource, /dialog-header-copy/);
  assert.match(preferencesSource, /dialog-header-copy/);
  assert.match(mergeDialogSource, /dialog-header-copy/);
  assert.match(stylesSource, /\.dialog-header-copy \{/);
  assert.match(stylesSource, /\.dialog-caption \{/);
});

test("command palette includes a title line and footer guidance", () => {
  assert.match(paletteSource, /command-palette-topline/);
  assert.match(paletteSource, /Command Palette/);
  assert.match(paletteSource, /command-palette-toolbar/);
  assert.match(paletteSource, /command-palette-scope-chip/);
  assert.match(paletteSource, /command-palette-footer/);
  assert.match(paletteSource, /command-palette-footer-selection/);
  assert.match(paletteSource, /Enter to run, arrows to move, Esc to close\./);
});

test("preferences exposes theme cards and section cards for final-product settings", () => {
  assert.match(preferencesSource, /preferences-theme-grid/);
  assert.match(preferencesSource, /preferences-layout/);
  assert.match(preferencesSource, /preferences-card/);
  assert.match(preferencesSource, /preferences-theme-card/);
  assert.match(preferencesSource, /Warm paper canvas/);
  assert.match(stylesSource, /\.preferences-layout \{/);
  assert.match(stylesSource, /\.preferences-card \{/);
  assert.match(stylesSource, /\.preferences-theme-grid \{/);
  assert.match(stylesSource, /\.preferences-theme-card \{/);
});
