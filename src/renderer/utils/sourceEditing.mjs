export function buildSourceInsertion(markdown, selectionStart, selectionEnd, content, options = {}) {
  const text = String(markdown ?? "");
  const start = Math.max(0, Math.min(selectionStart ?? 0, text.length));
  const end = Math.max(start, Math.min(selectionEnd ?? start, text.length));
  const before = text.slice(0, start);
  const after = text.slice(end);
  const needsLeadingBreak = options.block && before.length > 0 && !/\n{2}$/.test(before);
  const needsTrailingBreak = options.block && after.length > 0 && !/^\n/.test(after);
  const insertion = `${needsLeadingBreak ? "\n\n" : ""}${content}${needsTrailingBreak ? "\n" : ""}`;
  const nextText = `${before}${insertion}${after}`;
  const caret = before.length + insertion.length;

  return {
    text: nextText,
    selectionStart: caret,
    selectionEnd: caret
  };
}

export function buildWrappedSourceSelection(markdown, selectionStart, selectionEnd, prefix, suffix = prefix, placeholder = "") {
  const text = String(markdown ?? "");
  const start = Math.max(0, Math.min(selectionStart ?? 0, text.length));
  const end = Math.max(start, Math.min(selectionEnd ?? start, text.length));
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);
  const selectedText = selected || placeholder;
  const nextText = `${before}${prefix}${selectedText}${suffix}${after}`;
  const nextSelectionStart = before.length + prefix.length;
  const nextSelectionEnd = nextSelectionStart + selectedText.length;

  return {
    text: nextText,
    selectionStart: nextSelectionStart,
    selectionEnd: nextSelectionEnd
  };
}

export function buildSourceAutoPairEdit(markdown, selectionStart, selectionEnd, key, modifiers = {}) {
  const text = String(markdown ?? "");
  const start = Math.max(0, Math.min(selectionStart ?? 0, text.length));
  const end = Math.max(start, Math.min(selectionEnd ?? start, text.length));
  const normalizedKey = String(key ?? "");
  if (
    modifiers.ctrlKey ||
    modifiers.metaKey ||
    modifiers.altKey ||
    normalizedKey.length !== 1
  ) {
    return null;
  }

  const repeatableDelimiters = new Set(["*", "_", "~", "`"]);
  const countAdjacentDelimiters = (value, index, step) => {
    let count = 0;
    let cursor = index;
    while (cursor >= 0 && cursor < text.length && text[cursor] === value) {
      count += 1;
      cursor += step;
    }
    return count;
  };

  if (start === end && text[end] === normalizedKey && repeatableDelimiters.has(normalizedKey)) {
    const leftCount = countAdjacentDelimiters(normalizedKey, start - 1, -1);
    const rightCount = countAdjacentDelimiters(normalizedKey, end, 1);
    const runStart = start - leftCount;
    const runEnd = end + rightCount;
    const boundaryBefore = runStart === 0 || /\s/.test(text[runStart - 1] || "");
    const boundaryAfter = runEnd === text.length || /\s/.test(text[runEnd] || "");
    if (leftCount > 0 && leftCount === rightCount && boundaryBefore && boundaryAfter) {
      return {
        kind: "pair",
        text: `${text.slice(0, start)}${normalizedKey}${normalizedKey}${text.slice(end)}`,
        selectionStart: start + 1,
        selectionEnd: start + 1
      };
    }
    return {
      kind: "skip",
      selectionStart: end + 1,
      selectionEnd: end + 1
    };
  }

  const skipClosers = new Set([")", "]", "}", "\"", "'", "^"]);
  if (start === end && text[end] === normalizedKey && skipClosers.has(normalizedKey)) {
    return {
      kind: "skip",
      selectionStart: end + 1,
      selectionEnd: end + 1
    };
  }

  const pairMap = {
    "*": "*",
    "_": "_",
    "~": "~",
    "`": "`",
    "\"": "\"",
    "'": "'",
    "(": ")",
    "[": "]",
    "{": "}",
    "^": "^"
  };

  const closing = pairMap[normalizedKey];
  if (!closing) {
    return null;
  }

  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);
  const nextChar = text[end] || "";
  const collapsesToSameToken = closing === normalizedKey;
  const isCollapsedSelection = start === end;

  // If the caret is already sitting before the auto-inserted closing token,
  // consume the keypress and advance instead of duplicating it.
  if (isCollapsedSelection && nextChar === closing) {
    return {
      kind: "skip",
      selectionStart: end + 1,
      selectionEnd: end + 1
    };
  }

  const allowAutoPair =
    normalizedKey !== "`" &&
    (start !== end || !nextChar || /\s|[)\]}>.,!?]/.test(nextChar));

  if (!allowAutoPair) {
    if (normalizedKey === "`" && start !== end) {
      return {
        kind: "wrap",
        text: `${before}\`${selected}\`${after}`,
        selectionStart: start + 1,
        selectionEnd: end + 1
      };
    }
    if (collapsesToSameToken) {
      return null;
    }
    return null;
  }

  if (!isCollapsedSelection) {
    return {
      kind: "wrap",
      text: `${before}${normalizedKey}${selected}${closing}${after}`,
      selectionStart: start + 1,
      selectionEnd: end + 1
    };
  }

  return {
    kind: "pair",
    text: `${before}${normalizedKey}${closing}${after}`,
    selectionStart: start + 1,
    selectionEnd: start + 1
  };
}

