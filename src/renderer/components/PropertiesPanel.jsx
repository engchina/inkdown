import React, { useMemo, useRef, useState } from "react";
import * as yaml from "js-yaml";
import { formatFrontMatterDate, getYamlErrorDetails, splitTagTokens } from "../utils/frontMatter.mjs";

function wrapYaml(raw) {
  const normalized = String(raw || "").trim();
  return normalized ? `---\n${normalized}\n---\n\n` : "";
}

const COMMON_FIELD_SET = new Set(["title", "tags", "date", "description", "draft"]);

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

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function normalizeTagList(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function canEditCommonField(key, value) {
  if (value === undefined) {
    return true;
  }

  switch (String(key || "").toLowerCase()) {
    case "title":
    case "date":
    case "description":
      return typeof value === "string";
    case "draft":
      return typeof value === "boolean";
    case "tags":
      return typeof value === "string" || (Array.isArray(value) && value.every((item) => typeof item === "string"));
    default:
      return false;
  }
}

function TreeEditor({ editable = false, onChange, path = [], showAdvancedControls = false, value }) {
  const [activeActionKey, setActiveActionKey] = useState("");
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const kind = valueKind(value);

  function addObjectField(currentValue, currentPath) {
    const nextKey = newFieldName.trim();
    if (!nextKey || Object.prototype.hasOwnProperty.call(currentValue || {}, nextKey)) {
      return;
    }
    onChange({ ...(currentValue || {}), [nextKey]: convertValueKind("", newFieldType) }, currentPath);
    setNewFieldName("");
    setNewFieldType("text");
  }

  function toggleActionMenu(nextKey) {
    setActiveActionKey((current) => (current === nextKey ? "" : nextKey));
  }

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
                {editable && showAdvancedControls ? (
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
                  <TreeEditor
                    editable={editable}
                    onChange={onChange}
                    path={[...path, index]}
                    showAdvancedControls={showAdvancedControls}
                    value={item}
                  />
                </div>
              </div>
              {editable ? (
                <div className="front-matter-tree-actions">
                  <button className="tool-button tool-button-ghost front-matter-action-trigger" type="button" onClick={() => toggleActionMenu(`item-${path.join(".")}-${index}`)}>
                    Field
                  </button>
                  {activeActionKey === `item-${path.join(".")}-${index}` ? (
                    <div className="front-matter-action-menu">
                      {showAdvancedControls ? (
                        <>
                          <button className="tool-button tool-button-ghost" type="button" onClick={() => onChange(moveAtPath(value, [index], -1), path)}>
                            Move Up
                          </button>
                          <button className="tool-button tool-button-ghost" type="button" onClick={() => onChange(moveAtPath(value, [index], 1), path)}>
                            Move Down
                          </button>
                        </>
                      ) : null}
                      <button className="tool-button tool-button-ghost" type="button" onClick={() => onChange(removeAtPath(value, [index]), path)}>
                        Remove
                      </button>
                    </div>
                  ) : null}
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
                {editable && showAdvancedControls ? (
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
                  <TreeEditor
                    editable={editable}
                    onChange={onChange}
                    path={[...path, key]}
                    showAdvancedControls={showAdvancedControls}
                    value={child}
                  />
                </div>
              </div>
              {editable ? (
                <div className="front-matter-tree-actions">
                  <button className="tool-button tool-button-ghost front-matter-action-trigger" type="button" onClick={() => toggleActionMenu(`field-${path.join(".")}-${key}`)}>
                    Field
                  </button>
                  {activeActionKey === `field-${path.join(".")}-${key}` ? (
                    <div className="front-matter-action-menu">
                      {showAdvancedControls ? (
                        <>
                          <button className="tool-button tool-button-ghost" type="button" onClick={() => onChange(moveAtPath(value, [key], -1), path)}>
                            Move Up
                          </button>
                          <button className="tool-button tool-button-ghost" type="button" onClick={() => onChange(moveAtPath(value, [key], 1), path)}>
                            Move Down
                          </button>
                        </>
                      ) : null}
                      <button className="tool-button tool-button-ghost" type="button" onClick={() => onChange(removeAtPath(value, [key]), path)}>
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
          {editable ? (
            <div className="front-matter-add-row">
              <input
                className="find-input front-matter-add-input"
                type="text"
                value={newFieldName}
                placeholder="New field name"
                onChange={(event) => setNewFieldName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addObjectField(value, path);
                  }
                }}
              />
              <select
                className="front-matter-tree-type"
                value={newFieldType}
                onChange={(event) => setNewFieldType(event.target.value)}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="null">Null</option>
                <option value="list">List</option>
                <option value="object">Object</option>
              </select>
              <button className="tool-button tool-button-ghost front-matter-add-button" type="button" onClick={() => addObjectField(value, path)}>
                Add Field
              </button>
            </div>
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
  const [showAdvancedFieldControls, setShowAdvancedFieldControls] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [yamlCopied, setYamlCopied] = useState(false);
  const rawTextareaRef = useRef(null);
  let parsed = {};
  let parseFailed = false;
  let parseError = null;
  let rootIsObject = true;

  try {
    const loaded = yaml.load(String(rawFrontMatter || "").replace(/^---\r?\n/, "").replace(/\r?\n---\s*$/, ""));
    rootIsObject = loaded == null || isPlainObject(loaded);
    parsed = rootIsObject ? loaded || {} : {};
  } catch (error) {
    parseFailed = true;
    parseError = error;
    parsed = {};
  }
  parseFailed = parseFailed || !rootIsObject;
  const topLevelFieldCount = parseFailed ? 0 : Object.keys(parsed).length;
  const yamlLineCount = String(rawFrontMatter || "").split(/\r?\n/).filter(Boolean).length;
  const hasFrontMatter = Boolean(String(rawFrontMatter || "").trim());
  const hasAdditionalFields = useMemo(
    () =>
      Object.entries(parsed).some(
        ([key, value]) => !COMMON_FIELD_SET.has(String(key).toLowerCase()) || !canEditCommonField(key, value)
      ),
    [parsed]
  );
  const additionalFields = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(parsed).filter(
          ([key, value]) => !COMMON_FIELD_SET.has(String(key).toLowerCase()) || !canEditCommonField(key, value)
        )
      ),
    [parsed]
  );
  const tags = canEditCommonField("tags", parsed.tags) ? normalizeTagList(parsed.tags) : [];
  const { line: parseErrorLine, column: parseErrorColumn, reason: parseErrorReason } = getYamlErrorDetails(parseError);
  const quickAddFieldOptions = [
    { key: "slug", value: "", label: "Slug" },
    { key: "summary", value: "", label: "Summary" },
    { key: "category", value: "", label: "Category" },
    { key: "authors", value: [], label: "Authors" }
  ];

  function commitObject(nextObject) {
    onRawChange(Object.keys(nextObject).length === 0 ? "" : dumpYaml(nextObject));
  }

  function updateField(key, nextValue, options = {}) {
    const { removeIfEmpty = true } = options;
    const nextObject = { ...parsed };
    const removeValue =
      nextValue === undefined ||
      nextValue === null ||
      (removeIfEmpty && typeof nextValue === "string" && !nextValue.trim()) ||
      (removeIfEmpty && Array.isArray(nextValue) && nextValue.length === 0);

    if (removeValue) {
      delete nextObject[key];
    } else {
      nextObject[key] = nextValue;
    }

    commitObject(nextObject);
  }

  function handleTagKeyDown(event) {
    if (!["Enter", ",", "Tab"].includes(event.key)) {
      return;
    }

    const nextTag = tagDraft.trim();
    if (!nextTag) {
      return;
    }

    event.preventDefault();
    updateField("tags", Array.from(new Set([...tags, nextTag])));
    setTagDraft("");
  }

  function handleTagPaste(event) {
    const pastedText = event.clipboardData?.getData("text") || "";
    const nextTags = splitTagTokens(pastedText);
    if (nextTags.length <= 1) {
      return;
    }

    event.preventDefault();
    updateField("tags", Array.from(new Set([...tags, ...nextTags])));
    setTagDraft("");
  }

  function focusRawYamlLine(targetLine) {
    const textarea = rawTextareaRef.current;
    if (!textarea || !targetLine) {
      return;
    }

    const lines = String(rawFrontMatter || "").split(/\r?\n/);
    const safeLine = Math.max(1, Math.min(targetLine, lines.length));
    const selectionStart = lines.slice(0, safeLine - 1).reduce((total, line) => total + line.length + 1, 0);
    const selectionEnd = selectionStart + (lines[safeLine - 1]?.length || 0);
    textarea.focus();
    textarea.setSelectionRange(selectionStart, selectionEnd);
  }

  function addStarterFrontMatter() {
    commitObject({ title: "", tags: [], draft: false });
  }

  function addQuickField(fieldKey, fieldValue) {
    if (Object.prototype.hasOwnProperty.call(parsed, fieldKey)) {
      return;
    }
    commitObject({ ...parsed, [fieldKey]: cloneValue(fieldValue) });
  }

  async function copyRawYaml() {
    try {
      await navigator.clipboard.writeText(rawFrontMatter || "");
      setYamlCopied(true);
      window.setTimeout(() => setYamlCopied(false), 1200);
    } catch {}
  }

  function normalizeRawYaml() {
    if (parseFailed) {
      return;
    }
    commitObject(parsed);
  }

  return (
    <div className="properties-panel">
      <div className="properties-toolbar">
        <div className="properties-summary-card">
          <div className="properties-summary-row">
            <div className="properties-summary-title">
              <span className="sidebar-kicker">Front matter</span>
              <span className="properties-title">Document metadata</span>
            </div>
            <span className="properties-pill">{parseFailed ? "Needs attention" : hasFrontMatter ? `${topLevelFieldCount} fields` : "Optional"}</span>
            <span className="properties-stat">
              {parseFailed ? "Use YAML below to fix the document header" : hasFrontMatter ? "Common fields ready" : "No front matter yet"}
            </span>
            <span className="properties-stat">{yamlLineCount} YAML lines</span>
          </div>
          {!hasFrontMatter ? (
            <div className="properties-summary-actions">
              <button className="tool-button tool-button-primary" type="button" onClick={addStarterFrontMatter}>
                Add Front Matter
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {!parseFailed ? (
        <>
          <section className="properties-section">
            <div className="properties-section-header">
              <div className="panel-heading">Common fields</div>
            </div>

            <div className="properties-grid">
              <label className="property-row property-row-inline">
                <span className="property-row-label">Title</span>
                <input
                  className="find-input property-row-control"
                  type="text"
                  value={typeof parsed.title === "string" ? parsed.title : ""}
                  placeholder="Document title"
                  onChange={(event) => updateField("title", event.target.value)}
                />
              </label>

              <div className="property-row property-row-stack">
                <span className="property-row-label">Tags</span>
                <div className="properties-tag-list property-row-control">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      className="properties-tag-chip"
                      type="button"
                      onClick={() => updateField("tags", tags.filter((item) => item !== tag))}
                    >
                      <span>{tag}</span>
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                  <input
                    className="properties-tag-input"
                    type="text"
                    value={tagDraft}
                    placeholder={tags.length === 0 ? "Add a tag and press Enter" : "Add tag"}
                    onChange={(event) => setTagDraft(event.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onPaste={handleTagPaste}
                    onBlur={() => {
                      if (!tagDraft.trim()) {
                        return;
                      }
                      updateField("tags", Array.from(new Set([...tags, tagDraft.trim()])));
                      setTagDraft("");
                    }}
                  />
                </div>
              </div>

              <label className="property-row property-row-stack">
                <div className="properties-row-header">
                  <span className="property-row-label">Date</span>
                  <div className="properties-inline-actions">
                    <button className="tool-button tool-button-ghost properties-inline-button" type="button" onClick={() => updateField("date", formatFrontMatterDate(new Date(), false))}>
                      Today
                    </button>
                    <button className="tool-button tool-button-ghost properties-inline-button" type="button" onClick={() => updateField("date", formatFrontMatterDate(new Date(), true))}>
                      Date & Time
                    </button>
                  </div>
                </div>
                <input
                  className="find-input property-row-control"
                  type="text"
                  value={typeof parsed.date === "string" ? parsed.date : ""}
                  placeholder="2026-04-01"
                  onChange={(event) => updateField("date", event.target.value)}
                />
                <span className="properties-helper-text">Shortcuts fill a value, but the final YAML stays editable.</span>
              </label>

              <label className="property-row property-row-stack">
                <span className="property-row-label">Description</span>
                <textarea
                  className="properties-textarea property-row-control"
                  value={typeof parsed.description === "string" ? parsed.description : ""}
                  placeholder="Short summary for previews and exports"
                  onChange={(event) => updateField("description", event.target.value)}
                />
              </label>

              <label className="property-row property-row-toggle">
                <span className="property-row-copy">
                  <span className="property-row-label">Draft</span>
                  <span className="properties-helper-text">Mark unpublished notes explicitly.</span>
                </span>
                <input
                  type="checkbox"
                  checked={parsed.draft === true}
                  onChange={(event) => updateField("draft", event.target.checked, { removeIfEmpty: false })}
                />
              </label>
            </div>
          </section>

          <section className="properties-section">
            <details className="properties-disclosure" open={hasAdditionalFields}>
              <summary className="properties-disclosure-summary">
                <span className="panel-heading">Additional fields</span>
                <span className="properties-disclosure-meta">
                  {hasAdditionalFields ? `${Object.keys(additionalFields).length} more field${Object.keys(additionalFields).length === 1 ? "" : "s"}` : "None"}
                </span>
              </summary>
              <div className="properties-section-actions">
                <button
                  className={`tool-button tool-button-ghost properties-advanced-toggle${showAdvancedFieldControls ? " active" : ""}`}
                  type="button"
                  onClick={() => setShowAdvancedFieldControls((current) => !current)}
                >
                  {showAdvancedFieldControls ? "Hide advanced controls" : "Show advanced controls"}
                </button>
                <div className="properties-quick-add">
                  {quickAddFieldOptions
                    .filter((field) => !Object.prototype.hasOwnProperty.call(parsed, field.key))
                    .map((field) => (
                      <button
                        key={field.key}
                        className="tool-button tool-button-ghost properties-inline-button"
                        type="button"
                        onClick={() => addQuickField(field.key, field.value)}
                      >
                        Add {field.label}
                      </button>
                    ))}
                </div>
              </div>
              {hasAdditionalFields ? (
                <div className="front-matter-tree properties-tree">
                  <TreeEditor
                    editable
                    showAdvancedControls={showAdvancedFieldControls}
                    value={additionalFields}
                    onChange={(nextValue, path) => {
                      const mergedRoot = { ...parsed };
                      Object.keys(mergedRoot).forEach((key) => {
                        if (!COMMON_FIELD_SET.has(String(key).toLowerCase()) || !canEditCommonField(key, mergedRoot[key])) {
                          delete mergedRoot[key];
                        }
                      });
                      const updatedAdditional = path.length === 0 ? nextValue : updateAtPath(additionalFields, path, () => nextValue);
                      const sanitizedAdditional = Object.fromEntries(
                        Object.entries(updatedAdditional || {}).filter(
                          ([key, value]) => !COMMON_FIELD_SET.has(String(key).toLowerCase()) || !canEditCommonField(key, value)
                        )
                      );
                      commitObject({ ...mergedRoot, ...sanitizedAdditional });
                    }}
                  />
                </div>
              ) : (
                <div className="properties-empty-state">
                  <div className="properties-empty-title">Nothing extra to manage</div>
                  <div className="properties-empty-copy">Stick with the common fields above, or add advanced keys in YAML when needed.</div>
                </div>
              )}
            </details>
          </section>
        </>
      ) : (
        <div className="properties-empty-state">
          <div className="properties-empty-title">Front matter needs a valid YAML object</div>
          <div className="properties-empty-copy">
            Fix the document header below to restore common-field editing.
            {parseErrorLine ? ` Error at line ${parseErrorLine}${parseErrorColumn ? `, column ${parseErrorColumn}` : ""}.` : ""}
          </div>
        </div>
      )}

      <section className="properties-section">
        <details className="properties-disclosure" open={parseFailed}>
          <summary className="properties-disclosure-summary">
            <span className="panel-heading">Raw YAML</span>
            <span className="properties-disclosure-meta">{hasFrontMatter ? "Advanced" : "Start here"}</span>
          </summary>
          <div className="properties-section-actions">
            <button className="tool-button tool-button-ghost properties-inline-button" type="button" onClick={copyRawYaml}>
              {yamlCopied ? "Copied" : "Copy YAML"}
            </button>
            <button
              className="tool-button tool-button-ghost properties-inline-button"
              type="button"
              onClick={normalizeRawYaml}
              disabled={parseFailed || !hasFrontMatter}
            >
              Format YAML
            </button>
          </div>
          {parseFailed && parseErrorReason ? (
            <div className="properties-yaml-error">
              <div className="properties-yaml-error-copy">
                <div className="properties-empty-title">YAML error</div>
                <div className="properties-empty-copy">
                  {parseErrorReason}
                  {parseErrorLine ? ` Line ${parseErrorLine}${parseErrorColumn ? `, column ${parseErrorColumn}` : ""}.` : ""}
                </div>
              </div>
              {parseErrorLine ? (
                <button className="tool-button tool-button-ghost" type="button" onClick={() => focusRawYamlLine(parseErrorLine)}>
                  Jump to line
                </button>
              ) : null}
            </div>
          ) : null}
          <label className="front-matter-pane front-matter-pane-merged properties-raw-pane">
            <textarea ref={rawTextareaRef} value={rawFrontMatter || ""} onChange={(event) => onRawChange(event.target.value)} />
          </label>
        </details>
      </section>
    </div>
  );
}
