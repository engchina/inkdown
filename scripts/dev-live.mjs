import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const electronBinary = require("electron");
const viteCli = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const viteServerUrl = "http://127.0.0.1:5173";
const watchRoots = [path.join(projectRoot, "src", "main"), path.join(projectRoot, "src", "preload")];

let viteProcess = null;
let electronProcess = null;
let restartTimer = null;
let shuttingDown = false;
const watchers = [];

function log(message) {
  process.stdout.write(`[dev:live] ${message}\n`);
}

function pipeOutput(child, label) {
  child.stdout?.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
}

function spawnProcess(command, args, options = {}) {
  return spawn(command, args, {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    ...options
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isViteServerReachable() {
  try {
    const response = await fetch(viteServerUrl, { method: "HEAD" });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

async function waitForViteServer(timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isViteServerReachable()) {
      return;
    }
    await wait(250);
  }

  throw new Error(`Timed out waiting for Vite at ${viteServerUrl}`);
}

function startVite() {
  viteProcess = spawnProcess(process.execPath, [viteCli], {
    env: process.env
  });
  pipeOutput(viteProcess, "vite");
  viteProcess.on("exit", async (code, signal) => {
    viteProcess = null;
    if (shuttingDown) {
      return;
    }

    if (await isViteServerReachable()) {
      log("Using existing Vite dev server on port 5173.");
      return;
    }

    log(`Vite exited unexpectedly (code=${code ?? "null"}, signal=${signal ?? "null"}).`);
    void shutdown(code ?? 1);
  });
}

function startElectron() {
  const env = {
    ...process.env,
    VITE_DEV_SERVER_URL: viteServerUrl
  };
  electronProcess = spawnProcess(electronBinary, ["."], { env });
  pipeOutput(electronProcess, "electron");
  electronProcess.on("exit", (code, signal) => {
    electronProcess = null;
    if (!shuttingDown && code && code !== 0) {
      log(`Electron exited with code ${code} (signal=${signal ?? "null"}).`);
    }
  });
}

async function stopElectron() {
  if (!electronProcess) {
    return;
  }

  const child = electronProcess;
  electronProcess = null;
  child.kill();

  const closed = await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve(true);
      }
    };

    child.once("exit", finish);
    setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(false);
      }
    }, 2000);
  });

  if (!closed && child.pid) {
    const killer =
      process.platform === "win32"
        ? spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" })
        : spawn("kill", ["-9", String(child.pid)], { stdio: "ignore" });

    await new Promise((resolve) => killer.once("exit", resolve));
  }
}

function scheduleElectronRestart(reason) {
  if (shuttingDown) {
    return;
  }

  if (restartTimer) {
    clearTimeout(restartTimer);
  }

  restartTimer = setTimeout(async () => {
    restartTimer = null;
    log(`Restarting Electron after ${reason}.`);
    await stopElectron();
    if (!shuttingDown) {
      startElectron();
    }
  }, 150);
}

function watchDirectory(rootDir) {
  const watcher = fs.watch(rootDir, { recursive: true }, (_eventType, filename) => {
    if (!filename) {
      scheduleElectronRestart(path.relative(projectRoot, rootDir));
      return;
    }
    scheduleElectronRestart(path.join(path.relative(projectRoot, rootDir), filename.toString()));
  });

  watcher.on("error", (error) => {
    if (!shuttingDown) {
      log(`Watcher error for ${path.relative(projectRoot, rootDir)}: ${error.message}`);
    }
  });

  watchers.push(watcher);
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  for (const watcher of watchers.splice(0)) {
    watcher.close();
  }

  await stopElectron();

  if (viteProcess) {
    const child = viteProcess;
    viteProcess = null;
    child.kill();
  }

  process.exit(exitCode);
}

process.on("SIGINT", () => {
  void shutdown(0);
});

process.on("SIGTERM", () => {
  void shutdown(0);
});

process.on("uncaughtException", (error) => {
  console.error(error);
  void shutdown(1);
});

process.on("unhandledRejection", (error) => {
  console.error(error);
  void shutdown(1);
});

async function main() {
  log("Starting Vite and Electron live-reload session.");
  if (await isViteServerReachable()) {
    log("Using existing Vite dev server on port 5173.");
  } else {
    startVite();
    await waitForViteServer();
  }
  for (const rootDir of watchRoots) {
    watchDirectory(rootDir);
  }
  startElectron();
}

await main();
