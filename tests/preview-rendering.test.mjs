import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { sanitizePreviewHtml } from "../src/renderer/utils/previewSanitizer.mjs";

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
