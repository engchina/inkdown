import React from "react";

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
  if (!open) {
    return null;
  }

  return (
    <div className="find-bar">
      <input
        className="find-input"
        type="text"
        placeholder="查找 Markdown 文本"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <input
        className="find-input"
        type="text"
        placeholder="替换为"
        value={replaceValue}
        onChange={(event) => onReplaceChange(event.target.value)}
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
