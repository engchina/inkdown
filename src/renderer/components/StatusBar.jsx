import React from "react";

export default function StatusBar({
  filePath,
  documentTitle,
  isDirty,
  wordCount,
  charCount,
  readingMinutes,
  viewMode,
  theme,
  statusMessage,
  findSummary
}) {
  return (
    <footer className="status-bar">
      <span>{documentTitle}</span>
      <span>{isDirty ? "未保存" : "已保存"}</span>
      <span>{filePath || "未保存文档"}</span>
      <span>{wordCount} words</span>
      <span>{charCount} chars</span>
      <span>{readingMinutes} min read</span>
      <span>{viewMode}</span>
      <span>{theme}</span>
      {findSummary ? <span>{findSummary}</span> : null}
      <span>{statusMessage}</span>
    </footer>
  );
}
