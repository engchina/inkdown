const { app, BrowserWindow, Menu, dialog, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const state = {
  currentFilePath: null,
  isDirty: false
};

function getPreferencesPath() {
  return path.join(app.getPath("userData"), "preferences.json");
}

function getDefaultPreferences() {
  return {
    theme: "paper",
    viewMode: "editor",
    fontSize: 18,
    lineWidth: 900
  };
}

function updateWindowTitle(window) {
  const name = state.currentFilePath ? path.basename(state.currentFilePath) : "Untitled.md";
  const dirtySuffix = state.isDirty ? " *" : "";
  window.setTitle(`${name}${dirtySuffix} - Inkdown`);
}

function sanitizeFileName(value) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
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
    const html = payload.html;
    await previewWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);
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

async function getImageTargetDirectory() {
  if (state.currentFilePath) {
    const documentDir = path.dirname(state.currentFilePath);
    const documentName = path.basename(state.currentFilePath, path.extname(state.currentFilePath));
    const assetsFolderName = `${sanitizeFileName(documentName) || "document"}.assets`;
    const absoluteDir = path.join(documentDir, assetsFolderName);
    await fs.mkdir(absoluteDir, { recursive: true });
    return {
      absoluteDir,
      relativeDir: assetsFolderName
    };
  }

  const tempDir = path.join(app.getPath("temp"), "inkdown-images");
  await fs.mkdir(tempDir, { recursive: true });
  return {
    absoluteDir: tempDir,
    relativeDir: null
  };
}

function getTimestampedImageName(extension) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `image-${stamp}${extension}`;
}

async function persistImageFromPath(sourcePath) {
  const { absoluteDir, relativeDir } = await getImageTargetDirectory();
  const extension = path.extname(sourcePath) || ".png";
  const originalBaseName = sanitizeFileName(path.basename(sourcePath, extension));
  const fileName = `${originalBaseName || getTimestampedImageName("").replace(/\.$/, "")}-${Date.now()}${extension}`;
  const destinationPath = path.join(absoluteDir, fileName);

  await fs.copyFile(sourcePath, destinationPath);

  return {
    absolutePath: destinationPath,
    markdownPath: relativeDir ? path.posix.join(relativeDir, fileName) : destinationPath
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
    markdownPath: relativeDir ? path.posix.join(relativeDir, fileName) : destinationPath
  };
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

  const menu = Menu.buildFromTemplate([
    {
      label: "文件",
      submenu: [
        {
          label: "新建",
          accelerator: "CmdOrCtrl+N",
          click: async () => {
            if (!(await maybeContinueWithUnsavedChanges(mainWindow))) {
              return;
            }
            state.currentFilePath = null;
            state.isDirty = false;
            updateWindowTitle(mainWindow);
            mainWindow.webContents.send("menu-action", { type: "new-file" });
          }
        },
        {
          label: "打开",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            if (!(await maybeContinueWithUnsavedChanges(mainWindow))) {
              return;
            }
            mainWindow.webContents.send("menu-action", { type: "open-file" });
          }
        },
        { type: "separator" },
        {
          label: "保存",
          accelerator: "CmdOrCtrl+S",
          click: () => mainWindow.webContents.send("menu-action", { type: "save-file" })
        },
        {
          label: "另存为",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => mainWindow.webContents.send("menu-action", { type: "save-file-as" })
        },
        { type: "separator" },
        {
          label: "导出 HTML",
          accelerator: "CmdOrCtrl+Shift+E",
          click: () => mainWindow.webContents.send("menu-action", { type: "export-html" })
        },
        {
          label: "导出 PDF",
          accelerator: "CmdOrCtrl+Shift+P",
          click: () => mainWindow.webContents.send("menu-action", { type: "export-pdf" })
        },
        { type: "separator" },
        { role: "quit", label: "退出" }
      ]
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        {
          label: "查找与替换",
          accelerator: "CmdOrCtrl+F",
          click: () => mainWindow.webContents.send("menu-action", { type: "open-find" })
        },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" }
      ]
    },
    {
      label: "插入",
      submenu: [
        {
          label: "图片",
          accelerator: "CmdOrCtrl+Shift+I",
          click: () => mainWindow.webContents.send("menu-action", { type: "insert-image" })
        },
        {
          label: "表格",
          accelerator: "CmdOrCtrl+Alt+T",
          click: () => mainWindow.webContents.send("menu-action", { type: "insert-table" })
        }
      ]
    },
    {
      label: "视图",
      submenu: [
        {
          label: "仅编辑",
          accelerator: "CmdOrCtrl+1",
          click: () => mainWindow.webContents.send("menu-action", { type: "set-view-mode", mode: "editor" })
        },
        {
          label: "分栏",
          accelerator: "CmdOrCtrl+2",
          click: () => mainWindow.webContents.send("menu-action", { type: "set-view-mode", mode: "split" })
        },
        {
          label: "仅源码",
          accelerator: "CmdOrCtrl+3",
          click: () => mainWindow.webContents.send("menu-action", { type: "set-view-mode", mode: "source" })
        },
        { type: "separator" },
        {
          label: "偏好设置",
          accelerator: "CmdOrCtrl+,",
          click: () => mainWindow.webContents.send("menu-action", { type: "open-preferences" })
        },
        { type: "separator" },
        { role: "reload", label: "重新加载" },
        { role: "toggleDevTools", label: "开发者工具" },
        { type: "separator" },
        { role: "resetZoom", label: "实际大小" },
        { role: "zoomIn", label: "放大" },
        { role: "zoomOut", label: "缩小" },
        { type: "separator" },
        { role: "togglefullscreen", label: "全屏" }
      ]
    }
  ]);

  Menu.setApplicationMenu(menu);
}

app.whenReady().then(createWindow);

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
    filters: [
      { name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd", "txt"] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath, "utf8");
  state.currentFilePath = filePath;
  state.isDirty = false;
  if (window) {
    updateWindowTitle(window);
  }
  return { canceled: false, filePath, content };
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

  await fs.writeFile(targetPath, payload.markdown, "utf8");
  state.currentFilePath = targetPath;
  state.isDirty = false;
  if (window) {
    updateWindowTitle(window);
  }
  return { canceled: false, filePath: targetPath };
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

ipcMain.handle("file:persist-image-file", async (_, sourcePath) => {
  return persistImageFromPath(sourcePath);
});

ipcMain.handle("file:persist-image-buffer", async (_, payload) => {
  return persistImageFromBuffer(payload.bytes, payload.extension);
});

ipcMain.handle("preferences:load", async () => {
  return loadPreferences();
});

ipcMain.handle("preferences:save", async (_, preferences) => {
  return savePreferences(preferences);
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
    updateWindowTitle(window);
  }
  return { ok: true };
});
