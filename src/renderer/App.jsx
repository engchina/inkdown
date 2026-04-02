import React, { startTransition, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { Mark, mergeAttributes, Extension, getMarkRange } from "@tiptap/core";
import Heading from "@tiptap/extension-heading";
import { NodeSelection, Plugin, PluginKey, Selection, TextSelection } from "@tiptap/pm/state";
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { CellSelection, TableMap } from "@tiptap/pm/tables";
import { EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import Code from "@tiptap/extension-code";
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
import TableSelectionHandles from "./components/TableSelectionHandles";
import EditingCheatsheetDialog from "./components/EditingCheatsheetDialog";
import LinkDialog from "./components/LinkDialog";
import { resolveEditingSurface } from "./utils/editingSurface.mjs";
import { escapeHtml, sanitizePreviewContainer } from "./utils/previewSanitizer.mjs";
import {
  convertClipboardHtmlToMarkdown,
  hasStructuredClipboardHtml,
  normalizeMarkdownBlock
} from "./utils/clipboardMarkdown.mjs";
import { serializeEditorHtmlToMarkdown as serializeEditorHtmlPreservingMarkdown } from "./utils/editorMarkdownSerializer.mjs";
import { annotateInlineMarkdownTokens } from "./utils/inlineMarkdownTokens.mjs";
import { getCompletedInlineMarkdownMatch } from "./utils/inlineMarkdownCompletion.mjs";
import {
  buildRemovedMarkdownLinkSelection,
  buildLinkedSourceSelection,
  buildSourceInsertion,
  buildToggledPrefixedSourceLines,
  buildToggledWrappedSourceSelection,
  buildExpandedMarkdownTableSelection,
  buildUpdatedMarkdownImageSelection,
  buildUpdatedMarkdownLinkSelection,
  buildRemovedMarkdownImageSelection,
  buildWrappedSourceSelection,
  findMarkdownImageAtSelection,
  findMarkdownLinkAtSelection,
  findMarkdownTableAtSelection,
  findLiteralMatches,
  replaceAllLiteralMatches,
  replaceCurrentLiteralMatch
} from "./utils/sourceEditing.mjs";
import { getEmptyListEnterStrategy } from "./utils/editorStructuredEditing.mjs";
import { findMarkRangeForSelection, getInlineMarkTarget, selectionTouchesMarkRange } from "./utils/markSyntaxEditing.mjs";

const editorMarked = new Marked({ gfm: true, breaks: true });
const previewMarked = new Marked({ gfm: true, breaks: true });

previewMarked.use(
  markedKatex({
    throwOnError: false,
    nonStandard: true
  })
);

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
  smartTransformSource: {
    tabIndent: true,
    continueList: true,
    autoPair: true,
    literalEscape: true
  },
  allowInsecureRemoteMedia: false,
  workspaceRoot: null,
  recentFiles: [],
  paletteUsage: {},
  tableLayouts: {}
};

function normalizeSidebarTab(value) {
  return value === "files" ? "files" : "outline";
}

function isComposingInputEvent(event) {
  return Boolean(event?.isComposing || event?.nativeEvent?.isComposing || event?.keyCode === 229 || event?.nativeEvent?.keyCode === 229);
}

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

const initialMarkdown = `# Inkdown

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
  addOptions() {
    return {
      ...this.parent?.(),
      resolveAsset: (value) => value
    };
  },
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
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  }
});

function ImageNodeView({ editor, extension, getPos, node, selected, updateAttributes }) {
  const textareaRef = useRef(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftError, setDraftError] = useState("");
  const markdownSource = node.attrs.markdownSource || node.attrs.src || "";
  const shown = selected || editing;
  const resolvedSrc =
    (typeof extension.options.resolveAsset === "function" ? extension.options.resolveAsset(markdownSource) : "") ||
    node.attrs.src ||
    markdownSource;

  useEffect(() => {
    setDraft(
      formatMarkdownImageSnippet({
        alt: node.attrs.alt || "",
        url: markdownSource,
        title: node.attrs.title || ""
      })
    );
    setDraftError("");
  }, [markdownSource, node.attrs.alt, node.attrs.title]);

  useEffect(() => {
    if (!shown || !textareaRef.current) {
      return;
    }
    textareaRef.current.focus();
    textareaRef.current.select();
  }, [shown, node.attrs.alt, markdownSource, node.attrs.title]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [draft, shown]);

  function focusImageNode() {
    const pos = typeof getPos === "function" ? getPos() : null;
    editor.chain().focus(typeof pos === "number" ? pos : undefined).run();
  }

  function applyMarkdown(nextValue = draft) {
    const parsed = parseMarkdownImageSnippet(nextValue);
    if (!parsed?.url) {
      setDraftError("Use valid Markdown image syntax like ![alt](url)");
      return false;
    }

    const nextAttrs = {
      ...node.attrs,
      alt: parsed.alt,
      title: parsed.title || null,
      markdownSource: parsed.url,
      src:
        (typeof extension.options.resolveAsset === "function" ? extension.options.resolveAsset(parsed.url) : "") || parsed.url
    };
    updateAttributes(nextAttrs);
    setDraft(formatMarkdownImageSnippet(parsed));
    setDraftError("");
    setEditing(false);
    return true;
  }

  return (
    <NodeViewWrapper className={`editor-image-node${shown ? " is-selected" : ""}`}>
      {shown ? (
        <div className="editor-image-markdown-block" contentEditable={false}>
          <textarea
            ref={textareaRef}
            className={`editor-image-markdown-input${draftError ? " invalid" : ""}`}
            value={draft}
            rows={1}
            spellCheck={false}
            onMouseDown={(event) => event.stopPropagation()}
            onFocus={() => setEditing(true)}
            onChange={(event) => {
              setDraft(event.target.value);
              if (draftError) {
                setDraftError("");
              }
            }}
            onBlur={(event) => {
              setEditing(false);
              if (event.target.value.trim() === draft.trim()) {
                return;
              }
              applyMarkdown(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (applyMarkdown(event.currentTarget.value)) {
                  focusImageNode();
                }
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setDraft(
                  formatMarkdownImageSnippet({
                    alt: node.attrs.alt || "",
                    url: markdownSource,
                    title: node.attrs.title || ""
                  })
                );
                setDraftError("");
                setEditing(false);
                focusImageNode();
              }
            }}
          />
          {draftError ? <div className="editor-image-markdown-error">{draftError}</div> : null}
        </div>
      ) : null}
      <img
        src={resolvedSrc}
        alt={node.attrs.alt || ""}
        title={node.attrs.title || ""}
        width={node.attrs.width || undefined}
        height={node.attrs.height || undefined}
        draggable="false"
      />
    </NodeViewWrapper>
  );
}

function CodeBlockNodeView({ editor, getPos, node, updateAttributes }) {
  const activeValue = node.attrs.language || "";
  const collapsed = Boolean(node.attrs.collapsed);
  const mermaidPreviewId = useId();
  const [copied, setCopied] = useState(false);
  const [auxPreviewHtml, setAuxPreviewHtml] = useState("");
  const [mermaidRefreshKey, setMermaidRefreshKey] = useState(0);
  const highlightLanguage = useMemo(() => normalizeHighlightLanguage(activeValue), [activeValue]);
  const validationState = useMemo(() => {
    try {
      if (activeValue === "json") {
        JSON.parse(node.textContent || "");
        return { kind: "valid", label: "JSON valid" };
      }
      if (["yaml", "yml"].includes(activeValue)) {
        yaml.load(String(node.textContent || ""));
        return { kind: "valid", label: "YAML valid" };
      }
      if (activeValue === "html") {
        return { kind: "info", label: "HTML preview" };
      }
    } catch (error) {
      return { kind: "invalid", label: String(error.message || error) };
    }
    return null;
  }, [activeValue, node.textContent]);
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
        {validationState ? <span className={`code-block-status ${validationState.kind}`}>{validationState.label}</span> : null}
        <span className="code-block-toolbar-spacer" />
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

const codeFenceEnterKey = new PluginKey("codeFenceEnter");

const CodeFenceEnterFallback = Extension.create({
  name: "codeFenceEnterFallback",

  addProseMirrorPlugins() {
    const codeBlockType = () => this.editor.schema.nodes.codeBlock;
    return [
      new Plugin({
        key: codeFenceEnterKey,
        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const sel = newState.selection;
          if (!sel.empty) return null;

          const $from = sel.$from;
          const parent = $from.parent;
          if (parent.type.name !== "paragraph" || parent.textContent.trim() !== "") return null;

          const pos = $from.before();
          if (pos < 2) return null;

          const prevResolved = newState.doc.resolve(pos - 1);
          const prevNode = prevResolved.parent.type.name === "paragraph" ? prevResolved.parent : null;
          if (!prevNode) return null;

          const prevText = prevNode.textContent;
          const codeFenceMatch = /^(?:```|~~~)([A-Za-z0-9_-]+)?$/.exec(prevText);
          if (!codeFenceMatch) return null;

          const cbType = codeBlockType();
          if (!cbType) return null;

          const prevStart = prevResolved.before();
          const emptyStart = pos;
          const emptyEnd = pos + parent.nodeSize;
          const tr = newState.tr;
          tr.delete(emptyStart, emptyEnd);
          tr.replaceWith(prevStart, prevStart + prevNode.nodeSize + 2, cbType.create({ language: codeFenceMatch[1] || null }));
          tr.setSelection(TextSelection.create(tr.doc, prevStart + 1));
          return tr;
        }
      })
    ];
  }
});

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

function createTokenAttributeConfig(defaultOpenToken, defaultCloseToken = defaultOpenToken) {
  return {
    mdOpenToken: {
      default: defaultOpenToken,
      parseHTML: (element) => element.getAttribute("data-md-open-token") || defaultOpenToken,
      renderHTML: (attributes) =>
        attributes.mdOpenToken ? { "data-md-open-token": attributes.mdOpenToken } : {}
    },
    mdCloseToken: {
      default: defaultCloseToken,
      parseHTML: (element) => element.getAttribute("data-md-close-token") || defaultCloseToken,
      renderHTML: (attributes) =>
        attributes.mdCloseToken ? { "data-md-close-token": attributes.mdCloseToken } : {}
    },
    mdDepth: {
      default: 0,
      parseHTML: (element) => Number(element.getAttribute("data-md-depth") || 0),
      renderHTML: (attributes) => ({ "data-md-depth": String(Number(attributes.mdDepth) || 0) })
    }
  };
}

