import React, { startTransition, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { Mark, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { CellSelection, TableMap } from "@tiptap/pm/tables";
import { EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import CodeBlock from "@tiptap/extension-code-block";
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
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import yamlLanguage from "highlight.js/lib/languages/yaml";
import sql from "highlight.js/lib/languages/sql";
import python from "highlight.js/lib/languages/python";
import markdownLanguage from "highlight.js/lib/languages/markdown";
import * as yaml from "js-yaml";
import katexStyles from "katex/dist/katex.min.css?inline";
import Toolbar from "./components/Toolbar";
import Sidebar from "./components/Sidebar";
import StatusBar from "./components/StatusBar";
import FindReplaceBar from "./components/FindReplaceBar";
import MarkdownPreview, { renderPreviewHtml } from "./components/MarkdownPreview";
import PreferencesDialog from "./components/PreferencesDialog";
import CommandPalette from "./components/CommandPalette";
import SlashCommandMenu from "./components/SlashCommandMenu";
import TableToolbar from "./components/TableToolbar";
import FrontMatterMergeDialog from "./components/FrontMatterMergeDialog";
import TableSelectionHandles from "./components/TableSelectionHandles";
import EditingCheatsheetDialog from "./components/EditingCheatsheetDialog";

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
  smartMarkdownTransform: true,
  smartTransformHints: true,
  smartTransformRules: {
    heading: true,
    blockquote: true,
    bulletList: true,
    orderedList: true,
    taskList: true,
    codeFence: true
  },
  workspaceRoot: null,
  recentFiles: [],
  paletteUsage: {},
  tableLayouts: {}
};

const codeLanguageOptions = [
  { value: "", label: "Plain text" },
  { value: "js", label: "JavaScript" },
  { value: "ts", label: "TypeScript" },
  { value: "jsx", label: "JSX" },
  { value: "tsx", label: "TSX" },
  { value: "json", label: "JSON" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "md", label: "Markdown" },
  { value: "bash", label: "Bash" },
  { value: "yaml", label: "YAML" },
  { value: "sql", label: "SQL" },
  { value: "python", label: "Python" },
  { value: "mermaid", label: "Mermaid" }
];

const codeLanguageTemplates = {
  js: "function main() {\n  console.log('Hello, world!');\n}",
  ts: "function main(): void {\n  console.log('Hello, world!');\n}",
  jsx: "export function Component() {\n  return <div>Hello</div>;\n}",
  tsx: "export function Component(): JSX.Element {\n  return <div>Hello</div>;\n}",
  json: '{\n  "name": "Inkdown"\n}',
  html: "<section>\n  <h1>Hello</h1>\n</section>",
  css: ".card {\n  display: grid;\n}",
  bash: "echo \"Hello, world!\"",
  yaml: "title: Inkdown\nstatus: draft",
  sql: "select *\nfrom notes;",
  python: "def main():\n    print('Hello, world!')",
  md: "# Title\n\nBody",
  mermaid: "graph TD\n  A[Start] --> B[Finish]"
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

hljs.registerLanguage("js", javascript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("yaml", yamlLanguage);
hljs.registerLanguage("yml", yamlLanguage);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("python", python);
hljs.registerLanguage("md", markdownLanguage);
hljs.registerLanguage("markdown", markdownLanguage);
hljs.registerAliases(["jsx"], { languageName: "javascript" });
hljs.registerAliases(["tsx"], { languageName: "typescript" });
hljs.registerAliases(["sh", "zsh"], { languageName: "bash" });

function normalizeHighlightLanguage(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized && hljs.getLanguage(normalized) ? normalized : "";
}

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

function CodeBlockNodeView({ editor, getPos, node, updateAttributes }) {
  const activeValue = node.attrs.language || "";
  const collapsed = Boolean(node.attrs.collapsed);
  const mermaidPreviewId = useId();
  const [copied, setCopied] = useState(false);
  const [auxPreviewHtml, setAuxPreviewHtml] = useState("");
  const [mermaidRefreshKey, setMermaidRefreshKey] = useState(0);
  const highlightLanguage = useMemo(() => normalizeHighlightLanguage(activeValue), [activeValue]);
  const lineNumbers = useMemo(() => {
    const count = Math.max(1, String(node.textContent || "").split("\n").length);
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [node.textContent]);

  useEffect(() => {
    if (activeValue !== "mermaid") {
      return undefined;
    }

    let canceled = false;
    const container = document.getElementById(mermaidPreviewId);
    if (!container) {
      return undefined;
    }

    async function renderMermaidPreview() {
      try {
        const html = await renderPreviewHtml(
          `<div class="mermaid">${node.textContent || ""}</div>`,
          document.documentElement.dataset.theme || "paper"
        );
        if (!canceled && container) {
          container.innerHTML = html;
        }
      } catch (error) {
        if (!canceled && container) {
          container.innerHTML = `<pre>${String(error.message || error)}</pre>`;
        }
      }
    }

    renderMermaidPreview();
    return () => {
      canceled = true;
    };
  }, [activeValue, mermaidPreviewId, mermaidRefreshKey, node.textContent]);

  useEffect(() => {
    if (!["md", "markdown", "html"].includes(activeValue)) {
      setAuxPreviewHtml("");
      return undefined;
    }

    let canceled = false;
    async function buildPreview() {
      if (activeValue === "html") {
        if (!canceled) {
          setAuxPreviewHtml(node.textContent || "");
        }
        return;
      }
      const rendered = renderMarkdownForPreview(node.textContent || "", null, []);
      const html = await renderPreviewHtml(rendered, document.documentElement.dataset.theme || "paper");
      if (!canceled) {
        setAuxPreviewHtml(html);
      }
    }

    buildPreview();
    return () => {
      canceled = true;
    };
  }, [activeValue, node.textContent]);

  function replaceCodeBlockText(nextText) {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number") {
      return;
    }
    editor
      .chain()
      .focus(pos + 1)
      .command(({ tr }) => {
        tr.insertText(nextText, pos + 1, pos + node.nodeSize - 1);
        return true;
      })
      .run();
  }

  function handleLanguageChange(nextLanguage) {
    const normalizedLanguage = nextLanguage || null;
    updateAttributes({ language: normalizedLanguage });
    if (!String(node.textContent || "").trim() && nextLanguage && codeLanguageTemplates[nextLanguage]) {
      replaceCodeBlockText(codeLanguageTemplates[nextLanguage]);
    }
  }

  async function copyCodeBlock() {
    try {
      await navigator.clipboard.writeText(node.textContent || "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  function applyLanguageTool() {
    try {
      if (["json"].includes(activeValue)) {
        replaceCodeBlockText(formatJsonLikeText(node.textContent || ""));
        return;
      }
      if (["sql"].includes(activeValue)) {
        replaceCodeBlockText(formatSqlLikeText(node.textContent || ""));
        return;
      }
      if (["yaml", "yml"].includes(activeValue)) {
        replaceCodeBlockText(formatYamlLikeText(node.textContent || ""));
        return;
      }
      if (["md", "markdown"].includes(activeValue)) {
        replaceCodeBlockText(normalizeMarkdownBlock(node.textContent || ""));
        return;
      }
      if (activeValue === "mermaid") {
        setMermaidRefreshKey((current) => current + 1);
      }
    } catch {}
  }

  const toolLabel =
    activeValue === "json"
      ? "Format JSON"
      : activeValue === "sql"
        ? "Format SQL"
        : ["yaml", "yml"].includes(activeValue)
          ? "Format YAML"
          : ["md", "markdown"].includes(activeValue)
            ? "Normalize MD"
            : activeValue === "mermaid"
              ? "Refresh"
              : null;

  return (
    <NodeViewWrapper className="code-block-node">
      <div className="code-block-toolbar" contentEditable={false}>
        <span className="code-block-chip">Code</span>
        <select
          className="code-block-language-select"
          value={activeValue}
          onChange={(event) => handleLanguageChange(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {codeLanguageOptions.map((option) => (
            <option key={option.value || "plain"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          className="tool-button tool-button-ghost code-block-copy-button"
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={copyCodeBlock}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        {toolLabel ? (
          <button
            className="tool-button tool-button-ghost code-block-tool-button"
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={applyLanguageTool}
          >
            {toolLabel}
          </button>
        ) : null}
        <button
          className="tool-button tool-button-ghost code-block-collapse-button"
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => updateAttributes({ collapsed: !collapsed })}
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
        <button
          className="tool-button tool-button-ghost code-block-exit-button"
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          Paragraph
        </button>
      </div>
      {!collapsed ? (
        <>
          <div className="code-block-editor-frame">
            <div className="code-block-line-numbers" contentEditable={false}>
              {lineNumbers.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
            <pre>
              <NodeViewContent as="code" className={`hljs${highlightLanguage ? ` language-${highlightLanguage}` : ""}`} />
            </pre>
          </div>
          {activeValue === "mermaid" ? <div id={mermaidPreviewId} className="code-block-mermaid-preview" contentEditable={false} /> : null}
          {["md", "markdown"].includes(activeValue) && auxPreviewHtml ? (
            <div className="code-block-aux-preview preview-surface" dangerouslySetInnerHTML={{ __html: auxPreviewHtml }} />
          ) : null}
          {activeValue === "html" && auxPreviewHtml ? (
            <iframe className="code-block-html-preview" sandbox="" srcDoc={auxPreviewHtml} title="HTML preview" />
          ) : null}
        </>
      ) : null}
    </NodeViewWrapper>
  );
}

const CodeBlockWithLanguage = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      collapsed: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-collapsed") === "true",
        renderHTML: (attributes) => (attributes.collapsed ? { "data-collapsed": "true" } : {})
      },
      language: {
        default: null,
        parseHTML: (element) => {
          const explicitLanguage = element.getAttribute("data-language");
          if (explicitLanguage) {
            return explicitLanguage;
          }
          const className = element.getAttribute("class") || "";
          const languageClass = className
            .split(/\s+/)
            .find((value) => value.startsWith("language-"));
          return languageClass ? languageClass.replace(/^language-/, "") : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.language) {
            return {};
          }
          return {
            "data-language": attributes.language,
            class: `language-${attributes.language}`
          };
        }
      }
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView);
  }
});

const TableHeaderWithAlignment = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      textAlign: {
        default: null,
        parseHTML: (element) => element.style.textAlign || element.getAttribute("data-align") || null,
        renderHTML: (attributes) =>
          attributes.textAlign
            ? {
                "data-align": attributes.textAlign,
                style: `text-align: ${attributes.textAlign}`
              }
            : {}
      }
    };
  }
});

const TableCellWithAlignment = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      textAlign: {
        default: null,
        parseHTML: (element) => element.style.textAlign || element.getAttribute("data-align") || null,
        renderHTML: (attributes) =>
          attributes.textAlign
            ? {
                "data-align": attributes.textAlign,
                style: `text-align: ${attributes.textAlign}`
              }
            : {}
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

function parseYamlObject(raw) {
  const normalized = String(raw || "").trim();
  if (!normalized) {
    return {};
  }
  try {
    const parsed = yaml.load(normalized);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return null;
  }
}

function dumpYamlObject(value) {
  try {
    return buildRawFrontMatter(yaml.dump(value || {}, { lineWidth: 100, noRefs: true }).trim());
  } catch {
    return "";
  }
}

function replaceFrontMatterRaw(markdown, rawFrontMatter) {
  const { body } = extractYamlFrontMatter(markdown);
  return prependFrontMatter(rawFrontMatter, body);
}

function mergeYamlValues(currentValue, incomingValue) {
  if (Array.isArray(currentValue) && Array.isArray(incomingValue)) {
    return [...new Set([...currentValue, ...incomingValue].map((item) => JSON.stringify(item)))].map((item) => JSON.parse(item));
  }

  if (
    currentValue &&
    incomingValue &&
    typeof currentValue === "object" &&
    typeof incomingValue === "object" &&
    !Array.isArray(currentValue) &&
    !Array.isArray(incomingValue)
  ) {
    const result = { ...currentValue };
    Object.keys(incomingValue).forEach((key) => {
      result[key] = key in result ? mergeYamlValues(result[key], incomingValue[key]) : incomingValue[key];
    });
    return result;
  }

  return incomingValue;
}

function stripWrappingQuotes(value) {
  const normalized = String(value || "").trim();
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    return normalized.slice(1, -1);
  }
  return normalized;
}

function parseInlineFrontMatterList(value) {
  return String(value || "")
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((item) => stripWrappingQuotes(item))
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseFrontMatterFields(content) {
  const lines = String(content || "").split(/\r?\n/);
  const fields = [];
  let isSimple = true;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || /^\s*#/.test(line)) {
      continue;
    }

    const match = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(line);
    if (!match) {
      isSimple = false;
      continue;
    }

    const key = match[1];
    const inlineValue = match[2] ?? "";
    if (!inlineValue) {
      const list = [];
      let nextIndex = index + 1;
      while (nextIndex < lines.length && /^\s*-\s+/.test(lines[nextIndex])) {
        list.push(stripWrappingQuotes(lines[nextIndex].replace(/^\s*-\s+/, "")));
        nextIndex += 1;
      }

      if (list.length > 0) {
        fields.push({ id: `${key}-${index}`, key, type: "list", value: list });
        index = nextIndex - 1;
        continue;
      }

      fields.push({ id: `${key}-${index}`, key, type: "text", value: "" });
      continue;
    }

    if (inlineValue === "|" || inlineValue === ">" || /[{}]/.test(inlineValue)) {
      isSimple = false;
      fields.push({ id: `${key}-${index}`, key, type: "text", value: stripWrappingQuotes(inlineValue) });
      continue;
    }

    if (/^\[.*\]$/.test(inlineValue.trim())) {
      fields.push({ id: `${key}-${index}`, key, type: "list", value: parseInlineFrontMatterList(inlineValue) });
      continue;
    }

    fields.push({ id: `${key}-${index}`, key, type: "text", value: stripWrappingQuotes(inlineValue) });
  }

  return { fields, isSimple };
}

function formatFrontMatterScalar(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return '""';
  }
  if (/^[A-Za-z0-9._/-]+$/.test(normalized)) {
    return normalized;
  }
  return JSON.stringify(normalized);
}

