import React from "react";

function ToolButton({ active = false, onClick, children, title }) {
  return (
    <button className={`tool-button${active ? " active" : ""}`} type="button" title={title} onClick={onClick}>
      {children}
    </button>
  );
}

export default function Toolbar({
  editor,
  onNew,
  onOpen,
  onInsertImage,
  onInsertTable,
  onApplyFormat,
  onSave,
  onSaveAs,
  onExport,
  onExportPdf,
  onOpenFind,
  onOpenPreferences,
  onSetViewMode,
  viewMode
}) {
  if (!editor) {
    return null;
  }

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <ToolButton title="New Document" onClick={onNew}>
          New
        </ToolButton>
        <ToolButton title="Open Document" onClick={onOpen}>
          Open
        </ToolButton>
        <ToolButton title="Save" onClick={onSave}>
          Save
        </ToolButton>
        <ToolButton title="Save As" onClick={onSaveAs}>
          Save As
        </ToolButton>
      </div>

      <div className="toolbar-group">
        <ToolButton title="Paragraph" onClick={() => onApplyFormat("paragraph")}>
          P
        </ToolButton>
        <ToolButton
          title="Heading 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => onApplyFormat("heading-1")}
        >
          H1
        </ToolButton>
        <ToolButton
          title="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => onApplyFormat("heading-2")}
        >
          H2
        </ToolButton>
        <ToolButton
          title="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => onApplyFormat("heading-3")}
        >
          H3
        </ToolButton>
      </div>

      <div className="toolbar-group">
        <ToolButton
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() => onApplyFormat("bold")}
        >
          B
        </ToolButton>
        <ToolButton
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => onApplyFormat("italic")}
        >
          I
        </ToolButton>
        <ToolButton
          title="Underline"
          active={editor.isActive("underline")}
          onClick={() => onApplyFormat("underline")}
        >
          U
        </ToolButton>
        <ToolButton
          title="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => onApplyFormat("strike")}
        >
          S
        </ToolButton>
        <ToolButton
          title="Highlight"
          active={editor.isActive("highlight")}
          onClick={() => onApplyFormat("highlight")}
        >
          Mark
        </ToolButton>
        <ToolButton
          title="Subscript"
          active={editor.isActive("subscript")}
          onClick={() => onApplyFormat("subscript")}
        >
          Sub
        </ToolButton>
        <ToolButton
          title="Superscript"
          active={editor.isActive("superscript")}
          onClick={() => onApplyFormat("superscript")}
        >
          Sup
        </ToolButton>
        <ToolButton
          title="Inline Code"
          active={editor.isActive("code")}
          onClick={() => onApplyFormat("inline-code")}
        >
          {"</>"}
        </ToolButton>
      </div>

      <div className="toolbar-group">
        <ToolButton
          title="Blockquote"
          active={editor.isActive("blockquote")}
          onClick={() => onApplyFormat("blockquote")}
        >
          "
        </ToolButton>
        <ToolButton
          title="Bulleted List"
          active={editor.isActive("bulletList")}
          onClick={() => onApplyFormat("bullet-list")}
        >
          •
        </ToolButton>
        <ToolButton
          title="Numbered List"
          active={editor.isActive("orderedList")}
          onClick={() => onApplyFormat("ordered-list")}
        >
          1.
        </ToolButton>
        <ToolButton
          title="Task List"
          active={editor.isActive("taskList")}
          onClick={() => onApplyFormat("task-list")}
        >
          ☑
        </ToolButton>
        <ToolButton
          title="Code Block"
          active={editor.isActive("codeBlock")}
          onClick={() => onApplyFormat("code-block")}
        >
          {`{ }`}
        </ToolButton>
      </div>

      <div className="toolbar-group">
        <ToolButton title="Insert Link" onClick={() => onApplyFormat("link")}>
          Link
        </ToolButton>
        <ToolButton title="Insert Image" onClick={onInsertImage}>
          Img
        </ToolButton>
        <ToolButton title="Insert Table" onClick={onInsertTable}>
          Tbl
        </ToolButton>
      </div>

      <div className="toolbar-group">
        <ToolButton title="Editor Only" active={viewMode === "editor"} onClick={() => onSetViewMode("editor")}>
          Edit
        </ToolButton>
        <ToolButton title="Split View" active={viewMode === "split"} onClick={() => onSetViewMode("split")}>
          Split
        </ToolButton>
        <ToolButton title="Source Only" active={viewMode === "source"} onClick={() => onSetViewMode("source")}>
          Src
        </ToolButton>
        <ToolButton title="Preview Only" active={viewMode === "preview"} onClick={() => onSetViewMode("preview")}>
          Preview
        </ToolButton>
      </div>

      <div className="toolbar-group toolbar-actions">
        <ToolButton title="Find and Replace" onClick={onOpenFind}>
          Find
        </ToolButton>
        <ToolButton title="Preferences" onClick={onOpenPreferences}>
          Pref
        </ToolButton>
        <ToolButton title="Export HTML" onClick={onExport}>
          HTML
        </ToolButton>
        <ToolButton title="Export PDF" onClick={onExportPdf}>
          PDF
        </ToolButton>
      </div>
    </div>
  );
}
