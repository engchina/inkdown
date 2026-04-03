const { contextBridge, ipcRenderer } = require("electron");

const ASSET_PROTOCOL = "inkdown-asset";
const TEMP_IMAGE_DIR = appendNativePath(ipcRenderer.sendSync("app:get-path", "temp"), "inkdown-images");

function isExternalSource(value) {
  return /^(https?:|data:|blob:)/i.test(value);
}

function isFileUrl(value) {
  return /^file:/i.test(value);
}

function isRelativeImagesPath(assetPath) {
  return /^(?:\.\/)?images\/.+/i.test(assetPath || "");
}

function normalizeSlashes(value) {
  return String(value || "").replace(/\\/g, "/");
}

function appendNativePath(basePath, segment) {
  const normalizedBase = String(basePath || "").replace(/[\\/]+$/, "");
  const separator = normalizedBase.includes("\\") && !normalizedBase.includes("/") ? "\\" : "/";
  return `${normalizedBase}${separator}${segment}`;
}

function isWindowsDrivePath(value) {
  return /^[A-Za-z]:[\\/]/.test(String(value || ""));
}

function isAbsolutePath(value) {
  const normalized = String(value || "");
  return isWindowsDrivePath(normalized) || normalized.startsWith("\\\\") || normalized.startsWith("/");
}

function dirnamePath(filePath) {
  const normalized = String(filePath || "").replace(/[\\/]+$/, "");
  const slashIndex = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  return slashIndex === -1 ? "" : normalized.slice(0, slashIndex);
}

function ensureDirectoryUrlPath(directoryPath) {
  const normalized = normalizeSlashes(directoryPath);
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function toFileSystemUrl(filePath) {
  const normalized = normalizeSlashes(filePath);
  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("//")) {
    return `file:${encodeURI(normalized)}`;
  }

  if (/^[A-Za-z]:\//.test(normalized)) {
    return `file:///${encodeURI(normalized)}`;
  }

  return `file://${encodeURI(normalized.startsWith("/") ? normalized : `/${normalized}`)}`;
}

function fromFileSystemUrl(fileUrl) {
  const parsed = new URL(String(fileUrl || ""));
  const decodedPathname = decodeURIComponent(parsed.pathname || "");

  if (parsed.host) {
    return `//${parsed.host}${decodedPathname}`;
  }

  if (/^\/[A-Za-z]:\//.test(decodedPathname)) {
    return decodedPathname.slice(1);
  }

  return decodedPathname;
}

function joinPathSegments(basePath, relativePath) {
  const baseUrl = toFileSystemUrl(ensureDirectoryUrlPath(basePath));
  return fromFileSystemUrl(new URL(normalizeSlashes(relativePath), baseUrl).href);
}

function toAssetUrl(filePath) {
  return `${ASSET_PROTOCOL}://local/?path=${encodeURIComponent(String(filePath || ""))}`;
}

function resolveAbsoluteAssetPath(documentPath, assetPath) {
  if (!assetPath) {
    return null;
  }

  if (isFileUrl(assetPath)) {
    return fromFileSystemUrl(assetPath);
  }

  if (isAbsolutePath(assetPath)) {
    return assetPath;
  }

  if (!documentPath) {
    if (isRelativeImagesPath(assetPath)) {
      const relativeImagePath = assetPath.replace(/^(?:\.\/)?images\//i, "");
      return joinPathSegments(TEMP_IMAGE_DIR, relativeImagePath);
    }
    return null;
  }

  return joinPathSegments(dirnamePath(documentPath), assetPath);
}

contextBridge.exposeInMainWorld("editorApi", {
  openMarkdown: () => ipcRenderer.invoke("dialog:open-markdown"),
  pickWorkspace: () => ipcRenderer.invoke("dialog:pick-workspace"),
  openMarkdownPath: (filePath) => ipcRenderer.invoke("file:open-markdown-path", filePath),
  listWorkspaceTree: (rootPath) => ipcRenderer.invoke("file:list-workspace-tree", rootPath),
  confirmDiscardChanges: () => ipcRenderer.invoke("dialog:confirm-discard-changes"),
  saveMarkdown: (payload) => ipcRenderer.invoke("file:save-markdown", payload),
  saveHtml: (payload) => ipcRenderer.invoke("file:save-html", payload),
  savePdf: (payload) => ipcRenderer.invoke("file:save-pdf", payload),
  pickImage: () => ipcRenderer.invoke("dialog:pick-image"),
  persistImageFile: (filePath) => ipcRenderer.invoke("file:persist-image-file", filePath),
  persistImageBuffer: (payload) => ipcRenderer.invoke("file:persist-image-buffer", payload),
  loadPreferences: () => ipcRenderer.invoke("preferences:load"),
  savePreferences: (payload) => ipcRenderer.invoke("preferences:save", payload),
  setDirty: (value) => ipcRenderer.invoke("document:set-dirty", value),
  setFilePath: (value) => ipcRenderer.invoke("document:set-file-path", value),
  openExternal: (targetUrl) => ipcRenderer.invoke("shell:open-external", targetUrl),
  showItemInFolder: (filePath) => ipcRenderer.invoke("shell:show-item-in-folder", filePath),
  onMenuAction: (callback) => {
    const listener = (_, payload) => callback(payload);
    ipcRenderer.on("menu-action", listener);
    return () => ipcRenderer.removeListener("menu-action", listener);
  },
  toAssetUrl,
  toFileUrl: (filePath) => (isFileUrl(filePath) ? filePath : toFileSystemUrl(filePath)),
  resolveMarkdownAsset: (documentPath, assetPath) => {
    if (!assetPath || isExternalSource(assetPath)) {
      return assetPath;
    }

    const absolutePath = resolveAbsoluteAssetPath(documentPath, assetPath);
    return absolutePath ? toAssetUrl(absolutePath) : "";
  },
  readFileAsBase64: (filePath) => ipcRenderer.invoke("file:read-as-base64", filePath),
  writeClipboard: (payload) => ipcRenderer.invoke("clipboard:write", payload),
  resolveMarkdownAssetForExport: (documentPath, assetPath) => {
    if (!assetPath || isExternalSource(assetPath)) {
      return assetPath;
    }

    const absolutePath = resolveAbsoluteAssetPath(documentPath, assetPath);
    return absolutePath ? toFileSystemUrl(absolutePath) : "";
  }
});
