import React, { useEffect, useRef, useState } from "react";

function ToolButton({ active = false, children, className = "", disabled = false, onClick, title, variant = "default" }) {
  return (
    <button
      className={`tool-button tool-button-${variant}${active ? " active" : ""}${className ? ` ${className}` : ""}`}
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MenuButton({ children, onClick }) {
  return (
    <button className="toolbar-menu-item" type="button" onClick={onClick}>
      {children}
    </button>
  );
}

export default function Toolbar({
  documentPath,
  documentTitle,
  editor,
  isDirty,
  onExport,
  onExportPdf,
  onNew,
  onOpen,
  onOpenFind,
  onOpenPreferences,
  onRevealCurrentFile,
  onInsertImage,
  onInsertTable,
  onApplyFormat,
  onSave,
  onSaveAs,
  onSetViewMode,
  onToggleSidebar,
  sidebarVisible,
  viewMode
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

  function runMenuAction(action) {
    setMenuOpen(false);
    action();
  }

  return (
    <header className="toolbar-shell">
      <div className="toolbar document-toolbar">
        <div className="toolbar-group document-toolbar-group">
          <ToolButton
            className="sidebar-toggle-button"
            title={sidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
            variant="ghost"
            onClick={onToggleSidebar}
          >
            {sidebarVisible ? "Panel" : "Panel"}
          </ToolButton>

          <div className="document-meta">
            <div className="document-meta-title" title={documentTitle}>
              {documentTitle}
            </div>
            <div className="document-meta-path" title={documentPath || "Unsaved document"}>
              {documentPath || "Unsaved document"}
            </div>
          </div>
        </div>

        <div className="toolbar-group document-toolbar-actions">
          <div className={`document-status${isDirty ? " dirty" : ""}`}>{isDirty ? "Unsaved" : "Saved"}</div>

          <ToolButton title="Save" variant="primary" onClick={onSave}>
            Save
          </ToolButton>

          <div className="view-switch" role="tablist" aria-label="View mode">
            <ToolButton
              title="Editor Only"
              active={viewMode === "editor"}
              variant="ghost"
              onClick={() => onSetViewMode("editor")}
            >
              Edit
            </ToolButton>
            <ToolButton
              title="Split View"
              active={viewMode === "split"}
              variant="ghost"
              onClick={() => onSetViewMode("split")}
            >
              Split
            </ToolButton>
            <ToolButton
              title="Preview Only"
              active={viewMode === "preview"}
              variant="ghost"
              onClick={() => onSetViewMode("preview")}
            >
              Preview
            </ToolButton>
          </div>

          <div ref={menuRef} className={`toolbar-menu${menuOpen ? " open" : ""}`}>
            <ToolButton
              className="menu-trigger"
              title="More Actions"
              variant="ghost"
              onClick={() => setMenuOpen((current) => !current)}
            >
              ...
            </ToolButton>

            {menuOpen ? (
              <div className="toolbar-menu-panel">
                <MenuButton onClick={() => runMenuAction(onNew)}>New Document</MenuButton>
                <MenuButton onClick={() => runMenuAction(onOpen)}>Open Document</MenuButton>
                <MenuButton onClick={() => runMenuAction(onSaveAs)}>Save As</MenuButton>
                <MenuButton onClick={() => runMenuAction(() => onSetViewMode("source"))}>Source Mode</MenuButton>
                {documentPath ? (
                  <MenuButton onClick={() => runMenuAction(onRevealCurrentFile)}>Reveal in Folder</MenuButton>
                ) : null}
                <MenuButton onClick={() => runMenuAction(onExport)}>Export HTML</MenuButton>
                <MenuButton onClick={() => runMenuAction(onExportPdf)}>Export PDF</MenuButton>
                <MenuButton onClick={() => runMenuAction(onOpenPreferences)}>Preferences</MenuButton>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="toolbar format-toolbar">
        <div className="toolbar-group">
          <ToolButton disabled={!editor} title="Paragraph" onClick={() => onApplyFormat("paragraph")}>
            P
          </ToolButton>
          <ToolButton
            disabled={!editor}
            title="Heading 1"
            active={editor?.isActive("heading", { level: 1 })}
            onClick={() => onApplyFormat("heading-1")}
          >
            H1
          </ToolButton>
          <ToolButton
            disabled={!editor}
            title="Heading 2"
            active={editor?.isActive("heading", { level: 2 })}
            onClick={() => onApplyFormat("heading-2")}
          >
            H2
          </ToolButton>
          <ToolButton
            disabled={!editor}
            title="Heading 3"
            active={editor?.isActive("heading", { level: 3 })}
            onClick={() => onApplyFormat("heading-3")}
          >
            H3
          </ToolButton>
        </div>

        <div className="toolbar-group">
          <ToolButton disabled={!editor} title="Bold" active={editor?.isActive("bold")} onClick={() => onApplyFormat("bold")}>
            B
          </ToolButton>
          <ToolButton
            disabled={!editor}
            title="Italic"
            active={editor?.isActive("italic")}
            onClick={() => onApplyFormat("italic")}
          >
            I
          </ToolButton>
          <ToolButton
            disabled={!editor}
            title="Underline"
            active={editor?.isActive("underline")}
            onClick={() => onApplyFormat("underline")}
          >
            U
          </ToolButton>
          <ToolButton disabled={!editor} title="Strike" active={editor?.isActive("strike")} onClick={() => onApplyFormat("strike")}>
            S
          </ToolButton>
          <ToolButton
            disabled={!editor}
            title="Inline Code"
            active={editor?.isActive("code")}
            onClick={() => onApplyFormat("inline-code")}
          >
            {"</>"}
          </ToolButton>
        </div>

        <div className="toolbar-group">
          <ToolButton
            disabled={!editor}
            title="Bulleted List"
            active={editor?.isActive("bulletList")}
            onClick={() => onApplyFormat("bullet-list")}
          >
            •
          </ToolButton>
          <ToolButton
            disabled={!editor}
            title="Numbered List"
            active={editor?.isActive("orderedList")}
            onClick={() => onApplyFormat("ordered-list")}
          >
            1.
          </ToolButton>
          <ToolButton
            disabled={!editor}
            title="Task List"
            active={editor?.isActive("taskList")}
            onClick={() => onApplyFormat("task-list")}
          >
            ☑
          </ToolButton>
          <ToolButton
            disabled={!editor}
            title="Blockquote"
            active={editor?.isActive("blockquote")}
            onClick={() => onApplyFormat("blockquote")}
          >
            "
          </ToolButton>
          <ToolButton
            disabled={!editor}
            title="Code Block"
            active={editor?.isActive("codeBlock")}
            onClick={() => onApplyFormat("code-block")}
          >
            {`{ }`}
          </ToolButton>
        </div>

        <div className="toolbar-group">
          <ToolButton disabled={!editor} title="Insert Link" onClick={() => onApplyFormat("link")}>
            Link
          </ToolButton>
          <ToolButton disabled={!editor} title="Insert Image" onClick={onInsertImage}>
            Img
          </ToolButton>
          <ToolButton disabled={!editor} title="Insert Table" onClick={onInsertTable}>
            Tbl
          </ToolButton>
        </div>

        <div className="toolbar-group toolbar-format-secondary">
          <ToolButton
            disabled={!editor}
            title="Highlight"
            active={editor?.isActive("highlight")}
            onClick={() => onApplyFormat("highlight")}
          >
            Mark
          </ToolButton>
          <ToolButton
            disabled={!editor}
            title="Subscript"
            active={editor?.isActive("subscript")}
            onClick={() => onApplyFormat("subscript")}
          >
            Sub
          </ToolButton>
          <ToolButton
            disabled={!editor}
            title="Superscript"
            active={editor?.isActive("superscript")}
            onClick={() => onApplyFormat("superscript")}
          >
            Sup
          </ToolButton>
          <ToolButton title="Find and Replace" variant="ghost" onClick={onOpenFind}>
            Find
          </ToolButton>
        </div>
      </div>
    </header>
  );
}
