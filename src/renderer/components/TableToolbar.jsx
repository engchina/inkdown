import React from "react";

export default function TableToolbar({ onAction, selectionCount = 0, visible }) {
  if (!visible) {
    return null;
  }

  const groups = [
    {
      label: "Select",
      actions: [
        { id: "select-row", label: "Row" },
        { id: "select-col", label: "Column" }
      ]
    },
    {
      label: "Rows",
      actions: [
        { id: "add-row-before", label: "+ Before" },
        { id: "add-row-after", label: "+ After" },
        { id: "delete-row", label: "Delete" }
      ]
    },
    {
      label: "Columns",
      actions: [
        { id: "add-col-before", label: "+ Before" },
        { id: "add-col-after", label: "+ After" },
        { id: "delete-col", label: "Delete" }
      ]
    },
    {
      label: "Cells",
      actions: [
        { id: "merge-cells", label: "Merge" },
        { id: "split-cell", label: "Split" },
        { id: "clear-cells", label: "Clear" }
      ]
    },
    {
      label: "Align",
      actions: [
        { id: "align-left", label: "Left" },
        { id: "align-center", label: "Center" },
        { id: "align-right", label: "Right" }
      ]
    },
    {
      label: "Headers",
      actions: [
        { id: "toggle-header", label: "Table" },
        { id: "toggle-header-cell", label: "Cell" },
        { id: "toggle-header-column", label: "Column" }
      ]
    },
    {
      label: "Table",
      tone: "danger",
      actions: [{ id: "delete-table", label: "Delete table" }]
    }
  ];

  return (
    <div className="table-toolbar">
      <div className="table-toolbar-meta">{selectionCount > 1 ? `${selectionCount} cells selected` : "Table tools"}</div>
      {groups.map((group) => (
        <div key={group.label} className={`table-toolbar-group${group.tone ? ` ${group.tone}` : ""}`}>
          <span className="table-toolbar-group-label">{group.label}</span>
          <div className="table-toolbar-group-actions">
            {group.actions.map((action) => (
              <button key={action.id} type="button" className="tool-button" onClick={() => onAction(action.id)}>
                {action.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
