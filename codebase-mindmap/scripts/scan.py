#!/usr/bin/env python3
"""Deterministic codebase scanner for the codebase-mindmap skill.

Walks a target directory and emits scan.json: a pure-fact skeleton (file tree,
LOC counts, manifests, entry points, and — for Python/JS/TS/Go — a shallow
structural extraction of classes/functions/imports). Contains no narrative
content; that's the agent's job on top of this output. Schema documented in
../references/data-schema.md.

Stdlib only. Runs on any machine with Python 3.9+, independent of what
language the target repo is written in.

Usage:
    python3 scan.py [path] [--depth shallow|standard|deep] [--out scan.json] [--scope SUBDIR]
"""
from __future__ import annotations

import argparse
import ast
import fnmatch
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_IGNORE = {
    ".git", "node_modules", "venv", ".venv", "env", ".env-dir", "dist", "build",
    "__pycache__", ".mypy_cache", ".pytest_cache", ".next", "target", "vendor",
    ".idea", ".vscode", "coverage", ".tox", ".ruff_cache", ".cache", "out",
    ".turbo", ".parcel-cache", "site-packages", ".eggs",
}
DEFAULT_IGNORE_SUFFIXES = (".egg-info",)

LANGUAGE_BY_EXT = {
    ".py": "python", ".pyi": "python",
    ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
    ".ts": "typescript", ".tsx": "typescript",
    ".go": "go",
    ".rs": "rust", ".rb": "ruby", ".java": "java", ".kt": "kotlin",
    ".c": "c", ".h": "c", ".cc": "cpp", ".cpp": "cpp", ".hpp": "cpp",
    ".cs": "csharp", ".php": "php", ".swift": "swift", ".m": "objective-c",
    ".sh": "shell", ".bash": "shell", ".sql": "sql", ".html": "html",
    ".css": "css", ".scss": "css", ".md": "markdown", ".yaml": "yaml", ".yml": "yaml",
}
DEEP_LANGUAGES = {"python", "javascript", "typescript", "go"}

DEPTH_TREE_LEVELS = {"shallow": 2, "standard": 4, "deep": 8}
DEEP_STRUCTURE_LOC_THRESHOLD = {"shallow": None, "standard": 150, "deep": 0}
README_NAMES = ("README.md", "README.rst", "README.txt", "readme.md")
MANIFEST_HANDLERS = {}  # populated below


def register_manifest(name):
    def deco(fn):
        MANIFEST_HANDLERS[name] = fn
        return fn
    return deco


@register_manifest("pyproject.toml")
def _parse_pyproject(path: Path) -> dict:
    text = path.read_text(errors="replace")
    name = _regex_first(r'(?m)^\s*name\s*=\s*"([^"]+)"', text)
    description = _regex_first(r'(?m)^\s*description\s*=\s*"([^"]+)"', text)
    entry_points = []
    for m in re.finditer(r'(?m)^\s*([\w.-]+)\s*=\s*"([\w.\-:]+)"\s*$', _section(text, "project.scripts")):
        entry_points.append({"name": m.group(1), "target": m.group(2)})
    return {"name": name, "description": description, "entry_points": entry_points}


@register_manifest("package.json")
def _parse_package_json(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(errors="replace"))
    except json.JSONDecodeError:
        return {"name": None, "description": None, "entry_points": []}
    entry_points = []
    bin_field = data.get("bin")
    if isinstance(bin_field, str):
        entry_points.append({"name": data.get("name", "bin"), "target": bin_field})
    elif isinstance(bin_field, dict):
        for k, v in bin_field.items():
            entry_points.append({"name": f"bin:{k}", "target": v})
    if data.get("main"):
        entry_points.append({"name": "main", "target": data["main"]})
    return {"name": data.get("name"), "description": data.get("description"), "entry_points": entry_points}


@register_manifest("go.mod")
def _parse_go_mod(path: Path) -> dict:
    text = path.read_text(errors="replace")
    name = _regex_first(r'(?m)^module\s+(\S+)', text)
    return {"name": name, "description": None, "entry_points": []}