export function buildLinkedSourceSelection(markdown, selectionStart, selectionEnd, text, url, fallbackText = "link text", title = "") {
  const source = String(markdown ?? "");
  const start = Math.max(0, Math.min(selectionStart ?? 0, source.length));
  const end = Math.max(start, Math.min(selectionEnd ?? start, source.length));
  const before = source.slice(0, start);
  const selected = source.slice(start, end);
  const after = source.slice(end);
  const label = String(text || "").trim() || selected || fallbackText;
  const href = String(url || "").trim();
  const normalizedTitle = String(title || "").trim();
  const escapedLabel = escapeMarkdownLinkLabel(label);
  const linkMarkdown = `[${escapedLabel}](${formatMarkdownDestination(href)}${formatMarkdownLinkTitle(normalizedTitle)})`;
  const nextText = `${before}${linkMarkdown}${after}`;
  const labelStart = before.length + 1;

  return {
    text: nextText,
    selectionStart: labelStart,
    selectionEnd: labelStart + escapedLabel.length
  };
}

function formatMarkdownDestination(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return /[\s()]/.test(normalized) ? `<${normalized}>` : normalized;
}

function escapeMarkdownLinkLabel(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function escapeMarkdownImageAlt(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function unescapeMarkdownText(value) {
  return String(value || "").replace(/\\(.)/g, "$1");
}

function formatMarkdownImageTitle(value) {
  const normalized = String(value || "").trim();
  return normalized ? ` "${normalized.replace(/\\/g, "\\\\").replaceAll('"', '\\"')}"` : "";
}

function formatMarkdownLinkTitle(value) {
  const normalized = String(value || "").trim();
  return normalized ? ` "${normalized.replace(/\\/g, "\\\\").replaceAll('"', '\\"')}"` : "";
}

function selectionTouchesRange(start, end, rangeStart, rangeEnd) {
  const overlaps = start <= rangeEnd && end >= rangeStart;
  const cursorInside = start === end && start >= rangeStart && start <= rangeEnd;
  return overlaps || cursorInside;
}

function normalizeMarkdownReferenceLabel(value) {
  return unescapeMarkdownText(value).trim().replace(/\s+/g, " ").toLowerCase();
}

function buildMarkdownReferenceDefinition(label, url, title = "") {
  return `[${escapeMarkdownLinkLabel(label)}]: ${formatMarkdownDestination(url)}${formatMarkdownLinkTitle(title)}`;
}

function buildMarkdownReferenceUsage(text, referenceLabel, implicit = false) {
  const escapedText = escapeMarkdownLinkLabel(text);
  if (implicit) {
    return `[${escapedText}][]`;
  }
  return `[${escapedText}][${escapeMarkdownLinkLabel(referenceLabel)}]`;
}

function buildMarkdownAutolink(url) {
  return `<${String(url || "").trim()}>`;
}

function trimBareUrlCandidate(value) {
  let candidate = String(value || "");
  while (candidate) {
    const last = candidate.at(-1);
    if (/[.,;:!?]/.test(last)) {
      candidate = candidate.slice(0, -1);
      continue;
    }
    if (last === ")") {
      const opens = (candidate.match(/\(/g) || []).length;
      const closes = (candidate.match(/\)/g) || []).length;
      if (closes > opens) {
        candidate = candidate.slice(0, -1);
        continue;
      }
    }
    break;
  }
  return candidate;
}

function findMarkdownReferenceDefinitions(source) {
  const definitions = [];
  const definitionPattern =
    /^ {0,3}\[((?:\\.|[^\\\]])+)\]:[ \t]*(<[^>\r\n]+>|(?:\\.|[^\\\s)])+)(?:[ \t]+((?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\((?:\\.|[^)])*\))))?[ \t]*$/gm;

  for (const match of source.matchAll(definitionPattern)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const rawLabel = match[1] || "";
    const rawSource = match[2] || "";
    const title = unescapeMarkdownText(String(match[3] || "").trim().replace(/^["'(]+|["')]+$/g, ""));
    const url = rawSource.startsWith("<") && rawSource.endsWith(">") ? rawSource.slice(1, -1) : rawSource;
    definitions.push({
      start,
      end,
      label: unescapeMarkdownText(rawLabel),
      rawLabel,
      normalizedLabel: normalizeMarkdownReferenceLabel(rawLabel),
      url,
      title
    });
  }

  return definitions;
}

export function findMarkdownLinkAtSelection(markdown, selectionStart, selectionEnd) {
  const source = String(markdown ?? "");
  const start = Math.max(0, Math.min(selectionStart ?? 0, source.length));
  const end = Math.max(start, Math.min(selectionEnd ?? start, source.length));
  const inlineLinkPattern =
    /\[((?:\\.|[^\\\]])+)\]\(\s*(<[^>\r\n]+>|(?:\\.|[^\\\s)])+)(?:\s+((?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\((?:\\.|[^)])*\))))?\s*\)/g;

  for (const match of source.matchAll(inlineLinkPattern)) {
    const matchStart = match.index ?? 0;
    const matchEnd = matchStart + match[0].length;
    if (!selectionTouchesRange(start, end, matchStart, matchEnd)) {
      continue;
    }

    const rawLabel = match[1] || "";
    const label = unescapeMarkdownText(rawLabel);
    const rawSource = match[2] || "";
    const title = unescapeMarkdownText(String(match[3] || "").trim().replace(/^["'(]+|["')]+$/g, ""));
    const url = rawSource.startsWith("<") && rawSource.endsWith(">") ? rawSource.slice(1, -1) : rawSource;
    const labelStart = matchStart + 1;
    return {
      kind: "inline",
      start: matchStart,
      end: matchEnd,
      text: label,
      url,
      title,
      textStart: labelStart,
      textEnd: labelStart + rawLabel.length
    };
  }

  const autolinkPattern = /<(https?:\/\/[^>\r\n]+)>/gi;

  for (const match of source.matchAll(autolinkPattern)) {
    const matchStart = match.index ?? 0;
    const matchEnd = matchStart + match[0].length;
    if (!selectionTouchesRange(start, end, matchStart, matchEnd)) {
      continue;
    }

    const url = match[1] || "";
    return {
      kind: "autolink",
      start: matchStart,
      end: matchEnd,
      text: url,
      url,
      title: "",
      textStart: matchStart + 1,
      textEnd: matchEnd - 1
    };
  }


  const bareUrlPattern = /https?:\/\/[^\s<>"']+/gi;

  for (const match of source.matchAll(bareUrlPattern)) {
    const matchStart = match.index ?? 0;
    const rawCandidate = match[0] || "";
    const url = trimBareUrlCandidate(rawCandidate);
    if (!url) {
      continue;
    }
    const matchEnd = matchStart + url.length;
    if (!selectionTouchesRange(start, end, matchStart, matchEnd)) {
      continue;
    }

    return {
      kind: "bare",
      start: matchStart,
      end: matchEnd,
      text: url,
      url,
      title: "",
      textStart: matchStart,
      textEnd: matchEnd
    };
  }
  const definitions = findMarkdownReferenceDefinitions(source);
  const referenceLinkPattern = /\[((?:\\.|[^\\\]])+)\]\[((?:\\.|[^\\\]])*)\]/g;

  for (const match of source.matchAll(referenceLinkPattern)) {
    const matchStart = match.index ?? 0;
    const matchEnd = matchStart + match[0].length;
    if (!selectionTouchesRange(start, end, matchStart, matchEnd)) {
      continue;
    }

    const rawLabel = match[1] || "";
    const label = unescapeMarkdownText(rawLabel);
    const rawReferenceLabel = match[2] || "";
    const implicitReference = rawReferenceLabel.length === 0;
    const normalizedReference = normalizeMarkdownReferenceLabel(rawReferenceLabel || rawLabel);
    const definition = definitions.find((item) => item.normalizedLabel === normalizedReference);
    if (!definition) {
      continue;
    }

    const labelStart = matchStart + 1;
    return {
      kind: "reference",
      start: matchStart,
      end: matchEnd,
      text: label,
      url: definition.url,
      title: definition.title,
      textStart: labelStart,
      textEnd: labelStart + rawLabel.length,
      referenceLabel: implicitReference ? definition.label : unescapeMarkdownText(rawReferenceLabel),
      implicitReference,
      definitionStart: definition.start,
      definitionEnd: definition.end,
      definitionLabel: definition.label
    };
  }

  return null;
}

export function buildUpdatedMarkdownLinkSelection(markdown, selectionStart, selectionEnd, options = {}) {
  const source = String(markdown ?? "");
  const match = findMarkdownLinkAtSelection(source, selectionStart, selectionEnd);
  if (!match) {
    return null;
  }

  const text = String(options.text ?? match.text ?? "").trim() || match.text;
  const url = String(options.url ?? match.url ?? "").trim() || match.url;
  const title = options.title === undefined ? match.title ?? "" : String(options.title ?? "").trim();

  if (match.kind === "reference") {
    const usageMarkdown = buildMarkdownReferenceUsage(text, match.referenceLabel || match.definitionLabel || text, match.implicitReference && text === match.text);
    const definitionMarkdown = buildMarkdownReferenceDefinition(match.definitionLabel || match.referenceLabel || text, url, title);
    const nextText =
      `${source.slice(0, match.start)}${usageMarkdown}${source.slice(match.end, match.definitionStart)}${definitionMarkdown}${source.slice(match.definitionEnd)}`;
    const textStart = match.start + 1;
    const escapedText = escapeMarkdownLinkLabel(text);
    return {
      text: nextText,
      selectionStart: textStart,
      selectionEnd: textStart + escapedText.length
    };
  }

  const escapedText = escapeMarkdownLinkLabel(text);
  const preserveAutolink = match.kind === "autolink" && !title && text === match.text;
  const preserveBareUrl = match.kind === "bare" && !title && text === match.text;
  const linkMarkdown = preserveAutolink
    ? buildMarkdownAutolink(url)
    : preserveBareUrl
      ? url
    : `[${escapedText}](${formatMarkdownDestination(url)}${formatMarkdownLinkTitle(title)})`;
  const nextText = `${source.slice(0, match.start)}${linkMarkdown}${source.slice(match.end)}`;
  const textStart = preserveBareUrl ? match.start : match.start + 1;

  return {
    text: nextText,
    selectionStart: textStart,
    selectionEnd: preserveAutolink || preserveBareUrl ? textStart + url.length : textStart + escapedText.length
  };
}

function hasOtherMarkdownReferenceUsage(source, match) {
  const referenceLinkPattern = /\[((?:\\.|[^\\\]])+)\]\[((?:\\.|[^\\\]])*)\]/g;
  const targetLabel = normalizeMarkdownReferenceLabel(match.definitionLabel || match.referenceLabel || match.text);

  for (const usage of source.matchAll(referenceLinkPattern)) {
    const usageStart = usage.index ?? 0;
    const usageEnd = usageStart + usage[0].length;
    if (usageStart === match.start && usageEnd === match.end) {
      continue;
    }
    const rawLabel = usage[1] || "";
    const rawReferenceLabel = usage[2] || "";
    const normalizedReference = normalizeMarkdownReferenceLabel(rawReferenceLabel || rawLabel);
    if (normalizedReference === targetLabel) {
      return true;
    }
  }

  return false;
}

