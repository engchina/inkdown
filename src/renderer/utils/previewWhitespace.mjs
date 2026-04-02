const NON_BREAKING_SPACE = "\u00A0";
const SKIP_SELECTOR = "pre, code, kbd, samp, textarea, .katex, .mermaid";

function shouldSkipWhitespacePreservation(node) {
  const parentElement = node.parentElement;
  if (!parentElement) {
    return true;
  }

  return parentElement.closest(SKIP_SELECTOR) !== null;
}

function preserveEdgeSpaces(value) {
  if (!/\S/.test(value)) {
    return value;
  }

  return value
    .replace(/^ +/, (spaces) => NON_BREAKING_SPACE.repeat(spaces.length))
    .replace(/ +$/, (spaces) => NON_BREAKING_SPACE.repeat(spaces.length));
}

export function preservePreviewLiteralWhitespace(container) {
  const nodeFilter = container?.ownerDocument?.defaultView?.NodeFilter;
  if (!container?.ownerDocument?.createTreeWalker || !nodeFilter) {
    return container;
  }

  const textNodes = [];
  const walker = container.ownerDocument.createTreeWalker(container, nodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();

  while (currentNode) {
    textNodes.push(currentNode);
    currentNode = walker.nextNode();
  }

  textNodes.forEach((node) => {
    if (!node.nodeValue?.includes(" ") || shouldSkipWhitespacePreservation(node)) {
      return;
    }

    const nextValue = preserveEdgeSpaces(node.nodeValue);
    if (nextValue !== node.nodeValue) {
      node.nodeValue = nextValue;
    }
  });

  return container;
}
