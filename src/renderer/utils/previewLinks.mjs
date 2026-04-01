function isExternalProtocol(protocol) {
  return ["http:", "https:", "mailto:", "tel:"].includes(protocol);
}

function parsePreviewHref(href) {
  const value = String(href || "").trim();
  if (!value) {
    return { kind: "empty", href: "" };
  }

  if (value.startsWith("#")) {
    return { kind: "hash", href: value, hash: value.slice(1) };
  }

  try {
    const parsed = new URL(value);
    if (isExternalProtocol(parsed.protocol)) {
      return { kind: "external", href: parsed.toString(), protocol: parsed.protocol };
    }
  } catch {}

  return { kind: "other", href: value };
}

function escapeAttributeValue(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function findPreviewAnchorTarget(container, href) {
  const parsed = parsePreviewHref(href);
  if (parsed.kind !== "hash") {
    return null;
  }

  const decoded = decodeURIComponent(parsed.hash || "");
  if (!decoded) {
    return null;
  }

  return container?.querySelector?.(`[id="${escapeAttributeValue(decoded)}"]`) || null;
}

export async function activatePreviewLink(anchor, container, options = {}) {
  const parsed = parsePreviewHref(anchor?.getAttribute?.("href"));

  if (parsed.kind === "hash") {
    const target = findPreviewAnchorTarget(container, parsed.href);
    if (!target) {
      return { kind: "missing" };
    }

    target.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    target.classList.add("preview-anchor-target");
    const timerApi = options.windowObject || globalThis.window;
    timerApi?.setTimeout?.(() => target.classList.remove("preview-anchor-target"), 1200);
    return { kind: "hash", target };
  }

  if (parsed.kind === "external" && typeof options.openExternal === "function") {
    await options.openExternal(parsed.href);
    return { kind: "external", href: parsed.href };
  }

  return { kind: parsed.kind };
}
