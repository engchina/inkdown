import React from "react";

function ToolButton({ active = false, onClick, children, title }) {
  return (
    <button
      className={`tool-button${active ? " active" : ""}`}
      type="button"
      title={title}
      onClick={() => {
        console.log("[renderer] toolbar-click", title);
        onClick?.();
      }}
    >
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
        <ToolButton title="新建文档" onClick={onNew}>
          New
        </ToolButton>
        <ToolButton title="打开文档" onClick={onOpen}>
          Open
        </ToolButton>
        <ToolButton title="保存" onClick={onSave}>
          Save
        </ToolButton>
        <ToolButton title="另存为" onClick={onSaveAs}>
          Save As
        </ToolButton>
      </div>

      <div className="toolbar-group">
        <ToolButton title="正文" onClick={() => editor.chain().focus().setParagraph().run()}>
          P
        </ToolButton>
        <ToolButton
          title="一级标题"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          H1
        </ToolButton>
        <ToolButton
          title="二级标题"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolButton>
        <ToolButton
          title="三级标题"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolButton>
      </div>

      <div className="toolbar-group">
        <ToolButton
          title="加粗"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </ToolButton>
        <ToolButton
          title="斜体"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          I
        </ToolButton>
        <ToolButton
          title="下划线"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          U
        </ToolButton>
        <ToolButton
          title="删除线"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          S
        </ToolButton>
        <ToolButton
          title="行内代码"
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          {"</>"}
        </ToolButton>
      </div>

      <div className="toolbar-group">
        <ToolButton
          title="引用"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          "
        </ToolButton>
        <ToolButton
          title="无序列表"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          •
        </ToolButton>
        <ToolButton
          title="有序列表"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </ToolButton>
        <ToolButton
          title="任务列表"
          active={editor.isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          ☑
        </ToolButton>
        <ToolButton
          title="代码块"
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          {`{ }`}
        </ToolButton>
      </div>

      <div className="toolbar-group">
        <ToolButton
          title="插入链接"
          onClick={() => {
            const href = window.prompt("输入链接地址");
            if (!href) {
              return;
            }
            editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
          }}
        >
          Link
        </ToolButton>
        <ToolButton title="插入图片" onClick={onInsertImage}>
          Img
        </ToolButton>
        <ToolButton title="插入表格" onClick={onInsertTable}>
          Tbl
        </ToolButton>
      </div>

      <div className="toolbar-group">
        <ToolButton title="仅编辑" active={viewMode === "editor"} onClick={() => onSetViewMode("editor")}>
          Edit
        </ToolButton>
        <ToolButton title="分栏" active={viewMode === "split"} onClick={() => onSetViewMode("split")}>
          Split
        </ToolButton>
        <ToolButton title="仅源码" active={viewMode === "source"} onClick={() => onSetViewMode("source")}>
          Src
        </ToolButton>
        <ToolButton title="仅预览" active={viewMode === "preview"} onClick={() => onSetViewMode("preview")}>
          Preview
        </ToolButton>
      </div>

      <div className="toolbar-group toolbar-actions">
        <ToolButton title="查找替换" onClick={onOpenFind}>
          Find
        </ToolButton>
        <ToolButton title="偏好设置" onClick={onOpenPreferences}>
          Pref
        </ToolButton>
        <ToolButton title="导出 HTML" onClick={onExport}>
          HTML
        </ToolButton>
        <ToolButton title="导出 PDF" onClick={onExportPdf}>
          PDF
        </ToolButton>
      </div>
    </div>
  );
}