function createInlineTagMark(name, tagName, defaultOpenToken, defaultCloseToken = defaultOpenToken) {
  const commandSuffix = capitalize(name);
  return Mark.create({
    name,
    inclusive: false,
    addAttributes() {
      return createTokenAttributeConfig(defaultOpenToken, defaultCloseToken);
    },
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

const TokenBold = Bold.extend({
  addInputRules() {
    return [];
  },
  addPasteRules() {
    return [];
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      ...createTokenAttributeConfig("**")
    };
  }
});

const TokenItalic = Italic.extend({
  addInputRules() {
    return [];
  },
  addPasteRules() {
    return [];
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      ...createTokenAttributeConfig("*")
    };
  }
});

const TokenStrike = Strike.extend({
  addInputRules() {
    return [];
  },
  addPasteRules() {
    return [];
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      ...createTokenAttributeConfig("~~")
    };
  }
});

const TokenCode = Code.extend({
  addInputRules() {
    return [];
  },
  addPasteRules() {
    return [];
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      ...createTokenAttributeConfig("`")
    };
  }
});

const Highlight = createInlineTagMark("highlight", "mark", "==");
const Subscript = createInlineTagMark("subscript", "sub", "~");
const Superscript = createInlineTagMark("superscript", "sup", "^");

const TokenLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...createTokenAttributeConfig("[", "]()")
    };
  }
});

const MARK_SYNTAX = {
  bold: "**",
  italic: "*",
  strike: "~~",
  code: "`",
  highlight: "==",
  subscript: "~",
  superscript: "^",
  link: "["
};

function collectMarkRanges(parent, parentStart) {
  const ranges = [];
  const seen = new Set();
  const nodes = [];
  parent.forEach((node, offset) => {
    nodes.push({ node, from: parentStart + offset, to: parentStart + offset + node.nodeSize });
  });

  for (let i = 0; i < nodes.length; i++) {
    const { node, from: nodeFrom } = nodes[i];
    if (!node.isText || !node.marks.length) continue;

    for (const mark of node.marks) {
      const syntax = MARK_SYNTAX[mark.type.name];
      if (!syntax) continue;

      let rangeFrom = nodeFrom;
      let rangeTo = nodes[i].to;

      for (let j = i - 1; j >= 0; j--) {
        if (nodes[j].node.isText && nodes[j].to === rangeFrom && nodes[j].node.marks.some((m) => m.type === mark.type)) {
          rangeFrom = nodes[j].from;
        } else {
          break;
        }
      }
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[j].node.isText && nodes[j].from === rangeTo && nodes[j].node.marks.some((m) => m.type === mark.type)) {
          rangeTo = nodes[j].to;
        } else {
          break;
        }
      }

      const rangeKey = `${mark.type.name}:${rangeFrom}-${rangeTo}`;
      if (!seen.has(rangeKey)) {
        seen.add(rangeKey);
        ranges.push({ markName: mark.type.name, markType: mark.type, markAttrs: mark.attrs, syntax, from: rangeFrom, to: rangeTo });
      }
    }
  }
  return ranges;
}

// ── MarkSyntaxEditing ────────────────────────────────────────────────────────
// Typora-style: when cursor enters a mark range, temporarily replace the mark
// with real editable `*` / `**` / etc. text.  When cursor leaves, restore the
// mark (or leave plain text if the user deleted a syntax character).

const markSyntaxEditingKey = new PluginKey("markSyntaxEditing");

function sortSerializableMarks(marks) {
  return [...marks]
    .filter((mark) => MARK_SYNTAX[mark.type.name])
    .sort((left, right) => {
      const leftDepth = Number(left.attrs?.mdDepth ?? 0);
      const rightDepth = Number(right.attrs?.mdDepth ?? 0);
      if (leftDepth !== rightDepth) {
        return leftDepth - rightDepth;
      }
      return left.type.name.localeCompare(right.type.name);
    });
}

function getSerializableMarkTokens(mark) {
  const openToken = mark.attrs?.mdOpenToken || MARK_SYNTAX[mark.type.name] || "";
  if (mark.type.name === "link") {
    const closeToken =
      mark.attrs?.mdCloseToken ||
      `](${mark.attrs?.href || ""}${mark.attrs?.title ? ` "${String(mark.attrs.title).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : ""})`;
    return { openToken, closeToken };
  }
  return {
    openToken,
    closeToken: mark.attrs?.mdCloseToken || MARK_SYNTAX[mark.type.name] || ""
  };
}

function sameSerializableMark(left, right) {
  return (
    left?.type?.name === right?.type?.name &&
    String(left?.attrs?.mdOpenToken || "") === String(right?.attrs?.mdOpenToken || "") &&
    String(left?.attrs?.mdCloseToken || "") === String(right?.attrs?.mdCloseToken || "") &&
    String(left?.attrs?.href || "") === String(right?.attrs?.href || "") &&
    String(left?.attrs?.title || "") === String(right?.attrs?.title || "") &&
    Number(left?.attrs?.mdDepth || 0) === Number(right?.attrs?.mdDepth || 0)
  );
}

function serializeInlineFragmentContent(content) {
  let markdown = "";
  let textOffset = 0;
  const positionMap = [0];
  let activeMarks = [];

  content.forEach((node) => {
    if (!node.isText) {
      return;
    }

    const nextMarks = sortSerializableMarks(node.marks || []);
    let shared = 0;
    while (shared < activeMarks.length && shared < nextMarks.length && sameSerializableMark(activeMarks[shared], nextMarks[shared])) {
      shared += 1;
    }

    for (let index = activeMarks.length - 1; index >= shared; index -= 1) {
      markdown += getSerializableMarkTokens(activeMarks[index]).closeToken;
    }
    positionMap[textOffset] = markdown.length;
    for (let index = shared; index < nextMarks.length; index += 1) {
      markdown += getSerializableMarkTokens(nextMarks[index]).openToken;
    }

    activeMarks = nextMarks;

    const text = node.text || "";
    for (const character of text) {
      markdown += character;
      textOffset += 1;
      positionMap[textOffset] = markdown.length;
    }
  });

  for (let index = activeMarks.length - 1; index >= 0; index -= 1) {
    markdown += getSerializableMarkTokens(activeMarks[index]).closeToken;
  }

  if (positionMap.length === 0) {
    positionMap.push(0);
  }

  return { markdown, positionMap };
}

function parseInlineMarkdownFragment(schema, markdown) {
  const container = document.createElement("div");
  container.innerHTML = editorMarked.parseInline(preprocessMarkdownSyntax(markdown, { enableExtendedInlineSyntax: true }));
  annotateInlineMarkdownTokens(container, markdown);
  return ProseMirrorDOMParser.fromSchema(schema).parseSlice(container, { preserveWhitespace: "full" }).content;
}

function mapExpandedSelectionPosition(positionMap, groupFrom, groupTo, markdownLength, docPos) {
  if (docPos <= groupFrom) {
    return groupFrom;
  }
  if (docPos >= groupTo) {
    return groupFrom + markdownLength;
  }
  const cursorOffset = Math.max(0, Math.min(docPos - groupFrom, positionMap.length - 1));
  return groupFrom + (positionMap[cursorOffset] ?? positionMap[positionMap.length - 1] ?? 0);
}

function expandMarkSyntax(state, groupFrom, groupTo, selectionAnchor, selectionHead = selectionAnchor) {
  const fragment = state.doc.slice(groupFrom, groupTo).content;
  const { markdown, positionMap } = serializeInlineFragmentContent(fragment);
  const anchorPos = mapExpandedSelectionPosition(positionMap, groupFrom, groupTo, markdown.length, selectionAnchor);
  const headPos = mapExpandedSelectionPosition(positionMap, groupFrom, groupTo, markdown.length, selectionHead);
  const tr = state.tr.replaceWith(groupFrom, groupTo, state.schema.text(markdown));
  tr.setSelection(TextSelection.create(tr.doc, anchorPos, headPos));
  tr.setMeta(markSyntaxEditingKey, {
    expandedRange: { from: groupFrom, to: groupFrom + markdown.length }
  });
  return tr;
}

function collapseMarkSyntax(state, expandedRange) {
  const { from, to } = expandedRange;
  const markdown = state.doc.textBetween(from, to, "\n");
  const fragment = parseInlineMarkdownFragment(state.schema, markdown);
  const tr = state.tr.replaceWith(from, to, fragment);
  tr.setMeta(markSyntaxEditingKey, { expandedRange: null });
  return tr;
}

function getSelectionTextblock(selection) {
  if (!selection?.$from?.parent?.isTextblock || selection.$from.parent.type.name === "codeBlock") {
    return null;
  }
  if (selection.$to.parent !== selection.$from.parent || selection.$to.start() !== selection.$from.start()) {
    return null;
  }
  return {
    parent: selection.$from.parent,
    start: selection.$from.start()
  };
}

function selectionTouchesExpandedRange(selection, expandedRange) {
  return selectionTouchesMarkRange(expandedRange, selection.from, selection.to);
}

function findMarkGroupForSelection(state, selection, preferredMarkName = null) {
  const textblock = getSelectionTextblock(selection);
  if (!textblock) {
    return null;
  }

  const markRanges = collectMarkRanges(textblock.parent, textblock.start);
  const anchorRange = findMarkRangeForSelection(markRanges, selection.from, selection.to, preferredMarkName);
  if (!anchorRange) {
    return null;
  }

  const containing = markRanges.filter((range) => selectionTouchesMarkRange(range, selection.from, selection.to));
  if (!containing.length) {
    return null;
  }

  return {
    from: Math.min(...containing.map((range) => range.from)),
    to: Math.max(...containing.map((range) => range.to))
  };
}

function findCompletedInlineRangeAtSelection(state, selection) {
  if (!selection?.empty) {
    return null;
  }

  const textblock = getSelectionTextblock(selection);
  if (!textblock) {
    return null;
  }

  const beforeCursor = textblock.parent.textContent.slice(0, selection.$from.parentOffset);
  const match = getCompletedInlineMarkdownMatch(beforeCursor);
  if (!match) {
    return null;
  }

  return {
    from: textblock.start + match.start,
    to: textblock.start + match.end,
    type: match.type
  };
}

