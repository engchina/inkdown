import React, { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Mark, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { Marked } from "marked";
import markedKatex from "marked-katex-extension";
import TurndownService from "turndown";
import katexStyles from "katex/dist/katex.min.css?inline";
import Toolbar from "./components/Toolbar";
import Sidebar from "./components/Sidebar";
import StatusBar from "./components/StatusBar";
import FindReplaceBar from "./components/FindReplaceBar";
import MarkdownPreview, { renderPreviewHtml } from "./components/MarkdownPreview";
import PreferencesDialog from "./components/PreferencesDialog";

const editorMarked = new Marked({ gfm: true, breaks: true });
const previewMarked = new Marked({ gfm: true, breaks: true });

previewMarked.use(
  markedKatex({
    throwOnError: false,
    nonStandard: true
  })
);

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*"
});

const defaultPreferences = {
  theme: "paper",
  viewMode: "editor",
  fontSize: 18,
  lineWidth: 900,
  sidebarVisible: true,
  sidebarTab: "outline",
  focusMode: false,
  typewriterMode: false,
  workspaceRoot: null
};

const initialMarkdown = `---
title: Inkdown
tags:
  - typora
  - markdown
---

# Inkdown

[TOC]

This is an immersive Markdown editor inspired by Typora.

## Core Typora-style features included

- Live WYSIWYG editing
- File tree, outline, and find/replace
- Images, tables, and task lists
- Mermaid, math, and export support

## Extended Markdown

==Highlight==, H~2~O, x^2^, and footnotes[^inkdown] all render in preview.

> [!NOTE]
> GitHub-style callouts from the Typora reference pages are supported.

[^inkdown]: This footnote also supports inline **Markdown** formatting.

## Math and diagrams

Inline formula: \\(E = mc^2\\)

Block formula:

\\[
\\int_0^1 x^2 dx = \\frac{1}{3}
\\]

\`\`\`mermaid
graph TD
  A[Markdown] --> B[Preview]
  B --> C[Export]
\`\`\`

\`\`\`math
f(x) = \\sum_{n=0}^{\\infty}\\frac{x^n}{n!}
\`\`\`
`;

const MarkdownImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      markdownSource: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-md-src"),
        renderHTML: (attributes) => (attributes.markdownSource ? { "data-md-src": attributes.markdownSource } : {})
      },
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute("width"),
        renderHTML: (attributes) => (attributes.width ? { width: attributes.width } : {})
      },
      height: {
        default: null,
        parseHTML: (element) => element.getAttribute("height"),
        renderHTML: (attributes) => (attributes.height ? { height: attributes.height } : {})
      }
    };
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setImage:
        (options) =>
        ({ tr, dispatch }) => {
          const node = this.type.create(options);
          if (dispatch) {
            tr.replaceSelectionWith(node);
          }
          return true;
        }
    };
  }
});

function capitalize(value) {
  return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
}

function createInlineTagMark(name, tagName) {
  const commandSuffix = capitalize(name);
  return Mark.create({
    name,
    inclusive: false,
    parseHTML() {
      return [{ tag: tagName }];
    },
    renderHTML({ HTMLAttributes }) {
      return [tagName, mergeAttributes(HTMLAttributes), 0];
    },
    addCommands() {
      return {
        [`set${commandSuffix}`]:
          () =>
          ({ commands }) =>
            commands.setMark(this.name),
        [`toggle${commandSuffix}`]:
          () =>
          ({ commands }) =>
            commands.toggleMark(this.name),
        [`unset${commandSuffix}`]:
          () =>
          ({ commands }) =>
            commands.unsetMark(this.name)
      };
    }
  });
}

const Highlight = createInlineTagMark("highlight", "mark");
const Subscript = createInlineTagMark("subscript", "sub");
const Superscript = createInlineTagMark("superscript", "sup");

const calloutLabels = {
  note: "Note",
  tip: "Tip",
  important: "Important",
  warning: "Warning",
  caution: "Caution"
};

function basenamePath(filePath) {
  if (!filePath) {
    return "Untitled";
  }
  const parts = String(filePath).split(/[\\/]/);
  return parts[parts.length - 1] || "Untitled";
}

function dirnamePath(filePath) {
  if (!filePath) {
    return null;
  }
  const normalized = String(filePath).replace(/[\\/]+$/, "");
  const index = Math.max(normalized.lastIndexOf("\\"), normalized.lastIndexOf("/"));
  return index >= 0 ? normalized.slice(0, index) : null;
}

