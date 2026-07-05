# Onboarding Audit

This audit covers the agent-facing onboarding flow for codebase mind map
generation. It is not a screenshot UX audit because this repository does not
ship a runnable onboarding UI. The generated HTML viewer's Welcome panel is a
separate in-artifact tutorial and should remain unchanged unless the resolved
onboarding brief explicitly affects its copy.

## Current behavior

- First-run onboarding asks for purpose, audience, scope, emphasis, style, and
  verification before scanning.
- Reruns can reuse `.mindmap-config.json`, including onboarding intent, unless
  the user asks to change it.
- The remaining gap is mode control: a Markdown skill cannot force the host app
  to switch modes by itself.

## Gaps

- A new contributor, reviewer, and maintainer need different explanations from
  the same file tree.
- A Plan-Mode-style prompt without actual mode control can still let an agent
  proceed without structured choices in hosts that support a real Plan Mode.
- Claude subagent delegation can lose the planning context if the parent thread
  does not collect and pass the resolved brief from planning mode first.
- Unsupported hosts need an explicit hard stop rather than a silent fallback to
  plain text prompts.

## Recommended onboarding prompt

Before scanning, enter or confirm the host coding agent's native Plan Mode. If
Plan Mode is unavailable or cannot be confirmed, hard stop with exactly:

```text
Onboarding requires Plan Mode so you get prompted choices. Switch this coding agent to Plan Mode, then ask again.
```

After Plan Mode is active, inspect the target repo enough to avoid asking about
facts the agent can discover from local files. Then ask only for missing intent.

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

Do not run `scan.py` until Plan Mode is active and this brief is complete.

## Multi-agent behavior

- Codex should switch to or confirm Plan Mode before structured choices and cap
  each round at three short questions.
- Claude Code should use its native planning mode if available, collect the
  brief in the parent thread, then delegate to
  `.claude/agents/codebase-mindmapper.md`.
- Cursor and other agents should use a native planning mode if one exists. If
  no planning mode can be confirmed, they must hard stop with the Plan Mode
  message instead of silently emulating it.

## Acceptance criteria

- First runs with no `.mindmap-config.json` enter or confirm Plan Mode before
  asking the full wizard or scanning.
- User-provided preferences are reused without redundant questions.
- Reruns with `.mindmap-config.json` reuse saved customization and onboarding
  intent unless the user asks to change them.
- Unsupported hosts hard stop with the exact Plan Mode message.
- The source skill and packaged plugin mirror document the same behavior.