function expandMarkdownDefinitionRemovalRange(source, start, end) {
  let rangeStart = start;
  let rangeEnd = end;

  if (rangeStart >= 2 && source.slice(rangeStart - 2, rangeStart) === "\n\n") {
    rangeStart -= 2;
  } else if (source.slice(rangeEnd, rangeEnd + 2) === "\n\n") {
    rangeEnd += 2;
  }

  return { start: rangeStart, end: rangeEnd };
}

export function buildRemovedMarkdownLinkSelection(markdown, selectionStart, selectionEnd) {
  const source = String(markdown ?? "");
  const match = findMarkdownLinkAtSelection(source, selectionStart, selectionEnd);
  if (!match) {
    return null;
  }

  const replacement = match.text || "";
  const nextTextBase = `${source.slice(0, match.start)}${replacement}${source.slice(match.end)}`;
  const selectionStartNext = match.start;
  const selectionEndNext = match.start + replacement.length;

  if (match.kind !== "reference" || hasOtherMarkdownReferenceUsage(source, match)) {
    return {
      text: nextTextBase,
      selectionStart: selectionStartNext,
      selectionEnd: selectionEndNext
    };
  }

  const definitionRange = expandMarkdownDefinitionRemovalRange(nextTextBase, match.definitionStart - (match.end - match.start) + replacement.length, match.definitionEnd - (match.end - match.start) + replacement.length);
  const nextText = `${nextTextBase.slice(0, definitionRange.start)}${nextTextBase.slice(definitionRange.end)}`;
  return {
    text: nextText,
    selectionStart: selectionStartNext,
    selectionEnd: selectionEndNext
  };
}

