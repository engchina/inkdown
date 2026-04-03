import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { annotateInlineMarkdownTokens } from "../src/renderer/utils/inlineMarkdownTokens.mjs";
import { serializeEditorHtmlToMarkdown } from "../src/renderer/utils/editorMarkdownSerializer.mjs";

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

test("inline token annotation preserves raw nested emphasis delimiters", () => {
  withDom((document) => {
    const container = document.createElement("div");
    container.innerHTML = "<p><strong><em>abc</em></strong></p>";
    annotateInlineMarkdownTokens(container, "***abc***");

    const strong = container.querySelector("strong");
    const em = container.querySelector("em");
    assert.equal(strong?.getAttribute("data-md-open-token"), "**");
    assert.equal(strong?.getAttribute("data-md-close-token"), "**");
    assert.equal(em?.getAttribute("data-md-open-token"), "*");
    assert.equal(em?.getAttribute("data-md-close-token"), "*");
  });
});

test("inline token annotation preserves mixed emphasis delimiters", () => {
  withDom((document) => {
    const container = document.createElement("div");
    container.innerHTML = "<p><strong><em>abc</em></strong></p>";
    annotateInlineMarkdownTokens(container, "**_abc_**");

    const strong = container.querySelector("strong");
    const em = container.querySelector("em");
    assert.equal(strong?.getAttribute("data-md-open-token"), "**");
    assert.equal(em?.getAttribute("data-md-open-token"), "_");
    assert.equal(em?.getAttribute("data-md-close-token"), "_");
  });
});

test("editor markdown serializer keeps triple emphasis without backslash escapes", () => {
  withDom(() => {
    const markdown = serializeEditorHtmlToMarkdown(
      '<p><strong data-md-open-token="**" data-md-close-token="**"><em data-md-open-token="*" data-md-close-token="*">abc</em></strong></p>'
    );
    assert.equal(markdown.trim(), "***abc***");
    assert.doesNotMatch(markdown, /\\\*/);
  });
});

test("editor markdown serializer preserves strikethrough delimiters", () => {
  withDom(() => {
    const markdown = serializeEditorHtmlToMarkdown('<p><del data-md-open-token="~~" data-md-close-token="~~">Mistaken text.</del></p>');
    assert.equal(markdown.trim(), "~~Mistaken text.~~");
  });
});
test("editor markdown serializer preserves underscore strong delimiters", () => {
  withDom(() => {
    const markdown = serializeEditorHtmlToMarkdown('<p><strong data-md-open-token="__" data-md-close-token="__">abc</strong></p>');
    assert.equal(markdown.trim(), "__abc__");
  });
});
test("editor markdown serializer keeps nested emphasis inside links", () => {
  withDom(() => {
    const markdown = serializeEditorHtmlToMarkdown(
      '<p><a href="https://example.com" data-md-open-token="[" data-md-close-token="](https://example.com)"><strong data-md-open-token="**" data-md-close-token="**">x</strong></a></p>'
    );
    assert.equal(markdown.trim(), "[**x**](https://example.com)");
    assert.doesNotMatch(markdown, /\\\[/);
    assert.doesNotMatch(markdown, /\\\*/);
  });
});

test("editor markdown serializer preserves raw inline emphasis typed as plain text", () => {
  withDom(() => {
    const markdown = serializeEditorHtmlToMarkdown("<p>***abc***</p>");
    assert.equal(markdown.trim(), "***abc***");
    assert.doesNotMatch(markdown, /\\\*/);
  });
});

test("editor markdown serializer preserves raw inline links typed as plain text", () => {
  withDom(() => {
    const markdown = serializeEditorHtmlToMarkdown("<p>[abc](https://example.com)</p>");
    assert.equal(markdown.trim(), "[abc](https://example.com)");
    assert.doesNotMatch(markdown, /\\\[/);
  });
});

test("editor markdown serializer preserves hard break markdown tokens", () => {
  withDom(() => {
    const markdown = serializeEditorHtmlToMarkdown("<p>line 1<br>line 2</p>");
    assert.equal(markdown, "line 1  \nline 2");
  });
});


