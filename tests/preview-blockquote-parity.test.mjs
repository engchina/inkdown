import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const stylesSource = await fs.readFile(new URL("../src/renderer/styles/app.css", import.meta.url), "utf8");
const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");

test("editor and preview surfaces share the same blockquote presentation", () => {
  assert.match(
    stylesSource,
    /\.editor-surface blockquote:not\(.callout\),\s*\.preview-surface blockquote:not\(.callout\) \{\s*min-height: 1\.6em;[\s\S]*?padding: 0\.55em 0 0\.55em 1\.1em;[\s\S]*?border-left: 3px solid var\(--quote-border\);[\s\S]*?border-radius: 0 14px 14px 0;[\s\S]*?background: linear-gradient\(90deg, var\(--quote-bg\) 0%, transparent 82%\);[\s\S]*?color: var\(--quote\);/s
  );
  assert.match(
    stylesSource,
    /\.editor-surface blockquote:not\(.callout\) p,\s*\.preview-surface blockquote:not\(.callout\) p \{\s*margin: 0\.45em 0;\s*\}/s
  );
  assert.match(
    stylesSource,
    /\.editor-surface blockquote\.callout,\s*\.preview-surface blockquote\.callout \{\s*min-height: 1\.6em;[\s\S]*?padding: 0\.55em 0 0\.55em 1\.1em;[\s\S]*?border-left: 3px solid var\(--quote-border\);[\s\S]*?border-radius: 0 14px 14px 0;[\s\S]*?background: linear-gradient\(90deg, var\(--quote-bg\) 0%, transparent 82%\);[\s\S]*?box-shadow: none;[\s\S]*?color: var\(--quote\);/s
  );
  assert.match(
    stylesSource,
    /\.editor-surface blockquote\.callout::before,\s*\.preview-surface blockquote\.callout::before \{\s*display: none;\s*\}/s
  );
  assert.match(
    stylesSource,
    /\.editor-surface blockquote\.callout \.callout-title,\s*\.preview-surface blockquote\.callout \.callout-title \{\s*display: block;[\s\S]*?margin: 0\.45em 0;[\s\S]*?font-size: inherit;[\s\S]*?font-weight: inherit;[\s\S]*?color: inherit;\s*\}/s
  );
});

test("standalone preview html keeps the same refreshed blockquote styling as the editor", () => {
  assert.match(appSource, /const blockquoteBorderColor =/);
  assert.match(appSource, /const blockquoteBackground =/);
  assert.match(appSource, /const blockquoteTextColor =/);
  assert.match(
    appSource,
    /blockquote:not\(.callout\) \{\s*min-height: 1\.6em;[\s\S]*?padding: 0\.55em 0 0\.55em 1\.1em;[\s\S]*?border-left: 3px solid \$\{blockquoteBorderColor\};[\s\S]*?border-radius: 0 14px 14px 0;[\s\S]*?background: \$\{blockquoteBackground\};[\s\S]*?color: \$\{blockquoteTextColor\};/s
  );
  assert.match(appSource, /blockquote:not\(.callout\) p \{ margin: 0\.45em 0; \}/);
});

