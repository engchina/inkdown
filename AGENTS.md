# Inkdown Engineering Principles

## Mission

Inkdown exists to become a best-in-class Markdown editor.

The bar is not "good enough to edit Markdown." The bar is a professional writing tool that can stand beside the strongest products in the category while keeping a clear product point of view of its own.

## Product Standard

Every meaningful change in this repository should move Inkdown toward these outcomes:

- fast, stable, and predictable editing
- excellent Markdown fidelity, including complex real-world documents
- polished reading and writing experience with low friction
- strong defaults for professional workflows
- maintainable architecture with low regression risk

## Best-Practice Baseline

When making product or engineering decisions, use the best ideas from leading Markdown editors and writing tools as the baseline, not as a copy target.

Reference points include products such as Typora, Obsidian, VS Code Markdown, Bear, iA Writer, and Notion. Study what they do well, understand why it works, and adapt the principle to Inkdown's own product direction.

## Decision Filter

Before shipping a feature, refactor, or fix, ask:

1. Does this improve the core writing and editing experience?
2. Does this make Markdown behavior more trustworthy, more complete, or more intuitive?
3. Does this reduce friction for serious day-to-day use?
4. Does this preserve or improve performance, consistency, and maintainability?
5. Is this good enough for a product aiming to be one of the best in its category?

If the answer is "no" or "not sure," the work likely needs another iteration.

## Engineering Expectations

- Protect cursor stability, selection behavior, undo/redo integrity, and input responsiveness.
- Prefer changes that keep large documents usable and avoid unnecessary rendering or state churn.
- Treat export, import, persistence, and recovery paths as core product features, not edge cases.
- Keep cross-mode behavior consistent across WYSIWYG, source, and preview experiences.
- Add or update tests when behavior is non-trivial or regression-prone.
- Favor clear architecture over one-off patches that raise future complexity.

## UX Expectations

- Default behaviors should feel obvious without reading documentation.
- Power features should exist without making common flows feel heavy.
- Visual polish matters, but never at the expense of writing speed or reliability.
- Empty states, errors, and long-document workflows should feel intentional.

## Inline Markdown Interaction

- Treat Typora-style inline Markdown editing as a product rule, not an incidental implementation detail.
- For inline Markdown marks, closing delimiters must not immediately collapse into rendered formatting while the caret is still touching that mark context.
- Collapse inline marks only after the caret or selection has actually left the mark's content span; typing new content outside the mark should count as leaving it.
- Entering a rendered inline mark by keyboard or mouse should immediately reveal its Markdown source, including when the caret lands exactly on the left or right formatting boundary.
- When adjacent inline marks meet, caret mapping must preserve the user's logical click position at the boundary. Do not jump the caret across closing or opening delimiters.
- Expanding one inline mark near an adjacent rendered mark should reveal the full contiguous Markdown context needed to make boundary editing predictable.
- Copy, cut, serialization, and round-tripping must preserve canonical Markdown tokens. Expanded source text must copy as Markdown source, not as escaped literal text wrapped by formatting marks.
- Changes to inline Markdown reveal/collapse behavior require regression tests that cover typing, boundary entry, mouse placement, adjacent marks, and clipboard fidelity.

## Markdown Reference Alignment

- Follow Typora Markdown Reference behavior as the default Markdown contract for Inkdown unless Inkdown has a clearly better, documented reason not to.
- Treat GitHub Flavored Markdown as the baseline syntax model, while preserving explicitly documented Typora-compatible extensions where Inkdown supports them.

## Web Clipboard Fidelity

- Treat copy-paste from web articles as a core Markdown workflow, not as best-effort rich-text handling.
- When clipboard data includes both `text/html` and `text/plain`, preserve Markdown structure from the HTML payload whenever it contains article structure, links, images, lists, headings, tables, blockquotes, or other meaningful formatting.
- Do not let generic multiline plain text detection preempt structured HTML conversion. Plain text should only win when it is clearly intentional Markdown source.
- Converting web HTML to Markdown must preserve canonical Markdown tokens for headings, lists, task lists, links, images, code fences, tables, blockquotes, and other supported syntax.
- Image handling for pasted web content must preserve the original remote source URL by default whenever the clipboard exposes it through `src` or common canonical/original image attributes.
- Relative links and image URLs from pasted web content must resolve against the clipboard page base when available so saved local documents remain readable.
- Web paste behavior must stay consistent across WYSIWYG, source, preview, export, and serialization paths. Users must not see structure in one surface and lose it in another.
- Clipboard HTML detection, HTML-to-Markdown conversion, remote image preservation, relative URL resolution, and Markdown/plain-text precedence rules require regression tests.
- Preload or renderer asset-path helpers used by paste, preview, or export flows must not rely on Node URL helpers that are unavailable or unstable in the target runtime context. Prefer self-contained path/url conversion logic with regression coverage.

