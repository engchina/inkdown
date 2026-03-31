import React from "react";

export default function TableSelectionHandles({ cols = [], onSelectColumn, onSelectRow, rows = [], visible }) {
  if (!visible) {
    return null;
  }

  return (
    <div className="table-selection-handles" aria-hidden="true">
      {cols.map((col) => (
        <button
          key={`col-${col.index}`}
          type="button"
          className="table-handle table-handle-column"
          style={{ left: `${col.left}px`, width: `${col.width}px`, top: `${col.top}px` }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelectColumn(col.index)}
        >
          Col {col.index + 1}
        </button>
      ))}
      {rows.map((row) => (
        <button
          key={`row-${row.index}`}
          type="button"
          className="table-handle table-handle-row"
          style={{ top: `${row.top}px`, height: `${row.height}px`, left: `${row.left}px` }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelectRow(row.index)}
        >
          Row {row.index + 1}
        </button>
      ))}
    </div>
  );
}
