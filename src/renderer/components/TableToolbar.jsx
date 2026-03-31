import React from "react";

export default function TableToolbar({ onAction, selectionCount = 0, visible }) {
  if (!visible) {
    return null;
  }

  const actions = [
    { id: "add-row-before", label: "Row +" },
    { id: "add-row-after", label: "Row below" },
    { id: "delete-row", label: "Delete row" },
    { id: "add-col-before", label: "Col +" },
    { id: "add-col-after", label: "Col right" },
    { id: "delete-col", label: "Delete col" },
    { id: "merge-cells", label: "Merge" },
    { id: "split-cell", label: "Split" },
    { id: "align-left", label: "Left" },
    { id: "align-center", label: "Center" },
    { id: "align-right", label: "Right" },
    { id: "toggle-header", label: "Header" },
    { id: "toggle-header-cell", label: "Header cell" },
    { id: "toggle-header-column", label: "Header col" },
    { id: "delete-table", label: "Delete table" }
  ];

  return (
    <div className="table-toolbar">
      <div className="table-toolbar-meta">{selectionCount > 1 ? `${selectionCount} cells selected` : "Table tools"}</div>
      {actions.map((action) => (
        <button key={action.id} type="button" className="tool-button" onClick={() => onAction(action.id)}>
          {action.label}
        </button>
      ))}
    </div>
  );
}
