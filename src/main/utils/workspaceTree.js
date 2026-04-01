const path = require("node:path");
const fs = require("node:fs/promises");

const DEFAULT_MARKDOWN_EXTENSIONS = Object.freeze([".md", ".markdown", ".mdown", ".mkd", ".txt"]);
const DEFAULT_IGNORED_WORKSPACE_DIRS = Object.freeze([".git", "node_modules", "dist", "release", "build", "coverage"]);

function compareFileNodes(left, right) {
  if (left.type !== right.type) {
    return left.type === "directory" ? -1 : 1;
  }

  return left.name.localeCompare(right.name, "en", { numeric: true, sensitivity: "base" });
}

function isMarkdownFilePath(filePath, markdownExtensions) {
  return markdownExtensions.has(path.extname(filePath || "").toLowerCase());
}

async function buildWorkspaceNode(targetPath, options, context, isRoot = false) {
  const { ignoredWorkspaceDirs, markdownExtensions } = options;
  const { visitedDirectories } = context;
  const entryName = path.basename(targetPath);
  const stats = await fs.lstat(targetPath);

  if (stats.isSymbolicLink()) {
    return null;
  }

  if (!stats.isDirectory()) {
    if (!isMarkdownFilePath(targetPath, markdownExtensions)) {
      return null;
    }

    return {
      type: "file",
      name: entryName,
      path: targetPath
    };
  }

  if (ignoredWorkspaceDirs.has(entryName)) {
    return null;
  }

  const realPath = await fs.realpath(targetPath).catch(() => path.resolve(targetPath));
  if (visitedDirectories.has(realPath)) {
    return null;
  }

  visitedDirectories.add(realPath);

  try {
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    const visibleEntries = entries.filter((entry) => !entry.name.startsWith("."));
    const children = (
      await Promise.all(
        visibleEntries.map(async (entry) =>
          buildWorkspaceNode(path.join(targetPath, entry.name), options, context)
        )
      )
    )
      .filter(Boolean)
      .sort(compareFileNodes);

    if (!isRoot && children.length === 0) {
      return null;
    }

    return {
      type: "directory",
      name: entryName,
      path: targetPath,
      children
    };
  } finally {
    visitedDirectories.delete(realPath);
  }
}

async function listWorkspaceTree(rootPath, rawOptions = {}) {
  if (!rootPath) {
    return null;
  }

  try {
    await fs.access(rootPath);
  } catch {
    return null;
  }

  const options = {
    ignoredWorkspaceDirs: new Set(rawOptions.ignoredWorkspaceDirs || DEFAULT_IGNORED_WORKSPACE_DIRS),
    markdownExtensions: new Set(rawOptions.markdownExtensions || DEFAULT_MARKDOWN_EXTENSIONS)
  };

  return buildWorkspaceNode(rootPath, options, { visitedDirectories: new Set() }, true);
}

module.exports = {
  DEFAULT_IGNORED_WORKSPACE_DIRS,
  DEFAULT_MARKDOWN_EXTENSIONS,
  buildWorkspaceNode,
  compareFileNodes,
  listWorkspaceTree
};
