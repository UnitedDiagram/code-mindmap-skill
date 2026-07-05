# Customization Options

Customization is expressed in natural language, not a fixed menu. Interpret the
user's request against the option space below, fill in sensible defaults for
anything unspecified, and tell the user what you resolved it to (so they can
correct a wrong guess in one follow-up rather than re-explaining from scratch).

If the target directory already has a `.mindmap-config.json` (see
`config-schema.md`) and the user doesn't mention changing anything, reuse it
silently — that's the whole point of persisting it.

First-run onboarding is a Plan-Mode-gated wizard, not just a style picker. If
there is no `.mindmap-config.json`, or the user asks to change the intent or
customization, enter or confirm the host coding agent's native Plan Mode before
asking onboarding questions.

If Plan Mode is unavailable or cannot be confirmed, hard stop with exactly:

```text
Onboarding requires Plan Mode so you get prompted choices. Switch this coding agent to Plan Mode, then ask again.
```

Do not inspect further, ask wizard questions, run `scan.py`, or delegate to a
subagent until Plan Mode is active.

Use structured choice tools when the host environment offers them after Plan
Mode is active. In Codex, ask no more than three short questions per round.

## Plan-Mode-gated onboarding wizard

Ask these in order, skipping anything the user already answered:

```text
I need to lock the map brief before scanning.

1. Goal and audience: is this for new contributor onboarding, architecture
   review, a PR/share artifact, or something custom?
2. Scope and emphasis: should I map the whole repo or a subsystem, and should
   the map emphasize top-level architecture, flows/data paths, risks, or
   something custom?
3. Output preferences: choose theme, depth, features, output path, and
   verification mode. Defaults: dark-github, standard depth, all features,
   ./<repo-name>-mindmap.html, manual verification.
```

After answers are known or explicitly defaulted, summarize before scanning:

```text
I'll map {scope} for {audience} to answer {goal} with {depth}, {theme},
{features}, and {verification}.
```

Do not run `scan.py` until this brief is complete.

### Goal and audience

| User says something like... | Resolve to |
|---|---|
| "help me onboard", "new engineer", "understand this repo" | `purpose: new-contributor-onboarding`, `audience: new contributor` |
| "architecture review", "how is this designed" | `purpose: architecture-review`, `audience: reviewer/maintainer` |
| "attach to a PR", "share this with the team" | `purpose: pr-or-share-artifact`, `audience: reviewers/team` |
| "for X" / custom wording | Preserve the user's wording in the resolved brief |

### Scope and emphasis

| User says something like... | Resolve to |
|---|---|
| (nothing specified) | `scope: null`, whole repo |
| "just auth", "only the agent folder" | Scope to that subdirectory/module if it exists; otherwise ask for the path |
| "high-level overview" | Emphasize top-level architecture and use `depth: shallow` unless another depth is specified |
| "data flow", "request lifecycle", "how messages move" | Emphasize flows/data paths in node descriptions and cross-connections |
| "risks", "hot spots", "what should I be careful with" | Emphasize risks and caveats where supported by repo evidence |

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
and isn't a theme/depth change, treat it as a `desc`/narrative-content request
instead (e.g. "explain the auth flow more" is about content, not a feature
flag).

## What's explicitly NOT customizable via natural language (v1)

- **Layout algorithm.** The engine uses a fixed left-to-right tree layout
  (`computeLayout`/`layoutNode` in `assets/template.html`), not a
  force-directed or radial layout. `DEPTH_CONFIG`/`H_SPACING`/`V_SPACING` in
  the template are safe manual-edit points for a "more compact" / "more spread
  out" tweak, but there's no natural-language knob for this yet — if asked,
  say so rather than guessing at a half-implemented layout mode.
- **Animation timing/easing.** Cosmetic constants in the template CSS/JS; edit
  directly if truly needed, don't add a config surface for it.
