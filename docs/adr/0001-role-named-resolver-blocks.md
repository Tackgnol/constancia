# Resolver pipeline blocks are named by role, implemented by the Game System

Test and insight resolution use role-named pipeline blocks (`test-resolver`, `insight-resolver`) instead of system-prefixed ones (`vtm-pool-resolver`). The campaign's Game System supplies each role's implementation and config schema, and every implementation must set `ctx.playerScore` for `outcome-map`. We chose this so stored pipelines, Event Setup defaults and catalogue availability never name a system, and adding a Game System (D&D 5e first) means implementing roles, not adding block types and `id ===` branches across the apps.

## Considered Options

- **System-prefixed block types plus a role map on the adapter.** Rejected: stored pipelines would still be tied to one system, and the catalogue would keep per-system `gameSystemIds` lists.

## Consequences

- A role block's config can't be validated by a fixed catalogue schema. The backend validates it against the campaign system's schema when the Event is saved.
- Existing `vtm-pool-resolver` / `vtm-insight-resolver` instances are migrated to the role names.
- A system that doesn't implement a role hides the event types that need it, and firing such an Event fails as unsupported.
- Blocks that only one system has and that fill no role keep a `<systemId>-` prefix.
- At a Test submission, `test-resolver` runs only when the player asks the backend to roll for them. A typed final result bypasses it and becomes `playerScore` directly.
- Advantage-style effects are a further role, `roll-modifier`. It passes data to `test-resolver` through a typed context patch on `BlockContext` (`rollModifiers`), so it must come before the resolver in the pipeline.
