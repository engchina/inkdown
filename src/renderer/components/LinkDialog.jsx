import React, { useEffect, useState } from "react";

export default function LinkDialog({
  open,
  initialText = "",
  initialUrl = "",
  initialTitle = "",
  allowRemove = false,
  onCancel,
  onRemove,
  onSubmit
}) {
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState(initialUrl);
  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    if (!open) {
      return;
    }
    setText(initialText);
    setUrl(initialUrl);
    setTitle(initialTitle);
  }, [initialText, initialTitle, initialUrl, open]);

  if (!open) {
    return null;
  }

  const canSubmit = Boolean(String(url || "").trim());

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <section className="link-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="dialog-header">
          <div className="dialog-header-copy">
            <h2 className="dialog-title">Insert Link</h2>
            <div className="dialog-caption">Add a URL without leaving the writing flow.</div>
          </div>
          <button className="tool-button" type="button" onClick={onCancel}>
            Close
          </button>
        </div>

        <label className="pref-row">
          <span>Text</span>
          <input
            className="find-input"
            type="text"
            value={text}
            placeholder="Link text"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
            }}
          />
        </label>

        <label className="pref-row">
          <span>URL</span>
          <input
            className="find-input"
            type="text"
            value={url}
            placeholder="https://example.com or #section"
            autoFocus
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSubmit) {
                event.preventDefault();
                onSubmit({ text, url, title });
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
            }}
          />
        </label>

        <label className="pref-row">
          <span>Title</span>
          <input
            className="find-input"
            type="text"
            value={title}
            placeholder="Optional title"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSubmit) {
                event.preventDefault();
                onSubmit({ text, url, title });
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
            }}
          />
        </label>

        <div className="dialog-actions">
          {allowRemove ? (
            <button className="tool-button tool-button-ghost" type="button" onClick={onRemove}>
              Remove Link
            </button>
          ) : null}
          <button className="tool-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="tool-button tool-button-primary" type="button" disabled={!canSubmit} onClick={() => onSubmit({ text, url, title })}>
            Apply Link
          </button>
        </div>
      </section>
    </div>
  );
}