### Block Elements

- Paragraphs should separate with blank lines in source, while a single `Return` in the rich editor should create the next paragraph in a predictable way.
- `Shift+Return` should represent a single line break behavior that round-trips cleanly.
- Headings must accept one to six leading `#` markers at the start of a line, followed by a space and title text.
- Blockquotes must accept `>` prefixes, including nested blockquotes with multiple `>` levels.
- Unordered lists must accept `*`, `+`, or `-` as markers followed by a space and item content.
- Ordered lists must accept `1.`-style numeric markers followed by a space and item content.
- Task lists must accept `[ ]` and `[x]` checkboxes in list items and preserve their checked state in source and rendered editing.
- Code blocks must prefer fenced syntax, support optional language identifiers, and preserve the fence form in serialization.
- Math blocks must use `$$` delimiters and preserve TeX/LaTeX source exactly when the feature is supported.
- Tables must support GFM table syntax, including header separators, per-column alignment markers, and inline Markdown content inside cells.
- Footnotes must support reference-style footnote definitions and references when the feature is supported.
- Horizontal rules must recognize `***` and `---` on their own line.
- YAML front matter must be recognized as a top-of-document metadata block delimited by `---`.
- `[toc]` must be treated as a Table of Contents token when the feature is supported.
- GitHub-style callouts or alerts must remain explicitly gated by feature support and must not silently corrupt unsupported source.
- Typing block Markdown markers must not trap the caret or eat literal spaces unless the user explicitly requested a literal-escape flow such as a backslash-prefixed marker.
- Smart block transforms must preserve canonical Markdown markers in serialization and keep WYSIWYG, source, and preview behavior aligned.
- Changes to block Markdown triggers require regression coverage for paragraphs, line breaks, headings, blockquotes, unordered lists, ordered lists, task lists, fenced code blocks, math blocks, tables, footnotes, thematic breaks, front matter, TOC, callouts, literal marker escapes, and Enter/backspace continuation behavior.

### Span Elements

- Inline links must support standard `[label](url "optional title")` syntax.
- Internal links must support heading-anchor links such as `[label](#section-name)`.
- Reference links must support `[label][id]`, `[id]: url "title"`, and the implicit `[label][]` form.
- Bare URLs and angle-bracket autolinks should remain recognizable and editable without corrupting source.
- Images must use standard Markdown image syntax with optional titles, and path handling should preserve relative paths whenever possible.
- Emphasis must support both `*` and `_`, while favoring `*` as the safer default for predictable editing.
- Strong emphasis must support both `**` and `__`, while favoring `**` as the safer default for predictable editing.
- Inline code must use backticks and preserve literal code spans without smart punctuation corruption.
- Strikethrough must use `~~` delimiters.
- Emoji shortcodes such as `:smile:` should remain compatible when the feature is supported, while direct Unicode emoji input must remain safe.
- Inline math must use `$...$` delimiters when the feature is supported.
- Subscript must use `~...~` when the feature is supported.
- Superscript must use `^...^` when the feature is supported.
- Highlight must use `==...==` when the feature is supported.
- Span elements should render after typing, but moving the caret into the span must reveal the Markdown source in a way that preserves direct editing.
- Literal delimiter escape behavior must remain available for inline syntax, especially for emphasis markers that would otherwise parse as formatting.
- Changes to span parsing or reveal/collapse behavior require regression coverage for links, images, emphasis, strong, code, strikethrough, emoji, inline math, subscript, superscript, highlight, autolinks, escapes, caret entry, and clipboard fidelity.

### HTML And Embedded Content

- HTML may be used where pure Markdown does not express the intended content, but support must be explicit, safe, and serialization-aware.
- Underline should remain available through `<u>...</u>` HTML syntax.
- Embedded iframe content should only be supported intentionally and with clear trust or sanitization rules.
- Video embedding should preserve `<video>` HTML where supported.
- HTML support decisions must be consistent across editor, preview, export, and clipboard paths so users do not lose content silently.

## Repo Rule

This file is the standing product and engineering north star for the repository. When tradeoffs are unclear, choose the option that most credibly moves Inkdown toward being an industry-leading Markdown editor.
