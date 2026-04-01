# Inkdown

Inkdown is a desktop Markdown editor that aims to become a best-in-class writing tool, with a focused single-column experience inspired by products such as Typora.

The repository-wide mission and engineering standard live in [AGENTS.md](./AGENTS.md). Treat that file as the default decision framework for product, UX, and implementation work.

## Current Features

- Single-column WYSIWYG editing experience
- Three view modes: editor, source, and preview
- Headings, bold, italic, underline, strikethrough, code blocks, and blockquotes
- Highlight, superscript, and subscript
- Bulleted lists, numbered lists, and task lists
- Link, image, and table insertion
- YAML front matter, footnotes, and GitHub-style callouts
- Drag-and-drop and paste image support, with saved documents automatically storing assets in a relative resources directory
- Open, save, and save-as for Markdown files
- HTML export
- PDF export
- Mermaid diagram and math expression preview
- Find and replace
- Document outline, word count, and unsaved-changes indicators
- Theme and typography preferences
- Windows `nsis` installer configuration via `electron-builder`

## Development

```bash
npm install
npm run dev
```

If you are debugging Electron in Windows PowerShell, do not use Unix-style environment variable prefixes directly (for example, `FOO=bar command`). PowerShell will treat values such as `=true` or `=*` as standalone commands and fail. This repository already includes a debug script you can run directly:

```bash
npm run dev:debug
```

It safely injects these debug variables:

- `ELECTRON_ENABLE_LOGGING=true`
- `ELECTRON_ENABLE_STACK_DUMPING=true`
- `DEBUG=*`
- `NODE_OPTIONS=--trace-warnings`

## Packaging

```bash
npm run build
```

To build the Windows installer, run:

```bash
npm run package:win
```

Build artifacts are written to the `release/` directory by default. This repository was initialized in a Linux/WSL environment, so whether the Windows installer can actually be produced also depends on whether the machine has cross-packaging dependencies such as `wine`.
