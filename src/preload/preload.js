const { contextBridge, ipcRenderer } = require("electron");
const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");

const ASSET_PROTOCOL = "inkdown-asset";

function isExternalSource(value) {
  return /^(https?:|data:|blob:)/i.test(value);
}

function isFileUrl(value) {
  return /^file:/i.test(value);
}

function toAssetUrl(filePath) {
  return `${ASSET_PROTOCOL}://local/?path=${encodeURIComponent(path.normalize(filePath))}`;
}

function resolveAbsoluteAssetPath(documentPath, assetPath) {
  if (!assetPath) {
    return null;
  }

  if (isFileUrl(assetPath)) {
    return fileURLToPath(assetPath);
  }

  if (path.isAbsolute(assetPath)) {
    return assetPath;
  }

  if (!documentPath) {
    return assetPath;
  }

  return path.resolve(path.dirname(documentPath), assetPath);
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
  toFileUrl: (filePath) => (isFileUrl(filePath) ? filePath : pathToFileURL(filePath).href),
  resolveMarkdownAsset: (documentPath, assetPath) => {
    if (!assetPath || isExternalSource(assetPath)) {
      return assetPath;
    }

    const absolutePath = resolveAbsoluteAssetPath(documentPath, assetPath);
    return absolutePath ? toAssetUrl(absolutePath) : assetPath;
  },
  resolveMarkdownAssetForExport: (documentPath, assetPath) => {
    if (!assetPath || isExternalSource(assetPath)) {
      return assetPath;
    }

    const absolutePath = resolveAbsoluteAssetPath(documentPath, assetPath);
    return absolutePath ? pathToFileURL(absolutePath).href : assetPath;
  }
});
