import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { sanitizePreviewHtml } from "../src/renderer/utils/previewSanitizer.mjs";
import {
  applyFootnoteReferences,
  buildFootnotesElement,
  decorateFootnoteReferences,
  extractFootnotes
} from "../src/renderer/utils/footnotes.mjs";

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

test("sanitizePreviewHtml renders a visible placeholder for blocked HTTP images", () => {
  withDom(() => {
    const html = sanitizePreviewHtml('<p>Before</p><img src="http://insecure.example/cat.png" alt="cat" /><p>After</p>');
    assert.match(html, /remote-media-placeholder/);
    assert.match(html, /Blocked insecure remote image/);
    assert.match(html, /HTTP image is disabled by current security settings\./);
    assert.match(html, /remote-media-placeholder-link/);
    assert.match(html, /href="http:\/\/insecure\.example\/cat\.png"/);
    assert.doesNotMatch(html, /<img[^>]+http:\/\/insecure\.example/);
  });
});

test("sanitizePreviewHtml keeps HTTP media when the preference explicitly allows it", () => {
  withDom(() => {
    const html = sanitizePreviewHtml('<img src="http://insecure.example/cat.png" alt="cat" />', {
      allowInsecureRemoteMedia: true
    });
    assert.match(html, /<img[^>]+src="http:\/\/insecure\.example\/cat\.png"/);
    assert.doesNotMatch(html, /remote-media-placeholder/);
  });
});

test("sanitizePreviewHtml replaces blocked audio with a placeholder and open link", () => {
  withDom(() => {
    const html = sanitizePreviewHtml('<audio controls src="http://insecure.example/theme.mp3"></audio>');
    assert.match(html, /Blocked insecure remote audio/);
    assert.match(html, /href="http:\/\/insecure\.example\/theme\.mp3"/);
    assert.doesNotMatch(html, /<audio/);
  });
});

test("sanitizePreviewHtml preserves explicit HTTP links while still blocking media", () => {
  withDom(() => {
    const html = sanitizePreviewHtml('<a href="http://example.com">Open</a><img src="http://example.com/a.png" />');
    assert.match(html, /<a href="http:\/\/example\.com">Open<\/a>/);
    assert.match(html, /Blocked insecure remote image/);
  });
});

test("footnote references get stable numbering and unique back reference targets", () => {
  const definitions = new Map([["same", "Repeated footnote"]]);
  const { body, order, references } = applyFootnoteReferences(
    "alpha[^same] beta[^same]",
    definitions,
    (value, transform) => transform(value)
  );

  assert.deepEqual(order, ["same"]);
  assert.deepEqual(references.get("same"), ["fnref-same", "fnref-same-2"]);
  assert.match(body, /id="fnref-same"/);
  assert.match(body, /id="fnref-same-2"/);
  assert.match(body, /href="#fn-same"/);
});

test("footnote rendering appends backrefs and hover text without an extra title block", () => {
  withDom((documentRef) => {
    const markdown = [
      "This is a footnote[^fn1] and the same footnote again[^fn1].",
      "",
      "[^fn1]: Here is the *text* of the footnote."
    ].join("\n");
    const { body: withoutFootnotes, definitions } = extractFootnotes(markdown);
    const { body, order, references } = applyFootnoteReferences(
      withoutFootnotes,
      definitions,
      (value, transform) => transform(value)
    );

    const container = documentRef.createElement("div");
    container.innerHTML = `<p>${body}</p>`;
    const footnotes = buildFootnotesElement(
      definitions,
      order,
      references,
      (value) => `<p>${value.replace(/\*([^*]+)\*/g, "<em>$1</em>")}</p>`,
      documentRef
    );
    container.appendChild(footnotes);
    decorateFootnoteReferences(container);

    assert.equal(container.querySelector(".footnotes-title"), null);
    assert.equal(container.querySelectorAll(".footnote-ref").length, 2);
    assert.equal(container.querySelectorAll(".footnote-backref").length, 2);
    assert.match(container.querySelector(".footnotes li").innerHTML, /<p>Here is the <em>text<\/em> of the footnote\. <span class="footnote-backrefs">/);

    const referenceLinks = Array.from(container.querySelectorAll(".footnote-ref a"));
    assert.equal(referenceLinks[0].getAttribute("title"), "Here is the text of the footnote.");
    assert.equal(referenceLinks[0].getAttribute("aria-label"), "Footnote 1: Here is the text of the footnote.");
    assert.equal(referenceLinks[1].getAttribute("href"), "#fn-fn1");
  });
});
