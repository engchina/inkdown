import React from "react";
import * as yaml from "js-yaml";

function wrapYaml(raw) {
  const normalized = String(raw || "").trim();
  return normalized ? `---\n${normalized}\n---\n\n` : "";
}

function parseScalar(value) {
  const text = String(value ?? "");
  if (text === "true") return true;
  if (text === "false") return false;
  if (text === "null") return null;
  if (text !== "" && !Number.isNaN(Number(text))) return Number(text);
  return text;
}

function dumpYaml(value) {
  return wrapYaml(yaml.dump(value || {}, { lineWidth: 100, noRefs: true }).trim());
}

function cloneValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function updateAtPath(value, path, updater) {
  if (path.length === 0) {
    return updater(cloneValue(value));
  }
  const [head, ...rest] = path;
  const base = Array.isArray(value) ? [...value] : { ...(value || {}) };
  base[head] = updateAtPath(base[head], rest, updater);
  return base;
}

function removeAtPath(value, path) {
  if (path.length === 0) {
    return value;
  }
  const [head, ...rest] = path;
  if (Array.isArray(value)) {
    const base = [...value];
    if (rest.length === 0) {
      base.splice(Number(head), 1);
      return base;
    }
    base[head] = removeAtPath(base[head], rest);
    return base;
  }
  const base = { ...(value || {}) };
  if (rest.length === 0) {
    delete base[head];
    return base;
  }
  base[head] = removeAtPath(base[head], rest);
  return base;
}

function TreeEditor({ editable = false, onChange, path = [], value }) {
  if (Array.isArray(value)) {
    return (
      <div className="front-matter-tree-node" style={{ "--depth": path.length }}>
        <div className="front-matter-tree-children">
          {value.map((item, index) => (
            <div key={`${path.join(".")}-${index}`} className="front-matter-tree-row">
              <div className="front-matter-tree-key">[{index}]</div>
              <TreeEditor editable={editable} onChange={onChange} path={[...path, index]} value={item} />
              {editable ? (
                <button className="tool-button tool-button-ghost" type="button" onClick={() => onChange(removeAtPath(value, [index]), path)}>
                  Remove
                </button>
              ) : null}
            </div>
          ))}
          {editable ? (
            <button className="tool-button tool-button-ghost" type="button" onClick={() => onChange([...(value || []), ""], path)}>
              Add Item
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (value && typeof value === "object") {
    return (
      <div className="front-matter-tree-node" style={{ "--depth": path.length }}>
        <div className="front-matter-tree-children">
          {Object.entries(value).map(([key, child]) => (
            <div key={`${path.join(".")}-${key}`} className="front-matter-tree-row">
              <div className="front-matter-tree-key">{key}</div>
              <TreeEditor editable={editable} onChange={onChange} path={[...path, key]} value={child} />
              {editable ? (
                <button className="tool-button tool-button-ghost" type="button" onClick={() => onChange(removeAtPath(value, [key]), path)}>
                  Remove
                </button>
              ) : null}
            </div>
          ))}
          {editable ? (
            <button
              className="tool-button tool-button-ghost"
              type="button"
              onClick={() => {
                const nextKey = window.prompt("Property name");
                if (!nextKey) {
                  return;
                }
                onChange({ ...(value || {}), [nextKey]: "" }, path);
              }}
            >
              Add Field
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return editable ? (
    <input
      className="find-input front-matter-tree-input"
      type="text"
      value={value === undefined || value === null ? "" : String(value)}
      onChange={(event) => onChange(parseScalar(event.target.value), path)}
    />
  ) : (
    <div className="front-matter-tree-value">{value === undefined || value === null ? "" : String(value)}</div>
  );
}

export default function PropertiesPanel({ onRawChange, rawFrontMatter }) {
  let parsed = {};
  let parseFailed = false;

  try {
    parsed = yaml.load(String(rawFrontMatter || "").replace(/^---\r?\n/, "").replace(/\r?\n---\s*$/, "")) || {};
  } catch {
    parseFailed = true;
    parsed = {};
  }

  return (
    <div className="properties-panel">
      <div className="properties-toolbar">
        <div>
          <div className="panel-heading">Metadata</div>
          <div className="sidebar-caption">Edit front matter as a tree, not just raw YAML.</div>
        </div>
      </div>

      {!parseFailed ? (
        <div className="front-matter-tree properties-tree">
          <TreeEditor
            editable
            value={parsed}
            onChange={(nextValue, path) => {
              const updated = path.length === 0 ? nextValue : updateAtPath(parsed, path, () => nextValue);
              onRawChange(dumpYaml(updated));
            }}
          />
        </div>
      ) : (
        <div className="properties-empty-state">
          <div className="properties-empty-title">YAML parse error</div>
          <div className="properties-empty-copy">Fix the raw YAML below to restore structured editing.</div>
        </div>
      )}

      <label className="front-matter-pane front-matter-pane-merged">
        <span className="panel-heading">Raw YAML</span>
        <textarea value={rawFrontMatter || ""} onChange={(event) => onRawChange(event.target.value)} />
      </label>
    </div>
  );
}
