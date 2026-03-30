const { contextBridge, ipcRenderer } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

function isWebLike(value) {
  return /^(https?:|data:|file:|blob:)/i.test(value);
}

contextBridge.exposeInMainWorld("editorApi", {
  openMarkdown: () => ipcRenderer.invoke("dialog:open-markdown"),
  openMarkdownPath: (filePath) => ipcRenderer.invoke("file:open-markdown-path", filePath),
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
  onMenuAction: (callback) => {
    const listener = (_, payload) => callback(payload);
    ipcRenderer.on("menu-action", listener);
    return () => ipcRenderer.removeListener("menu-action", listener);
  },
  toFileUrl: (filePath) => pathToFileURL(filePath).href,
  resolveMarkdownAsset: (documentPath, assetPath) => {
    if (!assetPath || isWebLike(assetPath)) {
      return assetPath;
    }

    const absolutePath = path.isAbsolute(assetPath)
      ? assetPath
      : documentPath
        ? path.resolve(path.dirname(documentPath), assetPath)
        : assetPath;

    return pathToFileURL(absolutePath).href;
  }
});
