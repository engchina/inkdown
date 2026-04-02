import { Marked } from "marked";

const tokenMarked = new Marked({ gfm: true, breaks: true });

const TOKEN_TYPE_TO_TAG = Object.freeze({
  strong: "STRONG",
  em: "EM",
  del: "DEL",
  codespan: "CODE",
  link: "A"
});

const STANDARD_SELECTOR = "strong, em, del, code, a[href]";

function getTokenInnerRaw(token) {
  if (Array.isArray(token?.tokens) && token.tokens.length) {
    return token.tokens.map((child) => child?.raw ?? child?.text ?? "").join("");
  }
  return String(token?.text ?? "");
}

function deriveTokenWrapper(token) {
  if (!token?.raw) {
    return null;
  }

  if (token.type === "codespan") {
    const match = /^(`+)[\s\S]*?\1$/.exec(token.raw);
    if (!match) {
      return { openToken: "`", closeToken: "`" };
    }
    return { openToken: match[1], closeToken: match[1] };
  }

  const innerRaw = getTokenInnerRaw(token);
  const innerIndex = token.raw.indexOf(innerRaw);
  if (innerIndex < 0) {
    return null;
  }

  return {
    openToken: token.raw.slice(0, innerIndex),
    closeToken: token.raw.slice(innerIndex + innerRaw.length)
  };
}

function collectInlineDescriptors(tokens, descriptors = [], depth = 0) {
  if (!Array.isArray(tokens)) {
    return descriptors;
  }

  tokens.forEach((token) => {
    const tagName = TOKEN_TYPE_TO_TAG[token?.type];
    if (tagName) {
      const wrapper = deriveTokenWrapper(token);
      if (wrapper) {
        descriptors.push({
          tagName,
          depth,
          openToken: wrapper.openToken,
          closeToken: wrapper.closeToken
        });
      }
      if (Array.isArray(token.tokens)) {
        collectInlineDescriptors(token.tokens, descriptors, depth + 1);
      }
      return;
    }

    if (Array.isArray(token?.tokens)) {
      collectInlineDescriptors(token.tokens, descriptors, depth);
    }

    if (Array.isArray(token?.items)) {
      token.items.forEach((item) => {
        if (Array.isArray(item?.tokens)) {
          collectInlineDescriptors(item.tokens, descriptors, depth);
        }
        if (Array.isArray(item?.items)) {
          collectInlineDescriptors(item.items, descriptors, depth);
        }
      });
    }

    if (Array.isArray(token?.header)) {
      token.header.forEach((cell) => collectInlineDescriptors(cell?.tokens || [], descriptors, depth));
    }

    if (Array.isArray(token?.rows)) {
      token.rows.forEach((row) => {
        row.forEach((cell) => collectInlineDescriptors(cell?.tokens || [], descriptors, depth));
      });
    }
  });

  return descriptors;
}

function getDomStandardInlineElements(container) {
  return Array.from(container.querySelectorAll(STANDARD_SELECTOR)).filter((element) => {
    if (element.tagName === "CODE" && element.closest("pre")) {
      return false;
    }
    return true;
  });
}

function setTokenAttributes(element, { openToken, closeToken, depth }) {
  if (!element) {
    return;
  }
  element.setAttribute("data-md-open-token", openToken);
  element.setAttribute("data-md-close-token", closeToken);
  element.setAttribute("data-md-depth", String(depth));
}

function annotateFixedTokenElements(container) {
  Array.from(container.querySelectorAll("mark")).forEach((element) => {
    if (!element.hasAttribute("data-md-open-token")) {
      setTokenAttributes(element, { openToken: "==", closeToken: "==", depth: 0 });
    }
  });

  Array.from(container.querySelectorAll("sub")).forEach((element) => {
    if (!element.hasAttribute("data-md-open-token")) {
      setTokenAttributes(element, { openToken: "~", closeToken: "~", depth: 0 });
    }
  });

  Array.from(container.querySelectorAll("sup")).forEach((element) => {
    if (!element.classList.contains("footnote-ref") && !element.hasAttribute("data-md-open-token")) {
      setTokenAttributes(element, { openToken: "^", closeToken: "^", depth: 0 });
    }
  });
}

function applyFallbackTokenDefaults(container) {
  Array.from(container.querySelectorAll(STANDARD_SELECTOR)).forEach((element) => {
    if (element.tagName === "CODE" && element.closest("pre")) {
      return;
    }
    if (element.hasAttribute("data-md-open-token")) {
      return;
    }

    switch (element.tagName) {
      case "STRONG":
        setTokenAttributes(element, { openToken: "**", closeToken: "**", depth: 0 });
        break;
      case "EM":
        setTokenAttributes(element, { openToken: "*", closeToken: "*", depth: 0 });
        break;
      case "DEL":
        setTokenAttributes(element, { openToken: "~~", closeToken: "~~", depth: 0 });
        break;
      case "CODE":
        setTokenAttributes(element, { openToken: "`", closeToken: "`", depth: 0 });
        break;
      case "A": {
        const href = element.getAttribute("href") || "";
        const title = element.getAttribute("title");
        const closeToken = `](${href}${title ? ` "${String(title).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : ""})`;
        setTokenAttributes(element, { openToken: "[", closeToken, depth: 0 });
        break;
      }
      default:
        break;
    }
  });
}

export function annotateInlineMarkdownTokens(container, markdown) {
  if (!container) {
    return container;
  }

  const descriptors = collectInlineDescriptors(tokenMarked.lexer(String(markdown || "")));
  const elements = getDomStandardInlineElements(container);

  let elementIndex = 0;
  for (const descriptor of descriptors) {
    while (elementIndex < elements.length && elements[elementIndex].tagName !== descriptor.tagName) {
      elementIndex += 1;
    }
    if (elementIndex >= elements.length) {
      break;
    }
    setTokenAttributes(elements[elementIndex], descriptor);
    elementIndex += 1;
  }

  annotateFixedTokenElements(container);
  applyFallbackTokenDefaults(container);
  return container;
}