function normalizeComparablePath(filePath) {
  return String(filePath || "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function isFileInsideRoot(filePath, rootPath) {
  const normalizedFile = normalizeComparablePath(filePath);
  const normalizedRoot = normalizeComparablePath(rootPath);
  return normalizedFile === normalizedRoot || normalizedFile.startsWith(`${normalizedRoot}/`);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeDomIdFragment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "note";
}

function slugifyHeading(text, slugCounts) {
  const baseSlug =
    String(text || "")
      .toLowerCase()
      .replace(/<[^>]+>/g, "")
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-") || "section";
  const nextCount = (slugCounts.get(baseSlug) || 0) + 1;
  slugCounts.set(baseSlug, nextCount);
  return nextCount === 1 ? baseSlug : `${baseSlug}-${nextCount}`;
}

function replaceOutsideCodeSpans(value, transform) {
  return String(value || "")
    .split(/(`+[^`]*`+)/g)
    .map((segment) => (segment.startsWith("`") ? segment : transform(segment)))
    .join("");
}

function applyExtendedInlineSyntax(value) {
  return replaceOutsideCodeSpans(value, (segment) =>
    segment
      .replace(/==(?=\S)([\s\S]*?\S)==/g, "<mark>$1</mark>")
      .replace(/(^|[^~])~(?=\S)([^~\n]+?\S)~(?!~)/g, (_, prefix, content) => `${prefix}<sub>${content}</sub>`)
      .replace(/\^(?=\S)([^^\n]+?\S)\^/g, "<sup>$1</sup>")
  );
}

function extractYamlFrontMatter(markdown) {
  const value = String(markdown || "");
  const match = /^(---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.))(\r?\n+|$)/.exec(value);
  if (!match) {
    return { raw: "", content: "", body: value };
  }
  const raw = `${match[1]}${match[2] || "\n\n"}`;
  const content = match[1]
    .replace(/^---\r?\n/, "")
    .replace(/\r?\n(?:---|\.\.\.)$/, "");
  return {
    raw,
    content,
    body: value.slice(raw.length)
  };
}

function prependFrontMatter(rawFrontMatter, markdownBody) {
  const body = String(markdownBody || "").trimStart();
  if (!rawFrontMatter) {
    return body;
  }
  if (!body) {
    return rawFrontMatter.trimEnd();
  }
  return `${rawFrontMatter}${body}`;
}

function buildRawFrontMatter(content) {
  const normalized = String(content || "").replace(/^\r?\n+|\r?\n+$/g, "");
  if (!normalized.trim()) {
    return "";
  }
  return `---\n${normalized}\n---\n\n`;
}

function serializeEditorHtmlToMarkdown(html) {
  const container = document.createElement("div");
  container.innerHTML = String(html || "");
  const frontMatterNode = container.querySelector(":scope > .yaml-front-matter");
  const rawFrontMatter = frontMatterNode ? buildRawFrontMatter(frontMatterNode.textContent || "") : "";
  if (frontMatterNode) {
    frontMatterNode.remove();
  }
  return prependFrontMatter(rawFrontMatter, turndown.turndown(container.innerHTML));
}

function extractFootnotes(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const bodyLines = [];
  const definitions = new Map();
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^```/.test(line)) {
      inFence = !inFence;
      bodyLines.push(line);
      continue;
    }

    if (!inFence) {
      const definitionMatch = /^\[\^([^\]]+)\]:\s*(.*)$/.exec(line);
      if (definitionMatch) {
        const id = definitionMatch[1].trim();
        const definitionLines = [definitionMatch[2]];
        let nextIndex = index + 1;
        while (nextIndex < lines.length) {
          const nextLine = lines[nextIndex];
          if (/^(?:\s{2,}|\t)/.test(nextLine)) {
            definitionLines.push(nextLine.replace(/^(?:\t| {1,4})/, ""));
            nextIndex += 1;
            continue;
          }
          if (nextLine.trim() === "" && nextIndex + 1 < lines.length && /^(?:\s{2,}|\t)/.test(lines[nextIndex + 1])) {
            definitionLines.push("");
            nextIndex += 1;
            continue;
          }
          break;
        }
        definitions.set(id, definitionLines.join("\n").trim());
        index = nextIndex - 1;
        continue;
      }
    }

    bodyLines.push(line);
  }

  return {
    body: bodyLines.join("\n").trimEnd(),
    definitions
  };
}

function applyFootnoteReferences(markdown, definitions) {
  const numbering = new Map();
  const order = [];
  const body = replaceOutsideCodeSpans(markdown, (segment) =>
    segment.replace(/\[\^([^\]]+)\]/g, (match, rawId) => {
      const id = String(rawId || "").trim();
      if (!definitions.has(id)) {
        return match;
      }
      if (!numbering.has(id)) {
        numbering.set(id, order.length + 1);
        order.push(id);
      }
      const number = numbering.get(id);
      const domId = sanitizeDomIdFragment(id);
      return `<sup class="footnote-ref" id="fnref-${domId}"><a href="#fn-${domId}">${number}</a></sup>`;
    })
  );

  return { body, order, numbering };
}

function preprocessMarkdownSyntax(markdown, options = {}) {
  const { enableExtendedInlineSyntax = false } = options;
  const lines = String(markdown || "").split(/\r?\n/);
  const parts = [];
  let normalLines = [];
  let fenceLines = [];
  let inFence = false;
  let fenceLanguage = "";

  const normalizeMathSyntax = (value) =>
    value
      .replace(/\\\[((?:.|\r?\n)*?)\\\]/g, (_, content) => `\n$$\n${content.trim()}\n$$\n`)
      .replace(/\\\((.+?)\\\)/g, (_, content) => `$${content.trim()}$`);

  const normalizeInlineSyntax = (value) => {
    const normalized = normalizeMathSyntax(value);
    return enableExtendedInlineSyntax ? applyExtendedInlineSyntax(normalized) : normalized;
  };

  const flushNormal = () => {
    if (normalLines.length === 0) {
      return;
    }
    parts.push(normalizeInlineSyntax(normalLines.join("\n")));
    normalLines = [];
  };

  lines.forEach((line) => {
    const fenceMatch = /^```(\w+)?/.exec(line);
    if (!inFence && fenceMatch) {
      flushNormal();
      inFence = true;
      fenceLanguage = (fenceMatch[1] || "").toLowerCase();
      fenceLines = [line];
      return;
    }

    if (inFence) {
      fenceLines.push(line);
      if (/^```/.test(line)) {
        if (fenceLanguage === "math") {
          const content = fenceLines.slice(1, -1).join("\n").trim();
          parts.push(`$$\n${content}\n$$`);
        } else {
          parts.push(fenceLines.join("\n"));
        }
        inFence = false;
        fenceLanguage = "";
        fenceLines = [];
      }
      return;
    }

    normalLines.push(line);
  });

  flushNormal();

  if (fenceLines.length > 0) {
    parts.push(fenceLines.join("\n"));
  }

  return parts.join("\n");
}

function extractOutlineFromMarkdown(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const slugCounts = new Map();
  let inFence = false;
  return lines
    .map((line, index) => {
      if (/^```/.test(line)) {
        inFence = !inFence;
      }
      if (inFence) {
        return null;
      }
      const match = /^(#{1,6})\s+(.*)$/.exec(line);
      if (!match) {
        return null;
      }
      const text = match[2].trim() || "Untitled";
      const slug = slugifyHeading(text, slugCounts);
      return { id: `heading-${slug}-${index}`, domId: slug, level: match[1].length, line: index, text };
    })
    .filter(Boolean);
}

function buildTableOfContentsHtml(outline) {
  if (!outline.length) {
    return '<div class="toc-empty">No headings available.</div>';
  }
  const items = outline
    .map((item) => `<a class="toc-item level-${item.level}" href="#${escapeHtml(item.domId)}">${escapeHtml(item.text)}</a>`)
    .join("");
  return `<nav class="table-of-contents"><div class="toc-title">Table of Contents</div>${items}</nav>`;
}

function escapeMarkdownImageAlt(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function escapeMarkdownTitle(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatMarkdownImageSource(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  return /[\s()]/.test(normalized) ? `<${normalized}>` : normalized;
}

function escapeTableCell(content) {
  const normalized = content.replace(/\r?\n/g, "<br>").replace(/\|/g, "\\|").trim();
  return normalized || " ";
}

function serializeTableCell(cell) {
  const markdown = turndown.turndown(cell.innerHTML || "").trim();
  return escapeTableCell(markdown || cell.textContent || "");
}

function serializeTable(node) {
  const rows = Array.from(node.rows || []);
  if (rows.length === 0) {
    return "";
  }

  const columnCount = Math.max(...rows.map((row) => row.cells.length));
  if (columnCount === 0) {
    return "";
  }

  const toMarkdownRow = (row) => {
    const cells = Array.from(row.cells || []);
    const values = Array.from({ length: columnCount }, (_, index) =>
      cells[index] ? serializeTableCell(cells[index]) : " "
    );
    return `| ${values.join(" | ")} |`;
  };

  const headerRow = toMarkdownRow(rows[0]);
  const dividerRow = `| ${Array.from({ length: columnCount }, () => "---").join(" | ")} |`;
  const bodyRows = rows.slice(1).map(toMarkdownRow);
  return `\n\n${[headerRow, dividerRow, ...bodyRows].join("\n")}\n\n`;
}

function resolveImageSources(html, currentFilePath, resolveAsset) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  temp.querySelectorAll("img").forEach((image) => {
    const source = image.getAttribute("src");
    if (!source) {
      return;
    }
    const markdownSource = image.getAttribute("data-md-src") || source;
    image.setAttribute("data-md-src", markdownSource);
    image.setAttribute("src", resolveAsset(currentFilePath, markdownSource));
  });
  return temp;
}

function buildYamlFrontMatterElement(content) {
  const wrapper = document.createElement("section");
  wrapper.className = "yaml-front-matter";

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = String(content || "");
  pre.appendChild(code);
  wrapper.appendChild(pre);

  return wrapper;
}

function decorateCalloutBlockquotes(container) {
  Array.from(container.querySelectorAll("blockquote")).forEach((blockquote) => {
    const firstParagraph = blockquote.querySelector(":scope > p:first-child");
    const firstLine = firstParagraph?.textContent?.trim() || "";
    const match = /^\[!([A-Z]+)\]\s*(.*)$/.exec(firstLine);
    if (!match) {
      return;
    }

    const type = match[1].toLowerCase();
    if (!calloutLabels[type]) {
      return;
    }

    blockquote.classList.add("callout", `callout-${type}`);
    const title = document.createElement("div");
    title.className = "callout-title";
    title.textContent = match[2] || calloutLabels[type];
    blockquote.insertBefore(title, blockquote.firstChild);
    firstParagraph.remove();
  });
}

function renderMarkdownFragment(markdown, currentFilePath, resolveAsset) {
  const container = resolveImageSources(
    previewMarked.parse(preprocessMarkdownSyntax(markdown, { enableExtendedInlineSyntax: true })),
    currentFilePath,
    resolveAsset
  );
  decorateCalloutBlockquotes(container);
  return container.innerHTML;
}

function buildFootnotesElement(definitions, order, currentFilePath, resolveAsset) {
  if (!order.length) {
    return null;
  }

  const section = document.createElement("section");
  section.className = "footnotes";
  section.innerHTML = '<div class="footnotes-title">Footnotes</div>';

  const list = document.createElement("ol");
  order.forEach((id) => {
    const domId = sanitizeDomIdFragment(id);
    const item = document.createElement("li");
    item.id = `fn-${domId}`;
    item.innerHTML = `${renderMarkdownFragment(definitions.get(id) || "", currentFilePath, resolveAsset)} <a class="footnote-backref" href="#fnref-${domId}">↩</a>`;
    list.appendChild(item);
  });
  section.appendChild(list);

  return section;
}

function decorateRenderedHtml(container, outline, options = {}) {
  const { frontMatterContent = "", enableCallouts = false, footnotes = null, currentFilePath = null, resolveAsset } = options;

  if (frontMatterContent) {
    container.prepend(buildYamlFrontMatterElement(frontMatterContent));
  }

  Array.from(container.querySelectorAll("h1, h2, h3, h4, h5, h6")).forEach((heading, index) => {
    const item = outline[index];
    if (!item) {
      return;
    }
    heading.id = item.domId;
    heading.dataset.headingId = item.id;
  });

  container.querySelectorAll("p").forEach((paragraph) => {
    if (paragraph.textContent?.trim().toUpperCase() === "[TOC]") {
      paragraph.outerHTML = buildTableOfContentsHtml(outline);
    }
  });

  container.querySelectorAll("pre > code.language-mermaid").forEach((node) => {
    const wrapper = document.createElement("div");
    wrapper.className = "mermaid";
    wrapper.textContent = node.textContent || "";
    node.parentElement.replaceWith(wrapper);
  });

  if (enableCallouts) {
    decorateCalloutBlockquotes(container);
  }

  if (footnotes?.order?.length && resolveAsset) {
    const footnotesElement = buildFootnotesElement(footnotes.definitions, footnotes.order, currentFilePath, resolveAsset);
    if (footnotesElement) {
      container.appendChild(footnotesElement);
    }
  }

  return container.innerHTML;
}

function renderMarkdownForEditor(markdown, currentFilePath, outline) {
  const { content: frontMatterContent, body } = extractYamlFrontMatter(markdown);
  const container = resolveImageSources(
    editorMarked.parse(preprocessMarkdownSyntax(body, { enableExtendedInlineSyntax: true })),
    currentFilePath,
    window.editorApi.resolveMarkdownAsset
  );
  return decorateRenderedHtml(container, outline, { frontMatterContent });
}

function renderMarkdownForPreview(markdown, currentFilePath, outline, resolveAsset = window.editorApi.resolveMarkdownAsset) {
  const { body: withoutFrontMatter } = extractYamlFrontMatter(markdown);
  const { body: withoutFootnotes, definitions } = extractFootnotes(withoutFrontMatter);
  const { body, order } = applyFootnoteReferences(
    preprocessMarkdownSyntax(withoutFootnotes, { enableExtendedInlineSyntax: true }),
    definitions
  );
  const container = resolveImageSources(
    previewMarked.parse(body),
    currentFilePath,
    resolveAsset
  );
  return decorateRenderedHtml(container, outline, {
    enableCallouts: true,
    footnotes: { definitions, order },
    currentFilePath,
    resolveAsset
  });
}

function buildStandaloneHtml(title, bodyHtml, theme) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      ${katexStyles}
      :root { color-scheme: ${theme === "midnight" ? "dark" : "light"}; }
      body {
        max-width: 900px;
        margin: 0 auto;
        padding: 48px 24px 96px;
        font: 18px/1.8 "Segoe UI", "Microsoft YaHei", sans-serif;
        color: ${theme === "midnight" ? "#e8eef8" : "#1d232e"};
        background: ${theme === "midnight" ? "#0f1724" : theme === "forest" ? "#eef5ee" : "#faf7f1"};
      }
      img { max-width: 100%; border-radius: 12px; }
      pre { overflow-x: auto; padding: 16px; border-radius: 14px; background: ${theme === "midnight" ? "#1c2434" : "#22252b"}; color: #f5f7fa; }
      code { font-family: "Cascadia Code", "JetBrains Mono", monospace; }
      mark { padding: 0.08em 0.32em; border-radius: 0.36em; background: ${theme === "midnight" ? "#5a4300" : "#ffe08a"}; color: inherit; }
      sub, sup { font-size: 0.78em; }
      blockquote:not(.callout) {
        min-height: 1.6em;
        margin: 1.15em 0;
        padding: 0.35em 0 0.35em 1em;
        border-left: 3px solid ${
          theme === "midnight"
            ? "rgba(148, 163, 184, 0.5)"
            : theme === "forest"
              ? "rgba(5, 150, 105, 0.28)"
              : "rgba(79, 70, 229, 0.26)"
        };
        border-radius: 0 10px 10px 0;
        background: linear-gradient(
          90deg,
          ${
            theme === "midnight"
              ? "rgba(30, 41, 59, 0.52)"
              : theme === "forest"
                ? "rgba(255, 255, 255, 0.48)"
                : "rgba(255, 255, 255, 0.52)"
          } 0%,
          transparent 82%
        );
        color: ${theme === "midnight" ? "#d3dbe8" : theme === "forest" ? "#065f46" : "#5b6476"};
      }
      blockquote:not(.callout) > :first-child { margin-top: 0; }
      blockquote:not(.callout) > :last-child { margin-bottom: 0; }
      blockquote:not(.callout) p { margin: 0.45em 0; }
      blockquote:not(.callout) blockquote:not(.callout) {
        min-height: 0;
        margin: 0.7em 0 0.35em;
        padding-left: 0.9em;
        border-left-width: 2px;
        border-radius: 0 8px 8px 0;
        background: none;
      }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid rgba(160, 160, 160, 0.3); padding: 10px 12px; }
      .table-of-contents { display: grid; gap: 8px; padding: 16px 18px; border: 1px solid rgba(160, 160, 160, 0.24); border-radius: 14px; background: rgba(255, 255, 255, 0.6); }
      .toc-title { font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
      .toc-item { color: inherit; text-decoration: none; }
      .toc-item.level-2 { padding-left: 12px; }
      .toc-item.level-3 { padding-left: 24px; }
      .toc-item.level-4, .toc-item.level-5, .toc-item.level-6 { padding-left: 36px; }
      .footnotes-title { margin-bottom: 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: ${theme === "midnight" ? "#b8c7d9" : "#69553f"}; }
      .callout { position: relative; padding: 14px 16px 14px 18px; border: 1px solid rgba(160, 160, 160, 0.24); border-radius: 16px; background: rgba(255, 255, 255, 0.6); }
      .callout::before { content: ""; position: absolute; inset: 10px auto 10px 0; width: 4px; border-radius: 999px; background: #9a5a26; }
      .callout-title { margin-bottom: 6px; font-size: 13px; font-weight: 700; color: inherit; }
      .callout-note::before { background: #3b82f6; }
      .callout-tip::before { background: #16a34a; }
      .callout-important::before { background: #7c3aed; }
      .callout-warning::before { background: #d97706; }
      .callout-caution::before { background: #dc2626; }
      .footnotes { margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(160, 160, 160, 0.24); }
      .footnote-backref { margin-left: 6px; text-decoration: none; }
      .mermaid { margin: 1.5rem 0; }
    </style>
  </head>
  <body>${bodyHtml}</body>
</html>`;
}

function buildEditorHeadingPositions(editor) {
  const headings = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      headings.push({ pos, text: node.textContent || "Untitled", level: node.attrs.level });
    }
  });
  return headings;
}

function countStats(markdown) {
  const text = String(markdown || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/[#>*_\-\[\]()!]/g, " ")
    .replace(/\s+/g, " ");
  const latinWords = text.match(/[A-Za-z0-9_]+(?:['-][A-Za-z0-9_]+)*/g) || [];
  const cjkChars = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) || [];
  const wordCount = latinWords.length + cjkChars.length;
  return {
    lineCount: Math.max(1, String(markdown || "").split(/\r?\n/).length),
    wordCount,
    charCount: String(markdown || "").length,
    readingMinutes: Math.max(1, Math.ceil((wordCount || 1) / 220))
  };
}

function isMarkdownFilePath(filePath) {
  return /\.(md|markdown|mdown|mkd|txt)$/i.test(filePath || "");
}

function findMatches(markdown, query) {
  if (!query) {
    return [];
  }
  const matches = [];
  let startIndex = 0;
  while (startIndex <= markdown.length) {
    const foundAt = markdown.indexOf(query, startIndex);
    if (foundAt === -1) {
      break;
    }
    matches.push({ start: foundAt, end: foundAt + query.length });
    startIndex = foundAt + query.length;
  }
  return matches;
}

function renderSourceHighlights(markdown, matches, currentIndex) {
  const text = String(markdown || "");
  if (matches.length === 0) {
    return text;
  }

  const segments = [];
  let cursor = 0;

  matches.forEach((match, index) => {
    if (match.start > cursor) {
      segments.push(
        <span key={`source-text-${cursor}`}>{text.slice(cursor, match.start)}</span>
      );
    }

    segments.push(
      <mark
        key={`source-match-${match.start}-${match.end}-${index}`}
        className={index === currentIndex ? "source-find-hit current" : "source-find-hit"}
      >
        {text.slice(match.start, match.end)}
      </mark>
    );

    cursor = match.end;
  });

  if (cursor < text.length) {
    segments.push(<span key={`source-text-tail-${cursor}`}>{text.slice(cursor)}</span>);
  }

  return segments;
}

function getLineStartIndex(markdown, lineNumber) {
  const lines = String(markdown || "").split(/\r?\n/);
  let offset = 0;
  for (let index = 0; index < lineNumber; index += 1) {
    offset += lines[index].length + 1;
  }
  return offset;
}

function getActiveEditorBlock(editor) {
  let view;
  let root;
  try {
    view = editor?.view;
    root = view?.dom;
  } catch {
    return null;
  }
  const selection = editor?.state?.selection;
  if (!view || !root || !selection) {
    return null;
  }

  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const blockPos = $from.before(depth);
    const domNode = view.nodeDOM(blockPos);
    if (!(domNode instanceof HTMLElement)) {
      continue;
    }

    let node = domNode;
    while (node && node.parentElement !== root) {
      node = node.parentElement;
    }

    if (node && node.parentElement === root) {
      return node;
    }
  }

  return root.firstElementChild instanceof HTMLElement ? root.firstElementChild : null;
}

function hasMountedEditorView(editor) {
  try {
    return editor?.view?.dom instanceof HTMLElement;
  } catch {
    return false;
  }
}

function getEditorScrollContainer(editor) {
  if (!hasMountedEditorView(editor)) {
    return null;
  }
  return editor.view.dom.closest(".editor-pane");
}

function restoreScrollPosition(container, scrollTop, scrollLeft) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  container.scrollTop = scrollTop;
  container.scrollLeft = scrollLeft;
}

function isNodeWithin(target, container) {
  return target instanceof Node && container instanceof Node && (target === container || container.contains(target));
}

function isEditingSurfaceTarget(editor, sourceElement, target) {
  const activeElement = document.activeElement;
  if (isNodeWithin(target, sourceElement) || isNodeWithin(activeElement, sourceElement)) {
    return true;
  }
  if (!hasMountedEditorView(editor)) {
    return false;
  }
  const editorRoot = editor.view.dom;
  return isNodeWithin(target, editorRoot) || isNodeWithin(activeElement, editorRoot);
}

function lockScrollPosition(container) {
  if (!(container instanceof HTMLElement)) {
    return () => {};
  }
  const scrollTop = container.scrollTop;
  const scrollLeft = container.scrollLeft;
  const handler = () => {
    container.scrollTop = scrollTop;
    container.scrollLeft = scrollLeft;
  };
  container.addEventListener("scroll", handler);
  return () => {
    handler();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.removeEventListener("scroll", handler);
      });
    });
  };
}

function getLineBoundaries(markdown, selectionStart, selectionEnd) {
  const start = Math.max(0, selectionStart ?? 0);
  const end = Math.max(start, selectionEnd ?? start);
  const lineStart = markdown.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextNewline = markdown.indexOf("\n", end);
  const lineEnd = nextNewline === -1 ? markdown.length : nextNewline;
  return { lineStart, lineEnd };
}

function placeCursorInTrailingParagraph(view) {
  const paragraphNode = view.state.schema.nodes.paragraph;
  if (!paragraphNode) {
    view.focus();
    return false;
  }

  const lastNode = view.state.doc.lastChild;
  const hasTrailingEmptyParagraph =
    lastNode?.type?.name === "paragraph" && lastNode.childCount === 0 && (lastNode.textContent || "") === "";

  let transaction = view.state.tr;
  if (!hasTrailingEmptyParagraph) {
    transaction = transaction.insert(transaction.doc.content.size, paragraphNode.create());
  }

  const endPos = transaction.doc.content.size;
  transaction = transaction.setSelection(TextSelection.create(transaction.doc, endPos)).scrollIntoView();
  view.dispatch(transaction);
  view.focus();
  return true;
}

turndown.addRule("taskListItems", {
  filter(node) {
    return node.nodeName === "LI" && node.getAttribute("data-type") === "taskItem";
  },
  replacement(content, node) {
    return `- [${node.getAttribute("data-checked") === "true" ? "x" : " "}] ${content.trim()}\n`;
  }
});

turndown.addRule("tables", {
  filter(node) {
    return node.nodeName === "TABLE";
  },
  replacement(content, node) {
    return serializeTable(node);
  }
});

turndown.addRule("images", {
  filter(node) {
    return node.nodeName === "IMG";
  },
  replacement(content, node) {
    const source = formatMarkdownImageSource(node.getAttribute("data-md-src") || node.getAttribute("src"));
    if (!source) {
      return "";
    }
    const alt = escapeMarkdownImageAlt(node.getAttribute("alt"));
    const title = node.getAttribute("title");
    return `\n\n![${alt}](${source}${title ? ` "${escapeMarkdownTitle(title)}"` : ""})\n\n`;
  }
});

turndown.addRule("yamlFrontMatter", {
  filter(node) {
    return node.nodeType === Node.ELEMENT_NODE && node.classList?.contains("yaml-front-matter");
  },
  replacement() {
    return "\n";
  }
});

turndown.addRule("tableOfContents", {
  filter(node) {
    return node.nodeType === Node.ELEMENT_NODE && node.classList?.contains("table-of-contents");
  },
  replacement() {
    return "\n\n[TOC]\n\n";
  }
});

turndown.addRule("highlight", {
  filter(node) {
    return node.nodeName === "MARK";
  },
  replacement(content) {
    return `==${content}==`;
  }
});

turndown.addRule("subscript", {
  filter(node) {
    return node.nodeName === "SUB";
  },
  replacement(content) {
    return `~${content}~`;
  }
});

turndown.addRule("superscript", {
  filter(node) {
    return node.nodeName === "SUP" && !node.classList?.contains("footnote-ref");
  },
  replacement(content) {
    return `^${content}^`;
  }
});

export default function App() {
  const [filePath, setFilePath] = useState(null);
  const [markdownText, setMarkdownText] = useState(initialMarkdown);
  const [documentSessionKey, setDocumentSessionKey] = useState(0);
  const [outline, setOutline] = useState(extractOutlineFromMarkdown(initialMarkdown));
  const [activeOutlineId, setActiveOutlineId] = useState(null);
  const [workspaceTree, setWorkspaceTree] = useState(null);
  const [sidebarFilter, setSidebarFilter] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Ready");

  const sourceRef = useRef(null);
  const sourceHighlightRef = useRef(null);
  const programmaticEditorSyncRef = useRef(false);
  const programmaticMarkdownSyncRef = useRef(false);
  const lastEditorMarkdownRef = useRef(initialMarkdown);
  const editorHeadingsRef = useRef([]);
  const statusTimerRef = useRef(null);
  const preferencesRef = useRef(defaultPreferences);

  const deferredMarkdown = useDeferredValue(markdownText);
  const matches = useMemo(() => findMatches(markdownText, findQuery), [markdownText, findQuery]);
  const stats = useMemo(() => countStats(markdownText), [markdownText]);
  const previewHtml = useMemo(
    () => renderMarkdownForPreview(deferredMarkdown, filePath, outline),
    [deferredMarkdown, filePath, outline]
  );
  const sourceHighlightContent = useMemo(
    () => renderSourceHighlights(markdownText, matches, matchIndex),
    [markdownText, matches, matchIndex]
  );

  function syncSourceHighlightScroll() {
    if (!sourceRef.current || !sourceHighlightRef.current) {
      return;
    }
    sourceHighlightRef.current.scrollTop = sourceRef.current.scrollTop;
    sourceHighlightRef.current.scrollLeft = sourceRef.current.scrollLeft;
  }

  function runEditorCommand(execute, { preserveScroll = true } = {}) {
    if (!editor) {
      return false;
    }

    const shouldPreserveScroll = preserveScroll && !preferencesRef.current.typewriterMode;
    const scrollContainer = shouldPreserveScroll ? getEditorScrollContainer(editor) : null;
    const scrollTop = scrollContainer?.scrollTop ?? 0;
    const scrollLeft = scrollContainer?.scrollLeft ?? 0;

    const restore = () => restoreScrollPosition(scrollContainer, scrollTop, scrollLeft);
    const scheduleRestore = () => {
      restore();
      window.requestAnimationFrame(() => {
        restore();
        window.requestAnimationFrame(restore);
      });
    };

    const result = execute(editor.chain().focus(undefined, { scrollIntoView: false }), editor);
    if (!scrollContainer) {
      return result;
    }
    if (result && typeof result.finally === "function") {
      return result.finally(scheduleRestore);
    }
    scheduleRestore();
    return result;
  }

  function syncEditorModes(instance) {
    if (!hasMountedEditorView(instance)) {
      return;
    }
    const root = instance.view.dom;
    const activeBlock = getActiveEditorBlock(instance);
    Array.from(root.children).forEach((child) => {
      child.classList.remove("editor-block-muted", "editor-block-active");
    });
    if (preferencesRef.current.focusMode && activeBlock) {
      Array.from(root.children).forEach((child) => {
        child.classList.add(child === activeBlock ? "editor-block-active" : "editor-block-muted");
      });
    }
    if (preferencesRef.current.typewriterMode && activeBlock) {
      activeBlock.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    }
  }

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3, 4, 5, 6] },
          link: false,
          underline: false
        }),
        Underline,
        Highlight,
        Subscript,
        Superscript,
        Link.configure({ openOnClick: true, autolink: true, defaultProtocol: "https" }),
        MarkdownImage.configure({ inline: false, allowBase64: true }),
        Placeholder.configure({ placeholder: "Start writing and edit Markdown directly in the document, just like Typora." }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell
      ],
      content: renderMarkdownForEditor(markdownText, filePath, outline),
      editorProps: {
        attributes: { class: "editor-surface" },
        handleDOMEvents: {
          mousedown(view, event) {
            if (event.button !== 0) {
              return false;
            }

            const root = view.dom;
            const target = event.target;
            if (!(root instanceof HTMLElement) || !(target instanceof HTMLElement) || target !== root) {
              return false;
            }

            const blockElements = Array.from(root.children).filter((child) => child instanceof HTMLElement);
            const lastBlock = blockElements.at(-1);
            if (lastBlock && event.clientY < lastBlock.getBoundingClientRect().bottom) {
              return false;
            }

            event.preventDefault();
            return placeCursorInTrailingParagraph(view);
          }
        }
      },
      onCreate({ editor: instance }) {
        editorHeadingsRef.current = buildEditorHeadingPositions(instance);
        syncEditorModes(instance);
      },
      onUpdate({ editor: instance }) {
        editorHeadingsRef.current = buildEditorHeadingPositions(instance);
        syncEditorModes(instance);
        if (programmaticEditorSyncRef.current) {
          programmaticEditorSyncRef.current = false;
          return;
        }
        programmaticMarkdownSyncRef.current = true;
        const nextMarkdown = serializeEditorHtmlToMarkdown(instance.getHTML());
        lastEditorMarkdownRef.current = nextMarkdown;
        startTransition(() => {
          const nextOutline = extractOutlineFromMarkdown(nextMarkdown);
          setMarkdownText(nextMarkdown);
          setOutline(nextOutline);
        });
        setIsDirty(true);
      },
      onSelectionUpdate({ editor: instance }) {
        const currentPos = instance.state.selection.from;
        const currentHeadingIndex = editorHeadingsRef.current.findIndex((heading, index) => {
          const nextHeading = editorHeadingsRef.current[index + 1];
          return currentPos >= heading.pos && (!nextHeading || currentPos < nextHeading.pos);
        });
        if (currentHeadingIndex >= 0 && outline[currentHeadingIndex]) {
          setActiveOutlineId(outline[currentHeadingIndex].id);
        }
        syncEditorModes(instance);
      }
    },
    [documentSessionKey]
  );

  useEffect(() => {
    window.editorApi.loadPreferences().then((loaded) => {
      setPreferences((current) => ({ ...current, ...loaded }));
      setPreferencesReady(true);
    });
  }, []);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(
    () => () => {
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!preferencesReady) {
      return;
    }
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.classList.toggle("focus-mode", preferences.focusMode);
    document.documentElement.classList.toggle("typewriter-mode", preferences.typewriterMode);
    document.documentElement.style.setProperty("--editor-font-size", `${preferences.fontSize}px`);
    document.documentElement.style.setProperty("--paper-width", `${preferences.lineWidth}px`);
    window.editorApi.savePreferences(preferences);
  }, [preferences, preferencesReady]);

  useEffect(() => {
    window.editorApi.setDirty(isDirty);
  }, [isDirty]);

  useEffect(() => {
    window.editorApi.setFilePath(filePath);
  }, [filePath]);

  useEffect(() => {
    if (!preferences.workspaceRoot) {
      setWorkspaceTree(null);
      return;
    }
    window.editorApi.listWorkspaceTree(preferences.workspaceRoot).then(setWorkspaceTree);
  }, [preferences.workspaceRoot, filePath, documentSessionKey]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    if (markdownText === lastEditorMarkdownRef.current) {
      return;
    }
    if (programmaticMarkdownSyncRef.current) {
      programmaticMarkdownSyncRef.current = false;
      return;
    }
    const syncEditorContent = () => {
      if (!hasMountedEditorView(editor)) {
        return false;
      }
      const nextOutline = extractOutlineFromMarkdown(markdownText);
      const html = renderMarkdownForEditor(markdownText, filePath, nextOutline);
      programmaticEditorSyncRef.current = true;
      editor.commands.setContent(html, false, { preserveWhitespace: "full" });
      editorHeadingsRef.current = buildEditorHeadingPositions(editor);
      syncEditorModes(editor);
      return true;
    };

    if (syncEditorContent()) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      syncEditorContent();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [markdownText, filePath, editor]);

  useEffect(() => {
    if (editor) {
      syncEditorModes(editor);
    }
  }, [editor, preferences.focusMode, preferences.typewriterMode]);

  useEffect(() => {
    setOutline(extractOutlineFromMarkdown(markdownText));
  }, [markdownText]);

  useEffect(() => {
    if (matches.length === 0) {
      setMatchIndex(0);
    } else if (matchIndex >= matches.length) {
      setMatchIndex(matches.length - 1);
    }
  }, [matches, matchIndex]);

  useEffect(() => {
    const unsubscribe = window.editorApi.onMenuAction(async (action) => {
      switch (action.type) {
        case "new-file":
          await createNewDocument();
          break;
        case "open-file":
          await openDocument();
          break;
        case "save-file":
          await saveDocument(false);
          break;
        case "save-file-as":
          await saveDocument(true);
          break;
        case "export-html":
          await exportHtml();
          break;
        case "export-pdf":
          await exportPdf();
          break;
        case "insert-image":
          await insertImage();
          break;
        case "insert-table":
          insertTable();
          break;
        case "open-find":
          openFindReplace();
          break;
        case "open-preferences":
          setPreferencesOpen(true);
          break;
        case "set-view-mode":
          updatePreferences({ viewMode: action.mode });
          break;
        case "set-theme":
          updatePreferences({ theme: action.theme });
          break;
        case "set-sidebar-tab":
          updatePreferences({ sidebarVisible: true, sidebarTab: action.tab });
          break;
        case "set-preference":
          updatePreferences(action.patch);
          break;
        case "pick-workspace":
          await pickWorkspaceFolder();
          break;
        case "reveal-current-file":
          revealCurrentFile();
          break;
        case "apply-format":
          applyFormatting(action.format);
          break;
        default:
          break;
      }
    });
    return unsubscribe;
  }, [editor, filePath, markdownText, preferences, outline, matches, matchIndex, replaceValue]);

  useEffect(() => {
    if (!findOpen) {
      return;
    }
    if (matches.length === 0) {
      if (matchIndex !== 0) {
        setMatchIndex(0);
      }
      return;
    }
    if (matchIndex >= matches.length) {
      setMatchIndex(0);
    }
  }, [findOpen, matchIndex, matches.length]);

  useEffect(() => {
    const sourceVisible = preferences.viewMode === "source" || findOpen;
    if (!findOpen || !sourceVisible || !sourceRef.current || matches.length === 0) {
      return;
    }
    selectMatch(matchIndex, { focusSource: false });
  }, [findOpen, matchIndex, matches, preferences.viewMode]);

  useEffect(() => {
    if (!findOpen || !findQuery) {
      return;
    }
    window.requestAnimationFrame(syncSourceHighlightScroll);
  }, [findOpen, findQuery, markdownText]);

  useEffect(() => {
    if (!editor) {
      return undefined;
    }
    const handleDrop = async (event) => {
      const files = Array.from(event.dataTransfer?.files || []);
      const markdownFile = files.find((file) => isMarkdownFilePath(file.path));
      const imageFile = files.find((file) => file.type.startsWith("image/"));
      if (!markdownFile && !imageFile) {
        return;
      }
      event.preventDefault();
      if (markdownFile) {
        await openDocumentFromPath(markdownFile.path);
        return;
      }
      const unlock = lockScrollPosition(getEditorScrollContainer(editor));
      await insertImageFromFile(imageFile.path);
      unlock();
    };

    const handlePaste = async (event) => {
      if (!isEditingSurfaceTarget(editor, sourceRef.current, event.target)) {
        return;
      }
      const imageItem = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith("image/"));
      if (!imageItem) {
        return;
      }
      event.preventDefault();
      const blob = imageItem.getAsFile();
      if (!blob) {
        return;
      }

      const unlock = lockScrollPosition(getEditorScrollContainer(editor));

      const objectUrl = URL.createObjectURL(blob);
      const dimensions = await new Promise((resolve) => {
        const img = new window.Image();
        img.onload = () => {
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
          URL.revokeObjectURL(objectUrl);
        };
        img.onerror = () => {
          resolve(null);
          URL.revokeObjectURL(objectUrl);
        };
        img.src = objectUrl;
      });

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const extension = blob.type.split("/")[1] || "png";
      const persisted = await window.editorApi.persistImageBuffer({ bytes: Array.from(bytes), extension });
      insertMarkdownImage(persisted.markdownPath, persisted.absolutePath, dimensions);
      unlock();
    };

    const handleDragOver = (event) => event.preventDefault();

    window.addEventListener("drop", handleDrop);
    window.addEventListener("paste", handlePaste, true);
    window.addEventListener("dragover", handleDragOver);

    return () => {
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("paste", handlePaste, true);
      window.removeEventListener("dragover", handleDragOver);
    };
  }, [editor, filePath, markdownText, preferences.viewMode]);

  const documentTitle = useMemo(() => basenamePath(filePath), [filePath]);

  function updatePreferences(patch) {
    setPreferences((current) => ({ ...current, ...patch }));
  }

  function handleEditorEndMouseDown(event) {
    if (!editor || event.button !== 0 || !hasMountedEditorView(editor)) {
      return;
    }
    event.preventDefault();
    placeCursorInTrailingParagraph(editor.view);
  }

  function setStatus(message) {
    setStatusMessage(message);
    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current);
    }
    statusTimerRef.current = window.setTimeout(() => setStatusMessage("Ready"), 3200);
  }

  function syncWorkspaceWithFile(nextFilePath) {
    if (!nextFilePath) {
      return;
    }
    const directoryPath = dirnamePath(nextFilePath);
    if (!directoryPath) {
      return;
    }
    if (!preferencesRef.current.workspaceRoot || !isFileInsideRoot(nextFilePath, preferencesRef.current.workspaceRoot)) {
      updatePreferences({ workspaceRoot: directoryPath, sidebarVisible: true });
    }
  }

  function applyDocumentState(nextMarkdown, nextFilePath) {
    const nextOutline = extractOutlineFromMarkdown(nextMarkdown);
    programmaticMarkdownSyncRef.current = false;
    programmaticEditorSyncRef.current = false;
    setFilePath(nextFilePath);
    setMarkdownText(nextMarkdown);
    setOutline(nextOutline);
    setActiveOutlineId(nextOutline[0]?.id ?? null);
    setDocumentSessionKey((current) => current + 1);
    syncWorkspaceWithFile(nextFilePath);
  }

  async function openDocument() {
    if (!(await confirmDiscardChanges())) {
      return;
    }
    const result = await window.editorApi.openMarkdown();
    if (result.canceled || result.content === undefined) {
      return;
    }
    applyDocumentState(result.content, result.filePath);
    setIsDirty(false);
    setFindOpen(false);
    setFindQuery("");
    setReplaceValue("");
    setMatchIndex(0);
    setStatus(`Opened ${basenamePath(result.filePath)}`);
  }

  async function openDocumentFromPath(targetPath) {
    if (!(await confirmDiscardChanges())) {
      return;
    }
    const result = await window.editorApi.openMarkdownPath(targetPath);
    if (result.canceled || result.content === undefined) {
      return;
    }
    applyDocumentState(result.content, result.filePath);
    setIsDirty(false);
    setFindOpen(false);
    setFindQuery("");
    setReplaceValue("");
    setMatchIndex(0);
    setStatus(`Opened ${basenamePath(result.filePath)}`);
  }

  async function createNewDocument() {
    if (!(await confirmDiscardChanges())) {
      return;
    }
    applyDocumentState("", null);
    setIsDirty(false);
    setFindOpen(false);
    setFindQuery("");
    setReplaceValue("");
    setMatchIndex(0);
    setStatus("Created a new blank document");
  }

  async function confirmDiscardChanges() {
    if (!isDirty) {
      return true;
    }
    const result = await window.editorApi.confirmDiscardChanges();
    return Boolean(result?.shouldContinue);
  }

  async function saveDocument(forceSaveAs) {
    const result = await window.editorApi.saveMarkdown({
      markdown: markdownText,
      filePath: forceSaveAs ? null : filePath
    });
    if (!result.canceled) {
      setFilePath(result.filePath);
      if (typeof result.markdown === "string" && result.markdown !== markdownText) {
        setMarkdownText(result.markdown);
      }
      setIsDirty(false);
      syncWorkspaceWithFile(result.filePath);
      setStatus(`Saved to ${basenamePath(result.filePath)}`);
    }
  }

  async function exportHtml() {
    const standalonePreviewHtml = renderMarkdownForPreview(
      markdownText,
      filePath,
      outline,
      window.editorApi.resolveMarkdownAssetForExport
    );
    const preparedPreviewHtml = await renderPreviewHtml(standalonePreviewHtml, preferences.theme);
    const html = buildStandaloneHtml(documentTitle, preparedPreviewHtml, preferences.theme);
    const result = await window.editorApi.saveHtml({ html });
    if (!result.canceled) {
      setStatus(`Exported HTML: ${basenamePath(result.filePath)}`);
    }
  }

  async function exportPdf() {
    const printablePreviewHtml = renderMarkdownForPreview(
      markdownText,
      filePath,
      outline,
      window.editorApi.resolveMarkdownAssetForExport
    );
    const preparedPreviewHtml = await renderPreviewHtml(printablePreviewHtml, preferences.theme);
    const html = buildStandaloneHtml(documentTitle, preparedPreviewHtml, preferences.theme);
    const result = await window.editorApi.savePdf({ html });
    if (!result.canceled) {
      setStatus(`Exported PDF: ${basenamePath(result.filePath)}`);
    }
  }

  async function pickWorkspaceFolder() {
    const result = await window.editorApi.pickWorkspace();
    if (result.canceled || !result.directoryPath) {
      return;
    }
    updatePreferences({ workspaceRoot: result.directoryPath, sidebarVisible: true, sidebarTab: "files" });
    setStatus(`Opened folder ${basenamePath(result.directoryPath)}`);
  }

  function revealCurrentFile() {
    if (filePath) {
      window.editorApi.showItemInFolder(filePath);
    }
  }

  async function insertImage() {
    const result = await window.editorApi.pickImage();
    if (result.canceled) {
      return;
    }
    await insertImageFromFile(result.filePath);
  }

  async function insertImageFromFile(imagePath) {
    const persisted = await window.editorApi.persistImageFile(imagePath);
    const dimensions = await new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = window.editorApi.toAssetUrl(imagePath);
    });
    insertMarkdownImage(persisted.markdownPath, persisted.absolutePath, dimensions);
    setStatus(`Inserted image ${basenamePath(persisted.absolutePath)}`);
  }

  function insertMarkdownImage(markdownPath, absolutePath, dimensions = null) {
    const alt = basenamePath(absolutePath) || "image";
    const markdownImage = `![${alt}](${markdownPath})`;
    if (preferences.viewMode === "source" && sourceRef.current) {
      insertIntoSource(markdownImage, { block: true });
      return;
    }
    if (editor) {
      runEditorCommand(
        (chain) =>
          chain
            .setImage({
              src: window.editorApi.toAssetUrl(absolutePath),
              alt,
              markdownSource: markdownPath,
              ...(dimensions ? { width: String(dimensions.width), height: String(dimensions.height) } : {})
            })
            .run(),
        { preserveScroll: true }
      );
      return;
    }
    setMarkdownText((current) => `${current.trimEnd()}${current.trimEnd() ? "\n\n" : ""}${markdownImage}\n`);
    setIsDirty(true);
  }

  function insertTable() {
    if (preferences.viewMode === "source" && sourceRef.current) {
      insertIntoSource("| Column 1 | Column 2 |\n| --- | --- |\n| Value | Value |", { block: true });
      setStatus("Inserted table template");
      return;
    }
    runEditorCommand((chain) => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run());
    setStatus("Inserted table");
  }

  function jumpToOutline(item, index) {
    setActiveOutlineId(item.id);
    if (preferences.viewMode !== "editor" && sourceRef.current) {
      const offset = getLineStartIndex(markdownText, item.line);
      sourceRef.current.focus();
      sourceRef.current.setSelectionRange(offset, offset + item.text.length);
      sourceRef.current.scrollTop = Math.max(0, item.line - 3) * 24;
      return;
    }
    const editorHeading = editorHeadingsRef.current[index];
    if (editorHeading) {
      editor?.chain().focus(editorHeading.pos).run();
    }
  }

  function openFindReplace() {
    setFindOpen(true);
  }

  function handleFindQueryChange(value) {
    setFindQuery(value);
    setMatchIndex(0);
  }

  function selectMatch(index, { focusSource = true } = {}) {
    if (!sourceRef.current || matches.length === 0) {
      return;
    }
    const match = matches[index];
    if (focusSource) {
      sourceRef.current.focus();
    }
    sourceRef.current.setSelectionRange(match.start, match.end);
    window.requestAnimationFrame(syncSourceHighlightScroll);
  }

  function goToNextMatch() {
    if (matches.length === 0) {
      return;
    }
    const nextIndex = (matchIndex + 1) % matches.length;
    setMatchIndex(nextIndex);
    selectMatch(nextIndex, { focusSource: false });
  }

  function goToPrevMatch() {
    if (matches.length === 0) {
      return;
    }
    const nextIndex = (matchIndex - 1 + matches.length) % matches.length;
    setMatchIndex(nextIndex);
    selectMatch(nextIndex, { focusSource: false });
  }

  function replaceCurrentMatch() {
    if (matches.length === 0) {
      return;
    }
    const current = matches[matchIndex];
    setMarkdownText(markdownText.slice(0, current.start) + replaceValue + markdownText.slice(current.end));
    setIsDirty(true);
    setStatus("Replaced current match");
  }

  function replaceAllMatches() {
    if (!findQuery) {
      return;
    }
    setMarkdownText(markdownText.split(findQuery).join(replaceValue));
    setIsDirty(true);
    setStatus(`Replaced all ${matches.length} matches`);
  }

  function handleSourceChange(event) {
    setMarkdownText(event.target.value);
    setIsDirty(true);
  }

  function handleSourceSelection(event) {
    const cursor = event.target.selectionStart;
    const beforeCursor = markdownText.slice(0, cursor);
    const currentLine = beforeCursor.split(/\r?\n/).length - 1;
    const currentHeading = [...outline].reverse().find((item) => item.line <= currentLine);
    if (currentHeading) {
      setActiveOutlineId(currentHeading.id);
    }
  }

  function handleSourceScroll() {
    syncSourceHighlightScroll();
  }

  function insertIntoSource(content, options = {}) {
    const textarea = sourceRef.current;
    if (!textarea) {
      return;
    }
    const selectionStart = textarea.selectionStart ?? markdownText.length;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const prefix = markdownText.slice(0, selectionStart);
    const suffix = markdownText.slice(selectionEnd);
    const needsLeadingBreak = options.block && prefix.length > 0 && !/\n{2}$/.test(prefix);
    const needsTrailingBreak = options.block && suffix.length > 0 && !/^\n/.test(suffix);
    const insertion = `${needsLeadingBreak ? "\n\n" : ""}${content}${needsTrailingBreak ? "\n" : ""}`;
    setMarkdownText(`${prefix}${insertion}${suffix}`);
    setIsDirty(true);
  }

  function withSourceSelection(transform) {
    const textarea = sourceRef.current;
    if (!textarea) {
      return;
    }
    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const result = transform({
      before: markdownText.slice(0, selectionStart),
      selection: markdownText.slice(selectionStart, selectionEnd),
      after: markdownText.slice(selectionEnd),
      selectionStart,
      selectionEnd
    });
    if (result?.text) {
      setMarkdownText(result.text);
      setIsDirty(true);
    }
  }

  function wrapSourceSelection(prefix, suffix = prefix, placeholder = "") {
    withSourceSelection(({ before, selection, after }) => {
      const selectedText = selection || placeholder;
      return { text: `${before}${prefix}${selectedText}${suffix}${after}` };
    });
  }

  function prefixSelectedLines(prefix, numbered = false) {
    withSourceSelection(({ selectionStart, selectionEnd }) => {
      const { lineStart, lineEnd } = getLineBoundaries(markdownText, selectionStart, selectionEnd);
      const before = markdownText.slice(0, lineStart);
      const target = markdownText.slice(lineStart, lineEnd);
      const after = markdownText.slice(lineEnd);
      const lines = target ? target.split(/\r?\n/) : [""];
      const nextLines = lines.map((line, index) => (numbered ? `${index + 1}. ${line}` : `${prefix}${line}`));
      return { text: `${before}${nextLines.join("\n")}${after}` };
    });
  }

  function applyFormatting(format) {
    if (preferences.viewMode === "source" && sourceRef.current) {
      switch (format) {
        case "paragraph":
          setStatus("In source mode, edit paragraph styles directly in Markdown.");
          break;
        case "heading-1":
          prefixSelectedLines("# ");
          break;
        case "heading-2":
          prefixSelectedLines("## ");
          break;
        case "heading-3":
          prefixSelectedLines("### ");
          break;
        case "bullet-list":
          prefixSelectedLines("- ");
          break;
        case "ordered-list":
          prefixSelectedLines("1. ", true);
          break;
        case "task-list":
          prefixSelectedLines("- [ ] ");
          break;
        case "blockquote":
          prefixSelectedLines("> ");
          break;
        case "code-block":
          wrapSourceSelection("```\n", "\n```", "code");
          break;
        case "horizontal-rule":
          insertIntoSource("---", { block: true });
          break;
        case "bold":
          wrapSourceSelection("**", "**", "bold");
          break;
        case "italic":
          wrapSourceSelection("*", "*", "italic");
          break;
        case "underline":
          wrapSourceSelection("<u>", "</u>", "underline");
          break;
        case "strike":
          wrapSourceSelection("~~", "~~", "strike");
          break;
        case "highlight":
          wrapSourceSelection("==", "==", "highlight");
          break;
        case "subscript":
          wrapSourceSelection("~", "~", "sub");
          break;
        case "superscript":
          wrapSourceSelection("^", "^", "sup");
          break;
        case "inline-code":
          wrapSourceSelection("`", "`", "code");
          break;
        case "link": {
          const href = window.prompt("Enter a link URL");
          if (href) {
            wrapSourceSelection("[", `](${href})`, "link text");
          }
          break;
        }
        default:
          break;
      }
      return;
    }

    if (!editor) {
      return;
    }

    switch (format) {
      case "paragraph":
        runEditorCommand((chain) => chain.setParagraph().run());
        break;
      case "heading-1":
        runEditorCommand((chain) => chain.toggleHeading({ level: 1 }).run());
        break;
      case "heading-2":
        runEditorCommand((chain) => chain.toggleHeading({ level: 2 }).run());
        break;
      case "heading-3":
        runEditorCommand((chain) => chain.toggleHeading({ level: 3 }).run());
        break;
      case "bullet-list":
        runEditorCommand((chain) => chain.toggleBulletList().run());
        break;
      case "ordered-list":
        runEditorCommand((chain) => chain.toggleOrderedList().run());
        break;
      case "task-list":
        runEditorCommand((chain) => chain.toggleTaskList().run());
        break;
      case "blockquote":
        runEditorCommand((chain) => chain.toggleBlockquote().run());
        break;
      case "code-block":
        runEditorCommand((chain) => chain.toggleCodeBlock().run());
        break;
      case "horizontal-rule":
        runEditorCommand((chain) => chain.setHorizontalRule().run());
        break;
      case "bold":
        runEditorCommand((chain) => chain.toggleBold().run());
        break;
      case "italic":
        runEditorCommand((chain) => chain.toggleItalic().run());
        break;
      case "underline":
        runEditorCommand((chain) => chain.toggleUnderline().run());
        break;
      case "strike":
        runEditorCommand((chain) => chain.toggleStrike().run());
        break;
      case "highlight":
        runEditorCommand((chain) => chain.toggleHighlight().run());
        break;
      case "subscript":
        runEditorCommand((chain) => chain.toggleSubscript().run());
        break;
      case "superscript":
        runEditorCommand((chain) => chain.toggleSuperscript().run());
        break;
      case "inline-code":
        runEditorCommand((chain) => chain.toggleCode().run());
        break;
      case "link": {
        const href = window.prompt("Enter a link URL");
        if (href) {
          runEditorCommand((chain) => chain.extendMarkRange("link").setLink({ href }).run());
        }
        break;
      }
      default:
        break;
    }
  }

  const showEditor = preferences.viewMode === "editor" || preferences.viewMode === "split";
  const showSource = preferences.viewMode === "source" || findOpen;
  const showPreview = preferences.viewMode === "split" || preferences.viewMode === "preview";
  const findSummary = findOpen && findQuery ? `${matches.length === 0 ? "0" : `${matchIndex + 1}/${matches.length}`} matches` : null;
  const documentPathLabel = filePath || preferences.workspaceRoot || "";

  return (
    <div className={`app-shell theme-${preferences.theme}`}>
      <Toolbar
        documentPath={documentPathLabel}
        documentTitle={documentTitle}
        editor={editor}
        isDirty={isDirty}
        onNew={createNewDocument}
        onOpen={openDocument}
        onRevealCurrentFile={revealCurrentFile}
        onInsertImage={insertImage}
        onInsertTable={insertTable}
        onApplyFormat={applyFormatting}
        onSave={() => saveDocument(false)}
        onSaveAs={() => saveDocument(true)}
        onExport={exportHtml}
        onExportPdf={exportPdf}
        onOpenFind={openFindReplace}
        onOpenPreferences={() => setPreferencesOpen(true)}
        onSetViewMode={(mode) => updatePreferences({ viewMode: mode })}
        onToggleSidebar={() => updatePreferences({ sidebarVisible: !preferences.sidebarVisible })}
        sidebarVisible={preferences.sidebarVisible}
        viewMode={preferences.viewMode}
      />

      <FindReplaceBar
        open={findOpen}
        query={findQuery}
        replaceValue={replaceValue}
        count={matches.length}
        currentIndex={matchIndex}
        onQueryChange={handleFindQueryChange}
        onReplaceChange={setReplaceValue}
        onPrev={goToPrevMatch}
        onNext={goToNextMatch}
        onReplaceOne={replaceCurrentMatch}
        onReplaceAll={replaceAllMatches}
        onClose={() => setFindOpen(false)}
      />

      <div className={`workspace${preferences.sidebarVisible ? "" : " sidebar-hidden"}`}>
        {preferences.sidebarVisible ? (
          <Sidebar
            outline={outline}
            activeOutlineId={activeOutlineId}
            onJumpOutline={jumpToOutline}
            workspaceRoot={preferences.workspaceRoot}
            workspaceTree={workspaceTree}
            activeFilePath={filePath}
            onOpenFile={openDocumentFromPath}
            onPickWorkspace={pickWorkspaceFolder}
            onRevealCurrentFile={revealCurrentFile}
            sidebarTab={preferences.sidebarTab}
            onSidebarTabChange={(tab) => updatePreferences({ sidebarTab: tab })}
            filterText={sidebarFilter}
            onFilterChange={setSidebarFilter}
          />
        ) : null}

        <main className={`workspace-main mode-${preferences.viewMode}${findOpen ? " find-open" : ""}`}>
          {showEditor ? (
            <section className="editor-pane">
              <div className="paper">
                <EditorContent editor={editor} />
                <div className="editor-end-hitbox" onMouseDown={handleEditorEndMouseDown} />
              </div>
            </section>
          ) : null}

          {showSource ? (
            <section className="side-pane source-pane">
              <div className="side-pane-header">Source</div>
              <div className={`source-editor-shell${findOpen && findQuery ? " searching" : ""}`}>
                {findOpen && findQuery ? (
                  <div ref={sourceHighlightRef} className="source-highlight-layer" aria-hidden="true">
                    {sourceHighlightContent}
                  </div>
                ) : null}
                <textarea
                  ref={sourceRef}
                  className={`source-textarea${findOpen && findQuery ? " searching" : ""}`}
                  value={markdownText}
                  onChange={handleSourceChange}
                  onClick={handleSourceSelection}
                  onKeyUp={handleSourceSelection}
                  onScroll={handleSourceScroll}
                />
              </div>
            </section>
          ) : null}

          {showPreview ? (
            <section className="side-pane preview-pane">
              <div className="side-pane-header">Preview</div>
              <MarkdownPreview html={previewHtml} theme={preferences.theme} />
            </section>
          ) : null}
        </main>
      </div>

      <StatusBar
        lineCount={stats.lineCount}
        wordCount={stats.wordCount}
        charCount={stats.charCount}
        readingMinutes={stats.readingMinutes}
        viewMode={preferences.viewMode}
        statusMessage={statusMessage}
        findSummary={findSummary}
      />

      <PreferencesDialog
        open={preferencesOpen}
        preferences={preferences}
        onChange={updatePreferences}
        onClose={() => setPreferencesOpen(false)}
      />
    </div>
  );
}
