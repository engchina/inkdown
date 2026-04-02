import { createMarkdownTurndown } from "./clipboardMarkdown.mjs";

function escapeMarkdownTitle(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function createContainer(html) {
  const container = document.createElement("div");
  container.innerHTML = String(html || "");
  return container;
}

function createPlaceholder(index) {
  return `INKDOWNMDTOKEN${index}X`;
}

function buildLinkCloseToken(element) {
  const href = element.getAttribute("href") || "";
  const title = element.getAttribute("title");
  return `](${href}${title ? ` "${escapeMarkdownTitle(title)}"` : ""})`;
}

function getElementTokens(element) {
  const openToken = element.getAttribute("data-md-open-token");
  const closeToken = element.getAttribute("data-md-close-token");
  if (openToken != null || closeToken != null) {
    return {
      openToken: openToken ?? "",
      closeToken: closeToken ?? ""
    };
  }

  switch (element.tagName) {
    case "STRONG":
      return { openToken: "**", closeToken: "**" };
    case "EM":
      return { openToken: "*", closeToken: "*" };
    case "DEL":
      return { openToken: "~~", closeToken: "~~" };
    case "CODE":
      return { openToken: "`", closeToken: "`" };
    case "MARK":
      return { openToken: "==", closeToken: "==" };
    case "SUB":
      return { openToken: "~", closeToken: "~" };
    case "SUP":
      return { openToken: "^", closeToken: "^" };
    case "A":
      return { openToken: "[", closeToken: buildLinkCloseToken(element) };
    default:
      return null;
  }
}

function isTokenizedInlineElement(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  if (element.tagName === "CODE" && element.closest("pre")) {
    return false;
  }
  return ["STRONG", "EM", "DEL", "CODE", "MARK", "SUB", "SUP", "A"].includes(element.tagName);
}

function replacePlaceholders(value, placeholderMap) {
  let output = String(value || "");
  let changed = true;
  while (changed) {
    changed = false;
    placeholderMap.forEach((replacement, placeholder) => {
      if (output.includes(placeholder)) {
        output = output.split(placeholder).join(replacement);
        changed = true;
      }
    });
  }
  return output;
}

export function serializeEditorHtmlToMarkdown(html, turndown) {
  const container = createContainer(html);
  const placeholderMap = new Map();
  const elements = Array.from(container.querySelectorAll("strong, em, del, code, mark, sub, sup, a[href]"));

  elements.reverse().forEach((element) => {
    if (!isTokenizedInlineElement(element)) {
      return;
    }
    const tokens = getElementTokens(element);
    if (!tokens) {
      return;
    }
    const placeholder = createPlaceholder(placeholderMap.size);
    const content = element.textContent || "";
    placeholderMap.set(placeholder, `${tokens.openToken}${content}${tokens.closeToken}`);
    element.replaceWith(container.ownerDocument.createTextNode(placeholder));
  });

  const service = turndown || createMarkdownTurndown();
  service.escape = (value) => String(value || "");
  const markdown = service.turndown(container.innerHTML);
  return replacePlaceholders(markdown, placeholderMap);
}
