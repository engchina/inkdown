import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  getCompletedInlineMarkdownMatch,
  prefixEndsWithCompletedInlineMarkdown,
  shouldDeferInlineMarkdownRender
} from "../src/renderer/utils/inlineMarkdownCompletion.mjs";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");

test("inline completion detection recognizes closed emphasis and waits one render cycle", () => {
  assert.equal(prefixEndsWithCompletedInlineMarkdown("*abc*"), true);
  assert.equal(prefixEndsWithCompletedInlineMarkdown("**abc**"), true);
  assert.equal(prefixEndsWithCompletedInlineMarkdown("***abc***"), true);
  assert.equal(prefixEndsWithCompletedInlineMarkdown("*abc"), false);
  assert.equal(prefixEndsWithCompletedInlineMarkdown("**abc*"), false);
});

test("inline completion detection returns structured trailing match ranges", () => {
  assert.deepEqual(getCompletedInlineMarkdownMatch("*abc*"), {
    type: "italic",
    text: "*abc*",
    start: 0,
    end: 5
  });
  assert.deepEqual(getCompletedInlineMarkdownMatch("x **abc**"), {
    type: "bold",
    text: "**abc**",
    start: 2,
    end: 9
  });
  assert.deepEqual(getCompletedInlineMarkdownMatch("[abc](https://example.com)"), {
    type: "link",
    text: "[abc](https://example.com)",
    start: 0,
    end: 26
  });
  assert.equal(getCompletedInlineMarkdownMatch("*abc"), null);
});

test("inline completion detection recognizes links and code spans", () => {
  assert.equal(prefixEndsWithCompletedInlineMarkdown("`abc`"), true);
  assert.equal(prefixEndsWithCompletedInlineMarkdown("[abc](https://example.com)"), true);
  assert.equal(prefixEndsWithCompletedInlineMarkdown("[abc](https://example.com"), false);
});

test("shouldDeferInlineMarkdownRender only defers on closing-token input", () => {
  assert.equal(shouldDeferInlineMarkdownRender("*abc", "*", ""), true);
  assert.equal(shouldDeferInlineMarkdownRender("*abc*", " ", ""), false);
  assert.equal(shouldDeferInlineMarkdownRender("abc", "x", ""), false);
});

test("editor inline completion is tracked inside the mark syntax plugin", () => {
  assert.match(appSource, /function findCompletedInlineRangeAtSelection\(state, selection\)/);
  assert.match(appSource, /const match = getCompletedInlineMarkdownMatch\(beforeCursor\);/);
  assert.match(appSource, /appendTransaction\(transactions, _oldState, newState\)/);
  assert.match(appSource, /const completedRange = findCompletedInlineRangeAtSelection\(newState, sel\);/);
  assert.doesNotMatch(appSource, /deferNextEditorRenderRef/);
});
