import test from "node:test";
import assert from "node:assert/strict";
import {
  describeBlockedRemoteMedia,
  escapeHtml,
  sanitizePreviewSrcset,
  sanitizePreviewUrl
} from "../src/renderer/utils/previewSanitizer.mjs";

test("escapeHtml encodes markup-sensitive characters", () => {
  assert.equal(escapeHtml(`<tag attr="value">'&`), "&lt;tag attr=&quot;value&quot;&gt;&#39;&amp;");
});

test("describeBlockedRemoteMedia returns intentional placeholder copy", () => {
  assert.deepEqual(describeBlockedRemoteMedia("img", "http://example.com/a.png"), {
    title: "Blocked insecure remote image",
    detail: "HTTP image is disabled by current security settings."
  });
});

test("sanitizePreviewUrl keeps safe preview schemes and relative URLs", () => {
  assert.equal(sanitizePreviewUrl("https://inkdown.app/docs"), "https://inkdown.app/docs");
  assert.equal(sanitizePreviewUrl("./images/example.png"), "./images/example.png");
  assert.equal(sanitizePreviewUrl("#section-1"), "#section-1");
});

test("sanitizePreviewUrl blocks insecure http resources when requested", () => {
  assert.equal(sanitizePreviewUrl("http://insecure.example/image.png", { allowHttpUrls: false }), "");
  assert.equal(sanitizePreviewUrl("http://example.com", { allowHttpUrls: true }), "http://example.com");
});

test("sanitizePreviewUrl strips scriptable schemes and obfuscated javascript URLs", () => {
  assert.equal(sanitizePreviewUrl("javascript:alert(1)"), "");
  assert.equal(sanitizePreviewUrl(" java\nscript:alert(1) "), "");
  assert.equal(sanitizePreviewUrl("data:text/html,<script>alert(1)</script>"), "");
});

test("sanitizePreviewUrl only allows opted-in local asset schemes", () => {
  assert.equal(sanitizePreviewUrl("inkdown-asset://local/path"), "");
  assert.equal(sanitizePreviewUrl("inkdown-asset://local/path", { allowAssetUrls: true }), "inkdown-asset://local/path");
  assert.equal(sanitizePreviewUrl("file:///C:/notes/image.png"), "");
  assert.equal(sanitizePreviewUrl("file:///C:/notes/image.png", { allowFileUrls: true }), "file:///C:/notes/image.png");
  assert.equal(sanitizePreviewUrl("data:image/png;base64,AAAA", { allowDataImageUrls: true }), "data:image/png;base64,AAAA");
});

test("sanitizePreviewSrcset keeps only allowed image candidates", () => {
  assert.equal(
    sanitizePreviewSrcset("https://safe.example/a.png 1x, http://unsafe.example/b.png 2x", { allowHttpUrls: false }),
    "https://safe.example/a.png 1x"
  );
});
