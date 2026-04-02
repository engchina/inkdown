import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExpandedMarkdownTableSelection,
  buildLinkedSourceSelection,
  buildRemovedMarkdownLinkSelection,
  buildRemovedMarkdownImageSelection,
  buildSourceInsertion,
  buildPrefixedSourceLines,
  getMarkdownLineContinuation,
  buildToggledPrefixedSourceLines,
  buildToggledWrappedSourceSelection,
  buildUpdatedMarkdownImageSelection,
  buildMarkdownImageSyntax,
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

test("buildLinkedSourceSelection supports optional link titles", () => {
  const result = buildLinkedSourceSelection("", 0, 0, "Guide", "https://example.com", "link text", "Reference");
  assert.equal(result.text, '[Guide](https://example.com "Reference")');
  assert.equal(result.selectionStart, 1);
  assert.equal(result.selectionEnd, 6);
});
test("buildLinkedSourceSelection uses provided text when there is no selection", () => {
  const result = buildLinkedSourceSelection("Hello", 5, 5, "Inkdown", "https://example.com");
  assert.equal(result.text, "Hello[Inkdown](https://example.com)");
  assert.equal(result.selectionStart, 6);
  assert.equal(result.selectionEnd, 13);
});

test("buildLinkedSourceSelection escapes markdown-sensitive link labels", () => {
  const result = buildLinkedSourceSelection("", 0, 0, "Docs [v2]\\draft", "https://example.com/docs");
  assert.equal(result.text, "[Docs \\[v2\\]\\\\draft](https://example.com/docs)");
  assert.equal(result.selectionStart, 1);
  assert.equal(result.selectionEnd, 19);
});

test("buildUpdatedMarkdownLinkSelection escapes markdown-sensitive labels and title backslashes", () => {
  const result = buildUpdatedMarkdownLinkSelection("[Docs](https://example.com)", 2, 2, {
    text: "Docs [v2]\\draft",
    title: "Ref\\Docs"
  });
  assert.equal(result.text, "[Docs \\[v2\\]\\\\draft](https://example.com \"Ref\\\\Docs\")");
  assert.equal(result.selectionStart, 1);
  assert.equal(result.selectionEnd, 19);
});

test("findMarkdownLinkAtSelection returns link context for a cursor inside markdown link", () => {
  const result = findMarkdownLinkAtSelection("Hello [Inkdown](https://example.com) world", 10, 10);
  assert.deepEqual(result, {
    kind: "inline",
    start: 6,
    end: 36,
    text: "Inkdown",
    url: "https://example.com",
    title: "",
    textStart: 7,
    textEnd: 14
  });
});

test("findMarkdownLinkAtSelection parses optional titles and angle-bracket destinations", () => {
  const result = findMarkdownLinkAtSelection('See [Guide](<https://example.com/docs guide> "Reference") now', 8, 8);
  assert.deepEqual(result, {
    kind: "inline",
    start: 4,
    end: 57,
    text: "Guide",
    url: "https://example.com/docs guide",
    title: "Reference",
    textStart: 5,
    textEnd: 10
  });
});