export function buildMarkdownImageSyntax(alt, url, title = "") {
  return `![${escapeMarkdownImageAlt(alt)}](${formatMarkdownDestination(url)}${formatMarkdownImageTitle(title)})`;
}
export function findMarkdownImageAtSelection(markdown, selectionStart, selectionEnd) {
  const source = String(markdown ?? "");
  const start = Math.max(0, Math.min(selectionStart ?? 0, source.length));
  const end = Math.max(start, Math.min(selectionEnd ?? start, source.length));
  const imagePattern =
    /!\[((?:\\.|[^\\\]])*)\]\(\s*(<[^>\r\n]+>|(?:\\.|[^\\\s)])+)(?:\s+((?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\((?:\\.|[^)])*\))))?\s*\)/g;

  for (const match of source.matchAll(imagePattern)) {
    const matchStart = match.index ?? 0;
    const matchEnd = matchStart + match[0].length;
    const overlaps = start <= matchEnd && end >= matchStart;
    const cursorInside = start === end && start >= matchStart && start <= matchEnd;
    if (!overlaps && !cursorInside) {
      continue;
    }

    const rawAlt = match[1] || "";
    const alt = unescapeMarkdownText(rawAlt);
    const rawSource = match[2] || "";
    const title = unescapeMarkdownText(String(match[3] || "").trim().replace(/^["'(]+|["')]+$/g, ""));
    const url = rawSource.startsWith("<") && rawSource.endsWith(">") ? rawSource.slice(1, -1) : rawSource;

    return {
      start: matchStart,
      end: matchEnd,
      alt,
      url,
      title
    };
  }

  return null;
}

export function buildUpdatedMarkdownImageSelection(markdown, selectionStart, selectionEnd, options = {}) {
  const source = String(markdown ?? "");
  const match = findMarkdownImageAtSelection(source, selectionStart, selectionEnd);
  if (!match) {
    return null;
  }

  const alt = String(options.alt ?? match.alt ?? "");
  const url = String(options.url ?? match.url ?? "");
  const title = String(options.title ?? match.title ?? "");
  const imageMarkdown = buildMarkdownImageSyntax(alt, url, title);
  const nextText = `${source.slice(0, match.start)}${imageMarkdown}${source.slice(match.end)}`;
  const altStart = match.start + 2;

  return {
    text: nextText,
    selectionStart: altStart,
    selectionEnd: altStart + escapeMarkdownImageAlt(alt).length
  };
}

export function buildRemovedMarkdownImageSelection(markdown, selectionStart, selectionEnd) {
  const source = String(markdown ?? "");
  const match = findMarkdownImageAtSelection(source, selectionStart, selectionEnd);
  if (!match) {
    return null;
  }

  const replacement = match.alt || "";
  const nextText = `${source.slice(0, match.start)}${replacement}${source.slice(match.end)}`;
  return {
    text: nextText,
    selectionStart: match.start,
    selectionEnd: match.start + replacement.length
  };
}

function splitLinesWithOffsets(markdown) {
  const source = String(markdown ?? "");
  const lines = source.split("\n");
  let offset = 0;
  return lines.map((line, index) => {
    const start = offset;
    const end = start + line.length;
    offset = end + (index < lines.length - 1 ? 1 : 0);
    return { line, start, end };
  });
}

function isPotentialMarkdownTableLine(line) {
  return /\|/.test(String(line || "")) && String(line || "").trim() !== "";
}

function isMarkdownTableDividerLine(line) {
  const normalized = String(line || "").trim();
  if (!normalized.includes("|")) {
    return false;
  }

  const cells = normalized
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);

  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function getMarkdownTableColumnCount(line) {
  return String(line || "")
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell, index, cells) => cell || index < cells.length)
    .length;
}

