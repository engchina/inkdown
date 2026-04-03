import test from "node:test";
import assert from "node:assert/strict";
import { Marked } from "marked";

test("marked gfm matches typora-style email and www autolink rendering", () => {
  const marked = new Marked({ gfm: true, breaks: false });
  assert.equal(marked.parse('<i@typora.io>').trim(), '<p><a href="mailto:i@typora.io">i@typora.io</a></p>');
  assert.equal(marked.parse('www.google.com').trim(), '<p><a href="http://www.google.com">www.google.com</a></p>');
});
