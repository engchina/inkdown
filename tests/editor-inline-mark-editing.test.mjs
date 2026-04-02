import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { JSDOM } from "jsdom";
import {
  findMarkRangeForClick,
  findMarkRangeForSelection,
  getInlineMarkTarget,
  selectionTouchesMarkRange
} from "../src/renderer/utils/markSyntaxEditing.mjs";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");
const stylesSource = await fs.readFile(new URL("../src/renderer/styles/app.css", import.meta.url), "utf8");

test("inline mark clicks resolve to the nearest supported mark element", () => {
  const dom = new JSDOM('<div id="root"><strong><em><span id="target">hello</span></em></strong></div>');
  const root = dom.window.document.getElementById("root");
  const target = dom.window.document.getElementById("target");

  const result = getInlineMarkTarget(target, root);
  assert.ok(result);
  assert.equal(result.markName, "italic");
  assert.equal(result.markElement.tagName, "EM");
});

test("inline mark clicks also resolve from text nodes inside rendered marks", () => {
  const dom = new JSDOM('<div id="root"><em>hello</em></div>');
  const root = dom.window.document.getElementById("root");
  const textNode = root.querySelector("em")?.firstChild;

  const result = getInlineMarkTarget(textNode, root);
  assert.ok(result);
  assert.equal(result.markName, "italic");
  assert.equal(result.markElement.tagName, "EM");
});

test("inline mark range matching accepts cursor and selection contact at mark edges", () => {
  const ranges = [
    { markName: "bold", from: 10, to: 20 },
    { markName: "italic", from: 12, to: 18 }
  ];

  assert.deepEqual(findMarkRangeForClick(ranges, 13, "italic"), ranges[1]);
  assert.deepEqual(findMarkRangeForClick(ranges, 9, "bold"), ranges[0]);
  assert.deepEqual(findMarkRangeForSelection(ranges, 9, 10, "bold"), ranges[0]);
  assert.deepEqual(findMarkRangeForSelection(ranges, 18, 21, "italic"), ranges[1]);
  assert.equal(findMarkRangeForClick(ranges, 40, "bold"), null);
});

test("selection contact helper treats mark boundaries as part of the active zone", () => {
  const range = { from: 10, to: 20 };

  assert.equal(selectionTouchesMarkRange(range, 10, 10), true);
  assert.equal(selectionTouchesMarkRange(range, 9, 9), true);
  assert.equal(selectionTouchesMarkRange(range, 21, 21), true);
  assert.equal(selectionTouchesMarkRange(range, 8, 8), false);
  assert.equal(selectionTouchesMarkRange(range, 5, 12), true);
  assert.equal(selectionTouchesMarkRange(range, 21, 24), true);
  assert.equal(selectionTouchesMarkRange(range, 22, 24), false);
});

test("editor inline marks expand directly from click instead of using read-only reveal widgets", () => {
  assert.match(appSource, /handleClick\(view, pos, event\)/);
  assert.match(appSource, /getInlineMarkTarget\(event\.target, view\.dom\)/);
  assert.match(appSource, /findMarkGroupForSelection\(view\.state, Selection\.near\(view\.state\.doc\.resolve\(pos\)\), target\.markName\)/);
  assert.match(appSource, /serializeInlineFragmentContent\(fragment\)/);
  assert.match(appSource, /parseInlineMarkdownFragment\(state\.schema, markdown\)/);
  assert.doesNotMatch(appSource, /InlineMarkReveal,/);
  assert.doesNotMatch(stylesSource, /\.mark-syntax-reveal \{/);
});

test("editor keeps expanded inline syntax active while selection still touches the range", () => {
  assert.match(appSource, /function selectionTouchesExpandedRange\(selection, expandedRange\)/);
  assert.match(appSource, /selectionTouchesMarkRange\(expandedRange, selection\.from, selection\.to\)/);
  assert.match(appSource, /if \(!selectionTouchesExpandedRange\(sel, expandedRange\)\) \{/);
  assert.match(appSource, /const group = findMarkGroupForSelection\(newState, sel\);/);
  assert.match(appSource, /return expandMarkSyntax\(newState, group\.from, group\.to, sel\.anchor, sel\.head\)/);
});