test("findMarkdownLinkAtSelection unescapes escaped markdown labels and titles", () => {
  const result = findMarkdownLinkAtSelection('See [Docs \\[v2\\]\\\\draft](https://example.com "Ref\\\\Docs") now', 8, 8);
  assert.deepEqual(result, {
    kind: "inline",
    start: 4,
    end: 57,
    text: 'Docs [v2]\\draft',
    url: "https://example.com",
    title: 'Ref\\Docs',
    textStart: 5,
    textEnd: 23
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

test("buildUpdatedMarkdownLinkSelection preserves existing titles and formats spaced urls", () => {
  const result = buildUpdatedMarkdownLinkSelection('Hello [Inkdown](<https://example.com/docs guide> "Reference") world', 10, 10, {
    url: "https://inkdown.app/docs guide"
  });
  assert.equal(result.text, 'Hello [Inkdown](<https://inkdown.app/docs guide> "Reference") world');
  assert.equal(result.selectionStart, 7);
  assert.equal(result.selectionEnd, 14);
});


test("findMarkdownLinkAtSelection recognizes angle-bracket autolinks", () => {
  const result = findMarkdownLinkAtSelection("See <https://example.com/docs> now", 8, 8);
  assert.deepEqual(result, {
    kind: "autolink",
    start: 4,
    end: 30,
    text: "https://example.com/docs",
    url: "https://example.com/docs",
    title: "",
    textStart: 5,
    textEnd: 29
  });
});

test("buildUpdatedMarkdownLinkSelection preserves autolink syntax when only the url changes", () => {
  const result = buildUpdatedMarkdownLinkSelection("See <https://example.com/docs> now", 8, 8, {
    url: "https://inkdown.app/guide"
  });
  assert.equal(result.text, "See <https://inkdown.app/guide> now");
  assert.equal(result.selectionStart, 5);
  assert.equal(result.selectionEnd, 30);
});

test("buildUpdatedMarkdownLinkSelection converts autolinks to labeled links when text changes", () => {
  const result = buildUpdatedMarkdownLinkSelection("See <https://example.com/docs> now", 8, 8, {
    text: "Guide",
    url: "https://inkdown.app/guide"
  });
  assert.equal(result.text, "See [Guide](https://inkdown.app/guide) now");
  assert.equal(result.selectionStart, 5);
  assert.equal(result.selectionEnd, 10);
});


test("findMarkdownLinkAtSelection recognizes bare urls and trims trailing punctuation", () => {
  const result = findMarkdownLinkAtSelection("See https://example.com/docs). now", 10, 10);
  assert.deepEqual(result, {
    kind: "bare",
    start: 4,
    end: 28,
    text: "https://example.com/docs",
    url: "https://example.com/docs",
    title: "",
    textStart: 4,
    textEnd: 28
  });
});

test("buildUpdatedMarkdownLinkSelection preserves bare url syntax when only the url changes", () => {
  const result = buildUpdatedMarkdownLinkSelection("See https://example.com/docs now", 10, 10, {
    url: "https://inkdown.app/guide"
  });
  assert.equal(result.text, "See https://inkdown.app/guide now");
  assert.equal(result.selectionStart, 4);
  assert.equal(result.selectionEnd, 29);
});

test("buildUpdatedMarkdownLinkSelection converts bare urls to labeled links when text changes", () => {
  const result = buildUpdatedMarkdownLinkSelection("See https://example.com/docs now", 10, 10, {
    text: "Guide",
    url: "https://inkdown.app/guide"
  });
  assert.equal(result.text, "See [Guide](https://inkdown.app/guide) now");
  assert.equal(result.selectionStart, 5);
  assert.equal(result.selectionEnd, 10);
});

test("findMarkdownLinkAtSelection resolves reference-style links through definitions", () => {
  const result = findMarkdownLinkAtSelection('[Guide][docs]\n\n[docs]: https://example.com/docs "Reference"', 3, 3);
  assert.deepEqual(result, {
    kind: "reference",
    start: 0,
    end: 13,
    text: "Guide",
    url: "https://example.com/docs",
    title: "Reference",
    textStart: 1,
    textEnd: 6,
    referenceLabel: "docs",
    implicitReference: false,
    definitionStart: 15,
    definitionEnd: 59,
    definitionLabel: "docs"
  });
});

test("findMarkdownLinkAtSelection resolves implicit reference links through definitions", () => {
  const result = findMarkdownLinkAtSelection('[Guide][]\n\n[Guide]: https://example.com/docs', 3, 3);
  assert.deepEqual(result, {
    kind: "reference",
    start: 0,
    end: 9,
    text: "Guide",
    url: "https://example.com/docs",
    title: "",
    textStart: 1,
    textEnd: 6,
    referenceLabel: "Guide",
    implicitReference: true,
    definitionStart: 11,
    definitionEnd: 44,
    definitionLabel: "Guide"
  });
});

test("buildUpdatedMarkdownLinkSelection updates reference definitions in place", () => {
  const result = buildUpdatedMarkdownLinkSelection('[Guide][docs]\n\n[docs]: https://example.com/docs "Reference"', 3, 3, {
    url: "https://inkdown.app/guide",
    title: "Updated"
  });
  assert.equal(result.text, '[Guide][docs]\n\n[docs]: https://inkdown.app/guide "Updated"');
  assert.equal(result.selectionStart, 1);
  assert.equal(result.selectionEnd, 6);
});

test("buildRemovedMarkdownLinkSelection removes orphaned reference definitions", () => {
  const result = buildRemovedMarkdownLinkSelection('[Guide][docs]\n\n[docs]: https://example.com/docs "Reference"', 3, 3);
  assert.equal(result.text, 'Guide');
  assert.equal(result.selectionStart, 0);
  assert.equal(result.selectionEnd, 5);
});

test("buildRemovedMarkdownLinkSelection keeps shared reference definitions when still used", () => {
  const result = buildRemovedMarkdownLinkSelection('[Guide][docs]\n\nAlso [More][docs]\n\n[docs]: https://example.com/docs "Reference"', 3, 3);
  assert.equal(result.text, 'Guide\n\nAlso [More][docs]\n\n[docs]: https://example.com/docs "Reference"');
  assert.equal(result.selectionStart, 0);
  assert.equal(result.selectionEnd, 5);
});

test("buildMarkdownImageSyntax wraps spaced image destinations in angle brackets", () => {
  assert.equal(buildMarkdownImageSyntax("Diagram", "./images/final image (wide).png", "Wide"), '![Diagram](<./images/final image (wide).png> "Wide")');
});

test("buildMarkdownImageSyntax escapes alt text and title backslashes", () => {
  assert.equal(
    buildMarkdownImageSyntax("Diagram [v2]\\draft", "./images/final image.png", "Wide\\Shot"),
    '![Diagram \\[v2\\]\\\\draft](<./images/final image.png> "Wide\\\\Shot")'
  );
});

test("buildUpdatedMarkdownImageSelection keeps source selection aligned to escaped alt text", () => {
  const result = buildUpdatedMarkdownImageSelection("![Image](./images/final.png)", 3, 3, {
    alt: "Diagram [v2]\\draft",
    title: "Wide\\Shot"
  });
  assert.equal(result.text, '![Diagram \\[v2\\]\\\\draft](./images/final.png "Wide\\\\Shot")');
  assert.equal(result.selectionStart, 2);
  assert.equal(result.selectionEnd, 23);
});

test("findMarkdownImageAtSelection unescapes escaped alt text and titles", () => {
  const result = findMarkdownImageAtSelection('See ![Diagram \\[v2\\]\\\\draft](./images/final.png "Wide\\\\Shot") now', 8, 8);
  assert.deepEqual(result, {
    start: 4,
    end: 61,
    alt: 'Diagram [v2]\\draft',
    url: "./images/final.png",
    title: 'Wide\\Shot'
  });
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

test("getMarkdownLineContinuation preserves bullet markers when continuing source lists", () => {
  assert.deepEqual(getMarkdownLineContinuation("* item"), {
    kind: "bulletList",
    mode: "insert",
    text: "\n* "
  });
  assert.deepEqual(getMarkdownLineContinuation("+ item"), {
    kind: "bulletList",
    mode: "insert",
    text: "\n+ "
  });
});

test("getMarkdownLineContinuation preserves task markers and exits empty items cleanly", () => {
  assert.deepEqual(getMarkdownLineContinuation("+ [x] done"), {
    kind: "taskList",
    mode: "insert",
    text: "\n+ [ ] "
  });
  assert.deepEqual(getMarkdownLineContinuation("  * [ ] "), {
    kind: "taskList",
    mode: "replace-line",
    text: "  "
  });
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





