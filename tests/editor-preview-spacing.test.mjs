import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const stylesSource = await fs.readFile(new URL("../src/renderer/styles/app.css", import.meta.url), "utf8");

test("editor spacing matches preview bottom rhythm more closely", () => {
  assert.match(stylesSource, /\.editor-end-hitbox \{\s*min-height: 18px;/s);
  assert.match(stylesSource, /\.editor-surface > :last-child \{\s*margin-bottom: 0;/s);
  assert.match(stylesSource, /\.editor-surface h1,[\s\S]*?margin: var\(--content-heading-gap-top\) 0 var\(--content-heading-gap-bottom\);/);
});
