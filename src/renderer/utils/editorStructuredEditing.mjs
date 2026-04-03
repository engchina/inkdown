export function getEmptyListEnterStrategy(state = {}) {
  if (state.inTaskItem) {
    return "exit";
  }

  if (state.inListItem) {
    return "default";
  }

  return "ignore";
}

export function getDelayedParagraphTransform(beforeCursor = "", insertedText = "") {
  if (!/\S/.test(insertedText)) {
    return null;
  }

  if (/^[-*+]\s\[(?: |x|X)\]\s$/.test(beforeCursor)) {
    return { kind: "taskList" };
  }

  if (/^>\s$/.test(beforeCursor)) {
    return { kind: "blockquote" };
  }

  if (/^[-*+]\s$/.test(beforeCursor)) {
    return { kind: "bulletList" };
  }

  if (/^\d+\.\s$/.test(beforeCursor)) {
    return { kind: "orderedList" };
  }

  return null;
}

export function getDelayedHeadingTransform(line = "", caretAtEnd = false) {
  if (!caretAtEnd) {
    return null;
  }

  const match = /^(#{1,6})\s+(.*\S.*|\S)\s*$/.exec(line);
  if (!match) {
    return null;
  }

  return {
    level: match[1].length,
    title: match[2].trimEnd()
  };
}

export function getDelayedThematicBreakTransform(line = "", caretAtEnd = false) {
  if (!caretAtEnd) {
    return null;
  }

  const match = /^\s*([*_ -]+)\s*$/.exec(line);
  if (!match) {
    return null;
  }

  const compact = match[1].replace(/\s+/g, "");
  if (!/^(?:---+|\*\*\*+|___+)$/.test(compact)) {
    return null;
  }

  return {
    marker: compact.slice(0, 3)
  };
}


