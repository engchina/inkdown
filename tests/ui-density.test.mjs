import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const sidebarSource = await fs.readFile(new URL("../src/renderer/components/Sidebar.jsx", import.meta.url), "utf8");
const statusSource = await fs.readFile(new URL("../src/renderer/components/StatusBar.jsx", import.meta.url), "utf8");
const toolbarSource = await fs.readFile(new URL("../src/renderer/components/Toolbar.jsx", import.meta.url), "utf8");
const stylesSource = await fs.readFile(new URL("../src/renderer/styles/app.css", import.meta.url), "utf8");

test("sidebar shows result badges for all panels", () => {
  assert.match(sidebarSource, /filteredFileCount/);
  assert.match(sidebarSource, /const resultBadge =/);
  assert.match(sidebarSource, /<span className="sidebar-content-count">\{resultBadge\}<\/span>/);
});

test("sidebar turns empty file states into a launchpad with recent documents", () => {
  assert.match(sidebarSource, /recentFiles = \[\]/);
  assert.match(sidebarSource, /sidebar-launchpad/);
  assert.match(sidebarSource, /Recent documents/);
  assert.match(sidebarSource, /Open folder/);
  assert.match(sidebarSource, /Open document/);
  assert.match(sidebarSource, /New document/);
});

test("status bar renders emphasized state and hosts sidebar and view controls", () => {
  assert.match(statusSource, /status-state/);
  assert.match(statusSource, /status-pill/);
  assert.match(statusSource, /status-view-switch/);
  assert.match(statusSource, /status-view-button/);
  assert.match(statusSource, /status-sidebar-toggle/);
  assert.match(statusSource, /status-sidebar-icon/);
  assert.match(statusSource, /is-split/);
  assert.match(statusSource, /is-collapsed/);
  assert.match(statusSource, /aria-label=\{sidebarVisible \? "Hide sidebar" : "Show sidebar"\}/);
  assert.doesNotMatch(toolbarSource, /sidebar-toggle-button/);
});

test("styles define denser sidebar and status presentation", () => {
  assert.match(stylesSource, /\.sidebar-content-header \{/);
  assert.match(stylesSource, /position: sticky;/);
  assert.match(stylesSource, /\.sidebar-spotlight-card \{/);
  assert.match(stylesSource, /\.sidebar-empty-state \{/);
  assert.match(stylesSource, /\.sidebar-recent-list \{/);
  assert.match(stylesSource, /\.status-pill \{/);
  assert.match(stylesSource, /\.status-sidebar-toggle \{/);
  assert.match(stylesSource, /\.status-sidebar-icon \{/);
  assert.match(stylesSource, /\.status-view-switch \{/);
  assert.match(stylesSource, /\.status-sidebar-icon\.is-collapsed \{/);
  assert.match(stylesSource, /\.status-sidebar-icon\.is-split \.status-sidebar-icon-main \{/);
  assert.match(stylesSource, /\.toolbar-theme-switch \{/);
});