export function findMarkdownTableAtSelection(markdown, selectionStart) {
  const lines = splitLinesWithOffsets(markdown);
  const cursor = Math.max(0, Math.min(selectionStart ?? 0, String(markdown ?? "").length));
  const currentIndex = lines.findIndex(({ start, end }) => cursor >= start && cursor <= end + 1);
  if (currentIndex === -1) {
    return null;
  }

  let blockStart = currentIndex;
  while (blockStart > 0 && isPotentialMarkdownTableLine(lines[blockStart - 1].line)) {
    blockStart -= 1;
  }

  let blockEnd = currentIndex;
  while (blockEnd < lines.length - 1 && isPotentialMarkdownTableLine(lines[blockEnd + 1].line)) {
    blockEnd += 1;
  }

  if (blockEnd - blockStart < 1) {
    return null;
  }

  const headerLine = lines[blockStart];
  const dividerLine = lines[blockStart + 1];
  if (!isPotentialMarkdownTableLine(headerLine.line) || !isMarkdownTableDividerLine(dividerLine.line)) {
    return null;
  }

  const columnCount = getMarkdownTableColumnCount(headerLine.line);
  if (columnCount === 0) {
    return null;
  }

  return {
    start: headerLine.start,
    end: lines[blockEnd].end,
    insertAt: lines[blockEnd].end,
    columnCount
  };
}

