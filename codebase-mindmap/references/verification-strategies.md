# Verification Strategies

Verification is optional and user-choosable — never assume Playwright is
installed in an arbitrary target environment, and never skip offering
verification just because it's easier not to. Ask (or infer from context: if
the user is clearly in a hurry, default to option C and say so) which of the
three they want.

## A. Automated Playwright check (most thorough)

Requires Node.js, `playwright`, and a Chromium install. Run:

```bash
node codebase-mindmap/scripts/verify.mjs <path-to-generated-file>.html
```

This is a generalized version of the checks used to catch real bugs in the
original hand-built Hermes mind map during development (a CSS-animation vs.
SVG-transform-attribute conflict that broke node positioning on expand, and a
search panel that went stale on an empty/no-match query). It computes its
expected node/child counts **from the generated file's own embedded data**,
not from hardcoded numbers, so it works on any output this skill produces —
if you're extending `verify.mjs`, preserve that property; don't reintroduce
hardcoded counts for a specific fixture.

If `playwright`/Chromium aren't available, `verify.mjs` prints instructions to
install them and exits non-zero — that's the cue to fall back to strategy B
or C rather than a real failure.

## B. Agent-driven manual spot-check (no extra dependency)

If the invoking agent has a browser automation tool available (e.g. Claude
Code's `claude-in-chrome` tools), use it directly: serve or open the file,
click a node to confirm children fan out to distinct positions (not stacked at
one point), try search with a term you know appears in the tree, confirm the
detail panel and breadcrumb update. This is exactly the manual process used to
find and confirm the bugs referenced above, just without a saved, rerunnable
script.

If no browser automation tool is available, at minimum open the file with the
OS file-open command and ask the user to confirm it looks right:

```bash
# macOS
open ./my-project-mindmap.html
# Linux
xdg-open ./my-project-mindmap.html
```

## C. No verification

Hand off the file as-is. Appropriate when the user explicitly wants speed over
certainty, or for a quick internal/throwaway look at a codebase. Say plainly
that you skipped verification so it's not mistaken for "checked and passing."

## Choosing among them

- Default to **B** when a browser automation tool is already available to you
  — it's nearly free and catches the most common visible failure (nodes not
  fanning out correctly on expand).
- Offer **A** when the user cares about repeatability (e.g. they'll rerun this
  skill regularly, perhaps in CI) or when you've made changes to
  `assets/template.html` itself and want confidence nothing regressed.
- Use **C** only when explicitly asked to skip, or the user is clearly
  optimizing for speed over confidence.
