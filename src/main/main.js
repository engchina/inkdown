const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { fileURLToPath, pathToFileURL } = require("node:url");

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const ASSET_PROTOCOL = "inkdown-asset";
const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown", ".mdown", ".mkd", ".txt"]);
const IGNORED_WORKSPACE_DIRS = new Set([".git", "node_modules", "dist", "release", "build", "coverage"]);
const HELP_LINKS = {
  quickStart: "https://support.typora.io/Quick-Start/",
  markdownReference: "https://support.typora.io/Markdown-Reference/",
  customThemes: "https://support.typora.io/Custom-Themes/",
  whatsNew: "https://support.typora.io/what's-new/",
  website: "https://typora.io/"
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
    workspaceRoot: null
  };
}

function updateWindowTitle(window) {
  const name = state.currentFilePath ? path.basename(state.currentFilePath) : "Untitled.md";
  const dirtySuffix = state.isDirty ? " *" : "";
  window.setTitle(`${name}${dirtySuffix} - Inkdown`);
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
    return {
      ...getDefaultPreferences(),
      ...JSON.parse(raw)
    };
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
    buttons: ["继续", "取消"],
    defaultId: 1,
    cancelId: 1,
    title: "未保存的更改",
    message: "当前文档有未保存的修改。",
    detail: "继续操作会丢失尚未保存的内容。"
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

async function createPdfFromHtml(window, payload) {
  const defaultName = state.currentFilePath
    ? `${path.basename(state.currentFilePath, path.extname(state.currentFilePath))}.pdf`
    : "Untitled.pdf";

  const result = await dialog.showSaveDialog(window, {
    title: "导出 PDF",
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

function buildAssetResponse(targetPath) {
  return net.fetch(pathToFileURL(targetPath).toString());
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

function compareFileNodes(left, right) {
  if (left.type !== right.type) {
    return left.type === "directory" ? -1 : 1;
  }

  return left.name.localeCompare(right.name, "zh-CN", { numeric: true, sensitivity: "base" });
}

async function buildWorkspaceNode(targetPath, isRoot = false) {
  const entryName = path.basename(targetPath);
  const stats = await fs.stat(targetPath);

  if (!stats.isDirectory()) {
    if (!isMarkdownFilePath(targetPath)) {
      return null;
    }

    return {
      type: "file",
      name: entryName,
      path: targetPath
    };
  }

  if (IGNORED_WORKSPACE_DIRS.has(entryName)) {
    return null;
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const visibleEntries = entries.filter((entry) => !entry.name.startsWith("."));
  const children = (
    await Promise.all(
      visibleEntries.map(async (entry) => buildWorkspaceNode(path.join(targetPath, entry.name)))
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
}

async function listWorkspaceTree(rootPath) {
  if (!rootPath) {
    return null;
  }

  if (!(await pathExists(rootPath))) {
    return null;
  }

  return buildWorkspaceNode(rootPath, true);
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
      label: "文件",
      submenu: [
        {
          label: "新建",
          accelerator: "CmdOrCtrl+N",
          click: () => emitMenuAction(window, { type: "new-file" })
        },
        {
          label: "打开...",
          accelerator: "CmdOrCtrl+O",
          click: () => emitMenuAction(window, { type: "open-file" })
        },
        {
          label: "打开文件夹...",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => emitMenuAction(window, { type: "pick-workspace" })
        },
        {
          label: "在文件夹中显示",
          accelerator: "CmdOrCtrl+Shift+R",
          enabled: Boolean(state.currentFilePath),
          click: () => emitMenuAction(window, { type: "reveal-current-file" })
        },
        { type: "separator" },
        {
          label: "保存",
          accelerator: "CmdOrCtrl+S",
          click: () => emitMenuAction(window, { type: "save-file" })
        },
        {
          label: "另存为",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => emitMenuAction(window, { type: "save-file-as" })
        },
        { type: "separator" },
        {
          label: "导出 HTML",
          accelerator: "CmdOrCtrl+Shift+E",
          click: () => emitMenuAction(window, { type: "export-html" })
        },
        {
          label: "导出 PDF",
          accelerator: "CmdOrCtrl+Shift+P",
          click: () => emitMenuAction(window, { type: "export-pdf" })
        },
        { type: "separator" },
        {
          label: "偏好设置...",
          accelerator: "CmdOrCtrl+,",
          click: () => emitMenuAction(window, { type: "open-preferences" })
        },
        { type: "separator" },
        { role: "close", label: "关闭" }
      ]
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
        { type: "separator" },
        {
          label: "查找与替换",
          accelerator: "CmdOrCtrl+F",
          click: () => emitMenuAction(window, { type: "open-find" })
        }
      ]
    },
    {
      label: "段落",
      submenu: [
        {
          label: "正文",
          accelerator: "CmdOrCtrl+Alt+0",
          click: () => emitMenuAction(window, { type: "apply-format", format: "paragraph" })
        },
        {
          label: "一级标题",
          accelerator: "CmdOrCtrl+1",
          click: () => emitMenuAction(window, { type: "apply-format", format: "heading-1" })
        },
        {
          label: "二级标题",
          accelerator: "CmdOrCtrl+2",
          click: () => emitMenuAction(window, { type: "apply-format", format: "heading-2" })
        },
        {
          label: "三级标题",
          accelerator: "CmdOrCtrl+3",
          click: () => emitMenuAction(window, { type: "apply-format", format: "heading-3" })
        },
        { type: "separator" },
        {
          label: "无序列表",
          accelerator: "CmdOrCtrl+Shift+7",
          click: () => emitMenuAction(window, { type: "apply-format", format: "bullet-list" })
        },
        {
          label: "有序列表",
          accelerator: "CmdOrCtrl+Shift+8",
          click: () => emitMenuAction(window, { type: "apply-format", format: "ordered-list" })
        },
        {
          label: "任务列表",
          accelerator: "CmdOrCtrl+Shift+9",
          click: () => emitMenuAction(window, { type: "apply-format", format: "task-list" })
        },
        {
          label: "引用块",
          accelerator: "CmdOrCtrl+Shift+Q",
          click: () => emitMenuAction(window, { type: "apply-format", format: "blockquote" })
        },
        {
          label: "代码块",
          accelerator: "CmdOrCtrl+Alt+C",
          click: () => emitMenuAction(window, { type: "apply-format", format: "code-block" })
        },
        {
          label: "水平线",
          accelerator: "CmdOrCtrl+Alt+-",
          click: () => emitMenuAction(window, { type: "apply-format", format: "horizontal-rule" })
        },
        {
          label: "表格",
          accelerator: "CmdOrCtrl+Alt+T",
          click: () => emitMenuAction(window, { type: "insert-table" })
        }
      ]
    },
    {
      label: "格式",
      submenu: [
        {
          label: "加粗",
          accelerator: "CmdOrCtrl+B",
          click: () => emitMenuAction(window, { type: "apply-format", format: "bold" })
        },
        {
          label: "斜体",
          accelerator: "CmdOrCtrl+I",
          click: () => emitMenuAction(window, { type: "apply-format", format: "italic" })
        },
        {
          label: "下划线",
          accelerator: "CmdOrCtrl+U",
          click: () => emitMenuAction(window, { type: "apply-format", format: "underline" })
        },
        {
          label: "删除线",
          accelerator: "CmdOrCtrl+Shift+5",
          click: () => emitMenuAction(window, { type: "apply-format", format: "strike" })
        },
        {
          label: "行内代码",
          accelerator: "CmdOrCtrl+Shift+`",
          click: () => emitMenuAction(window, { type: "apply-format", format: "inline-code" })
        },
        { type: "separator" },
        {
          label: "超链接",
          accelerator: "CmdOrCtrl+K",
          click: () => emitMenuAction(window, { type: "apply-format", format: "link" })
        },
        {
          label: "图片",
          accelerator: "CmdOrCtrl+Shift+I",
          click: () => emitMenuAction(window, { type: "insert-image" })
        }
      ]
    },
    {
      label: "视图",
      submenu: [
        {
          label: "显示侧边栏",
          type: "checkbox",
          checked: preferences.sidebarVisible,
          accelerator: "CmdOrCtrl+Shift+L",
          click: () => sendPreferenceToggle(window, "sidebarVisible")
        },
        {
          label: "文件列表",
          accelerator: "CmdOrCtrl+Shift+2",
          click: () => emitMenuAction(window, { type: "set-sidebar-tab", tab: "files" })
        },
        {
          label: "大纲",
          accelerator: "CmdOrCtrl+Shift+1",
          click: () => emitMenuAction(window, { type: "set-sidebar-tab", tab: "outline" })
        },
        { type: "separator" },
        {
          label: "仅编辑",
          type: "radio",
          checked: preferences.viewMode === "editor",
          click: () => emitMenuAction(window, { type: "set-view-mode", mode: "editor" })
        },
        {
          label: "分栏",
          type: "radio",
          checked: preferences.viewMode === "split",
          click: () => emitMenuAction(window, { type: "set-view-mode", mode: "split" })
        },
        {
          label: "仅源码",
          type: "radio",
          checked: preferences.viewMode === "source",
          click: () => emitMenuAction(window, { type: "set-view-mode", mode: "source" })
        },
        {
          label: "仅预览",
          type: "radio",
          checked: preferences.viewMode === "preview",
          click: () => emitMenuAction(window, { type: "set-view-mode", mode: "preview" })
        },
        { type: "separator" },
        {
          label: "专注模式",
          type: "checkbox",
          checked: preferences.focusMode,
          accelerator: "F8",
          click: () => sendPreferenceToggle(window, "focusMode")
        },
        {
          label: "打字机模式",
          type: "checkbox",
          checked: preferences.typewriterMode,
          accelerator: "F9",
          click: () => sendPreferenceToggle(window, "typewriterMode")
        },
        { type: "separator" },
        { role: "togglefullscreen", label: "切换全屏", accelerator: "F11" },
        { role: "resetZoom", label: "实际大小" },
        { role: "zoomIn", label: "放大" },
        { role: "zoomOut", label: "缩小" },
        { type: "separator" },
        { role: "reload", label: "重新加载" },
        { role: "toggleDevTools", label: "开发者工具" }
      ]
    },
    {
      label: "主题",
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
      label: "帮助",
      submenu: [
        {
          label: "Quick Start",
          click: () => shell.openExternal(HELP_LINKS.quickStart)
        },
        {
          label: "Markdown Reference",
          click: () => shell.openExternal(HELP_LINKS.markdownReference)
        },
        {
          label: "Custom Themes",
          click: () => shell.openExternal(HELP_LINKS.customThemes)
        },
        {
          label: "更新日志",
          click: () => shell.openExternal(HELP_LINKS.whatsNew)
        },
        { type: "separator" },
        {
          label: "官方网站",
          click: () => shell.openExternal(HELP_LINKS.website)
        },
        { type: "separator" },
        { role: "about", label: "关于 Inkdown" }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: "#f5f0e7",
    titleBarStyle: "hiddenInset",
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
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
      buttons: ["退出", "取消"],
      defaultId: 1,
      cancelId: 1,
      title: "未保存的更改",
      message: "当前文档有未保存的修改。",
      detail: "现在退出会丢失尚未保存的内容。"
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

ipcMain.handle("dialog:open-markdown", async () => {
  const window = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(window, {
    title: "打开 Markdown 文档",
    properties: ["openFile"],
    filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd", "txt"] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  return openMarkdownFile(window, result.filePaths[0]);
});

ipcMain.handle("dialog:pick-workspace", async () => {
  const window = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(window, {
    title: "打开文件夹",
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

ipcMain.handle("dialog:confirm-discard-changes", async () => {
  const window = BrowserWindow.getFocusedWindow();
  return {
    shouldContinue: await maybeContinueWithUnsavedChanges(window)
  };
});

ipcMain.handle("dialog:pick-image", async () => {
  const window = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(window, {
    title: "插入图片",
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  return { canceled: false, filePath: result.filePaths[0] };
});

ipcMain.handle("file:save-markdown", async (_, payload) => {
  const window = BrowserWindow.getFocusedWindow();
  let targetPath = payload.filePath || state.currentFilePath;

  if (!targetPath) {
    const result = await dialog.showSaveDialog(window, {
      title: "保存 Markdown 文档",
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
});

ipcMain.handle("file:save-html", async (_, payload) => {
  const window = BrowserWindow.getFocusedWindow();
  const defaultName = state.currentFilePath
    ? `${path.basename(state.currentFilePath, path.extname(state.currentFilePath))}.html`
    : "Untitled.html";

  const result = await dialog.showSaveDialog(window, {
    title: "导出 HTML",
    defaultPath: defaultName,
    filters: [{ name: "HTML", extensions: ["html"] }]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  await fs.writeFile(result.filePath, payload.html, "utf8");
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle("file:save-pdf", async (_, payload) => {
  const window = BrowserWindow.getFocusedWindow();
  return createPdfFromHtml(window, payload);
});

ipcMain.handle("file:open-markdown-path", async (_, filePath) => {
  const window = BrowserWindow.getFocusedWindow();
  return openMarkdownFile(window, filePath);
});

ipcMain.handle("file:list-workspace-tree", async (_, rootPath) => {
  return listWorkspaceTree(rootPath);
});

ipcMain.handle("file:persist-image-file", async (_, sourcePath) => persistImageFromPath(sourcePath));

ipcMain.handle("file:persist-image-buffer", async (_, payload) =>
  persistImageFromBuffer(payload.bytes, payload.extension)
);

ipcMain.handle("preferences:load", async () => state.preferences);

ipcMain.handle("preferences:save", async (_, preferences) => savePreferences(preferences));

ipcMain.handle("shell:open-external", async (_, targetUrl) => {
  await shell.openExternal(targetUrl);
  return { ok: true };
});

ipcMain.handle("shell:show-item-in-folder", async (_, filePath) => {
  if (filePath) {
    shell.showItemInFolder(filePath);
  }
  return { ok: true };
});

ipcMain.handle("document:set-dirty", (_, value) => {
  const window = BrowserWindow.getFocusedWindow();
  state.isDirty = Boolean(value);
  if (window) {
    updateWindowTitle(window);
  }
  return { ok: true };
});

ipcMain.handle("document:set-file-path", (_, filePath) => {
  const window = BrowserWindow.getFocusedWindow();
  state.currentFilePath = filePath || null;
  if (window) {
    rebuildMenu(window);
    updateWindowTitle(window);
  }
  return { ok: true };
});
