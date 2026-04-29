---
name: tell-me-why
description: Use when explicitly invoked with "tell me why", when repository instructions require decision logging, or when a change introduces durable technical trade-offs. Records reviewable rationale, alternatives, consequences, validation, and follow-up risks.
metadata:
  category: discipline
  triggers:
    - tell me why
    - rationale log
    - decision record
    - ADR
    - why this change
    - alternatives considered
---

# Tell Me Why

Maintain durable, reviewable rationale for non-trivial repository changes.

## Authority

- Follow `AGENTS.md` and deeper repository instructions first.
- This skill records rationale. It does not override user instructions, tests, security rules, or repository conventions.
- Do not record private chain-of-thought. Record concise, audit-safe rationale summaries.

## Intent

Use this skill to preserve the reasoning behind changes so future humans and agents can understand:

- what changed
- why it changed
- what alternatives were considered
- what trade-offs were accepted
- how the change was validated
- what risks remain

## Storage Model

Use three layers:

1. `docs/adr/`
    - Durable decision records.
    - One file per significant decision.
    - Sequential numbering: `0001-short-title.md`.

2. `docs/DECISION_INDEX.md`
    - Compact index of ADRs with status and short summaries.

3. `memory-bank/progress.md` or `memory-bank/learnings.md`
    - Session handoff notes and reusable lessons.
    - Do not duplicate ADRs here. Link to them.

Before creating a new ADR, determine the next sequential number by reading `docs/DECISION_INDEX.md` or listing the `docs/adr/` directory. Do not guess the number. Do not overwrite an existing ADR.

If `docs/adr/` does not exist, create it.

If `docs/DECISION_INDEX.md` does not exist, create it with this title:

~~~md
# Decision Index
~~~

If `memory-bank/` does not exist, create it only when there is useful progress or reusable learning to record.

## When to Create an ADR

Create or update an ADR when the task involves:

- architecture changes
- dependency or framework choices
- data model changes
- public API behavior
- security, authorization, or privacy behavior
- deployment/runtime behavior
- major refactors
- explicit trade-offs the future maintainer may question

Do not create an ADR for:

- typo fixes
- obvious bug fixes with no trade-off
- formatting-only changes
- mechanical renames
- test-only updates with no behavioral consequence
- changes already fully covered by an existing ADR

If a new decision overrides an older ADR, update the old ADR status to `Superseded` and add a link from the old ADR to the new ADR. The new ADR must also link back to the superseded ADR.

If no ADR is created for a non-trivial task, briefly state why in the final response:

- ADR skipped because the change was mechanical.
- ADR skipped because the change did not introduce a durable decision.
- ADR skipped because the decision was already covered by ADR-XXXX.

## ADR Template

You must use this exact structure. Do not omit sections. If a section does not apply, write `N/A` and briefly explain why.

~~~md
# ADR-0000: <Title>

- Status: Proposed | Accepted | Superseded | Rejected | Deprecated
- Date: <YYYY-MM-DD>
- Scope: <files/modules/features affected>
- Decision Owner: <human/agent/pair>

## Context

What problem forced a decision?

## Decision

What was chosen?

## Alternatives Considered

### Option A: <name>

- Pros:
- Cons:

### Option B: <name>

- Pros:
- Cons:

## Rationale

Why is the selected option preferable under current constraints?

## Consequences

What becomes easier?
What becomes harder?
What constraints does this create?

## Validation

What checks were run?
What evidence supports the decision?

## Risks and Follow-up

What could be wrong?
What should be revisited later?

## Links

- Related PR:
- Related issues:
- Related files:
- Supersedes:
- Superseded by:
~~~

## Decision Index Format

Maintain `docs/DECISION_INDEX.md` as a compact table.

~~~md
# Decision Index

| ADR | Status | Date | Title | Summary |
|---|---|---:|---|---|
| [ADR-0001](adr/0001-example.md) | Accepted | 2026-04-29 | Example | Short summary of the decision. |
~~~

When an ADR changes status, update the index in the same edit.

## Required Workflow

### Before Editing

For non-trivial changes, write a short pre-edit rationale in the working response, task notes, or temporary plan:

~~~md
### Pre-edit rationale

- Problem:
- Likely change:
- Main alternative:
- Risk:
- Validation plan:
~~~

### During Editing

Track whether the change creates, updates, supersedes, or does not require an ADR.

If the change affects an existing decision, search existing ADRs before creating a new one.

### After Editing

Update the appropriate memory layer:

- If the change introduced a durable decision, create or update an ADR.
- If the task revealed reusable repo knowledge, update `memory-bank/learnings.md`.
- If the session has unfinished work, update `memory-bank/progress.md`.
- If an ADR was created or updated, update `docs/DECISION_INDEX.md`.
- If an older ADR was superseded, update its status and cross-links.

Memory-bank files must link to ADRs instead of duplicating ADR content.

## Final Response

Summarize:

- files changed
- ADR created, updated, superseded, or intentionally skipped
- validation performed
- remaining risks

## Completion Checklist

Before finishing, verify:

- [ ] Sequential number verified.
- [ ] `docs/adr/XXXX-title.md` created or updated, if required.
- [ ] ADR uses the exact required structure.
- [ ] `docs/DECISION_INDEX.md` updated, if an ADR changed.
- [ ] `memory-bank/` files updated with links to ADRs, if useful.
- [ ] Previous superseded ADRs updated, if applicable.
- [ ] New ADR links to superseded ADRs, if applicable.
- [ ] Superseded ADRs link to the new ADR, if applicable.
- [ ] Validation results recorded.
- [ ] Remaining risks or follow-up work recorded.
