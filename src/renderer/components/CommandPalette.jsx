import React, { useEffect, useMemo, useRef, useState } from "react";

export default function CommandPalette({ items, onClose, onQueryChange, onSelect, open, query, suggestions = [] }) {
  const inputRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }
    inputRef.current?.focus();
    inputRef.current?.select();
    setSelectedIndex(0);
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, items.length]);

  const groupedItems = useMemo(() => {
    const groups = [];
    items.forEach((item, index) => {
      const lastGroup = groups[groups.length - 1];
      if (!lastGroup || lastGroup.section !== item.section) {
        groups.push({ section: item.section, entries: [{ ...item, index }] });
        return;
      }
      lastGroup.entries.push({ ...item, index });
    });
    return groups;
  }, [items]);

  if (!open) {
    return null;
  }

  const clampedIndex = items.length === 0 ? 0 : Math.min(selectedIndex, items.length - 1);

  function moveSelection(offset) {
    if (items.length === 0) {
      return;
    }
    setSelectedIndex((current) => (current + offset + items.length) % items.length);
  }

  function handleSubmit(index = clampedIndex) {
    const item = items[index];
    if (!item) {
      return;
    }
    onSelect(item);
  }

  return (
    <div className="command-palette-backdrop" role="presentation" onClick={onClose}>
      <section
        className="command-palette"
        role="dialog"
        aria-label="Command palette"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="command-palette-header">
          <input
            ref={inputRef}
            className="command-palette-input"
            type="text"
            placeholder="Search commands, files, and views"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                moveSelection(1);
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                moveSelection(-1);
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                handleSubmit();
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
          />
          <button className="tool-button tool-button-ghost" type="button" onClick={onClose}>
            Esc
          </button>
        </div>

        <div className="command-palette-results">
          {groupedItems.length > 0 ? (
            groupedItems.map((group) => (
              <div key={group.section} className="command-palette-group">
                <div className="command-palette-group-title">{group.section}</div>
                {group.entries.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`command-palette-item${item.index === clampedIndex ? " active" : ""}`}
                    onMouseEnter={() => setSelectedIndex(item.index)}
                    onClick={() => handleSubmit(item.index)}
                  >
                    <div className="command-palette-item-main">
                      <span className={`command-palette-badge kind-${item.kind}`}>{item.badge}</span>
                      <span className="command-palette-item-label">{item.label}</span>
                    </div>
                    <div className="command-palette-item-meta">
                      {item.description ? <span className="command-palette-item-description">{item.description}</span> : null}
                      {item.shortcut ? <span className="command-palette-item-shortcut">{item.shortcut}</span> : null}
                    </div>
                  </button>
                ))}
              </div>
            ))
          ) : (
            <div className="command-palette-empty">
              <div className="command-palette-empty-title">No exact match yet</div>
              <div className="command-palette-empty-copy">
                Try one of these next steps instead of starting over.
              </div>
              <div className="command-palette-suggestions">
                {suggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="command-palette-suggestion"
                    onClick={() => onSelect(item)}
                  >
                    <span className="command-palette-badge kind-command">{item.badge}</span>
                    <span className="command-palette-suggestion-body">
                      <span className="command-palette-item-label">{item.label}</span>
                      <span className="command-palette-item-description">{item.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
