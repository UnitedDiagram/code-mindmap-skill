# Customization Options

Customization is expressed in natural language, not a fixed menu. Interpret the
user's request against the option space below, fill in sensible defaults for
anything unspecified, and tell the user what you resolved it to (so they can
correct a wrong guess in one follow-up rather than re-explaining from scratch).

If the target directory already has a `.mindmap-config.json` (see
`config-schema.md`) and the user doesn't mention changing anything, reuse it
silently — that's the whole point of persisting it.

## Theme

Controls `__THEME_VARS__` (a named palette from `assets/themes.json`).

| User says something like... | Resolve to |
|---|---|
| (nothing specified) | `dark-github` (default — matches the original hand-built mind maps) |
| "light", "light mode", "light theme" | `light` |
| "high contrast", "presentation mode" | `high-contrast` |
| a specific color / vibe ("make it purple", "matrix green") | Pick the closest existing theme, or hand-author a one-off variable block inline in the output rather than adding a new named theme to `assets/themes.json` unless the user says they'll reuse it |

Adding a genuinely new named theme means adding an entry to `assets/themes.json`
(see that file's own comments for the required variable set) — do this when a
palette seems reusable, not for a one-off request.

## Visual Style

Controls which rendering engine `render.py` uses (`--style`), and therefore
which theme file `--theme` resolves against (`assets/themes.json` for
`classic`, `assets/circuit-themes.json` for `circuit`).

| User says something like... | Resolve to |
|---|---|
| (nothing specified) | `classic` (default — today's minimalistic look, unchanged) |
| "circuit style", "circuit board look", "schematic look", "blueprint style" | `circuit` — chip-shaped nodes with a colored edge stripe per branch, right-angle ("Manhattan") traces instead of curves, a via/junction marker on cross-file connections, and a spec-sheet-style detail panel |

Style and theme are independent axes — resolve both. "Circuit style, light
theme" means `--style circuit --theme light`. **The default never changes
unless the user asks** — this is an opt-in alternative, not a replacement for
the existing look, so a plain "make me a mind map" request with no styling
language must keep producing `classic` output exactly as before.

Circuit's via/junction markers, right-angle trace routing, and chip shape are
bundled into choosing the `circuit` style itself — they are not independently
toggleable feature flags, same category as classic's non-toggleable
bezier-curve/rounded-corner choices (see the note at the end of the
Interactivity section below).

## Depth

Controls how far `scan.py --depth` walks and how many tree levels the agent
turns into nodes with real narrative (vs. rolling a subtree up into its
parent's `code`/`desc` as a summary instead of separate child nodes).

| User says something like... | Resolve to |
|---|---|
| (nothing specified, small-to-medium repo) | `standard` — top-level modules + one level of their most significant children |
| (nothing specified, very large repo, e.g. >50k LOC or >20 top-level dirs) | `shallow` — default down a level to avoid an overcrowded, unusably dense canvas |
| "just the top level", "high level overview", "shallow" | `shallow` — top-level modules/dirs only, no drill-down |
| "deep dive", "show me functions too", "go all the way down" | `deep` — module → file → class/function, matching the level of detail the original Hermes mind map used for its most central nodes (e.g. `AIAgent` → `chat()` / `run_conversation()`) |
| "focus on X" / "just the Y part" | Scope the whole tree to that subdirectory or module, still applying whichever depth otherwise applies |

Never go deeper than `deep` even if asked ("show every function in the repo")
— explain that the single-file output size and canvas readability both degrade
badly past class/function level, and suggest scoping to a subdirectory instead.

## Interactivity (feature flags)

Controls `__FEATURES__`, a flat JSON object of booleans consumed by the
template's init code to decide which UI pieces to wire up at all.

| Flag | Default | User phrases that toggle it off |
|---|---|---|
| `search` | `true` | "no search box", "remove search" |
| `hoverPreview` | `true` | "no hover tooltips", "don't show previews on hover" |
| `breadcrumb` | `true` | "no breadcrumb" |
| `legend` | `true` | "no legend", "hide the color key" |
| `panZoom` | `true` | "static view", "no zooming" (rare — only disable for genuinely minimal asks) |

Don't invent new flags casually — if a request doesn't map to one of the above
and isn't a theme/depth/style change, treat it as a `desc`/narrative-content
request instead (e.g. "explain the auth flow more" is about content, not a
feature flag).

## What's explicitly NOT customizable via natural language (v1)

- **Layout algorithm.** Both templates use the same fixed left-to-right tree
  layout (`computeLayout`/`layoutNode` in `assets/template.html` and
  `assets/template-circuit.html`), not a force-directed or radial layout.
  `DEPTH_CONFIG`/`H_SPACING`/`V_SPACING` in either template are safe
  manual-edit points for a "more compact" / "more spread out" tweak, but
  there's no natural-language knob for this yet — if asked, say so rather
  than guessing at a half-implemented layout mode.
- **Animation timing/easing.** Cosmetic constants in the template CSS/JS; edit
  directly if truly needed, don't add a config surface for it.
