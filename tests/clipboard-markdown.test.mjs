import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { JSDOM } from "jsdom";
import {
  convertClipboardHtmlToMarkdown,
  hasStructuredClipboardHtml,
  serializeHtmlToMarkdown
} from "../src/renderer/utils/clipboardMarkdown.mjs";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");

function withDom(run) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  try {
    return run(dom.window.document);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    dom.window.close();
  }
}

test("convertClipboardHtmlToMarkdown preserves headings, links, lists, and canonical image URLs", () => {
  withDom(() => {
    const markdown = convertClipboardHtmlToMarkdown(`
      <article>
        <h1>Private Agent Factory</h1>
        <ul>
          <li><a href="https://example.com/oracle">oracle</a></li>
          <li><a href="https://example.com/oci">oci</a></li>
        </ul>
        <img
          alt="image.png"
          src="https://proxy.example.com/image.png"
          data-canonical-src="https://cdn.example.com/original-image.png"
        />
      </article>
    `);

    assert.match(markdown, /^# Private Agent Factory/m);
    assert.match(markdown, /- \[oracle\]\(https:\/\/example\.com\/oracle\)/);
    assert.match(markdown, /- \[oci\]\(https:\/\/example\.com\/oci\)/);
    assert.match(markdown, /!\[image\.png\]\(https:\/\/cdn\.example\.com\/original-image\.png\)/);
    assert.doesNotMatch(markdown, /proxy\.example\.com/);
  });
});

test("convertClipboardHtmlToMarkdown converts HTML checkbox lists into markdown task lists", () => {
  withDom(() => {
    const markdown = convertClipboardHtmlToMarkdown(`
      <ul>
        <li><input type="checkbox" checked />done</li>
        <li><input type="checkbox" />todo</li>
      </ul>
    `);

    assert.match(markdown, /- \[x\] done/);
    assert.match(markdown, /- \[ \] todo/);
  });
});

test("serializeHtmlToMarkdown keeps fenced code block languages from pasted HTML", () => {
  withDom(() => {
    const markdown = serializeHtmlToMarkdown(`
      <pre><code class="language-js">const value = 1;
console.log(value);</code></pre>
    `);

    assert.match(markdown, /```js/);
    assert.match(markdown, /console\.log\(value\);/);
  });
});

test("hasStructuredClipboardHtml ignores plain styled spans but detects real article structure", () => {
  withDom(() => {
    assert.equal(hasStructuredClipboardHtml('<span style="font-weight:700">hello</span>', "hello"), false);
    assert.equal(hasStructuredClipboardHtml("<ul><li>hello</li></ul>", "hello"), true);
    assert.equal(hasStructuredClipboardHtml('<img src="https://example.com/a.png" alt="a" />', ""), true);
  });
});

test("convertClipboardHtmlToMarkdown resolves relative links and images against clipboard base href", () => {
  withDom(() => {
    const markdown = convertClipboardHtmlToMarkdown(`
      <base href="https://example.com/posts/123/" />
      <p><a href="../docs/guide">Guide</a></p>
      <img alt="hero" src="./hero.png" />
    `);

    assert.match(markdown, /\[Guide\]\(https:\/\/example\.com\/posts\/docs\/guide\)/);
    assert.match(markdown, /!\[hero\]\(https:\/\/example\.com\/posts\/123\/hero\.png\)/);
  });
});

test("convertClipboardHtmlToMarkdown keeps clickable web images as linked markdown images", () => {
  withDom(() => {
    const href =
      "https://qiita-user-contents.imgix.net/https%3A%2F%2Fqiita-image-store.s3.ap-northeast-1.amazonaws.com%2F0%2F3963468%2F2bdbcd04-ec6d-4399-be9a-7e7138c94e38.png?ixlib=rb-4.0.0&auto=format&gif-q=60&q=75&s=cbde874b5afd136fda68ae0e0923a332";
    const markdown = convertClipboardHtmlToMarkdown(`
      <a href="${href}">
        <img
          alt="image.png"
          src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/3963468/2bdbcd04-ec6d-4399-be9a-7e7138c94e38.png"
        />
      </a>
    `);

    assert.equal(markdown, `[![image.png](${href})](${href})`);
  });
});

test("markdown-looking pasted text is handled before HTML conversion", () => {
  const markdownSnippetIndex = appSource.indexOf("if (pastedText && editorFocused && looksLikeMarkdownSnippet(pastedText)) {");
  const structuredHtmlIndex = appSource.indexOf("if (hasStructuredClipboardHtml(pastedHtml, pastedText)) {");
  assert.ok(markdownSnippetIndex >= 0);
  assert.ok(structuredHtmlIndex >= 0);
  assert.ok(markdownSnippetIndex < structuredHtmlIndex);
});

test("editor copy writes markdown clipboard data for external markdown-aware paste targets", () => {
  assert.match(appSource, /function serializeEditorSelectionForClipboard\(view\)/);
  assert.match(appSource, /async function writeClipboardFromSerialized\(view, serialized, cut\)/);
  assert.match(appSource, /await window\.editorApi\.writeClipboard\(\{ html: finalHtml, text: finalMarkdown \}\);/);
  assert.match(appSource, /void writeClipboardFromSerialized\(view, serialized, cut\);/);
});

test("editor copy can inline local asset images before writing clipboard payloads", () => {
  assert.match(appSource, /async function embedLocalImagesInClipboardContent\(html, markdownText\)/);
  assert.match(appSource, /img\[src\^="inkdown-asset:\/\/"\]/);
  assert.match(appSource, /await window\.editorApi\.readFileAsBase64\(filePath\)/);
  assert.match(appSource, /markdownWithImages = markdownWithImages\.replace\(new RegExp\(escaped, "g"\), dataUrl\);/);
});

test("hasStructuredClipboardHtml treats paragraph-based article wrappers as structured web content", () => {
  withDom(() => {
    const html = '<article><p>First paragraph</p><p>Second paragraph</p></article>';
    assert.equal(hasStructuredClipboardHtml(html, 'First paragraph\n\nSecond paragraph'), true);
  });
});

test("generic multiline plain text does not count as markdown snippet by itself", () => {
  assert.doesNotMatch(
    appSource,
    /return \/\^\(#{1,6}\\s\|>\\s\|\[-\*\+]\\s\|\\d\+\\.\\s\|\[-\*\+]\\s\\\[\(\?: \|x\|X\)\\\]\\s\|```\|~~~\|\\\|\.\+\\\|\)\/m\.test\(text\) \|\| \/\\n\/\.test\(text\);/
  );
});

