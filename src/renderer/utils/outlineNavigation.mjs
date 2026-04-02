export function resolveOutlineNavigationSurface(viewMode) {
  if (viewMode === "preview") {
    return "preview";
  }

  if (viewMode === "source" || viewMode === "split") {
    return "source";
  }

  return "editor";
}

export function getCenteredSourceScrollTop(lineNumber, metrics = {}) {
  const safeLineNumber = Math.max(0, Number(lineNumber) || 0);
  const lineHeight = Math.max(1, Number(metrics.lineHeight) || 24);
  const paddingTop = Math.max(0, Number(metrics.paddingTop) || 0);
  const containerHeight = Math.max(0, Number(metrics.containerHeight) || 0);
  const targetTop = paddingTop + safeLineNumber * lineHeight;
  return Math.max(0, targetTop - Math.max(0, containerHeight - lineHeight) / 2);
}

export function getOutlineSourceSelectionRange(markdown, lineNumber, fallbackLength = 0) {
  const lines = String(markdown || "").split(/\r?\n/);
  const safeLineNumber = Math.max(0, Math.min(lines.length - 1, Number(lineNumber) || 0));
  let start = 0;

  for (let index = 0; index < safeLineNumber; index += 1) {
    start += lines[index].length + 1;
  }

  const line = lines[safeLineNumber] || "";
  const lineLength = line.length || Math.max(0, Number(fallbackLength) || 0);
  return {
    start,
    end: start + lineLength
  };
}
