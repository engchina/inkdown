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

export function buildLinkedSourceSelection(markdown, selectionStart, selectionEnd, text, url, fallbackText = "link text") {
  const source = String(markdown ?? "");
  const start = Math.max(0, Math.min(selectionStart ?? 0, source.length));
  const end = Math.max(start, Math.min(selectionEnd ?? start, source.length));
  const before = source.slice(0, start);
  const selected = source.slice(start, end);
  const after = source.slice(end);
  const label = String(text || "").trim() || selected || fallbackText;
  const href = String(url || "").trim();
  const linkMarkdown = `[${label}](${href})`;
  const nextText = `${before}${linkMarkdown}${after}`;
  const labelStart = before.length + 1;

  return {
    text: nextText,
    selectionStart: labelStart,
    selectionEnd: labelStart + label.length
  };
}

function formatMarkdownDestination(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return /[\s()]/.test(normalized) ? `<${normalized}>` : normalized;
}

function formatMarkdownImageTitle(value) {
  const normalized = String(value || "").trim();
  return normalized ? ` "${normalized.replaceAll('"', '\\"')}"` : "";
}

export function findMarkdownLinkAtSelection(markdown, selectionStart, selectionEnd) {
  const source = String(markdown ?? "");
  const start = Math.max(0, Math.min(selectionStart ?? 0, source.length));
  const end = Math.max(start, Math.min(selectionEnd ?? start, source.length));
  const linkPattern = /\[([^\]]+)\]\(([^)\r\n]+)\)/g;

  for (const match of source.matchAll(linkPattern)) {
    const matchStart = match.index ?? 0;
    const matchEnd = matchStart + match[0].length;
    const overlaps = start <= matchEnd && end >= matchStart;
    const cursorInside = start === end && start >= matchStart && start <= matchEnd;
    if (!overlaps && !cursorInside) {
      continue;
    }

    const label = match[1];
    const url = match[2];
    const labelStart = matchStart + 1;
    return {
      start: matchStart,
      end: matchEnd,
      text: label,
      url,
      textStart: labelStart,
      textEnd: labelStart + label.length
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
  const linkMarkdown = `[${text}](${url})`;
  const nextText = `${source.slice(0, match.start)}${linkMarkdown}${source.slice(match.end)}`;
  const textStart = match.start + 1;

  return {
    text: nextText,
    selectionStart: textStart,
    selectionEnd: textStart + text.length
  };
}

export function buildRemovedMarkdownLinkSelection(markdown, selectionStart, selectionEnd) {
  const source = String(markdown ?? "");
  const match = findMarkdownLinkAtSelection(source, selectionStart, selectionEnd);
  if (!match) {
    return null;
  }

  const replacement = match.text || "";
  const nextText = `${source.slice(0, match.start)}${replacement}${source.slice(match.end)}`;
  return {
    text: nextText,
    selectionStart: match.start,
    selectionEnd: match.start + replacement.length
  };
}

export function findMarkdownImageAtSelection(markdown, selectionStart, selectionEnd) {
  const source = String(markdown ?? "");
  const start = Math.max(0, Math.min(selectionStart ?? 0, source.length));
  const end = Math.max(start, Math.min(selectionEnd ?? start, source.length));
  const imagePattern =
    /!\[([^\]]*)\]\(\s*(<[^>\r\n]+>|(?:\\.|[^\\\s)])+)(?:\s+((?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\((?:\\.|[^)])*\))))?\s*\)/g;

  for (const match of source.matchAll(imagePattern)) {
    const matchStart = match.index ?? 0;
    const matchEnd = matchStart + match[0].length;
    const overlaps = start <= matchEnd && end >= matchStart;
    const cursorInside = start === end && start >= matchStart && start <= matchEnd;
    if (!overlaps && !cursorInside) {
      continue;
    }

    const alt = match[1] || "";
    const rawSource = match[2] || "";
    const title = String(match[3] || "").trim().replace(/^["'(]+|["')]+$/g, "");
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
  const imageMarkdown = `![${alt}](${formatMarkdownDestination(url)}${formatMarkdownImageTitle(title)})`;
  const nextText = `${source.slice(0, match.start)}${imageMarkdown}${source.slice(match.end)}`;
  const altStart = match.start + 2;

  return {
    text: nextText,
    selectionStart: altStart,
    selectionEnd: altStart + alt.length
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
