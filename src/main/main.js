const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { fileURLToPath, pathToFileURL } = require("node:url");
const { isSafeExternalUrl } = require("./utils/externalLinks");
const { buildIoErrorMessage } = require("./utils/ioErrors");
const { isAllowedRendererUrl, isTrustedIpcSender } = require("./utils/rendererTrust");
const { DEFAULT_MARKDOWN_EXTENSIONS, DEFAULT_IGNORED_WORKSPACE_DIRS, listWorkspaceTree } = require("./utils/workspaceTree");

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const ASSET_PROTOCOL = "inkdown-asset";
const MARKDOWN_EXTENSIONS = new Set(DEFAULT_MARKDOWN_EXTENSIONS);
const HELP_LINKS = {
  markdownReference: "https://support.typora.io/Markdown-Reference/",
  website: "https://github.com/engchina"
};

const state = {
  currentFilePath: null,
  isDirty: false,
  preferences: getDefaultPreferences()
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: ASSET_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

function getPreferencesPath() {
  return path.join(app.getPath("userData"), "preferences.json");
}

function getDefaultPreferences() {
  return {
    theme: "paper",
    viewMode: "editor",
    fontSize: 18,
    lineWidth: 900,
    sidebarVisible: true,
    sidebarTab: "outline",
    focusMode: false,
    typewriterMode: false,
    smartMarkdownTransform: true,
    smartTransformHints: true,
    smartTransformRules: {
      heading: true,
      blockquote: true,
      bulletList: true,
      orderedList: true,
      taskList: true,
      codeFence: true
    },
    smartTransformSource: {
      tabIndent: true,
      continueList: true,
      autoPair: true,
      literalEscape: true
    },
    allowInsecureRemoteMedia: false,
    workspaceRoot: null,
    recentFiles: [],
    paletteUsage: {},
    tableLayouts: {}
  };
}

function updateWindowTitle(window) {
  const name = state.currentFilePath ? path.basename(state.currentFilePath) : "Untitled.md";
  const dirtySuffix = state.isDirty ? " *" : "";
  window.setTitle(`${name}${dirtySuffix} - Inkdown`);
}

function getRendererEntryUrl() {
  return isDev ? process.env.VITE_DEV_SERVER_URL : pathToFileURL(path.join(app.getAppPath(), "dist/index.html")).toString();
}

function getRendererTrustOptions() {
  return {
    devServerUrl: process.env.VITE_DEV_SERVER_URL,
    productionAppUrl: !isDev ? getRendererEntryUrl() : null
  };
}

function requireTrustedIpcEvent(event) {
  if (!isTrustedIpcSender(event, getRendererTrustOptions())) {
    throw new Error(`Blocked IPC from untrusted sender: ${event?.senderFrame?.url || event?.sender?.getURL?.() || "unknown"}`);
  }

  return BrowserWindow.fromWebContents(event.sender);
}

function emitMenuAction(window, payload) {
  window.webContents.send("menu-action", payload);
}

function sanitizeFileName(value) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function isExternalSource(value) {
  return /^(https?:|data:|blob:)/i.test(value || "");
}

function isFileUrl(value) {
  return /^file:/i.test(value || "");
}

function isMarkdownFilePath(filePath) {
  return MARKDOWN_EXTENSIONS.has(path.extname(filePath || "").toLowerCase());
}

async function loadPreferences() {
  try {
    const raw = await fs.readFile(getPreferencesPath(), "utf8");
    const prefs = {
      ...getDefaultPreferences(),
      ...JSON.parse(raw)
    };
    return prefs;
  } catch {
    return getDefaultPreferences();
  }
}

async function savePreferences(preferences) {
  const nextPreferences = {
    ...getDefaultPreferences(),
    ...(preferences || {})
  };

  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(getPreferencesPath(), JSON.stringify(nextPreferences, null, 2), "utf8");
  state.preferences = nextPreferences;
  const window = BrowserWindow.getAllWindows()[0];
  if (window) {
    rebuildMenu(window);
  }
  return nextPreferences;
}

async function maybeContinueWithUnsavedChanges(window) {
  if (!state.isDirty) {
    return true;
  }

  const result = await dialog.showMessageBox(window, {
    type: "warning",
    buttons: ["Continue", "Cancel"],
    defaultId: 1,
    cancelId: 1,
    title: "Unsaved changes",
    message: "The current document has unsaved changes.",
    detail: "Continuing will discard the unsaved content."
  });

  return result.response === 0;
}

async function openMarkdownFile(window, filePath) {
  const content = await fs.readFile(filePath, "utf8");
  state.currentFilePath = filePath;
  state.isDirty = false;
  if (window) {
    updateWindowTitle(window);
  }

  return {
    canceled: false,
    filePath,
    content
  };
}

async function safeOpenMarkdownFile(window, filePath) {
  try {
    return await openMarkdownFile(window, filePath);
  } catch (error) {
    const name = path.basename(filePath || "") || "document";
    const detail =
      error?.code === "ENOENT"
        ? "The file no longer exists."
        : error?.code === "EACCES"
          ? "Permission was denied."
          : String(error?.message || error || "Unknown error.");

    return {
      canceled: true,
      filePath,
      error: `Could not open ${name}. ${detail}`
    };
  }
}

async function createPdfFromHtml(window, payload) {
  const defaultName = state.currentFilePath
    ? `${path.basename(state.currentFilePath, path.extname(state.currentFilePath))}.pdf`
    : "Untitled.pdf";

  const result = await dialog.showSaveDialog(window, {
    title: "Export PDF",
    defaultPath: defaultName,
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const previewWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true
    }
  });

  try {
    await previewWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(payload.html)}`);
    await new Promise((resolve) => setTimeout(resolve, 350));
    const pdf = await previewWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      }
    });

    await fs.writeFile(result.filePath, pdf);
    return { canceled: false, filePath: result.filePath };
  } finally {
    previewWindow.destroy();
  }
}

async function getImageTargetDirectory(documentPath = state.currentFilePath) {
  if (documentPath) {
    const absoluteDir = path.join(path.dirname(documentPath), "images");
    await fs.mkdir(absoluteDir, { recursive: true });
    return {
      absoluteDir,
      relativeDir: "./images"
    };
  }

  const tempDir = path.join(app.getPath("temp"), "inkdown-images");
  await fs.mkdir(tempDir, { recursive: true });
  return {
    absoluteDir: tempDir,
    relativeDir: "./images"
  };
}

function getTimestampedImageName(extension) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `image-${stamp}${extension}`;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureUniqueFileName(directoryPath, fileName) {
  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension);
  let nextFileName = fileName;
  let duplicateIndex = 1;

  while (await pathExists(path.join(directoryPath, nextFileName))) {
    nextFileName = `${baseName}-${duplicateIndex}${extension}`;
    duplicateIndex += 1;
  }

  return nextFileName;
}

async function buildAssetResponse(targetPath) {
  const absolutePath = path.resolve(targetPath);
  if (!(await pathExists(absolutePath))) {
    return new Response("Asset not found.", { status: 404 });
  }

  return net.fetch(pathToFileURL(absolutePath).toString());
}

function registerAssetProtocol() {
  protocol.handle(ASSET_PROTOCOL, async (request) => {
    try {
      const requestUrl = new URL(request.url);
      const targetPath = requestUrl.searchParams.get("path");
      if (!targetPath) {
        return new Response("Missing asset path.", { status: 400 });
      }

      return buildAssetResponse(path.normalize(targetPath));
    } catch (error) {
      return new Response(`Invalid asset request: ${error.message}`, { status: 400 });
    }
  });
}

function normalizeAssetPath(assetPath) {
  return decodeURIComponent(String(assetPath || "").trim()).replace(/\\/g, "/");
}

function unwrapMarkdownDestination(value) {
  const normalized = String(value || "").trim();
  if (normalized.startsWith("<") && normalized.endsWith(">")) {
    return normalized.slice(1, -1);
  }

  return normalized;
}

function formatMarkdownDestination(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return /[\s()]/.test(normalized) ? `<${normalized}>` : normalized;
}

function isRelativeImagesPath(assetPath) {
  return /^(?:\.\/)?images\/.+/i.test(assetPath);
}

function getMarkdownImageMatches(markdown) {
  const imagePattern =
    /!\[([^\]]*)\]\(\s*(<[^>\r\n]+>|(?:\\.|[^\\\s)])+)(?:\s+((?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\((?:\\.|[^)])*\))))?\s*\)/g;

  return Array.from(markdown.matchAll(imagePattern)).map((match) => ({
    alt: match[1],
    title: match[3] || "",
    source: unwrapMarkdownDestination(match[2]),
    start: match.index,
    end: match.index + match[0].length
  }));
}

async function resolveMarkdownImageSourcePath(assetPath, sourceDocumentPath) {
  const normalizedPath = normalizeAssetPath(assetPath);
  if (!normalizedPath || isExternalSource(normalizedPath)) {
    return null;
  }

  if (isFileUrl(normalizedPath)) {
    return fileURLToPath(normalizedPath);
  }

  if (path.isAbsolute(normalizedPath)) {
    return normalizedPath;
  }

  if (sourceDocumentPath) {
    return path.resolve(path.dirname(sourceDocumentPath), normalizedPath);
  }

  if (isRelativeImagesPath(normalizedPath)) {
    const { absoluteDir } = await getImageTargetDirectory(null);
    const relativeImagePath = normalizedPath.replace(/^(?:\.\/)?images\//i, "");
    return path.join(absoluteDir, ...relativeImagePath.split("/"));
  }

  return null;
}

async function copyImageToDocumentDirectory(sourcePath, documentPath) {
  const { absoluteDir, relativeDir } = await getImageTargetDirectory(documentPath);
  const parsedSource = path.parse(sourcePath);
  const extension = parsedSource.ext || ".png";
  const normalizedBaseName = sanitizeFileName(parsedSource.name) || "image";
  const targetFileName = await ensureUniqueFileName(absoluteDir, `${normalizedBaseName}${extension}`);
  const destinationPath = path.join(absoluteDir, targetFileName);

  if (path.resolve(sourcePath) !== path.resolve(destinationPath)) {
    await fs.copyFile(sourcePath, destinationPath);
  }

  return {
    absolutePath: destinationPath,
    markdownPath: path.posix.join(relativeDir, targetFileName)
  };
}

async function relocateMarkdownImages(markdown, documentPath) {
  if (!documentPath) {
    return markdown;
  }

  const sourceDocumentPath = state.currentFilePath;
  const replacements = await Promise.all(
    getMarkdownImageMatches(markdown).map(async (match) => {
      if (!match.source || isExternalSource(match.source)) {
        return null;
      }

      const sourcePath = await resolveMarkdownImageSourcePath(match.source, sourceDocumentPath);
      if (!sourcePath || !(await pathExists(sourcePath))) {
        return null;
      }

      const persisted = await copyImageToDocumentDirectory(sourcePath, documentPath);
      return {
        start: match.start,
        end: match.end,
        replacement: `![${match.alt}](${formatMarkdownDestination(persisted.markdownPath)}${match.title ? ` ${match.title}` : ""})`
      };
    })
  );

  return replacements
    .filter(Boolean)
    .sort((left, right) => right.start - left.start)
    .reduce(
      (nextMarkdown, replacement) =>
        `${nextMarkdown.slice(0, replacement.start)}${replacement.replacement}${nextMarkdown.slice(replacement.end)}`,
      markdown
    );
}

async function persistImageFromPath(sourcePath) {
  if (state.currentFilePath) {
    return copyImageToDocumentDirectory(sourcePath, state.currentFilePath);
  }

  const { absoluteDir, relativeDir } = await getImageTargetDirectory();
  const extension = path.extname(sourcePath) || ".png";
  const originalBaseName = sanitizeFileName(path.basename(sourcePath, extension));
  const fileName = `${originalBaseName || getTimestampedImageName("").replace(/\.$/, "")}-${Date.now()}${extension}`;
  const destinationPath = path.join(absoluteDir, fileName);

  await fs.copyFile(sourcePath, destinationPath);

  return {
    absolutePath: destinationPath,
    markdownPath: path.posix.join(relativeDir, fileName)
  };
}

async function persistImageFromBuffer(bytes, extension = ".png") {
  const { absoluteDir, relativeDir } = await getImageTargetDirectory();
  const normalizedExtension = extension.startsWith(".") ? extension : `.${extension}`;
  const fileName = getTimestampedImageName(normalizedExtension);
  const destinationPath = path.join(absoluteDir, fileName);

  await fs.writeFile(destinationPath, Buffer.from(bytes));

  return {
    absolutePath: destinationPath,
    markdownPath: path.posix.join(relativeDir, fileName)
  };
}

function sendThemeAction(window, theme) {
  state.preferences = {
    ...state.preferences,
    theme
  };
  rebuildMenu(window);
  emitMenuAction(window, { type: "set-theme", theme });
}

function sendPreferenceToggle(window, key) {
  const nextValue = !state.preferences[key];
  state.preferences = {
    ...state.preferences,
    [key]: nextValue
  };
  rebuildMenu(window);
  emitMenuAction(window, { type: "set-preference", patch: { [key]: nextValue } });
}

function rebuildMenu(window) {
  const preferences = state.preferences;
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "New",
          accelerator: "CmdOrCtrl+N",
          click: () => emitMenuAction(window, { type: "new-file" })
        },
        {
          label: "Open...",
          accelerator: "CmdOrCtrl+O",
          click: () => emitMenuAction(window, { type: "open-file" })
        },
        {
          label: "Open Folder...",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => emitMenuAction(window, { type: "pick-workspace" })
        },
        {
          label: "Reveal in Folder",
          accelerator: "CmdOrCtrl+Shift+R",
          enabled: Boolean(state.currentFilePath),
          click: () => emitMenuAction(window, { type: "reveal-current-file" })
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => emitMenuAction(window, { type: "save-file" })
        },
        {
          label: "Save As",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => emitMenuAction(window, { type: "save-file-as" })
        },
        { type: "separator" },
        {
          label: "Export HTML",
          accelerator: "CmdOrCtrl+Shift+E",
          click: () => emitMenuAction(window, { type: "export-html" })
        },
        {
          label: "Export PDF",
          accelerator: "CmdOrCtrl+Shift+P",
          click: () => emitMenuAction(window, { type: "export-pdf" })
        },
        { type: "separator" },
        {
          label: "Preferences...",
          accelerator: "CmdOrCtrl+,",
          click: () => emitMenuAction(window, { type: "open-preferences" })
        },
        { type: "separator" },
        { role: "close", label: "Close" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo", label: "Undo" },
        { role: "redo", label: "Redo" },
        { type: "separator" },
        { role: "cut", label: "Cut" },
        { role: "copy", label: "Copy" },
        { role: "paste", label: "Paste" },
        { role: "selectAll", label: "Select All" },
        { type: "separator" },
        {
          label: "Command Palette",
          accelerator: "CmdOrCtrl+P",
          click: () => emitMenuAction(window, { type: "open-command-palette" })
        },
        { type: "separator" },
        {
          label: "Find and Replace",
          accelerator: "CmdOrCtrl+F",
          click: () => emitMenuAction(window, { type: "open-find" })
        }
      ]
    },
    {
      label: "Paragraph",
      submenu: [
        {
          label: "Paragraph",
          accelerator: "CmdOrCtrl+Alt+0",
          click: () => emitMenuAction(window, { type: "apply-format", format: "paragraph" })
        },
        {
          label: "Heading 1",
          accelerator: "CmdOrCtrl+1",
          click: () => emitMenuAction(window, { type: "apply-format", format: "heading-1" })
        },
        {
          label: "Heading 2",
          accelerator: "CmdOrCtrl+2",
          click: () => emitMenuAction(window, { type: "apply-format", format: "heading-2" })
        },
        {
          label: "Heading 3",
          accelerator: "CmdOrCtrl+3",
          click: () => emitMenuAction(window, { type: "apply-format", format: "heading-3" })
        },
        { type: "separator" },
        {
          label: "Bulleted List",
          accelerator: "CmdOrCtrl+Shift+7",
          click: () => emitMenuAction(window, { type: "apply-format", format: "bullet-list" })
        },
        {
          label: "Numbered List",
          accelerator: "CmdOrCtrl+Shift+8",
          click: () => emitMenuAction(window, { type: "apply-format", format: "ordered-list" })
        },
        {
          label: "Task List",
          accelerator: "CmdOrCtrl+Shift+9",
          click: () => emitMenuAction(window, { type: "apply-format", format: "task-list" })
        },
        {
          label: "Blockquote",
          accelerator: "CmdOrCtrl+Shift+Q",
          click: () => emitMenuAction(window, { type: "apply-format", format: "blockquote" })
        },
        {
          label: "Code Block",
          accelerator: "CmdOrCtrl+Alt+C",
          click: () => emitMenuAction(window, { type: "apply-format", format: "code-block" })
        },
        {
          label: "Horizontal Rule",
          accelerator: "CmdOrCtrl+Alt+-",
          click: () => emitMenuAction(window, { type: "apply-format", format: "horizontal-rule" })
        },
        {
          label: "Table",
          accelerator: "CmdOrCtrl+Alt+T",
          click: () => emitMenuAction(window, { type: "insert-table" })
        }
      ]
    },
    {
      label: "Format",
      submenu: [
        {
          label: "Bold",
          accelerator: "CmdOrCtrl+B",
          click: () => emitMenuAction(window, { type: "apply-format", format: "bold" })
        },
        {
          label: "Italic",
          accelerator: "CmdOrCtrl+I",
          click: () => emitMenuAction(window, { type: "apply-format", format: "italic" })
        },
        {
          label: "Underline",
          accelerator: "CmdOrCtrl+U",
          click: () => emitMenuAction(window, { type: "apply-format", format: "underline" })
        },
        {
          label: "Strikethrough",
          accelerator: "CmdOrCtrl+Shift+5",
          click: () => emitMenuAction(window, { type: "apply-format", format: "strike" })
        },
        {
          label: "Inline Code",
          accelerator: "CmdOrCtrl+Shift+`",
          click: () => emitMenuAction(window, { type: "apply-format", format: "inline-code" })
        },
        { type: "separator" },
        {
          label: "Link",
          accelerator: "CmdOrCtrl+K",
          click: () => emitMenuAction(window, { type: "apply-format", format: "link" })
        },
        {
          label: "Image",
          accelerator: "CmdOrCtrl+Alt+I",
          click: () => emitMenuAction(window, { type: "insert-image" })
        }
      ]
    },
    {
      label: "View",
      submenu: [
        {
          label: "Show Sidebar",
          type: "checkbox",
          checked: preferences.sidebarVisible,
          accelerator: "CmdOrCtrl+Shift+L",
          click: () => sendPreferenceToggle(window, "sidebarVisible")
        },
        {
          label: "Outline",
          accelerator: "CmdOrCtrl+Shift+1",
          click: () => emitMenuAction(window, { type: "set-sidebar-tab", tab: "outline" })
        },
        {
          label: "Files",
          accelerator: "CmdOrCtrl+Shift+2",
          click: () => emitMenuAction(window, { type: "set-sidebar-tab", tab: "files" })
        },
        { type: "separator" },
        {
          label: "Editor Only",
          type: "radio",
          checked: preferences.viewMode === "editor",
          click: () => emitMenuAction(window, { type: "set-view-mode", mode: "editor" })
        },
        {
          label: "Split View",
          type: "radio",
          checked: preferences.viewMode === "split",
          click: () => emitMenuAction(window, { type: "set-view-mode", mode: "split" })
        },
        {
          label: "Source Only",
          type: "radio",
          checked: preferences.viewMode === "source",
          click: () => emitMenuAction(window, { type: "set-view-mode", mode: "source" })
        },
        {
          label: "Preview Only",
          type: "radio",
          checked: preferences.viewMode === "preview",
          click: () => emitMenuAction(window, { type: "set-view-mode", mode: "preview" })
        },
        { type: "separator" },
        {
          label: "Focus Mode",
          type: "checkbox",
          checked: preferences.focusMode,
          accelerator: "F8",
          click: () => sendPreferenceToggle(window, "focusMode")
        },
        {
          label: "Typewriter Mode",
          type: "checkbox",
          checked: preferences.typewriterMode,
          accelerator: "F9",
          click: () => sendPreferenceToggle(window, "typewriterMode")
        },
        { type: "separator" },
        { role: "togglefullscreen", label: "Toggle Full Screen", accelerator: "F11" },
        { role: "resetZoom", label: "Actual Size" },
        { role: "zoomIn", label: "Zoom In" },
        { role: "zoomOut", label: "Zoom Out" },
        { type: "separator" },
        { role: "reload", label: "Reload" },
        { role: "toggleDevTools", label: "Developer Tools", accelerator: "CmdOrCtrl+Shift+I" }
      ]
    },
    {
      label: "Theme",
      submenu: [
        {
          label: "Paper",
          type: "radio",
          checked: preferences.theme === "paper",
          click: () => sendThemeAction(window, "paper")
        },
        {
          label: "Forest",
          type: "radio",
          checked: preferences.theme === "forest",
          click: () => sendThemeAction(window, "forest")
        },
        {
          label: "Midnight",
          type: "radio",
          checked: preferences.theme === "midnight",
          click: () => sendThemeAction(window, "midnight")
        }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Markdown Reference",
          click: () => shell.openExternal(HELP_LINKS.markdownReference)
        },
        {
          label: "Shortcuts & Transforms",
          accelerator: "CmdOrCtrl+/",
          click: () => emitMenuAction(window, { type: "open-editing-cheatsheet" })
        },
        { type: "separator" },
        {
          label: "Website",
          click: () => shell.openExternal(HELP_LINKS.website)
        },
        { type: "separator" },
        { role: "about", label: "About Inkdown" }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  const theme = state.preferences?.theme || "paper";
  let bgColor = "#f8fafc"; // paper
  if (theme === "midnight") bgColor = "#0b0f19";
  if (theme === "forest") bgColor = "#f0fdf4";

  const browserWindowOptions = {
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: bgColor,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  };

  if (process.platform === "darwin") {
    browserWindowOptions.titleBarStyle = "hiddenInset";
  }

  const mainWindow = new BrowserWindow(browserWindowOptions);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (isAllowedRendererUrl(targetUrl, getRendererTrustOptions())) {
      return;
    }

    event.preventDefault();
    if (isSafeExternalUrl(targetUrl)) {
      shell.openExternal(targetUrl).catch(() => {});
    }
  });

  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(app.getAppPath(), "dist/index.html"));
  }

  rebuildMenu(mainWindow);
  updateWindowTitle(mainWindow);
  mainWindow.on("focus", () => updateWindowTitle(mainWindow));
  mainWindow.on("close", (event) => {
    if (!state.isDirty) {
      return;
    }

    const response = dialog.showMessageBoxSync(mainWindow, {
      type: "warning",
      buttons: ["Quit", "Cancel"],
      defaultId: 1,
      cancelId: 1,
      title: "Unsaved changes",
      message: "The current document has unsaved changes.",
      detail: "Quitting now will discard the unsaved content."
    });

    if (response !== 0) {
      event.preventDefault();
    }
  });
}

