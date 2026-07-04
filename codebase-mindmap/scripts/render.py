#!/usr/bin/env python3
"""Deterministic templater for the codebase-mindmap skill.

Takes the generated mind-map data (codebaseData + crossConnections, written by
the agent per ../references/data-schema.md) and splices it into a template
under ../assets/ via plain, unique-token string replacement — no
Jinja/Mustache dependency, stdlib only. See ../references/template-anatomy.md
for the full placeholder-token reference.

Usage:
    python3 render.py --data codebaseData.json --out mindmap.html \\
        [--style classic] [--theme dark-github] [--title "My Project"] \\
        [--subtitle "..."] [--welcome-intro "..."] [--welcome-blurb "..."] \\
        [--features '{"search": false}']

--style selects which rendering engine + theme-data file to use:
'classic' (default, today's minimalistic look, assets/template.html +
assets/themes.json) or 'circuit' (opt-in schematic/blueprint look,
assets/template-circuit.html + assets/circuit-themes.json). See
../references/customization-options.md.
"""
from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parent.parent

STYLES = {
    "classic": {"template": "template.html", "themes": "themes.json"},
    "circuit": {"template": "template-circuit.html", "themes": "circuit-themes.json"},
}

DEFAULT_FEATURES = {
    "search": True,
    "hoverPreview": True,
    "breadcrumb": True,
    "legend": True,
    "panZoom": True,
}

VALID_BADGE_TYPES = {"lang", "metric", "core", "flag"}


def resolve_style(style: str) -> dict:
    if style not in STYLES:
        available = ", ".join(sorted(STYLES))
        raise SystemExit(f"error: unknown style '{style}'. Available: {available}")
    return STYLES[style]


def load_themes(style: str) -> dict:
    themes_path = SKILL_ROOT / "assets" / resolve_style(style)["themes"]
    return json.loads(themes_path.read_text())


def build_theme_vars_block(theme_name: str, themes: dict) -> str:
    if theme_name not in themes:
        available = ", ".join(k for k in themes if not k.startswith("_"))
        raise SystemExit(f"error: unknown theme '{theme_name}'. Available: {available}")
    css_vars = themes[theme_name]["cssVars"]
    return "\n".join(f"  {k}: {v};" for k, v in css_vars.items())


def validate_data(data: dict) -> list[str]:
    """Returns a list of warning strings (non-fatal) for common schema mistakes."""
    warnings = []
    tree = data.get("codebaseData")
    if not tree:
        raise SystemExit("error: --data JSON must have a top-level \"codebaseData\" object")
    if tree.get("id") != "root":
        raise SystemExit(
            f"error: codebaseData.id must be exactly \"root\" (got {tree.get('id')!r}). "
            "See references/data-schema.md contract #1."
        )

    ids = set()

    def walk(node, path="root"):
        node_id = node.get("id")
        if not node_id:
            warnings.append(f"node at {path} is missing an 'id' field")
        elif node_id in ids:
            warnings.append(f"duplicate node id '{node_id}' (at {path}) — later occurrence will silently win in nodeMap")
        else:
            ids.add(node_id)
        for badge in node.get("badges") or []:
            if isinstance(badge, dict) and badge.get("type") not in VALID_BADGE_TYPES:
                warnings.append(
                    f"node '{node_id}' has a badge with type={badge.get('type')!r}, "
                    f"expected one of {sorted(VALID_BADGE_TYPES)} — will render as badge-core"
                )
        for child in node.get("children") or []:
            walk(child, f"{path} > {child.get('id', '?')}")

    walk(tree)

    def check_targets(items, label):
        for item in items:
            for key in ("target", "source"):
                ref = item.get(key)
                if ref and ref not in ids:
                    warnings.append(f"{label} references unknown id '{ref}' ({key}) — link will be silently dropped")

    for node_id in list(ids):
        pass  # per-node connections checked below via a second walk

    def walk_connections(node):
        check_targets(node.get("connections") or [], f"node '{node.get('id')}' connections")
        for child in node.get("children") or []:
            walk_connections(child)

    walk_connections(tree)
    check_targets(data.get("crossConnections") or [], "crossConnections")

    return warnings


def render(
    data: dict,
    theme_name: str,
    title: str,
    subtitle: str,
    welcome_intro: str,
    welcome_blurb: str,
    features: dict,
    out_path: Path,
    style: str = "classic",
) -> list[str]:
    warnings = validate_data(data)

    template_path = SKILL_ROOT / "assets" / resolve_style(style)["template"]
    themes = load_themes(style)
    theme_vars_block = build_theme_vars_block(theme_name, themes)

    resolved_features = {**DEFAULT_FEATURES, **features}

    template = template_path.read_text()

    replacements = {
        "__TITLE__": html.escape(title),
        "__SUBTITLE__": html.escape(subtitle),
        "__WELCOME_INTRO__": html.escape(welcome_intro),
        "__WELCOME_BLURB__": html.escape(welcome_blurb),
        "__THEME_VARS__": theme_vars_block,
        "__FEATURES__": json.dumps(resolved_features),
        "__CODEBASE_DATA__": json.dumps(data["codebaseData"]),
        "__CROSS_CONNECTIONS__": json.dumps(data.get("crossConnections", [])),
    }

    missing = [token for token in replacements if token not in template]
    if missing:
        raise SystemExit(f"error: template is missing expected placeholder(s): {missing}")

    for token, value in replacements.items():
        template = template.replace(token, value)

    out_path.write_text(template)
    return warnings


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", required=True, help="Path to a JSON file with {codebaseData, crossConnections}")
    parser.add_argument("--out", required=True, help="Output HTML file path")
    parser.add_argument("--style", default="classic",
                         help="Visual style: 'classic' (default, minimalistic) or 'circuit' "
                              "(schematic/blueprint look). See references/customization-options.md")
    parser.add_argument("--theme", default="dark-github", help="Theme name from assets/themes.json (default: dark-github)")
    parser.add_argument("--title", default=None, help="Page title / sidebar heading (default: codebaseData.name)")
    parser.add_argument("--subtitle", default="Interactive mind map. Hover to preview, click to explore.")
    parser.add_argument("--welcome-intro", default=None,
                         help="First welcome-panel paragraph (default: derived from codebaseData.desc)")
    parser.add_argument("--welcome-blurb", default="")
    parser.add_argument("--features", default="{}", help='JSON object overriding default feature flags, e.g. \'{"search": false}\'')
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        raise SystemExit(f"error: {data_path} not found")
    data = json.loads(data_path.read_text())

    try:
        features = json.loads(args.features)
    except json.JSONDecodeError as e:
        raise SystemExit(f"error: --features is not valid JSON: {e}")
    unknown = set(features) - set(DEFAULT_FEATURES)
    if unknown:
        raise SystemExit(f"error: unknown feature flag(s) {sorted(unknown)}. Valid: {sorted(DEFAULT_FEATURES)}")

    title = args.title or data.get("codebaseData", {}).get("name", "Codebase")
    welcome_intro = args.welcome_intro or data.get("codebaseData", {}).get("desc", "")

    out_path = Path(args.out)
    warnings = render(
        data=data,
        theme_name=args.theme,
        title=title,
        subtitle=args.subtitle,
        welcome_intro=welcome_intro,
        welcome_blurb=args.welcome_blurb,
        features=features,
        out_path=out_path,
        style=args.style,
    )

    for w in warnings:
        print(f"warning: {w}", file=sys.stderr)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
