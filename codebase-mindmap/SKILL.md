---
name: codebase-mindmap
description: >
  Generates an interactive, single-file SVG mind map of a codebase's
  architecture — a click-to-expand/collapse tree of modules, functions, and
  cross-references with hover previews, search, and a detail sidebar. Use when
  asked to visualize, map, diagram, or explain a codebase's architecture or
  structure, produce an "interactive codebase map", or help someone new
  understand how a repo's modules relate to each other. Supports natural-
  language customization of theme (dark/light/high-contrast/custom), depth
  (top-level only vs. full function-level drill-down), and which interactive
  features are enabled.
license: MIT
compatibility: >
  Scanning and rendering require Python 3.9+ (stdlib only, no pip install
  needed). Optional automated verification requires Node.js, the `playwright`
  package, and a Chromium install.
metadata:
  standard: agentskills.io
  version: "1.0.0"
---

# Codebase Mind Map Skill

Produces one self-contained HTML file — no build step, no server, works
offline from `file://` — that renders a codebase as an interactive, explorable
mind map. Generation is a **hybrid** of deterministic scanning and agent
judgment: a bundled script extracts objective facts (file tree, LOC, entry
points, import graph), and you write the narrative (descriptions,
relationships, code snippets) on top of that skeleton. Neither half can do the
other's job — the script can't explain *why* a module matters, and re-deriving
the file tree by hand wastes tokens and drifts from ground truth.

## Scope

**Best suited for:**
- Any local git repo or directory of source code, in any language
- Wanting a shareable, offline, interactive architecture overview — onboarding
  docs, a PR-description attachment, a "how does this repo work" walkthrough
- Codebases where the value is in the *relationships* between modules, not
  just a flat file listing

**Look elsewhere first for:**
- A static (non-interactive) architecture/infra diagram — use the
  `architecture-diagram` skill (dark-themed SVG, no JS, faster to produce)
- Precise UML class diagrams with formal notation
- Visualizing data/metrics rather than code structure — use a `dataviz`-style
  skill instead
- A single function's logic — this skill maps structure, not control flow

## Workflow

1. **Resolve the target and check for a prior run.** If `.mindmap-config.json`
   exists at the target repo's root (see `references/config-schema.md`) and
   the user isn't asking for a change, reuse its settings silently.

2. **Interpret customization.** The user expresses theme/depth/feature
   preferences in natural language ("make it light-themed and shallow", "no
   search box"), not a fixed menu. Resolve their request against
   `references/customization-options.md`, fill in sensible defaults for
   anything unspecified, and briefly confirm what you resolved it to.

3. **Scan.**
   ```bash
   python3 codebase-mindmap/scripts/scan.py <target-path> --depth <shallow|standard|deep> --out scan.json
   ```
   This is pure fact extraction — file tree, LOC, manifests/entry points,
   language breakdown, and (for Python/JS/TS/Go specifically — see
   `references/language-support.md`) classes/functions/imports per file. It
   contains zero narrative content.

4. **Write the narrative.** Read `scan.json`, then selectively read the actual
   files it points to (READMEs, entry points, architecturally-significant
   modules) and produce the full `codebaseData` tree — the same shape
   `scan.json` scaffolded, now with `desc`, `code`, `badges`, and
   `connections` filled in by you. Full schema and field-by-field contracts
   (including the required root `id: "root"` and `badges[].type` rules) are
   in `references/data-schema.md` — read it before writing your first node.

5. **Render.**
   ```bash
   python3 codebase-mindmap/scripts/render.py --data codebaseData.json --theme <theme> --features '<json>' --out <output>.html
   ```
   `render.py` validates your data (root id, dangling connection targets,
   invalid badge types) and prints warnings for anything questionable before
   writing the file — read its output.

6. **Verify** (optional, user's choice — never assume Playwright is
   available). See `references/verification-strategies.md` for the three
   options (automated Playwright check, agent-driven manual spot-check, or
   skip) and how to pick between them.

7. **Preview and hand off.**

### Delegating to a subagent (Claude Code only)

For a large codebase, or to keep a long scan out of the main conversation,
delegate the whole workflow to `.claude/agents/codebase-mindmapper.md` via the
Agent/Task tool. It follows this same SKILL.md rather than duplicating it, and
returns only the final file path, a short summary, and the verification
result to the parent conversation. This is a Claude-Code-only convenience —
in Cursor or Codex CLI, just follow the workflow above directly; this
SKILL.md is the actual source of truth everywhere.

### Output Location

Default to `./<repo-name>-mindmap.html` in the target repo, or wherever the
user specifies.

### Preview

```bash
# macOS
open ./my-project-mindmap.html
# Linux
xdg-open ./my-project-mindmap.html
```

## Output Requirements

- Single self-contained `.html` file — the data is embedded as literal JSON
  inside a `<script>` tag, so it opens directly from `file://` with no server.
- Must retain the first-run "Welcome" tutorial panel (already in
  `assets/template.html`) so a new viewer knows how to use it (hover to
  preview, click to expand, search, pan/zoom) — this doubles as the in-artifact
  onboarding for whoever opens the generated map.
- The root node's `id` must be exactly `"root"` — see `references/data-schema.md`.

## Template & Script Reference

`assets/template.html` is the rendering engine — read it and
`references/template-anatomy.md` (placeholder tokens, what's safe to hand-edit,
and the one animation/positioning gotcha that must not be reintroduced) before
modifying it. Don't regenerate the engine from scratch per run; it's a fixed,
tested asset — only the data you inject changes between runs.

`assets/themes.json` holds the named color palettes (`dark-github` default,
`light`, `high-contrast`) each render draws from, plus a `nodePalette` array
you should assign top-level branch colors from during step 4.

## Known Limitations

- Layout is a fixed left-to-right tree, not force-directed — very wide trees
  (dozens of top-level modules) get crowded. Default to `depth: shallow` for
  very large repos rather than fighting the layout.
- Only Python, JavaScript/TypeScript, and Go get structural (class/function)
  extraction from `scan.py`; everything else gets file-tree + LOC only, so
  lean on reading files directly for those languages' node content.
- Never go deeper than function/class level even if asked — output size and
  canvas readability both degrade badly past that; suggest scoping to a
  subdirectory instead.
