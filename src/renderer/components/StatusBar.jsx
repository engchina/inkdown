import React from "react";

export default function StatusBar({
  filePath,
  wordCount,
  charCount,
  readingMinutes,
  viewMode,
  theme
}) {
  return (
    <footer className="status-bar">
      <span>{filePath || "未保存文档"}</span>
      <span>{wordCount} words</span>
      <span>{charCount} chars</span>
      <span>{readingMinutes} min read</span>
      <span>{viewMode}</span>
      <span>{theme}</span>
    </footer>
  );
}
