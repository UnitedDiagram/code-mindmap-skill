# Language Support Matrix

`scripts/scan.py` always produces the generic layer (file tree, LOC counts,
manifest detection) for every file in every language. Deeper structural
extraction (`scan.json`'s `structures` field: classes, functions, imports) is
only attempted for a few ecosystems. Everything else still gets a perfectly
usable mind map — just with the agent doing more of the reading itself for
`desc`/`code` content instead of leaning on `structures`.

## Deep tier (structural extraction in `scan.py`)

| Language | Method | What's extracted |
|---|---|---|
| Python | `ast` module (stdlib, exact parse) | Classes (name, line, methods, docstring), top-level functions (name, line, signature, docstring), imports |
| JavaScript / TypeScript | Line-anchored regex (no parser dependency) | Top-level `function`/`class`/`interface`/`export` declarations and their signatures, `import`/`require` statements |
| Go | Line-anchored regex | Top-level `func`/`type`/`struct` declarations, `import` blocks |

The JS/TS and Go extraction is intentionally shallow (regex, not a real
parser) to avoid making `scan.py` depend on a JS or Go toolchain being
installed on the machine running the skill — it's meant to catch the common,
readable declaration forms, not every edge case of the language grammar. If a
signature looks mis-parsed, trust what you see when you `Read` the file
directly over what `structures` reported.

## Generic tier (every other language)

File tree placement, LOC counts, and — if a supported manifest exists
(`pyproject.toml`, `package.json`, `go.mod`, or `Cargo.toml`) — name/
description/entry-point detection from that manifest. No class/function-level
extraction.

For these files, when you (the agent) decide a node deserves function-level
detail, get it by reading the file directly rather than expecting `scan.json`
to have done it for you.

## Adding a new deep-tier language

This is a `scan.py` code change (a new regex or parser branch keyed off file
extension), not a runtime configuration option — there's no "please deep-scan
Rust" flag today. If a codebase is overwhelmingly in a generic-tier language,
say so and default to `depth: shallow` rather than attempting function-level
nodes you can't back with real signatures.
