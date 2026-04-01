import React, { useMemo } from "react";
import { Files, ListTree } from "lucide-react";

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

function EmptyStateCard({ eyebrow, title, copy, actions = [], tone = "default" }) {
  return (
    <div className={`sidebar-empty-state sidebar-empty-state-${tone}`}>
      {eyebrow ? <div className="sidebar-empty-eyebrow">{eyebrow}</div> : null}
      <div className="sidebar-empty-title">{title}</div>
      <div className="sidebar-empty-copy">{copy}</div>
      {actions.length ? (
        <div className="sidebar-empty-actions">
          {actions.map((action) => (
            <button key={action.label} type="button" className="sidebar-utility-button" onClick={action.onClick}>
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function Sidebar({
  activeFilePath,
  activeOutlineId,
  filterText,
  onCreateDocument,
  onFilterChange,
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
  const activeFileLabel = activeFilePath ? getPathLabel(activeFilePath) : "No document selected";
  const activeTab = sidebarTab === "files" ? "files" : "outline";
  const showRecentFiles = activeTab === "files" && recentFiles.length > 0;
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
    }
  };
  const tabSpotlight = {
    outline: {
      eyebrow: "Current draft",
      title: activeFileLabel,
      copy: normalizedFilter
        ? `Filtering headings for "${filterText.trim()}".`
        : "Use headings to move through long documents without leaving the writing flow."
    },
    files: {
      eyebrow: workspaceRoot ? "Workspace root" : "Workspace",
      title: workspaceRoot || "Open a folder to browse Markdown files",
      copy: workspaceRoot
        ? activeFilePath
          ? `Current file: ${activeFileLabel}`
          : "Choose a Markdown file from the workspace tree or open a recent draft."
        : "Inkdown works best with a focused folder of notes, drafts, and reference material."
    }
  };
  const tabStats = {
    outline: [
      { value: filteredOutline.length, label: "Visible" },
      { value: outline.length, label: "Headings" }
    ],
    files: workspaceRoot
      ? [
          { value: filteredFileCount, label: "Files" },
          { value: recentFiles.length, label: "Recent" }
        ]
      : [
          { value: recentFiles.length, label: "Recent" },
          { value: 3, label: "Quick starts" }
        ]
  };
  const resultBadge =
    activeTab === "outline"
      ? `${filteredOutline.length} item${filteredOutline.length === 1 ? "" : "s"}`
      : `${filteredFileCount} file${filteredFileCount === 1 ? "" : "s"}`;

  return (
    <aside className="sidebar-panel">
      <div className="sidebar-header">
        <div className="sidebar-tabs" role="tablist" aria-label="Sidebar views">
          <button
            type="button"
            className={`sidebar-tab${activeTab === "outline" ? " active" : ""}`}
            onClick={() => onSidebarTabChange("outline")}
            aria-selected={activeTab === "outline"}
          >
            <ListTree size={14} strokeWidth={2} />
            <span>Outline</span>
          </button>
          <button
            type="button"
            className={`sidebar-tab${activeTab === "files" ? " active" : ""}`}
            onClick={() => onSidebarTabChange("files")}
            aria-selected={activeTab === "files"}
          >
            <Files size={14} strokeWidth={2} />
            <span>Files</span>
          </button>
        </div>
      </div>

      <div className="sidebar-body">
        <div className="sidebar-meta">
          <div className="sidebar-meta-copy">
            <div className="sidebar-kicker">{activeTab === "outline" ? "Outline" : "Files"}</div>
            <div className="sidebar-title-row">
              <div className="sidebar-title">{tabMeta[activeTab].title}</div>
              <span className="sidebar-badge">{tabMeta[activeTab].badge}</span>
            </div>
            <div className="sidebar-caption">{tabMeta[activeTab].caption}</div>
          </div>

          <div className="sidebar-stat-row">
            {tabStats[activeTab].map((item) => (
              <div key={`${activeTab}-${item.label}`} className="sidebar-stat-card">
                <span className="sidebar-stat-value">{item.value}</span>
                <span className="sidebar-stat-label">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="sidebar-spotlight-card">
            <div className="sidebar-spotlight-eyebrow">{tabSpotlight[activeTab].eyebrow}</div>
            <div className="sidebar-spotlight-title" title={tabSpotlight[activeTab].title}>
              {tabSpotlight[activeTab].title}
            </div>
            <div className="sidebar-spotlight-copy">{tabSpotlight[activeTab].copy}</div>
          </div>

          <div className="sidebar-utility-actions">
            {activeTab === "files" ? (
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

        <label className="sidebar-search" htmlFor={`sidebar-filter-${activeTab}`}>
          <span className="sidebar-section-label">{tabMeta[activeTab].sectionLabel}</span>
          <input
            id={`sidebar-filter-${activeTab}`}
            className="find-input sidebar-input"
            type="text"
            placeholder={activeTab === "files" ? "Search by file name" : "Search by heading text"}
            value={filterText}
            onChange={(event) => onFilterChange(event.target.value)}
          />
        </label>

        <div className="sidebar-content-shell">
          <div className="sidebar-content-header">
            <div className="sidebar-section-label">Results</div>
            <span className="sidebar-content-count">{resultBadge}</span>
          </div>

          {activeTab === "outline" ? (
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
                <EmptyStateCard
                  eyebrow={outline.length === 0 ? "Structure" : "Filter"}
                  title={outline.length === 0 ? "No headings yet" : "No headings match this filter"}
                  copy={
                    outline.length === 0
                      ? "Start with a title and a few section headings. Inkdown will turn them into a live outline for faster navigation."
                      : "Try a broader heading filter or clear the search to bring the full document map back."
                  }
                  actions={
                    filterText
                      ? [
                          {
                            label: "Clear filter",
                            onClick: () => onFilterChange("")
                          }
                        ]
                      : []
                  }
                />
              ) : null}
            </div>
          ) : (
            <div className="sidebar-content">
              {!workspaceRoot ? (
                <div className="sidebar-launchpad">
                  <EmptyStateCard
                    eyebrow="Workspace"
                    tone="hero"
                    title="Open a writing workspace"
                    copy="Bring in a folder of notes, open a single Markdown document, or start a clean draft and build from there."
                    actions={[
                      { label: "Open folder", onClick: onPickWorkspace },
                      { label: "Open document", onClick: onOpenDocument },
                      { label: "New document", onClick: onCreateDocument }
                    ]}
                  />
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
                <>
                  <EmptyStateCard
                    eyebrow={filterText ? "Filter" : "Workspace"}
                    title="No Markdown files to display"
                    copy={
                      filterText
                        ? "No files match the current filter in this workspace."
                        : "This workspace does not contain visible Markdown files yet. Open a draft or switch folders to keep moving."
                    }
                    actions={[
                      ...(filterText
                        ? [
                            {
                              label: "Clear filter",
                              onClick: () => onFilterChange("")
                            }
                          ]
                        : []),
                      { label: "Change folder", onClick: onPickWorkspace },
                      { label: "Open document", onClick: onOpenDocument }
                    ]}
                  />
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
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
