import React, { forwardRef } from "react";
import { Command, Save } from "lucide-react";

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
  contextActions = [],
  currentContext,
  editor,
  onOpenPalette,
  onOpenFind,
  onInsertImage,
  onInsertTable,
  onApplyFormat,
  onSave
}) {
  const emphasizedSection = resolveToolbarSectionEmphasis(currentContext);

  return (
    <header className="toolbar-shell">
      <div className="toolbar format-toolbar">
        <div className="toolbar-section toolbar-section-utility">
          <div className="toolbar-group toolbar-section-controls">
            <ToolButton title="Save" variant="primary" onClick={onSave}>
              <Save size={14} strokeWidth={2} />
              <span>Save</span>
            </ToolButton>
            <ToolButton title="Command Palette" variant="ghost" onClick={() => onOpenPalette()}>
              <Command size={14} strokeWidth={2} />
              <span>Command</span>
            </ToolButton>
          </div>
        </div>

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
            title="Heading 4"
            active={editor?.isActive("heading", { level: 4 })}
            onClick={() => onApplyFormat("heading-4")}
          >
            H4
          </ToolButton>
          <ToolButton
            disabled={!editor}
            title="Heading 5"
            active={editor?.isActive("heading", { level: 5 })}
            onClick={() => onApplyFormat("heading-5")}
          >
            H5
          </ToolButton>
          <ToolButton
            disabled={!editor}
            title="Heading 6"
            active={editor?.isActive("heading", { level: 6 })}
            onClick={() => onApplyFormat("heading-6")}
          >
            H6
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
          <ToolButton disabled={!editor} title="Horizontal Rule" onClick={() => onApplyFormat("horizontal-rule")}>
            Rule
          </ToolButton>
        </ToolbarSection>

        <ToolbarSection title="Review" className={`toolbar-format-secondary${emphasizedSection === "Review" ? " active" : ""}`}>
          <ToolButton title="Find and Replace" variant="ghost" onClick={onOpenFind}>
            Find
          </ToolButton>
        </ToolbarSection>

        {contextActions.length ? (
          <div className="toolbar-context-actions" aria-label="Context actions">
            {contextActions.map((action) => (
              <ContextActionButton key={action.id} action={action} />
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}