@register_manifest("Cargo.toml")
def _parse_cargo_toml(path: Path) -> dict:
    text = path.read_text(errors="replace")
    name = _regex_first(r'(?m)^\s*name\s*=\s*"([^"]+)"', text)
    description = _regex_first(r'(?m)^\s*description\s*=\s*"([^"]+)"', text)
    return {"name": name, "description": description, "entry_points": []}


def _regex_first(pattern: str, text: str):
    m = re.search(pattern, text)
    return m.group(1) if m else None


def _section(text: str, header: str) -> str:
    """Return the body of a TOML [header] section (naive, good enough for scripts tables)."""
    m = re.search(rf'(?ms)^\[{re.escape(header)}\]\s*$(.*?)(?=^\[|\Z)', text)
    return m.group(1) if m else ""


def load_gitignore_patterns(root: Path) -> list[str]:
    gi = root / ".gitignore"
    if not gi.exists():
        return []
    patterns = []
    for line in gi.read_text(errors="replace").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            patterns.append(line.rstrip("/"))
    return patterns


def is_ignored(rel_path: Path, name: str, gitignore_patterns: list[str]) -> bool:
    if name in DEFAULT_IGNORE or name.endswith(DEFAULT_IGNORE_SUFFIXES) or name.startswith("."):
        # allow a few dotfiles we actually want to see at the root
        if name not in (".gitignore",):
            return True
    rel_str = str(rel_path)
    for pat in gitignore_patterns:
        if fnmatch.fnmatch(name, pat) or fnmatch.fnmatch(rel_str, pat):
            return True
    return False


def count_loc(path: Path) -> int:
    try:
        with path.open("r", errors="replace") as f:
            return sum(1 for _ in f)
    except OSError:
        return 0


