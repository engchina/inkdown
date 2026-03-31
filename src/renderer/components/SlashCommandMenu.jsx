import React from "react";

export default function SlashCommandMenu({ items, onHover, onSelect, position, selectedIndex, visible }) {
  if (!visible) {
    return null;
  }

  return (
    <div className="slash-menu" style={{ top: `${position.top}px`, left: `${position.left}px` }}>
      {items.length > 0 ? (
        <>
          <div className="slash-menu-title">Insert block</div>
          <div className="slash-menu-list">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`slash-menu-item${selectedIndex === index ? " active" : ""}`}
                onMouseEnter={() => onHover(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(item)}
              >
                <span className="slash-menu-badge">{item.badge}</span>
                <span className="slash-menu-copy">
                  <span className="slash-menu-label">{item.label}</span>
                  <span className="slash-menu-description">{item.description}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="slash-menu-empty">No block matches this slash command.</div>
      )}
    </div>
  );
}