export function buildExpandedMarkdownTableSelection(markdown, selectionStart, placeholder = "Value") {
  const source = String(markdown ?? "");
  const table = findMarkdownTableAtSelection(source, selectionStart);
  if (!table) {
    return null;
  }

  const nextRow = `\n| ${Array.from({ length: table.columnCount }, () => placeholder).join(" | ")} |`;
  const nextText = `${source.slice(0, table.insertAt)}${nextRow}${source.slice(table.insertAt)}`;
  const selectionRowStart = table.insertAt + 3;

  return {
    text: nextText,
    selectionStart: selectionRowStart,
    selectionEnd: selectionRowStart + placeholder.length
  };
}

export function buildToggledWrappedSourceSelection(markdown, selectionStart, selectionEnd, prefix, suffix = prefix, placeholder = "") {
  const text = String(markdown ?? "");
  const start = Math.max(0, Math.min(selectionStart ?? 0, text.length));
  const end = Math.max(start, Math.min(selectionEnd ?? start, text.length));
  const selected = text.slice(start, end);
  const selectedWrapped = selected.startsWith(prefix) && selected.endsWith(suffix) && selected.length >= prefix.length + suffix.length;
  const surroundingWrapped =
    start >= prefix.length &&
    text.slice(start - prefix.length, start) === prefix &&
    text.slice(end, end + suffix.length) === suffix;

  if (selectedWrapped) {
    const innerStart = start + prefix.length;
    const innerEnd = end - suffix.length;
    return {
      text: `${text.slice(0, start)}${text.slice(innerStart, innerEnd)}${text.slice(end)}`,
      selectionStart: start,
      selectionEnd: innerEnd - prefix.length
    };
  }

  if (surroundingWrapped) {
    return {
      text: `${text.slice(0, start - prefix.length)}${selected}${text.slice(end + suffix.length)}`,
      selectionStart: start - prefix.length,
      selectionEnd: end - prefix.length
    };
  }

  return buildWrappedSourceSelection(text, start, end, prefix, suffix, placeholder);
}

