import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const indexHtml = await fs.readFile(new URL("../index.html", import.meta.url), "utf8");
const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");
const mainSource = await fs.readFile(new URL("../src/main/main.js", import.meta.url), "utf8");
const preloadSource = await fs.readFile(new URL("../src/preload/preload.js", import.meta.url), "utf8");

test("index.html CSP blocks remote font dependencies and broad network access", () => {
  assert.match(indexHtml, /form-action 'none';/);
  assert.match(indexHtml, /style-src 'self' 'unsafe-inline';/);
  assert.match(indexHtml, /font-src 'self' data:;/);
  assert.match(indexHtml, /img-src 'self' data: blob: http: https: inkdown-asset:;/);
  assert.match(indexHtml, /media-src 'self' data: blob: http: https: inkdown-asset:;/);
  assert.match(indexHtml, /connect-src 'self' ws:\/\/127\.0\.0\.1:5173 http:\/\/127\.0\.0\.1:5173 ws:\/\/localhost:5173 http:\/\/localhost:5173;/);
  assert.doesNotMatch(indexHtml, /connect-src[^\n]*https:/);
  assert.doesNotMatch(indexHtml, /frame-ancestors 'none';/);
});

test("index.html no longer depends on remote Google Fonts", () => {
  assert.doesNotMatch(indexHtml, /fonts\.googleapis\.com/);
  assert.doesNotMatch(indexHtml, /fonts\.gstatic\.com/);
});

test("remote media preference allows HTTP media by default in renderer and main defaults", () => {
  assert.match(appSource, /allowInsecureRemoteMedia: true/);
  assert.match(mainSource, /allowInsecureRemoteMedia: true/);
});

test("renderer threads remote media policy through preview and export paths", () => {
  assert.match(appSource, /sanitizeOptions=\{previewSanitizeOptions\}/);
  assert.match(appSource, /renderPreviewHtml\(standalonePreviewHtml, preferences\.theme, previewSanitizeOptions\)/);
  assert.match(appSource, /renderPreviewHtml\(printablePreviewHtml, preferences\.theme, previewSanitizeOptions\)/);
});

test("prompt-based editing interactions are removed from the app shell", () => {
  assert.doesNotMatch(appSource, /window\.prompt\(/);
});

test("preload resolves file urls without depending on node:url conversion helpers", () => {
  assert.match(preloadSource, /function toFileSystemUrl\(filePath\)/);
  assert.match(preloadSource, /function fromFileSystemUrl\(fileUrl\)/);
  assert.doesNotMatch(preloadSource, /pathToFileURL/);
  assert.doesNotMatch(preloadSource, /fileURLToPath/);
});



