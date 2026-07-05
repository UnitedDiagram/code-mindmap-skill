# codebase-mindmap

An [Agent Skill](https://agentskills.io) that generates an interactive,
single-file HTML mind map of a codebase's architecture — a click-to-
expand/collapse tree of modules, functions, and cross-references with hover
previews, search, and a detail sidebar.

Works with Claude Code, Cursor, Codex CLI, or any tool that supports the
agentskills.io standard.

## What it produces

One self-contained `.html` file — no build step, no server, works offline
from `file://` — that renders a codebase as an explorable mind map. It's a
**hybrid** of deterministic scanning and agent judgment: a bundled script
extracts objective facts (file tree, LOC, entry points, import graph), and
the agent writes the narrative (descriptions, relationships, code snippets)
on top of that skeleton.

## Install

```bash
./codebase-mindmap/install.sh
```

Symlinks the skill into whichever of Claude Code / Cursor / Codex CLI are set
up on your machine. See `--help` for scoping to a single project instead of
your user config.

## Install through plugins

### Claude Code

```bash
claude plugin marketplace add UnitedDiagram/code-mindmap-skill
claude plugin install codebase-mindmap@code-mindmap-skill
```

Plugin skills in Claude Code are invoked with the plugin namespace. Restart
Claude Code or run `/reload-plugins` if the plugin is not visible immediately:

```text
/<plugin-name>:<skill-name>
```

### Codex

```bash
codex plugin marketplace add UnitedDiagram/code-mindmap-skill
codex plugin add codebase-mindmap@code-mindmap-skill
```

Codex app users can also install from **Plugins**. After installing, start a new
thread and invoke the plugin with `@`.

## Usage

Ask your agent to "map this codebase" or "generate an interactive
architecture diagram" for a repo. On the first run for a repo, the skill asks
you to choose theme, depth, and feature preferences before scanning; later runs
reuse those choices from `.mindmap-config.json` unless you ask to change them.
The full workflow — customization, scanning, writing the narrative, rendering,
and optional verification — is documented in
[`codebase-mindmap/SKILL.md`](codebase-mindmap/SKILL.md), which is the source
of truth for how this skill behaves in every tool.

## Requirements

- Python 3.9+ (stdlib only, no `pip install` needed) for scanning and
  rendering.
- Optional: Node.js + the `playwright` package + a Chromium install, only if
  you want automated verification of the generated output
  (`codebase-mindmap/scripts/verify.mjs`).

## License

MIT — see [LICENSE](LICENSE).
