import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

const VIEWPORT_MARGIN = 16;
const FALLBACK_MENU_HEIGHT = 160;

export default function SlashCommandMenu({ items, onHover, onSelect, position, selectedIndex, visible }) {
  const menuRef = useRef(null);
  const [layout, setLayout] = useState({ top: position.top, left: position.left, maxHeight: null });

  function updateLayout() {
    const menu = menuRef.current;
    if (!(menu instanceof HTMLElement)) {
      return;
    }

    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const availableHeight = Math.max(0, viewportHeight - VIEWPORT_MARGIN * 2);
    const width = rect.width || 340;
    const naturalHeight = rect.height || FALLBACK_MENU_HEIGHT;
    const renderedHeight = Math.min(naturalHeight, availableHeight || naturalHeight);
    const maxLeft = Math.max(VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN);
    const maxTop = Math.max(VIEWPORT_MARGIN, viewportHeight - renderedHeight - VIEWPORT_MARGIN);

    const nextLayout = {
      left: Math.min(Math.max(position.left, VIEWPORT_MARGIN), maxLeft),
      top: Math.min(Math.max(position.top, VIEWPORT_MARGIN), maxTop),
      maxHeight: availableHeight || null
    };

    setLayout((current) =>
      current.top === nextLayout.top && current.left === nextLayout.left && current.maxHeight === nextLayout.maxHeight
        ? current
        : nextLayout
    );
  }

  useLayoutEffect(() => {
    if (!visible) {
      return;
    }
    updateLayout();
  }, [items.length, position.left, position.top, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, [position.left, position.top, visible]);

  if (!visible) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="slash-menu"
      style={{ top: `${layout.top}px`, left: `${layout.left}px`, maxHeight: layout.maxHeight ? `${layout.maxHeight}px` : undefined }}
    >
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
