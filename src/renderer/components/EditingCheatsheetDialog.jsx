import React from "react";

const sections = [
  {
    title: "Smart Transforms",
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
      "JSON / SQL / YAML / Markdown blocks include language-specific actions"
    ]
  },
  {
    title: "Tables",
    items: [
      "Use visual row/column handles to select ranges",
      "Paste TSV/Excel data into selected cells",
      "Use the table toolbar for merge, split, clear, and alignment"
    ]
  }
];

export default function EditingCheatsheetDialog({ open, onClose }) {
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

        <div className="editing-cheatsheet-grid">
          {sections.map((section) => (
            <section key={section.title} className="editing-cheatsheet-card">
              <h3>{section.title}</h3>
              <div className="editing-cheatsheet-list">
                {section.items.map((item) => (
                  <div key={item}>{item}</div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
