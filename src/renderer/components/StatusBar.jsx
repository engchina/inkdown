import React, { useMemo, useState } from "react";
import { Columns2, Eye, FileCode2, PenSquare } from "lucide-react";

export default function StatusBar({
  activePane,
  lineCount,
  wordCount,
  charCount,
  readingMinutes,
  sidebarVisible,
  viewMode,
  statusMessage,
  statusKind,
  findSummary,
  positionSummary,
  onSetViewMode,
  onToggleSidebar,
  onDisableHints
}) {
  const [metricIndex, setMetricIndex] = useState(0);
  const metrics = useMemo(
    () => [
      { label: `${wordCount} words`, detail: `Words ${wordCount}` },
      { label: `${charCount} chars`, detail: `Characters ${charCount}` },
      { label: `${lineCount} lines`, detail: `Lines ${lineCount}` },
      { label: `${readingMinutes} min read`, detail: `Read time ${readingMinutes} min` }
    ],
    [charCount, lineCount, readingMinutes, wordCount]
  );

  const activeMetric = metrics[metricIndex % metrics.length];
  const metricSummary = metrics.map((item) => item.detail).join(" • ");
  const showTransientStatus = statusMessage && statusMessage !== "Ready";
  const isHint = statusKind === "hint";
  const statusLabel = showTransientStatus ? statusMessage : "Ready";
  const activePaneLabel =
    activePane === "source" ? "Source Focus" : activePane === "preview" ? "Preview Focus" : "Editor Focus";
  const viewItems = [
    { id: "editor", label: "Editor", icon: PenSquare },
    { id: "split", label: "Split", icon: Columns2 },
    { id: "source", label: "Source", icon: FileCode2 },
    { id: "preview", label: "Preview", icon: Eye }
  ];

  return (
    <footer className="status-bar">
      <div className={`status-bar-section status-bar-main${isHint ? " is-hint" : ""}`}>
        <button
          type="button"
          className={`status-sidebar-toggle${sidebarVisible ? " is-active" : ""}`}
          aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
          title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
          onClick={onToggleSidebar}
        >
          <span className={`status-sidebar-icon${sidebarVisible ? " is-split" : " is-collapsed"}`} aria-hidden="true">
            <span className="status-sidebar-icon-rail" />
            <span className="status-sidebar-icon-main" />
          </span>
        </button>
        <span className={`status-meta-item status-state${showTransientStatus ? " is-active" : ""}`}>{statusLabel}</span>
        <div className="status-view-switch" role="tablist" aria-label="View mode">
          {viewItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`status-view-button${viewMode === item.id ? " active" : ""}`}
                title={item.label}
                aria-label={item.label}
                aria-pressed={viewMode === item.id}
                onClick={() => onSetViewMode(item.id)}
              >
                <Icon size={14} strokeWidth={2} />
              </button>
            );
          })}
        </div>
        {isHint ? (
          <button type="button" className="status-hint-dismiss" onClick={onDisableHints}>
            Hide hints
          </button>
        ) : null}
      </div>

      <div className="status-bar-section status-bar-meta">
        {findSummary ? <span className="status-meta-item status-pill">Find {findSummary}</span> : null}
        <span className="status-meta-item status-pill status-pill-active">{activePaneLabel}</span>
        {positionSummary ? <span className="status-meta-item status-pill position">{positionSummary}</span> : null}
        <button
          type="button"
          className="status-metric-button status-pill"
          title={`${metricSummary}\nClick to cycle metrics`}
          onClick={() => setMetricIndex((current) => (current + 1) % metrics.length)}
        >
          {activeMetric.label}
        </button>
      </div>
    </footer>
  );
}
