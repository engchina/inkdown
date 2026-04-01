import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");

test("source pane surfaces object-level context and actions", () => {
  assert.match(appSource, /const sourceObjectContext = useMemo/);
  assert.match(appSource, /Link selected/);
  assert.match(appSource, /Image selected/);
  assert.match(appSource, /Edit Link/);
  assert.match(appSource, /Remove Link/);
  assert.match(appSource, /Replace Image/);
  assert.match(appSource, /Remove Image/);
  assert.match(appSource, /Add Table Row/);
});
