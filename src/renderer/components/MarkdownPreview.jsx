import React, { useEffect, useRef } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "neutral",
  securityLevel: "loose"
});

async function renderMermaidNodes(nodes) {
  await Promise.all(
    nodes.map(async (node, index) => {
      const source = node.textContent || "";
      const renderId = `inkdown-mermaid-${Date.now()}-${index}`;

      try {
        const { svg } = await mermaid.render(renderId, source);
        node.classList.remove("mermaid-error");
        node.innerHTML = svg;
      } catch (error) {
        node.classList.add("mermaid-error");
        node.innerHTML = `<pre>${String(error.message || error)}</pre>`;
      }
    })
  );
}

export async function renderPreviewHtml(html) {
  const container = document.createElement("div");
  container.innerHTML = html;
  const nodes = Array.from(container.querySelectorAll(".mermaid"));

  if (nodes.length > 0) {
    await renderMermaidNodes(nodes);
  }

  return container.innerHTML;
}

export default function MarkdownPreview({ html, onRendered }) {
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function renderMermaid() {
      if (!containerRef.current) {
        return;
      }

      const nodes = Array.from(containerRef.current.querySelectorAll(".mermaid"));
      if (nodes.length > 0) {
        await renderMermaidNodes(nodes);
      }

      if (!cancelled && onRendered && containerRef.current) {
        onRendered(containerRef.current.innerHTML);
      }
    }

    renderMermaid();

    return () => {
      cancelled = true;
    };
  }, [html, onRendered]);

  return (
    <div
      ref={containerRef}
      className="preview-surface"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
