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

This repository is not currently packaged as an installable plugin. It does not
yet include `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, or a
marketplace file, so `<marketplace-source>` and `<marketplace-name>` are
placeholders until plugin packaging exists. Today, use the install script above
for direct skill installation.

### Claude Code

After this project is published through a Claude Code plugin marketplace:

```text
/plugin marketplace add <marketplace-source>
/plugin install codebase-mindmap@<marketplace-name>
/reload-plugins
```

Plugin skills in Claude Code are invoked with the plugin namespace:

```text
/<plugin-name>:<skill-name>
```

### Codex

After this project is published through a Codex plugin marketplace:

```bash
codex plugin marketplace add <marketplace-source>
codex plugin add codebase-mindmap@<marketplace-name>
```

Codex app users can also install from **Plugins**. After installing, start a new
thread and invoke the plugin with `@`.

## Usage

Ask your agent to "map this codebase" or "generate an interactive
architecture diagram" for a repo. The full workflow — scanning, writing the
narrative, rendering, and optional verification — is documented in
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
