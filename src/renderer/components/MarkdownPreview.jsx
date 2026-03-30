import React, { useEffect, useRef } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "neutral",
  securityLevel: "loose"
});

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
        try {
          await mermaid.run({ nodes });
        } catch (error) {
          nodes.forEach((node) => {
            node.classList.add("mermaid-error");
            node.innerHTML = `<pre>${String(error.message || error)}</pre>`;
          });
        }
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
