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
  "verification": "manual",
  "onboarding": {
    "resolved_prompt_mode": "plan-mode",
    "purpose": "new-contributor-onboarding",
    "audience": "new contributor",
    "emphasis": ["top-level architecture", "flows/data paths"]
  }
}
```

| Field | Meaning |
|---|---|
| `schema_version` | Bump if this shape ever changes incompatibly. |
| `output_path` | Where the last generated file was written, relative to the target repo root. |
| `theme` | Resolved theme name from `assets/themes.json` (see `customization-options.md`). |
| `depth` | `shallow` \| `standard` \| `deep` (see `customization-options.md`). |
| `features` | The resolved feature-flag object also injected as `__FEATURES__`. |
| `scope` | `null` for the whole repo, or a relative path if the user scoped generation to a subdirectory ("just the agent/ folder"). |
| `verification` | Which of `references/verification-strategies.md`'s options (`playwright` \| `manual` \| `skip`) was used last time — informational, doesn't auto-run anything. |
| `onboarding` | Optional object recording the planning-mode brief that led to this map. Existing config files without this field remain valid. |
| `onboarding.resolved_prompt_mode` | Usually `plan-mode`; records that choices were collected after entering or confirming the host coding agent's Plan Mode. |
| `onboarding.purpose` | Why the map exists, such as `new-contributor-onboarding`, `architecture-review`, `pr-or-share-artifact`, or the user's custom wording. |
| `onboarding.audience` | Who the map is for, such as a new contributor, reviewer, maintainer, or team. |
| `onboarding.emphasis` | Array of focus areas to carry into the narrative, such as top-level architecture, flows/data paths, or risks. |

## Behavior

- On a rerun, if this file exists and the user's request doesn't mention
  changing anything, reuse customization and onboarding intent silently rather
  than re-deriving defaults or re-asking.
- If the user asks for a change ("make it lighter this time"), update only the
  fields that changed and rewrite the file with a fresh `generated_at`.
- Never treat this file's presence as a signal to skip the actual
  scan+narrate+render steps — it only resolves *customization*, not content;
  the codebase may have changed since the last run.
