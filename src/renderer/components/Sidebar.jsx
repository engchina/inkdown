import React, { useMemo } from "react";
import PropertiesPanel from "./PropertiesPanel";

function getPathLabel(filePath) {
  return String(filePath || "")
    .split(/[\\/]/)
    .filter(Boolean)
    .pop() || filePath;
}

function countTreeFiles(node) {
  if (!node) {
    return 0;
  }

  if (node.type === "file") {
    return 1;
  }

  return (node.children || []).reduce((total, child) => total + countTreeFiles(child), 0);
}

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
  onCreateDocument,
  onFilterChange,
  onFrontMatterRawChange,
  onJumpOutline,
  onOpenDocument,
  onOpenFile,
  onPickWorkspace,
  onRevealCurrentFile,
  onSidebarTabChange,
  outline,
  recentFiles = [],
  sidebarTab,
  workspaceRoot,
  workspaceTree
}) {
  const normalizedFilter = filterText.trim().toLowerCase();
  const filteredTree = useMemo(() => filterTree(workspaceTree, normalizedFilter), [workspaceTree, normalizedFilter]);
  const filteredOutline = useMemo(
    () => outline.filter((item) => !normalizedFilter || item.text.toLowerCase().includes(normalizedFilter)),
    [outline, normalizedFilter]
  );
  const filteredFileCount = useMemo(() => countTreeFiles(filteredTree), [filteredTree]);
  const fileRootLabel = workspaceRoot ? workspaceRoot.split(/[\\/]/).filter(Boolean).pop() : "No folder opened";
  const hasFrontMatter = Boolean(String(frontMatterRaw || "").trim());
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
      title: "Front Matter",
      caption: hasFrontMatter ? "Document metadata kept in standard YAML front matter" : "Optional metadata for publishing and note workflows",
      badge: hasFrontMatter ? "Ready" : "Optional",
      sectionLabel: "Document metadata"
    }
  };
  const activeTabMeta = tabMeta[sidebarTab];
  const showRecentFiles = sidebarTab === "files" && recentFiles.length > 0;
  const resultBadge =
    sidebarTab === "outline"
      ? `${filteredOutline.length} item${filteredOutline.length === 1 ? "" : "s"}`
      : sidebarTab === "files"
        ? `${filteredFileCount} file${filteredFileCount === 1 ? "" : "s"}`
        : hasFrontMatter
          ? "Metadata ready"
          : "No metadata";

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
            Front Matter
          </button>
        </div>
      </div>

      <div className="sidebar-body">
        <div className="sidebar-meta">
          <div className="sidebar-meta-copy">
            <div className="sidebar-kicker">{sidebarTab === "outline" ? "Outline" : sidebarTab === "files" ? "Files" : "Front matter"}</div>
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
            <span className="sidebar-content-count">{resultBadge}</span>
          </div>

          {sidebarTab === "outline" ? (
            <div className="sidebar-content">
              {filteredOutline.map((item, index) => (
                  <button
                    key={item.id}
                    className={`outline-item level-${item.level}${activeOutlineId === item.id ? " active" : ""}`}
                    type="button"
                    onClick={() => onJumpOutline(item, index)}
                  >
                    {item.text}
                  </button>
                ))}
              {filteredOutline.length === 0 ? (
                <div className="sidebar-empty-state">
                  <div className="sidebar-empty-title">{outline.length === 0 ? "No headings yet" : "No headings match this filter"}</div>
                  <div className="sidebar-empty-copy">
                    {outline.length === 0
                      ? "Add a heading in the editor to build a navigable document map."
                      : "Try a broader heading filter or clear the search to see the full structure."}
                  </div>
                  {filterText ? (
                    <div className="sidebar-empty-actions">
                      <button type="button" className="sidebar-utility-button" onClick={() => onFilterChange("")}>
                        Clear filter
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : sidebarTab === "files" ? (
            <div className="sidebar-content">
              {!workspaceRoot ? (
                <div className="sidebar-launchpad">
                  <div className="sidebar-empty-state">
                    <div className="sidebar-empty-title">Open a writing workspace</div>
                    <div className="sidebar-empty-copy">
                      Browse a folder for project notes, open a single Markdown file, or start a blank draft.
                    </div>
                    <div className="sidebar-empty-actions">
                      <button type="button" className="sidebar-utility-button" onClick={onPickWorkspace}>
                        Open folder
                      </button>
                      <button type="button" className="sidebar-utility-button" onClick={onOpenDocument}>
                        Open document
                      </button>
                      <button type="button" className="sidebar-utility-button" onClick={onCreateDocument}>
                        New document
                      </button>
                    </div>
                  </div>
                  {showRecentFiles ? (
                    <div className="sidebar-recent-block">
                      <div className="sidebar-section-label">Recent documents</div>
                      <div className="sidebar-recent-list">
                        {recentFiles.map((path) => (
                          <button key={path} type="button" className="sidebar-recent-item" onClick={() => onOpenFile(path)}>
                            <span className="sidebar-recent-name">{getPathLabel(path)}</span>
                            <span className="sidebar-recent-path" title={path}>
                              {path}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : filteredTree ? (
                <FileTreeNode node={filteredTree} activeFilePath={activeFilePath} onOpenFile={onOpenFile} />
              ) : (
                <div className="sidebar-empty-state">
                  <div className="sidebar-empty-title">No Markdown files to display</div>
                  <div className="sidebar-empty-copy">
                    {filterText
                      ? "No files match the current filter in this workspace."
                      : "This workspace does not contain visible Markdown files yet."}
                  </div>
                  <div className="sidebar-empty-actions">
                    {filterText ? (
                      <button type="button" className="sidebar-utility-button" onClick={() => onFilterChange("")}>
                        Clear filter
                      </button>
                    ) : null}
                    <button type="button" className="sidebar-utility-button" onClick={onPickWorkspace}>
                      Change folder
                    </button>
                    <button type="button" className="sidebar-utility-button" onClick={onOpenDocument}>
                      Open document
                    </button>
                  </div>
                  {showRecentFiles ? (
                    <div className="sidebar-recent-block compact">
                      <div className="sidebar-section-label">Recent documents</div>
                      <div className="sidebar-recent-list">
                        {recentFiles.map((path) => (
                          <button key={path} type="button" className="sidebar-recent-item" onClick={() => onOpenFile(path)}>
                            <span className="sidebar-recent-name">{getPathLabel(path)}</span>
                            <span className="sidebar-recent-path" title={path}>
                              {path}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
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
