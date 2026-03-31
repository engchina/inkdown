import React from "react";

const themes = [
  { value: "paper", label: "Paper" },
  { value: "forest", label: "Forest" },
  { value: "midnight", label: "Midnight" }
];

export default function PreferencesDialog({ open, preferences, onChange, onClose }) {
  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section className="preferences-dialog" role="dialog" onClick={(event) => event.stopPropagation()}>
        <div className="dialog-header">
          <h2>Preferences</h2>
          <button className="tool-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <label className="pref-row">
          <span>Theme</span>
          <select value={preferences.theme} onChange={(event) => onChange({ theme: event.target.value })}>
            {themes.map((theme) => (
              <option key={theme.value} value={theme.value}>
                {theme.label}
              </option>
            ))}
          </select>
        </label>

        <label className="pref-row">
          <span>Default View</span>
          <select value={preferences.viewMode} onChange={(event) => onChange({ viewMode: event.target.value })}>
            <option value="editor">Editor Only</option>
            <option value="source">Source Only</option>
            <option value="preview">Preview Only</option>
          </select>
        </label>

        <label className="pref-row">
          <span>Font Size</span>
          <input
            type="range"
            min="14"
            max="24"
            value={preferences.fontSize}
            onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
          />
          <strong>{preferences.fontSize}px</strong>
        </label>

        <label className="pref-row">
          <span>Content Width</span>
          <input
            type="range"
            min="720"
            max="1200"
            step="20"
            value={preferences.lineWidth}
            onChange={(event) => onChange({ lineWidth: Number(event.target.value) })}
          />
          <strong>{preferences.lineWidth}px</strong>
        </label>
      </section>
    </div>
  );
}
