import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");

test("source pane surfaces object-level context and actions", () => {
  assert.match(appSource, /const sourceObjectContext = useMemo/);
  assert.match(appSource, /Link selected/);
  assert.match(appSource, /canRemove: link\.kind !== "bare"/);
  assert.match(appSource, /Image selected/);
  assert.match(appSource, /Edit Link/);
  assert.match(appSource, /sourceObjectContext\.canRemove/);
  assert.match(appSource, /linkKind: existingLink\?\.kind \|\| null/);
  assert.match(appSource, /canRemove: Boolean\(existingLink && existingLink\.kind !== "bare"\)/);
  assert.match(appSource, /remove-link/);
  assert.match(appSource, /Replace Image/);
  assert.match(appSource, /Add Row/);
  assert.match(appSource, /Copy HTML/);
  assert.match(appSource, /linkDialogState\.linkKind\s*\?\s*buildUpdatedMarkdownLinkSelection\(markdownText, linkDialogState\.selectionStart, linkDialogState\.selectionEnd, \{/);
  assert.match(appSource, /: buildLinkedSourceSelection\(/);
  assert.match(appSource, /alt: existingImage\.alt,/);
  assert.match(appSource, /const update = buildRemovedMarkdownLinkSelection\(markdownText, linkDialogState\.selectionStart, linkDialogState\.selectionEnd\);/);
});
