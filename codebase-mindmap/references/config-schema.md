# Persisted Config Schema (`.mindmap-config.json`)

Optional. Written to the root of the *target* repo (not this skill's own
directory) after a generation run, so a rerun can skip re-asking about theme/
depth/features unless the user wants to change something. Purely a convenience
cache of resolved customization — never required for the skill to function.

```jsonc
{
  "schema_version": 1,
  "generated_at": "2026-07-02T00:00:00Z",
  "output_path": "./my-project-mindmap.html",
  "style": "classic",
  "theme": "dark-github",
  "depth": "standard",
  "features": {
    "search": true,
    "hoverPreview": true,
    "breadcrumb": true,
    "legend": true,
    "panZoom": true
  },
  "scope": null,
  "verification": "manual"
}
```

| Field | Meaning |
|---|---|
| `schema_version` | Bump if this shape ever changes incompatibly. |
| `output_path` | Where the last generated file was written, relative to the target repo root. |
| `style` | `classic` \| `circuit` — resolved visual style (see `customization-options.md`). A config file written before this field existed has no `style` key at all; treat that as `classic` on read, not as an error or a reason to bump `schema_version`. |
| `theme` | Resolved theme name from `assets/themes.json` (`classic`) or `assets/circuit-themes.json` (`circuit`) — see `customization-options.md`. |
| `depth` | `shallow` \| `standard` \| `deep` (see `customization-options.md`). |
| `features` | The resolved feature-flag object also injected as `__FEATURES__`. |
| `scope` | `null` for the whole repo, or a relative path if the user scoped generation to a subdirectory ("just the agent/ folder"). |
| `verification` | Which of `references/verification-strategies.md`'s options (`playwright` \| `manual` \| `skip`) was used last time — informational, doesn't auto-run anything. |

## Behavior

- On a rerun, if this file exists and the user's request doesn't mention
  changing anything, reuse it silently rather than re-deriving defaults or
  re-asking.
- If the user asks for a change ("make it lighter this time"), update only the
  fields that changed and rewrite the file with a fresh `generated_at`.
- Never treat this file's presence as a signal to skip the actual
  scan+narrate+render steps — it only resolves *customization*, not content;
  the codebase may have changed since the last run.