def extract_python_structures(path: Path) -> dict | None:
    try:
        source = path.read_text(errors="replace")
        tree = ast.parse(source, filename=str(path))
    except (SyntaxError, ValueError):
        return None

    classes, functions, imports = [], [], []
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.ClassDef):
            methods = [n.name for n in node.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
            classes.append({
                "name": node.name, "lineno": node.lineno,
                "methods": methods, "docstring": ast.get_docstring(node),
            })
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            try:
                signature = f"def {node.name}({ast.unparse(node.args)}):"
            except Exception:
                signature = f"def {node.name}(...):"
            functions.append({
                "name": node.name, "lineno": node.lineno,
                "signature": signature, "docstring": ast.get_docstring(node),
            })
        elif isinstance(node, ast.Import):
            imports.extend(a.name for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.append(node.module)

    return {"language": "python", "classes": classes, "functions": functions, "imports": sorted(set(imports))}


_JS_FUNC_RE = re.compile(r'^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s+(\w+)\s*\(')
_JS_CLASS_RE = re.compile(r'^\s*(?:export\s+)?(?:default\s+)?class\s+(\w+)')
_JS_INTERFACE_RE = re.compile(r'^\s*(?:export\s+)?interface\s+(\w+)')
_JS_CONST_FN_RE = re.compile(r'^\s*export\s+const\s+(\w+)\s*=\s*(?:async\s*)?\(')
_JS_IMPORT_RE = re.compile(r'''^\s*(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]''')
_JS_REQUIRE_RE = re.compile(r'''require\(['"]([^'"]+)['"]\)''')


def extract_js_ts_structures(path: Path) -> dict:
    classes, functions, imports = [], [], []
    try:
        lines = path.read_text(errors="replace").splitlines()
    except OSError:
        lines = []
    for i, line in enumerate(lines, start=1):
        if m := _JS_CLASS_RE.match(line):
            classes.append({"name": m.group(1), "lineno": i, "methods": [], "docstring": None})
        elif m := _JS_FUNC_RE.match(line):
            functions.append({"name": m.group(1), "lineno": i, "signature": line.strip(), "docstring": None})
        elif m := _JS_CONST_FN_RE.match(line):
            functions.append({"name": m.group(1), "lineno": i, "signature": line.strip(), "docstring": None})
        elif m := _JS_INTERFACE_RE.match(line):
            classes.append({"name": m.group(1), "lineno": i, "methods": [], "docstring": None})
        if m := _JS_IMPORT_RE.match(line):
            imports.append(m.group(1))
        for m in _JS_REQUIRE_RE.finditer(line):
            imports.append(m.group(1))
    language = "typescript" if path.suffix in (".ts", ".tsx") else "javascript"
    return {"language": language, "classes": classes, "functions": functions, "imports": sorted(set(imports))}


_GO_FUNC_RE = re.compile(r'^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(')
_GO_TYPE_RE = re.compile(r'^type\s+(\w+)\s+(struct|interface)')
_GO_IMPORT_SINGLE_RE = re.compile(r'^import\s+"([^"]+)"')
_GO_IMPORT_LINE_RE = re.compile(r'^\s*(?:\w+\s+)?"([^"]+)"')


def extract_go_structures(path: Path) -> dict:
    classes, functions, imports = [], [], []
    try:
        lines = path.read_text(errors="replace").splitlines()
    except OSError:
        lines = []
    in_import_block = False
    for i, line in enumerate(lines, start=1):
        stripped = line.strip()
        if stripped.startswith("import ("):
            in_import_block = True
            continue
        if in_import_block:
            if stripped == ")":
                in_import_block = False
                continue
            if m := _GO_IMPORT_LINE_RE.match(stripped):
                imports.append(m.group(1))
            continue
        if m := _GO_IMPORT_SINGLE_RE.match(line):
            imports.append(m.group(1))
        elif m := _GO_FUNC_RE.match(line):
            functions.append({"name": m.group(1), "lineno": i, "signature": stripped, "docstring": None})
        elif m := _GO_TYPE_RE.match(line):
            classes.append({"name": m.group(1), "lineno": i, "methods": [], "docstring": None})
    return {"language": "go", "classes": classes, "functions": functions, "imports": sorted(set(imports))}


DEEP_EXTRACTORS = {
    "python": extract_python_structures,
    "javascript": extract_js_ts_structures,
    "typescript": extract_js_ts_structures,
    "go": extract_go_structures,
}


def get_vcs_info(root: Path) -> dict:
    def run(*args):
        try:
            out = subprocess.run(
                ["git", *args], cwd=root, capture_output=True, text=True, timeout=5, check=True
            )
            return out.stdout.strip() or None
        except (OSError, subprocess.SubprocessError):
            return None

    return {"remote": run("remote", "get-url", "origin"), "default_branch": run("branch", "--show-current")}


def find_manifests(root: Path, gitignore_patterns: list[str]) -> list[dict]:
    manifests = []
    for manifest_name, handler in MANIFEST_HANDLERS.items():
        for match in root.rglob(manifest_name):
            rel = match.relative_to(root)
            if any(is_ignored(Path(p), p, gitignore_patterns) for p in rel.parts[:-1]):
                continue
            parsed = handler(match)
            manifests.append({"type": manifest_name, "path": str(rel), **parsed})
    return manifests


def find_readmes(root: Path, max_chars: int = 2000) -> list[dict]:
    readmes = []
    for name in README_NAMES:
        candidate = root / name
        if candidate.exists():
            text = candidate.read_text(errors="replace")
            readmes.append({"path": name, "excerpt": text[:max_chars]})
            break  # first match at root is enough; subdirectory READMEs are picked up by the agent as needed
    return readmes


def scan_tree(root: Path, gitignore_patterns: list[str], max_levels: int, scope: Path | None):
    """Returns (tree_dict, totals, language_loc, structures_by_relpath)."""
    language_loc: dict[str, int] = {}
    structures: dict[str, dict] = {}
    totals = {"files": 0, "loc": 0}

    def walk(dir_path: Path, level: int):
        node = {"path": str(dir_path.relative_to(root)) or ".", "type": "dir", "loc": 0, "file_count": 0, "children": []}
        try:
            entries = sorted(dir_path.iterdir(), key=lambda p: (p.is_file(), p.name))
        except OSError:
            return node

        rolled_up = level >= max_levels

        for entry in entries:
            rel = entry.relative_to(root)
            if is_ignored(rel, entry.name, gitignore_patterns):
                continue

            if entry.is_dir():
                child = walk(entry, level + 1)
                node["loc"] += child["loc"]
                node["file_count"] += child["file_count"]
                if not rolled_up:
                    node["children"].append(child)
            elif entry.is_file():
                loc = count_loc(entry)
                node["loc"] += loc
                node["file_count"] += 1
                totals["files"] += 1
                totals["loc"] += loc

                lang = LANGUAGE_BY_EXT.get(entry.suffix.lower())
                if lang:
                    language_loc[lang] = language_loc.get(lang, 0) + loc

                if not rolled_up:
                    file_node = {"path": str(rel), "type": "file", "loc": loc}
                    if lang:
                        file_node["language"] = lang
                    node["children"].append(file_node)

                if lang in DEEP_LANGUAGES:
                    threshold = DEEP_STRUCTURE_LOC_THRESHOLD[depth_name]
                    is_entry_point = str(rel) in entry_point_paths
                    if is_entry_point or (threshold is not None and loc >= threshold) or threshold == 0:
                        extracted = DEEP_EXTRACTORS[lang](entry)
                        if extracted and (extracted["classes"] or extracted["functions"] or extracted["imports"]):
                            structures[str(rel)] = extracted

        return node

    scan_root = (root / scope) if scope else root
    tree = walk(scan_root, 0)
    return tree, totals, language_loc, structures


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("path", nargs="?", default=".", help="Target repo/directory to scan (default: cwd)")
    parser.add_argument("--depth", choices=["shallow", "standard", "deep"], default="standard",
                         help="How many tree levels to materialize and how aggressively to run structural extraction")
    parser.add_argument("--out", default="scan.json", help="Output path for scan.json (default: ./scan.json)")
    parser.add_argument("--scope", default=None, help="Optional subdirectory (relative to path) to scope the scan to")
    args = parser.parse_args()

    root = Path(args.path).resolve()
    if not root.is_dir():
        print(f"error: {root} is not a directory", file=sys.stderr)
        sys.exit(1)

    global depth_name, entry_point_paths
    depth_name = args.depth
    scope = Path(args.scope) if args.scope else None

    scan_root = (root / scope) if scope else root
    gitignore_patterns = load_gitignore_patterns(root)
    manifests = find_manifests(scan_root, gitignore_patterns)
    entry_point_paths = set()
    for m in manifests:
        manifest_dir = Path(m["path"]).parent
        for ep in m.get("entry_points", []):
            target = ep.get("target", "")
            target_path = target.split(":")[0].replace(".", "/") if ":" in target else target
            entry_point_paths.add(str(manifest_dir / target_path).lstrip("./"))

    tree, totals, language_loc, structures = scan_tree(
        root, gitignore_patterns, DEPTH_TREE_LEVELS[depth_name], scope
    )

    total_lang_loc = sum(language_loc.values()) or 1
    languages = {lang: round(loc / total_lang_loc * 100, 1) for lang, loc in language_loc.items()}
    other_pct = round(100 - sum(languages.values()), 1)
    if other_pct > 0:
        languages["other"] = other_pct

    result = {
        "meta": {
            "root_path": str(scope) if scope else ".",
            "scanned_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "vcs": get_vcs_info(root),
        },
        "manifests": manifests,
        "languages": languages,
        "totals": totals,
        "tree": tree,
        "structures": structures,
        "readmes": find_readmes(scan_root),
    }

    out_path = Path(args.out)
    out_path.write_text(json.dumps(result, indent=2))
    print(f"Wrote {out_path} ({totals['files']} files, {totals['loc']} LOC, "
          f"{len(structures)} files with deep structure extraction)")


if __name__ == "__main__":
    main()
