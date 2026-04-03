import TurndownService from "turndown";

function createContainer(html) {
  const container = document.createElement("div");
  container.innerHTML = String(html || "");
  return container;
}

function resolveClipboardUrl(value, baseHref) {
  const normalized = String(value || "").trim();
  if (!normalized || !baseHref) {
    return normalized;
  }
  try {
    return new URL(normalized, baseHref).href;
  } catch {
    return normalized;
  }
}

function cleanupClipboardHtml(container) {
  const baseHref = container.querySelector("base[href]")?.getAttribute("href") || "";
  container.querySelectorAll("script, style, meta, link, noscript, template").forEach((node) => node.remove());

  container.querySelectorAll("li").forEach((item) => {
    const checkbox = item.querySelector(':scope > input[type="checkbox"], :scope > p > input[type="checkbox"]');
    if (!checkbox) {
      return;
    }
    item.setAttribute("data-clipboard-task-item", "true");
    item.setAttribute("data-checked", checkbox.checked ? "true" : "false");
    checkbox.remove();
  });

  container.querySelectorAll("img").forEach((image) => {
    const source = [
      image.getAttribute("data-md-src"),
      image.getAttribute("data-canonical-src"),
      image.getAttribute("data-original-src"),
      image.getAttribute("data-original"),
      image.getAttribute("data-actualsrc"),
      image.getAttribute("data-src"),
      image.getAttribute("data-lazy-src"),
      image.getAttribute("src")
    ].find((candidate) => String(candidate || "").trim());
    if (source) {
      image.setAttribute("data-md-src", resolveClipboardUrl(source, baseHref));
    }
    const src = image.getAttribute("src");
    if (src) {
      image.setAttribute("src", resolveClipboardUrl(src, baseHref));
    }
  });

  container.querySelectorAll("a[href]").forEach((link) => {
    link.setAttribute("href", resolveClipboardUrl(link.getAttribute("href"), baseHref));
  });

  container.querySelectorAll("base").forEach((node) => node.remove());
  return container;
}