function buildFrontMatterFromFields(fields) {
  const normalizedFields = fields
    .map((field) => {
      const key = String(field.key || "").trim();
      if (!key) {
        return null;
      }
      if (field.type === "list") {
        const values = Array.isArray(field.value)
          ? field.value.map((item) => String(item).trim()).filter(Boolean)
          : String(field.value || "")
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean);
        return {
          key,
          type: "list",
          value: values
        };
      }
      return {
        key,
        type: "text",
        value: String(field.value ?? "")
      };
    })
    .filter(Boolean);

  if (normalizedFields.length === 0) {
    return "";
  }

  return buildRawFrontMatter(
    normalizedFields
      .map((field) => {
        if (field.type === "list") {
          if (field.value.length === 0) {
            return `${field.key}:\n  - ""`;
          }
          return `${field.key}:\n${field.value.map((item) => `  - ${formatFrontMatterScalar(item)}`).join("\n")}`;
        }
        return `${field.key}: ${formatFrontMatterScalar(field.value)}`;
      })
      .join("\n")
  );
}

function updateMarkdownFrontMatter(markdown, fields) {
  const { body } = extractYamlFrontMatter(markdown);
  return prependFrontMatter(buildFrontMatterFromFields(fields), body);
}

function mergeFrontMatterRaw(existingRaw, incomingRaw) {
  const existingObject = parseYamlObject(extractYamlFrontMatter(existingRaw).content || existingRaw);
  const incomingObject = parseYamlObject(extractYamlFrontMatter(incomingRaw).content || incomingRaw);

  if (existingObject && incomingObject) {
    return dumpYamlObject(mergeYamlValues(existingObject, incomingObject));
  }

  const existing = parseFrontMatterFields(extractYamlFrontMatter(existingRaw).content || existingRaw);
  const incoming = parseFrontMatterFields(extractYamlFrontMatter(incomingRaw).content || incomingRaw);

  if (!existing.isSimple || !incoming.isSimple) {
    return incomingRaw || existingRaw || "";
  }

  const merged = [...existing.fields];
  incoming.fields.forEach((incomingField) => {
    const matchIndex = merged.findIndex((field) => field.key === incomingField.key);
    if (matchIndex === -1) {
      merged.push(incomingField);
      return;
    }
    if (incomingField.type === "list") {
      const currentValues = Array.isArray(merged[matchIndex].value) ? merged[matchIndex].value : [];
      const nextValues = Array.isArray(incomingField.value) ? incomingField.value : [];
      merged[matchIndex] = {
        ...merged[matchIndex],
        type: "list",
        value: [...new Set([...currentValues, ...nextValues].filter(Boolean))]
      };
      return;
    }
    merged[matchIndex] = {
      ...merged[matchIndex],
      type: incomingField.type,
      value: incomingField.value
    };
  });

  return buildFrontMatterFromFields(merged);
}

function flattenWorkspaceFiles(node, rootPath, files = []) {
  if (!node) {
    return files;
  }

  if (node.type === "file") {
    const relativePath =
      rootPath && isFileInsideRoot(node.path, rootPath)
        ? node.path.slice(rootPath.length).replace(/^[\\/]+/, "").replace(/\\/g, "/")
        : node.name;
    files.push({
      path: node.path,
      name: node.name,
      relativePath
    });
    return files;
  }

  (node.children || []).forEach((child) => flattenWorkspaceFiles(child, rootPath, files));
  return files;
}

function matchesPaletteQuery(item, query) {
  const normalizedQuery = String(query ?? "").trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }
  const haystack = [item.label, item.description, item.keywords, item.relativePath]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalizedQuery);
}

function normalizeRecentFiles(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 8);
}

function normalizePaletteUsage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, count]) => [String(key), Number(count) || 0])
      .filter(([, count]) => count > 0)
  );
}

function getDisplayPath(filePath, workspaceRoot) {
  if (!filePath) {
    return "";
  }
  if (workspaceRoot && isFileInsideRoot(filePath, workspaceRoot)) {
    return filePath.slice(workspaceRoot.length).replace(/^[\\/]+/, "").replace(/\\/g, "/");
  }
  return filePath;
}

function scorePaletteItem(item, query, usageMap, recentRanks) {
  const normalizedQuery = String(query ?? "").trim().toLowerCase();
  const usageScore = Math.min(40, (usageMap[item.id] || 0) * 6);
  const recentScore = item.path ? Math.max(0, 32 - (recentRanks.get(item.path) ?? 99) * 6) : 0;

  if (!normalizedQuery) {
    return usageScore + recentScore;
  }

  const label = String(item.label || "").toLowerCase();
  const keywords = String(item.keywords || "").toLowerCase();
  const description = String(item.description || "").toLowerCase();

  let score = 0;
  if (label === normalizedQuery) score += 140;
  else if (label.startsWith(normalizedQuery)) score += 110;
  else if (label.includes(normalizedQuery)) score += 85;

  if (keywords.includes(normalizedQuery)) score += 40;
  if (description.includes(normalizedQuery)) score += 20;

  return score + usageScore + recentScore;
}

