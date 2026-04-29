# Tell Me Why logs

This folder stores per-session rationale logs created by the `tell-me-why` skill.

In this repository, the convention is one new Markdown file per chat/session.

## File naming

Use:

- `YYYY-MM-DD-HHMM-<short-task-slug>.md`

## Purpose

Each log should explain, for every logical change:

- which file and line range changed
- why the change was made
- what other solutions were considered
- why the chosen file or layer was the right place for the change

The goal is both historical traceability and active self-review while coding.

If the skill is explicitly invoked or routed by `AGENTS.md`, the agent should create a new file here automatically for that session.