const MarkSyntaxEditing = Extension.create({
  name: "markSyntaxEditing",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: markSyntaxEditingKey,

        state: {
          init() {
            return { expandedRange: null };
          },
          apply(tr, pluginState) {
            const meta = tr.getMeta(markSyntaxEditingKey);
            if (meta !== undefined) return { expandedRange: meta.expandedRange };
            if (!pluginState.expandedRange) return pluginState;
            const { expandedRange } = pluginState;
            return {
              expandedRange: {
                ...expandedRange,
                from: tr.mapping.map(expandedRange.from, -1),
                to: tr.mapping.map(expandedRange.to, -1),
              },
            };
          },
        },

        props: {
          decorations(state) {
            const { expandedRange } = markSyntaxEditingKey.getState(state);
            if (!expandedRange) {
              return DecorationSet.empty;
            }
            return DecorationSet.empty;
          },
          handleClick(view, pos, event) {
            if (event.button !== 0) {
              return false;
            }

            const { expandedRange } = markSyntaxEditingKey.getState(view.state);
            if (expandedRange) {
              return false;
            }

            const target = getInlineMarkTarget(event.target, view.dom);
            if (!target) {
              return false;
            }

            const group = findMarkGroupForSelection(view.state, Selection.near(view.state.doc.resolve(pos)), target.markName);
            if (!group) {
              return false;
            }

            view.dispatch(expandMarkSyntax(view.state, group.from, group.to, pos, pos));
            view.focus();
            return true;
          },
        },

        appendTransaction(transactions, _oldState, newState) {
          if (transactions.some((tr) => tr.getMeta(markSyntaxEditingKey) !== undefined)) {
            return null;
          }

          const { expandedRange } = markSyntaxEditingKey.getState(newState);
          const sel = newState.selection;

          if (expandedRange) {
            if (!selectionTouchesExpandedRange(sel, expandedRange)) {
              return collapseMarkSyntax(newState, expandedRange);
            }
            if (transactions.some((tr) => tr.selectionSet) && !transactions.some((tr) => tr.docChanged)) {
              const adjacentGroup = findMarkGroupForSelection(newState, sel);
              if (adjacentGroup && (adjacentGroup.from < expandedRange.from || adjacentGroup.to > expandedRange.to)) {
                return expandMarkSyntax(
                  newState,
                  Math.min(adjacentGroup.from, expandedRange.from),
                  Math.max(adjacentGroup.to, expandedRange.to),
                  sel.anchor,
                  sel.head
                );
              }
            }
            return null;
          }

          if (transactions.some((tr) => tr.docChanged)) {
            const completedRange = findCompletedInlineRangeAtSelection(newState, sel);
            if (completedRange) {
              return newState.tr.setMeta(markSyntaxEditingKey, {
                expandedRange: {
                  from: completedRange.from,
                  to: completedRange.to
                }
              });
            }
          }

          if (!transactions.some((tr) => tr.selectionSet)) {
            return null;
          }

          const group = findMarkGroupForSelection(newState, sel);
          if (group) {
            return expandMarkSyntax(newState, group.from, group.to, sel.anchor, sel.head);
          }

          return null;
        },
      }),
    ];
  },
});

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

function serializeEditorHtmlToMarkdown(html, existingRawFrontMatter = "") {
  return prependFrontMatter(existingRawFrontMatter, serializeEditorHtmlPreservingMarkdown(html));
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
  const {
    enableCallouts = false,
    footnotes = null,
    currentFilePath = null,
    resolveAsset,
    sanitizeOptions = {}
  } = options;

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

  sanitizePreviewContainer(container, {
    ...sanitizeOptions,
    allowFileUrls: typeof resolveAsset === "function" && resolveAsset === window.editorApi.resolveMarkdownAssetForExport
  });

  return container.innerHTML;
}

function renderMarkdownForEditor(markdown, currentFilePath, outline) {
  const { body } = extractYamlFrontMatter(markdown);
  const container = resolveImageSources(
    editorMarked.parse(preprocessMarkdownSyntax(body, { enableExtendedInlineSyntax: true })),
    currentFilePath,
    window.editorApi.resolveMarkdownAsset
  );
  annotateInlineMarkdownTokens(container, body);
  return decorateRenderedHtml(container, outline, { enableCallouts: true });
}

function renderMarkdownSnippetForEditor(markdown, currentFilePath) {
  const { body } = extractYamlFrontMatter(markdown);
  const snippetOutline = extractOutlineFromMarkdown(body);
  const container = resolveImageSources(
    editorMarked.parse(preprocessMarkdownSyntax(body, { enableExtendedInlineSyntax: true })),
    currentFilePath,
    window.editorApi.resolveMarkdownAsset
  );
  annotateInlineMarkdownTokens(container, body);
  return decorateRenderedHtml(container, snippetOutline, { enableCallouts: true });
}

function escapeMarkdownImageAlt(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function escapeMarkdownImageTitle(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatMarkdownImageDestination(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  return /[\s()]/.test(normalized) ? `<${normalized}>` : normalized;
}

function formatMarkdownImageSnippet({ alt = "", url = "", title = "" } = {}) {
  const destination = formatMarkdownImageDestination(url);
  if (!destination) {
    return "";
  }
  return `![${escapeMarkdownImageAlt(alt)}](${destination}${title ? ` "${escapeMarkdownImageTitle(title)}"` : ""})`;
}

function parseMarkdownImageSnippet(value) {
  const match =
    /^!\[([^\]]*)\]\(\s*(<[^>\r\n]+>|(?:\\.|[^\\\s)])+)(?:\s+((?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\((?:\\.|[^)])*\))))?\s*\)$/.exec(
      String(value || "").trim()
    );
  if (!match) {
    return null;
  }

  const rawSource = match[2] || "";
  return {
    alt: match[1] || "",
    url: rawSource.startsWith("<") && rawSource.endsWith(">") ? rawSource.slice(1, -1) : rawSource,
    title: String(match[3] || "").trim().replace(/^["'(]+|["')]+$/g, "")
  };
}

function serializeEditorSelectionForClipboard(view) {
  const selection = view.state.selection;
  if (selection.empty) {
    return null;
  }

  const { dom, text } = view.serializeForClipboard(selection.content());
  const html = dom.innerHTML;
  const markdown = convertClipboardHtmlToMarkdown(html) || normalizeMarkdownBlock(text);
  return { html, text, markdown };
}

function handleEditorClipboardEvent(view, event, cut = false) {
  const data = event.clipboardData;
  if (!data) {
    return false;
  }

  const serialized = serializeEditorSelectionForClipboard(view);
  if (!serialized) {
    return false;
  }

  const { html, text, markdown } = serialized;
  event.preventDefault();
  data.clearData();
  data.setData("text/html", html);
  data.setData("text/plain", markdown || text);
  try {
    data.setData("text/markdown", markdown || text);
  } catch {}

  if (cut) {
    view.dispatch(view.state.tr.deleteSelection().scrollIntoView().setMeta("uiEvent", "cut"));
  }
  return true;
}

function renderMarkdownForPreview(
  markdown,
  currentFilePath,
  outline,
  resolveAsset = window.editorApi.resolveMarkdownAsset,
  sanitizeOptions = {}
) {
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
    resolveAsset,
    sanitizeOptions
  });
}

