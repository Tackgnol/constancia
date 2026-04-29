# Tell Me Why — Add the `tell-me-why` skill

- Date: 2026-04-29
- Session file: `docs/tell-me-why/2026-04-29-1306-add-tell-me-why-skill.md`
- User request: Create a coding skill named `tell me why` that makes the agent create a Markdown file for each session documenting why every change was made, alternatives considered, and why the change belongs in that location.
- Success criteria:
  - Add a new repository skill for per-session change rationale logging.
  - Make the expected log location and format explicit.
  - Improve discoverability so future agents know when to use it.
- Constraints:
  - Keep the skill repository-local.
  - Preserve existing repo guidance, with `AGENTS.md` remaining authoritative.

## Change 1 — `.claude/skills/tell-me-why/SKILL.md:L1-L176`

### Why this change was made
Created the new skill itself. The user wanted a reusable instruction set that forces a session-level rationale log for each code change, so the core deliverable had to be a dedicated `SKILL.md` defining when the skill should trigger, where logs should live, and the exact per-change template.

### Other solutions considered
- Add a short note to `AGENTS.md` only — rejected because that would not create a standalone reusable skill with a clear trigger surface.
- Write a generic ADR template under `docs/` — rejected because the user asked for a coding skill, not just a document template.
- Make the skill broader and include git diff tooling requirements — rejected because the main goal is reasoning discipline, and the smallest useful version is a Markdown logging workflow.

### Why here and not somewhere else
Repository-local skills belong under `.claude/skills/`, and the new behavior is a cross-cutting agent workflow rather than app runtime code. Putting it anywhere in `apps/` or `packages/` would blur product code boundaries with agent guidance.

### Risks / follow-up
- Exact line-number reconciliation still depends on the agent updating the log after edits, so future users need to follow the checklist rather than treating the template as self-enforcing.

## Change 2 — `docs/tell-me-why/README.md:L1-L22`

### Why this change was made
Added a lightweight README so the log destination referenced by the skill already exists and has a visible convention. This reduces ambiguity about where session rationale files should be created and what they are for.

### Other solutions considered
- Let the skill create the directory lazily on first use — rejected because pre-creating the folder makes the convention obvious and reduces first-use friction.
- Skip documentation entirely and rely on the skill text — rejected because a visible folder-level explanation helps humans understand why these files are appearing in the repo.

### Why here and not somewhere else
The skill explicitly points to `docs/tell-me-why/`, so the supporting explanation belongs in that directory instead of in the repo root or a separate meta-doc file.

### Risks / follow-up
- If the team later wants a different storage location, both the skill and this README will need to move together.

## Change 3 — `AGENTS.md:L19-L23`

### Why this change was made
Updated the repository instructions so future agents can discover the new skill through the existing repo-specific skill section. Without this, the skill would exist on disk but be easier to miss during normal repo-guided work.

### Other solutions considered
- Leave `AGENTS.md` untouched and rely on automatic skill discovery — rejected because this repo already documents important local skills there.
- Add a longer section with full usage rules — rejected because the authoritative details already live in the skill file, so `AGENTS.md` only needs a short routing hint.

### Why here and not somewhere else
`AGENTS.md` already contains the repository's local-skill routing rules. Adding the new pointer there keeps the discovery surface centralized instead of scattering entry points across unrelated docs.

### Risks / follow-up
- If more repo-specific skills are added, this section may eventually need grouping to stay readable.

## Final Summary

- Files changed:
  - `.claude/skills/tell-me-why/SKILL.md`
  - `docs/tell-me-why/README.md`
  - `AGENTS.md`
  - `docs/tell-me-why/2026-04-29-1306-add-tell-me-why-skill.md`
- Validation run:
  - Read back all edited files to verify wording and placement.
  - Repository checks run after the edits: `npm run lint`, `npm run typecheck`, `npm run test`.
- Remaining concerns:
  - None at the skill-definition level; the main future question is whether the team eventually wants automated line-range extraction.

