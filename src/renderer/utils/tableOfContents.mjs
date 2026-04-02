export function isTableOfContentsToken(value) {
  return String(value || "").trim().toUpperCase() === "[TOC]";
}
