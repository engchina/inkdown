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
const mainSource = await fs.readFile(new URL("../src/main/main.js", import.meta.url), "utf8");
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

test("inline mark range matching keeps click edge tolerance but selection contact stays inside true boundaries", () => {
  const ranges = [
    { markName: "bold", from: 10, to: 20 },
    { markName: "italic", from: 12, to: 18 }
  ];

  assert.deepEqual(findMarkRangeForClick(ranges, 13, "italic"), ranges[1]);
  assert.deepEqual(findMarkRangeForClick(ranges, 9, "bold"), ranges[0]);
  assert.deepEqual(findMarkRangeForSelection(ranges, 10, 10, "bold"), ranges[0]);
  assert.deepEqual(findMarkRangeForSelection(ranges, 18, 18, "italic"), ranges[1]);
  assert.equal(findMarkRangeForSelection(ranges, 9, 9, "bold"), null);
  assert.equal(findMarkRangeForClick(ranges, 40, "bold"), null);
});

test("selection contact helper only treats the actual mark span as active", () => {
  const range = { from: 10, to: 20 };

  assert.equal(selectionTouchesMarkRange(range, 10, 10), true);
  assert.equal(selectionTouchesMarkRange(range, 20, 20), true);
  assert.equal(selectionTouchesMarkRange(range, 9, 9), false);
  assert.equal(selectionTouchesMarkRange(range, 21, 21), false);
  assert.equal(selectionTouchesMarkRange(range, 5, 12), true);
  assert.equal(selectionTouchesMarkRange(range, 18, 24), true);
  assert.equal(selectionTouchesMarkRange(range, 21, 24), false);
});

test("editor inline marks expand directly from click instead of using read-only reveal widgets", () => {
  assert.match(appSource, /handleClick\(view, pos, event\)/);
  assert.match(appSource, /getInlineMarkTarget\(event\.target, view\.dom\)/);
  assert.match(appSource, /findMarkGroupForSelection\(view\.state, Selection\.near\(view\.state\.doc\.resolve\(pos\)\), target\.markName\)/);
  assert.match(appSource, /serializeInlineFragmentContent\(fragment\)/);
  assert.match(appSource, /parseInlineMarkdownFragment\(state\.schema, markdown\)/);
  assert.match(appSource, /positionMap\[textOffset\] = markdown\.length;\s+for \(let index = shared; index < nextMarks\.length; index \+= 1\)/s);
  assert.match(appSource, /if \(docPos <= groupFrom\) \{/);
  assert.match(appSource, /if \(docPos >= groupTo\) \{/);
  assert.match(appSource, /return groupFrom \+ markdownLength;/);
  assert.match(appSource, /state\.tr\.replaceWith\(groupFrom, groupTo, state\.schema\.text\(markdown\)\)/);
  assert.doesNotMatch(appSource, /InlineMarkReveal,/);
  assert.doesNotMatch(stylesSource, /\.mark-syntax-reveal \{/);
});

test("editor keeps expanded inline syntax active while selection still touches the range", () => {
  assert.match(appSource, /function selectionTouchesExpandedRange\(selection, expandedRange\)/);
  assert.match(appSource, /selectionTouchesMarkRange\(expandedRange, selection\.from, selection\.to\)/);
  assert.match(appSource, /if \(!selectionTouchesExpandedRange\(sel, expandedRange\)\) \{/);
  assert.match(appSource, /from: tr\.mapping\.map\(expandedRange\.from, -1\)/);
  assert.match(appSource, /to: tr\.mapping\.map\(expandedRange\.to, -1\)/);
  assert.match(appSource, /const adjacentGroup = findMarkGroupForSelection\(newState, sel\);/);
  assert.match(appSource, /Math\.min\(adjacentGroup\.from, expandedRange\.from\)/);
  assert.match(appSource, /Math\.max\(adjacentGroup\.to, expandedRange\.to\)/);
  assert.match(appSource, /return expandMarkSyntax\(newState, group\.from, group\.to, sel\.anchor, sel\.head\)/);
});

test("inline token extensions disable default input rules so closing markers do not auto-render immediately", () => {
  assert.match(appSource, /const TokenBold = Bold\.extend\(\{\s+addInputRules\(\) \{\s+return \[\];/s);
  assert.match(appSource, /const TokenItalic = Italic\.extend\(\{[\s\S]*?addInputRules\(\) \{\s+return \[\];/);
  assert.match(appSource, /const TokenStrike = Strike\.extend\(\{\s+addInputRules\(\) \{\s+return \[\];/s);
  assert.match(appSource, /const TokenCode = Code\.extend\(\{\s+addInputRules\(\) \{\s+return \[\];/s);
});


test("italic shortcut override keeps Ctrl+Shift+I free for developer tools", () => {
  assert.match(appSource, /const TokenItalic = Italic\.extend\(\{\s+addKeyboardShortcuts\(\) \{\s+return \{\s+"Mod-i": \(\) => this\.editor\.commands\.toggleItalic\(\)/s);
  assert.doesNotMatch(appSource, /"Mod-I": \(\) => this\.editor\.commands\.toggleItalic\(\)/);
  assert.match(mainSource, /label: "Image",\s+accelerator: "CmdOrCtrl\+Alt\+I"/s);
  assert.match(mainSource, /role: "toggleDevTools", label: "Developer Tools", accelerator: "CmdOrCtrl\+Shift\+I"/);
});
