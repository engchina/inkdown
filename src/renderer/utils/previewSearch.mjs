function isExcludedSearchContainer(node) {
  return Boolean(
    node?.closest?.("pre, code, .mermaid, .remote-media-placeholder, .katex, .katex-display")
  );
}

export function clearPreviewSearchHighlights(container) {
  if (!container?.querySelectorAll) {
    return;
  }

  container.querySelectorAll(".preview-find-hit").forEach((element) => {
    const textNode = document.createTextNode(element.textContent || "");
    element.replaceWith(textNode);
  });
  container.normalize?.();
}

export function applyPreviewSearchHighlights(container, query, currentIndex = 0) {
  if (!container) {
    return { count: 0, currentElement: null };
  }

  clearPreviewSearchHighlights(container);

  const needle = String(query || "");
  if (!needle) {
    return { count: 0, currentElement: null };
  }

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.includes(needle)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (isExcludedSearchContainer(node.parentElement)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  let matchCount = 0;
  let currentElement = null;

  textNodes.forEach((node) => {
    const value = node.nodeValue || "";
    let searchStart = 0;
    let foundAt = value.indexOf(needle, searchStart);
    if (foundAt === -1) {
      return;
    }

    const fragment = document.createDocumentFragment();
    while (foundAt !== -1) {
      if (foundAt > searchStart) {
        fragment.appendChild(document.createTextNode(value.slice(searchStart, foundAt)));
      }

      const hit = document.createElement("mark");
      hit.className = `preview-find-hit${matchCount === currentIndex ? " current" : ""}`;
      hit.textContent = needle;
      fragment.appendChild(hit);

      if (matchCount === currentIndex) {
        currentElement = hit;
      }

      matchCount += 1;
      searchStart = foundAt + needle.length;
      foundAt = value.indexOf(needle, searchStart);
    }

    if (searchStart < value.length) {
      fragment.appendChild(document.createTextNode(value.slice(searchStart)));
    }

    node.replaceWith(fragment);
  });

  return { count: matchCount, currentElement };
}
