import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExpandedMarkdownTableSelection,
  buildLinkedSourceSelection,
  buildRemovedMarkdownImageSelection,
  buildSourceInsertion,
  buildPrefixedSourceLines,
  buildToggledPrefixedSourceLines,
  buildToggledWrappedSourceSelection,
  buildUpdatedMarkdownImageSelection,
  buildUpdatedMarkdownLinkSelection,
  buildWrappedSourceSelection,
  findLiteralMatches,
  findMarkdownImageAtSelection,
  findMarkdownLinkAtSelection,
  findMarkdownTableAtSelection,
  replaceAllLiteralMatches,
  replaceCurrentLiteralMatch
} from "../src/renderer/utils/sourceEditing.mjs";

test("buildSourceInsertion keeps the caret after inserted block content", () => {
  const result = buildSourceInsertion("Alpha\nBeta", 6, 10, "---", { block: true });
  assert.equal(result.text, "Alpha\n\n\n---");
  assert.equal(result.selectionStart, 11);
  assert.equal(result.selectionEnd, 11);
});

test("buildWrappedSourceSelection keeps the original selection inside wrappers", () => {
  const result = buildWrappedSourceSelection("Hello world", 6, 11, "**");
  assert.equal(result.text, "Hello **world**");
  assert.equal(result.selectionStart, 8);
  assert.equal(result.selectionEnd, 13);
});

test("buildWrappedSourceSelection selects placeholder text when there was no selection", () => {
  const result = buildWrappedSourceSelection("Hello", 5, 5, "`", "`", "code");
  assert.equal(result.text, "Hello`code`");
  assert.equal(result.selectionStart, 6);
  assert.equal(result.selectionEnd, 10);
});

test("buildLinkedSourceSelection uses the selected text as the default label", () => {
  const result = buildLinkedSourceSelection("Hello world", 6, 11, "", "https://example.com");
  assert.equal(result.text, "Hello [world](https://example.com)");
  assert.equal(result.selectionStart, 7);
  assert.equal(result.selectionEnd, 12);
});

test("buildLinkedSourceSelection uses provided text when there is no selection", () => {
  const result = buildLinkedSourceSelection("Hello", 5, 5, "Inkdown", "https://example.com");
  assert.equal(result.text, "Hello[Inkdown](https://example.com)");
  assert.equal(result.selectionStart, 6);
  assert.equal(result.selectionEnd, 13);
});

test("findMarkdownLinkAtSelection returns link context for a cursor inside markdown link", () => {
  const result = findMarkdownLinkAtSelection("Hello [Inkdown](https://example.com) world", 10, 10);
  assert.deepEqual(result, {
    start: 6,
    end: 36,
    text: "Inkdown",
    url: "https://example.com",
    textStart: 7,
    textEnd: 14
  });
});

test("buildUpdatedMarkdownLinkSelection updates the current link target in place", () => {
  const result = buildUpdatedMarkdownLinkSelection("Hello [Inkdown](https://example.com) world", 10, 10, {
    url: "https://inkdown.app"
  });
  assert.equal(result.text, "Hello [Inkdown](https://inkdown.app) world");
  assert.equal(result.selectionStart, 7);
  assert.equal(result.selectionEnd, 14);
});

test("findMarkdownImageAtSelection returns image context for a cursor inside markdown image", () => {
  const result = findMarkdownImageAtSelection('Before ![Diagram](./images/diagram.png "Wide") after', 12, 12);
  assert.deepEqual(result, {
    start: 7,
    end: 46,
    alt: "Diagram",
    url: "./images/diagram.png",
    title: "Wide"
  });
});

test("buildUpdatedMarkdownImageSelection replaces the current markdown image in place", () => {
  const result = buildUpdatedMarkdownImageSelection('Before ![Diagram](./images/diagram.png "Wide") after', 12, 12, {
    alt: "Diagram",
    url: "./images/final.png",
    title: "Wide"
  });
  assert.equal(result.text, 'Before ![Diagram](./images/final.png "Wide") after');
  assert.equal(result.selectionStart, 9);
  assert.equal(result.selectionEnd, 16);
});

test("buildRemovedMarkdownImageSelection removes the current markdown image and keeps alt text", () => {
  const result = buildRemovedMarkdownImageSelection('Before ![Diagram](./images/diagram.png "Wide") after', 12, 12);
  assert.equal(result.text, 'Before Diagram after');
  assert.equal(result.selectionStart, 7);
  assert.equal(result.selectionEnd, 14);
});

test("findMarkdownTableAtSelection returns table metadata for a cursor inside a markdown table", () => {
  const result = findMarkdownTableAtSelection('| A | B |\n| --- | --- |\n| 1 | 2 |', 5);
  assert.deepEqual(result, {
    start: 0,
    end: 33,
    insertAt: 33,
    columnCount: 2
  });
});

test("buildExpandedMarkdownTableSelection appends a row to the current markdown table", () => {
  const result = buildExpandedMarkdownTableSelection('| A | B |\n| --- | --- |\n| 1 | 2 |', 5);
  assert.equal(result.text, '| A | B |\n| --- | --- |\n| 1 | 2 |\n| Value | Value |');
  assert.equal(result.selectionStart, 36);
  assert.equal(result.selectionEnd, 41);
});

