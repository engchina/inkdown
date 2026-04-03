import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");

test("editor links only activate on cmd/ctrl click so plain click can stay in editing flow", () => {
  assert.match(appSource, /click\(view, event\) \{/);
  assert.match(appSource, /if \(!\(event\.metaKey \|\| event\.ctrlKey\)\) \{/);
  assert.match(appSource, /return false;/);
  assert.match(appSource, /void activatePreviewLink\(target, view\.dom, \{/);
});
