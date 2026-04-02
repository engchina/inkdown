import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { getDelayedHeadingTransform } from "../src/renderer/utils/editorStructuredEditing.mjs";
import { isTableOfContentsToken } from "../src/renderer/utils/tableOfContents.mjs";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");
const stylesSource = await fs.readFile(new URL("../src/renderer/styles/app.css", import.meta.url), "utf8");

test("editor context still describes current block and routes through toolbar state", () => {
  assert.match(appSource, /const editorObjectContext = useMemo/);
  assert.match(appSource, /const toolbarContext = useMemo/);
  assert.match(appSource, /pane: "Editor"/);
  assert.match(appSource, /kind: editorObjectContext\?\.kind \|\| "paragraph"/);
  assert.match(appSource, /label: editorObjectContext\?\.label \|\| "Paragraph"/);
  assert.match(appSource, /selection instanceof NodeSelection && selection\.node\?\.type\?\.name === "image"/);
  assert.match(appSource, /kind: "image", label: "Image"/);
  assert.match(appSource, /selection instanceof NodeSelection && selection\.node\?\.type\?\.name === "tableOfContents"/);
  assert.match(appSource, /kind: "toc", label: "Table of contents"/);
});

test("styles keep shared toolbar emphasis states", () => {
  assert.match(stylesSource, /\.toolbar-section\.active \{/);
  assert.match(stylesSource, /\.toolbar-section\.active \.toolbar-section-label \{/);
  assert.match(stylesSource, /\.editor-image-node \{/);
  assert.match(stylesSource, /\.editor-image-markdown-block \{/);
  assert.match(stylesSource, /overflow: hidden;/);
  assert.match(stylesSource, /resize: none;/);
  assert.match(stylesSource, /\.toc-node-toolbar \{/);
  assert.match(stylesSource, /\.toc-delete-button \{/);
  assert.match(stylesSource, /\.editor-toc-node \.toc-item \{/);
  assert.match(stylesSource, /color: var\(--accent\);/);
  assert.match(stylesSource, /\.editor-toc-node \.toc-item:hover \{/);
});

test("smart heading transform and slash commands support heading levels four through six", () => {
  assert.match(appSource, /function applyEditorDelayedHeadingTransform\(view\)/);
  assert.match(appSource, /getDelayedHeadingTransform\(parent\.textContent, true\)/);
  assert.match(appSource, /toggleHeading\(\{ level: headingShortcut\.level \}\)\.insertContent\(headingShortcut\.title\)\.run\(\)/);
  assert.deepEqual(getDelayedHeadingTransform("#### Title", true), { level: 4, title: "Title" });
  assert.deepEqual(getDelayedHeadingTransform("##### Title", true), { level: 5, title: "Title" });
  assert.deepEqual(getDelayedHeadingTransform("###### Title", true), { level: 6, title: "Title" });
  assert.equal(getDelayedHeadingTransform("## Title", false), null);
  assert.match(appSource, /id: "heading-4"/);
  assert.match(appSource, /id: "heading-5"/);
  assert.match(appSource, /id: "heading-6"/);
  assert.match(appSource, /toggleHeading\(\{ level: 4 \}\)/);
  assert.match(appSource, /toggleHeading\(\{ level: 5 \}\)/);
  assert.match(appSource, /toggleHeading\(\{ level: 6 \}\)/);
  assert.match(appSource, /togglePrefixedSourceLines\("#### "/);
  assert.match(appSource, /togglePrefixedSourceLines\("##### "/);
  assert.match(appSource, /togglePrefixedSourceLines\("###### "/);
});

test("selected editor images expose an inline editable markdown block", () => {
  assert.match(appSource, /function formatMarkdownImageSnippet\(\{ alt = "", url = "", title = "" \} = \{\}\)/);
  assert.match(appSource, /function parseMarkdownImageSnippet\(value\)/);
  assert.match(appSource, /function unescapeMarkdownImageText\(value\)/);
  assert.match(appSource, /\(\(\?:\\\\\.|\[\^\\\\\\\]\]\)\*\)/);
  assert.match(appSource, /alt: unescapeMarkdownImageText\(match\[1\] \|\| ""\)/);
  assert.match(appSource, /title: unescapeMarkdownImageText\(String\(match\[3\] \|\| ""\)\.trim\(\)\.replace/);
  assert.match(appSource, /function ImageNodeView\(\{ editor, extension, getPos, node, selected, updateAttributes \}\)/);
  assert.match(appSource, /return ReactNodeViewRenderer\(ImageNodeView\)/);
  assert.match(appSource, /parseHTML: \(element\) => element\.getAttribute\("title"\)/);
  assert.match(appSource, /renderHTML: \(attributes\) => \(attributes\.title \? \{ title: attributes\.title \} : \{\}\)/);
  assert.match(appSource, /className=\{`editor-image-node\$\{shown \? " is-selected" : ""\}`\}/);
  assert.match(appSource, /className="editor-image-markdown-block"/);
  assert.match(appSource, /className=\{`editor-image-markdown-input\$\{draftError \? " invalid" : ""\}`\}/);
  assert.match(appSource, /className="editor-image-markdown-block"[\s\S]*<img/);
  assert.match(appSource, /function applyMarkdown\(nextValue = draft\)/);
  assert.match(appSource, /updateAttributes\(nextAttrs\)/);
  assert.match(appSource, /selectedImage\?\.attrs\?\.alt \|\| alt/);
  assert.match(appSource, /title: selectedImage\?\.attrs\?\.title \|\| null/);
  assert.match(appSource, /setTextSelection\(linkDialogState\.linkRange\)[\s\S]*setLink\(\{ href, title: normalizedTitle \|\| null \}\)\.run\(\)/);
  assert.match(appSource, /setTextSelection\(linkDialogState\.linkRange\)[\s\S]*unsetLink\(\)[\s\S]*\.run\(\)/);
  assert.match(appSource, /const HeadingWithAnchors = Heading\.extend\(\{/);
  assert.match(appSource, /parseHTML: \(element\) => element\.getAttribute\("id"\)/);
  assert.match(appSource, /renderHTML: \(attributes\) => \(attributes\.id \? \{ id: attributes\.id \} : \{\}\)/);
  assert.match(appSource, /HeadingWithAnchors\.configure\(\{ levels: \[1, 2, 3, 4, 5, 6\] \}\)/);
  assert.match(appSource, /TokenLink\.configure\(\{ openOnClick: false, autolink: true, defaultProtocol: "https" \}\)/);
  assert.match(appSource, /void activatePreviewLink\(target, view\.dom, \{/);
  assert.match(appSource, /openExternal: \(targetUrl\) => window\.editorApi\.openExternal\(targetUrl\)/);
});

test("table of contents tokens render as dedicated editor nodes", () => {
  assert.equal(isTableOfContentsToken("[TOC]"), true);
  assert.equal(isTableOfContentsToken("[toc]"), true);
  assert.equal(isTableOfContentsToken("  [ToC]  "), true);
  assert.equal(isTableOfContentsToken("[TOC] later"), false);
  assert.match(appSource, /const TableOfContentsNode = TiptapNode\.create\(/);
  assert.match(appSource, /name: "tableOfContents"/);
  assert.match(appSource, /atom: true/);
  assert.match(appSource, /contentEditable=\{false\}/);
  assert.match(appSource, /<nav className="table-of-contents" data-toc-token="true">/);
  assert.match(appSource, /data-toc-target=\{`#\$\{item\.domId\}`\}/);
  assert.match(appSource, /aria-label=\{`Jump to \$\{item\.text\}`\}/);
  assert.match(appSource, /onSelectItem\?\.\(item\)/);
  assert.match(appSource, /if \(parent\.type\.name === "paragraph" && \$from\.depth === 1\)/);
  assert.match(appSource, /if \(isTableOfContentsToken\(nextText\)\)/);
  assert.match(appSource, /view\.state\.schema\.nodes\.tableOfContents/);
  assert.match(appSource, /TableOfContentsNode\.configure\(\{\s*getOutline: \(\) => outlineRef\.current,\s*onSelectItem: \(item\) => jumpToEditorHeadingFromToc\(item\)/s);
  assert.match(appSource, /function jumpToEditorHeadingFromToc\(item\)/);
  assert.match(appSource, /function scrollEditorHeadingIntoView\(item, position\)/);
  assert.match(appSource, /function activateEditorLinkTarget\(href\)/);
  assert.match(appSource, /void activateEditorLinkTarget\(href\);/);
  assert.match(appSource, /return activatePreviewLink\(anchorLike, editorRoot, \{/);
  assert.match(appSource, /scrollEditorHeadingIntoView\(item, editorHeading\.pos\);/);
  assert.doesNotMatch(appSource, /editor\?\.chain\(\)\.focus\(editorHeading\.pos\)\.run\(\)/);
  assert.match(appSource, /return `<nav class="table-of-contents" data-toc-token="true">/);
});
