export const INLINE_MARK_SELECTOR = "strong, b, em, i, s, del, code, mark, sub, sup";

const INLINE_MARK_TAG_TO_NAME = Object.freeze({
  STRONG: "bold",
  B: "bold",
  EM: "italic",
  I: "italic",
  S: "strike",
  DEL: "strike",
  CODE: "code",
  MARK: "highlight",
  SUB: "subscript",
  SUP: "superscript"
});

export function getInlineMarkTarget(target, root) {
  const targetElement =
    target?.nodeType === 1 ? target : target?.nodeType === 3 ? target.parentElement : null;

  if (!targetElement || typeof targetElement.closest !== "function" || !root || typeof root.contains !== "function") {
    return null;
  }

  const markElement = targetElement.closest(INLINE_MARK_SELECTOR);
  if (!markElement || !root.contains(markElement)) {
    return null;
  }

  const markName = INLINE_MARK_TAG_TO_NAME[String(markElement.tagName || "").toUpperCase()] || null;
  if (!markName) {
    return null;
  }

  return { markElement, markName };
}

export function selectionTouchesMarkRange(range, selectionFrom, selectionTo = selectionFrom) {
  if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) {
    return false;
  }

  const normalizedFrom = Math.min(selectionFrom, selectionTo);
  const normalizedTo = Math.max(selectionFrom, selectionTo);
  if (!Number.isFinite(normalizedFrom) || !Number.isFinite(normalizedTo)) {
    return false;
  }

  return normalizedFrom <= range.to && normalizedTo >= range.from;
}

function selectionTouchesMarkRangeWithTolerance(range, selectionFrom, selectionTo = selectionFrom) {
  if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) {
    return false;
  }

  const normalizedFrom = Math.min(selectionFrom, selectionTo);
  const normalizedTo = Math.max(selectionFrom, selectionTo);
  if (!Number.isFinite(normalizedFrom) || !Number.isFinite(normalizedTo)) {
    return false;
  }

  return normalizedFrom <= range.to + 1 && normalizedTo >= range.from - 1;
}

export function findMarkRangeForSelection(markRanges, selectionFrom, selectionTo = selectionFrom, preferredMarkName = null) {
  if (!Array.isArray(markRanges) || !Number.isFinite(selectionFrom) || !Number.isFinite(selectionTo)) {
    return null;
  }

  const normalizedRanges = markRanges.filter(
    (range) => range && Number.isFinite(range.from) && Number.isFinite(range.to) && range.from <= range.to
  );
  if (!normalizedRanges.length) {
    return null;
  }

  const exactMatches = normalizedRanges.filter((range) => selectionTouchesMarkRange(range, selectionFrom, selectionTo));
  if (!exactMatches.length) {
    return null;
  }

  if (preferredMarkName) {
    const preferredMatch = exactMatches.find((range) => range.markName === preferredMarkName);
    if (preferredMatch) {
      return preferredMatch;
    }
  }

  return [...exactMatches].sort((left, right) => {
    const leftSpan = left.to - left.from;
    const rightSpan = right.to - right.from;
    if (leftSpan !== rightSpan) {
      return leftSpan - rightSpan;
    }
    return left.from - right.from;
  })[0];
}

export function findMarkRangeForClick(markRanges, pos, preferredMarkName = null) {
  if (!Array.isArray(markRanges) || !Number.isFinite(pos)) {
    return null;
  }

  const normalizedRanges = markRanges.filter(
    (range) => range && Number.isFinite(range.from) && Number.isFinite(range.to) && range.from <= range.to
  );
  if (!normalizedRanges.length) {
    return null;
  }

  const candidateRanges = normalizedRanges.filter((range) => selectionTouchesMarkRangeWithTolerance(range, pos, pos));
  if (!candidateRanges.length) {
    return null;
  }

  if (preferredMarkName) {
    const preferredMatch = candidateRanges.find((range) => range.markName === preferredMarkName);
    if (preferredMatch) {
      return preferredMatch;
    }
  }

  return [...candidateRanges].sort((left, right) => {
    const leftSpan = left.to - left.from;
    const rightSpan = right.to - right.from;
    if (leftSpan !== rightSpan) {
      return leftSpan - rightSpan;
    }
    return left.from - right.from;
  })[0];
}
