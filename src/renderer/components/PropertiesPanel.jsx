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

function valueKind(value) {
  if (Array.isArray(value)) return "list";
  if (value && typeof value === "object") return "object";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (value === null) return "null";
  return "text";
}

function convertValueKind(value, nextKind) {
  switch (nextKind) {
    case "text":
      return value === null || value === undefined ? "" : String(value);
    case "number":
      return typeof value === "number" ? value : Number(value) || 0;
    case "boolean":
      return typeof value === "boolean" ? value : false;
    case "null":
      return null;
    case "list":
      return Array.isArray(value) ? value : value === undefined || value === null || value === "" ? [] : [value];
    case "object":
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    default:
      return value;
  }
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

function moveAtPath(value, path, direction) {
  if (path.length === 0) {
    return value;
  }
  const parentPath = path.slice(0, -1);
  const key = path[path.length - 1];
  return updateAtPath(value, parentPath, (parent) => {
    if (Array.isArray(parent)) {
      const index = Number(key);
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= parent.length) {
        return parent;
      }
      const copy = [...parent];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    }

    if (parent && typeof parent === "object") {
      const entries = Object.entries(parent);
      const index = entries.findIndex(([entryKey]) => entryKey === key);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= entries.length) {
        return parent;
      }
      [entries[index], entries[nextIndex]] = [entries[nextIndex], entries[index]];
      return Object.fromEntries(entries);
    }

    return parent;
  });
}

function recommendationForKey(key) {
  const normalized = String(key || "").toLowerCase();
  if (["tags", "aliases", "categories"].includes(normalized)) {
    return "list";
  }
  if (["draft", "published", "pinned", "private"].includes(normalized)) {
    return "boolean";
  }
  if (["created", "updated", "date", "publishdate"].includes(normalized)) {
    return "text";
  }
  return null;
}

function countVisibleFields(value) {
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countVisibleFields(item), value.length);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((total, [, child]) => total + countVisibleFields(child), Object.keys(value).length);
  }

  return 1;
}

function TreeEditor({ editable = false, onChange, path = [], value }) {
  const kind = valueKind(value);

  if (Array.isArray(value)) {
    return (
      <div className="front-matter-tree-node" style={{ "--depth": path.length }}>
        <div className="front-matter-tree-children">
          {value.map((item, index) => (
            <div key={`${path.join(".")}-${index}`} className="front-matter-tree-row">
              <div className="front-matter-tree-main">
                <div className="front-matter-tree-label-stack">
                  <div className="front-matter-tree-key">[{index}]</div>
                </div>
                {editable ? (
                  <select
                    className="front-matter-tree-type"
                    value={valueKind(item)}
                    onChange={(event) => onChange(updateAtPath(value, [index], () => convertValueKind(item, event.target.value)), path)}
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="null">Null</option>
                    <option value="list">List</option>
                    <option value="object">Object</option>
                  </select>
                ) : null}
                <div className="front-matter-tree-field">
                  <TreeEditor editable={editable} onChange={onChange} path={[...path, index]} value={item} />
                </div>
              </div>
              {editable ? (
                <div className="front-matter-tree-actions">
                  <button className="tool-button tool-button-ghost" type="button" onClick={() => onChange(moveAtPath(value, [index], -1), path)}>
                    Up
                  </button>
                  <button className="tool-button tool-button-ghost" type="button" onClick={() => onChange(moveAtPath(value, [index], 1), path)}>
                    Down
                  </button>
                  <button className="tool-button tool-button-ghost" type="button" onClick={() => onChange(removeAtPath(value, [index]), path)}>
                    Remove
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          {editable ? (
            <button className="tool-button tool-button-ghost front-matter-add-button" type="button" onClick={() => onChange([...(value || []), ""], path)}>
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
              <div className="front-matter-tree-main">
                <div className="front-matter-tree-label-stack">
                  <div className="front-matter-tree-key">{key}</div>
                  {editable && recommendationForKey(key) && recommendationForKey(key) !== valueKind(child) ? (
                    <span className="front-matter-tree-hint">Suggest {recommendationForKey(key)}</span>
                  ) : null}
                </div>
                {editable ? (
                  <select
                    className="front-matter-tree-type"
                    value={valueKind(child)}
                    onChange={(event) => onChange({ ...(value || {}), [key]: convertValueKind(child, event.target.value) }, path)}
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="null">Null</option>
                    <option value="list">List</option>
                    <option value="object">Object</option>
                  </select>
                ) : null}
                <div className="front-matter-tree-field">
                  <TreeEditor editable={editable} onChange={onChange} path={[...path, key]} value={child} />
                </div>
              </div>
              {editable ? (
                <div className="front-matter-tree-actions">
                  <button className="tool-button tool-button-ghost" type="button" onClick={() => onChange(moveAtPath(value, [key], -1), path)}>
                    Up
                  </button>
                  <button className="tool-button tool-button-ghost" type="button" onClick={() => onChange(moveAtPath(value, [key], 1), path)}>
                    Down
                  </button>
                  <button className="tool-button tool-button-ghost" type="button" onClick={() => onChange(removeAtPath(value, [key]), path)}>
                    Remove
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          {editable ? (
            <button
              className="tool-button tool-button-ghost front-matter-add-button"
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
    kind === "boolean" ? (
      <select className="front-matter-tree-type" value={String(value)} onChange={(event) => onChange(event.target.value === "true", path)}>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    ) : (
      <input
        className="find-input front-matter-tree-input"
        type="text"
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(event) => onChange(kind === "number" ? Number(event.target.value) || 0 : parseScalar(event.target.value), path)}
      />
    )
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
  const fieldCount = parseFailed ? 0 : countVisibleFields(parsed);
  const yamlLineCount = String(rawFrontMatter || "").split(/\r?\n/).filter(Boolean).length;

  return (
    <div className="properties-panel">
      <div className="properties-toolbar">
        <div className="properties-summary-card">
          <div className="sidebar-kicker">Front matter</div>
          <div className="properties-title-row">
            <div className="properties-title">Metadata</div>
            <span className="properties-pill">{parseFailed ? "Needs fix" : `${fieldCount} fields`}</span>
          </div>
          <div className="sidebar-caption">Edit front matter as a tree, then drop to raw YAML only when you need full control.</div>
          <div className="properties-stats">
            <span className="properties-stat">{parseFailed ? "Structured editor unavailable" : "Structured editor ready"}</span>
            <span className="properties-stat">{yamlLineCount} YAML lines</span>
          </div>
        </div>
      </div>

      {!parseFailed ? (
        <section className="properties-section">
          <div className="properties-section-header">
            <div>
              <div className="panel-heading">Structured fields</div>
              <div className="sidebar-caption">Update values with type-aware controls instead of editing YAML syntax directly.</div>
            </div>
          </div>
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
        </section>
      ) : (
        <div className="properties-empty-state">
          <div className="properties-empty-title">YAML parse error</div>
          <div className="properties-empty-copy">Fix the raw YAML below to restore structured editing.</div>
        </div>
      )}

      <section className="properties-section">
        <div className="properties-section-header">
          <div>
            <div className="panel-heading">Raw YAML</div>
            <div className="sidebar-caption">Use this when you want exact ordering, nesting, or syntax-level edits.</div>
          </div>
        </div>
        <label className="front-matter-pane front-matter-pane-merged properties-raw-pane">
          <textarea value={rawFrontMatter || ""} onChange={(event) => onRawChange(event.target.value)} />
        </label>
      </section>
    </div>
  );
}
