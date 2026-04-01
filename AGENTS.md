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

## Repo Rule

This file is the standing product and engineering north star for the repository. When tradeoffs are unclear, choose the option that most credibly moves Inkdown toward being an industry-leading Markdown editor.