export function buildPrefixedSourceLines(markdown, selectionStart, selectionEnd, prefix, numbered = false) {
  const text = String(markdown ?? "");
  const start = Math.max(0, Math.min(selectionStart ?? 0, text.length));
  const end = Math.max(start, Math.min(selectionEnd ?? start, text.length));
  const lineStart = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextNewline = text.indexOf("\n", end);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;
  const before = text.slice(0, lineStart);
  const target = text.slice(lineStart, lineEnd);
  const after = text.slice(lineEnd);
  const lines = target ? target.split(/\r?\n/) : [""];
  const nextLines = lines.map((line, index) => (numbered ? `${index + 1}. ${line}` : `${prefix}${line}`));
  const nextTarget = nextLines.join("\n");

  return {
    text: `${before}${nextTarget}${after}`,
    selectionStart: lineStart,
    selectionEnd: lineStart + nextTarget.length
  };
}

export function getMarkdownLineContinuation(line = "") {
  const sourceLine = String(line ?? "");

  const taskMatch = /^(\s*)([-*+])\s\[(?: |x|X)\]\s*(.*)$/.exec(sourceLine);
  if (taskMatch) {
    const [, indent, marker, content] = taskMatch;
    return !content.trim()
      ? { kind: "taskList", mode: "replace-line", text: indent }
      : { kind: "taskList", mode: "insert", text: `\n${indent}${marker} [ ] ` };
  }

  const orderedMatch = /^(\s*)(\d+)\.\s+(.*)$/.exec(sourceLine);
  if (orderedMatch) {
    const [, indent, indexText, content] = orderedMatch;
    return !content.trim()
      ? { kind: "orderedList", mode: "replace-line", text: indent }
      : { kind: "orderedList", mode: "insert", text: `\n${indent}${Number(indexText) + 1}. ` };
  }

  const bulletMatch = /^(\s*)([-*+])\s+(.*)$/.exec(sourceLine);
  if (bulletMatch) {
    const [, indent, marker, content] = bulletMatch;
    return !content.trim()
      ? { kind: "bulletList", mode: "replace-line", text: indent }
      : { kind: "bulletList", mode: "insert", text: `\n${indent}${marker} ` };
  }

  const quoteMatch = /^(\s*(?:>\s*)+)(.*)$/.exec(sourceLine);
  if (quoteMatch) {
    const [, prefix, content] = quoteMatch;
    return !content.trim()
      ? { kind: "blockquote", mode: "replace-line", text: "" }
      : { kind: "blockquote", mode: "insert", text: `\n${prefix.replace(/\s*$/, " ")}` };
  }

  return null;
}

