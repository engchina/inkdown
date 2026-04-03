const DANGEROUS_TAG_NAMES = new Set([
  "base",
  "embed",
  "form",
  "frame",
  "frameset",
  "foreignobject",
  "iframe",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "link",
  "meta",
  "object",
  "script",
  "style"
]);

const URL_ATTRIBUTE_NAMES = new Set(["action", "formaction", "href", "poster", "src", "srcset", "xlink:href"]);

function normalizeUrlCandidate(value) {
  return String(value || "").replace(/[\u0000-\u001f\u007f\s]+/g, "").trim();
}

function isRelativeUrl(value) {
  return !/^[a-z][a-z\d+.-]*:/i.test(value);
}

function getUrlProtocol(value) {
  const compact = normalizeUrlCandidate(value);
  const match = /^([a-z][a-z\d+.-]*:)/i.exec(compact);
  return match ? match[1].toLowerCase() : "";
}

export function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function describeBlockedRemoteMedia(tagName, value) {
  const normalizedTag = String(tagName || "").toLowerCase();
  const protocol = getUrlProtocol(value);
  const protocolLabel = protocol ? protocol.replace(/:$/, "").toUpperCase() : "REMOTE";
  const mediaLabel =
    normalizedTag === "img"
      ? "image"
      : normalizedTag === "audio"
        ? "audio"
        : normalizedTag === "video"
          ? "video"
          : "media";

  return {
    title: `Blocked insecure remote ${mediaLabel}`,
    detail: `${protocolLabel} ${mediaLabel} is disabled by current security settings.`
  };
}

function createBlockedMediaPlaceholder(documentRef, tagName, value) {
  const { title, detail } = describeBlockedRemoteMedia(tagName, value);
  const wrapper = documentRef.createElement("figure");
  wrapper.className = "remote-media-placeholder";
  wrapper.setAttribute("data-media-kind", String(tagName || "media").toLowerCase());

  const titleElement = documentRef.createElement("div");
  titleElement.className = "remote-media-placeholder-title";
  titleElement.textContent = title;

  const detailElement = documentRef.createElement("div");
  detailElement.className = "remote-media-placeholder-copy";
  detailElement.textContent = detail;

  wrapper.appendChild(titleElement);
  wrapper.appendChild(detailElement);

  const openHref = sanitizePreviewUrl(value, {
    allowHttpUrls: true,
    allowHttpsUrls: true
  });
  if (openHref) {
    const actionLink = documentRef.createElement("a");
    actionLink.className = "remote-media-placeholder-link";
    actionLink.href = openHref;
    actionLink.target = "_blank";
    actionLink.rel = "noopener noreferrer";
    actionLink.textContent = "Open original";
    wrapper.appendChild(actionLink);
  }

  return wrapper;
}

export function sanitizePreviewUrl(value, options = {}) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  const compact = normalizeUrlCandidate(normalized);
  if (!compact) {
    return "";
  }

  if (compact.startsWith("#") || compact.startsWith("/") || compact.startsWith("./") || compact.startsWith("../") || compact.startsWith("?")) {
    return normalized;
  }

  if (isRelativeUrl(compact)) {
    return normalized;
  }

  const lower = compact.toLowerCase();
  if ((options.allowHttpUrls ?? true) && lower.startsWith("http:")) {
    return normalized;
  }

  if ((options.allowHttpsUrls ?? true) && lower.startsWith("https:")) {
    return normalized;
  }

  if ((options.allowMailtoUrls ?? true) && lower.startsWith("mailto:")) {
    return normalized;
  }

  if ((options.allowTelUrls ?? true) && lower.startsWith("tel:")) {
    return normalized;
  }

  if (options.allowAssetUrls && lower.startsWith("inkdown-asset:")) {
    return normalized;
  }

  if (options.allowBlobUrls && lower.startsWith("blob:")) {
    return normalized;
  }

  if (options.allowFileUrls && lower.startsWith("file:")) {
    return normalized;
  }

  if (options.allowDataImageUrls && /^data:image\/[a-z0-9.+-]+(;|,)/i.test(compact)) {
    return normalized;
  }

  return "";
}

