import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { activatePreviewLink, findPreviewAnchorTarget } from "../src/renderer/utils/previewLinks.mjs";

function createDom(html) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root">${html}</div></body></html>`);
  return { dom, root: dom.window.document.getElementById("root") };
}

test("findPreviewAnchorTarget resolves hash targets inside the preview container", () => {
  const { dom, root } = createDom('<a href="#section-1">Jump</a><h2 id="section-1">Section</h2>');
  try {
    const target = findPreviewAnchorTarget(root, "#section-1");
    assert.equal(target?.id, "section-1");
  } finally {
    dom.window.close();
  }
});

test("activatePreviewLink scrolls to internal anchors and marks the target", async () => {
  const { dom, root } = createDom('<a href="#section-1">Jump</a><h2 id="section-1">Section</h2>');
  try {
    const anchor = root.querySelector("a");
    const target = root.querySelector("#section-1");
    let scrolled = false;
    target.scrollIntoView = () => {
      scrolled = true;
    };

    const result = await activatePreviewLink(anchor, root, { windowObject: dom.window });
    assert.equal(result.kind, "hash");
    assert.equal(scrolled, true);
    assert.equal(target.classList.contains("preview-anchor-target"), true);
  } finally {
    dom.window.close();
  }
});

test("activatePreviewLink routes external links through the provided opener", async () => {
  const { dom, root } = createDom('<a href="https://example.com">Open</a>');
  try {
    const anchor = root.querySelector("a");
    let opened = "";
    const result = await activatePreviewLink(anchor, root, {
      openExternal: async (href) => {
        opened = href;
      },
      windowObject: dom.window
    });
    assert.equal(result.kind, "external");
    assert.equal(opened, "https://example.com/");
  } finally {
    dom.window.close();
  }
});
