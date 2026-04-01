import React, { useMemo } from "react";
import { Braces, Files, ListTree } from "lucide-react";
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
  const activeFileLabel = activeFilePath ? getPathLabel(activeFilePath) : "No document selected";
  const hasFrontMatter = Boolean(String(frontMatterRaw || "").trim());
  const frontMatterLineCount = useMemo(
    () =>
      hasFrontMatter
        ? String(frontMatterRaw)
            .split(/\r?\n/)
            .filter((line) => line.trim()).length
        : 0,
    [frontMatterRaw, hasFrontMatter]
  );
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
    },
    properties: {
      eyebrow: "Metadata health",
      title: hasFrontMatter ? "Structured front matter is available" : "No front matter in this draft",
      copy: hasFrontMatter
        ? `${frontMatterLineCount} populated YAML line${frontMatterLineCount === 1 ? "" : "s"} ready for previews, exports, and publishing flows.`
        : "Add YAML front matter to keep publishing metadata, summaries, and custom fields close to the draft."
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
        ],
    properties: [
      { value: hasFrontMatter ? "YAML" : "None", label: "Status" },
      { value: frontMatterLineCount, label: "Lines" }
    ]
  };
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
            <ListTree size={14} strokeWidth={2} />
            <span>Outline</span>
          </button>
          <button
            type="button"
            className={`sidebar-tab${sidebarTab === "files" ? " active" : ""}`}
            onClick={() => onSidebarTabChange("files")}
            aria-selected={sidebarTab === "files"}
          >
            <Files size={14} strokeWidth={2} />
            <span>Files</span>
          </button>
          <button
            type="button"
            className={`sidebar-tab${sidebarTab === "properties" ? " active" : ""}`}
            onClick={() => onSidebarTabChange("properties")}
            aria-selected={sidebarTab === "properties"}
          >
            <Braces size={14} strokeWidth={2} />
            <span>Front Matter</span>
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

          <div className="sidebar-stat-row">
            {tabStats[sidebarTab].map((item) => (
              <div key={`${sidebarTab}-${item.label}`} className="sidebar-stat-card">
                <span className="sidebar-stat-value">{item.value}</span>
                <span className="sidebar-stat-label">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="sidebar-spotlight-card">
            <div className="sidebar-spotlight-eyebrow">{tabSpotlight[sidebarTab].eyebrow}</div>
            <div className="sidebar-spotlight-title" title={tabSpotlight[sidebarTab].title}>
              {tabSpotlight[sidebarTab].title}
            </div>
            <div className="sidebar-spotlight-copy">{tabSpotlight[sidebarTab].copy}</div>
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
          ) : sidebarTab === "files" ? (
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
