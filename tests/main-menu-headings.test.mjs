import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const mainSource = await fs.readFile(new URL("../src/main/main.js", import.meta.url), "utf8");

test("paragraph menu exposes heading shortcuts through level six", () => {
  assert.match(mainSource, /label: "Heading 1"[\s\S]*?accelerator: "CmdOrCtrl\+1"[\s\S]*?format: "heading-1"/);
  assert.match(mainSource, /label: "Heading 2"[\s\S]*?accelerator: "CmdOrCtrl\+2"[\s\S]*?format: "heading-2"/);
  assert.match(mainSource, /label: "Heading 3"[\s\S]*?accelerator: "CmdOrCtrl\+3"[\s\S]*?format: "heading-3"/);
  assert.match(mainSource, /label: "Heading 4"[\s\S]*?accelerator: "CmdOrCtrl\+4"[\s\S]*?format: "heading-4"/);
  assert.match(mainSource, /label: "Heading 5"[\s\S]*?accelerator: "CmdOrCtrl\+5"[\s\S]*?format: "heading-5"/);
  assert.match(mainSource, /label: "Heading 6"[\s\S]*?accelerator: "CmdOrCtrl\+6"[\s\S]*?format: "heading-6"/);
});
