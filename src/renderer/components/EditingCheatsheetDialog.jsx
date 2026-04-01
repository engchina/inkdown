import React, { useMemo, useState } from "react";

const sections = [
  {
    title: "Editor Transforms",
    items: [
      "# + Space -> Heading",
      "> + Space -> Blockquote",
      "- / * + Space -> Bullet List",
      "1. + Space -> Ordered List",
      "- [ ] + Space -> Task List",
      "``` + Enter -> Code Block"
    ]
  },
  {
    title: "Source Assist",
    items: [
      "Tab / Shift+Tab indent or outdent selected lines",
      "Enter continues lists and blockquotes",
      "Auto pair symbols when typing inline markdown"
    ]
  },
  {
    title: "Literal Markdown",
    items: [
      "Esc skips the next smart transform",
      "\\# inserts a literal heading marker",
      "\\``` inserts a literal code fence"
    ]
  },
  {
    title: "Code Blocks",
    items: [
      "Choose language from the toolbar",
      "Copy / Collapse / Preview tools live on the block",
      "JSON / SQL / YAML / Markdown blocks include language-specific actions",
      "Mermaid, Markdown, and HTML blocks can render previews"
    ]
  },
  {
    title: "Tables",
    items: [
      "Use visual row/column handles to select ranges",
      "Paste TSV/Excel data into selected cells",
      "Use the table toolbar for merge, split, clear, and alignment"
    ]
  },
  {
    title: "Front Matter",
    items: [
      "Use Front Matter to edit title, tags, date, and draft state",
      "Open Additional fields when a note needs less common metadata",
      "Turn on advanced controls only when you need type changes or field ordering",
      "Use each field's row menu for remove and move actions",
      "Paste comma- or newline-separated tags to add several at once, and jump straight to YAML error lines when parsing fails",
      "Use merge dialog when pasted front matter conflicts with the current document"
    ]
  }
];

export default function EditingCheatsheetDialog({ open, onClose }) {
  const [query, setQuery] = useState("");
  const filteredSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return sections;
    }
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => `${section.title} ${item}`.toLowerCase().includes(normalizedQuery))
      }))
      .filter((section) => section.items.length > 0);
  }, [query]);

  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section className="editing-cheatsheet-dialog" role="dialog" onClick={(event) => event.stopPropagation()}>
        <div className="dialog-header">
          <div>
            <h2>Editing Cheatsheet</h2>
            <div className="sidebar-caption">Shortcuts, transforms, and editing behavior in one place.</div>
          </div>
          <button className="tool-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <input
          className="find-input editing-cheatsheet-search"
          type="text"
          placeholder="Search transforms, shortcuts, and behaviors"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className="editing-cheatsheet-grid">
          {filteredSections.map((section) => (
            <section key={section.title} className="editing-cheatsheet-card">
              <h3>{section.title}</h3>
              <div className="editing-cheatsheet-list">
                {section.items.map((item) => (
                  <div key={item}>{item}</div>
                ))}
              </div>
            </section>
          ))}
          {filteredSections.length === 0 ? <div className="editing-cheatsheet-empty">No help items match that query.</div> : null}
        </div>
      </section>
    </div>
  );
}
