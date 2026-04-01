import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildIoErrorMessage, describeIoError } = require("../src/main/utils/ioErrors.js");

test("describeIoError maps common filesystem failures to readable messages", () => {
  assert.equal(describeIoError({ code: "EACCES" }), "Permission was denied.");
  assert.equal(describeIoError({ code: "EBUSY" }), "The file is busy in another application.");
  assert.equal(describeIoError({ code: "ENOSPC" }), "The disk is full.");
});

test("buildIoErrorMessage includes the action and target file name", () => {
  assert.equal(
    buildIoErrorMessage("save document", { code: "EACCES" }, "E:/notes/chapter.md"),
    "Could not save document chapter.md. Permission was denied."
  );
});

test("buildIoErrorMessage falls back to the original error message when no mapping exists", () => {
  assert.equal(
    buildIoErrorMessage("export PDF", { message: "Renderer crashed" }, "E:/notes/chapter.pdf"),
    "Could not export PDF chapter.pdf. Renderer crashed"
  );
});
