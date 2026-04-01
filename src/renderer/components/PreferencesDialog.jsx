import React from "react";

const themes = [
  { value: "paper", label: "Paper", caption: "Warm paper canvas for long-form drafting." },
  { value: "forest", label: "Forest", caption: "Quiet green contrast for focused note work." },
  { value: "midnight", label: "Midnight", caption: "Low-glare dark surface for evening sessions." }
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

function PreferencesSection({ title, caption, children, className = "" }) {
  return (
    <section className={`preferences-card${className ? ` ${className}` : ""}`}>
      <div className="preferences-card-header">
        <div className="preferences-card-title-row">
          <h3>{title}</h3>
          {caption ? <div className="preferences-card-caption">{caption}</div> : null}
        </div>
      </div>
      <div className="preferences-card-body">{children}</div>
    </section>
  );
}

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

        <section className="preferences-theme-section">
          <div className="preferences-section-header">
            <div>
              <h3>Theme</h3>
              <div className="dialog-caption">Choose the writing surface that fits your session.</div>
            </div>
          </div>
          <div className="preferences-theme-grid">
            {themes.map((theme) => (
              <button
                key={theme.value}
                type="button"
                className={`preferences-theme-card${preferences.theme === theme.value ? " active" : ""}`}
                onClick={() => onChange({ theme: theme.value })}
                aria-pressed={preferences.theme === theme.value}
              >
                <span className={`preferences-theme-preview theme-${theme.value}`} aria-hidden="true">
                  <span className="preferences-theme-preview-bar" />
                  <span className="preferences-theme-preview-body" />
                </span>
                <span className="preferences-theme-copy">
                  <span className="preferences-theme-label">{theme.label}</span>
                  <span className="preferences-theme-caption">{theme.caption}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
        <div className="preferences-layout">
          <PreferencesSection title="Appearance" caption="Tune the canvas and default reading width.">
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
          </PreferencesSection>

          <PreferencesSection title="Writing Modes" caption="Keep the editor quiet and focused when drafting.">
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
          </PreferencesSection>

          <PreferencesSection title="Remote Media Policy" caption="Keep previews and exports safe by default.">
            <label className="pref-row">
              <span>Allow HTTP Media</span>
              <input
                type="checkbox"
                checked={Boolean(preferences.allowInsecureRemoteMedia)}
                onChange={(event) => onChange({ allowInsecureRemoteMedia: event.target.checked })}
              />
            </label>

            <div className="preferences-help-grid compact">
              <div>Default blocks <code>http://</code> images and media inside preview/export.</div>
              <div>Links still open explicitly through the external browser.</div>
              <div>Enable only if your notes depend on insecure remote media hosts.</div>
            </div>
          </PreferencesSection>
        </div>

        <PreferencesSection
          title="Current Session"
          caption="A quick snapshot of the editor defaults you are working with right now."
          className="preferences-session-card"
        >
          <div className="preferences-session-grid">
            <div className="preferences-session-item">
              <span className="preferences-session-label">Theme</span>
              <strong>{themes.find((theme) => theme.value === preferences.theme)?.label || preferences.theme}</strong>
            </div>
            <div className="preferences-session-item">
              <span className="preferences-session-label">View</span>
              <strong>{preferences.viewMode}</strong>
            </div>
            <div className="preferences-session-item">
              <span className="preferences-session-label">Font</span>
              <strong>{preferences.fontSize}px</strong>
            </div>
            <div className="preferences-session-item">
              <span className="preferences-session-label">Width</span>
              <strong>{preferences.lineWidth}px</strong>
            </div>
            <div className="preferences-session-item">
              <span className="preferences-session-label">Focus</span>
              <strong>{preferences.focusMode ? "On" : "Off"}</strong>
            </div>
            <div className="preferences-session-item">
              <span className="preferences-session-label">Typewriter</span>
              <strong>{preferences.typewriterMode ? "On" : "Off"}</strong>
            </div>
          </div>
        </PreferencesSection>

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
