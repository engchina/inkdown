import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  getCompletedInlineMarkdownMatch,
  getCompletedInlineMarkdownMatchAroundCursor,
  isWholeTextCompletedInlineMarkdown,
  prefixEndsWithCompletedInlineMarkdown,
  shouldDeferInlineMarkdownRender
} from "../src/renderer/utils/inlineMarkdownCompletion.mjs";
import { mapSelectionAfterRangeReplacement } from "../src/renderer/utils/markSyntaxEditing.mjs";

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
  assert.deepEqual(getCompletedInlineMarkdownMatch("***abc***"), {
    type: "boldItalic",
    text: "***abc***",
    start: 0,
    end: 9
  });
  assert.deepEqual(getCompletedInlineMarkdownMatch("___abc___"), {
    type: "boldItalic",
    text: "___abc___",
    start: 0,
    end: 9
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

test("inline completion detection also recognizes completed syntax around the caret", () => {
  assert.deepEqual(getCompletedInlineMarkdownMatchAroundCursor("`a`", 2), {
    type: "code",
    text: "`a`",
    start: 0,
    end: 3
  });
  assert.deepEqual(getCompletedInlineMarkdownMatchAroundCursor("**a**", 3), {
    type: "bold",
    text: "**a**",
    start: 0,
    end: 5
  });
  assert.deepEqual(getCompletedInlineMarkdownMatchAroundCursor("***a***", 4), {
    type: "boldItalic",
    text: "***a***",
    start: 0,
    end: 7
  });
  assert.deepEqual(getCompletedInlineMarkdownMatchAroundCursor("___a___", 4), {
    type: "boldItalic",
    text: "___a___",
    start: 0,
    end: 7
  });
  assert.deepEqual(getCompletedInlineMarkdownMatchAroundCursor("[a](https://example.com)", 2), {
    type: "link",
    text: "[a](https://example.com)",
    start: 0,
    end: 24
  });
  assert.equal(getCompletedInlineMarkdownMatchAroundCursor("`a", 2), null);
  assert.equal(getCompletedInlineMarkdownMatchAroundCursor("~~abc~", 6), null);
  assert.equal(getCompletedInlineMarkdownMatchAroundCursor("**abc*", 6), null);
  assert.equal(getCompletedInlineMarkdownMatchAroundCursor("***abc**", 8), null);
});

test("shouldDeferInlineMarkdownRender only defers on closing-token input", () => {
  assert.equal(shouldDeferInlineMarkdownRender("*abc", "*", ""), true);
  assert.equal(shouldDeferInlineMarkdownRender("*abc*", " ", ""), false);
  assert.equal(shouldDeferInlineMarkdownRender("abc", "x", ""), false);
});

test("whole-text completion validation preserves bold and triple-emphasis ranges", () => {
  assert.equal(isWholeTextCompletedInlineMarkdown("**abc**"), true);
  assert.equal(isWholeTextCompletedInlineMarkdown("***abc***"), true);
  assert.equal(isWholeTextCompletedInlineMarkdown("___abc___"), true);
  assert.equal(isWholeTextCompletedInlineMarkdown("*abc**"), false);
  assert.equal(getCompletedInlineMarkdownMatch("~~abc~"), null);
  assert.equal(getCompletedInlineMarkdownMatch("**abc*"), null);
  assert.equal(getCompletedInlineMarkdownMatch("***abc**"), null);
});

test("editor inline completion defers rendering until the caret leaves the completed markdown", () => {
  assert.match(appSource, /function findCompletedInlineRangeAtSelection\(state, selection\)/);
  assert.match(appSource, /const match =\s*getCompletedInlineMarkdownMatch\(beforeCursor\)\s*\|\|\s*getCompletedInlineMarkdownMatchAroundCursor\(text, selection\.\$from\.parentOffset\);/);
  assert.match(appSource, /getCompletedInlineMarkdownMatchAroundCursor\(text, selection\.\$from\.parentOffset\)/);
  assert.match(appSource, /function isPendingInlineRangeStillCompleted\(state, pendingInlineRange\)/);
  assert.match(appSource, /return isWholeTextCompletedInlineMarkdown\(markdown\);/);
  assert.match(appSource, /init\(\) \{\s*return \{ expandedRange: null, pendingInlineRange: null \};/s);
  assert.match(appSource, /const \{ expandedRange, pendingInlineRange \} = markSyntaxEditingKey\.getState\(newState\);/);
  assert.match(appSource, /if \(pendingInlineRange\) \{/);
  assert.match(appSource, /if \(!selectionTouchesMarkRange\(pendingInlineRange, sel\.from, sel\.to\)\) \{[\s\S]*?return renderCompletedInlineRange\(newState, pendingInlineRange\);/s);
  assert.match(appSource, /const completedRange = findCompletedInlineRangeAtSelection\(newState, sel\);/);
  assert.match(appSource, /tr\.setMeta\(markSyntaxEditingKey, \{ expandedRange: null, pendingInlineRange: completedRange \}\);/);
  assert.match(appSource, /function renderCompletedInlineRange\(state, completedRange\)/);
  assert.match(appSource, /const markdown = state\.doc\.textBetween\(completedRange\.from, completedRange\.to, "\\n"\);/);
  assert.match(appSource, /const fragment = parseInlineMarkdownFragment\(state\.schema, markdown\);/);
  assert.match(appSource, /state\.tr\.replaceWith\(completedRange\.from, completedRange\.to, fragment\)/);
  assert.match(appSource, /const mappedSelection = mapSelectionAfterRangeReplacement\(/);
  assert.match(appSource, /tr\.setSelection\(TextSelection\.create\(tr\.doc, mappedSelection\.anchor, mappedSelection\.head\)\);/);
});

test("inline range replacement keeps the caret after trailing typed text", () => {
  assert.deepEqual(mapSelectionAfterRangeReplacement({ from: 10, to: 17 }, 18, 18, 3), {
    anchor: 14,
    head: 14
  });
  assert.deepEqual(mapSelectionAfterRangeReplacement({ from: 10, to: 19 }, 20, 20, 3), {
    anchor: 14,
    head: 14
  });
});

test("inline range replacement preserves trailing caret position across supported inline markdown tags", () => {
  const cases = [
    { markdown: "*abc*", replacementSize: 3, expected: 14 },
    { markdown: "_abc_", replacementSize: 3, expected: 14 },
    { markdown: "**abc**", replacementSize: 3, expected: 14 },
    { markdown: "__abc__", replacementSize: 3, expected: 14 },
    { markdown: "***abc***", replacementSize: 3, expected: 14 },
    { markdown: "___abc___", replacementSize: 3, expected: 14 },
    { markdown: "~~abc~~", replacementSize: 3, expected: 14 },
    { markdown: "==abc==", replacementSize: 3, expected: 14 },
    { markdown: "~abc~", replacementSize: 3, expected: 14 },
    { markdown: "^abc^", replacementSize: 3, expected: 14 },
    { markdown: "`abc`", replacementSize: 3, expected: 14 },
    { markdown: "[abc](https://example.com)", replacementSize: 3, expected: 14 },
    { markdown: "[x](https://example.com)", replacementSize: 1, expected: 12 }
  ];

  for (const { markdown, replacementSize, expected } of cases) {
    const range = { from: 10, to: 10 + markdown.length };
    const trailingCaret = range.to + 1;
    assert.deepEqual(
      mapSelectionAfterRangeReplacement(range, trailingCaret, trailingCaret, replacementSize),
      { anchor: expected, head: expected },
      markdown
    );
  }
});









