import React, { useMemo } from "react";
import PropertiesPanel from "./PropertiesPanel";

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

  const children = (node.children || []).map((child) => filterTree(child, keyword)).filter(Boolean);

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
        <span className="file-node-icon">md</span>
        <span className="file-node-label">{node.name}</span>
      </button>
    );
  }

  return (
    <div className="file-group" style={{ "--depth": depth }}>
      <div className="file-node file-directory">
        <span className="file-node-icon">{depth === 0 ? "root" : "dir"}</span>
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
  activeFilePath,
  activeOutlineId,
  filterText,
  frontMatterRaw,
  onFilterChange,
  onFrontMatterRawChange,
  onJumpOutline,
  onOpenFile,
  onPickWorkspace,
  onRevealCurrentFile,
  onSidebarTabChange,
  outline,
  sidebarTab,
  workspaceRoot,
  workspaceTree
}) {
  const normalizedFilter = filterText.trim().toLowerCase();
  const filteredTree = useMemo(() => filterTree(workspaceTree, normalizedFilter), [workspaceTree, normalizedFilter]);
  const fileRootLabel = workspaceRoot ? workspaceRoot.split(/[\\/]/).filter(Boolean).pop() : "No folder opened";
  const tabMeta = {
    outline: {
      title: "Document map",
      caption: `${outline.length} heading${outline.length === 1 ? "" : "s"} in this document`,
      badge: String(outline.length),
      sectionLabel: "Filter headings"
    },
    files: {
      title: fileRootLabel,
      caption: workspaceRoot ? workspaceRoot : "Open a folder to browse Markdown files",
      badge: workspaceRoot ? "Workspace" : "Folder",
      sectionLabel: "Filter files"
    },
    properties: {
      title: "Properties",
      caption: "Front matter and document metadata",
      badge: "YAML",
      sectionLabel: "Metadata"
    }
  };
  const activeTabMeta = tabMeta[sidebarTab];

  return (
    <aside className="sidebar-panel">
      <div className="sidebar-header">
        <div className="sidebar-tabs" role="tablist" aria-label="Sidebar views">
          <button
            type="button"
            className={`sidebar-tab${sidebarTab === "outline" ? " active" : ""}`}
            onClick={() => onSidebarTabChange("outline")}
            aria-selected={sidebarTab === "outline"}
          >
            Outline
          </button>
          <button
            type="button"
            className={`sidebar-tab${sidebarTab === "files" ? " active" : ""}`}
            onClick={() => onSidebarTabChange("files")}
            aria-selected={sidebarTab === "files"}
          >
            Files
          </button>
          <button
            type="button"
            className={`sidebar-tab${sidebarTab === "properties" ? " active" : ""}`}
            onClick={() => onSidebarTabChange("properties")}
            aria-selected={sidebarTab === "properties"}
          >
            Properties
          </button>
        </div>
      </div>

      <div className="sidebar-body">
        <div className="sidebar-meta">
          <div className="sidebar-meta-copy">
            <div className="sidebar-kicker">{sidebarTab === "outline" ? "Outline" : sidebarTab === "files" ? "Files" : "Properties"}</div>
            <div className="sidebar-title-row">
              <div className="sidebar-title">{activeTabMeta.title}</div>
              <span className="sidebar-badge">{activeTabMeta.badge}</span>
            </div>
            <div className="sidebar-caption">{activeTabMeta.caption}</div>
          </div>

          <div className="sidebar-utility-actions">
            {sidebarTab === "files" ? (
              <button type="button" className="sidebar-utility-button" onClick={onPickWorkspace}>
                {workspaceRoot ? "Change folder" : "Open folder"}
              </button>
            ) : null}
            {activeFilePath ? (
              <button type="button" className="sidebar-utility-button" onClick={onRevealCurrentFile}>
                Reveal file
              </button>
            ) : null}
          </div>
        </div>

        {sidebarTab !== "properties" ? (
          <label className="sidebar-search" htmlFor={`sidebar-filter-${sidebarTab}`}>
            <span className="sidebar-section-label">{activeTabMeta.sectionLabel}</span>
            <input
              id={`sidebar-filter-${sidebarTab}`}
              className="find-input sidebar-input"
              type="text"
              placeholder={sidebarTab === "files" ? "Search by file name" : "Search by heading text"}
              value={filterText}
              onChange={(event) => onFilterChange(event.target.value)}
            />
          </label>
        ) : null}

        <div className="sidebar-content-shell">
          <div className="sidebar-content-header">
            <div className="sidebar-section-label">{sidebarTab === "properties" ? activeTabMeta.sectionLabel : "Results"}</div>
            {sidebarTab === "outline" ? (
              <span className="sidebar-content-count">
                {outline.length} item{outline.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>

          {sidebarTab === "outline" ? (
            <div className="sidebar-content">
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
          ) : sidebarTab === "files" ? (
            <div className="sidebar-content">
              {filteredTree ? (
                <FileTreeNode node={filteredTree} activeFilePath={activeFilePath} onOpenFile={onOpenFile} />
              ) : (
                <div className="outline-empty">No Markdown files to display</div>
              )}
            </div>
          ) : (
            <div className="sidebar-content">
              <PropertiesPanel
                rawFrontMatter={frontMatterRaw}
                onRawChange={onFrontMatterRawChange}
              />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
