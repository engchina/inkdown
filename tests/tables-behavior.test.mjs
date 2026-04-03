import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { JSDOM } from "jsdom";
import { serializeHtmlToMarkdown } from "../src/renderer/utils/clipboardMarkdown.mjs";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");

function withDom(run) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  try {
    return run(dom.window.document);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    dom.window.close();
  }
}

test("editor and source both support header-row Enter to create tables", () => {
  assert.ok(appSource.includes("buildMarkdownTableCreationFromHeader(markdownText, textarea.selectionStart ?? 0, textarea.selectionEnd ?? textarea.selectionStart ?? 0)"));
  assert.ok(appSource.includes("const tableHeaders = parseMarkdownTableHeaderCells(parent.textContent);"));
  assert.ok(appSource.includes("function convertParagraphToMarkdownTable(view, headerCells) {"));
  assert.ok(appSource.includes("setHint(`Table with ${tableHeaders.length} columns.`);"));
});

test("table markdown serialization preserves alignment markers and inline markdown", () => {
  withDom(() => {
    const markdown = serializeHtmlToMarkdown('<table><thead><tr><th data-align="left"><strong>A</strong></th><th data-align="center"><em>B</em></th><th data-align="right"><a href="https://e.com">C</a></th></tr></thead><tbody><tr><td data-align="left">x</td><td data-align="center">y</td><td data-align="right">z</td></tr></tbody></table>');
    assert.equal(markdown.trim(), '| **A** | *B* | [C](https://e.com) |\n| --- | :---: | ---: |\n| x | y | z |');
  });
});
