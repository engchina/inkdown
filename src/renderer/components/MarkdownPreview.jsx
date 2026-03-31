import React, { useEffect, useRef } from "react";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import yaml from "highlight.js/lib/languages/yaml";
import sql from "highlight.js/lib/languages/sql";
import python from "highlight.js/lib/languages/python";
import markdownLanguage from "highlight.js/lib/languages/markdown";

hljs.registerLanguage("js", javascript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("python", python);
hljs.registerLanguage("md", markdownLanguage);
hljs.registerLanguage("markdown", markdownLanguage);
hljs.registerAliases(["jsx"], { languageName: "javascript" });
hljs.registerAliases(["tsx"], { languageName: "typescript" });
hljs.registerAliases(["sh", "zsh"], { languageName: "bash" });

function normalizeHighlightLanguage(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized && hljs.getLanguage(normalized) ? normalized : "";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHighlightedCodeHtml(node) {
  const languageClass = Array.from(node.classList)
    .find((className) => className.startsWith("language-"))
    ?.replace(/^language-/, "");
  const language = normalizeHighlightLanguage(languageClass);
  const source = node.textContent || "";

  if (!source) {
    return "";
  }

  if (!language) {
    return escapeHtml(source);
  }

  return hljs.highlight(source, { language, ignoreIllegals: true }).value;
}

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

function highlightCodeNodes(nodes) {
  nodes.forEach((node) => {
    node.classList.add("hljs");
    node.innerHTML = buildHighlightedCodeHtml(node);
  });
}

export async function renderPreviewHtml(html, theme = "paper") {
  const container = document.createElement("div");
  container.innerHTML = html;
  const nodes = Array.from(container.querySelectorAll(".mermaid"));
  const codeNodes = Array.from(container.querySelectorAll("pre code"));

  if (codeNodes.length > 0) {
    highlightCodeNodes(codeNodes);
  }

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
      const codeNodes = Array.from(containerRef.current.querySelectorAll("pre code"));
      if (codeNodes.length > 0) {
        highlightCodeNodes(codeNodes);
      }
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
