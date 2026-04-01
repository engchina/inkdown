export function resolveEditingSurface(viewMode, lastActiveSurface = "editor") {
  if (viewMode === "source") {
    return "source";
  }

  if (viewMode === "preview") {
    return "preview";
  }

  if (viewMode === "split") {
    return lastActiveSurface === "source" ? "source" : "editor";
  }

  return "editor";
}
