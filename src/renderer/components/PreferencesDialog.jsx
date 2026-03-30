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
          <h2>偏好设置</h2>
          <button className="tool-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <label className="pref-row">
          <span>主题</span>
          <select value={preferences.theme} onChange={(event) => onChange({ theme: event.target.value })}>
            {themes.map((theme) => (
              <option key={theme.value} value={theme.value}>
                {theme.label}
              </option>
            ))}
          </select>
        </label>

        <label className="pref-row">
          <span>默认视图</span>
          <select value={preferences.viewMode} onChange={(event) => onChange({ viewMode: event.target.value })}>
            <option value="editor">仅编辑</option>
            <option value="split">分栏</option>
            <option value="source">仅源码</option>
            <option value="preview">仅预览</option>
          </select>
        </label>

        <label className="pref-row">
          <span>字体大小</span>
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
          <span>正文宽度</span>
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