export function sanitizePreviewSrcset(value, options = {}) {
  const candidates = String(value || "")
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean);

  const nextCandidates = candidates
    .map((candidate) => {
      const match = /^(\S+)(\s+.+)?$/.exec(candidate);
      if (!match) {
        return "";
      }

      const sanitizedUrl = sanitizePreviewUrl(match[1], options);
      if (!sanitizedUrl) {
        return "";
      }

      return `${sanitizedUrl}${match[2] || ""}`;
    })
    .filter(Boolean);

  return nextCandidates.join(", ");
}

export function sanitizePreviewContainer(container, options = {}) {
  if (!container?.querySelectorAll) {
    return container;
  }

  const elements = Array.from(container.querySelectorAll("*"));
  elements.forEach((element) => {
    const tagName = element.tagName.toLowerCase();
    if (DANGEROUS_TAG_NAMES.has(tagName)) {
      element.remove();
      return;
    }

    let removeElement = false;
    Array.from(element.attributes).forEach((attribute) => {
      if (removeElement) {
        return;
      }

      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || name === "srcdoc") {
        element.removeAttribute(attribute.name);
        return;
      }

      if (!URL_ATTRIBUTE_NAMES.has(name)) {
        return;
      }

      const isLinkHref = tagName === "a" && (name === "href" || name === "xlink:href");
      const urlOptions = {
        allowHttpUrls: true,
        allowHttpsUrls: true,
        allowMailtoUrls: isLinkHref,
        allowTelUrls: isLinkHref,
        allowAssetUrls: true,
        allowBlobUrls: tagName === "img" || tagName === "audio" || tagName === "video" || tagName === "source",
        allowDataImageUrls: tagName === "img" || tagName === "source",
        allowFileUrls: Boolean(options.allowFileUrls)
      };

      const sanitized =
        name === "srcset"
          ? sanitizePreviewSrcset(attribute.value, urlOptions)
          : sanitizePreviewUrl(attribute.value, urlOptions);

      if (sanitized) {
        element.setAttribute(attribute.name, sanitized);
      } else {
        const blockedValue = attribute.value;
        element.removeAttribute(attribute.name);
        if (tagName === "img" && name === "src") {
          element.replaceWith(createBlockedMediaPlaceholder(container.ownerDocument || document, tagName, blockedValue));
          removeElement = true;
        }
        if ((tagName === "audio" || tagName === "video") && name === "src") {
          element.replaceWith(createBlockedMediaPlaceholder(container.ownerDocument || document, tagName, blockedValue));
          removeElement = true;
        }
        if (tagName === "source" && (name === "src" || name === "srcset")) {
          if (blockedValue && element.parentElement?.matches?.("audio, video")) {
            element.parentElement.setAttribute("data-blocked-media-source", blockedValue);
          }
          removeElement = !element.getAttribute("src") && !element.getAttribute("srcset");
        }
      }
    });

    if (removeElement) {
      element.remove();
      return;
    }

    if (tagName === "a" && element.getAttribute("target") === "_blank") {
      element.setAttribute("rel", "noopener noreferrer");
    }
  });

  Array.from(container.querySelectorAll("audio, video")).forEach((element) => {
    if (element.getAttribute("src")) {
      return;
    }

    const remainingSources = Array.from(element.querySelectorAll("source")).filter(
      (source) => source.getAttribute("src") || source.getAttribute("srcset")
    );
    if (remainingSources.length > 0) {
      return;
    }

    element.replaceWith(
      createBlockedMediaPlaceholder(
        container.ownerDocument || document,
        element.tagName.toLowerCase(),
        element.getAttribute("data-blocked-media-source") || ""
      )
    );
  });

  return container;
}

export function sanitizePreviewHtml(html, options = {}) {
  if (typeof document === "undefined") {
    return String(html || "");
  }

  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  sanitizePreviewContainer(template.content, options);
  return template.innerHTML;
}
