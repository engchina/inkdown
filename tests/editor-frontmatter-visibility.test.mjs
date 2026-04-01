import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");

test("editor canvas excludes front matter but editor sync preserves existing YAML", () => {
  assert.match(appSource, /function renderMarkdownForEditor\(markdown, currentFilePath, outline\)\s*\{\s*const \{ body \} = extractYamlFrontMatter\(markdown\);/s);
  assert.match(appSource, /return decorateRenderedHtml\(container, outline, \{ enableCallouts: true \}\);/);
  assert.match(appSource, /serializeEditorHtmlToMarkdown\(instance\.getHTML\(\), frontMatterState\.raw\)/);
});
