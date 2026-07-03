#!/usr/bin/env bash
# Installs the codebase-mindmap skill into whichever of Claude Code / Cursor /
# Codex CLI are actually set up on this machine, by symlinking this directory
# (the single canonical copy) into each tool's skills/ directory — so editing
# the skill once here is picked up by every tool immediately, no reinstall.
#
# Usage:
#   ./install.sh [--scope user|project] [--target DIR] [--all] [--dry-run]
#
#   --scope user      Install to ~/.claude, ~/.cursor, ~/.codex (default —
#                      this is a general-purpose skill, most useful everywhere)
#   --scope project   Install to DIR/.claude, DIR/.cursor, DIR/.codex instead
#   --target DIR      Project root to install into when --scope project (default: cwd)
#   --all             Also create a tool's skills/ dir even if that tool's own
#                      config dir (~/.claude, ~/.cursor, ~/.codex) doesn't
#                      exist yet — by default we only install into tools we
#                      can already detect are in use.
#   --dry-run         Print what would happen without touching the filesystem

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_NAME="$(basename "$SCRIPT_DIR")"

SCOPE="user"
TARGET="$(pwd)"
FORCE_ALL=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scope) SCOPE="$2"; shift 2 ;;
    --target) TARGET="$2"; shift 2 ;;
    --all) FORCE_ALL=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ "$SCOPE" != "user" && "$SCOPE" != "project" ]]; then
  echo "error: --scope must be 'user' or 'project'" >&2
  exit 1
fi

if [[ "$SCOPE" == "user" ]]; then
  BASE="$HOME"
else
  BASE="$TARGET"
fi

install_into() {
  local tool_dir_name="$1"   # .claude / .cursor / .codex
  local tool_base="$BASE/$tool_dir_name"

  if [[ ! -d "$tool_base" && "$FORCE_ALL" != "true" ]]; then
    echo "skip:   $tool_base (not found — pass --all to create it anyway)"
    return
  fi

  local skills_dir="$tool_base/skills"
  local dest="$skills_dir/$SKILL_NAME"

  if $DRY_RUN; then
    echo "would create: $skills_dir"
    echo "would link:   $dest -> $SCRIPT_DIR"
    return
  fi

  mkdir -p "$skills_dir"

  if [[ -L "$dest" ]]; then
    local current_target
    current_target="$(readlink "$dest")"
    if [[ "$current_target" == "$SCRIPT_DIR" ]]; then
      echo "up to date: $dest (already linked)"
      return
    fi
    echo "warning: $dest exists and points elsewhere ($current_target) — leaving it alone"
    return
  elif [[ -e "$dest" ]]; then
    echo "warning: $dest already exists and is not a symlink — leaving it alone"
    return
  fi

  if ln -s "$SCRIPT_DIR" "$dest" 2>/dev/null; then
    echo "linked:  $dest -> $SCRIPT_DIR"
  else
    # Filesystem doesn't support symlinks (rare) — fall back to a copy.
    cp -r "$SCRIPT_DIR" "$dest"
    echo "copied:  $dest (symlinks unsupported here; rerun this script after editing the skill to resync)"
  fi
}

echo "Installing '$SKILL_NAME' (scope: $SCOPE, base: $BASE)"
echo ""
install_into ".claude"
install_into ".cursor"
install_into ".codex"

echo ""
echo "Codex CLI also scans .agents/skills/ upward from any working directory —"
echo "if you use that convention instead, symlink $SCRIPT_DIR into the"
echo "appropriate .agents/skills/ directory yourself."
