import React, { useEffect, useMemo, useRef, useState } from "react";

export default function CommandPalette({ items, onClose, onQueryChange, onSelect, open, query, suggestions = [] }) {
  const inputRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scope, setScope] = useState("all");

  useEffect(() => {
    if (!open) {
      return;
    }
    inputRef.current?.focus();
    inputRef.current?.select();
    setSelectedIndex(0);
    setScope("all");
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, items.length, scope]);

  const visibleItems = useMemo(() => {
    if (scope === "all") {
      return items;
    }
    return items.filter((item) => item.kind === scope);
  }, [items, scope]);

  const groupedItems = useMemo(() => {
    const groups = [];
    visibleItems.forEach((item, index) => {
      const lastGroup = groups[groups.length - 1];
      if (!lastGroup || lastGroup.section !== item.section) {
        groups.push({ section: item.section, entries: [{ ...item, index }] });
        return;
      }
      lastGroup.entries.push({ ...item, index });
    });
    return groups;
  }, [visibleItems]);

  const scopeCounts = useMemo(
    () => ({
      all: items.length,
      command: items.filter((item) => item.kind === "command").length,
      file: items.filter((item) => item.kind === "file").length
    }),
    [items]
  );

  if (!open) {
    return null;
  }

  const clampedIndex = visibleItems.length === 0 ? 0 : Math.min(selectedIndex, visibleItems.length - 1);
  const activeItem = visibleItems[clampedIndex] || null;
  const activeDescription = activeItem?.description || (scope === "file" ? "Browse recent and workspace documents." : "Run commands without leaving the keyboard.");
  const visibleSuggestions = scope === "file" ? suggestions.filter((item) => item.kind !== "command") : suggestions;

  function moveSelection(offset) {
    if (visibleItems.length === 0) {
      return;
    }
    setSelectedIndex((current) => (current + offset + visibleItems.length) % visibleItems.length);
  }

  function handleSubmit(index = clampedIndex) {
    const item = visibleItems[index];
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
        <div className="command-palette-topline">
          <div className="dialog-header-copy">
            <div className="dialog-title command-palette-title">Command Palette</div>
            <div className="dialog-caption">Jump to commands, files, and views without leaving the keyboard.</div>
          </div>
        </div>
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

        <div className="command-palette-toolbar">
          <div className="command-palette-scope" role="tablist" aria-label="Command palette scope">
            <button
              type="button"
              className={`command-palette-scope-chip${scope === "all" ? " active" : ""}`}
              onClick={() => setScope("all")}
            >
              All {scopeCounts.all}
            </button>
            <button
              type="button"
              className={`command-palette-scope-chip${scope === "command" ? " active" : ""}`}
              onClick={() => setScope("command")}
            >
              Commands {scopeCounts.command}
            </button>
            <button
              type="button"
              className={`command-palette-scope-chip${scope === "file" ? " active" : ""}`}
              onClick={() => setScope("file")}
            >
              Files {scopeCounts.file}
            </button>
          </div>
          <div className="command-palette-results-meta">
            {query ? `${visibleItems.length} result${visibleItems.length === 1 ? "" : "s"} for "${query}"` : `Browsing ${scope === "all" ? "everything" : scope === "file" ? "files" : "commands"}`}
          </div>
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
              <div className="command-palette-empty-title">{query ? "No exact match yet" : "Nothing in this scope yet"}</div>
              <div className="command-palette-empty-copy">
                {query ? "Try one of these next steps instead of starting over." : "Switch scope or use one of these next steps."}
              </div>
              <div className="command-palette-suggestions">
                {visibleSuggestions.map((item) => (
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
        <div className="command-palette-footer">
          <div className="command-palette-footer-selection">
            {activeItem ? (
              <>
                <span className={`command-palette-badge kind-${activeItem.kind}`}>{activeItem.badge}</span>
                <span className="command-palette-footer-label">{activeItem.label}</span>
                <span className="command-palette-footer-description">{activeDescription}</span>
                {activeItem.shortcut ? <span className="command-palette-item-shortcut">{activeItem.shortcut}</span> : null}
              </>
            ) : (
              <span className="command-palette-footer-description">{activeDescription}</span>
            )}
          </div>
          <span className="command-palette-footer-note">Enter to run, arrows to move, Esc to close.</span>
        </div>
      </section>
    </div>
  );
}
