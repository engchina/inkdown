import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getEventSenderUrl, isAllowedRendererUrl, isTrustedIpcSender } = require("../src/main/utils/rendererTrust.js");

const trustOptions = {
  devServerUrl: "http://127.0.0.1:5173",
  productionAppUrl: "file:///E:/workspace/inkdown/dist/index.html"
};

test("isAllowedRendererUrl accepts the configured dev origin and production entry URL", () => {
  assert.equal(isAllowedRendererUrl("http://127.0.0.1:5173/", trustOptions), true);
  assert.equal(isAllowedRendererUrl("http://127.0.0.1:5173/editor", trustOptions), true);
  assert.equal(isAllowedRendererUrl("file:///E:/workspace/inkdown/dist/index.html", trustOptions), true);
});

test("isAllowedRendererUrl rejects unrelated origins and file URLs", () => {
  assert.equal(isAllowedRendererUrl("https://example.com", trustOptions), false);
  assert.equal(isAllowedRendererUrl("file:///C:/temp/other.html", trustOptions), false);
  assert.equal(isAllowedRendererUrl("javascript:alert(1)", trustOptions), false);
});

test("getEventSenderUrl prefers senderFrame url and falls back to webContents url", () => {
  assert.equal(getEventSenderUrl({ senderFrame: { url: "http://127.0.0.1:5173/" } }), "http://127.0.0.1:5173/");
  assert.equal(getEventSenderUrl({ sender: { getURL: () => "file:///E:/workspace/inkdown/dist/index.html" } }), "file:///E:/workspace/inkdown/dist/index.html");
});

test("isTrustedIpcSender only accepts configured renderer senders", () => {
  assert.equal(isTrustedIpcSender({ senderFrame: { url: "http://127.0.0.1:5173/" } }, trustOptions), true);
  assert.equal(isTrustedIpcSender({ senderFrame: { url: "https://evil.example" } }, trustOptions), false);
});
