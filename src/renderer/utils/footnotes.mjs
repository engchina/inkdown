function sanitizeDomIdFragment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "note";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeInlineText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function appendFootnoteBackrefs(item, referenceIds, documentRef) {
  if (!item || !referenceIds?.length) {
    return;
  }

  const backrefs = documentRef.createElement("span");
  backrefs.className = "footnote-backrefs";

  referenceIds.forEach((referenceId, index) => {
    if (index > 0) {
      backrefs.append(" ");
    }

    const link = documentRef.createElement("a");
    link.className = "footnote-backref";
    link.href = `#${referenceId}`;
    link.setAttribute("aria-label", index === 0 ? "Back to reference" : `Back to reference ${index + 1}`);
    link.textContent = index === 0 ? "↩" : `↩${index + 1}`;
    backrefs.appendChild(link);
  });

  const paragraph = item.lastElementChild?.tagName === "P" ? item.lastElementChild : null;
  if (paragraph) {
    paragraph.append(" ", backrefs);
    return;
  }

  item.append(" ", backrefs);
}

function buildFootnotePreviewText(item) {
  if (!item) {
    return "";
  }

  const clone = item.cloneNode(true);
  clone.querySelectorAll(".footnote-backrefs").forEach((node) => node.remove());
  return normalizeInlineText(clone.textContent || "");
}

export function extractFootnotes(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const bodyLines = [];
  const definitions = new Map();
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^```/.test(line)) {
      inFence = !inFence;
      bodyLines.push(line);
      continue;
    }

    if (!inFence) {
      const definitionMatch = /^\[\^([^\]]+)\]:\s*(.*)$/.exec(line);
      if (definitionMatch) {
        const id = definitionMatch[1].trim();
        const definitionLines = [definitionMatch[2]];
        let nextIndex = index + 1;
        while (nextIndex < lines.length) {
          const nextLine = lines[nextIndex];
          if (/^(?:\s{2,}|\t)/.test(nextLine)) {
            definitionLines.push(nextLine.replace(/^(?:\t| {1,4})/, ""));
            nextIndex += 1;
            continue;
          }
          if (nextLine.trim() === "" && nextIndex + 1 < lines.length && /^(?:\s{2,}|\t)/.test(lines[nextIndex + 1])) {
            definitionLines.push("");
            nextIndex += 1;
            continue;
          }
          break;
        }
        definitions.set(id, definitionLines.join("\n").trim());
        index = nextIndex - 1;
        continue;
      }
    }

    bodyLines.push(line);
  }

  return {
    body: bodyLines.join("\n").trimEnd(),
    definitions
  };
}

export function applyFootnoteReferences(markdown, definitions, replaceOutsideCodeSpans) {
  const numbering = new Map();
  const order = [];
  const references = new Map();
  const body = replaceOutsideCodeSpans(String(markdown || ""), (segment) =>
    segment.replace(/\[\^([^\]]+)\]/g, (match, rawId) => {
      const id = String(rawId || "").trim();
      if (!definitions.has(id)) {
        return match;
      }
      if (!numbering.has(id)) {
        numbering.set(id, order.length + 1);
        order.push(id);
      }
      const number = numbering.get(id);
      const domId = sanitizeDomIdFragment(id);
      const referenceIds = references.get(id) || [];
      const referenceId = referenceIds.length === 0 ? `fnref-${domId}` : `fnref-${domId}-${referenceIds.length + 1}`;
      referenceIds.push(referenceId);
      references.set(id, referenceIds);
      const safeReferenceId = escapeHtml(referenceId);
      const safeFootnoteId = escapeHtml(`fn-${domId}`);
      return `<sup class="footnote-ref" id="${safeReferenceId}"><a href="#${safeFootnoteId}" data-footnote-id="${escapeHtml(domId)}">${number}</a></sup>`;
    })
  );

  return { body, order, numbering, references };
}

export function buildFootnotesElement(definitions, order, references, renderFragment, documentRef = document) {
  if (!order?.length) {
    return null;
  }

  const section = documentRef.createElement("section");
  section.className = "footnotes";

  const list = documentRef.createElement("ol");
  order.forEach((id) => {
    const domId = sanitizeDomIdFragment(id);
    const item = documentRef.createElement("li");
    item.id = `fn-${domId}`;
    item.innerHTML = renderFragment(definitions.get(id) || "");
    appendFootnoteBackrefs(item, references?.get?.(id) || [], documentRef);
    list.appendChild(item);
  });
  section.appendChild(list);

  return section;
}

export function decorateFootnoteReferences(container) {
  if (!container?.querySelectorAll) {
    return;
  }

  Array.from(container.querySelectorAll(".footnotes li[id]")).forEach((item) => {
    const previewText = buildFootnotePreviewText(item);
    if (!previewText) {
      return;
    }

    const footnoteId = item.getAttribute("id") || "";
    Array.from(container.querySelectorAll(`.footnote-ref a[href="#${footnoteId}"]`)).forEach((link) => {
      const number = normalizeInlineText(link.textContent || "");
      link.setAttribute("title", previewText);
      link.setAttribute("aria-label", number ? `Footnote ${number}: ${previewText}` : previewText);
    });
  });
}
