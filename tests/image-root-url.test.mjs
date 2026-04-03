import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { resolveTyporaRootUrlAsset } from "../src/renderer/utils/imageRoots.mjs";

const appSource = await fs.readFile(new URL("../src/renderer/App.jsx", import.meta.url), "utf8");

test("resolveTyporaRootUrlAsset maps leading-slash image paths onto local typora-root-url prefixes", () => {
  assert.equal(
    resolveTyporaRootUrlAsset("/blog/img/test.png", "/Users/abner/Website/typora.io/"),
    "/Users/abner/Website/typora.io/blog/img/test.png"
  );
});

test("resolveTyporaRootUrlAsset keeps external image urls untouched", () => {
  assert.equal(
    resolveTyporaRootUrlAsset("https://cdn.example.com/cat.png", "/Users/abner/Website/typora.io/"),
    "https://cdn.example.com/cat.png"
  );
});

test("resolveTyporaRootUrlAsset resolves website roots through URL joining", () => {
  assert.equal(
    resolveTyporaRootUrlAsset("/blog/img/test.png", "https://typora.io/"),
    "https://typora.io/blog/img/test.png"
  );
});

test("image rendering paths honor typora-root-url front matter in editor and preview", () => {
  assert.ok(appSource.includes('function resolveMarkdownImageAsset(documentPath, assetPath, frontMatterData = null, resolveAsset = window.editorApi.resolveMarkdownAsset) {'));
  assert.ok(appSource.includes('const typoraRootUrl = frontMatterData && typeof frontMatterData === "object" ? frontMatterData["typora-root-url"] : null;'));
  assert.ok(appSource.includes('const rootedAssetPath = resolveTyporaRootUrlAsset(assetPath, typoraRootUrl);'));
  assert.ok(appSource.includes('const { body, data } = extractYamlFrontMatter(markdown);'));
  assert.ok(appSource.includes('window.editorApi.resolveMarkdownAsset,\n    data'));
  assert.ok(appSource.includes('resolveImageSources(html, currentFilePath, resolveAsset, frontMatterData = null)'));
  assert.ok(appSource.includes('resolveMarkdownImageAsset(currentFilePath, markdownSource, frontMatterData, resolveAsset)'));
  assert.ok(appSource.includes('resolveMarkdownImageAsset(filePathRef.current, assetPath, extractYamlFrontMatter(markdownText).data, window.editorApi.resolveMarkdownAsset)'));
});