test("buildToggledWrappedSourceSelection unwraps when the selection is already surrounded", () => {
  const result = buildToggledWrappedSourceSelection("Hello **world**", 8, 13, "**");
  assert.equal(result.text, "Hello world");
  assert.equal(result.selectionStart, 6);
  assert.equal(result.selectionEnd, 11);
});

test("buildToggledWrappedSourceSelection unwraps when the wrappers are part of the selected text", () => {
  const result = buildToggledWrappedSourceSelection("Hello **world**", 6, 15, "**");
  assert.equal(result.text, "Hello world");
  assert.equal(result.selectionStart, 6);
  assert.equal(result.selectionEnd, 11);
});

test("buildPrefixedSourceLines keeps the transformed lines selected", () => {
  const result = buildPrefixedSourceLines("alpha\nbeta", 2, 8, "- ");
  assert.equal(result.text, "- alpha\n- beta");
  assert.equal(result.selectionStart, 0);
  assert.equal(result.selectionEnd, 14);
});

test("buildPrefixedSourceLines renumbers selected lines from one", () => {
  const result = buildPrefixedSourceLines("first\nsecond", 0, 12, "1. ", true);
  assert.equal(result.text, "1. first\n2. second");
  assert.equal(result.selectionStart, 0);
  assert.equal(result.selectionEnd, 18);
});

test("buildToggledPrefixedSourceLines removes an existing heading prefix on repeated apply", () => {
  const result = buildToggledPrefixedSourceLines("## title", 3, 8, "## ", {
    isApplied: (line) => /^##\s+/.test(line),
    strip: (line) => line.replace(/^##\s+/, ""),
    normalize: (line) => line.replace(/^#{1,6}\s+/, "")
  });
  assert.equal(result.text, "title");
  assert.equal(result.selectionStart, 0);
  assert.equal(result.selectionEnd, 5);
});

test("buildToggledPrefixedSourceLines replaces another heading level instead of stacking markers", () => {
  const result = buildToggledPrefixedSourceLines("# title", 0, 7, "## ", {
    isApplied: (line) => /^##\s+/.test(line),
    strip: (line) => line.replace(/^##\s+/, ""),
    normalize: (line) => line.replace(/^#{1,6}\s+/, "")
  });
  assert.equal(result.text, "## title");
  assert.equal(result.selectionStart, 0);
  assert.equal(result.selectionEnd, 8);
});

test("buildToggledPrefixedSourceLines removes ordered list markers on repeated apply", () => {
  const result = buildToggledPrefixedSourceLines("1. first\n2. second", 0, 18, "1. ", {
    numbered: true,
    isApplied: (line) => /^\d+\.\s+/.test(line),
    strip: (line) => line.replace(/^\d+\.\s+/, ""),
    normalize: (line) => line.replace(/^\d+\.\s+/, "")
  });
  assert.equal(result.text, "first\nsecond");
  assert.equal(result.selectionStart, 0);
  assert.equal(result.selectionEnd, 12);
});

test("replaceCurrentLiteralMatch advances to the next remaining match after replacement", () => {
  const text = "foo test foo test";
  const matches = findLiteralMatches(text, "test");
  const result = replaceCurrentLiteralMatch(text, "test", matches, 0, "done");
  assert.equal(result.text, "foo done foo test");
  assert.deepEqual(result.nextMatches, [{ start: 13, end: 17 }]);
  assert.equal(result.nextIndex, 0);
});

test("replaceCurrentLiteralMatch skips replacement text when it still contains the query", () => {
  const text = "test test";
  const matches = findLiteralMatches(text, "test");
  const result = replaceCurrentLiteralMatch(text, "test", matches, 0, "test!");
  assert.equal(result.text, "test! test");
  assert.deepEqual(result.nextMatches, [{ start: 0, end: 4 }, { start: 6, end: 10 }]);
  assert.equal(result.nextIndex, 1);
});

test("replaceAllLiteralMatches reports replacement count and resulting matches", () => {
  const result = replaceAllLiteralMatches("alpha beta alpha", "alpha", "beta");
  assert.equal(result.text, "beta beta beta");
  assert.equal(result.replacedCount, 2);
  assert.deepEqual(result.nextMatches, []);
});

test("buildToggledPrefixedSourceLines normalizes deeper headings to heading one instead of removing them", () => {
  const result = buildToggledPrefixedSourceLines("#### title", 0, 10, "# ", {
    isApplied: (line) => /^#\s+/.test(line),
    strip: (line) => line.replace(/^#\s+/, ""),
    normalize: (line) => line.replace(/^#{1,6}\s+/, "")
  });
  assert.equal(result.text, "# title");
  assert.equal(result.selectionStart, 0);
  assert.equal(result.selectionEnd, 7);
});

test("buildToggledPrefixedSourceLines normalizes headings without a space before applying a new level", () => {
  const result = buildToggledPrefixedSourceLines("####title", 0, 9, "# ", {
    isApplied: (line) => /^#\s+/.test(line),
    strip: (line) => line.replace(/^#\s+/, ""),
    normalize: (line) => line.replace(/^#{1,6}\s*/, "")
  });
  assert.equal(result.text, "# title");
  assert.equal(result.selectionStart, 0);
  assert.equal(result.selectionEnd, 7);
});
