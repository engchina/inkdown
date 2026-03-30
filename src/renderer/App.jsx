import React, { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { Marked } from "marked";
import markedKatex from "marked-katex-extension";
import TurndownService from "turndown";
import katexStyles from "katex/dist/katex.min.css?inline";
import Toolbar from "./components/Toolbar";
import StatusBar from "./components/StatusBar";
import FindReplaceBar from "./components/FindReplaceBar";
import MarkdownPreview, { renderPreviewHtml } from "./components/MarkdownPreview";
import PreferencesDialog from "./components/PreferencesDialog";

const editorMarked = new Marked({
  gfm: true,
  breaks: true
});

const previewMarked = new Marked({
  gfm: true,
  breaks: true
});

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

function escapeTableCell(content) {
  const normalized = content
    .replace(/\r?\n/g, "<br>")
    .replace(/\|/g, "\\|")
    .trim();

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

turndown.addRule("taskListItems", {
  filter(node) {
    return node.nodeName === "LI" && node.getAttribute("data-type") === "taskItem";
  },
  replacement(content, node) {
    const checked = node.getAttribute("data-checked") === "true";
    return `- [${checked ? "x" : " "}] ${content.trim()}\n`;
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

const defaultPreferences = {
  theme: "paper",
  viewMode: "editor",
  fontSize: 18,
  lineWidth: 900
};

const initialMarkdown = `# Inkdown

这是一个接近 Typora 的沉浸式 Markdown 编辑器。

## 新增能力

- PDF 导出
- Mermaid 预览
- 数学公式预览：$E = mc^2$
- 源码/编辑/预览分栏

\`\`\`mermaid
graph TD
  A[Markdown] --> B[Preview]
  B --> C[Export]
\`\`\`
`;

function resolveImageSources(html, currentFilePath) {
  const temp = document.createElement("div");
  temp.innerHTML = html;

  temp.querySelectorAll("img").forEach((image) => {
    const source = image.getAttribute("src");
    if (!source) {
      return;
    }
    image.setAttribute("src", window.editorApi.resolveMarkdownAsset(currentFilePath, source));
  });

  return temp.innerHTML;
}

function transformPreviewHtml(html, currentFilePath) {
  const temp = document.createElement("div");
  temp.innerHTML = resolveImageSources(html, currentFilePath);

  temp.querySelectorAll("pre > code.language-mermaid").forEach((node) => {
    const wrapper = document.createElement("div");
    wrapper.className = "mermaid";
    wrapper.textContent = node.textContent || "";
    node.parentElement.replaceWith(wrapper);
  });

  return temp.innerHTML;
}

function renderMarkdownForEditor(markdown, currentFilePath) {
  return resolveImageSources(editorMarked.parse(markdown), currentFilePath);
}

function renderMarkdownForPreview(markdown, currentFilePath) {
  return transformPreviewHtml(previewMarked.parse(markdown), currentFilePath);
}

function buildStandaloneHtml(title, bodyHtml, theme) {
  return `<!doctype html>
<html lang="zh-CN">
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
      pre {
        overflow-x: auto;
        padding: 16px;
        border-radius: 14px;
        background: ${theme === "midnight" ? "#1c2434" : "#22252b"};
        color: #f5f7fa;
      }
      code {
        font-family: "Cascadia Code", "JetBrains Mono", monospace;
      }
      blockquote {
        margin-left: 0;
        padding-left: 18px;
        border-left: 4px solid #d0b896;
        color: ${theme === "midnight" ? "#d3dbe8" : "#69553f"};
      }
      table { width: 100%; border-collapse: collapse; }
      th, td {
        border: 1px solid rgba(160, 160, 160, 0.3);
        padding: 10px 12px;
      }
      .mermaid { margin: 1.5rem 0; }
    </style>
  </head>
  <body>${bodyHtml}</body>
</html>`;
}

function extractOutlineFromMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  return lines
    .map((line, index) => {
      const match = /^(#{1,6})\s+(.*)$/.exec(line);
      if (!match) {
        return null;
      }

      return {
        id: `heading-line-${index}`,
        level: match[1].length,
        line: index,
        text: match[2].trim() || "Untitled"
      };
    })
    .filter(Boolean);
}

function buildEditorHeadingPositions(editor) {
  const headings = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      headings.push({
        pos,
        text: node.textContent || "Untitled",
        level: node.attrs.level
      });
    }
  });
  return headings;
}

function countStats(markdown) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/[#>*_\-\[\]()!]/g, " ")
    .replace(/\s+/g, " ");

  const latinWords = text.match(/[A-Za-z0-9_]+(?:['-][A-Za-z0-9_]+)*/g) || [];
  const cjkChars = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) || [];
  const wordCount = latinWords.length + cjkChars.length;
  const lineCount = Math.max(1, markdown.split(/\r?\n/).length);

  return {
    lineCount,
    wordCount,
    charCount: markdown.length,
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

    matches.push({
      start: foundAt,
      end: foundAt + query.length
    });
    startIndex = foundAt + query.length;
  }

  return matches;
}

function getLineStartIndex(markdown, lineNumber) {
  const lines = markdown.split(/\r?\n/);
  let offset = 0;
  for (let index = 0; index < lineNumber; index += 1) {
    offset += lines[index].length + 1;
  }
  return offset;
}

export default function App() {
  const [filePath, setFilePath] = useState(null);
  const [markdownText, setMarkdownText] = useState(initialMarkdown);
  const [documentSessionKey, setDocumentSessionKey] = useState(0);
  const [outline, setOutline] = useState(extractOutlineFromMarkdown(initialMarkdown));
  const [activeOutlineId, setActiveOutlineId] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [renderedPreviewHtml, setRenderedPreviewHtml] = useState("");
  const [statusMessage, setStatusMessage] = useState("就绪");
  const sourceRef = useRef(null);
  const programmaticEditorSyncRef = useRef(false);
  const programmaticMarkdownSyncRef = useRef(false);
  const editorHeadingsRef = useRef([]);
  const statusTimerRef = useRef(null);

  const deferredMarkdown = useDeferredValue(markdownText);
  const matches = useMemo(() => findMatches(markdownText, findQuery), [markdownText, findQuery]);
  const stats = useMemo(() => countStats(markdownText), [markdownText]);
  const previewHtml = useMemo(
    () => renderMarkdownForPreview(deferredMarkdown, filePath),
    [deferredMarkdown, filePath]
  );

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3, 4, 5, 6] }
        }),
        Underline,
        Link.configure({
          openOnClick: true,
          autolink: true,
          defaultProtocol: "https"
        }),
        Image.configure({
          inline: false,
          allowBase64: true
        }),
        Placeholder.configure({
          placeholder: "开始写作，像 Typora 一样在正文里直接编辑 Markdown 内容。"
        }),
        TaskList,
        TaskItem.configure({
          nested: true
        }),
        Table.configure({
          resizable: true
        }),
        TableRow,
        TableHeader,
        TableCell
      ],
      content: renderMarkdownForEditor(markdownText, filePath),
      editorProps: {
        attributes: {
          class: "editor-surface"
        }
      },
      onCreate({ editor: instance }) {
        editorHeadingsRef.current = buildEditorHeadingPositions(instance);
      },
      onUpdate({ editor: instance }) {
        editorHeadingsRef.current = buildEditorHeadingPositions(instance);

        if (programmaticEditorSyncRef.current) {
          programmaticEditorSyncRef.current = false;
          return;
        }

        programmaticMarkdownSyncRef.current = true;
        const nextMarkdown = turndown.turndown(instance.getHTML()).trimStart();
        startTransition(() => {
          setMarkdownText(nextMarkdown);
          setOutline(extractOutlineFromMarkdown(nextMarkdown));
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
      }
    },
    [documentSessionKey]
  );

  useEffect(() => {
    window.editorApi.loadPreferences().then((loaded) => {
      setPreferences((current) => ({
        ...current,
        ...loaded
      }));
    });
  }, []);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.style.setProperty("--editor-font-size", `${preferences.fontSize}px`);
    document.documentElement.style.setProperty("--paper-width", `${preferences.lineWidth}px`);
    window.editorApi.savePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    window.editorApi.setDirty(isDirty);
  }, [isDirty]);

  useEffect(() => {
    window.editorApi.setFilePath(filePath);
  }, [filePath]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (programmaticMarkdownSyncRef.current) {
      programmaticMarkdownSyncRef.current = false;
      return;
    }

    const html = renderMarkdownForEditor(markdownText, filePath);
    programmaticEditorSyncRef.current = true;
    editor.commands.setContent(html, false, {
      preserveWhitespace: "full"
    });
    editorHeadingsRef.current = buildEditorHeadingPositions(editor);
  }, [markdownText, filePath, editor]);

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
          setPreferences((current) => ({ ...current, viewMode: action.mode }));
          break;
        default:
          break;
      }
    });

    return unsubscribe;
  }, [editor, filePath, markdownText, preferences]);

  useEffect(() => {
    if (!findOpen || !sourceRef.current || matches.length === 0 || preferences.viewMode !== "source") {
      return;
    }

    selectMatch(matchIndex);
  }, [findOpen, matchIndex, matches, preferences.viewMode]);

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

      await insertImageFromFile(imageFile.path);
    };

    const handlePaste = async (event) => {
      const imageItem = Array.from(event.clipboardData?.items || []).find((item) =>
        item.type.startsWith("image/")
      );

      if (!imageItem) {
        return;
      }

      event.preventDefault();
      const blob = imageItem.getAsFile();
      if (!blob) {
        return;
      }

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const extension = blob.type.split("/")[1] || "png";
      const persisted = await window.editorApi.persistImageBuffer({
        bytes: Array.from(bytes),
        extension
      });

      insertMarkdownImage(persisted.markdownPath, persisted.absolutePath);
    };

    const handleDragOver = (event) => event.preventDefault();

    window.addEventListener("drop", handleDrop);
    window.addEventListener("paste", handlePaste);
    window.addEventListener("dragover", handleDragOver);

    return () => {
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("dragover", handleDragOver);
    };
  }, [editor, filePath, markdownText]);

  const documentTitle = useMemo(() => {
    if (!filePath) {
      return "Untitled";
    }

    const parts = filePath.split(/[\\/]/);
    return parts[parts.length - 1];
  }, [filePath]);

  function applyDocumentState(nextMarkdown, nextFilePath) {
    console.log("[renderer] applyDocumentState", {
      filePath: nextFilePath,
      markdownLength: nextMarkdown.length
    });
    const nextOutline = extractOutlineFromMarkdown(nextMarkdown);
    programmaticMarkdownSyncRef.current = false;
    programmaticEditorSyncRef.current = false;
    setFilePath(nextFilePath);
    setMarkdownText(nextMarkdown);
    setOutline(nextOutline);
    setActiveOutlineId(nextOutline[0]?.id ?? null);
    setDocumentSessionKey((current) => current + 1);
  }

  async function openDocument() {
    console.log("[renderer] openDocument:start", { isDirty });
    if (!(await confirmDiscardChanges())) {
      console.log("[renderer] openDocument:cancelled-by-discard-check");
      return;
    }

    const result = await window.editorApi.openMarkdown();
    console.log("[renderer] openDocument:result", result);
    if (result.canceled || result.content === undefined) {
      return;
    }

    applyDocumentState(result.content, result.filePath);
    setIsDirty(false);
    setFindOpen(false);
    setFindQuery("");
    setReplaceValue("");
    setMatchIndex(0);
    setStatus(`已打开 ${result.filePath.split(/[\\/]/).pop()}`);
  }

  async function openDocumentFromPath(targetPath) {
    console.log("[renderer] openDocumentFromPath:start", { targetPath, isDirty });
    if (!(await confirmDiscardChanges())) {
      console.log("[renderer] openDocumentFromPath:cancelled-by-discard-check");
      return;
    }

    const result = await window.editorApi.openMarkdownPath(targetPath);
    console.log("[renderer] openDocumentFromPath:result", result);
    if (result.canceled || result.content === undefined) {
      return;
    }

    applyDocumentState(result.content, result.filePath);
    setIsDirty(false);
    setFindOpen(false);
    setFindQuery("");
    setReplaceValue("");
    setMatchIndex(0);
    setStatus(`已打开 ${result.filePath.split(/[\\/]/).pop()}`);
  }

  async function createNewDocument() {
    console.log("[renderer] createNewDocument:start", { isDirty });
    if (!(await confirmDiscardChanges())) {
      console.log("[renderer] createNewDocument:cancelled-by-discard-check");
      return;
    }

    applyDocumentState("", null);
    setIsDirty(false);
    setFindOpen(false);
    setFindQuery("");
    setReplaceValue("");
    setMatchIndex(0);
    setStatus("已新建空白文档");
  }

  async function confirmDiscardChanges() {
    if (!isDirty) {
      console.log("[renderer] confirmDiscardChanges:clean-document");
      return true;
    }

    const result = await window.editorApi.confirmDiscardChanges();
    console.log("[renderer] confirmDiscardChanges:result", result);
    return Boolean(result?.shouldContinue);
  }

  function setStatus(message) {
    setStatusMessage(message);
    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current);
    }
    statusTimerRef.current = window.setTimeout(() => {
      setStatusMessage("就绪");
    }, 3200);
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
      setStatus(`已保存到 ${result.filePath.split(/[\\/]/).pop()}`);
    }
  }

  async function exportHtml() {
    const preparedPreviewHtml = await renderPreviewHtml(previewHtml);
    const html = buildStandaloneHtml(documentTitle, preparedPreviewHtml, preferences.theme);
    const result = await window.editorApi.saveHtml({ html });
    if (!result.canceled) {
      setStatus(`已导出 HTML: ${result.filePath.split(/[\\/]/).pop()}`);
    }
  }

  async function exportPdf() {
    const preparedPreviewHtml = await renderPreviewHtml(previewHtml);
    const html = buildStandaloneHtml(documentTitle, preparedPreviewHtml, preferences.theme);
    const result = await window.editorApi.savePdf({ html });
    if (!result.canceled) {
      setStatus(`已导出 PDF: ${result.filePath.split(/[\\/]/).pop()}`);
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
    insertMarkdownImage(persisted.markdownPath, persisted.absolutePath);
    setStatus(`已插入图片 ${persisted.absolutePath.split(/[\\/]/).pop()}`);
  }

  function insertMarkdownImage(markdownPath, absolutePath) {
    const alt = absolutePath.split(/[\\/]/).pop() || "image";
    const prefix = markdownText.trimEnd();
    const nextMarkdown = `${prefix}${prefix ? "\n\n" : ""}![${alt}](${markdownPath})\n`;
    setMarkdownText(nextMarkdown);
    setIsDirty(true);
    editor?.chain().focus().setImage({ src: window.editorApi.toFileUrl(absolutePath), alt }).run();
  }

  function insertTable() {
    editor
      ?.chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
    setStatus("已插入表格");
  }

  function updatePreferences(patch) {
    setPreferences((current) => ({
      ...current,
      ...patch
    }));
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
    if (preferences.viewMode !== "source") {
      updatePreferences({ viewMode: "source" });
    }
  }

  function selectMatch(index) {
    if (!sourceRef.current || matches.length === 0) {
      return;
    }

    const match = matches[index];
    sourceRef.current.focus();
    sourceRef.current.setSelectionRange(match.start, match.end);
  }

  function goToNextMatch() {
    if (matches.length === 0) {
      return;
    }
    const nextIndex = (matchIndex + 1) % matches.length;
    setMatchIndex(nextIndex);
    selectMatch(nextIndex);
  }

  function goToPrevMatch() {
    if (matches.length === 0) {
      return;
    }
    const nextIndex = (matchIndex - 1 + matches.length) % matches.length;
    setMatchIndex(nextIndex);
    selectMatch(nextIndex);
  }

  function replaceCurrentMatch() {
    if (matches.length === 0) {
      return;
    }

    const current = matches[matchIndex];
    const nextMarkdown =
      markdownText.slice(0, current.start) +
      replaceValue +
      markdownText.slice(current.end);

    setMarkdownText(nextMarkdown);
    setIsDirty(true);
    setStatus("已替换当前匹配");
  }

  function replaceAllMatches() {
    if (!findQuery) {
      return;
    }

    setMarkdownText(markdownText.split(findQuery).join(replaceValue));
    setIsDirty(true);
    setStatus(`已替换全部 ${matches.length} 处匹配`);
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

  const showEditor = preferences.viewMode === "editor" || preferences.viewMode === "split";
  const showSource = preferences.viewMode === "source";
  const showPreview = preferences.viewMode === "split" || preferences.viewMode === "preview";
  const findSummary =
    findOpen && findQuery
      ? `${matches.length === 0 ? "0" : `${matchIndex + 1}/${matches.length}`} 匹配`
      : null;

  return (
    <div className="app-shell">
      <Toolbar
        editor={editor}
        onNew={createNewDocument}
        onOpen={openDocument}
        onInsertImage={insertImage}
        onInsertTable={insertTable}
        onSave={() => saveDocument(false)}
        onSaveAs={() => saveDocument(true)}
        onExport={exportHtml}
        onExportPdf={exportPdf}
        onOpenFind={openFindReplace}
        onOpenPreferences={() => setPreferencesOpen(true)}
        onSetViewMode={(mode) => updatePreferences({ viewMode: mode })}
        viewMode={preferences.viewMode}
      />

      <FindReplaceBar
        open={findOpen}
        query={findQuery}
        replaceValue={replaceValue}
        count={matches.length}
        currentIndex={matchIndex}
        onQueryChange={setFindQuery}
        onReplaceChange={setReplaceValue}
        onPrev={goToPrevMatch}
        onNext={goToNextMatch}
        onReplaceOne={replaceCurrentMatch}
        onReplaceAll={replaceAllMatches}
        onClose={() => setFindOpen(false)}
      />

      <div className="workspace">
        <aside className="outline-panel">
          <div className="panel-heading">Outline</div>
          {outline.length === 0 ? (
            <div className="outline-empty">暂无标题结构</div>
          ) : (
            outline.map((item, index) => (
              <button
                key={item.id}
                className={`outline-item level-${item.level}${activeOutlineId === item.id ? " active" : ""}`}
                type="button"
                onClick={() => jumpToOutline(item, index)}
              >
                {item.text}
              </button>
            ))
          )}
        </aside>

        <main className={`workspace-main mode-${preferences.viewMode}`}>
          {showEditor ? (
            <section className="editor-pane">
              <div className="paper">
                <div className="paper-header">
                  <div>
                    <div className="eyebrow">Markdown Document</div>
                    <h1>{documentTitle}</h1>
                  </div>
                  <div className={`sync-state${isDirty ? " dirty" : ""}`}>
                    {isDirty ? "Unsaved" : "Saved"}
                  </div>
                </div>
                <EditorContent editor={editor} />
              </div>
            </section>
          ) : null}

          {showSource ? (
            <section className="side-pane">
              <div className="side-pane-header">Source</div>
              <textarea
                ref={sourceRef}
                className="source-textarea"
                value={markdownText}
                onChange={handleSourceChange}
                onClick={handleSourceSelection}
                onKeyUp={handleSourceSelection}
              />
            </section>
          ) : null}

          {showPreview ? (
            <section className="side-pane preview-pane">
              <div className="side-pane-header">Preview</div>
              <MarkdownPreview html={previewHtml} onRendered={setRenderedPreviewHtml} />
            </section>
          ) : null}
        </main>
      </div>

      <StatusBar
        documentTitle={documentTitle}
        isDirty={isDirty}
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
