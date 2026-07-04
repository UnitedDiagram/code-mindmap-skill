# Template Anatomy

`assets/template.html` is the rendering engine — a generalized version of the
hand-built `hermes-codebase-mindmap.html`. Read this before hand-editing the
template; `scripts/render.py` only does literal string replacement, it does
not understand HTML/JS structure, so every placeholder must appear in the
template as an exact, unique token.

## Placeholder tokens

| Token | Replaced with | Source |
|---|---|---|
| `__TITLE__` | Plain text, HTML-escaped. Page `<title>` and sidebar `<h1>`. | Repo/project name, usually from a manifest's `name` field or the directory name. |
| `__SUBTITLE__` | Plain text, HTML-escaped. One-line sidebar subtitle. | Agent-written, one sentence. |
| `__WELCOME_INTRO__` | Plain text, HTML-escaped. First paragraph of the welcome panel. | Agent-written: what this codebase is. |
| `__WELCOME_BLURB__` | Plain text, HTML-escaped. Second paragraph of the welcome panel. | Agent-written: one more sentence of context (tech stack, purpose). The static "How to use" tip list below it never changes — it's generic UI instructions, not content. |
| `__THEME_VARS__` | A raw `:root { --var: value; ... }` CSS block. | Looked up from `assets/themes.json` by the resolved theme name (see `customization-options.md`). |
| `__FEATURES__` | `JSON.stringify()` of the feature-flag object. | Resolved feature flags (see `customization-options.md`). |
| `__CODEBASE_DATA__` | `JSON.stringify()` of the `codebaseData` tree. | The generated mind-map tree (see `data-schema.md`). JSON is a valid JS object literal, so this can be spliced directly into `const codebaseData = __CODEBASE_DATA__;` with no escaping logic needed. |
| `__CROSS_CONNECTIONS__` | `JSON.stringify()` of the `crossConnections` array. | Same generation step as above. |

All placeholders appear exactly once in the template, each on its own
statement (`const codebaseData = __CODEBASE_DATA__;`, etc.) so a plain
`str.replace()` per token is safe and unambiguous.

## Structural pieces carried over unchanged from the original

The following are lifted essentially as-is from `hermes-codebase-mindmap.html`
because they're generic — they operate purely on the injected data, not on
anything Hermes-specific:

- Tree flattening / layout: `flattenTree`, `computeLayout`, `layoutNode`
- SVG rendering: `createSVG`, `createNodeElement`, `createLinkPath`, `fullRender`, `updateRender`, `renderCrossConnections`
- Interaction: `showHoverPreview`/`hideHoverPreview`, `handleNodeClick`, `collapseSubtree`, `smoothPanToNode`
- Detail/navigation: `showDetail`, `updateBreadcrumb`, `navigateToNode`, `getDataPath`, `getNodeName`
- View: `applyTransform`, `fitAll`, pan/zoom/wheel handlers, touch handlers, resize handler
- Search input handler (gated on `FEATURES.search`)

**One fix from the original you must not accidentally undo**: the CSS classes
that drive the spawn-in and collapse-out animations (`node-spawning` /
`node-collapsing`) must be added to the *inner* `.node-visual` group created
inside `createNodeElement()`, never to the outer `<g class="node-group">`
that also carries the `transform="translate(x, y)"` **attribute**. A CSS
`animation` targeting `transform` on the same element that also has a
`transform` attribute will silently and permanently override the attribute's
translate — this was a real, confirmed bug in the original file (all newly
expanded nodes collapsed onto a single point) and the fix is exactly this
attribute/CSS separation. If you refactor `createNodeElement`, keep the inner
wrapper group.

## What changed structurally vs. the original file

- **No hardcoded `COLORS` object or fixed 9-item legend markup.** The legend
  is now built at runtime by a `renderLegend(items)` function from whatever
  distinct `(name, color)` pairs actually exist at depth 1 in the injected
  data — it works for any tree, not a fixed category list.
- **Badge coloring uses `badges[].type` directly** (`lang`/`metric`/`core`/
  `flag` → CSS class), not substring-matching on the label text.
- **CSS uses custom properties** (`--bg-primary`, `--bg-secondary`,
  `--text-primary`, `--text-muted`, `--accent`, `--border`, `--node-label-fill`,
  etc.) declared at `:root`, so `__THEME_VARS__` can override the whole palette
  by injecting one block. Not every color is theme-driven, though — see the
  warning below.
- **A `FEATURES` object gates optional UI**, checked at the handful of call
  sites that wire up search, hover preview, breadcrumb, and legend visibility.
  This mechanism didn't exist in the original file at all.

## A second style: `template-circuit.html`

`assets/template-circuit.html` is a full fork of this file for the opt-in
`circuit` style (see `customization-options.md`), not a variant driven by a
runtime flag inside one shared file — it was created by copying
`template.html` and editing only:

- the `<style>` block (variables from `assets/circuit-themes.json`'s
  `--s-*` namespace instead of this file's `--bg-primary`/`--text-primary`/
  etc.)
- `DEPTH_CONFIG` (chip sizing instead of rounded-card sizing)
- `createNodeElement` (sharp-cornered chip + colored edge stripe from
  `node.color` + a via/junction ring for any node referenced in
  `crossConnections`, instead of a full-color-filled rounded rect)
- `createLinkPath` and the equivalent inline path string inside
  `updateRender`'s position-interpolation loop (both now emit a strict
  right-angle "Manhattan" path instead of a cubic bezier — if you edit one,
  edit the other, they must stay in sync)
- `renderCrossConnections` (a dashed "jumper" trace routed over a shared rail
  plus diamond via-pads, instead of a bezier dashed line)
- `showDetail` (a spec-sheet layout: tag row, ruled description, a "Net
  list"/"Contains" section with a color swatch per entry, instead of
  badge-pill/code-block markup)
- one small addition with no equivalent in `template.html`: a
  `crossConnectedIds` set (`new Set(crossConnections.flatMap(...))`),
  computed once at load, so `createNodeElement` knows whether to draw the via
  ring

Every other function, every element ID, and the placeholder-token contract
above are identical between the two files — including the `.node-visual`/
`.node-group` transform-vs-animation separation, which was preserved as-is
when forking. `node.color` is a plain hex string in both; this template just
reinterprets it as a stripe/trace accent instead of a fill, so there is no
`data-schema.md` change between styles.

One known trade-off: the two files share roughly 90% of their JS by
duplication (`flattenTree`, `computeLayout`, `getDataPath`, `navigateToNode`,
etc. are copy-pasted, not shared). A bug fix to that shared logic must be
applied to both files by hand — the single self-contained-file, no-build-step
output requirement rules out factoring out a shared JS module.

## Warning: not every color is a theme variable

`.node-label { fill: var(--node-label-fill) }` exists to keep node label text
readable against a colored node box — it's a contrast choice, not a
page-background-driven color. If you add a new theme to `assets/themes.json`,
don't just invert every variable for a "light" look; check that node labels,
selected-node strokes, and connection-line colors still have enough contrast
against both the page background and the node fill colors in that theme.
