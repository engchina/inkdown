import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { JSDOM } from "jsdom";
import { serializeHtmlToMarkdown } from "../src/renderer/utils/clipboardMarkdown.mjs";
import { serializeEditorHtmlToMarkdown } from "../src/renderer/utils/editorMarkdownSerializer.mjs";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");

function withDom(run) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousHTMLElement = globalThis.HTMLElement;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;

  try {
    return run(dom.window.document);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.HTMLElement = previousHTMLElement;
    dom.window.close();
  }
}

test("math blocks expose a dedicated math code-block language and preview state", () => {
  assert.ok(appSource.includes('{ value: "math", label: "Math" }'));
  assert.ok(appSource.includes('math: '));
  assert.ok(appSource.includes('\\\\frac{1}{3}'));
  assert.ok(appSource.includes('if (activeValue === "math") {'));
  assert.ok(appSource.includes('return { kind: "info", label: "Math preview" };'));
  assert.ok(appSource.includes('? renderMarkdownForPreview(`$$\\n${node.textContent || ""}\\n$$`, null, [])'));
});

test("editor math blocks trigger from $$ + Enter and load $$ source into math code blocks", () => {
  assert.ok(appSource.includes('function convertParagraphToMathBlock(view) {'));
  assert.ok(appSource.includes('const mathBlockMatch = /^\\$\\$/.exec(beforeCursor);'));
  assert.ok(appSource.includes('setHint("Math block. Backspace on empty block returns to paragraph.");'));
  assert.ok(appSource.includes('.replace(/(^|\\\\n)\\\\$\\\\$\\\\s*\\\\n([\\\\s\\\\S]*?)\\\\n\\\\$\\\\$(?=\\\\n|$)/g, "$1```math\\\\n$2\\\\n```")'));
});

test("HTML math code blocks serialize back to $$ math block syntax", () => {
  withDom(() => {
    const markdown = serializeHtmlToMarkdown('<pre><code class="language-math">x^2 + y^2</code></pre>');
    assert.equal(markdown.trim(), '$$\nx^2 + y^2\n$$');
  });
});

test("editor markdown serializer preserves math code blocks as $$ blocks", () => {
  withDom(() => {
    const markdown = serializeEditorHtmlToMarkdown('<pre><code data-language="math" class="language-math">x^2</code></pre>');
    assert.equal(markdown.trim(), '$$\nx^2\n$$');
  });
});


