import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");

test("editor and source surfaces bind ctrl/cmd+a to select the full document", () => {
  assert.match(appSource, /if \(\(event\.metaKey \|\| event\.ctrlKey\) && event\.key\.toLowerCase\(\) === "a"\) \{[\s\S]*?new AllSelection\(view\.state\.doc\)/);
  assert.match(appSource, /textarea\.setSelectionRange\(0, textarea\.value\.length\);/);
  assert.match(appSource, /setSourceSelectionState\(\{ start: 0, end: textarea\.value\.length \}\);/);
});