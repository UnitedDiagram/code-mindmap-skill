# Onboarding Audit

This audit covers the agent-facing onboarding flow for codebase mind map
generation. It is not a screenshot UX audit because this repository does not
ship a runnable onboarding UI. The generated HTML viewer's Welcome panel is a
separate in-artifact tutorial and should remain unchanged unless the resolved
onboarding brief explicitly affects its copy.

## Current behavior

- First-run onboarding currently asks only for map style: theme, depth, and
  feature simplification.
- The agent can scan before learning the user's purpose, audience, target
  scope, or desired emphasis.
- Reruns can reuse `.mindmap-config.json`, but the persisted shape only records
  output customization, not the reason the map exists.

## Gaps

- A new contributor, reviewer, and maintainer need different explanations from
  the same file tree.
- The old compact prompt does not force the agent to distinguish discoverable
  repo facts from user intent.
- Claude subagent delegation can lose the planning context if the parent
  thread does not collect and pass the resolved brief first.
- Verification choice is easy to defer until after rendering, even though it
  can affect the user's expectations for turnaround and confidence.

## Recommended onboarding prompt

Before scanning, inspect the target repo enough to avoid asking about facts the
agent can discover from local files. Then ask only for missing intent.

Full-wizard prompt:

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

After answers are known or defaulted, summarize:

```text
I'll map {scope} for {audience} to answer {goal} with {depth}, {theme},
{features}, and {verification}.
```

Do not run `scan.py` until this brief is complete.

## Multi-agent behavior

- Codex should use structured choice prompts when available and cap each round
  at three short questions.
- Claude Code should collect the brief in the parent thread before delegating
  to `.claude/agents/codebase-mindmapper.md`.
- Cursor and other agents should present the same wizard as plain numbered
  choices and preserve the resolved brief in their working notes.

## Acceptance criteria

- First runs with no `.mindmap-config.json` ask the full wizard before
  scanning.
- User-provided preferences are reused without redundant questions.
- Reruns with `.mindmap-config.json` reuse saved customization and onboarding
  intent unless the user asks to change them.
- The source skill and packaged plugin mirror document the same behavior.
