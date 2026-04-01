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
