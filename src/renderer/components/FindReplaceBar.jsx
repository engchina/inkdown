import React, { useEffect, useRef } from "react";

export default function FindReplaceBar({
  activePane,
  open,
  query,
  replaceValue,
  count,
  currentIndex,
  onQueryChange,
  onReplaceChange,
  onPrev,
  onNext,
  onReplaceOne,
  onReplaceAll,
  onClose
}) {
  const queryInputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    queryInputRef.current?.focus();
    queryInputRef.current?.select();
  }, [open]);

  if (!open) {
    return null;
  }

  const activePaneLabel =
    activePane === "source" ? "Source" : activePane === "preview" ? "Preview" : "Editor";
  const hasQuery = Boolean(query);
  const hasMatches = count > 0;

  return (
    <div className="find-bar">
      <div className="find-bar-group find-bar-query-group">
        <label className="find-bar-field">
          <span className="find-bar-label">Find</span>
          <input
            ref={queryInputRef}
            className="find-input"
            type="text"
            placeholder="Find in Markdown"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (event.shiftKey) {
                  onPrev();
                  return;
                }
                onNext();
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
          />
        </label>
        <span className={`find-count${count > 0 ? " active" : ""}`}>
          {count === 0 ? "0 results" : `${currentIndex + 1}/${count}`}
        </span>
      </div>

      <div className="find-bar-group find-bar-replace-group">
        <label className="find-bar-field">
          <span className="find-bar-label">Replace</span>
          <input
            className="find-input"
            type="text"
            placeholder="Replace with"
            value={replaceValue}
            onChange={(event) => onReplaceChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onReplaceOne();
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
          />
        </label>
      </div>

      <div className="find-bar-group find-bar-actions">
        <span className="find-count find-scope-chip active">{activePaneLabel}</span>
        <span className="find-count find-shortcut-chip">Enter / Shift+Enter</span>
        <div className="find-bar-action-set">
          <button className="tool-button" type="button" onClick={onPrev} disabled={!hasQuery}>
            Prev
          </button>
          <button className="tool-button" type="button" onClick={onNext} disabled={!hasQuery}>
            Next
          </button>
        </div>
        <div className="find-bar-action-set">
          <button className="tool-button" type="button" onClick={onReplaceOne} disabled={!hasMatches}>
            Replace
          </button>
          <button className="tool-button" type="button" onClick={onReplaceAll} disabled={!hasMatches}>
            Replace All
          </button>
        </div>
        <button className="tool-button tool-button-ghost" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
