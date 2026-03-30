import React, { useEffect, useRef } from "react";

let mermaidLoader;

async function loadMermaid() {
  if (!mermaidLoader) {
    mermaidLoader = import("mermaid").then(({ default: mermaid }) => mermaid);
  }

  return mermaidLoader;
}

async function renderMermaidNodes(nodes, theme = "paper") {
  const mermaid = await loadMermaid();
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === "midnight" ? "dark" : theme === "forest" ? "forest" : "default",
    securityLevel: "loose"
  });
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

export async function renderPreviewHtml(html, theme = "paper") {
  const container = document.createElement("div");
  container.innerHTML = html;
  const nodes = Array.from(container.querySelectorAll(".mermaid"));

  if (nodes.length > 0) {
    await renderMermaidNodes(nodes, theme);
  }

  return container.innerHTML;
}

export default function MarkdownPreview({ html, theme }) {
  const containerRef = useRef(null);

  useEffect(() => {
    async function renderMermaid() {
      if (!containerRef.current) {
        return;
      }

      const nodes = Array.from(containerRef.current.querySelectorAll(".mermaid"));
      if (nodes.length > 0) {
        await renderMermaidNodes(nodes, theme);
      }
    }

    renderMermaid();
  }, [html, theme]);

  return (
    <div
      ref={containerRef}
      className="preview-surface"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
