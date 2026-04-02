import { Marked } from "marked";

const CLOSING_TRIGGER_CHARACTERS = new Set(["*", "_", "~", "=", "^", "`", ")"]);
const exactInlineMarked = new Marked({ gfm: true, breaks: true });

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

function findTrailingCompletedMatch(value) {
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

export function getCompletedInlineMarkdownMatch(value) {
  return findTrailingCompletedMatch(value);
}

export function isWholeTextCompletedInlineMarkdown(value) {
  const text = String(value || "");
  if (!text) {
    return false;
  }

  const tokens = exactInlineMarked.lexer(text);
  if (tokens.length !== 1 || tokens[0]?.type !== "paragraph") {
    return false;
  }

  const inlineTokens = tokens[0]?.tokens || [];
  return inlineTokens.length === 1 && inlineTokens[0]?.raw === text;
}

export function getCompletedInlineMarkdownMatchAroundCursor(value, cursorOffset) {
  const text = String(value || "");
  const cursor = Math.max(0, Math.min(Number(cursorOffset) || 0, text.length));
  if (!text) {
    return null;
  }

  let bestMatch = null;

  for (let start = 0; start <= cursor; start += 1) {
    for (let end = cursor; end <= text.length; end += 1) {
      const candidate = text.slice(start, end);
      const match = findTrailingCompletedMatch(candidate);
      if (!match) {
        continue;
      }

      const absoluteStart = start + match.start;
      const absoluteEnd = start + match.end;
      if (cursor < absoluteStart || cursor > absoluteEnd) {
        continue;
      }

      if (
        !bestMatch ||
        absoluteStart < bestMatch.start ||
        (
          absoluteStart === bestMatch.start &&
          absoluteEnd > bestMatch.end
        )
      ) {
        bestMatch = {
          type: match.type,
          text: match.text,
          start: absoluteStart,
          end: absoluteEnd
        };
      }
    }
  }

  return bestMatch;
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
