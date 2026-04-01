import test from "node:test";
import assert from "node:assert/strict";
import {
  findLiteralMatches,
  buildPrefixedSourceLines,
  replaceAllLiteralMatches,
  replaceCurrentLiteralMatch,
  buildSourceInsertion,
  buildWrappedSourceSelection
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
