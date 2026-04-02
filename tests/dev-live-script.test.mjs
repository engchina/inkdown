import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const packageJson = JSON.parse(await fs.readFile(new URL("../package.json", import.meta.url), "utf8"));
const devLiveSource = await fs.readFile(new URL("../scripts/dev-live.mjs", import.meta.url), "utf8");

test("dev:live script launches the dedicated Electron live reload runner", () => {
  assert.equal(packageJson.scripts["dev:live"], "node scripts/dev-live.mjs");
});

test("dev live runner watches Electron entrypoints and injects the Vite dev server url", () => {
  assert.match(devLiveSource, /const viteServerUrl = "http:\/\/127\.0\.0\.1:5173";/);
  assert.match(devLiveSource, /const watchRoots = \[path\.join\(projectRoot, "src", "main"\), path\.join\(projectRoot, "src", "preload"\)\];/);
  assert.match(devLiveSource, /VITE_DEV_SERVER_URL: viteServerUrl/);
  assert.match(devLiveSource, /fs\.watch\(rootDir, \{ recursive: true \}/);
  assert.match(devLiveSource, /scheduleElectronRestart/);
});

test("dev live runner can reuse an already running Vite server", () => {
  assert.match(devLiveSource, /async function isViteServerReachable\(\)/);
  assert.match(devLiveSource, /if \(await isViteServerReachable\(\)\) \{/);
  assert.match(devLiveSource, /Using existing Vite dev server on port 5173\./);
});