function buildStandaloneHtml(title, bodyHtml, theme) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      ${katexStyles}
      :root { color-scheme: ${theme === "midnight" ? "dark" : "light"}; }
      html { margin: 0; padding: 0; background: ${theme === "midnight" ? "#0f1724" : theme === "forest" ? "#eef5ee" : "#faf7f1"}; }
      body {
        max-width: 820px;
        margin: 0 auto;
        padding: 14px 26px 56px;
        font: 17px/1.68 "Segoe UI", "Microsoft YaHei", sans-serif;
        color: ${theme === "midnight" ? "#dbe4f0" : theme === "forest" ? "#243328" : "#2f3437"};
        background: ${theme === "midnight" ? "#0f1724" : theme === "forest" ? "#eef5ee" : "#faf7f1"};
      }
      .export-document {
        width: 100%;
        overflow-wrap: anywhere;
      }
      .export-document > :first-child { margin-top: 0; }
      .export-document > :last-child { margin-bottom: 0; }
      h1, h2, h3, h4, h5, h6 {
        margin: 1.35em 0 0.42em;
        line-height: 1.24;
        color: ${theme === "midnight" ? "#edf3fb" : theme === "forest" ? "#17241a" : "#22262b"};
        font-weight: 650;
        letter-spacing: -0.015em;
      }
      h1 { font-size: 1.96em; line-height: 1.12; }
      h2 { font-size: 1.62em; }
      h3 { font-size: 1.36em; }
      h4 { font-size: 1.15em; }
      h5 { font-size: 1.03em; }
      h6 { font-size: 0.94em; }
      p { margin: 0.52em 0; color: inherit; }
      ul, ol { margin: 0.5em 0; padding-left: 1.55em; }
      li { margin: 0.1em 0; }
      li > p { margin: 0.2em 0; }
      ul ul, ul ol, ol ul, ol ol { margin: 0.16em 0; }
      img { display: block; max-width: 100%; margin: 0.95em 0; border-radius: 12px; }
      pre { overflow-x: auto; margin: 0.88em 0; padding: 14px 16px; border-radius: 12px; background: ${theme === "midnight" ? "#1c2434" : "#22252b"}; color: #f5f7fa; }
      code { font-family: "Cascadia Code", "JetBrains Mono", monospace; }
      :not(pre) > code {
        padding: 0.08em 0.34em;
        border-radius: 0.34em;
        background: ${theme === "midnight" ? "rgba(148, 163, 184, 0.16)" : "rgba(15, 23, 42, 0.06)"};
        color: inherit;
        font-size: 0.92em;
      }
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
        min-height: 1.4em;
        margin: 0.88em 0;
        padding: 0.08em 0 0.08em 1em;
        border-left: 2px solid ${
          theme === "midnight"
            ? "rgba(148, 163, 184, 0.42)"
            : theme === "forest"
              ? "rgba(5, 150, 105, 0.22)"
              : "rgba(120, 128, 140, 0.34)"
        };
        border-radius: 0;
        background: transparent;
        color: ${theme === "midnight" ? "#b9c6d8" : theme === "forest" ? "#4c6853" : "#6b7280"};
        font-size: 0.98em;
      }
      blockquote:not(.callout) > :first-child { margin-top: 0; }
      blockquote:not(.callout) > :last-child { margin-bottom: 0; }
      blockquote:not(.callout) p { margin: 0.24em 0; }
      blockquote:not(.callout) blockquote:not(.callout) {
        min-height: 0;
        margin: 0.45em 0 0.22em;
        padding-left: 0.85em;
        border-left-width: 2px;
        border-radius: 0;
        background: none;
      }
      table { width: 100%; margin: 0.95em 0; border-collapse: collapse; }
      th, td { border: 1px solid rgba(160, 160, 160, 0.3); padding: 10px 12px; }
      td[data-align="left"], th[data-align="left"] { text-align: left; }
      td[data-align="center"], th[data-align="center"] { text-align: center; }
      td[data-align="right"], th[data-align="right"] { text-align: right; }
      .table-of-contents { display: grid; gap: 3px; margin: 0.68em 0 0.9em; padding: 11px 13px; border: 1px solid rgba(160, 160, 160, 0.18); border-radius: 12px; background: ${theme === "midnight" ? "rgba(28, 36, 52, 0.58)" : "rgba(255, 255, 255, 0.42)"}; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16); }
      .toc-title { font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
      .toc-item { color: inherit; text-decoration: none; padding: 0.08em 0; opacity: 0.92; }
      .toc-item.level-2 { padding-left: 12px; }
      .toc-item.level-3 { padding-left: 24px; }
      .toc-item.level-4, .toc-item.level-5, .toc-item.level-6 { padding-left: 36px; }
      .footnotes-title { margin-bottom: 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: ${theme === "midnight" ? "#b8c7d9" : "#69553f"}; }
      .callout { position: relative; margin: 0.9em 0; padding: 12px 15px 12px 18px; border: 1px solid rgba(160, 160, 160, 0.24); border-radius: 16px; background: rgba(255, 255, 255, 0.6); }
      .callout::before { content: ""; position: absolute; inset: 10px auto 10px 0; width: 4px; border-radius: 999px; background: #9a5a26; }
      .callout-title { margin-bottom: 6px; font-size: 13px; font-weight: 700; color: inherit; }
      .callout-note::before { background: #3b82f6; }
      .callout-tip::before { background: #16a34a; }
      .callout-important::before { background: #7c3aed; }
      .callout-warning::before { background: #d97706; }
      .callout-caution::before { background: #dc2626; }
      .footnotes { margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(160, 160, 160, 0.24); }
      .footnote-backref { margin-left: 6px; text-decoration: none; }
      .mermaid { margin: 0.95rem 0; }
    </style>
  </head>
  <body><main class="export-document">${bodyHtml}</main></body>
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
  return /^(#{1,6}\s|>\s|[-*+]\s|\d+\.\s|[-*+]\s\[(?: |x|X)\]\s|```|~~~|\|.+\|)/m.test(text);
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

function getTableLayoutDocumentKey(filePath) {
  return filePath || "__untitled__";
}

function buildParagraphNode(schema, text) {
  return schema.nodes.paragraph.create(null, text ? schema.text(text) : null);
}

function findMatches(markdown, query) {
  return findLiteralMatches(markdown, query);
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

function getSourceSelectionMeta(markdown, selectionStart, selectionEnd) {
  const start = Math.max(0, selectionStart ?? 0);
  const end = Math.max(start, selectionEnd ?? start);
  const startLine = String(markdown.slice(0, start)).split(/\r?\n/).length;
  const endLine = String(markdown.slice(0, end)).split(/\r?\n/).length;
  const lineStart = markdown.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const column = start - lineStart + 1;
  const selectedChars = end - start;

  return {
    line: startLine,
    column,
    selectedChars,
    lineLabel: endLine > startLine ? `Ln ${startLine}-${endLine}` : `Ln ${startLine}`,
    columnLabel: `Col ${column}`,
    selectionLabel: selectedChars > 0 ? `Sel ${selectedChars}` : "",
    statusLabel:
      selectedChars > 0
        ? `${endLine > startLine ? `Ln ${startLine}-${endLine}` : `Ln ${startLine}`}, Col ${column}, ${selectedChars} selected`
        : `Ln ${startLine}, Col ${column}`
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

  const endSelection = Selection.atEnd(transaction.doc);
  transaction = transaction.setSelection(endSelection).scrollIntoView();
  view.dispatch(transaction);
  view.focus();
  return true;
}

export default function App() {
  const [filePath, setFilePath] = useState(null);
  const [markdownText, setMarkdownText] = useState(initialMarkdown);
  const [documentSessionKey, setDocumentSessionKey] = useState(0);
  const [outline, setOutline] = useState(extractOutlineFromMarkdown(initialMarkdown));
  const [activeOutlineId, setActiveOutlineId] = useState(null);
  const [workspaceTree, setWorkspaceTree] = useState(null);
  const [workspaceRefreshKey, setWorkspaceRefreshKey] = useState(0);
  const [sidebarFilter, setSidebarFilter] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [editingCheatsheetOpen, setEditingCheatsheetOpen] = useState(false);
  const [linkDialogState, setLinkDialogState] = useState(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [sourceSelectionState, setSourceSelectionState] = useState({ start: 0, end: 0 });
  const [statusState, setStatusState] = useState({ message: "Ready", kind: "default" });
  const [activePane, setActivePane] = useState("editor");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");
  const [slashMenuState, setSlashMenuState] = useState({ open: false, query: "", top: 0, left: 0 });
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [tableToolbarVisible, setTableToolbarVisible] = useState(false);
  const [tableSelectionCount, setTableSelectionCount] = useState(0);
  const [tableHandleState, setTableHandleState] = useState({ visible: false, rows: [], cols: [] });
  const sourceRef = useRef(null);
  const sourcePaneRef = useRef(null);
  const sourceEditorShellRef = useRef(null);
  const sourceHighlightRef = useRef(null);
  const programmaticEditorSyncRef = useRef(false);
  const programmaticMarkdownSyncRef = useRef(false);
  const lastEditorMarkdownRef = useRef(initialMarkdown);
  const prevBlockTypeRef = useRef("paragraph");
  const editorHeadingsRef = useRef([]);
  const statusTimerRef = useRef(null);
  const preferencesRef = useRef(defaultPreferences);
  const slashMenuStateRef = useRef({ open: false, query: "", top: 0, left: 0 });
  const slashCommandItemsRef = useRef([]);
  const executeSlashCommandRef = useRef(null);
  const paperRef = useRef(null);
  const suppressNextSmartTransformRef = useRef(false);
  const sourceComposingRef = useRef(false);
  const editorComposingRef = useRef(false);
  const pendingEditorCompositionSyncRef = useRef(false);
  const editorInstanceRef = useRef(null);
  const lastActiveEditingSurfaceRef = useRef("editor");

  const deferredMarkdown = useDeferredValue(markdownText);
  const matches = useMemo(() => findMatches(markdownText, findQuery), [markdownText, findQuery]);
  const stats = useMemo(() => countStats(markdownText), [markdownText]);
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
        description: "Source and preview side by side",
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
      { id: "heading-4", badge: "H4", label: "Heading 4", description: "Minor section heading", keywords: "heading minor h4" },
      { id: "heading-5", badge: "H5", label: "Heading 5", description: "Deep subsection heading", keywords: "heading deep h5" },
      { id: "heading-6", badge: "H6", label: "Heading 6", description: "Smallest heading", keywords: "heading smallest h6" },
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
  const previewSanitizeOptions = useMemo(
    () => ({ allowInsecureRemoteMedia: preferences.allowInsecureRemoteMedia }),
    [preferences.allowInsecureRemoteMedia]
  );
  const previewHtml = useMemo(
    () =>
      renderMarkdownForPreview(deferredMarkdown, filePath, outline, window.editorApi.resolveMarkdownAsset, previewSanitizeOptions),
    [deferredMarkdown, filePath, outline, previewSanitizeOptions]
  );
  const sourceHighlightContent = useMemo(
    () => renderSourceHighlights(markdownText, matches, matchIndex),
    [markdownText, matches, matchIndex]
  );
  const sourceObjectContext = useMemo(() => {
    const link = findMarkdownLinkAtSelection(markdownText, sourceSelectionState.start, sourceSelectionState.end);
    if (link) {
      return { kind: "link", label: "Link selected" };
    }

    const image = findMarkdownImageAtSelection(markdownText, sourceSelectionState.start, sourceSelectionState.end);
    if (image) {
      return { kind: "image", label: "Image selected" };
    }

    const table = findMarkdownTableAtSelection(markdownText, sourceSelectionState.start);
    if (table) {
      return { kind: "table", label: `${table.columnCount} columns` };
    }

    return null;
  }, [markdownText, sourceSelectionState.end, sourceSelectionState.start]);
  const sourceSelectionMeta = useMemo(
    () => getSourceSelectionMeta(markdownText, sourceSelectionState.start, sourceSelectionState.end),
    [markdownText, sourceSelectionState.end, sourceSelectionState.start]
  );

  function syncSourceHighlightScroll() {
    if (!sourceHighlightRef.current) {
      return;
    }
    sourceHighlightRef.current.scrollTop = 0;
    sourceHighlightRef.current.scrollLeft = 0;
  }

  function syncSourceEditorHeight(target = sourceRef.current) {
    target?.style?.removeProperty("height");
    sourceEditorShellRef.current?.style?.removeProperty("height");
  }

  function markSourceAsActive() {
    lastActiveEditingSurfaceRef.current = "source";
    setActivePane("source");
  }

  function markEditorAsActive() {
    lastActiveEditingSurfaceRef.current = "editor";
    setActivePane("editor");
  }

  function markPreviewAsActive() {
    setActivePane("preview");
  }

  function copyPreviewHtmlToClipboard() {
    navigator.clipboard
      .writeText(previewHtml)
      .then(() => setStatus("Copied preview HTML"))
      .catch((error) => setStatus(getActionErrorMessage(error, "Could not copy preview HTML.")));
  }

  function getActiveEditingSurface() {
    return resolveEditingSurface(preferencesRef.current.viewMode, lastActiveEditingSurfaceRef.current);
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
      case "heading-4":
        runEditorCommand((chain) => chain.deleteRange({ from: context.from, to: context.to }).toggleHeading({ level: 4 }).run());
        break;
      case "heading-5":
        runEditorCommand((chain) => chain.deleteRange({ from: context.from, to: context.to }).toggleHeading({ level: 5 }).run());
        break;
      case "heading-6":
        runEditorCommand((chain) => chain.deleteRange({ from: context.from, to: context.to }).toggleHeading({ level: 6 }).run());
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
    return runEditorCommand((chain) => apply(chain.deleteRange({ from: rangeFrom, to: rangeTo })));
  }

  function applyHeadingShortcut(rangeFrom, rangeTo, level) {
    return applyEditorMarkdownShortcut(rangeFrom, rangeTo, (chain) => chain.toggleHeading({ level }).run());
  }

  function applyEditorParagraphSpaceShortcut(view, beforeCursor, rangeFrom, rangeTo) {
    const transformRules = preferencesRef.current.smartTransformRules || {};

    const escapedSpacePrefix = /^\\(#{1,6}|>|[-*+]|\d+\.|[-*+]\s\[(?: |x|X)\])$/.exec(beforeCursor);
    if (escapedSpacePrefix) {
      applyEditorMarkdownShortcut(rangeFrom, rangeTo, (chain) => chain.insertContent(`${escapedSpacePrefix[1]} `).run());
      setHint("Inserted literal Markdown marker.");
      return true;
    }

    const headingShortcut = /^(#{1,6})$/.exec(beforeCursor);
    if ((transformRules.heading ?? true) && headingShortcut) {
      const level = headingShortcut[1].length;
      applyHeadingShortcut(rangeFrom, rangeTo, level);
      flashActiveEditorBlock();
      setHint(`Heading ${level}.`);
      return true;
    }

    if ((transformRules.taskList ?? true) && /^[-*+]\s\[(?: |x|X)\]$/.test(beforeCursor)) {
      applyEditorMarkdownShortcut(rangeFrom, rangeTo, (chain) => chain.toggleTaskList().run());
      flashActiveEditorBlock();
      setHint("Task list. Backspace on empty item exits the list.");
      return true;
    }

    if ((transformRules.blockquote ?? true) && beforeCursor === ">") {
      applyEditorMarkdownShortcut(rangeFrom, rangeTo, (chain) => chain.toggleBlockquote().run());
      flashActiveEditorBlock();
      setHint("Blockquote.");
      return true;
    }

    if ((transformRules.bulletList ?? true) && /^[-*+]$/.test(beforeCursor)) {
      applyEditorMarkdownShortcut(rangeFrom, rangeTo, (chain) => chain.toggleBulletList().run());
      flashActiveEditorBlock();
      setHint("Bullet list.");
      return true;
    }

    if ((transformRules.orderedList ?? true) && /^\d+\.$/.test(beforeCursor)) {
      applyEditorMarkdownShortcut(rangeFrom, rangeTo, (chain) => chain.toggleOrderedList().run());
      flashActiveEditorBlock();
      setHint("Ordered list.");
      return true;
    }

    void view;
    return false;
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
      inOrderedList: names.includes("orderedList"),
      inBlockquote: names.includes("blockquote"),
      inHeading: selection.$from.parent.type.name === "heading",
      inCodeBlock: selection.$from.parent.type.name === "codeBlock"
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

  function insertParagraphAfterCurrentBlock(view) {
    const { state, dispatch } = view;
    const { selection, schema } = state;
    if (!selection.empty) {
      return false;
    }

    const paragraphType = schema.nodes.paragraph;
    if (!paragraphType) {
      return false;
    }

    const insertPos = selection.$from.after();
    const tr = state.tr.insert(insertPos, paragraphType.create());
    tr.setSelection(TextSelection.create(tr.doc, insertPos + 1));
    dispatch(tr.scrollIntoView());
    return true;
  }

  function convertFenceParagraphToCodeBlock(view, language = null) {
    const { state, dispatch } = view;
    const { selection, schema } = state;
    if (!selection.empty) {
      return false;
    }

    const { $from } = selection;
    if ($from.parent.type.name !== "paragraph") {
      return false;
    }

    const codeBlockType = schema.nodes.codeBlock;
    if (!codeBlockType) {
      return false;
    }

    const blockFrom = $from.before();
    const blockTo = $from.after();
    const tr = state.tr.replaceWith(blockFrom, blockTo, codeBlockType.create({ language }));
    tr.setSelection(TextSelection.create(tr.doc, blockFrom + 1));
    dispatch(tr.scrollIntoView());
    return true;
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

    if (event.key === "Enter" && emptyTextblock) {
      const strategy = getEmptyListEnterStrategy(state);
      if (strategy === "exit") {
        const exited = exitCurrentListItem(selection);
        if (!exited) {
          return false;
        }
        event.preventDefault();
        return true;
      }
      if (strategy === "default") {
        return false;
      }
    }

    if (event.key === "Enter" && state.inHeading) {
      if (emptyTextblock) {
        const applied = runEditorCommand((chain) => chain.setParagraph().run());
        if (applied === false) {
          return false;
        }
        event.preventDefault();
        return true;
      }
      if (!insertParagraphAfterCurrentBlock(view)) {
        return false;
      }
      event.preventDefault();
      return true;
    }

    if (event.key === "Enter" && emptyTextblock && state.inBlockquote) {
      event.preventDefault();
      runEditorCommand((chain) => chain.toggleBlockquote().run());
      return true;
    }

    if (event.key === "Backspace" && cursorAtStart && emptyTextblock && (state.inTaskItem || state.inListItem)) {
      const exited = exitCurrentListItem(selection);
      if (!exited) {
        return false;
      }
      event.preventDefault();
      return true;
    }

    if (event.key === "Backspace" && cursorAtStart) {
      if (state.inHeading) {
        event.preventDefault();
        runEditorCommand((chain) => chain.setParagraph().run());
        return true;
      }

      if (state.inBlockquote) {
        event.preventDefault();
        runEditorCommand((chain) => chain.toggleBlockquote().run());
        return true;
      }

      if (emptyTextblock && state.inCodeBlock) {
        event.preventDefault();
        runEditorCommand((chain) => chain.clearNodes().setParagraph().run());
        return true;
      }
    }

    return false;
  }

  function handleEditorSmartTextInput(view, from, to, text) {
    if (editorComposingRef.current || view.composing) {
      return false;
    }

    if (!preferencesRef.current.smartMarkdownTransform) {
      return false;
    }

    if (suppressNextSmartTransformRef.current) {
      suppressNextSmartTransformRef.current = false;
      return false;
    }

    const selection = view.state.selection;
    if (!selection.empty || selection.from !== from || selection.to !== to) {
      return false;
    }

    const { $from } = selection;
    const parent = $from.parent;
    if (!parent?.isTextblock || parent.type.name === "codeBlock") {
      return false;
    }

    const beforeCursor = parent.textContent.slice(0, $from.parentOffset);
    const shortcutFrom = selection.from - beforeCursor.length;

    if (text === "`") {
      if (/`+$/.test(beforeCursor)) {
        return false;
      }

      const openingIndex = beforeCursor.lastIndexOf("`");
      if (openingIndex === -1) {
        return false;
      }

      const content = beforeCursor.slice(openingIndex + 1);
      if (!content || /`/.test(content)) {
        return false;
      }

      const codeMark = view.state.schema.marks.code;
      if (!codeMark) {
        return false;
      }

      const markFrom = selection.from - content.length - 1;
      const tr = view.state.tr.delete(markFrom, markFrom + 1);
      const mappedFrom = tr.mapping.map(markFrom);
      const mappedTo = tr.mapping.map(selection.from);
      tr.addMark(mappedFrom, mappedTo, codeMark.create());
      tr.setSelection(TextSelection.create(tr.doc, mappedTo));
      view.dispatch(tr.scrollIntoView());
      flashActiveEditorBlock();
      setHint("Inline code.");
      return true;
    }

    if (text !== " " || parent.type.name !== "paragraph") {
      return false;
    }

    return applyEditorParagraphSpaceShortcut(view, beforeCursor, shortcutFrom, selection.from);
  }

  function handleEditorSmartMarkdown(view, event) {
    if (editorComposingRef.current || view.composing || isComposingInputEvent(event)) {
      return false;
    }

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
    const isSpaceInput = event.key === " " || event.key === "Spacebar" || event.code === "Space";
    const transformRules = preferencesRef.current.smartTransformRules || {};

    if (isSpaceInput) {
      if (applyEditorParagraphSpaceShortcut(view, beforeCursor, shortcutFrom, selection.from)) {
        event.preventDefault();
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
      const applied = convertFenceParagraphToCodeBlock(view, codeFenceMatch[1] || null);
      if (!applied) {
        return false;
      }
      event.preventDefault();
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
          heading: false,
          codeBlock: false,
          bold: false,
          italic: false,
          strike: false,
          code: false,
          link: false,
          underline: false
        }),
        Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
        TokenBold,
        TokenItalic,
        TokenStrike,
        TokenCode,
        Underline,
        CodeBlockWithLanguage,
        Highlight,
        Subscript,
        Superscript,
        TokenLink.configure({ openOnClick: true, autolink: true, defaultProtocol: "https" }),
        MarkdownImage.configure({
          inline: false,
          allowBase64: true,
          resolveAsset: (assetPath) => window.editorApi.resolveMarkdownAsset(filePath, assetPath)
        }),
        Placeholder.configure({ placeholder: "Start writing and edit Markdown directly in the document, just like Typora." }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeaderWithAlignment,
        TableCellWithAlignment,
        MarkSyntaxEditing,
        CodeFenceEnterFallback
      ],
      content: renderMarkdownForEditor(markdownText, filePath, outline),
      editorProps: {
        attributes: { class: "editor-surface" },
        handleTextInput(view, from, to, text) {
          return handleEditorSmartTextInput(view, from, to, text);
        },
        handleDOMEvents: {
          compositionstart() {
            markEditorAsActive();
            editorComposingRef.current = true;
            pendingEditorCompositionSyncRef.current = false;
            return false;
          },
          compositionend() {
            window.requestAnimationFrame(() => {
              editorComposingRef.current = false;
              if (pendingEditorCompositionSyncRef.current && editorInstanceRef.current) {
                pendingEditorCompositionSyncRef.current = false;
                syncMarkdownFromEditor(editorInstanceRef.current);
              }
            });
            return false;
          },
          copy(view, event) {
            markEditorAsActive();
            return handleEditorClipboardEvent(view, event, false);
          },
          cut(view, event) {
            markEditorAsActive();
            return handleEditorClipboardEvent(view, event, true);
          },
          keydown: (view, event) => {
            markEditorAsActive();
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
            markEditorAsActive();
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
        editorInstanceRef.current = instance;
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

        const sel = instance.state.selection;
        if (sel.empty) {
          const currentType = sel.$from.parent.type.name;
          const prevType = prevBlockTypeRef.current;
          if (currentType !== prevType && prevType === "paragraph") {
            const hints = {
              heading: `Heading ${sel.$from.parent.attrs?.level || ""}. Backspace on empty heading returns to paragraph.`,
              blockquote: "Blockquote. Backspace on empty quote returns to paragraph.",
              bulletList: "Bullet list. Backspace on empty item exits the list.",
              orderedList: "Ordered list. Backspace on empty item exits the list.",
              codeBlock: "Code block. Backspace on empty block returns to paragraph.",
              listItem: "List item.",
              taskItem: "Task item."
            };
            if (hints[currentType]) {
              flashActiveEditorBlock(instance);
              setHint(hints[currentType]);
            }
          }
          prevBlockTypeRef.current = currentType;
        }
        if (programmaticEditorSyncRef.current) {
          programmaticEditorSyncRef.current = false;
          return;
        }
        if (editorComposingRef.current || instance.view.composing) {
          pendingEditorCompositionSyncRef.current = true;
          return;
        }
        pendingEditorCompositionSyncRef.current = false;
        syncMarkdownFromEditor(instance);
      },
      onSelectionUpdate({ editor: instance }) {
        const sel = instance.state.selection;
        if (sel.empty) {
          prevBlockTypeRef.current = sel.$from.parent.type.name;
        }
        const currentPos = sel.from;
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
  const editorObjectContext = useMemo(() => {
    if (!editor) {
      return null;
    }

    if (tableToolbarVisible) {
      return { kind: "table", label: tableSelectionCount > 1 ? `${tableSelectionCount} cells selected` : "Table selected" };
    }

    const selection = editor.state.selection;
    const parentType = selection.$from.parent.type.name;
    if (parentType === "heading") {
      return { kind: "heading", label: `Heading ${selection.$from.parent.attrs.level || ""}`.trim() };
    }
    if (parentType === "codeBlock") {
      return { kind: "code", label: "Code block" };
    }
    if (selection instanceof NodeSelection && selection.node?.type?.name === "image") {
      return { kind: "image", label: "Image" };
    }

    const blockState = isEditorSelectionInsideList(selection);
    if (blockState.inTaskItem) {
      return { kind: "task", label: "Task item" };
    }
    if (blockState.inBulletList) {
      return { kind: "list", label: "Bullet list" };
    }
    if (blockState.inOrderedList) {
      return { kind: "list", label: "Ordered list" };
    }
    if (blockState.inBlockquote) {
      return { kind: "quote", label: "Blockquote" };
    }

    return { kind: "paragraph", label: "Paragraph" };
  }, [editor, tableSelectionCount, tableToolbarVisible]);
  const toolbarContext = useMemo(() => {
    if (activePane === "source" && sourceObjectContext) {
      return {
        pane: "Source",
        kind: sourceObjectContext.kind,
        label: sourceObjectContext.label
      };
    }

    if (activePane === "preview") {
      if (findOpen && findQuery) {
        return {
          pane: "Preview",
          kind: "find",
          label: `Find ${matches.length === 0 ? "0" : `${matchIndex + 1}/${matches.length}`}`
        };
      }
      return {
        pane: "Preview",
        kind: preferences.allowInsecureRemoteMedia ? "preview" : "find",
        label: preferences.allowInsecureRemoteMedia ? "Preview ready" : "HTTP media blocked"
      };
    }

    return {
      pane: "Editor",
      kind: editorObjectContext?.kind || "paragraph",
      label: editorObjectContext?.label || "Paragraph"
    };
  }, [activePane, editorObjectContext, findOpen, findQuery, matchIndex, matches.length, preferences.allowInsecureRemoteMedia, sourceObjectContext]);
  const toolbarContextActions = useMemo(() => {
    if (activePane === "source" && sourceObjectContext?.kind === "link") {
      return [
        { id: "edit-link", label: "Edit Link", onSelect: openLinkDialog },
        { id: "remove-link", label: "Remove", onSelect: removeLinkAtSourceSelection, tone: "danger" }
      ];
    }

    if (activePane === "source" && sourceObjectContext?.kind === "image") {
      return [
        { id: "replace-image", label: "Replace Image", onSelect: insertImage },
        { id: "remove-image", label: "Remove", onSelect: removeImageAtSourceSelection, tone: "danger" }
      ];
    }

    if (activePane === "source" && sourceObjectContext?.kind === "table") {
      return [{ id: "add-table-row", label: "Add Row", onSelect: insertTable }];
    }

    if (activePane === "preview") {
      return [
        { id: "copy-html", label: "Copy HTML", onSelect: copyPreviewHtmlToClipboard },
        {
          id: "toggle-http-media",
          label: preferences.allowInsecureRemoteMedia ? "Block HTTP Media" : "Allow HTTP Media",
          onSelect: () => updatePreferences({ allowInsecureRemoteMedia: !preferences.allowInsecureRemoteMedia })
        }
      ];
    }

    if (activePane === "editor" && editorObjectContext?.kind === "table") {
      return [
        { id: "editor-add-row", label: "Add Row", onSelect: () => handleTableAction("add-row-after") },
        { id: "editor-add-column", label: "Add Column", onSelect: () => handleTableAction("add-col-after") },
        { id: "editor-delete-table", label: "Delete Table", onSelect: () => handleTableAction("delete-table"), tone: "danger" }
      ];
    }

    if (activePane === "editor" && editorObjectContext?.kind === "image") {
      return [
        { id: "editor-replace-image", label: "Replace Image", onSelect: insertImage },
        { id: "editor-remove-image", label: "Remove", onSelect: () => runEditorCommand((chain) => chain.deleteSelection().run()), tone: "danger" }
      ];
    }

    return [];
  }, [activePane, editorObjectContext, preferences.allowInsecureRemoteMedia, sourceObjectContext]);

  useEffect(() => {
    window.editorApi.loadPreferences().then((loaded) => {
      setPreferences((current) => ({
        ...current,
        ...loaded,
        sidebarTab: normalizeSidebarTab(loaded?.sidebarTab ?? current.sidebarTab)
      }));
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
  }, [preferences.workspaceRoot, workspaceRefreshKey]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    editorInstanceRef.current = editor;
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
      if (editorComposingRef.current || editor.view.composing) {
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
      if (isComposingInputEvent(event)) {
        return;
      }

      const isModifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (isModifier && key === "p") {
        event.preventDefault();
        openCommandPalette();
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
    const sourceVisible = ["source", "split"].includes(preferences.viewMode) || findOpen;
    if (!findOpen || !sourceVisible || !sourceRef.current || matches.length === 0) {
      return;
    }
    selectMatch(matchIndex, { focusSource: false });
  }, [findOpen, matchIndex, matches, preferences.viewMode]);

  useEffect(() => {
    syncSourceEditorHeight();
  }, [markdownText, preferences.viewMode]);

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
      try {
        await insertImageFromFile(imageFile.path);
      } catch (error) {
        setStatus(getActionErrorMessage(error, "Could not insert the dropped image."));
      } finally {
        unlock();
      }
    };

    const handlePaste = async (event) => {
      if (!isEditingSurfaceTarget(editor, sourceRef.current, event.target)) {
        return;
      }
      const pastedText = String(event.clipboardData?.getData("text/plain") || "").trim();
      const pastedHtml = String(event.clipboardData?.getData("text/html") || "");
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
        const renderedSnippetHtml = renderMarkdownSnippetForEditor(pastedText, filePath);
        runEditorCommand((chain) => chain.insertContent(renderedSnippetHtml).run(), {
          preserveScroll: true
        });
        setStatus("Inserted Markdown snippet");
        return;
      }

      if (hasStructuredClipboardHtml(pastedHtml, pastedText)) {
        const markdownFromHtml = convertClipboardHtmlToMarkdown(pastedHtml);
        if (markdownFromHtml) {
          event.preventDefault();
          if (sourceFocused) {
            insertIntoSource(markdownFromHtml, {
              block: /[\r\n]/.test(markdownFromHtml) || /^(#{1,6}\s|>\s|[-*+]\s|\d+\.\s|!\[|```|~~~|\|)/m.test(markdownFromHtml)
            });
          } else {
            const renderedSnippetHtml = renderMarkdownSnippetForEditor(markdownFromHtml, filePath);
            runEditorCommand((chain) => chain.insertContent(renderedSnippetHtml).run(), {
              preserveScroll: true
            });
          }
          setStatus("Converted web content to Markdown");
          return;
        }
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
      try {
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
        if (persisted?.error) {
          throw new Error(persisted.error);
        }
        insertMarkdownImage(persisted.markdownPath, persisted.absolutePath, dimensions);
        setStatus(`Inserted image ${basenamePath(persisted.absolutePath)}`);
      } catch (error) {
        setStatus(getActionErrorMessage(error, "Could not paste the image."));
      } finally {
        unlock();
      }
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
    setPreferences((current) => {
      const nextPatch = typeof patch === "function" ? patch(current) : patch;
      return {
        ...current,
        ...nextPatch,
        sidebarTab: normalizeSidebarTab(nextPatch?.sidebarTab ?? current.sidebarTab)
      };
    });
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

  function getActionErrorMessage(error, fallbackMessage) {
    if (typeof error === "string" && error.trim()) {
      return error;
    }
    if (typeof error?.message === "string" && error.message.trim()) {
      return error.message;
    }
    return fallbackMessage;
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
    if (result?.error) {
      setStatus(result.error);
      return;
    }
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
    if (result?.error) {
      setStatus(result.error);
      return;
    }
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
    try {
      const result = await window.editorApi.saveMarkdown({
        markdown: markdownText,
        filePath: forceSaveAs ? null : filePath
      });
      if (result?.error) {
        setStatus(result.error);
        return;
      }
      if (!result.canceled) {
        const shouldRefreshWorkspace = !filePath || result.filePath !== filePath;
        setFilePath(result.filePath);
        if (typeof result.markdown === "string" && result.markdown !== markdownText) {
          setMarkdownText(result.markdown);
        }
        setIsDirty(false);
        if (shouldRefreshWorkspace) {
          setWorkspaceRefreshKey((current) => current + 1);
        }
        syncWorkspaceWithFile(result.filePath);
        rememberRecentFile(result.filePath);
        setStatus(`Saved to ${basenamePath(result.filePath)}`);
      }
    } catch (error) {
      setStatus(getActionErrorMessage(error, "Could not save the document."));
    }
  }

  async function exportHtml() {
    try {
      const standalonePreviewHtml = renderMarkdownForPreview(
        markdownText,
        filePath,
        outline,
        window.editorApi.resolveMarkdownAssetForExport,
        previewSanitizeOptions
      );
      const preparedPreviewHtml = await renderPreviewHtml(standalonePreviewHtml, preferences.theme, previewSanitizeOptions);
      const html = buildStandaloneHtml(documentTitle, preparedPreviewHtml, preferences.theme);
      const result = await window.editorApi.saveHtml({ html });
      if (result?.error) {
        setStatus(result.error);
        return;
      }
      if (!result.canceled) {
        setStatus(`Exported HTML: ${basenamePath(result.filePath)}`);
      }
    } catch (error) {
      setStatus(getActionErrorMessage(error, "Could not export HTML."));
    }
  }

  async function exportPdf() {
    try {
      const printablePreviewHtml = renderMarkdownForPreview(
        markdownText,
        filePath,
        outline,
        window.editorApi.resolveMarkdownAssetForExport,
        previewSanitizeOptions
      );
      const preparedPreviewHtml = await renderPreviewHtml(printablePreviewHtml, preferences.theme, previewSanitizeOptions);
      const html = buildStandaloneHtml(documentTitle, preparedPreviewHtml, preferences.theme);
      const result = await window.editorApi.savePdf({ html });
      if (result?.error) {
        setStatus(result.error);
        return;
      }
      if (!result.canceled) {
        setStatus(`Exported PDF: ${basenamePath(result.filePath)}`);
      }
    } catch (error) {
      setStatus(getActionErrorMessage(error, "Could not export PDF."));
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
    try {
      const result = await window.editorApi.pickImage();
      if (result.canceled || !result.filePath) {
        return;
      }
      await insertImageFromFile(result.filePath);
    } catch (error) {
      setStatus(getActionErrorMessage(error, "Could not insert the image."));
    }
  }

  async function insertImageFromFile(imagePath) {
    const persisted = await window.editorApi.persistImageFile(imagePath);
    if (persisted?.error) {
      throw new Error(persisted.error);
    }
    const dimensions = await new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = window.editorApi.toAssetUrl(persisted.absolutePath);
    });
    if (getActiveEditingSurface() === "source" && sourceRef.current) {
      const textarea = sourceRef.current;
      const selectionStart = textarea.selectionStart ?? 0;
      const selectionEnd = textarea.selectionEnd ?? selectionStart;
      const existingImage = findMarkdownImageAtSelection(markdownText, selectionStart, selectionEnd);
      if (existingImage) {
        const update = buildUpdatedMarkdownImageSelection(markdownText, selectionStart, selectionEnd, {
          alt: existingImage.alt || basenamePath(persisted.absolutePath) || "image",
          url: persisted.markdownPath,
          title: existingImage.title
        });
        if (update) {
          applySourceTextUpdate(update.text, update.selectionStart, update.selectionEnd);
          setStatus(`Updated image ${basenamePath(persisted.absolutePath)}`);
          return;
        }
      }
    }
    insertMarkdownImage(persisted.markdownPath, persisted.absolutePath, dimensions);
    setStatus(`Inserted image ${basenamePath(persisted.absolutePath)}`);
  }

  function insertMarkdownImage(markdownPath, absolutePath, dimensions = null) {
    const alt = basenamePath(absolutePath) || "image";
    const markdownImage = `![${alt}](${markdownPath})`;
    if (getActiveEditingSurface() === "source" && sourceRef.current) {
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
    if (getActiveEditingSurface() === "source" && sourceRef.current) {
      const textarea = sourceRef.current;
      const expanded = buildExpandedMarkdownTableSelection(markdownText, textarea.selectionStart ?? 0);
      if (expanded) {
        applySourceTextUpdate(expanded.text, expanded.selectionStart, expanded.selectionEnd);
        setStatus("Added a row to the current table");
        return;
      }
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
      if (sourcePaneRef.current) {
        sourcePaneRef.current.scrollTop = Math.max(0, item.line - 3) * 24;
      }
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
    const result = replaceCurrentLiteralMatch(markdownText, findQuery, matches, matchIndex, replaceValue);
    if (!result) {
      return;
    }
    setMarkdownText(result.text);
    setMatchIndex(result.nextIndex);
    setIsDirty(true);
    setStatus("Replaced current match");
  }

  function replaceAllMatches() {
    if (!findQuery) {
      return;
    }
    const result = replaceAllLiteralMatches(markdownText, findQuery, replaceValue);
    setMarkdownText(result.text);
    setMatchIndex(0);
    setIsDirty(true);
    setStatus(`Replaced all ${result.replacedCount} matches`);
  }

  function syncMarkdownFromEditor(instance) {
    programmaticMarkdownSyncRef.current = true;
    const nextMarkdown = serializeEditorHtmlToMarkdown(instance.getHTML(), extractYamlFrontMatter(markdownText).raw);
    lastEditorMarkdownRef.current = nextMarkdown;
    startTransition(() => {
      const nextOutline = extractOutlineFromMarkdown(nextMarkdown);
      setMarkdownText(nextMarkdown);
      setOutline(nextOutline);
    });
    setIsDirty(true);
  }

  function handleSourceChange(event) {
    syncSourceEditorHeight(event.target);
    setMarkdownText(event.target.value);
    setIsDirty(true);
  }

  function handleSourceSelection(event) {
    const cursor = event.target.selectionStart;
    setSourceSelectionState({
      start: event.target.selectionStart ?? 0,
      end: event.target.selectionEnd ?? event.target.selectionStart ?? 0
    });
    const beforeCursor = markdownText.slice(0, cursor);
    const currentLine = beforeCursor.split(/\r?\n/).length - 1;
    const currentHeading = [...outline].reverse().find((item) => item.line <= currentLine);
    if (currentHeading) {
      setActiveOutlineId(currentHeading.id);
    }
  }

  function applySourceTextUpdate(nextText, nextSelectionStart, nextSelectionEnd = nextSelectionStart) {
    setMarkdownText(nextText);
    setIsDirty(true);
    window.requestAnimationFrame(() => {
      const textarea = sourceRef.current;
      if (!textarea) {
        return;
      }
      syncSourceEditorHeight(textarea);
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
    const allowAutoPair =
      event.key !== "`" && (selectionStart !== selectionEnd || !nextChar || /\s|[)\]}>.,!?]/.test(nextChar));

    if (!allowAutoPair) {
      if (event.key === "`" && selectionStart !== selectionEnd) {
        event.preventDefault();
        applySourceTextUpdate(`${before}\`${selected}\`${after}`, selectionStart + 1, selectionEnd + 1);
        return true;
      }
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
    if (sourceComposingRef.current || isComposingInputEvent(event)) {
      return;
    }

    const sourceRules = preferencesRef.current.smartTransformSource || {};

    if (event.key === "Tab" && (sourceRules.tabIndent ?? true)) {
      event.preventDefault();
      indentSourceSelection(event.shiftKey);
      return;
    }

    if (event.key === "Enter" && (sourceRules.continueList ?? true)) {
      if (continueMarkdownList()) {
        event.preventDefault();
      }
      return;
    }

    if (event.key === "Backspace" && handleSourceBackspaceShortcut()) {
      event.preventDefault();
      return;
    }

    if (sourceRules.autoPair ?? true) {
      handleSourceAutoPair(event);
    }
  }

  function applyPastedLinkInSource(url) {
    const textarea = sourceRef.current;
    if (!textarea) {
      return false;
    }
    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    if (selectionStart === selectionEnd) {
      const update = buildUpdatedMarkdownLinkSelection(markdownText, selectionStart, selectionEnd, { url });
      if (!update) {
        return false;
      }
      applySourceTextUpdate(update.text, update.selectionStart, update.selectionEnd);
      return true;
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
    const update = buildSourceInsertion(
      markdownText,
      textarea.selectionStart ?? markdownText.length,
      textarea.selectionEnd ?? textarea.selectionStart ?? markdownText.length,
      content,
      options
    );
    applySourceTextUpdate(update.text, update.selectionStart, update.selectionEnd);
  }

  function wrapSourceSelection(prefix, suffix = prefix, placeholder = "") {
    const textarea = sourceRef.current;
    if (!textarea) {
      return;
    }
    const update = buildWrappedSourceSelection(
      markdownText,
      textarea.selectionStart ?? 0,
      textarea.selectionEnd ?? textarea.selectionStart ?? 0,
      prefix,
      suffix,
      placeholder
    );
    applySourceTextUpdate(update.text, update.selectionStart, update.selectionEnd);
  }

  function openLinkDialog() {
    if (getActiveEditingSurface() === "source" && sourceRef.current) {
      const textarea = sourceRef.current;
      const selectionStart = textarea.selectionStart ?? 0;
      const selectionEnd = textarea.selectionEnd ?? selectionStart;
      const existingLink = findMarkdownLinkAtSelection(markdownText, selectionStart, selectionEnd);
      const selectedText = existingLink ? existingLink.text : markdownText.slice(selectionStart, selectionEnd);
      setLinkDialogState({
        mode: "source",
        initialText: selectedText,
        initialUrl: existingLink?.url || "",
        selectionStart: existingLink?.start ?? selectionStart,
        selectionEnd: existingLink?.end ?? selectionEnd,
        canRemove: Boolean(existingLink)
      });
      return;
    }

    if (!editor) {
      return;
    }

    const { from, to, empty, $from } = editor.state.selection;
    const linkMark = $from.marks().find((mark) => mark.type.name === "link");
    const linkRange = linkMark ? getMarkRange($from, linkMark.type) : null;
    const selectedText = linkRange
      ? editor.state.doc.textBetween(linkRange.from, linkRange.to, "\n")
      : empty
        ? ""
        : editor.state.doc.textBetween(from, to, "\n");
    const initialUrl = linkMark?.attrs?.href || "";
    setLinkDialogState({
      mode: "editor",
      initialText: selectedText,
      initialUrl,
      canRemove: Boolean(linkRange),
      linkRange
    });
  }

  function applyLinkFromDialog({ text, url }) {
    const href = String(url || "").trim();
    const label = String(text || "").trim();
    if (!href) {
      return;
    }

    if (linkDialogState?.mode === "source" && sourceRef.current) {
      const update = buildLinkedSourceSelection(
        markdownText,
        linkDialogState.selectionStart,
        linkDialogState.selectionEnd,
        label,
        href
      );
      applySourceTextUpdate(update.text, update.selectionStart, update.selectionEnd);
      setLinkDialogState(null);
      setStatus(`Inserted link to ${href}`);
      return;
    }

    if (!editor) {
      setLinkDialogState(null);
      return;
    }

    const selectedText = linkDialogState?.initialText || "";
    if (linkDialogState?.linkRange) {
      const nextText = label || selectedText || href;
      runEditorCommand((chain) =>
        chain
          .insertContentAt(linkDialogState.linkRange, `<a href="${escapeHtml(href)}">${escapeHtml(nextText)}</a>`)
          .run()
      );
    } else if (selectedText && (!label || label === selectedText)) {
      runEditorCommand((chain) => chain.extendMarkRange("link").setLink({ href }).run());
    } else {
      const linkText = label || selectedText || href;
      runEditorCommand((chain) =>
        chain.insertContent(`<a href="${escapeHtml(href)}">${escapeHtml(linkText)}</a>`).run()
      );
    }
    setLinkDialogState(null);
    setStatus(`Inserted link to ${href}`);
  }

  function removeLinkFromDialog() {
    if (!linkDialogState) {
      return;
    }

    if (linkDialogState.mode === "source") {
      const replacement = linkDialogState.initialText || "";
      applySourceTextUpdate(
        `${markdownText.slice(0, linkDialogState.selectionStart)}${replacement}${markdownText.slice(linkDialogState.selectionEnd)}`,
        linkDialogState.selectionStart,
        linkDialogState.selectionStart + replacement.length
      );
      setLinkDialogState(null);
      setStatus("Removed link");
      return;
    }

    if (editor && linkDialogState.linkRange) {
      const replacement = linkDialogState.initialText || "";
      runEditorCommand((chain) =>
        chain.insertContentAt(linkDialogState.linkRange, escapeHtml(replacement)).run()
      );
    }
    setLinkDialogState(null);
    setStatus("Removed link");
  }

  function removeLinkAtSourceSelection() {
    if (!sourceRef.current) {
      return false;
    }

    const textarea = sourceRef.current;
    const update = buildRemovedMarkdownLinkSelection(
      markdownText,
      textarea.selectionStart ?? 0,
      textarea.selectionEnd ?? textarea.selectionStart ?? 0
    );
    if (!update) {
      return false;
    }

    applySourceTextUpdate(update.text, update.selectionStart, update.selectionEnd);
    setStatus("Removed link");
    return true;
  }

  function removeImageAtSourceSelection() {
    if (!sourceRef.current) {
      return false;
    }

    const textarea = sourceRef.current;
    const update = buildRemovedMarkdownImageSelection(
      markdownText,
      textarea.selectionStart ?? 0,
      textarea.selectionEnd ?? textarea.selectionStart ?? 0
    );
    if (!update) {
      return false;
    }

    applySourceTextUpdate(update.text, update.selectionStart, update.selectionEnd);
    setStatus("Removed image");
    return true;
  }

  function toggleWrappedSourceSelection(prefix, suffix = prefix, placeholder = "") {
    const textarea = sourceRef.current;
    if (!textarea) {
      return;
    }
    const update = buildToggledWrappedSourceSelection(
      markdownText,
      textarea.selectionStart ?? 0,
      textarea.selectionEnd ?? textarea.selectionStart ?? 0,
      prefix,
      suffix,
      placeholder
    );
    applySourceTextUpdate(update.text, update.selectionStart, update.selectionEnd);
  }

  function togglePrefixedSourceLines(prefix, options = {}) {
    const textarea = sourceRef.current;
    if (!textarea) {
      return;
    }
    const update = buildToggledPrefixedSourceLines(
      markdownText,
      textarea.selectionStart ?? 0,
      textarea.selectionEnd ?? textarea.selectionStart ?? 0,
      prefix,
      options
    );
    applySourceTextUpdate(update.text, update.selectionStart, update.selectionEnd);
  }

  function applyFormatting(format) {
    if (getActiveEditingSurface() === "source" && sourceRef.current) {
      switch (format) {
        case "paragraph":
          setStatus("In source view, edit paragraph styles directly in Markdown.");
          break;
        case "heading-1":
          togglePrefixedSourceLines("# ", {
            isApplied: (line) => /^#\s+/.test(line),
            strip: (line) => line.replace(/^#\s+/, ""),
            normalize: (line) => line.replace(/^#{1,}\s*/, "")
          });
          break;
        case "heading-2":
          togglePrefixedSourceLines("## ", {
            isApplied: (line) => /^##\s+/.test(line),
            strip: (line) => line.replace(/^##\s+/, ""),
            normalize: (line) => line.replace(/^#{1,}\s*/, "")
          });
          break;
        case "heading-3":
          togglePrefixedSourceLines("### ", {
            isApplied: (line) => /^###\s+/.test(line),
            strip: (line) => line.replace(/^###\s+/, ""),
            normalize: (line) => line.replace(/^#{1,}\s*/, "")
          });
          break;
        case "heading-4":
          togglePrefixedSourceLines("#### ", {
            isApplied: (line) => /^####\s+/.test(line),
            strip: (line) => line.replace(/^####\s+/, ""),
            normalize: (line) => line.replace(/^#{1,}\s*/, "")
          });
          break;
        case "heading-5":
          togglePrefixedSourceLines("##### ", {
            isApplied: (line) => /^#####\s+/.test(line),
            strip: (line) => line.replace(/^#####\s+/, ""),
            normalize: (line) => line.replace(/^#{1,}\s*/, "")
          });
          break;
        case "heading-6":
          togglePrefixedSourceLines("###### ", {
            isApplied: (line) => /^######\s+/.test(line),
            strip: (line) => line.replace(/^######\s+/, ""),
            normalize: (line) => line.replace(/^#{1,}\s*/, "")
          });
          break;
        case "bullet-list":
          togglePrefixedSourceLines("- ", {
            isApplied: (line) => /^[-*+]\s+/.test(line),
            strip: (line) => line.replace(/^[-*+]\s+/, ""),
            normalize: (line) => line.replace(/^[-*+]\s+/, "")
          });
          break;
        case "ordered-list":
          togglePrefixedSourceLines("1. ", {
            numbered: true,
            isApplied: (line) => /^\d+\.\s+/.test(line),
            strip: (line) => line.replace(/^\d+\.\s+/, ""),
            normalize: (line) => line.replace(/^\d+\.\s+/, "")
          });
          break;
        case "task-list":
          togglePrefixedSourceLines("- [ ] ", {
            isApplied: (line) => /^[-*+]\s\[(?: |x|X)\]\s*/.test(line),
            strip: (line) => line.replace(/^[-*+]\s\[(?: |x|X)\]\s*/, ""),
            normalize: (line) => line.replace(/^[-*+]\s\[(?: |x|X)\]\s*/, "")
          });
          break;
        case "blockquote":
          togglePrefixedSourceLines("> ", {
            isApplied: (line) => /^(?:>\s?)+/.test(line),
            strip: (line) => line.replace(/^(?:>\s?)+/, ""),
            normalize: (line) => line.replace(/^(?:>\s?)+/, "")
          });
          break;
        case "code-block":
          toggleWrappedSourceSelection("```\n", "\n```", "code");
          break;
        case "horizontal-rule":
          insertIntoSource("---", { block: true });
          break;
        case "bold":
          toggleWrappedSourceSelection("**", "**", "bold");
          break;
        case "italic":
          toggleWrappedSourceSelection("*", "*", "italic");
          break;
        case "underline":
          toggleWrappedSourceSelection("<u>", "</u>", "underline");
          break;
        case "strike":
          toggleWrappedSourceSelection("~~", "~~", "strike");
          break;
        case "highlight":
          toggleWrappedSourceSelection("==", "==", "highlight");
          break;
        case "subscript":
          toggleWrappedSourceSelection("~", "~", "sub");
          break;
        case "superscript":
          toggleWrappedSourceSelection("^", "^", "sup");
          break;
        case "inline-code":
          toggleWrappedSourceSelection("`", "`", "code");
          break;
        case "link": {
          openLinkDialog();
          break;
        }
        case "image": {
          if (!removeImageAtSourceSelection()) {
            insertImage();
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
      case "heading-4":
        runEditorCommand((chain) => chain.toggleHeading({ level: 4 }).run());
        break;
      case "heading-5":
        runEditorCommand((chain) => chain.toggleHeading({ level: 5 }).run());
        break;
      case "heading-6":
        runEditorCommand((chain) => chain.toggleHeading({ level: 6 }).run());
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
        openLinkDialog();
        break;
      }
      default:
        break;
    }
  }

  const showEditor = true;
  const showSource = ["source", "split"].includes(preferences.viewMode) || findOpen;
  const showPreview = ["preview", "split"].includes(preferences.viewMode);
  const findSummary = findOpen && findQuery ? `${matches.length === 0 ? "0" : `${matchIndex + 1}/${matches.length}`} matches` : null;
  const documentPathLabel = filePath || preferences.workspaceRoot || "";
  const paneFindLabel = findOpen && findQuery ? `${matches.length === 0 ? "0" : `${matchIndex + 1}/${matches.length}`}` : null;

  return (
    <div className={`app-shell theme-${preferences.theme}`}>
      <Toolbar
        contextActions={toolbarContextActions}
        currentContext={toolbarContext}
        editor={editor}
        onOpenPalette={openCommandPalette}
        onInsertImage={insertImage}
        onInsertTable={insertTable}
        onApplyFormat={applyFormatting}
        onSave={() => saveDocument(false)}
        onOpenFind={openFindReplace}
      />

      <FindReplaceBar
        activePane={activePane}
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
            recentFiles={recentFiles}
            onCreateDocument={createNewDocument}
            onOpenDocument={openDocument}
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
            <section
              className={`editor-pane${preferences.viewMode === "editor" ? "" : " editor-pane-hidden"}${activePane === "editor" ? " pane-active" : ""}`}
              aria-hidden={preferences.viewMode === "editor" ? undefined : true}
              onMouseDown={markEditorAsActive}
            >
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
            <section ref={sourcePaneRef} className={`side-pane source-pane${activePane === "source" ? " pane-active" : ""}`}>
              <div ref={sourceEditorShellRef} className={`source-editor-shell${findOpen && findQuery ? " searching" : ""}`}>
                <div
                  ref={sourceHighlightRef}
                  className={`source-highlight-layer${findOpen && findQuery ? " searching" : " measure-only"}`}
                  aria-hidden="true"
                >
                  {findOpen && findQuery ? sourceHighlightContent : `${markdownText}\n`}
                </div>
                <textarea
                  ref={sourceRef}
                  className={`source-textarea${findOpen && findQuery ? " searching" : ""}`}
                  value={markdownText}
                  onChange={handleSourceChange}
                  onClick={(event) => {
                    markSourceAsActive();
                    handleSourceSelection(event);
                  }}
                  onFocus={markSourceAsActive}
                  onCompositionStart={() => {
                    markSourceAsActive();
                    sourceComposingRef.current = true;
                  }}
                  onCompositionEnd={() => {
                    window.requestAnimationFrame(() => {
                      sourceComposingRef.current = false;
                    });
                  }}
                  onKeyDown={(event) => {
                    markSourceAsActive();
                    handleSourceKeyDown(event);
                  }}
                  onKeyUp={handleSourceSelection}
                />
              </div>
            </section>
          ) : null}

          {showPreview ? (
            <section className={`side-pane preview-pane${activePane === "preview" ? " pane-active" : ""}`} onMouseDown={markPreviewAsActive}>
              <MarkdownPreview
                html={previewHtml}
                theme={preferences.theme}
                sanitizeOptions={previewSanitizeOptions}
                findQuery={findOpen ? findQuery : ""}
                currentFindIndex={matchIndex}
                onActivate={markPreviewAsActive}
              />
            </section>
          ) : null}
        </main>
      </div>

      <StatusBar
        activePane={activePane}
        lineCount={stats.lineCount}
        wordCount={stats.wordCount}
        charCount={stats.charCount}
        readingMinutes={stats.readingMinutes}
        sidebarVisible={preferences.sidebarVisible}
        viewMode={preferences.viewMode}
        statusMessage={statusState.message}
        statusKind={statusState.kind}
        findSummary={findSummary}
        positionSummary={activePane === "source" ? sourceSelectionMeta.statusLabel : null}
        onSetViewMode={(mode) => updatePreferences({ viewMode: mode })}
        onToggleSidebar={() => updatePreferences({ sidebarVisible: !preferences.sidebarVisible })}
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

      <EditingCheatsheetDialog open={editingCheatsheetOpen} onClose={() => setEditingCheatsheetOpen(false)} />
      <LinkDialog
        open={Boolean(linkDialogState)}
        initialText={linkDialogState?.initialText || ""}
        initialUrl={linkDialogState?.initialUrl || ""}
        allowRemove={Boolean(linkDialogState?.canRemove)}
        onCancel={() => setLinkDialogState(null)}
        onRemove={removeLinkFromDialog}
        onSubmit={applyLinkFromDialog}
      />
    </div>
  );
}
