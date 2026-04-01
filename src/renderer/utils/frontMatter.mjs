import * as yaml from "js-yaml";

export function splitTagTokens(value) {
  return String(value || "")
    .split(/[\r\n,;，；]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatFrontMatterDate(date = new Date(), includeTime = false) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  if (!includeTime) {
    return `${year}-${month}-${day}`;
  }

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function parseYamlObject(raw) {
  const normalized = String(raw || "").trim();
  if (!normalized) {
    return {};
  }

  try {
    const parsed = yaml.load(normalized);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return null;
  }
}

export function getYamlErrorDetails(error) {
  if (!error) {
    return {
      reason: "",
      line: null,
      column: null
    };
  }

  return {
    reason: error.reason || error.message || "",
    line: error.mark?.line != null ? error.mark.line + 1 : null,
    column: error.mark?.column != null ? error.mark.column + 1 : null
  };
}

export function summarizeFrontMatter(rawFrontMatter) {
  const normalized = String(rawFrontMatter || "").trim();
  if (!normalized) {
    return {
      hasFrontMatter: false,
      fieldCount: 0,
      parseFailed: false,
      isDraft: false,
      statusText: "Optional",
      tone: "muted"
    };
  }

  const content = normalized.replace(/^---\r?\n/, "").replace(/\r?\n---\s*$/, "");
  const parsed = parseYamlObject(content);
  const parseFailed = parsed === null;
  const fieldCount = parsed && typeof parsed === "object" ? Object.keys(parsed).length : 0;
  const isDraft = Boolean(parsed && typeof parsed === "object" && parsed.draft === true);

  return {
    hasFrontMatter: true,
    fieldCount,
    parseFailed,
    isDraft,
    statusText: parseFailed ? "Needs attention" : isDraft ? "Draft" : `${fieldCount} field${fieldCount === 1 ? "" : "s"}`,
    tone: parseFailed ? "warning" : isDraft ? "accent" : "neutral"
  };
}
