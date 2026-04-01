import React from "react";

const themes = [
  { value: "paper", label: "Paper" },
  { value: "forest", label: "Forest" },
  { value: "midnight", label: "Midnight" }
];

const transformRuleOptions = [
  { key: "heading", label: "Heading" },
  { key: "blockquote", label: "Blockquote" },
  { key: "bulletList", label: "Bullet List" },
  { key: "orderedList", label: "Ordered List" },
  { key: "taskList", label: "Task List" },
  { key: "codeFence", label: "Code Fence" }
];

const sourceRuleOptions = [
  { key: "tabIndent", label: "Tab Indent" },
  { key: "continueList", label: "List Continuation" },
  { key: "autoPair", label: "Auto Pair Symbols" }
];

export default function PreferencesDialog({ open, preferences, onChange, onClose, onOpenCheatsheet }) {
  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section className="preferences-dialog" role="dialog" onClick={(event) => event.stopPropagation()}>
        <div className="dialog-header">
          <div className="dialog-header-copy">
            <h2 className="dialog-title">Preferences</h2>
            <div className="dialog-caption">Tune writing defaults, editing behavior, and reading comfort.</div>
          </div>
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
            <option value="split">Split View</option>
            <option value="source">Source Only</option>
            <option value="preview">Preview Only</option>
          </select>
        </label>

        <label className="pref-row">
          <span>Focus Mode</span>
          <input
            type="checkbox"
            checked={preferences.focusMode}
            onChange={(event) => onChange({ focusMode: event.target.checked })}
          />
        </label>

        <label className="pref-row">
          <span>Typewriter</span>
          <input
            type="checkbox"
            checked={preferences.typewriterMode}
            onChange={(event) => onChange({ typewriterMode: event.target.checked })}
          />
        </label>

        <label className="pref-row">
          <span>Smart Markdown</span>
          <input
            type="checkbox"
            checked={preferences.smartMarkdownTransform}
            onChange={(event) => onChange({ smartMarkdownTransform: event.target.checked })}
          />
        </label>

        <label className="pref-row">
          <span>Transform Hints</span>
          <input
            type="checkbox"
            checked={preferences.smartTransformHints}
            onChange={(event) => onChange({ smartTransformHints: event.target.checked })}
          />
        </label>

        <label className="pref-row">
          <span>Allow HTTP Media</span>
          <input
            type="checkbox"
            checked={Boolean(preferences.allowInsecureRemoteMedia)}
            onChange={(event) => onChange({ allowInsecureRemoteMedia: event.target.checked })}
          />
        </label>

        <section className="preferences-help">
          <h3>Remote Media Policy</h3>
          <div className="preferences-help-grid">
            <div>Default blocks <code>http://</code> images and media inside preview/export.</div>
            <div>Links still open explicitly through the external browser.</div>
            <div>Enable only if your notes depend on insecure remote media hosts.</div>
          </div>
        </section>

        <section className="preferences-group">
          <div className="preferences-group-header">
            <h3>Editor Transforms</h3>
            <button className="tool-button tool-button-ghost" type="button" onClick={onOpenCheatsheet}>
              Cheatsheet
            </button>
          </div>
          <div className="preferences-rule-grid">
            {transformRuleOptions.map((rule) => (
              <label key={rule.key} className="preferences-rule-item">
                <span>{rule.label}</span>
                <input
                  type="checkbox"
                  checked={preferences.smartTransformRules?.[rule.key] ?? true}
                  onChange={(event) =>
                    onChange({
                      smartTransformRules: {
                        ...(preferences.smartTransformRules || {}),
                        [rule.key]: event.target.checked
                      }
                    })
                  }
                />
              </label>
            ))}
          </div>
        </section>

        <section className="preferences-group">
          <div className="preferences-group-header">
            <h3>Source Assist</h3>
          </div>
          <div className="preferences-rule-grid">
            {sourceRuleOptions.map((rule) => (
              <label key={rule.key} className="preferences-rule-item">
                <span>{rule.label}</span>
                <input
                  type="checkbox"
                  checked={preferences.smartTransformSource?.[rule.key] ?? true}
                  onChange={(event) =>
                    onChange({
                      smartTransformSource: {
                        ...(preferences.smartTransformSource || {}),
                        [rule.key]: event.target.checked
                      }
                    })
                  }
                />
              </label>
            ))}
          </div>
        </section>

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

        <section className="preferences-help">
          <h3>Smart Transform Rules</h3>
          <div className="preferences-help-grid">
            <div><code>#</code> + Space {"->"} Heading</div>
            <div><code>&gt;</code> + Space {"->"} Blockquote</div>
            <div><code>-</code> / <code>*</code> + Space {"->"} Bullet List</div>
            <div><code>1.</code> + Space {"->"} Ordered List</div>
            <div><code>- [ ]</code> + Space {"->"} Task List</div>
            <div><code>```</code> + Enter {"->"} Code Block</div>
            <div><code>Esc</code> {"->"} Skip next transform</div>
            <div><code>\#</code> or <code>\```</code> {"->"} Literal Markdown</div>
          </div>
        </section>
      </section>
    </div>
  );
}
