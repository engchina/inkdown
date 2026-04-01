import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { listWorkspaceTree } = require("../src/main/utils/workspaceTree.js");

async function withTempWorkspace(run) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "inkdown-workspace-"));
  try {
    await run(tempRoot);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

test("listWorkspaceTree only returns markdown files and visible directories", async () => {
  await withTempWorkspace(async (tempRoot) => {
    await fs.mkdir(path.join(tempRoot, "notes"), { recursive: true });
    await fs.mkdir(path.join(tempRoot, ".hidden"), { recursive: true });
    await fs.writeFile(path.join(tempRoot, "notes", "draft.md"), "# Draft", "utf8");
    await fs.writeFile(path.join(tempRoot, "notes", "image.png"), "png", "utf8");
    await fs.writeFile(path.join(tempRoot, ".hidden", "secret.md"), "# Hidden", "utf8");

    const tree = await listWorkspaceTree(tempRoot);
    assert.equal(tree.type, "directory");
    assert.deepEqual(tree.children.map((child) => child.name), ["notes"]);
    assert.deepEqual(tree.children[0].children.map((child) => child.name), ["draft.md"]);
  });
});

test("listWorkspaceTree skips symlinked directories to avoid recursive loops", async (t) => {
  await withTempWorkspace(async (tempRoot) => {
    await fs.mkdir(path.join(tempRoot, "docs"), { recursive: true });
    await fs.writeFile(path.join(tempRoot, "docs", "guide.md"), "# Guide", "utf8");

    const loopPath = path.join(tempRoot, "docs-loop");
    try {
      await fs.symlink(path.join(tempRoot, "docs"), loopPath, "junction");
    } catch (error) {
      t.skip(`Symlink setup unavailable: ${error.code || error.message}`);
      return;
    }

    const tree = await listWorkspaceTree(tempRoot);
    assert.equal(tree.children.some((child) => child.name === "docs-loop"), false);
    assert.equal(tree.children.some((child) => child.name === "docs"), true);
  });
});
