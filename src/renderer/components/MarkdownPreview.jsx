import React, { useEffect, useMemo, useRef } from "react";
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
import { escapeHtml, sanitizePreviewContainer, sanitizePreviewHtml } from "../utils/previewSanitizer.mjs";
import { activatePreviewLink } from "../utils/previewLinks.mjs";
import { applyPreviewSearchHighlights } from "../utils/previewSearch.mjs";

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
    securityLevel: "strict"
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

export async function renderPreviewHtml(html, theme = "paper", sanitizeOptions = {}) {
  const container = document.createElement("div");
  container.innerHTML = html;
  sanitizePreviewContainer(container, sanitizeOptions);
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

export default function MarkdownPreview({ html, theme, sanitizeOptions = {}, findQuery = "", currentFindIndex = 0, onActivate = null }) {
  const containerRef = useRef(null);
  const safeHtml = useMemo(() => sanitizePreviewHtml(html, sanitizeOptions), [html, sanitizeOptions]);

  useEffect(() => {
    async function renderDecorations() {
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

      const { currentElement } = applyPreviewSearchHighlights(containerRef.current, findQuery, currentFindIndex);
      if (currentElement) {
        currentElement.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      }
    }

    renderDecorations();
  }, [safeHtml, theme, findQuery, currentFindIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    function handleClick(event) {
      onActivate?.();
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor || !container.contains(anchor)) {
        return;
      }

      const href = anchor.getAttribute("href") || "";
      if (!href.startsWith("#") && !/^(https?:|mailto:|tel:)/i.test(href)) {
        return;
      }

      event.preventDefault();
      void activatePreviewLink(anchor, container, {
        openExternal: (targetUrl) => window.editorApi.openExternal(targetUrl),
        windowObject: window
      });
    }

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [safeHtml]);

  return (
    <div
      ref={containerRef}
      className="preview-surface"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
