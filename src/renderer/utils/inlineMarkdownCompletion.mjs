const CLOSING_TRIGGER_CHARACTERS = new Set(["*", "_", "~", "=", "^", "`", ")"]);

const INLINE_COMPLETION_PATTERNS = [
  { type: "boldItalic", regex: /(\*\*\*(?=\S)[^\n]*?\S\*\*\*)$/ },
  { type: "boldItalic", regex: /(___(?=\S)[^\n]*?\S___)$/ },
  { type: "bold", regex: /(\*\*(?=\S)[^\n]*?\S\*\*)$/ },
  { type: "bold", regex: /(__(?=\S)[^\n]*?\S__)$/ },
  { type: "italic", regex: /(?:^|[^*])(\*(?=\S)[^*\n]+?\S\*)$/ },
  { type: "italic", regex: /(?:^|[^_])(_(?=\S)[^_\n]+?\S_)$/ },
  { type: "strike", regex: /(~~(?=\S)[^~\n]+?\S~~)$/ },
  { type: "highlight", regex: /(==(?=\S)[^=\n]+?\S==)$/ },
  { type: "subscript", regex: /(?:^|[^~])(~(?=\S)[^~\n]+?\S~)$/ },
  { type: "superscript", regex: /(\^(?=\S)[^^\n]+?\S\^)$/ },
  { type: "code", regex: /((`+)[^`\n](?:[\s\S]*?[^`\n])?\2)$/ },
  {
    type: "link",
    regex:
      /(\[[^\]]+\]\(\s*(<[^>\r\n]+>|(?:\\.|[^\\\s)])+)(?:\s+((?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\((?:\\.|[^)])*\))))?\s*\))$/
  }
];

export function getCompletedInlineMarkdownMatch(value) {
  const prefix = String(value || "");
  if (!prefix) {
    return null;
  }

  for (const pattern of INLINE_COMPLETION_PATTERNS) {
    const match = pattern.regex.exec(prefix);
    const completedText = match?.[1];
    if (!completedText) {
      continue;
    }
    const end = prefix.length;
    return {
      type: pattern.type,
      text: completedText,
      start: end - completedText.length,
      end
    };
  }

  return null;
}

export function prefixEndsWithCompletedInlineMarkdown(value) {
  return Boolean(getCompletedInlineMarkdownMatch(value));
}

export function shouldDeferInlineMarkdownRender(beforeCursor, insertedText, afterCursor = "") {
  if (!CLOSING_TRIGGER_CHARACTERS.has(String(insertedText || ""))) {
    return false;
  }

  const prefix = `${String(beforeCursor || "")}${String(insertedText || "")}`;
  void afterCursor;
  return Boolean(getCompletedInlineMarkdownMatch(prefix));
}
