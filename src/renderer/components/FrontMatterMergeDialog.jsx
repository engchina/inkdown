import React from "react";
import * as yaml from "js-yaml";

function formatScalar(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function parseScalar(value) {
  const text = String(value ?? "");
  if (text === "true") return true;
  if (text === "false") return false;
  if (text === "null") return null;
  if (text !== "" && !Number.isNaN(Number(text))) return Number(text);
  return text;
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

function StructuredTree({ editable = false, onChange, path = [], value }) {
  if (Array.isArray(value)) {
    return (
      <div className="front-matter-tree-node" style={{ "--depth": path.length }}>
        <div className="front-matter-tree-children">
          {value.map((item, index) => (
            <div key={`${path.join(".")}-${index}`} className="front-matter-tree-row">
              <StructuredTree editable={editable} onChange={onChange} path={[...path, index]} value={item} />
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
              <StructuredTree editable={editable} onChange={onChange} path={[...path, key]} value={child} />
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
      value={formatScalar(value)}
      onChange={(event) => onChange(parseScalar(event.target.value), path)}
    />
  ) : (
    <div className="front-matter-tree-value">{formatScalar(value)}</div>
  );
}

function StructuredPane({ editable = false, onChangeMergedValue, raw, title, value }) {
  let parsed = value;
  if (parsed === undefined) {
    try {
      parsed = yaml.load(String(raw || "").replace(/^---\r?\n/, "").replace(/\r?\n---\s*$/, ""));
    } catch {
      parsed = null;
    }
  }

  return (
    <div className="front-matter-structured-pane">
      <div className="panel-heading">{title}</div>
      {parsed && typeof parsed === "object" ? (
        <div className="front-matter-tree">
          <StructuredTree
            editable={editable}
            value={parsed}
            onChange={(nextValue, path) => {
              if (!editable || !onChangeMergedValue) {
                return;
              }
              const updated = path.length === 0 ? nextValue : updateAtPath(parsed, path, () => nextValue);
              onChangeMergedValue(updated);
            }}
          />
        </div>
      ) : (
        <div className="front-matter-structured-empty">Unable to render a structured tree for this YAML.</div>
      )}
    </div>
  );
}

export default function FrontMatterMergeDialog(props) {
  const {
    currentRaw,
    incomingRaw,
    mergedRaw,
    mergedValue,
    onChangeMerged,
    onChangeMergedValue,
    onApplyMerged,
    onKeepCurrent,
    onReplace,
    onBodyOnly,
    onCancel,
    open
  } = props;

  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <section className="front-matter-merge-dialog" role="dialog" onClick={(event) => event.stopPropagation()}>
        <div className="dialog-header">
          <div>
            <h2>Merge Front Matter</h2>
            <div className="sidebar-caption">Edit the merged tree directly, or fine-tune the YAML below.</div>
          </div>
          <button className="tool-button" type="button" onClick={onCancel}>
            Close
          </button>
        </div>

        <div className="front-matter-merge-grid">
          <StructuredPane title="Current Tree" raw={currentRaw} />
          <StructuredPane title="Incoming Tree" raw={incomingRaw} />
          <StructuredPane title="Merged Tree" raw={mergedRaw} value={mergedValue} editable onChangeMergedValue={onChangeMergedValue} />
        </div>

        <label className="front-matter-pane front-matter-pane-merged">
          <span className="panel-heading">Merged YAML</span>
          <textarea value={mergedRaw} onChange={(event) => onChangeMerged(event.target.value)} />
        </label>

        <div className="front-matter-merge-actions">
          <button className="tool-button" type="button" onClick={onKeepCurrent}>
            Keep Current
          </button>
          <button className="tool-button" type="button" onClick={onReplace}>
            Replace
          </button>
          <button className="tool-button" type="button" onClick={onBodyOnly}>
            Body Only
          </button>
          <button className="tool-button tool-button-primary" type="button" onClick={onApplyMerged}>
            Apply Merged
          </button>
        </div>
      </section>
    </div>
  );
}
