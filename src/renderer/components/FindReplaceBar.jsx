import React, { useEffect, useRef } from "react";

export default function FindReplaceBar({
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

  return (
    <div className="find-bar">
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
      <span className="find-count">
        {count === 0 ? "0 results" : `${currentIndex + 1}/${count}`}
      </span>
      <button className="tool-button" type="button" onClick={onPrev}>
        Prev
      </button>
      <button className="tool-button" type="button" onClick={onNext}>
        Next
      </button>
      <button className="tool-button" type="button" onClick={onReplaceOne}>
        Replace
      </button>
      <button className="tool-button" type="button" onClick={onReplaceAll}>
        All
      </button>
      <button className="tool-button" type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