function escapeMarkdownImageAlt(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function escapeMarkdownTitle(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatMarkdownImageSource(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  return /[\s()]/.test(normalized) ? `<${normalized}>` : normalized;
}

function isLikelyImageUrl(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return false;
  }
  if (/^data:image\//i.test(normalized)) {
    return true;
  }
  return /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp)(?:$|[?#])/i.test(normalized);
}

function getLinkedImageOverrideSource(node) {
  const parent = node.parentElement;
  if (!parent || parent.nodeName !== "A") {
    return "";
  }

  const meaningfulChildren = Array.from(parent.childNodes).filter((child) => {
    if (child.nodeType === 3) {
      return String(child.textContent || "").trim();
    }
    return child.nodeType === 1;
  });
  if (meaningfulChildren.length !== 1 || meaningfulChildren[0] !== node) {
    return "";
  }

  const href = parent.getAttribute("href");
  return isLikelyImageUrl(href) ? href : "";
}

function serializeMarkdownImage(node, { inline = false } = {}) {
  const source = formatMarkdownImageSource(
    getLinkedImageOverrideSource(node) || node.getAttribute("data-md-src") || node.getAttribute("src")
  );
  if (!source) {
    return "";
  }

  const alt = escapeMarkdownImageAlt(node.getAttribute("alt"));
  const title = node.getAttribute("title");
  const markdown = `![${alt}](${source}${title ? ` "${escapeMarkdownTitle(title)}"` : ""})`;
  return inline ? markdown : `\n\n${markdown}\n\n`;
}

function escapeTableCell(content) {
  const normalized = String(content || "").replace(/\r?\n/g, "<br>").replace(/\|/g, "\\|").trim();
  return normalized || " ";
}

export function createMarkdownTurndown() {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*"
  });

  const serializeTableCell = (cell) => {
    const markdown = turndown.turndown(cell.innerHTML || "").trim();
    return escapeTableCell(markdown || cell.textContent || "");
  };

  const serializeTable = (node) => {
    const rows = Array.from(node.rows || []);
    if (rows.length === 0) {
      return "";
    }

    const columnCount = Math.max(...rows.map((row) => row.cells.length));
    if (columnCount === 0) {
      return "";
    }

    const toMarkdownRow = (row) => {
      const cells = Array.from(row.cells || []);
      const values = Array.from({ length: columnCount }, (_, index) =>
        cells[index] ? serializeTableCell(cells[index]) : " "
      );
      return `| ${values.join(" | ")} |`;
    };

    const alignmentRowSource = rows[0];
    const headerRow = toMarkdownRow(rows[0]);
    const dividerRow = `| ${Array.from({ length: columnCount }, (_, index) => {
      const cell = alignmentRowSource?.cells?.[index];
      const align = cell?.style?.textAlign || cell?.getAttribute?.("data-align") || "";
      if (align === "center") {
        return ":---:";
      }
      if (align === "right") {
        return "---:";
      }
      return "---";
    }).join(" | ")} |`;
    const bodyRows = rows.slice(1).map(toMarkdownRow);
    return `\n\n${[headerRow, dividerRow, ...bodyRows].join("\n")}\n\n`;
  };

  turndown.addRule("taskListItems", {
    filter(node) {
      return (
        node.nodeName === "LI" &&
        (node.getAttribute("data-type") === "taskItem" || node.getAttribute("data-clipboard-task-item") === "true")
      );
    },
    replacement(content, node) {
      return `- [${node.getAttribute("data-checked") === "true" ? "x" : " "}] ${content.trim()}\n`;
    }
  });

  turndown.addRule("tables", {
    filter(node) {
      return node.nodeName === "TABLE";
    },
    replacement(content, node) {
      return serializeTable(node);
    }
  });

  turndown.addRule("images", {
    filter(node) {
      return node.nodeName === "IMG";
    },
    replacement(content, node) {
      return serializeMarkdownImage(node, { inline: node.parentElement?.nodeName === "A" });
    }
  });

  turndown.addRule("codeBlocksWithLanguage", {
    filter(node) {
      return node.nodeName === "PRE" && node.firstElementChild?.nodeName === "CODE";
    },
    replacement(content, node) {
      const code = node.firstElementChild;
      const language =
        code?.getAttribute("data-language") ||
        (code?.getAttribute("class") || "")
          .split(/\s+/)
          .find((value) => value.startsWith("language-"))
          ?.replace(/^language-/, "") ||
        "";
      const value = code?.textContent?.replace(/\\n$/, "") || "";
      if (language === "math") {
        return `\n\n$$\n${value}\n$$\n\n`;
      }
      return `\n\n\`\`\`${language}\n${value}\n\`\`\`\n\n`;
    }
  });

  turndown.addRule("headings", {
    filter(node) {
      return /^H[1-6]$/.test(node.nodeName);
    },
    replacement(content, node) {
      const level = Number(node.nodeName.slice(1));
      const prefix = "#".repeat(level);
      const text = content.trim();
      return `\n\n${prefix} ${text}\n\n`;
    }
  });

  turndown.addRule("tableOfContents", {
    filter(node) {
      return node.nodeType === 1 && node.classList?.contains("table-of-contents");
    },
    replacement() {
      return "\n\n[TOC]\n\n";
    }
  });

  turndown.addRule("highlight", {
    filter(node) {
      return node.nodeName === "MARK";
    },
    replacement(content) {
      return `==${content}==`;
    }
  });

  turndown.addRule("subscript", {
    filter(node) {
      return node.nodeName === "SUB";
    },
    replacement(content) {
      return `~${content}~`;
    }
  });

  turndown.addRule("superscript", {
    filter(node) {
      return node.nodeName === "SUP" && !node.classList?.contains("footnote-ref");
    },
    replacement(content) {
      return `^${content}^`;
    }
  });

  return turndown;
}

const clipboardTurndown = createMarkdownTurndown();

export function normalizeMarkdownBlock(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^((?:[-*+]|\d+\.))[ \t]{2,}/gm, "$1 ")
    .replace(/^(#{1,6})(\S)/gm, "$1 $2")
    .trim();
}

export function serializeHtmlToMarkdown(html) {
  const container = cleanupClipboardHtml(createContainer(html));
  return clipboardTurndown.turndown(container.innerHTML);
}

export function convertClipboardHtmlToMarkdown(html) {
  return normalizeMarkdownBlock(serializeHtmlToMarkdown(html));
}

export function hasStructuredClipboardHtml(html, plainText = "") {
  const markup = String(html || "").trim();
  if (!markup) {
    return false;
  }

  const container = cleanupClipboardHtml(createContainer(markup));
  if (!container.querySelector("*")) {
    return false;
  }

  if (
    container.querySelector(
      "img, table, pre, blockquote, ul, ol, li, h1, h2, h3, h4, h5, h6, a[href], strong, b, em, i, code, mark, sub, sup, hr"
    )
  ) {
    return true;
  }

  if (
    container.querySelector(
      "p, article, section, aside, main, nav, figure, figcaption, header, footer, dl, fieldset"
    )
  ) {
    return true;
  }

  const blockChildren = Array.from(container.children).filter((node) =>
    /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|DIV|DL|FIELDSET|FIGCAPTION|FIGURE|FOOTER|FORM|H[1-6]|HEADER|HR|LI|MAIN|NAV|OL|P|PRE|SECTION|TABLE|UL)$/i.test(
      node.nodeName
    )
  );
  if (blockChildren.length > 1) {
    return true;
  }

  const normalizedHtmlText = container.textContent?.replace(/\s+/g, " ").trim() || "";
  const normalizedPlainText = String(plainText || "").replace(/\s+/g, " ").trim();
  return normalizedHtmlText !== normalizedPlainText;
}





