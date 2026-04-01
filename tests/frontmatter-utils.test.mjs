import test from "node:test";
import assert from "node:assert/strict";
import * as yaml from "js-yaml";
import {
  formatFrontMatterDate,
  getYamlErrorDetails,
  splitTagTokens,
  summarizeFrontMatter
} from "../src/renderer/utils/frontMatter.mjs";

test("splitTagTokens handles commas, semicolons, full-width punctuation, and newlines", () => {
  assert.deepEqual(
    splitTagTokens("alpha, beta;\ngamma，delta； epsilon"),
    ["alpha", "beta", "gamma", "delta", "epsilon"]
  );
});

test("formatFrontMatterDate keeps date and optional time stable for a fixed timestamp", () => {
  const fixedDate = new Date(2026, 3, 1, 9, 5);
  assert.equal(formatFrontMatterDate(fixedDate, false), "2026-04-01");
  assert.equal(formatFrontMatterDate(fixedDate, true), "2026-04-01 09:05");
});

test("summarizeFrontMatter reports draft documents as draft", () => {
  const summary = summarizeFrontMatter("---\ntitle: Inkdown\ndraft: true\ntags:\n  - markdown\n---\n");
  assert.equal(summary.hasFrontMatter, true);
  assert.equal(summary.fieldCount, 3);
  assert.equal(summary.parseFailed, false);
  assert.equal(summary.isDraft, true);
  assert.equal(summary.statusText, "Draft");
  assert.equal(summary.tone, "accent");
});

test("summarizeFrontMatter reports YAML failures as needing attention", () => {
  const summary = summarizeFrontMatter("---\ntitle: Inkdown\ntags: [broken\n---\n");
  assert.equal(summary.hasFrontMatter, true);
  assert.equal(summary.parseFailed, true);
  assert.equal(summary.statusText, "Needs attention");
  assert.equal(summary.tone, "warning");
});

test("getYamlErrorDetails exposes 1-based line and column", () => {
  let parseError = null;

  try {
    yaml.load("title: Inkdown\ntags: [broken");
  } catch (error) {
    parseError = error;
  }

  const details = getYamlErrorDetails(parseError);
  assert.match(details.reason, /flow collection/i);
  assert.equal(details.line, 3);
  assert.equal(details.column, 1);
});



