import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { isSafeExternalUrl } = require("../src/main/utils/externalLinks.js");

test("isSafeExternalUrl allows supported protocols", () => {
  assert.equal(isSafeExternalUrl("https://inkdown.app"), true);
  assert.equal(isSafeExternalUrl("http://localhost:5173"), true);
  assert.equal(isSafeExternalUrl("mailto:test@example.com"), true);
});

test("isSafeExternalUrl rejects unsafe or malformed targets", () => {
  assert.equal(isSafeExternalUrl("javascript:alert(1)"), false);
  assert.equal(isSafeExternalUrl("file:///C:/Windows/System32/calc.exe"), false);
  assert.equal(isSafeExternalUrl("not a url"), false);
});