app.whenReady().then(async () => {
  state.preferences = await loadPreferences();
  registerAssetProtocol();
  await createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle("dialog:open-markdown", async (event) => {
  const window = requireTrustedIpcEvent(event);
  const result = await dialog.showOpenDialog(window, {
    title: "Open Markdown Document",
    properties: ["openFile"],
    filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd", "txt"] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  return safeOpenMarkdownFile(window, result.filePaths[0]);
});

ipcMain.handle("dialog:pick-workspace", async (event) => {
  const window = requireTrustedIpcEvent(event);
  const result = await dialog.showOpenDialog(window, {
    title: "Open Folder",
    properties: ["openDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  return {
    canceled: false,
    directoryPath: result.filePaths[0]
  };
});

ipcMain.handle("dialog:confirm-discard-changes", async (event) => {
  const window = requireTrustedIpcEvent(event);
  return {
    shouldContinue: await maybeContinueWithUnsavedChanges(window)
  };
});

ipcMain.handle("dialog:pick-image", async (event) => {
  const window = requireTrustedIpcEvent(event);
  const result = await dialog.showOpenDialog(window, {
    title: "Insert Image",
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  return { canceled: false, filePath: result.filePaths[0] };
});

ipcMain.handle("file:save-markdown", async (event, payload) => {
  const window = requireTrustedIpcEvent(event);
  let targetPath = payload.filePath || state.currentFilePath;

  try {
    if (!targetPath) {
      const result = await dialog.showSaveDialog(window, {
        title: "Save Markdown Document",
        defaultPath: "Untitled.md",
        filters: [{ name: "Markdown", extensions: ["md"] }]
      });

      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }

      targetPath = result.filePath;
    }

    const normalizedMarkdown = await relocateMarkdownImages(payload.markdown, targetPath);
    await fs.writeFile(targetPath, normalizedMarkdown, "utf8");
    state.currentFilePath = targetPath;
    state.isDirty = false;
    rebuildMenu(window);
    if (window) {
      updateWindowTitle(window);
    }

    return { canceled: false, filePath: targetPath, markdown: normalizedMarkdown };
  } catch (error) {
    return { canceled: true, error: buildIoErrorMessage("save document", error, targetPath) };
  }
});

ipcMain.handle("file:save-html", async (event, payload) => {
  const window = requireTrustedIpcEvent(event);
  const defaultName = state.currentFilePath
    ? `${path.basename(state.currentFilePath, path.extname(state.currentFilePath))}.html`
    : "Untitled.html";
  let targetPath = "";

  try {
    const result = await dialog.showSaveDialog(window, {
      title: "Export HTML",
      defaultPath: defaultName,
      filters: [{ name: "HTML", extensions: ["html"] }]
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    targetPath = result.filePath;
    await fs.writeFile(result.filePath, payload.html, "utf8");
    return { canceled: false, filePath: result.filePath };
  } catch (error) {
    return { canceled: true, error: buildIoErrorMessage("export HTML", error, targetPath || defaultName) };
  }
});

ipcMain.handle("file:save-pdf", async (event, payload) => {
  const window = requireTrustedIpcEvent(event);
  try {
    return await createPdfFromHtml(window, payload);
  } catch (error) {
    return { canceled: true, error: buildIoErrorMessage("export PDF", error, state.currentFilePath) };
  }
});

ipcMain.handle("file:open-markdown-path", async (event, filePath) => {
  const window = requireTrustedIpcEvent(event);
  return safeOpenMarkdownFile(window, filePath);
});

ipcMain.handle("file:list-workspace-tree", async (event, rootPath) => {
  requireTrustedIpcEvent(event);
  return listWorkspaceTree(rootPath, {
    ignoredWorkspaceDirs: DEFAULT_IGNORED_WORKSPACE_DIRS,
    markdownExtensions: DEFAULT_MARKDOWN_EXTENSIONS
  });
});

ipcMain.handle("file:persist-image-file", async (event, sourcePath) => {
  requireTrustedIpcEvent(event);
  try {
    return await persistImageFromPath(sourcePath);
  } catch (error) {
    return { error: buildIoErrorMessage("insert image", error, sourcePath) };
  }
});

ipcMain.handle("file:persist-image-buffer", async (event, payload) => {
  requireTrustedIpcEvent(event);
  try {
    return await persistImageFromBuffer(payload.bytes, payload.extension);
  } catch (error) {
    return { error: buildIoErrorMessage("insert pasted image", error) };
  }
});

ipcMain.handle("preferences:load", async (event) => {
  requireTrustedIpcEvent(event);
  return state.preferences;
});

ipcMain.handle("preferences:save", async (event, preferences) => {
  requireTrustedIpcEvent(event);
  return savePreferences(preferences);
});

ipcMain.handle("shell:open-external", async (event, targetUrl) => {
  requireTrustedIpcEvent(event);
  if (!isSafeExternalUrl(targetUrl)) {
    return { ok: false, error: "Blocked unsafe external URL." };
  }
  await shell.openExternal(targetUrl);
  return { ok: true };
});

ipcMain.handle("shell:show-item-in-folder", async (event, filePath) => {
  requireTrustedIpcEvent(event);
  if (filePath) {
    shell.showItemInFolder(filePath);
  }
  return { ok: true };
});

ipcMain.handle("document:set-dirty", (event, value) => {
  const window = requireTrustedIpcEvent(event);
  state.isDirty = Boolean(value);
  if (window) {
    updateWindowTitle(window);
  }
  return { ok: true };
});

ipcMain.handle("document:set-file-path", (event, filePath) => {
  const window = requireTrustedIpcEvent(event);
  state.currentFilePath = filePath || null;
  if (window) {
    rebuildMenu(window);
    updateWindowTitle(window);
  }
  return { ok: true };
});

ipcMain.on("app:get-path", (event, name) => {
  requireTrustedIpcEvent(event);
  event.returnValue = app.getPath(name);
});
