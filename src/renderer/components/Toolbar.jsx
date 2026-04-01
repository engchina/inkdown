import React, { forwardRef, useEffect, useMemo, useRef, useState } from "react";

const ToolButton = forwardRef(function ToolButton(
  { active = false, children, className = "", disabled = false, onClick, title, variant = "default", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={`tool-button tool-button-${variant}${active ? " active" : ""}${className ? ` ${className}` : ""}`}
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
});

function ToolbarSection({ title, children, className = "" }) {
  return (
    <div className={`toolbar-section${className ? ` ${className}` : ""}`}>
      <div className="toolbar-section-label">{title}</div>
      <div className="toolbar-group toolbar-section-controls">{children}</div>
    </div>
  );
}

export function resolveToolbarSectionEmphasis(context = {}) {
  switch (context.kind) {
    case "bold":
    case "italic":
    case "underline":
    case "strike":
    case "highlight":
    case "inline-code":
      return "Text";
    case "heading":
    case "code":
    case "quote":
    case "paragraph":
    case "code-block":
      return "Blocks";
    case "task":
    case "list":
    case "table":
      return "Structure";
    case "link":
    case "image":
      return "Insert";
    case "find":
      return "Review";
    default:
      return "";
  }
}

export function buildFileMenuItems({
  canRevealFile,
  onExport,
  onExportPdf,
  onNew,
  onOpen,
  onOpenPreferences,
  onRevealCurrentFile,
  onSave,
  onSaveAs
}) {
  return [
    { id: "new", label: "New Document", onSelect: onNew },
    { id: "open", label: "Open Document", onSelect: onOpen },
    { id: "save", label: "Save", onSelect: onSave },
    { id: "save-as", label: "Save As", onSelect: onSaveAs },
    { id: "export-html", label: "Export HTML", onSelect: onExport },
    { id: "export-pdf", label: "Export PDF", onSelect: onExportPdf },
    { id: "reveal", label: "Reveal In Folder", onSelect: onRevealCurrentFile, disabled: !canRevealFile },
    { id: "preferences", label: "Preferences", onSelect: onOpenPreferences }
  ];
}

export function buildInsertMenuItems({ onApplyFormat, onInsertImage, onInsertTable }) {
  return [
    { id: "link", label: "Insert Link", onSelect: () => onApplyFormat("link") },
    { id: "image", label: "Insert Image", onSelect: onInsertImage },
    { id: "table", label: "Insert Table", onSelect: onInsertTable },
    { id: "rule", label: "Horizontal Rule", onSelect: () => onApplyFormat("horizontal-rule") },
    { id: "code-block", label: "Code Block", onSelect: () => onApplyFormat("code-block") }
  ];
}

function ToolbarMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const itemRefs = useRef([]);
  const pendingFocusIndexRef = useRef(null);
  const menuId = useMemo(() => `toolbar-menu-${String(label || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, [label]);

  useEffect(() => {
    if (!open) {
      itemRefs.current = [];
      return undefined;
    }

    const targetIndex = pendingFocusIndexRef.current ?? 0;
    const rafId = window.requestAnimationFrame(() => {
      itemRefs.current[targetIndex]?.focus();
      pendingFocusIndexRef.current = null;
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function focusMenuItem(index) {
    const enabledRefs = itemRefs.current.filter(Boolean);
    if (!enabledRefs.length) {
      return;
    }
    const boundedIndex = Math.max(0, Math.min(index, enabledRefs.length - 1));
    enabledRefs[boundedIndex]?.focus();
  }

  function openMenuWithFocus(index = 0) {
    pendingFocusIndexRef.current = index;
    setOpen(true);
  }

  function closeMenuAndRestoreTrigger() {
    setOpen(false);
    window.requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }

  function handleTriggerKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenuWithFocus(0);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenuWithFocus(Math.max(0, items.length - 1));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) {
        closeMenuAndRestoreTrigger();
      } else {
        openMenuWithFocus(0);
      }
    }
  }

  function handleMenuKeyDown(event) {
    const currentIndex = itemRefs.current.findIndex((item) => item === document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusMenuItem(currentIndex + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusMenuItem(currentIndex <= 0 ? itemRefs.current.length - 1 : currentIndex - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusMenuItem(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusMenuItem(itemRefs.current.length - 1);
      return;
    }
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") {
        event.preventDefault();
      }
      closeMenuAndRestoreTrigger();
    }
  }

  return (
    <div ref={rootRef} className="toolbar-menu">
      <ToolButton
        className="menu-trigger"
        ref={triggerRef}
        title={label}
        variant="ghost"
        active={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        {label}
      </ToolButton>
      {open ? (
        <div id={menuId} className="toolbar-menu-panel" role="menu" aria-label={label} onKeyDown={handleMenuKeyDown}>
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              className="toolbar-menu-item"
              role="menuitem"
              tabIndex={-1}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect?.();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ContextActionButton({ action }) {
  return (
    <button
      className={`toolbar-context-action${action.tone ? ` ${action.tone}` : ""}`}
      type="button"
      disabled={action.disabled}
      onClick={action.onSelect}
      title={action.description || action.label}
    >
      {action.label}
    </button>
  );
}

export default function Toolbar({
  activePane,
  contextLabel,
  contextActions = [],
  currentContext,
  focusMode,
  documentPath,
  documentTitle,
  editor,
  frontMatterActive,
  hasFrontMatter,
  frontMatterStatusText,
  frontMatterTone,
  isDirty,
  onExport,
  onExportPdf,
  onOpenFrontMatter,
  onOpenPalette,
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
  onToggleFocusMode,
  onToggleTypewriterMode,
  typewriterMode,
  viewMode
}) {
  const fileMenuItems = useMemo(
    () =>
      buildFileMenuItems({
        canRevealFile: Boolean(documentPath && documentPath !== "Unsaved document"),
        onExport,
        onExportPdf,
        onNew,
        onOpen,
        onOpenPreferences,
        onRevealCurrentFile,
        onSave,
        onSaveAs
      }),
    [documentPath, onExport, onExportPdf, onNew, onOpen, onOpenPreferences, onRevealCurrentFile, onSave, onSaveAs]
  );
  const insertMenuItems = useMemo(
    () =>
      buildInsertMenuItems({
        onApplyFormat,
        onInsertImage,
        onInsertTable
      }),
    [onApplyFormat, onInsertImage, onInsertTable]
  );
  const emphasizedSection = resolveToolbarSectionEmphasis(currentContext);

  return (
    <header className="toolbar-shell">
      <div className="toolbar document-toolbar">
        <div className="toolbar-group document-toolbar-group">
          <div className="document-meta">
            <div className="document-meta-title" title={documentTitle}>
              {documentTitle}
            </div>
            <div className="document-meta-row">
              <div className="document-meta-path" title={documentPath || "Unsaved document"}>
                {documentPath || "Unsaved document"}
              </div>
              <button
                type="button"
                className={`document-meta-chip document-meta-chip-${frontMatterTone}${frontMatterActive ? " active" : ""}`}
                onClick={onOpenFrontMatter}
                title={hasFrontMatter ? "Open front matter" : "Add front matter"}
              >
                <span className="document-meta-chip-label">{hasFrontMatter ? "Front Matter" : "Add Front Matter"}</span>
                {frontMatterStatusText ? <span className="document-meta-chip-status">{frontMatterStatusText}</span> : null}
              </button>
            </div>
          </div>
        </div>

        <div className="toolbar-group document-toolbar-actions">
          <div className="document-toolbar-utility">
            <ToolbarMenu label="File" items={fileMenuItems} />
            <ToolbarMenu label="Insert" items={insertMenuItems} />

            <div className={`document-status${isDirty ? " dirty" : ""}`}>
              <span className="document-status-dot" aria-hidden="true" />
              {isDirty ? "Unsaved" : "Saved"}
            </div>

            <ToolButton title="Command Palette" variant="ghost" onClick={() => onOpenPalette()}>
              Command
            </ToolButton>

            <ToolButton title="Save" variant="primary" onClick={onSave}>
              Save
            </ToolButton>
          </div>

          <div className="document-toolbar-modes">
            {contextLabel ? <div className="toolbar-context-pill">{activePane ? `${activePane} • ${contextLabel}` : contextLabel}</div> : null}
            {contextActions.length ? (
              <div className="toolbar-context-actions" aria-label="Context actions">
                {contextActions.map((action) => (
                  <ContextActionButton key={action.id} action={action} />
                ))}
              </div>
            ) : null}
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
                title="Source + Preview"
                active={viewMode === "split"}
                variant="ghost"
                onClick={() => onSetViewMode("split")}
              >
                Split
              </ToolButton>
              <ToolButton
                title="Source Mode"
                active={viewMode === "source"}
                variant="ghost"
                onClick={() => onSetViewMode("source")}
              >
                Source
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

            <div className="view-switch writing-modes" aria-label="Writing modes">
              <ToolButton title="Focus Mode" active={focusMode} variant="ghost" onClick={onToggleFocusMode}>
                Focus
              </ToolButton>
              <ToolButton
                title="Typewriter Mode"
                active={typewriterMode}
                variant="ghost"
                onClick={onToggleTypewriterMode}
              >
                Typewriter
              </ToolButton>
            </div>
          </div>
        </div>
      </div>

      <div className="toolbar format-toolbar">
        <ToolbarSection title="Text" className={emphasizedSection === "Text" ? " active" : ""}>
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
          <ToolButton
            disabled={!editor}
            title="Highlight"
            active={editor?.isActive("highlight")}
            onClick={() => onApplyFormat("highlight")}
          >
            Mark
          </ToolButton>
        </ToolbarSection>

        <ToolbarSection title="Blocks" className={emphasizedSection === "Blocks" ? " active" : ""}>
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
        </ToolbarSection>

        <ToolbarSection title="Structure" className={emphasizedSection === "Structure" ? " active" : ""}>
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
        </ToolbarSection>

        <ToolbarSection title="Insert" className={`toolbar-section-insert${emphasizedSection === "Insert" ? " active" : ""}`}>
          <ToolButton disabled={!editor} title="Insert Link" onClick={() => onApplyFormat("link")}>
            Link
          </ToolButton>
          <ToolButton disabled={!editor} title="Insert Image" onClick={onInsertImage}>
            Img
          </ToolButton>
          <ToolButton disabled={!editor} title="Insert Table" onClick={onInsertTable}>
            Tbl
          </ToolButton>
        </ToolbarSection>

        <ToolbarSection title="Review" className={`toolbar-format-secondary${emphasizedSection === "Review" ? " active" : ""}`}>
          <ToolButton title="Find and Replace" variant="ghost" onClick={onOpenFind}>
            Find
          </ToolButton>
        </ToolbarSection>
      </div>
    </header>
  );
}
