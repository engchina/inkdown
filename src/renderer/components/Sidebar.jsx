import React, { useMemo } from "react";

function matchesFilter(node, keyword) {
  if (!keyword) {
    return true;
  }

  return node.name.toLowerCase().includes(keyword);
}

function filterTree(node, keyword) {
  if (!node) {
    return null;
  }

  if (!keyword) {
    return node;
  }

  if (node.type === "file") {
    return matchesFilter(node, keyword) ? node : null;
  }

  const children = (node.children || [])
    .map((child) => filterTree(child, keyword))
    .filter(Boolean);

  if (children.length > 0 || matchesFilter(node, keyword)) {
    return {
      ...node,
      children
    };
  }

  return null;
}

function FileTreeNode({ node, activeFilePath, onOpenFile, depth = 0 }) {
  if (node.type === "file") {
    return (
      <button
        type="button"
        className={`file-node file-leaf${activeFilePath === node.path ? " active" : ""}`}
        style={{ "--depth": depth }}
        onClick={() => onOpenFile(node.path)}
      >
        <span className="file-node-icon">#</span>
        <span className="file-node-label">{node.name}</span>
      </button>
    );
  }

  return (
    <div className="file-group" style={{ "--depth": depth }}>
      <div className="file-node file-directory">
        <span className="file-node-icon">{depth === 0 ? "Root" : "Dir"}</span>
        <span className="file-node-label">{node.name}</span>
      </div>
      <div className="file-group-children">
        {(node.children || []).map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            activeFilePath={activeFilePath}
            onOpenFile={onOpenFile}
            depth={depth + 1}
          />
        ))}
      </div>
    </div>
  );
}

export default function Sidebar({
  outline,
  activeOutlineId,
  onJumpOutline,
  workspaceRoot,
  workspaceTree,
  activeFilePath,
  onOpenFile,
  onPickWorkspace,
  onRevealCurrentFile,
  sidebarTab,
  onSidebarTabChange,
  filterText,
  onFilterChange
}) {
  const normalizedFilter = filterText.trim().toLowerCase();
  const filteredTree = useMemo(
    () => filterTree(workspaceTree, normalizedFilter),
    [workspaceTree, normalizedFilter]
  );

  return (
    <aside className="sidebar-panel">
      <div className="sidebar-header">
        <div className="sidebar-tabs">
          <button
            type="button"
            className={`sidebar-tab${sidebarTab === "outline" ? " active" : ""}`}
            onClick={() => onSidebarTabChange("outline")}
          >
            Outline
          </button>
          <button
            type="button"
            className={`sidebar-tab${sidebarTab === "files" ? " active" : ""}`}
            onClick={() => onSidebarTabChange("files")}
          >
            Files
          </button>
        </div>

        <div className="sidebar-actions">
          <button type="button" className="tool-button compact" onClick={onPickWorkspace} title="Open Folder">
            Folder
          </button>
          <button
            type="button"
            className="tool-button compact"
            onClick={onRevealCurrentFile}
            title="Reveal Current File in Folder"
          >
            Reveal
          </button>
        </div>
      </div>

      <div className="sidebar-search">
        <input
          className="find-input sidebar-input"
          type="text"
          placeholder={sidebarTab === "files" ? "Filter files" : "Filter headings"}
          value={filterText}
          onChange={(event) => onFilterChange(event.target.value)}
        />
      </div>

      {sidebarTab === "outline" ? (
        <div className="sidebar-content">
          <div className="panel-heading">Outline</div>
          {outline
            .filter((item) => !normalizedFilter || item.text.toLowerCase().includes(normalizedFilter))
            .map((item, index) => (
              <button
                key={item.id}
                className={`outline-item level-${item.level}${activeOutlineId === item.id ? " active" : ""}`}
                type="button"
                onClick={() => onJumpOutline(item, index)}
              >
                {item.text}
              </button>
            ))}
          {outline.length === 0 ? <div className="outline-empty">No headings yet</div> : null}
        </div>
      ) : (
        <div className="sidebar-content">
          <div className="panel-heading">{workspaceRoot || "No folder opened"}</div>
          {filteredTree ? (
            <FileTreeNode node={filteredTree} activeFilePath={activeFilePath} onOpenFile={onOpenFile} />
          ) : (
            <div className="outline-empty">No Markdown files to display</div>
          )}
        </div>
      )}
    </aside>
  );
}
