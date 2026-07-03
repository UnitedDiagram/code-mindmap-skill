# Data Schema Reference

Two JSON shapes matter in this pipeline: the **scan schema** (`scan.json`, produced
by `scripts/scan.py`, pure facts) and the **mind-map schema** (`codebaseData`,
written by the agent, facts + narrative). `scripts/render.py` only ever consumes
the mind-map schema.

## 1. `scan.json` (output of `scripts/scan.py`)

```jsonc
{
  "meta": {
    "root_path": ".",
    "scanned_at": "2026-07-02T00:00:00Z",
    "vcs": { "remote": "https://github.com/org/repo", "default_branch": "main" }
  },
  "manifests": [
    {
      "type": "pyproject.toml",
      "path": "pyproject.toml",
      "name": "hermes-agent",
      "description": "...",
      "entry_points": [{ "name": "hermes", "target": "hermes_cli.main:main" }]
    }
  ],
  "languages": { "python": 82.1, "typescript": 14.3, "other": 3.6 },
  "totals": { "files": 3210, "loc": 480213 },
  "tree": {
    "path": ".",
    "type": "dir",
    "loc": 480213,
    "file_count": 3210,
    "children": [
      { "path": "agent", "type": "dir", "loc": 12500, "file_count": 40, "children": ["..."] },
      { "path": "run_agent.py", "type": "file", "loc": 12000, "language": "python" }
    ]
  },
  "structures": {
    "run_agent.py": {
      "language": "python",
      "classes": [
        { "name": "AIAgent", "lineno": 120, "methods": ["__init__", "chat", "run_conversation"], "docstring": "..." }
      ],
      "functions": [
        { "name": "handle_function_call", "lineno": 900, "signature": "def handle_function_call(name, args, task_id):", "docstring": "..." }
      ],
      "imports": ["hermes_constants", "tools.registry"]
    }
  },
  "readmes": [{ "path": "README.md", "excerpt": "first ~2000 chars" }]
}
```

Notes:
- `tree` is capped by the resolved `depth` customization setting (see
  `customization-options.md`) and rolls up LOC/file counts for pruned subtrees.
- `structures` only exists for files matching `language-support.md`'s "deep"
  tier (Python via `ast`, JS/TS/Go via regex), and only above a LOC threshold or
  files flagged as entry points — this keeps `scan.json` bounded on huge repos.
- Noise directories (`.git`, `node_modules`, `venv`, `dist`, `build`, common
  vendored-dependency folders) are excluded by default, plus best-effort
  `.gitignore` awareness.
- This file is pure fact extraction. It contains no prose, no opinions, no
  `desc`/`code`/`connections` fields — that's the agent's job in step 2.

## 2. `codebaseData` (the mind-map tree — what `render.py` consumes)

This is the same recursive shape the original hand-built
`hermes-codebase-mindmap.html` used, with two changes (see "Contracts" below).

```jsonc
{
  "id": "root",
  "name": "My Project",
  "color": "#f0c674",
  "desc": "One-to-three sentence description of what this node is and why it matters.",
  "path": "src/agent/",
  "code": "optional short code snippet or file-structure sketch, plain text",
  "badges": [
    { "label": "Python", "type": "lang" },
    { "label": "~12k LOC", "type": "metric" },
    { "label": "Core", "type": "core" }
  ],
  "connections": [
    { "target": "some-other-node-id", "label": "One sentence: what this relationship is" }
  ],
  "children": ["... same shape, recursively ..."]
}
```

Top-level generation output also includes a sibling array, same as the
original file:

```jsonc
{
  "codebaseData": { "...": "the tree above" },
  "crossConnections": [
    { "source": "node-id-a", "target": "node-id-b", "label": "One sentence describing the relationship" }
  ]
}
```

### Field reference

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Unique across the whole tree. Lowercase, hyphenated, stable (don't rename between reruns if you want `.mindmap-config.json` diffing to stay meaningful). |
| `name` | yes | Short display label shown inside the node box. |
| `color` | yes | Hex color. Assigned per top-level branch from the active theme's palette (see `assets/themes.json`); descendants typically inherit their branch's color. |
| `desc` | yes | The narrative payload — this is the part `scan.json` cannot produce. Write it from actually reading the relevant file(s)/README, not from the file tree alone. |
| `path` | no | File or directory path shown in the detail panel, monospace. Omit for purely conceptual nodes. |
| `code` | no | A short snippet, signature, or ASCII structure sketch. Keep it short (this is a preview, not a file dump). |
| `badges` | no | Array of `{label, type}`. `type` must be one of `lang`, `metric`, `core`, `flag` — the template looks up a CSS class by `type`, not by guessing from the label text. |
| `connections` | no | Same-node-detail-panel links to conceptually related nodes elsewhere in the tree (rendered in the sidebar, not as a persistent line on the canvas). |
| `children` | no | Recursive. Omit or use `[]` for leaf nodes. |

### Contracts (must hold or the template engine misbehaves)

1. **The root node's `id` must be exactly `"root"`.** The rendering engine has a
   few literal `"root"` references (breathing-idle-animation target, initial
   `selectedNodeId`, the collapse-all handler's reset target). Don't rename it.
2. **`badges[].type` replaces the old substring-matching behavior.** The
   original hand-built file guessed a badge's CSS class by checking whether the
   label text contained "python"/"typescript"/"loc" — which silently
   mis-colored anything else (Go, Rust, a "Beta" flag, etc.). Always emit the
   explicit `type` field instead.
3. **Every `connections[].target` and `crossConnections[].source|target` must
   reference an `id` that actually exists in the tree.** The renderer silently
   drops dangling references rather than erroring, so a typo here just quietly
   produces a missing line — validate before treating generation as complete.
4. **`crossConnections` is for persistent, always-visible relationship lines
   on the canvas** (e.g. "gateway calls into agent-core on every message") —
   use it sparingly for the handful of relationships worth drawing permanently.
   Use per-node `connections` for anything you'd rather surface only when that
   node's detail panel is open.