function isProbablyUrl(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return false;
  }
  try {
    const parsed = new URL(normalized);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function getEditorSlashContext(instance) {
  const selection = instance?.state?.selection;
  if (!selection || !selection.empty) {
    return null;
  }

  const { $from, from } = selection;
  const parent = $from.parent;
  if (!parent?.isTextblock || parent.type.name !== "paragraph") {
    return null;
  }

  const cursorOffset = $from.parentOffset;
  const beforeCursor = parent.textContent.slice(0, cursorOffset);
  const match = /^\/([^\n]*)$/.exec(beforeCursor);
  if (!match) {
    return null;
  }

  return {
    query: match[1] || "",
    from: from - cursorOffset,
    to: from
  };
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

  const alignmentRowSource = rows[0];
  const headerRow = toMarkdownRow(rows[0]);
  const dividerRow = `| ${Array.from({ length: columnCount }, (_, index) => {
    const cell = alignmentRowSource?.cells?.[index];
    const align = cell?.style?.textAlign || cell?.getAttribute?.("data-align") || "";
    if (align === "center") {
      return ":---:";
    }
    if (align === "right") {
      return "---:";
    }
    return "---";
  }).join(" | ")} |`;
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
  return decorateRenderedHtml(container, outline, { frontMatterContent, enableCallouts: true });
}

function renderMarkdownSnippetForEditor(markdown, currentFilePath) {
  const { raw: frontMatterRaw, body } = extractYamlFrontMatter(markdown);
  const snippetOutline = extractOutlineFromMarkdown(body);
  const container = resolveImageSources(
    editorMarked.parse(preprocessMarkdownSyntax(body, { enableExtendedInlineSyntax: true })),
    currentFilePath,
    window.editorApi.resolveMarkdownAsset
  );
  return {
    frontMatterRaw,
    html: decorateRenderedHtml(container, snippetOutline, { enableCallouts: true })
  };
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
      .hljs { color: inherit; background: transparent; }
      .hljs-comment, .hljs-quote { color: #94a3b8; font-style: italic; }
      .hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-name, .hljs-tag { color: #f97316; }
      .hljs-string, .hljs-attr, .hljs-template-tag, .hljs-template-variable { color: #22c55e; }
      .hljs-number, .hljs-symbol, .hljs-bullet, .hljs-variable, .hljs-variable.constant_ { color: #38bdf8; }
      .hljs-title, .hljs-title.class_, .hljs-title.function_ { color: #c084fc; }
      .hljs-meta, .hljs-built_in, .hljs-type { color: #facc15; }
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
      td[data-align="left"], th[data-align="left"] { text-align: left; }
      td[data-align="center"], th[data-align="center"] { text-align: center; }
      td[data-align="right"], th[data-align="right"] { text-align: right; }
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

function looksLikeMarkdownSnippet(value) {
  const text = String(value || "").trim();
  if (!text || isProbablyUrl(text)) {
    return false;
  }
  return /^(#{1,6}\s|>\s|[-*+]\s|\d+\.\s|[-*+]\s\[(?: |x|X)\]\s|```|~~~|\|.+\|)/m.test(text) || /\n/.test(text);
}

function canPasteFrontMatterAtCursor(editor) {
  if (!editor?.state?.selection?.empty) {
    return false;
  }
  return editor.state.selection.from <= 2;
}

function formatJsonLikeText(value) {
  const parsed = JSON.parse(value);
  return JSON.stringify(parsed, null, 2);
}

function formatSqlLikeText(value) {
  const keywords = [
    "select", "from", "where", "group by", "order by", "limit", "insert into", "values",
    "update", "set", "delete", "join", "left join", "right join", "inner join", "outer join",
    "and", "or", "case", "when", "then", "else", "end", "as", "on"
  ];
  let text = String(value || "").trim();
  keywords
    .sort((left, right) => right.length - left.length)
    .forEach((keyword) => {
      const escaped = keyword.replace(/\s+/g, "\\s+");
      text = text.replace(new RegExp(`\\b${escaped}\\b`, "gi"), keyword.toUpperCase());
    });
  return text
    .replace(/\s+(FROM|WHERE|GROUP BY|ORDER BY|LIMIT|VALUES|SET|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|OUTER JOIN)\b/g, "\n$1")
    .replace(/\s+(AND|OR)\b/g, "\n  $1");
}

function formatYamlLikeText(value) {
  const parsed = yaml.load(String(value || ""));
  return yaml.dump(parsed, { lineWidth: 100, noRefs: true }).trim();
}

function normalizeMarkdownBlock(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^(#{1,6})(\S)/gm, "$1 $2")
    .trim();
}

function getTableLayoutDocumentKey(filePath) {
  return filePath || "__untitled__";
}

function buildParagraphNode(schema, text) {
  return schema.nodes.paragraph.create(null, text ? schema.text(text) : null);
}

function buildInitialVisualMerge(existingRaw, incomingRaw) {
  const simpleExisting = parseFrontMatterFields(extractYamlFrontMatter(existingRaw).content || existingRaw);
  const simpleIncoming = parseFrontMatterFields(extractYamlFrontMatter(incomingRaw).content || incomingRaw);
  if (simpleExisting.isSimple && simpleIncoming.isSimple) {
    return mergeFrontMatterRaw(existingRaw, incomingRaw);
  }
  return incomingRaw || existingRaw || "";
}

function buildFrontMatterMergeState(existingRaw, incomingRaw, html) {
  const mergedRaw = buildInitialVisualMerge(existingRaw, incomingRaw);
  return {
    currentRaw: existingRaw,
    incomingRaw,
    mergedRaw,
    mergedValue: parseYamlObject(extractYamlFrontMatter(mergedRaw).content || mergedRaw) || {},
    html
  };
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
  if (!hasMountedEditorView(editor)) {
    return null;
  }

  try {
    const view = editor.view;
    const root = view.dom;
    const selection = editor?.state?.selection;
    const $from = selection?.$from;
    if (!selection || !$from) {
      return root.firstElementChild instanceof HTMLElement ? root.firstElementChild : null;
    }

    for (let depth = $from.depth; depth > 0; depth -= 1) {
      let blockPos;
      let domNode;
      try {
        blockPos = $from.before(depth);
        domNode = view.nodeDOM(blockPos);
      } catch {
        continue;
      }
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
  } catch {
    return null;
  }
}

function hasMountedEditorView(editor) {
  try {
    const view = editor?.view;
    return view?.dom instanceof HTMLElement && view?.docView != null && !view?.isDestroyed;
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

function getCurrentLine(markdown, cursor) {
  const lineStart = markdown.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
  const nextNewline = markdown.indexOf("\n", cursor);
  const lineEnd = nextNewline === -1 ? markdown.length : nextNewline;
  return {
    lineStart,
    lineEnd,
    line: markdown.slice(lineStart, lineEnd)
  };
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

turndown.addRule("codeBlocksWithLanguage", {
  filter(node) {
    return node.nodeName === "PRE" && node.firstElementChild?.nodeName === "CODE";
  },
  replacement(content, node) {
    const code = node.firstElementChild;
    const language =
      code?.getAttribute("data-language") ||
      (code?.getAttribute("class") || "")
        .split(/\s+/)
        .find((value) => value.startsWith("language-"))
        ?.replace(/^language-/, "") ||
      "";
    const value = code?.textContent?.replace(/\n$/, "") || "";
    return `\n\n\`\`\`${language}\n${value}\n\`\`\`\n\n`;
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
  const [editingCheatsheetOpen, setEditingCheatsheetOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [statusState, setStatusState] = useState({ message: "Ready", kind: "default" });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");
  const [slashMenuState, setSlashMenuState] = useState({ open: false, query: "", top: 0, left: 0 });
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [tableToolbarVisible, setTableToolbarVisible] = useState(false);
  const [tableSelectionCount, setTableSelectionCount] = useState(0);
  const [tableHandleState, setTableHandleState] = useState({ visible: false, rows: [], cols: [] });
  const [frontMatterMergeState, setFrontMatterMergeState] = useState(null);

  const sourceRef = useRef(null);
  const sourceHighlightRef = useRef(null);
  const programmaticEditorSyncRef = useRef(false);
  const programmaticMarkdownSyncRef = useRef(false);
  const lastEditorMarkdownRef = useRef(initialMarkdown);
  const editorHeadingsRef = useRef([]);
  const statusTimerRef = useRef(null);
  const preferencesRef = useRef(defaultPreferences);
  const slashMenuStateRef = useRef({ open: false, query: "", top: 0, left: 0 });
  const slashCommandItemsRef = useRef([]);
  const executeSlashCommandRef = useRef(null);
  const paperRef = useRef(null);
  const suppressNextSmartTransformRef = useRef(false);

  const deferredMarkdown = useDeferredValue(markdownText);
  const matches = useMemo(() => findMatches(markdownText, findQuery), [markdownText, findQuery]);
  const stats = useMemo(() => countStats(markdownText), [markdownText]);
  const frontMatterState = useMemo(() => {
    const { content, raw } = extractYamlFrontMatter(markdownText);
    return {
      ...parseFrontMatterFields(content),
      raw
    };
  }, [markdownText]);
  const recentFiles = useMemo(() => normalizeRecentFiles(preferences.recentFiles), [preferences.recentFiles]);
  const paletteUsage = useMemo(() => normalizePaletteUsage(preferences.paletteUsage), [preferences.paletteUsage]);
  const workspaceFiles = useMemo(
    () => flattenWorkspaceFiles(workspaceTree, preferences.workspaceRoot),
    [workspaceTree, preferences.workspaceRoot]
  );
  const commandPaletteSuggestions = useMemo(() => {
    const normalizedQuery = String(commandPaletteQuery ?? "").trim();
    if (!normalizedQuery) {
      return [
        { id: "open-file", badge: "Cmd", label: "Open a document", description: "Choose a Markdown file from disk" },
        { id: "open-folder", badge: "Cmd", label: "Open a workspace folder", description: "Index files for quick switching" },
        { id: "new-file", badge: "Cmd", label: "Create a new document", description: "Start with a blank note" }
      ];
    }
    return [
      { id: "open-file", badge: "Cmd", label: `Open a file instead`, description: `Nothing matched "${normalizedQuery}"` },
      { id: "open-folder", badge: "Cmd", label: "Switch workspace", description: "Search a different folder tree" },
      { id: "preferences", badge: "Cmd", label: "Open preferences", description: "Adjust views, theme, and writing defaults" }
    ];
  }, [commandPaletteQuery]);
  const commandPaletteItems = useMemo(() => {
    const commands = [
      {
        id: "new-file",
        kind: "command",
        badge: "Cmd",
        section: "Actions",
        label: "New document",
        description: "Create a blank Markdown document",
        shortcut: "Ctrl+N",
        keywords: "new create file document"
      },
      {
        id: "open-file",
        kind: "command",
        badge: "Cmd",
        section: "Actions",
        label: "Open document",
        description: "Choose a Markdown file from disk",
        shortcut: "Ctrl+O",
        keywords: "open file markdown"
      },
      {
        id: "open-folder",
        kind: "command",
        badge: "Cmd",
        section: "Actions",
        label: "Open workspace folder",
        description: "Browse Markdown files from a folder tree",
        shortcut: "Ctrl+Shift+O",
        keywords: "folder workspace tree files"
      },
      {
        id: "save-file",
        kind: "command",
        badge: "Cmd",
        section: "Actions",
        label: isDirty ? "Save document" : "Save document",
        description: isDirty ? "Persist current changes" : "Document already saved",
        shortcut: "Ctrl+S",
        keywords: "save write persist"
      },
      {
        id: "find",
        kind: "command",
        badge: "Cmd",
        section: "Actions",
        label: "Find and replace",
        description: "Search the Markdown source with replace controls",
        shortcut: "Ctrl+F",
        keywords: "find search replace"
      },
      {
        id: "preferences",
        kind: "command",
        badge: "Cmd",
        section: "Actions",
        label: "Preferences",
        description: "Theme, typography, and writing defaults",
        shortcut: "Ctrl+,",
        keywords: "settings preferences theme font width"
      },
      {
        id: "view-editor",
        kind: "command",
        badge: "View",
        section: "Views",
        label: "Switch to editor",
        description: "Immersive Typora-style writing surface",
        keywords: "view editor write"
      },
      {
        id: "view-split",
        kind: "command",
        badge: "View",
        section: "Views",
        label: "Switch to split view",
        description: "Edit and preview side by side",
        keywords: "split preview live dual pane"
      },
      {
        id: "view-source",
        kind: "command",
        badge: "View",
        section: "Views",
        label: "Switch to source",
        description: "Edit raw Markdown directly",
        keywords: "source raw markdown code"
      },
      {
        id: "view-preview",
        kind: "command",
        badge: "View",
        section: "Views",
        label: "Switch to preview",
        description: "Read the rendered document only",
        keywords: "preview rendered read"
      },
      {
        id: "toggle-focus",
        kind: "command",
        badge: "Mode",
        section: "Writing",
        label: preferences.focusMode ? "Disable focus mode" : "Enable focus mode",
        description: "Dim inactive blocks around the current paragraph",
        shortcut: "F8",
        keywords: "focus writing zen"
      },
      {
        id: "toggle-typewriter",
        kind: "command",
        badge: "Mode",
        section: "Writing",
        label: preferences.typewriterMode ? "Disable typewriter mode" : "Enable typewriter mode",
        description: "Keep the active block centered while writing",
        shortcut: "F9",
        keywords: "typewriter center writing"
      },
      {
        id: "open-outline",
        kind: "command",
        badge: "Side",
        section: "Sidebar",
        label: "Show outline",
        description: "Navigate headings in the current document",
        shortcut: "Ctrl+Shift+1",
        keywords: "sidebar outline toc headings"
      },
      {
        id: "open-files",
        kind: "command",
        badge: "Side",
        section: "Sidebar",
        label: "Show files",
        description: "Browse the current workspace tree",
        shortcut: "Ctrl+Shift+2",
        keywords: "sidebar files workspace"
      },
      {
        id: "open-properties",
        kind: "command",
        badge: "Side",
        section: "Sidebar",
        label: "Show properties",
        description: "Edit title, tags, and front matter",
        shortcut: "Ctrl+Shift+3",
        keywords: "sidebar properties front matter metadata tags"
      },
      {
        id: "theme-paper",
        kind: "command",
        badge: "Theme",
        section: "Themes",
        label: "Switch to Paper theme",
        description: "Bright editorial canvas",
        keywords: "theme paper light"
      },
      {
        id: "theme-forest",
        kind: "command",
        badge: "Theme",
        section: "Themes",
        label: "Switch to Forest theme",
        description: "Soft green writing environment",
        keywords: "theme forest green"
      },
      {
        id: "theme-midnight",
        kind: "command",
        badge: "Theme",
        section: "Themes",
        label: "Switch to Midnight theme",
        description: "Dark reading and coding palette",
        keywords: "theme midnight dark"
      }
    ];
    const recentFileItems = recentFiles.map((path, index) => ({
      id: `file:${path}`,
      kind: "file",
      badge: "Recent",
      section: "Recent Files",
      label: basenamePath(path),
      description: getDisplayPath(path, preferences.workspaceRoot),
      relativePath: getDisplayPath(path, preferences.workspaceRoot),
      path,
      recentIndex: index,
      keywords: `${basenamePath(path)} ${path}`
    }));

    const recentFileSet = new Set(recentFiles);
    const workspaceFileItems = workspaceFiles
      .filter((file) => !recentFileSet.has(file.path))
      .map((file) => ({
        id: `file:${file.path}`,
        kind: "file",
        badge: "File",
        section: "Files",
        label: file.name,
        description: file.relativePath,
        relativePath: file.relativePath,
        path: file.path,
        keywords: `${file.name} ${file.relativePath}`
      }));

    const items = [...commands, ...recentFileItems, ...workspaceFileItems];
    const recentRanks = new Map(recentFiles.map((path, index) => [path, index]));
    const normalizedQuery = String(commandPaletteQuery ?? "").trim();

    if (!normalizedQuery) {
      const topHits = items
        .map((item) => ({ ...item, score: scorePaletteItem(item, "", paletteUsage, recentRanks) }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
        .slice(0, 6)
        .map((item) => ({ ...item, section: "Top Hits" }));

      const topHitIds = new Set(topHits.map((item) => item.id));
      return [
        ...topHits,
        ...recentFileItems.filter((item) => !topHitIds.has(item.id)),
        ...commands.filter((item) => !topHitIds.has(item.id))
      ];
    }

    return items
      .filter((item) => matchesPaletteQuery(item, normalizedQuery))
      .map((item) => ({ ...item, score: scorePaletteItem(item, normalizedQuery, paletteUsage, recentRanks) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
      .map((item, index) => ({
        ...item,
        section: index < 6 ? "Best Match" : item.section
      }));
  }, [
    commandPaletteQuery,
    isDirty,
    paletteUsage,
    preferences.focusMode,
    preferences.typewriterMode,
    preferences.workspaceRoot,
    recentFiles,
    workspaceFiles
  ]);
  const slashCommandItems = useMemo(() => {
    const definitions = [
      { id: "paragraph", badge: "Text", label: "Paragraph", description: "Return to normal body text", keywords: "paragraph text body" },
      { id: "heading-1", badge: "H1", label: "Heading 1", description: "Large document title", keywords: "heading title h1" },
      { id: "heading-2", badge: "H2", label: "Heading 2", description: "Section heading", keywords: "heading section h2" },
      { id: "heading-3", badge: "H3", label: "Heading 3", description: "Subsection heading", keywords: "heading subsection h3" },
      { id: "bullet-list", badge: "List", label: "Bullet list", description: "Unordered list items", keywords: "list bullet unordered" },
      { id: "ordered-list", badge: "1.", label: "Numbered list", description: "Ordered list items", keywords: "list ordered numbered" },
      { id: "task-list", badge: "Task", label: "Task list", description: "Checkbox list for todos", keywords: "task checkbox todo" },
      { id: "blockquote", badge: "Quote", label: "Blockquote", description: "Quoted or callout-friendly block", keywords: "quote blockquote callout" },
      { id: "code-block", badge: "Code", label: "Code block", description: "Fenced code or snippet block", keywords: "code block fenced snippet" },
      { id: "horizontal-rule", badge: "Rule", label: "Divider", description: "Horizontal rule between sections", keywords: "divider rule hr" },
      { id: "table", badge: "Tbl", label: "Table", description: "Insert a markdown table scaffold", keywords: "table columns rows" },
      { id: "image", badge: "Img", label: "Image", description: "Pick and insert an image file", keywords: "image photo media" }
    ];
    const normalizedQuery = String(slashMenuState.query || "").trim().toLowerCase();
    if (!normalizedQuery) {
      return definitions;
    }
    return definitions.filter((item) => matchesPaletteQuery(item, normalizedQuery));
  }, [slashMenuState.query]);
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

  function flashActiveEditorBlock(instance = editor) {
    const target = getActiveEditorBlock(instance);
    if (!(target instanceof HTMLElement)) {
      return;
    }
    target.classList.remove("editor-block-flash");
    window.requestAnimationFrame(() => {
      target.classList.add("editor-block-flash");
      window.setTimeout(() => target.classList.remove("editor-block-flash"), 520);
    });
  }

  function syncTableToolbar(instance) {
    const tableActive = Boolean(instance?.isActive?.("table"));
    setTableToolbarVisible(tableActive);
    const selection = instance?.state?.selection;
    if (selection instanceof CellSelection) {
      const cells = [];
      selection.forEachCell((cell, pos) => {
        cells.push({ cell, pos });
      });
      setTableSelectionCount(cells.length);
    } else {
      setTableSelectionCount(0);
    }

    if (!tableActive || !paperRef.current || !hasMountedEditorView(instance)) {
      setTableHandleState({ visible: false, rows: [], cols: [] });
      return;
    }

    const selectedCell = instance.view.dom.querySelector(".selectedCell");
    const table = selectedCell?.closest("table");
    if (!(table instanceof HTMLElement)) {
      setTableHandleState({ visible: false, rows: [], cols: [] });
      return;
    }

    const paperRect = paperRef.current.getBoundingClientRect();
    const rowElements = Array.from(table.rows || []);
    const rows = rowElements.map((row, index) => {
      const rect = row.getBoundingClientRect();
      return {
        index,
        top: rect.top - paperRect.top,
        left: rect.left - paperRect.left - 72,
        height: rect.height
      };
    });

    const headerCells = Array.from(rowElements[0]?.cells || []);
    const cols = headerCells.map((cell, index) => {
      const rect = cell.getBoundingClientRect();
      return {
        index,
        left: rect.left - paperRect.left,
        top: rect.top - paperRect.top - 34,
        width: rect.width
      };
    });

    setTableHandleState({ visible: true, rows, cols });
  }

  function captureTableLayouts(instance) {
    if (!hasMountedEditorView(instance)) {
      return;
    }
    const tables = Array.from(instance.view.dom.querySelectorAll("table"));
    const documentKey = getTableLayoutDocumentKey(filePath);
    const nextLayouts = {};

    tables.forEach((table, index) => {
      const cols = Array.from(table.querySelectorAll("colgroup col"));
      const widths = (cols.length > 0 ? cols : Array.from(table.rows?.[0]?.cells || []))
        .map((element) => parseFloat(element.style.width || ""))
        .filter((value) => Number.isFinite(value) && value > 0)
        .map((value) => Math.round(value));

      if (widths.length > 0) {
        nextLayouts[index] = widths;
      }
    });

    updatePreferences((current) => {
      const existingLayouts = current.tableLayouts || {};
      const currentForDocument = JSON.stringify(existingLayouts[documentKey] || {});
      const nextForDocument = JSON.stringify(nextLayouts);
      if (currentForDocument === nextForDocument) {
        return {};
      }
      return {
        tableLayouts: {
          ...existingLayouts,
          [documentKey]: nextLayouts
        }
      };
    });
  }

  function applyTableLayouts(instance) {
    if (!hasMountedEditorView(instance)) {
      return;
    }
    const layouts = preferencesRef.current.tableLayouts?.[getTableLayoutDocumentKey(filePath)];
    if (!layouts) {
      return;
    }

    const tables = Array.from(instance.view.dom.querySelectorAll("table"));
    tables.forEach((table, index) => {
      const widths = layouts[index];
      if (!Array.isArray(widths) || widths.length === 0) {
        return;
      }
      let colgroup = table.querySelector("colgroup");
      if (!colgroup) {
        colgroup = document.createElement("colgroup");
        table.prepend(colgroup);
      }
      while (colgroup.children.length < widths.length) {
        colgroup.appendChild(document.createElement("col"));
      }
      Array.from(colgroup.children).forEach((col, colIndex) => {
        if (widths[colIndex]) {
          col.style.width = `${widths[colIndex]}px`;
        }
      });
      table.style.tableLayout = "fixed";
    });
  }

  function closeSlashMenu() {
    setSlashMenuState((current) => (current.open ? { open: false, query: "", top: 0, left: 0 } : current));
  }

  function syncSlashMenu(instance) {
    const context = getEditorSlashContext(instance);
    if (!context) {
      closeSlashMenu();
      return;
    }
    const coords = instance.view.coordsAtPos(instance.state.selection.from);
    setSlashMenuState({
      open: true,
      query: context.query,
      top: coords.bottom + 8,
      left: Math.max(24, coords.left)
    });
  }

  async function executeSlashCommand(item) {
    if (!editor || !item) {
      return;
    }

    const context = getEditorSlashContext(editor);
    closeSlashMenu();

    if (!context) {
      return;
    }

    const runAfterDelete = async (callback) => {
      runEditorCommand((chain) => chain.deleteRange({ from: context.from, to: context.to }).run());
      await callback();
    };

    switch (item.id) {
      case "paragraph":
        runEditorCommand((chain) => chain.deleteRange({ from: context.from, to: context.to }).setParagraph().run());
        break;
      case "heading-1":
        runEditorCommand((chain) => chain.deleteRange({ from: context.from, to: context.to }).toggleHeading({ level: 1 }).run());
        break;
      case "heading-2":
        runEditorCommand((chain) => chain.deleteRange({ from: context.from, to: context.to }).toggleHeading({ level: 2 }).run());
        break;
      case "heading-3":
        runEditorCommand((chain) => chain.deleteRange({ from: context.from, to: context.to }).toggleHeading({ level: 3 }).run());
        break;
      case "bullet-list":
        runEditorCommand((chain) => chain.deleteRange({ from: context.from, to: context.to }).toggleBulletList().run());
        break;
      case "ordered-list":
        runEditorCommand((chain) => chain.deleteRange({ from: context.from, to: context.to }).toggleOrderedList().run());
        break;
      case "task-list":
        runEditorCommand((chain) => chain.deleteRange({ from: context.from, to: context.to }).toggleTaskList().run());
        break;
      case "blockquote":
        runEditorCommand((chain) => chain.deleteRange({ from: context.from, to: context.to }).toggleBlockquote().run());
        break;
      case "code-block":
        runEditorCommand((chain) => chain.deleteRange({ from: context.from, to: context.to }).toggleCodeBlock().run());
        break;
      case "horizontal-rule":
        runEditorCommand((chain) => chain.deleteRange({ from: context.from, to: context.to }).setHorizontalRule().run());
        break;
      case "table":
        await runAfterDelete(async () => insertTable());
        break;
      case "image":
        await runAfterDelete(async () => insertImage());
        break;
      default:
        break;
    }
  }

  useEffect(() => {
    executeSlashCommandRef.current = executeSlashCommand;
  });

  function applyEditorMarkdownShortcut(rangeFrom, rangeTo, apply) {
    runEditorCommand((chain) => apply(chain.deleteRange({ from: rangeFrom, to: rangeTo })));
  }

  function isEditorSelectionInsideList(selection) {
    const names = [];
    for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
      names.push(selection.$from.node(depth).type.name);
    }
    return {
      inTaskItem: names.includes("taskItem"),
      inListItem: names.includes("listItem"),
      inBulletList: names.includes("bulletList"),
      inOrderedList: names.includes("orderedList")
    };
  }

  function exitCurrentListItem(selection) {
    const state = isEditorSelectionInsideList(selection);
    if (state.inTaskItem) {
      return runEditorCommand((chain) => chain.liftListItem("taskItem").run());
    }
    if (state.inListItem) {
      return runEditorCommand((chain) => chain.liftListItem("listItem").run());
    }
    return false;
  }

  function handleEditorStructuredEditing(view, event) {
    const selection = view.state.selection;
    if (!selection.empty) {
      return false;
    }

    const { $from } = selection;
    const state = isEditorSelectionInsideList(selection);
    const cursorAtStart = $from.parentOffset === 0;
    const textContent = $from.parent.textContent || "";
    const emptyTextblock = !textContent.trim();

    if (event.key === "Tab" && (state.inTaskItem || state.inListItem)) {
      event.preventDefault();
      if (state.inTaskItem) {
        runEditorCommand((chain) => (event.shiftKey ? chain.liftListItem("taskItem").run() : chain.sinkListItem("taskItem").run()));
        return true;
      }
      runEditorCommand((chain) => (event.shiftKey ? chain.liftListItem("listItem").run() : chain.sinkListItem("listItem").run()));
      return true;
    }

    if (event.key === "Enter" && emptyTextblock && (state.inTaskItem || state.inListItem)) {
      event.preventDefault();
      exitCurrentListItem(selection);
      return true;
    }

    if (event.key === "Backspace" && cursorAtStart && emptyTextblock && (state.inTaskItem || state.inListItem)) {
      event.preventDefault();
      exitCurrentListItem(selection);
      return true;
    }

    if (event.key === "Backspace" && cursorAtStart && emptyTextblock) {
      if ($from.parent.type.name === "heading") {
        event.preventDefault();
        runEditorCommand((chain) => chain.setParagraph().run());
        return true;
      }

      if ($from.parent.type.name === "blockquote") {
        event.preventDefault();
        runEditorCommand((chain) => chain.toggleBlockquote().run());
        return true;
      }

      if ($from.parent.type.name === "codeBlock") {
        event.preventDefault();
        runEditorCommand((chain) => chain.clearNodes().setParagraph().run());
        return true;
      }
    }

    return false;
  }

  function handleEditorSmartMarkdown(view, event) {
    if (handleEditorStructuredEditing(view, event)) {
      return true;
    }

    if (!preferencesRef.current.smartMarkdownTransform) {
      return false;
    }

    if (suppressNextSmartTransformRef.current) {
      suppressNextSmartTransformRef.current = false;
      return false;
    }

    const selection = view.state.selection;
    if (!selection.empty) {
      return false;
    }

    const { $from } = selection;
    const parent = $from.parent;
    if (!parent?.isTextblock || parent.type.name !== "paragraph") {
      return false;
    }

    const beforeCursor = parent.textContent.slice(0, $from.parentOffset);
    const shortcutFrom = selection.from - beforeCursor.length;
    const escapedSpacePrefix = /^\\(#{1,6}|>|[-*+]|\d+\.|[-*+]\s\[(?: |x|X)\])$/.exec(beforeCursor);
    const transformRules = preferencesRef.current.smartTransformRules || {};

    if (event.key === " ") {
      if (escapedSpacePrefix) {
        event.preventDefault();
        applyEditorMarkdownShortcut(shortcutFrom, selection.from, (chain) =>
          chain.insertContent(`${escapedSpacePrefix[1]} `).run()
        );
        setHint("Inserted literal Markdown marker.");
        return true;
      }

      if ((transformRules.heading ?? true) && /^#{1,6}$/.test(beforeCursor)) {
        event.preventDefault();
        applyEditorMarkdownShortcut(shortcutFrom, selection.from, (chain) =>
          chain.toggleHeading({ level: beforeCursor.length }).run()
        );
        flashActiveEditorBlock();
        setHint(`Heading ${beforeCursor.length}. Backspace on empty heading returns to paragraph.`);
        return true;
      }

      if ((transformRules.blockquote ?? true) && /^>$/.test(beforeCursor)) {
        event.preventDefault();
        applyEditorMarkdownShortcut(shortcutFrom, selection.from, (chain) => chain.toggleBlockquote().run());
        flashActiveEditorBlock();
        setHint("Blockquote. Backspace on empty quote returns to paragraph.");
        return true;
      }

      if ((transformRules.bulletList ?? true) && /^[-*+]$/.test(beforeCursor)) {
        event.preventDefault();
        applyEditorMarkdownShortcut(shortcutFrom, selection.from, (chain) => chain.toggleBulletList().run());
        flashActiveEditorBlock();
        setHint("Bullet list. Backspace on empty item exits the list.");
        return true;
      }

      if ((transformRules.orderedList ?? true) && /^\d+\.$/.test(beforeCursor)) {
        event.preventDefault();
        applyEditorMarkdownShortcut(shortcutFrom, selection.from, (chain) => chain.toggleOrderedList().run());
        flashActiveEditorBlock();
        setHint("Ordered list. Backspace on empty item exits the list.");
        return true;
      }

      if ((transformRules.taskList ?? true) && /^[-*+]\s\[(?: |x|X)\]$/.test(beforeCursor)) {
        event.preventDefault();
        applyEditorMarkdownShortcut(shortcutFrom, selection.from, (chain) => chain.toggleTaskList().run());
        flashActiveEditorBlock();
        setHint("Task list. Backspace on empty item exits the list.");
        return true;
      }
    }

    const escapedFenceMatch = /^\\((?:```|~~~)([A-Za-z0-9_-]+)?)$/.exec(beforeCursor);
    if (event.key === "Enter" && escapedFenceMatch) {
      event.preventDefault();
      applyEditorMarkdownShortcut(shortcutFrom, selection.from, (chain) => chain.insertContent(`${escapedFenceMatch[1]}\n`).run());
      setHint("Inserted literal code fence.");
      return true;
    }

    const codeFenceMatch = /^(?:```|~~~)([A-Za-z0-9_-]+)?$/.exec(beforeCursor);
    if ((transformRules.codeFence ?? true) && event.key === "Enter" && codeFenceMatch) {
      event.preventDefault();
      applyEditorMarkdownShortcut(shortcutFrom, selection.from, (chain) =>
        chain.setNode("codeBlock", { language: codeFenceMatch[1] || null }).run()
      );
      flashActiveEditorBlock();
      setHint(
        codeFenceMatch[1]
          ? `${codeFenceMatch[1]} code block. Backspace on empty block returns to paragraph.`
          : "Code block. Backspace on empty block returns to paragraph."
      );
      return true;
    }

    return false;
  }

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3, 4, 5, 6] },
          codeBlock: false,
          link: false,
          underline: false
        }),
        Underline,
        CodeBlockWithLanguage,
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
        TableHeaderWithAlignment,
        TableCellWithAlignment
      ],
      content: renderMarkdownForEditor(markdownText, filePath, outline),
      editorProps: {
        attributes: { class: "editor-surface" },
        handleDOMEvents: {
          keydown: (view, event) => {
            if (slashMenuStateRef.current.open) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSlashMenuIndex((current) => (current + 1) % Math.max(1, slashCommandItemsRef.current.length));
                return true;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setSlashMenuIndex(
                  (current) =>
                    (current - 1 + Math.max(1, slashCommandItemsRef.current.length)) % Math.max(1, slashCommandItemsRef.current.length)
                );
                return true;
              }
              if (event.key === "Enter" || event.key === "Tab") {
                const item = slashCommandItemsRef.current[slashMenuIndex];
                if (item) {
                  event.preventDefault();
                  executeSlashCommandRef.current?.(item);
                  return true;
                }
              }
              if (event.key === "Escape") {
                event.preventDefault();
                closeSlashMenu();
                return true;
              }
            }

            return handleEditorSmartMarkdown(view, event);
          },
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
        syncSlashMenu(instance);
        syncTableToolbar(instance);
        window.requestAnimationFrame(() => applyTableLayouts(instance));
      },
      onUpdate({ editor: instance }) {
        editorHeadingsRef.current = buildEditorHeadingPositions(instance);
        syncEditorModes(instance);
        syncSlashMenu(instance);
        syncTableToolbar(instance);
        captureTableLayouts(instance);
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
        syncSlashMenu(instance);
        syncTableToolbar(instance);
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

  useEffect(() => {
    slashMenuStateRef.current = slashMenuState;
  }, [slashMenuState]);

  useEffect(() => {
    slashCommandItemsRef.current = slashCommandItems;
  }, [slashCommandItems]);

  useEffect(() => {
    setSlashMenuIndex(0);
  }, [slashMenuState.query, slashMenuState.open]);

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
      window.requestAnimationFrame(() => applyTableLayouts(editor));
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
        case "open-editing-cheatsheet":
          setEditingCheatsheetOpen(true);
          break;
        case "open-command-palette":
          openCommandPalette();
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
    const handleKeyDown = (event) => {
      const isModifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (isModifier && key === "p") {
        event.preventDefault();
        openCommandPalette();
        return;
      }

      if (isModifier && event.shiftKey && key === "3") {
        event.preventDefault();
        updatePreferences({ sidebarVisible: true, sidebarTab: "properties" });
        return;
      }

      if (event.key === "Escape" && commandPaletteOpen) {
        event.preventDefault();
        closeCommandPalette();
        return;
      }

      if (event.key === "Escape" && slashMenuStateRef.current.open) {
        event.preventDefault();
        closeSlashMenu();
        return;
      }

      if (event.key === "Escape" && editor?.isFocused) {
        suppressNextSmartTransformRef.current = true;
        setHint("Next smart transform skipped. Use \\# or \\``` for literal markers.");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandPaletteOpen, preferences.focusMode, preferences.typewriterMode]);

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

    const applyTableMatrixPaste = (text) => {
      const selection = editor.state.selection;
      if (!(selection instanceof CellSelection)) {
        return false;
      }

      const rows = String(text || "")
        .replace(/\r/g, "")
        .split("\n")
        .filter((row) => row.length > 0)
        .map((row) => row.split("\t"));

      if (rows.length === 0 || (rows.length === 1 && rows[0].length === 1)) {
        return false;
      }

      const $anchor = selection.$anchorCell;
      const table = $anchor.node(-1);
      const tableStart = $anchor.start(-1);
      const map = TableMap.get(table);
      const anchorRect = map.findCell($anchor.pos - tableStart);
      const headRect = map.findCell(selection.$headCell.pos - tableStart);
      const left = Math.min(anchorRect.left, headRect.left);
      const right = Math.max(anchorRect.right, headRect.right);
      const top = Math.min(anchorRect.top, headRect.top);
      const bottom = Math.max(anchorRect.bottom, headRect.bottom);

      if (left === undefined || top === undefined) {
        return false;
      }

      const width = Math.max(...rows.map((row) => row.length));
      const { tr, schema } = editor.state;
      for (let rowIndex = top; rowIndex < bottom; rowIndex += 1) {
        for (let colIndex = left; colIndex < right; colIndex += 1) {
          const mapIndex = rowIndex * map.width + colIndex;
          const cellPos = tableStart + map.map[mapIndex];
          const cell = tr.doc.nodeAt(cellPos);
          if (!cell) {
            continue;
          }
          const nextValue = rows[(rowIndex - top) % rows.length]?.[(colIndex - left) % width];
          tr.replaceWith(cellPos + 1, cellPos + cell.nodeSize - 1, buildParagraphNode(schema, nextValue || ""));
        }
      }

      editor.view.dispatch(tr);
      return true;
    };

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
      const pastedText = String(event.clipboardData?.getData("text/plain") || "").trim();
      const sourceFocused = sourceRef.current && (event.target === sourceRef.current || document.activeElement === sourceRef.current);
      const editorFocused = !sourceFocused && editor?.isFocused;
      if (pastedText && isProbablyUrl(pastedText)) {
        if (sourceFocused && applyPastedLinkInSource(pastedText)) {
          event.preventDefault();
          setStatus(`Linked selection to ${pastedText}`);
          return;
        }
        if (editor?.state.selection && !editor.state.selection.empty) {
          event.preventDefault();
          runEditorCommand((chain) => chain.setLink({ href: pastedText }).run());
          setStatus(`Linked selection to ${pastedText}`);
          return;
        }
      }

      if (pastedText && editorFocused && /[\t\n]/.test(pastedText) && applyTableMatrixPaste(pastedText)) {
        event.preventDefault();
        setStatus("Pasted matrix into selected cells");
        return;
      }

      if (pastedText && editorFocused && looksLikeMarkdownSnippet(pastedText)) {
        event.preventDefault();
        const renderedSnippet = renderMarkdownSnippetForEditor(pastedText, filePath);
        const shouldApplyFrontMatter = renderedSnippet.frontMatterRaw && canPasteFrontMatterAtCursor(editor);
        if (renderedSnippet.frontMatterRaw && shouldApplyFrontMatter) {
          const existing = extractYamlFrontMatter(markdownText);
          const existingParsed = parseFrontMatterFields(existing.content);
          const incomingParsed = parseFrontMatterFields(extractYamlFrontMatter(renderedSnippet.frontMatterRaw).content);

          if (!existingParsed.isSimple || !incomingParsed.isSimple) {
            setFrontMatterMergeState(buildFrontMatterMergeState(existing.raw, renderedSnippet.frontMatterRaw, renderedSnippet.html));
            setStatus("Review front matter merge before inserting");
            return;
          }

          setMarkdownText((current) => {
            const currentFrontMatter = extractYamlFrontMatter(current);
            const mergedRaw = mergeFrontMatterRaw(currentFrontMatter.raw, renderedSnippet.frontMatterRaw);
            return prependFrontMatter(mergedRaw, currentFrontMatter.body);
          });
          setIsDirty(true);
        } else if (renderedSnippet.frontMatterRaw) {
          setStatus("Pasted Markdown snippet and skipped front matter outside document start");
        }
        runEditorCommand((chain) => chain.insertContent(renderedSnippet.html).run(), {
          preserveScroll: true
        });
        if (!renderedSnippet.frontMatterRaw || shouldApplyFrontMatter) {
          setStatus("Inserted Markdown snippet");
        }
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
    setPreferences((current) => ({ ...current, ...(typeof patch === "function" ? patch(current) : patch) }));
  }

  function rememberRecentFile(nextFilePath) {
    if (!nextFilePath) {
      return;
    }
    updatePreferences((current) => ({
      recentFiles: [nextFilePath, ...normalizeRecentFiles(current.recentFiles).filter((path) => path !== nextFilePath)].slice(0, 8)
    }));
  }

  function rememberPaletteItem(item) {
    if (!item) {
      return;
    }
    updatePreferences((current) => {
      const nextPatch = {};
      if (item.kind === "command") {
        const usage = normalizePaletteUsage(current.paletteUsage);
        nextPatch.paletteUsage = {
          ...usage,
          [item.id]: (usage[item.id] || 0) + 1
        };
      }
      if (item.path) {
        nextPatch.recentFiles = [item.path, ...normalizeRecentFiles(current.recentFiles).filter((path) => path !== item.path)].slice(0, 8);
      }
      return nextPatch;
    });
  }

  function handleEditorEndMouseDown(event) {
    if (!editor || event.button !== 0 || !hasMountedEditorView(editor)) {
      return;
    }
    event.preventDefault();
    placeCursorInTrailingParagraph(editor.view);
  }

  function setStatus(message) {
    setStatusState({ message, kind: "default" });
    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current);
    }
    statusTimerRef.current = window.setTimeout(() => setStatusState({ message: "Ready", kind: "default" }), 3200);
  }

  function setHint(message) {
    if (!preferencesRef.current.smartTransformHints) {
      return;
    }
    setStatusState({ message, kind: "hint" });
    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current);
    }
    statusTimerRef.current = window.setTimeout(() => setStatusState({ message: "Ready", kind: "default" }), 3600);
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
    rememberRecentFile(nextFilePath);
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
      rememberRecentFile(result.filePath);
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

  function handleTableAction(action) {
    if (!editor) {
      return;
    }

    const selection = editor.state.selection;
    const tableSelection = selection instanceof CellSelection ? selection : null;

    const selectTableAxis = (axis) => {
      if (!tableSelection) {
        return false;
      }
      const $cell = tableSelection.$anchorCell;
      const table = $cell.node(-1);
      const tableStart = $cell.start(-1);
      const map = TableMap.get(table);
      const cellIndex = map.map.indexOf($cell.pos - tableStart);
      const row = Math.floor(cellIndex / map.width);
      const col = cellIndex % map.width;
      const anchorIndex = axis === "row" ? row * map.width : col;
      const headIndex = axis === "row" ? row * map.width + (map.width - 1) : col + map.width * (map.height - 1);
      runEditorCommand((chain) =>
        chain
          .setCellSelection({
            anchorCell: tableStart + map.map[anchorIndex],
            headCell: tableStart + map.map[headIndex]
          })
          .run()
      );
      return true;
    };

    const clearSelectedCells = () => {
      if (!tableSelection) {
        return false;
      }
      const { tr, schema } = editor.state;
      const paragraph = schema.nodes.paragraph;
      tableSelection.forEachCell((cell, pos) => {
        tr.replaceWith(pos + 1, pos + cell.nodeSize - 1, paragraph.create());
      });
      editor.view.dispatch(tr);
      return true;
    };

    switch (action) {
      case "add-row-before":
        runEditorCommand((chain) => chain.addRowBefore().run());
        break;
      case "add-row-after":
        runEditorCommand((chain) => chain.addRowAfter().run());
        break;
      case "delete-row":
        runEditorCommand((chain) => chain.deleteRow().run());
        break;
      case "add-col-before":
        runEditorCommand((chain) => chain.addColumnBefore().run());
        break;
      case "add-col-after":
        runEditorCommand((chain) => chain.addColumnAfter().run());
        break;
      case "delete-col":
        runEditorCommand((chain) => chain.deleteColumn().run());
        break;
      case "merge-cells":
        runEditorCommand((chain) => chain.mergeCells().run());
        break;
      case "split-cell":
        runEditorCommand((chain) => chain.splitCell().run());
        break;
      case "align-left":
        runEditorCommand((chain) => chain.setCellAttribute("textAlign", "left").run());
        break;
      case "align-center":
        runEditorCommand((chain) => chain.setCellAttribute("textAlign", "center").run());
        break;
      case "align-right":
        runEditorCommand((chain) => chain.setCellAttribute("textAlign", "right").run());
        break;
      case "clear-cells":
        clearSelectedCells();
        break;
      case "select-row":
        selectTableAxis("row");
        break;
      case "select-col":
        selectTableAxis("col");
        break;
      case "toggle-header":
        runEditorCommand((chain) => chain.toggleHeaderRow().run());
        break;
      case "toggle-header-cell":
        runEditorCommand((chain) => chain.toggleHeaderCell().run());
        break;
      case "toggle-header-column":
        runEditorCommand((chain) => chain.toggleHeaderColumn().run());
        break;
      case "delete-table":
        runEditorCommand((chain) => chain.deleteTable().run());
        break;
      default:
        return;
    }

    setStatus("Updated table");
  }

  function selectTableAxisByIndex(axis, index) {
    if (!editor) {
      return;
    }
    const selection = editor.state.selection;
    const tableSelection = selection instanceof CellSelection ? selection : null;
    if (!tableSelection) {
      return;
    }

    const $cell = tableSelection.$anchorCell;
    const table = $cell.node(-1);
    const tableStart = $cell.start(-1);
    const map = TableMap.get(table);
    const anchorIndex = axis === "row" ? index * map.width : index;
    const headIndex = axis === "row" ? index * map.width + (map.width - 1) : index + map.width * (map.height - 1);
    runEditorCommand((chain) =>
      chain
        .setCellSelection({
          anchorCell: tableStart + map.map[anchorIndex],
          headCell: tableStart + map.map[headIndex]
        })
        .run()
    );
  }

  function jumpToOutline(item, index) {
    setActiveOutlineId(item.id);
    if (!["editor", "split"].includes(preferences.viewMode) && sourceRef.current) {
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

  function openCommandPalette(initialQuery = "") {
    setCommandPaletteQuery(typeof initialQuery === "string" ? initialQuery : "");
    setCommandPaletteOpen(true);
  }

  function closeCommandPalette() {
    setCommandPaletteOpen(false);
    setCommandPaletteQuery("");
  }

  function commitFrontMatterFields(nextFields) {
    setMarkdownText((current) => updateMarkdownFrontMatter(current, nextFields));
    setIsDirty(true);
  }

  function updateFrontMatterRaw(raw) {
    setMarkdownText((current) => replaceFrontMatterRaw(current, raw));
    setIsDirty(true);
  }

  function addFrontMatterField() {
    commitFrontMatterFields([...frontMatterState.fields, { key: "", type: "text", value: "" }]);
    updatePreferences({ sidebarVisible: true, sidebarTab: "properties" });
    setStatus("Added a new property");
  }

  function removeFrontMatterField(index) {
    commitFrontMatterFields(frontMatterState.fields.filter((_, fieldIndex) => fieldIndex !== index));
    setStatus("Removed property");
  }

  function updateFrontMatterField(index, patch) {
    const nextFields = frontMatterState.fields.map((field, fieldIndex) => {
      if (fieldIndex !== index) {
        return field;
      }
      const nextType = patch.type || field.type;
      let nextValue = patch.value ?? field.value;
      if (typeof nextValue === "string" && nextType === "list") {
        nextValue = nextValue
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      }
      if (Array.isArray(nextValue) && nextType === "text") {
        nextValue = nextValue.join(", ");
      }
      return {
        ...field,
        ...patch,
        type: nextType,
        value: nextValue
      };
    });
    commitFrontMatterFields(nextFields);
  }

  function closeFrontMatterMergeDialog() {
    setFrontMatterMergeState(null);
  }

  function applyFrontMatterMergeAndInsert({ mergedRaw, keepCurrent = false, replace = false, bodyOnly = false }) {
    if (!frontMatterMergeState) {
      return;
    }

    const snippetHtml = frontMatterMergeState.html;
    if (!bodyOnly) {
      setMarkdownText((current) => {
        const existing = extractYamlFrontMatter(current);
        const nextRaw = replace ? frontMatterMergeState.incomingRaw : keepCurrent ? existing.raw : mergedRaw;
        return prependFrontMatter(nextRaw, existing.body);
      });
      setIsDirty(true);
    }

    runEditorCommand((chain) => chain.insertContent(snippetHtml).run(), { preserveScroll: true });
    setStatus(bodyOnly ? "Inserted body and kept current front matter" : "Merged front matter and inserted content");
    closeFrontMatterMergeDialog();
  }

  async function executeCommandPaletteItem(item) {
    if (!item) {
      return;
    }

    rememberPaletteItem(item);

    if (item.kind === "file" && item.path) {
      closeCommandPalette();
      await openDocumentFromPath(item.path);
      return;
    }

    switch (item.id) {
      case "new-file":
        await createNewDocument();
        break;
      case "open-file":
        await openDocument();
        break;
      case "open-folder":
        await pickWorkspaceFolder();
        break;
      case "save-file":
        await saveDocument(false);
        break;
      case "find":
        openFindReplace();
        break;
      case "preferences":
        setPreferencesOpen(true);
        break;
      case "view-editor":
        updatePreferences({ viewMode: "editor" });
        break;
      case "view-split":
        updatePreferences({ viewMode: "split" });
        break;
      case "view-source":
        updatePreferences({ viewMode: "source" });
        break;
      case "view-preview":
        updatePreferences({ viewMode: "preview" });
        break;
      case "toggle-focus":
        updatePreferences({ focusMode: !preferences.focusMode });
        break;
      case "toggle-typewriter":
        updatePreferences({ typewriterMode: !preferences.typewriterMode });
        break;
      case "open-outline":
        updatePreferences({ sidebarVisible: true, sidebarTab: "outline" });
        break;
      case "open-files":
        updatePreferences({ sidebarVisible: true, sidebarTab: "files" });
        break;
      case "open-properties":
        updatePreferences({ sidebarVisible: true, sidebarTab: "properties" });
        break;
      case "theme-paper":
        updatePreferences({ theme: "paper" });
        break;
      case "theme-forest":
        updatePreferences({ theme: "forest" });
        break;
      case "theme-midnight":
        updatePreferences({ theme: "midnight" });
        break;
      default:
        break;
    }

    closeCommandPalette();
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

  function applySourceTextUpdate(nextText, nextSelectionStart, nextSelectionEnd = nextSelectionStart) {
    setMarkdownText(nextText);
    setIsDirty(true);
    window.requestAnimationFrame(() => {
      const textarea = sourceRef.current;
      if (!textarea) {
        return;
      }
      textarea.focus();
      textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
      syncSourceHighlightScroll();
    });
  }

  function indentSourceSelection(outdent = false) {
    const textarea = sourceRef.current;
    if (!textarea) {
      return;
    }

    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const { lineStart, lineEnd } = getLineBoundaries(markdownText, selectionStart, selectionEnd);
    const before = markdownText.slice(0, lineStart);
    const target = markdownText.slice(lineStart, lineEnd);
    const after = markdownText.slice(lineEnd);
    const lines = target.split(/\r?\n/);
    const nextLines = lines.map((line) => {
      if (!outdent) {
        return `  ${line}`;
      }
      if (line.startsWith("  ")) {
        return line.slice(2);
      }
      if (line.startsWith("\t")) {
        return line.slice(1);
      }
      return line.replace(/^ /, "");
    });
    const nextTarget = nextLines.join("\n");
    const nextText = `${before}${nextTarget}${after}`;
    const nextSelectionStart = outdent
      ? Math.max(lineStart, selectionStart - (target.startsWith("  ") || target.startsWith("\t") ? 2 : 1))
      : selectionStart + 2;
    const delta = nextTarget.length - target.length;
    applySourceTextUpdate(nextText, nextSelectionStart, selectionEnd + delta);
  }

  function continueMarkdownList() {
    const textarea = sourceRef.current;
    if (!textarea) {
      return false;
    }

    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    if (selectionStart !== selectionEnd) {
      return false;
    }

    const { lineStart, lineEnd, line } = getCurrentLine(markdownText, selectionStart);
    const before = markdownText.slice(0, selectionStart);
    const after = markdownText.slice(selectionEnd);

    const taskMatch = /^(\s*)[-*+]\s\[(?: |x|X)\]\s*(.*)$/.exec(line);
    if (taskMatch) {
      const content = taskMatch[2];
      const prefix = `${taskMatch[1]}- [ ] `;
      if (!content.trim()) {
        const nextText = `${markdownText.slice(0, lineStart)}${taskMatch[1]}${markdownText.slice(lineEnd)}`;
        applySourceTextUpdate(nextText, lineStart + taskMatch[1].length);
        return true;
      }
      const insertion = `\n${prefix}`;
      applySourceTextUpdate(`${before}${insertion}${after}`, selectionStart + insertion.length);
      return true;
    }

    const orderedMatch = /^(\s*)(\d+)\.\s+(.*)$/.exec(line);
    if (orderedMatch) {
      const content = orderedMatch[3];
      if (!content.trim()) {
        const nextText = `${markdownText.slice(0, lineStart)}${orderedMatch[1]}${markdownText.slice(lineEnd)}`;
        applySourceTextUpdate(nextText, lineStart + orderedMatch[1].length);
        return true;
      }
      const nextIndex = Number(orderedMatch[2]) + 1;
      const insertion = `\n${orderedMatch[1]}${nextIndex}. `;
      applySourceTextUpdate(`${before}${insertion}${after}`, selectionStart + insertion.length);
      return true;
    }

    const bulletMatch = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (bulletMatch) {
      const content = bulletMatch[2];
      if (!content.trim()) {
        const nextText = `${markdownText.slice(0, lineStart)}${bulletMatch[1]}${markdownText.slice(lineEnd)}`;
        applySourceTextUpdate(nextText, lineStart + bulletMatch[1].length);
        return true;
      }
      const insertion = `\n${bulletMatch[1]}- `;
      applySourceTextUpdate(`${before}${insertion}${after}`, selectionStart + insertion.length);
      return true;
    }

    const quoteMatch = /^(\s*(?:>\s*)+)(.*)$/.exec(line);
    if (quoteMatch) {
      const content = quoteMatch[2];
      if (!content.trim()) {
        const nextText = `${markdownText.slice(0, lineStart)}${markdownText.slice(lineEnd)}`;
        applySourceTextUpdate(nextText, lineStart);
        return true;
      }
      const normalizedPrefix = quoteMatch[1].replace(/\s*$/, " ");
      const insertion = `\n${normalizedPrefix}`;
      applySourceTextUpdate(`${before}${insertion}${after}`, selectionStart + insertion.length);
      return true;
    }

    return false;
  }

  function handleSourceBackspaceShortcut() {
    const textarea = sourceRef.current;
    if (!textarea) {
      return false;
    }

    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    if (selectionStart !== selectionEnd) {
      return false;
    }

    const { lineStart, lineEnd, line } = getCurrentLine(markdownText, selectionStart);
    if (selectionStart !== lineEnd) {
      return false;
    }

    const markerMatch = /^(\s*)(?:[-*+]\s|\d+\.\s|[-*+]\s\[(?: |x|X)\]\s|(?:>\s*)+)$/u.exec(line);
    if (!markerMatch) {
      return false;
    }

    const nextText = `${markdownText.slice(0, lineStart)}${markerMatch[1]}${markdownText.slice(lineEnd)}`;
    applySourceTextUpdate(nextText, lineStart + markerMatch[1].length);
    return true;
  }

  function handleSourceAutoPair(event) {
    const textarea = sourceRef.current;
    if (!textarea || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) {
      return false;
    }

    const pairMap = {
      "*": "*",
      "_": "_",
      "~": "~",
      "`": "`",
      "\"": "\"",
      "'": "'",
      "(": ")",
      "[": "]",
      "{": "}",
      "^": "^"
    };

    const closing = pairMap[event.key];
    if (!closing) {
      return false;
    }

    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const before = markdownText.slice(0, selectionStart);
    const selected = markdownText.slice(selectionStart, selectionEnd);
    const after = markdownText.slice(selectionEnd);
    const nextChar = markdownText[selectionEnd] || "";
    const allowAutoPair = selectionStart !== selectionEnd || !nextChar || /\s|[)\]}>.,!?]/.test(nextChar);

    if (!allowAutoPair) {
      return false;
    }

    event.preventDefault();
    if (selectionStart !== selectionEnd) {
      applySourceTextUpdate(`${before}${event.key}${selected}${closing}${after}`, selectionStart + 1, selectionEnd + 1);
      return true;
    }

    applySourceTextUpdate(`${before}${event.key}${closing}${after}`, selectionStart + 1);
    return true;
  }

  function handleSourceKeyDown(event) {
    if (event.key === "Tab") {
      event.preventDefault();
      indentSourceSelection(event.shiftKey);
      return;
    }

    if (event.key === "Enter") {
      if (continueMarkdownList()) {
        event.preventDefault();
      }
      return;
    }

    if (event.key === "Backspace" && handleSourceBackspaceShortcut()) {
      event.preventDefault();
      return;
    }

    handleSourceAutoPair(event);
  }

  function applyPastedLinkInSource(url) {
    const textarea = sourceRef.current;
    if (!textarea) {
      return false;
    }
    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    if (selectionStart === selectionEnd) {
      return false;
    }
    const before = markdownText.slice(0, selectionStart);
    const selection = markdownText.slice(selectionStart, selectionEnd);
    const after = markdownText.slice(selectionEnd);
    applySourceTextUpdate(`${before}[${selection}](${url})${after}`, selectionStart + 1, selectionStart + 1 + selection.length);
    return true;
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

  const showEditor = ["editor", "split"].includes(preferences.viewMode);
  const showSource = preferences.viewMode === "source" || findOpen;
  const showPreview = ["preview", "split"].includes(preferences.viewMode);
  const findSummary = findOpen && findQuery ? `${matches.length === 0 ? "0" : `${matchIndex + 1}/${matches.length}`} matches` : null;
  const documentPathLabel = filePath || preferences.workspaceRoot || "";

  return (
    <div className={`app-shell theme-${preferences.theme}`}>
      <Toolbar
        focusMode={preferences.focusMode}
        documentPath={documentPathLabel}
        documentTitle={documentTitle}
        editor={editor}
        isDirty={isDirty}
        onNew={createNewDocument}
        onOpen={openDocument}
        onOpenPalette={openCommandPalette}
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
        onToggleFocusMode={() => updatePreferences({ focusMode: !preferences.focusMode })}
        onToggleSidebar={() => updatePreferences({ sidebarVisible: !preferences.sidebarVisible })}
        onToggleTypewriterMode={() => updatePreferences({ typewriterMode: !preferences.typewriterMode })}
        sidebarVisible={preferences.sidebarVisible}
        typewriterMode={preferences.typewriterMode}
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
            frontMatterRaw={frontMatterState.raw}
            onFilterChange={setSidebarFilter}
            onFrontMatterRawChange={updateFrontMatterRaw}
          />
        ) : null}

        <main className={`workspace-main mode-${preferences.viewMode}${findOpen ? " find-open" : ""}`}>
          {showEditor ? (
            <section className="editor-pane">
              <div ref={paperRef} className="paper">
                <TableToolbar visible={tableToolbarVisible} selectionCount={tableSelectionCount} onAction={handleTableAction} />
                <TableSelectionHandles
                  visible={tableHandleState.visible}
                  rows={tableHandleState.rows}
                  cols={tableHandleState.cols}
                  onSelectRow={(index) => selectTableAxisByIndex("row", index)}
                  onSelectColumn={(index) => selectTableAxisByIndex("col", index)}
                />
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
                  onKeyDown={handleSourceKeyDown}
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
        statusMessage={statusState.message}
        statusKind={statusState.kind}
        findSummary={findSummary}
        onDisableHints={() => updatePreferences({ smartTransformHints: false })}
      />

      <PreferencesDialog
        open={preferencesOpen}
        preferences={preferences}
        onChange={updatePreferences}
        onOpenCheatsheet={() => setEditingCheatsheetOpen(true)}
        onClose={() => setPreferencesOpen(false)}
      />

      <CommandPalette
        open={commandPaletteOpen}
        query={commandPaletteQuery}
        items={commandPaletteItems}
        suggestions={commandPaletteSuggestions}
        onQueryChange={setCommandPaletteQuery}
        onClose={closeCommandPalette}
        onSelect={executeCommandPaletteItem}
      />

      <SlashCommandMenu
        visible={slashMenuState.open}
        items={slashCommandItems}
        position={{ top: slashMenuState.top, left: slashMenuState.left }}
        selectedIndex={Math.min(slashMenuIndex, Math.max(0, slashCommandItems.length - 1))}
        onHover={setSlashMenuIndex}
        onSelect={executeSlashCommand}
      />

      <FrontMatterMergeDialog
        open={Boolean(frontMatterMergeState)}
        currentRaw={frontMatterMergeState?.currentRaw}
        incomingRaw={frontMatterMergeState?.incomingRaw}
        mergedRaw={frontMatterMergeState?.mergedRaw || ""}
        mergedValue={frontMatterMergeState?.mergedValue}
        onChangeMerged={(value) =>
          setFrontMatterMergeState((current) => {
            if (!current) {
              return current;
            }
            const parsed = parseYamlObject(extractYamlFrontMatter(value).content || value);
            return {
              ...current,
              mergedRaw: value,
              mergedValue: parsed ?? current.mergedValue
            };
          })
        }
        onChangeMergedValue={(value) =>
          setFrontMatterMergeState((current) =>
            current
              ? {
                  ...current,
                  mergedValue: value,
                  mergedRaw: dumpYamlObject(value)
                }
              : current
          )
        }
        onApplyMerged={() => applyFrontMatterMergeAndInsert({ mergedRaw: frontMatterMergeState?.mergedRaw || "" })}
        onKeepCurrent={() => applyFrontMatterMergeAndInsert({ keepCurrent: true })}
        onReplace={() => applyFrontMatterMergeAndInsert({ replace: true })}
        onBodyOnly={() => applyFrontMatterMergeAndInsert({ bodyOnly: true })}
        onCancel={closeFrontMatterMergeDialog}
      />

      <EditingCheatsheetDialog open={editingCheatsheetOpen} onClose={() => setEditingCheatsheetOpen(false)} />
    </div>
  );
}
