import React, { useMemo, useState } from "react";

export default function StatusBar({
  documentTitle,
  isDirty,
  lineCount,
  wordCount,
  charCount,
  readingMinutes,
  viewMode,
  statusMessage,
  findSummary
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
  const viewModeLabel =
    {
      editor: "Editor",
      split: "Split",
      preview: "Preview",
      source: "Source"
    }[viewMode] || viewMode;
  const showTransientStatus = statusMessage && statusMessage !== "Ready";

  return (
    <footer className="status-bar">
      <div className="status-bar-section status-bar-main">
        <span className="status-title" title={documentTitle}>
          {documentTitle}
        </span>
        <span className={`status-indicator${isDirty ? " dirty" : ""}`}>
          {isDirty ? "Unsaved" : "Saved"}
        </span>
        {showTransientStatus ? (
          <span className="status-message" title={statusMessage}>
            {statusMessage}
          </span>
        ) : null}
      </div>

      <div className="status-bar-section status-bar-meta">
        {findSummary ? <span className="status-meta-item">Find {findSummary}</span> : null}
        <span className="status-meta-item">{viewModeLabel}</span>
        <button
          type="button"
          className="status-metric-button"
          title={`${metricSummary}\nClick to cycle metrics`}
          onClick={() => setMetricIndex((current) => (current + 1) % metrics.length)}
        >
          {activeMetric.label}
        </button>
        {!showTransientStatus ? <span className="status-meta-item">Ready</span> : null}
      </div>
    </footer>
  );
}
