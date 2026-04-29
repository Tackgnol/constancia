# Tell Me Why — Refine the `tell-me-why` skill activation rules

- Date: 2026-04-29
- Session file: `docs/tell-me-why/2026-04-29-1315-refine-tell-me-why-skill.md`
- User request: Check the `tell-me-why` skill against the skill-authoring guidance, confirm that each chat/session should create a new file, and make the skill run when invoked directly or routed via `AGENTS.md` rather than only on exact phrasing.
- Success criteria:
  - Tighten the skill so activation is explicit and automatic when routed.
  - Keep the per-chat/session file policy clear.
  - Align wording with the repository's skill style and skill-authoring guidance.
- Constraints:
  - Destination flexibility is not important as long as the convention is stable.
  - One new file per chat/session.
  - `AGENTS.md` remains authoritative.

## Change 1 — `.claude/skills/tell-me-why/SKILL.md:L1-L25, L36-L63`

### Why this change was made
Reworked the skill so it no longer depends on the user repeating an exact phrase. The user clarified that if the skill is invoked directly or routed by `AGENTS.md`, it should simply run. I also aligned the skill more closely with the repo's local skill style by adding an `Authority` section and making the one-file-per-chat/session policy explicit.

### Other solutions considered
- Leave the existing skill as-is and only explain the intended behavior in the handoff message — rejected because the behavior needed to live in the skill itself, not only in human interpretation.
- Make the skill trigger on broader vague wording only — rejected because the stronger requirement is explicit auto-activation when invoked or routed, not fuzzy semantic expansion alone.
- Remove the destination convention entirely — rejected because even though the user does not care much about the exact folder, the repo still benefits from one stable default location.

### Why here and not somewhere else
The activation behavior, authority rules, and per-session log policy belong in the skill definition because that is the instruction source the agent will actually load when using the workflow. Putting those rules only in `AGENTS.md` would leave the skill internally underspecified.

### Risks / follow-up
- The skill still relies on the agent to reconcile final line ranges correctly; that remains a discipline requirement rather than an automated guarantee.

## Change 2 — `docs/tell-me-why/README.md:L3-L5, L22-L24`

### Why this change was made
Updated the folder README to match the refined skill behavior. The repo convention now clearly states that this folder is for one new file per chat/session and that the file should be created automatically when the skill is invoked or routed.

### Other solutions considered
- Leave the README unchanged and let the skill be the only source of behavior — rejected because a human browsing the folder should be able to understand the convention without opening the skill first.
- Replace the README with a more generic docs note elsewhere — rejected because the behavior is specific to this directory.

### Why here and not somewhere else
This file documents the purpose of the exact directory where the logs are stored, so it is the natural place to restate the storage convention and auto-creation expectation.

### Risks / follow-up
- If the repo later changes the log folder, this README and the skill will need to be updated together.

## Change 3 — `AGENTS.md:L19-L23`

### Why this change was made
Strengthened the repo-level routing text so the skill is not merely advisory. The user explicitly wanted the skill to run when invoked or when present in the repo instructions, so `AGENTS.md` now says to create a new session log automatically when routed there.

### Other solutions considered
- Keep the previous shorter routing sentence — rejected because it still left too much room for an agent to treat the skill as optional.
- Put the stronger auto-run instruction only inside the skill — rejected because repo-level routing should also express the behavior clearly.

### Why here and not somewhere else
`AGENTS.md` is the repository-wide routing layer. If the repo wants this behavior to happen automatically, that expectation should be visible at the same place where other repo-specific skill routing happens.

### Risks / follow-up
- None beyond normal doc drift; `AGENTS.md` and the skill now say the same thing.

## Final Summary

- Files changed:
  - `.claude/skills/tell-me-why/SKILL.md`
  - `docs/tell-me-why/README.md`
  - `AGENTS.md`
  - `docs/tell-me-why/2026-04-29-1315-refine-tell-me-why-skill.md`
- Validation run:
  - Read back the edited files to verify the activation wording, authority section, and one-file-per-session policy.
  - Checked the skill against `C:\Users\Adam\.claude\skills\skill-creator-ms\SKILL.md` for trigger-rich description, concise structure, and line-count discipline.
  - Repository checks run after the edits: `npm run lint`, `npm run typecheck`, `npm run test`.
- Remaining concerns:
  - None functionally; the only open improvement would be automated line-range extraction if the team wants to remove that manual step later.



