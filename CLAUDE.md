# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Hermes Agent is a self-improving AI agent by Nous Research. It runs the same agent core across CLI, messaging gateway (Telegram, Discord, Slack, ~20 platforms), TUI (Ink/React), and Electron desktop app. It learns across sessions (memory + skills), delegates to subagents, runs scheduled jobs, and drives a real terminal and browser. Extended primarily through **plugins and skills**, not by growing the core.

## Two Sacred Design Properties

1. **Prompt caching is sacred.** Never mutate past context, swap toolsets, or rebuild system prompts mid-conversation. The only exception is context compression.
2. **The core is a narrow waist; capability lives at the edges.** Every model tool ships on every API call. New capability should arrive as: extend existing code → CLI command + skill → service-gated tool → plugin → MCP server → new core tool (last resort).

## Build & Development

```bash
# Activate venv
source .venv/bin/activate   # or: source venv/bin/activate

# Python: 3.11–3.13 (3.14 not supported yet — Rust transitive deps lack cp314 wheels)
# Dependencies pinned to exact versions in pyproject.toml (supply-chain policy)
```

## Testing

**Always use `scripts/run_tests.sh`** — never call `pytest` directly. The script enforces hermetic CI parity (blanked credentials, TZ=UTC, LANG=C.UTF-8, per-file subprocess isolation).

```bash
scripts/run_tests.sh                                    # full suite
scripts/run_tests.sh tests/gateway/                     # one directory
scripts/run_tests.sh tests/agent/test_foo.py            # single file
scripts/run_tests.sh tests/agent/test_foo.py -v --tb=long  # with pytest flags
scripts/run_tests.sh --no-isolate tests/foo/            # disable subprocess isolation (debugging)
```

Every test runs in a freshly-spawned subprocess (`tests/_isolate_plugin.py`). Tests must never write to `~/.hermes/` — the `_isolate_hermes_home` autouse fixture redirects `HERMES_HOME` to a temp dir.

## Linting & Type Checking

```bash
ruff check .                # lint (only PLW1514 — unspecified-encoding — is enabled)
ty check                    # type checking (python-version = 3.13)
```

## TUI Development (ui-tui/)

```bash
cd ui-tui
npm install && npm run dev    # watch mode
npm run build                 # full build
npm run typecheck             # tsc --noEmit
npm run lint                  # eslint
npm test                      # vitest
```

## Key Architecture

### Entry Points & Core Loop

- `run_agent.py` — `AIAgent` class, core conversation loop (~12k LOC). `run_conversation()` is the synchronous agent loop with interrupt checks and budget tracking.
- `model_tools.py` — Tool orchestration, `discover_builtin_tools()`, `handle_function_call()`. Imports trigger tool auto-discovery.
- `toolsets.py` — Toolset definitions, `_HERMES_CORE_TOOLS` list. All toolsets defined as a single `TOOLSETS` dict.
- `cli.py` — `HermesCLI` class, interactive CLI orchestrator (~11k LOC).
- `hermes_state.py` — `SessionDB`, SQLite session store with FTS5 search.
- `hermes_constants.py` — `get_hermes_home()`, `display_hermes_home()` — profile-aware paths.

### File Dependency Chain

```
tools/registry.py  (no deps — imported by all tool files)
       ↑
tools/*.py  (each calls registry.register() at import time)
       ↑
model_tools.py  (imports tools/registry + triggers tool discovery)
       ↑
run_agent.py, cli.py, batch_runner.py, environments/
```

### Three Config Loaders (know which one you're in)

| Loader | Used by | Location |
|--------|---------|----------|
| `load_cli_config()` | CLI mode | `cli.py` |
| `load_config()` | `hermes tools`, `hermes setup`, most subcommands | `hermes_cli/config.py` |
| Direct YAML load | Gateway runtime | `gateway/run.py` + `gateway/config.py` |

### Slash Command Registry

All slash commands defined in `COMMAND_REGISTRY` in `hermes_cli/commands.py`. CLI dispatch via `process_command()` in `cli.py`, gateway dispatch in `gateway/run.py`. Adding a command: add `CommandDef` to the registry, add handler in `cli.py` and/or `gateway/run.py`.

### Plugin Systems (three separate discovery paths)

1. **General plugins** (`hermes_cli/plugins.py`) — discovered from `~/.hermes/plugins/`, `./.hermes/plugins/`, pip entry points. Register hooks, tools, CLI subcommands via `ctx`.
2. **Memory-provider plugins** (`plugins/memory/`) — implement `MemoryProvider` ABC from `agent/memory_provider.py`. Set is **closed** — new providers must be standalone repos.
3. **Model-provider plugins** (`plugins/model-providers/`) — lazy discovery via `providers/__init__.py._discover_providers()`, NOT by PluginManager. User plugins override bundled ones (last-writer-wins).

### Tool Registration (2 files required)

1. Create `tools/your_tool.py` with `registry.register()` call (auto-discovered at import).
2. Add tool name to a toolset in `toolsets.py` — registration alone doesn't expose it to agents.

### Gateway Message Guards

The gateway has TWO sequential message guards when an agent is running: (1) base adapter queues in `_pending_messages`, (2) gateway runner intercepts control commands. New commands that must work during agent execution must bypass BOTH guards.

## Critical Rules

- **Use `get_hermes_home()`** for all path references, never `~/.hermes` or `Path.home() / ".hermes"`. Use `display_hermes_home()` for user-facing messages. This is required for profile support.
- **`.env` is for secrets only** (API keys, tokens). Behavioral settings go in `config.yaml`.
- **Dependencies must have upper bounds** in `pyproject.toml`. Exact pins preferred. Run `uv lock` after changes.
- **No `simple_term_menu`** for new interactive menus — use `hermes_cli/curses_ui.py` instead.
- **No `\033[K`** (ANSI erase-to-EOL) in spinner/display code — leaks under `prompt_toolkit`'s `patch_stdout`. Use space-padding.
- **No hardcoded cross-tool references** in schema descriptions — tools from other toolsets may be unavailable.
- **Skill `description` ≤ 60 characters**, one sentence, ends with period. No marketing words.
- **Tests must assert behavioral contracts**, not snapshot current data (no change-detector tests).

## TUI Process Model

```
hermes --tui
  └─ Node (Ink)  ──stdio JSON-RPC──  Python (tui_gateway)
       │                                  └─ AIAgent + tools + sessions
       └─ renders transcript, composer, prompts, activity
```

TypeScript owns the screen. Python owns sessions, tools, model calls, slash commands. The dashboard (`hermes dashboard`) embeds the real TUI via PTY bridge — do not reimplement the chat experience in React.

## TypeScript Style (desktop, TUI, website)

- Prefer nanostores over component state for shared/reused state.
- Interfaces for public props; extend React primitives (`ComponentProps<>`, `Omit<>`, `Pick<>`).
- Table-driven beats condition ladders. No monolithic hooks — one narrow job per hook.
- `src/app` owns routes/pages, `src/store` owns shared atoms, `src/lib` owns pure helpers.
