import test from "node:test";
import assert from "node:assert/strict";

import {
  getCenteredSourceScrollTop,
  getOutlineSourceSelectionRange,
  resolveOutlineNavigationSurface
} from "../src/renderer/utils/outlineNavigation.mjs";

test("outline navigation targets the visible source pane in split mode", () => {
  assert.equal(resolveOutlineNavigationSurface("split"), "source");
});

test("outline navigation targets preview in preview mode", () => {
  assert.equal(resolveOutlineNavigationSurface("preview"), "preview");
});

test("source outline scrolling centers the requested line and clamps at the top", () => {
  assert.equal(
    getCenteredSourceScrollTop(12, {
      lineHeight: 28,
      paddingTop: 22,
      containerHeight: 420
    }),
    162
  );
  assert.equal(
    getCenteredSourceScrollTop(0, {
      lineHeight: 28,
      paddingTop: 22,
      containerHeight: 420
    }),
    0
  );
});

test("source outline selection covers full markdown heading lines including marker prefixes", () => {
  assert.deepEqual(
    getOutlineSourceSelectionRange("# Inkdown\n\n## Math and diagrams\nBody", 2, "Math and diagrams".length),
    {
      start: 11,
      end: 31
    }
  );
});
