import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { applyPreviewSearchHighlights, clearPreviewSearchHighlights } from "../src/renderer/utils/previewSearch.mjs";

function withDom(run) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousNode = globalThis.Node;
  const previousNodeFilter = globalThis.NodeFilter;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Node = dom.window.Node;
  globalThis.NodeFilter = dom.window.NodeFilter;

  try {
    return run(dom.window.document);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.Node = previousNode;
    globalThis.NodeFilter = previousNodeFilter;
    dom.window.close();
  }
}

test("applyPreviewSearchHighlights highlights visible preview text and marks the current result", () => {
  withDom((document) => {
    const container = document.createElement("div");
    container.innerHTML = "<p>alpha beta alpha</p>";
    const result = applyPreviewSearchHighlights(container, "alpha", 1);
    assert.equal(result.count, 2);
    assert.equal(container.querySelectorAll(".preview-find-hit").length, 2);
    assert.equal(container.querySelectorAll(".preview-find-hit.current").length, 1);
  });
});

test("applyPreviewSearchHighlights skips code blocks", () => {
  withDom((document) => {
    const container = document.createElement("div");
    container.innerHTML = "<p>alpha</p><pre><code>alpha</code></pre>";
    const result = applyPreviewSearchHighlights(container, "alpha", 0);
    assert.equal(result.count, 1);
    assert.equal(container.querySelectorAll("pre .preview-find-hit").length, 0);
  });
});

test("clearPreviewSearchHighlights restores plain text", () => {
  withDom((document) => {
    const container = document.createElement("div");
    container.innerHTML = "<p>alpha beta</p>";
    applyPreviewSearchHighlights(container, "alpha", 0);
    clearPreviewSearchHighlights(container);
    assert.equal(container.querySelectorAll(".preview-find-hit").length, 0);
    assert.match(container.textContent, /alpha beta/);
  });
});