export function buildToggledPrefixedSourceLines(markdown, selectionStart, selectionEnd, prefix, options = {}) {
  const text = String(markdown ?? "");
  const start = Math.max(0, Math.min(selectionStart ?? 0, text.length));
  const end = Math.max(start, Math.min(selectionEnd ?? start, text.length));
  const lineStart = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextNewline = text.indexOf("\n", end);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;
  const before = text.slice(0, lineStart);
  const target = text.slice(lineStart, lineEnd);
  const after = text.slice(lineEnd);
  const lines = target ? target.split(/\r?\n/) : [""];
  const isApplied = options.isApplied ?? ((line) => line.startsWith(prefix));
  const strip = options.strip ?? ((line) => (line.startsWith(prefix) ? line.slice(prefix.length) : line));
  const normalize = options.normalize ?? ((line) => line);
  const allApplied = lines.length > 0 && lines.every((line) => isApplied(line));
  const nextLines = allApplied
    ? lines.map((line) => strip(line))
    : lines.map((line, index) => {
        const normalized = normalize(line);
        return options.numbered ? `${index + 1}. ${normalized}` : `${prefix}${normalized}`;
      });
  const nextTarget = nextLines.join("\n");

  return {
    text: `${before}${nextTarget}${after}`,
    selectionStart: lineStart,
    selectionEnd: lineStart + nextTarget.length
  };
}

export function findLiteralMatches(markdown, query) {
  const text = String(markdown ?? "");
  const needle = String(query ?? "");
  if (!needle) {
    return [];
  }

  const matches = [];
  let startIndex = 0;

  while (startIndex <= text.length) {
    const foundAt = text.indexOf(needle, startIndex);
    if (foundAt === -1) {
      break;
    }
    matches.push({ start: foundAt, end: foundAt + needle.length });
    startIndex = foundAt + needle.length;
  }

  return matches;
}

export function replaceCurrentLiteralMatch(markdown, query, matches, matchIndex, replaceValue) {
  const text = String(markdown ?? "");
  const replacement = String(replaceValue ?? "");
  const activeMatches = Array.isArray(matches) ? matches : [];
  const current = activeMatches[matchIndex];

  if (!query || !current) {
    return null;
  }

  const nextText = `${text.slice(0, current.start)}${replacement}${text.slice(current.end)}`;
  const nextMatches = findLiteralMatches(nextText, query);
  const nextSearchStart = current.start + replacement.length;
  const nextIndex = nextMatches.findIndex((match) => match.start >= nextSearchStart);
  const normalizedIndex = nextMatches.length === 0 ? 0 : nextIndex === -1 ? 0 : nextIndex;

  return {
    text: nextText,
    nextMatches,
    nextIndex: normalizedIndex
  };
}

export function replaceAllLiteralMatches(markdown, query, replaceValue) {
  const text = String(markdown ?? "");
  const needle = String(query ?? "");
  const replacement = String(replaceValue ?? "");

  if (!needle) {
    return {
      text,
      nextMatches: [],
      replacedCount: 0
    };
  }

  const replacedCount = findLiteralMatches(text, needle).length;
  const nextText = text.split(needle).join(replacement);

  return {
    text: nextText,
    nextMatches: findLiteralMatches(nextText, needle),
    replacedCount
  };
}





