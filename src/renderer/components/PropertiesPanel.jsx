import React from "react";

function formatFieldValue(field) {
  if (field.type === "list") {
    return field.value.join(", ");
  }
  return field.value;
}

export default function PropertiesPanel({
  fields,
  isEditable,
  rawFrontMatter,
  onAddField,
  onRemoveField,
  onUpdateField
}) {
  if (!isEditable) {
    return (
      <div className="properties-panel">
        <div className="properties-empty-title">Complex front matter detected</div>
        <div className="properties-empty-copy">
          This document uses YAML that is richer than the inline property editor supports. Edit it in Source mode to keep
          the structure intact.
        </div>
        <pre className="properties-raw-preview">
          <code>{rawFrontMatter || "No front matter found."}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="properties-panel">
      <div className="properties-toolbar">
        <div>
          <div className="panel-heading">Metadata</div>
          <div className="sidebar-caption">Edit front matter without dropping into raw YAML.</div>
        </div>
        <button className="tool-button" type="button" onClick={onAddField}>
          Add
        </button>
      </div>

      {fields.length > 0 ? (
        <div className="properties-grid">
          {fields.map((field, index) => (
            <div key={field.id} className="property-row">
              <input
                className="find-input property-key-input"
                type="text"
                placeholder="Property"
                value={field.key}
                onChange={(event) => onUpdateField(index, { key: event.target.value })}
              />
              <select
                value={field.type}
                onChange={(event) => onUpdateField(index, { type: event.target.value })}
              >
                <option value="text">Text</option>
                <option value="list">List</option>
              </select>
              <input
                className="find-input property-value-input"
                type="text"
                placeholder={field.type === "list" ? "value, value" : "Value"}
                value={formatFieldValue(field)}
                onChange={(event) => onUpdateField(index, { value: event.target.value })}
              />
              <button className="tool-button tool-button-ghost" type="button" onClick={() => onRemoveField(index)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="properties-empty-state">
          <div className="properties-empty-title">No properties yet</div>
          <div className="properties-empty-copy">Add title, tags, aliases, or any simple front matter field here.</div>
        </div>
      )}
    </div>
  );
}
