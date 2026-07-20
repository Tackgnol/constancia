# Scenes and Maps — Current Architecture Implementation Plan

**Date:** 2026-07-19  
**Source:** `docs/superpowers/specs/2026-07-19-scenes-and-maps-design.md`  
**Starting point:** current `master`; do not merge the archived `feat/map` branch  
**Delivery shape:** vertical slices, each independently reviewable and tested

## Outcome

Add a GM-only Map workspace with persistent campaign scenes, one uploaded map per scene, typed
event/NPC/lore pegs, and event firing through the existing execution path. The implementation must
fit the current Prisma, Fastify, generated-client, React Router server-boundary, demo-parity, and
upload-ownership architecture.

This plan intentionally replaces the May plan. Do not copy its route-local Zod schemas, direct
browser API calls, invented auth helpers, frontend Vitest commands, `any` casts, or tag-removal work.

## Scope Guardrails

- The backend is the source of truth and the only application that imports `@constancia/db`.
- Scene routes live inside the existing Fastify campaign-admin scope.
- The browser never calls the backend directly and never value-imports `@constancia/api-client` from
  a reusable component or browser helper.
- The bot receives no scene/map command, handler, storage, or game logic.
- No block definition, registry, pipeline, or system package changes are needed.
- Persistent Scenes do not replace Discord channels or `ChannelType.scene`.
- The Play rail's current channel-derived filter remains; only its visible scene terminology
  (“Active scene,” “All scenes,” etc., see Slice 5) becomes channel terminology.
- All frontend forms use React Hook Form. Structured forms use Zod plus `zodResolver`.
- `any` is forbidden. Narrow `unknown` immediately at request or generated-client boundaries.
- Generated API files are regenerated, never hand-edited.
- Preserve all unrelated worktree changes.

## Official Patterns to Re-check Before Implementation

The implementing agent must re-open current official documentation before coding, as required by
`AGENTS.md`:

- [Fastify plugins and encapsulation](https://fastify.dev/docs/latest/Reference/Plugins/)
- [Fastify validation and serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)
- [React Router route modules](https://reactrouter.com/start/framework/route-module)
- [React Router actions](https://reactrouter.com/start/framework/actions)
- [Prisma one-to-one relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/one-to-one-relations)
- [Prisma referential actions](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/referential-actions)
- [Prisma PostgreSQL check constraints](https://docs.prisma.io/docs/orm/more/troubleshooting/check-constraints)
- [react-zoom-pan-pinch source](https://github.com/BetterTyped/react-zoom-pan-pinch) and
  [property reference](https://bettertyped.github.io/react-zoom-pan-pinch/?path=/story/docs-props--page)

At plan time, `react-zoom-pan-pinch` is `4.0.3` with wildcard React and React DOM peer ranges. Verify
again at implementation time and keep it behind a local viewport adapter.

## Slice 0 — Lock the Behavior Contract

### Files

- Create `features/@scene-map/scene-map.feature`
- Create `features/@scene-map/scene-map.steps.ts`

### Work

Write the feature before implementation. Cover these behaviors in product language:

1. A campaign GM creates a scene and attaches a map.
2. An event is placed, moved, and retains its normalized position after reload.
3. An NPC or lore target cannot be placed twice in the same scene but can be placed in another
   scene.
4. A target from another campaign is rejected as not found.
5. Replacing a map preserves existing normalized peg positions.
6. Deleting a target removes its pegs without deleting the scene.
7. Deleting a scene removes its pegs without deleting its targets.
8. An event peg uses an arm/confirm step and produces one idempotent execution receipt.
9. Live and demo navigation expose Map in the same position.
10. The existing Play channel filter remains available under its new label.

Use a typed in-memory scene-map world for the first red test, following the current BDD style. The
world should exercise pure coordinate and state-transition helpers as they appear; it must not grow
into a second production implementation.

### Gate

```powershell
npm run test:bdd
```

Expected at the start: generation or scenarios fail because the map behavior does not exist. Confirm
the scenarios describe the agreed product behavior before continuing.

## Slice 1 — Add the Persistence Boundary

### Files

- Modify `packages/db/prisma/schema.prisma`
- Create `packages/db/prisma/migrations/<timestamp>_add_scene_maps/migration.sql`
- Create `apps/backend/src/__tests__/scene-persistence.db.test.ts`

### Prisma schema work

Add `Campaign.scenes` and these models/relations:

- `Scene`
  - `id`, `name`, `campaignId`, `createdAt`, `updatedAt`
  - campaign relation with `onDelete: Cascade`
  - `mapAsset UploadAsset?` using a named one-to-one relation
  - `pegs ScenePeg[]`
  - indexes for campaign list ordering
- `UploadAsset`
  - nullable, unique `sceneId`
  - named optional relation to Scene with `onDelete: Cascade`
  - index `sceneId`
- `ScenePeg`
  - `id`, `sceneId`, optional `eventId`, optional `npcId`, optional `loreEntryId`
  - `x`, `y`, `createdAt`, `updatedAt`
  - cascade relation to Scene and to each optional target
  - unique indexes for `(sceneId, eventId)`, `(sceneId, npcId)`, and
    `(sceneId, loreEntryId)`

Add inverse peg collections to `Event`, `Npc`, and `LoreEntry`.

Use the migration SQL for constraints Prisma Schema Language cannot represent:

- upload assets cannot have both `eventId` and `sceneId`;
- exactly one peg target foreign key is non-null;
- `x BETWEEN 0 AND 1` and `y BETWEEN 0 AND 1`.

Give every raw constraint a stable, descriptive name so database failures can be mapped and tested.
Do not add system-specific columns or JSON snapshots.

### Database integration test

Follow the current opt-in convention:

```ts
const runDatabaseIntegrationTests =
  process.env.CONSTANCIA_ENABLE_DB_TESTS === 'true' &&
  typeof process.env.DATABASE_URL === 'string';
```

Test directly against Prisma that:

- one target kind succeeds;
- no target and multiple targets fail;
- out-of-range coordinates fail;
- duplicate target in the same scene fails;
- the same target in another scene succeeds;
- deleting an event/NPC/lore entry deletes its pegs;
- deleting a Scene deletes pegs and the attached upload row;
- an UploadAsset cannot be attached to both an Event and a Scene.

Use a unique test campaign/guild/user namespace and clean only those seeded records. Do not broaden
cleanup to unrelated database rows.

### Commands

```powershell
npm --workspace packages/db run db:migrate -- --name add_scene_maps
npm --workspace packages/db run db:generate
npm --workspace packages/db run typecheck
$env:CONSTANCIA_ENABLE_DB_TESTS='true'; npm --workspace apps/backend run test -- scene-persistence.db.test.ts
```

The database-backed command is an explicit environment gate. If no PostgreSQL test database is
available, keep the test skipped and record that the migration still requires execution in a real
PostgreSQL environment before release.

### Slice acceptance

- Prisma Client exposes Scene and ScenePeg types.
- The migration is additive and deployable before application code.
- Database constraints reject every invalid polymorphic or coordinate state.

## Slice 2 — Build Campaign-scoped Scene and Asset Services

### Files

- Modify `apps/backend/src/services/campaign-access.ts`
- Modify `apps/backend/src/__tests__/campaign-access.test.ts`
- Modify `apps/backend/src/services/upload-assets.ts`
- Modify `apps/backend/src/__tests__/upload-assets.test.ts`
- Create `apps/backend/src/services/scene-service.ts`
- Create `apps/backend/src/services/scene-map-assets.ts`
- Create `apps/backend/src/__tests__/scene-service.test.ts`
- Create `apps/backend/src/__tests__/scene-map-assets.test.ts`

### Campaign access

Extend `CampaignAccessPrisma` and `CampaignResourceRef` with:

- direct `lore`, `scene` resources queried by `{ id, campaignId }`;
- a nested `scene-peg` resource queried by peg ID, scene ID, and `scene.campaignId`.

Update the existing typed Prisma mock and assertions. A missing record and a cross-campaign record
must continue to produce the same `CampaignResourceNotFoundError`, avoiding identifier disclosure.

### Scene service

Keep route handlers thin. The service should own:

- scene list and hydrated detail queries;
- creation and rename normalization;
- typed peg creation and target verification;
- coordinate updates;
- duplicate-target error translation;
- response mapping into explicit `SceneSummaryView`, `SceneView`, and discriminated
  `ScenePegView` types.

The service receives a branded `CampaignScope`; it does not accept an unscoped campaign ID as proof
of authorization. It may use `createCampaignAccess(prisma).requireResource` for target checks.

Use `buildUploadAssetUrl(config, assetId)` (exported from
`apps/backend/src/services/upload-storage.ts`) when returning `mapUrl`. Do not make the frontend
infer a storage key or use `publicUrl` as an authorization mechanism.

### Upload and scene-map asset services

Extract small generic helpers from `upload-assets.ts` rather than duplicating event ownership logic:

- assert that an asset belongs to `userId` and is unlinked;
- allow idempotent attachment when it is already linked to the same owner resource;
- delete an owned unlinked asset's storage object and row;
- delete storage records by explicit typed metadata.

`scene-map-assets.ts` owns:

- verifying `request.access.kind === 'session'` and using its internal `userId`;
- attaching an unlinked/current-scene asset;
- replacing a scene map without exposing an intermediate invalid database state;
- detaching a map;
- scene-delete preparation and cleanup;
- structured cleanup-failure logging.

Database ownership changes must complete before best-effort cleanup of a replaced/removed object. If
cleanup fails, leave the old asset row unlinked and log enough context for repair. Do not report that
the old map is still attached after it has been successfully detached.

### Tests

Unit tests must prove:

- Discord user IDs are never used as UploadAsset ownership IDs;
- another Better Auth user cannot attach or delete an asset;
- an event-owned asset cannot become a scene map;
- an asset already attached to the same scene is idempotent;
- replacement detaches the old asset before cleanup;
- cleanup failure leaves the new visible ownership intact and logs the old asset ID;
- each peg kind maps to the correct target field and view discriminator;
- duplicate-target Prisma errors become a typed 409-capable service error;
- no response mapper emits nullable-target ambiguity.

### Commands

```powershell
npm --workspace apps/backend run test -- campaign-access.test.ts upload-assets.test.ts scene-service.test.ts scene-map-assets.test.ts
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run lint
```

### Slice acceptance

- Persistence and asset lifecycle are usable without Fastify request objects.
- All service inputs and outputs are explicit and contain no `any`.
- Cross-campaign and cross-user access has focused test coverage.

## Slice 3 — Publish the Fastify API and OpenAPI Contract

### Files

- Modify `apps/backend/src/schemas.ts`
- Create `apps/backend/src/routes/scene-routes.ts`
- Modify `apps/backend/src/routes/upload-routes.ts`
- Modify `apps/backend/src/routes/api-routes.ts`
- Modify `apps/backend/src/http-responses.ts` only if a reusable P2002 detector is required
- Create `apps/backend/src/__tests__/scene-routes.test.ts`
- Modify `apps/backend/src/__tests__/upload-route.test.ts`
- Modify `apps/backend/src/__tests__/app.test.ts`

### JSON Schemas

Add catalogue constants for:

- campaign/scene/peg path params;
- scene create and patch bodies;
- set-map body `{ assetId }`;
- peg create body with a `oneOf` discriminated by `kind`;
- peg coordinate patch body;
- Scene summary, typed peg, target preview, and Scene detail responses.

Use the repository's plain JSON Schema conventions, including `additionalProperties: false`, UUID or
ID constraints matching current IDs, `minLength`/`maxLength`, and coordinate `minimum`/`maximum`.
Wrap responses with the existing `singleResponseSchema`, `listResponseSchema`, and delete schema.

### Scene routes

Implement these operation IDs exactly:

- `listScenes`
- `createScene`
- `getScene`
- `updateScene`
- `deleteScene`
- `setSceneMap`
- `deleteSceneMap`
- `createScenePeg`
- `updateScenePeg`
- `deleteScenePeg`

Register `sceneRoutes` under `/campaigns/:id/scenes` inside the existing `campaignAdminScope` after
`campaignAdminScopePlugin`. Every route uses `request.campaignScope`; do not repeat manual admin
queries in handlers.

Use existing response conventions:

- `reply.code(201); return ok(view)` for creates;
- `return ok(view)` for reads/updates;
- `return deleted(true)` for deletes.

Map service errors to consistent handled request errors. Return 404 for an out-of-scope scene, peg,
or target and 409 for a duplicate target. Do not leak whether the ID exists in another campaign.

### Protected unlinked-upload deletion

Add `DELETE /uploads/:assetId` with operation ID `deleteUnlinkedUpload` to
`uploadProtectedRoutes`. It may delete only an asset whose `userId` matches the session and whose
`eventId` and `sceneId` are both null. A linked or foreign asset returns a safe validation/not-found
response and remains untouched.

### Tests

Use Fastify injection with hoisted Prisma/service mocks, following `upload-route.test.ts`, to cover:

- schema rejection before a handler sees malformed coordinates or kinds;
- all scene routes inherit a campaign scope;
- status/envelope behavior;
- duplicate peg 409;
- set-map requires an internal session user;
- unlinked upload deletion rejects a linked or foreign asset;
- operation IDs and paths appear in OpenAPI.

The exact-path assertion in `app.test.ts` must be deliberately updated; do not weaken it to a partial
snapshot just to accommodate new routes.

### Commands

```powershell
npm --workspace apps/backend run test -- scene-routes.test.ts upload-route.test.ts app.test.ts
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run lint
```

### Slice acceptance

- All scene endpoints are protected by the existing session and campaign-admin scopes.
- Malformed requests receive Fastify 4xx responses from the published schemas.
- OpenAPI exposes the intended operation IDs and typed discriminated peg response.

## Slice 4 — Regenerate the API Client

### Generated files

- Modify `apps/backend/openapi/openapi.json` through the writer command
- Regenerate `packages/api-client/src/generated/endpoints/scenes/**`
- Regenerate relevant models under `packages/api-client/src/generated/model/**`
- Regenerate upload endpoint/model files affected by `deleteUnlinkedUpload`

### Work

Generate from the live Fastify schema. Never patch generated endpoints or models by hand.

Inspect the generated output before frontend work:

- scene endpoint functions use named path parameters `id`, `sceneId`, and `pegId`;
- create-peg input and response remain discriminated, not widened to `object` or `unknown`;
- coordinates are numbers;
- map attachment uses `assetId`, matching the existing upload response;
- delete responses use the repository's standard delete envelope.

If Orval loses useful discrimination, improve the backend JSON Schema and regenerate. Do not repair
the loss with browser casts.

### Commands

```powershell
npm --workspace apps/backend run openapi:write
npm run generate:api
npm --workspace packages/api-client run typecheck
npm --workspace packages/api-client run lint
```

### Slice acceptance

- Generated fetch and Zod clients contain the new operations.
- No generated file has a manual edit.
- Bot and frontend client builds continue to compile against the regenerated model set.

## Slice 5 — Establish the Map Route and Projection Boundary

### Files

- Modify `apps/frontend/app/routes.ts`
- Modify `apps/frontend/app/components/war-room/war-room-navigation.ts`
- Modify `apps/frontend/app/routes/war-room-layout.tsx`
- Modify `apps/frontend/app/routes/demo-layout.tsx`
- Modify `apps/frontend/app/components/war-room/scene-rail-extras.tsx`
- Create `apps/frontend/app/lib/map-workspace-projection.ts`
- Create `apps/frontend/app/lib/live-map-workspace-projection.server.ts`
- Create `apps/frontend/app/lib/demo-map-workspace-projection.ts`
- Create `apps/frontend/app/lib/demo-map-data.ts`
- Create `apps/frontend/app/routes/map.tsx`
- Create `apps/frontend/app/components/maps/map-workspace.tsx`
- Create `apps/frontend/app/components/maps/scene-index.tsx`
- Create `apps/frontend/app/components/maps/scene-form.tsx`

### Routing and navigation

Add explicit route-config entries:

```ts
route('demo/map', './routes/map.tsx', { id: 'demo-map' })
route('map', './routes/map.tsx')
```

Add Map immediately after Play in `sharedModeDefinitions`, preserving shared live/demo ordering.
Change all Play human-visible scene terminology to channel terminology without renaming or replacing
its channel-derived data in this slice. The current strings live in
`apps/frontend/app/components/war-room/scene-rail-extras.tsx` (“Active scene,” “All scenes,”
“…across N scenes,” “Choose a scene to narrow the board and timeline.”) and in
`apps/frontend/app/routes/play.tsx` (the “This scene does not have a ready trigger yet…” empty
state). There is no existing literal “Scene Filter” string; the rename targets these actual labels.
Internal component names can remain to keep the change focused.

### Projection

Define a browser-safe `MapWorkspaceProjection` containing:

- campaign ID;
- scene summaries;
- selected Scene detail or null;
- event, NPC, and lore candidates shaped for the picker;
- API availability/error state;
- demo mode.

The live server adapter:

1. resolves the current campaign with `resolveCurrentCampaignId(request)`;
2. lists Scenes;
3. selects the requested `?scene=` only if returned by that campaign;
4. loads the selected detail plus events, NPCs, and lore using generated clients and one forwarded
   cookie options object;
5. maps generated API models into the browser-safe projection.

Keep all generated-client value imports in this `*.server.ts` adapter or the route module. Do not add
map data to global `WarRoomContext` or `WarRoomProjection` unless a later navigation requirement
actually needs it.

The demo adapter returns the same projection type from deterministic data and makes no API call.

### Route shell and forms

The map route loader branches on `/demo/` in the same manner as current shared routes. The live
loader calls the server projection adapter; the demo loader returns the demo projection.

Start with route action intents for scene create, rename, and delete. Validate scene forms with React
Hook Form and a Zod schema. On create, redirect or navigate to `?scene=<newId>`. On delete, select the
next remaining scene. Keep pending, success, and error messages adjacent to the relevant controls.

The first component pass implements only:

- scene index;
- selected scene heading;
- no-scene and no-map states;
- create/rename/delete behavior;
- inspector/canvas placeholders with correct responsive layout regions.

Do not introduce pan/zoom or peg complexity until this boundary is working.

### Tests

Extend BDD coverage for shared navigation ordering and scene selection rules. Add pure projection
tests to the BDD step file if they can import the adapter-independent mapper without a browser.

### Commands

```powershell
npm run test:bdd
npm --workspace apps/frontend run typecheck
npm --workspace apps/frontend run lint
npm --workspace apps/frontend run build
```

### Boundary audit

```powershell
rg -n "@constancia/api-client" apps/frontend/app
```

Every value import found must be in a route module or an unmistakably server-only helper. Type-only
imports are allowed but projection types are preferred at the component boundary.

### Slice acceptance

- `/map` and `/demo/map` render the same core workspace states.
- Live data comes through the frontend server.
- Scene CRUD revalidates the loader and remains reload-safe through the query string.
- Existing Play channel filtering is unchanged apart from its label.

## Slice 6 — Make Map Upload a Composed Server Action

### Files

- Modify `apps/frontend/app/lib/upload-image-action.server.ts`
- Modify `apps/frontend/app/routes/map.tsx`
- Create `apps/frontend/app/components/maps/scene-map-form.tsx`
- Modify `apps/frontend/app/components/maps/map-workspace.tsx`

### Server helper refactor

Refactor the current upload action helper into a composable typed function plus its existing Response
wrapper. Existing callers must keep working.

The composable helper should:

- validate the `File` boundary;
- call generated `uploadImage` with forwarded cookie options;
- return typed upload data including `assetId`, `url`, `mimeType`, `sizeBytes`, and quota;
- normalize API failures once.

### Map action

Implement `replace-scene-map` as one frontend form submission:

1. Resolve/validate campaign and scene IDs on the frontend server.
2. Upload the image.
3. Call `setSceneMap` with the returned `assetId`.
4. If attachment fails, call `deleteUnlinkedUpload` with that asset ID as compensation.
5. Return the original attachment failure, adding a server log if compensation also fails.
6. On success, let React Router revalidate the map loader.

Implement `delete-scene-map` through the dedicated backend operation.

Use a React Hook Form file form. Do not use `ImageUploadField` as a staged independent upload because
the map must upload and attach as one user operation. Show quota warnings returned by the upload.

Warn that replacement/removal keeps peg coordinates. Do not remove pegs automatically.

### Tests

- upload succeeds + attach succeeds;
- upload succeeds + attach fails + compensation succeeds;
- upload succeeds + attach fails + compensation fails and logs both IDs/operations;
- invalid/no file never calls the backend;
- remove map preserves scene and peg data in the next projection.

Tests for the composable server helper can use generated-client mocks; interaction scenarios remain in
BDD.

### Commands

```powershell
npm run test:bdd
npm --workspace apps/frontend run typecheck
npm --workspace apps/frontend run lint
npm --workspace apps/frontend run build
```

### Slice acceptance

- A map replacement is one user-visible action.
- Failed attachment does not silently leave an owned unlinked upload.
- Map removal/replacement does not destroy peg positions.

## Slice 7 — Add the Viewport and Peg Editing

### Files

- Modify `apps/frontend/package.json` and root `package-lock.json`
- Create `apps/frontend/app/components/maps/map-viewport.tsx`
- Create `apps/frontend/app/components/maps/scene-peg-button.tsx`
- Create `apps/frontend/app/components/maps/map-inspector.tsx`
- Create `apps/frontend/app/components/maps/map-candidate-picker.tsx`
- Create `apps/frontend/app/lib/map-coordinates.ts`
- Modify `apps/frontend/app/routes/map.tsx`
- Modify `apps/frontend/app/components/maps/map-workspace.tsx`
- Modify `apps/frontend/app/app.css`
- Extend `features/@scene-map/scene-map.steps.ts`

### Dependency spike

Before committing the dependency, build a narrow `MapViewport` spike using the current
`react-zoom-pan-pinch` version. Verify:

- React 19 build and hydration;
- mouse wheel zoom and touch pinch;
- pan does not start when a peg drag starts;
- the transformed image's bounding rectangle remains usable for coordinate conversion;
- reset/zoom controls work without gesture input;
- reduced-motion mode does not animate transforms;
- no console warnings under Strict Mode.

If the spike fails, keep the same `MapViewport` public interface and implement a minimal local
CSS-transform camera. Do not leak third-party types into route projection or peg components.

Install only after the spike passes:

```powershell
npm install react-zoom-pan-pinch@^4.0.3 --workspace apps/frontend
```

### Coordinate helper

Keep coordinate math pure and typed:

- normalize a client point against the rendered image rectangle;
- clamp to `[0, 1]`;
- convert normalized values to percentage positioning;
- nudge by 0.01 or 0.05 and clamp;
- never use the outer canvas or natural pixel size as the stored coordinate space.

Exercise these helpers from BDD steps, including corners, a transformed rectangle, out-of-bounds
clamping, and keyboard nudges.

### Placement and drag

Implement route action intents:

- `create-scene-peg` with kind, target ID, and coordinates;
- `move-scene-peg` with peg ID and coordinates;
- `delete-scene-peg` with peg ID.

The picker marks already placed candidates. Choosing a candidate enters placement mode; the next map
click posts a peg create. Escape cancels. Duplicate-target 409 errors select the existing peg instead
of leaving the UI in a broken placement state.

Drag behavior:

- peg pointer-down captures the pointer and prevents viewport pan;
- local position follows the pointer;
- pointer-up posts one move action;
- action failure restores the last loader position and announces a retry message;
- revalidation becomes the final source of truth.

Add keyboard movement and a synchronized non-spatial peg list in the inspector. A user must be able
to select, nudge, inspect, and delete a peg without precise pointer placement.

### Styling

Use tonal surfaces and typography from `DESIGN.md`. Peg type needs an icon/label/shape, not only
color. Do not reuse event pipeline colors as generic peg category colors. Respect the 44px target,
860px stack breakpoint, and reduced-motion rules.

### Commands

```powershell
npm run test:bdd
npm --workspace apps/frontend run typecheck
npm --workspace apps/frontend run lint
npm --workspace apps/frontend run build
```

### Slice acceptance

- Pegs remain aligned through zoom, pan, resize, reload, and map replacement.
- Pointer and keyboard editing both work.
- A failed move visibly rolls back.
- The viewport dependency is isolated behind one local component.

## Slice 8 — Reuse Event Execution and Add Target Inspection

### Files

- Create `apps/frontend/app/lib/fire-event-action.server.ts`
- Modify `apps/frontend/app/routes/play.tsx`
- Modify `apps/frontend/app/routes/map.tsx`
- Modify `apps/frontend/app/components/maps/map-inspector.tsx`
- Modify `apps/frontend/app/routes/npcs.tsx`
- Modify `apps/frontend/app/routes/lore.tsx`
- Extend `features/@scene-map/scene-map.feature`
- Extend `features/@scene-map/scene-map.steps.ts`

### Shared event action

Extract the existing Play event-fire action logic into a server-only helper that accepts:

- request/API options;
- campaign ID;
- event ID;
- idempotency key;
- user-facing context strings where Map and Play wording differs.

The helper calls the existing generated `fireEvent`, preserves the `idempotency-key` header, validates
the execution receipt, and maps it to the current `FireReceiptView`. Refactor Play to use it before
calling it from Map; behavior and error wording on Play must remain covered by existing BDD tests.

Do not add a second backend fire route or execute a pipeline from frontend code.

### Inspector behavior

- Event peg: preview, inline Arm button, inline Confirm fire button, cancel, pending state, and receipt.
- NPC peg: compact image/name/description and a link to `/npcs?npc=<id>` or
  `/demo/npcs?npc=<id>`.
- Lore peg: compact title/content and a link to `/lore?lore=<id>` or
  `/demo/lore?lore=<id>`.

Teach NPC and Lore routes to honor those query parameters as initial selection. Do not duplicate
reveal/access forms inside Map.

Create idempotency keys in the browser per armed attempt and retain the same key when retrying an
ambiguous failed response. A newly armed attempt gets a new key.

### Tests

- one armed attempt produces one execution even after an ambiguous retry;
- cancel does not call the action;
- a fired receipt shows execution and delivery status;
- Play's current fire behavior remains unchanged after extraction;
- NPC and lore deep links select the intended record in both live and demo routes.

### Commands

```powershell
npm run test:bdd
npm --workspace apps/frontend run typecheck
npm --workspace apps/frontend run lint
npm --workspace apps/frontend run build
npm --workspace apps/backend run test -- event-execution.test.ts
```

### Slice acceptance

- Map and Play share one server-side event-fire translation.
- Event execution remains backend-owned and idempotent.
- NPC/lore access management remains in its existing workspace.

## Slice 9 — Complete Demo, Accessibility, and Failure States

### Files

- Modify `apps/frontend/app/lib/demo-map-data.ts`
- Modify `apps/frontend/app/lib/demo-map-workspace-projection.ts`
- Modify map components and `apps/frontend/app/app.css`
- Modify `DESIGN.md` only if the finished Map workspace establishes a reusable product-workbench
  rule that is not already discoverable from code

### Demo parity

Use the same map components with a small typed command adapter:

- live commands submit route actions;
- demo commands update local demo scene state;
- both expose identical pending/success/error shapes to components.

Seed at least:

- one mapped scene with all three peg kinds;
- one scene without a map;
- an event ready to arm;
- enough candidates to exercise search and already-placed states.

Demo is deterministic per page session and must not call upload or scene APIs.

### Accessibility pass

- meaningful map alt text based on scene name;
- peg button names include kind and target name;
- logical focus order between scene index, map controls, canvas pegs, and inspector;
- focus recovery after deletion;
- live regions adjacent to actions;
- keyboard nudge and non-spatial peg list;
- controls usable at 200% zoom;
- reduced-motion behavior;
- no state communicated by color alone.

### Failure and empty states

Cover:

- API unavailable versus no scenes;
- selected scene deleted in another request;
- target removed between projection and placement;
- map upload disabled or quota exceeded;
- storage attachment/cleanup failure;
- event execution pending, delivered, or failed;
- invalid selection query;
- no candidates for one or all peg kinds.

### Responsive and visual pass

Verify desktop three-region composition and the sub-860px stacked layout. Ensure the map image itself
is the coordinate frame, no inspector causes horizontal overflow, and no action dock overlays the
canvas or editable controls.

### Commands

```powershell
npm run test:bdd
npx react-doctor@latest .
npm --workspace apps/frontend run typecheck
npm --workspace apps/frontend run lint
npm --workspace apps/frontend run build
```

Run a real browser smoke pass on `/demo/map` first, then `/map` with a test campaign and upload-enabled
user. Capture console errors and network failures; do not treat a static screenshot as interaction
verification.

### Slice acceptance

- Live and demo share the same mental model and interaction components.
- Map is usable by keyboard and at narrow widths.
- Every failure preserves enough state to retry safely.
- React Doctor introduces no unreviewed automated changes; findings are fixed or explicitly recorded.

## Slice 10 — Final Contract and Repository Verification

### Static boundary audits

```powershell
rg -n "@constancia/api-client" apps/frontend/app
rg -n "@constancia/db" apps packages --glob "!packages/db/**"
rg -n "\bany\b" apps/backend/src apps/frontend/app packages/db/prisma
rg -n "Active scene|All scenes|across .* scenes|Choose a scene|This scene" apps/frontend/app/routes/play.tsx apps/frontend/app/components/war-room
git diff --check
```

Review each result rather than assuming an empty result is always required:

- generated-client value imports are permitted in route modules and `*.server.ts` helpers;
- only the backend may import the DB package;
- `any` must not appear in authored feature code;
- the Play scene-terminology grep must return no user-facing hits — those strings were renamed to
  channel terminology in Slice 5 (internal identifiers like `sceneLabel` may remain);
- “Scene” may still appear correctly for the Map domain and `ChannelType.scene`.

### Full commands

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:bdd
npm run check:block-drift
npm run build
npx react-doctor@latest .
git diff --check
```

If a PostgreSQL test database is available, also run:

```powershell
$env:CONSTANCIA_ENABLE_DB_TESTS='true'; npm --workspace apps/backend run test
```

### Manual acceptance pass

1. Create two scenes with similar names and confirm IDs, selection, and reload behavior are stable.
2. Upload a map, place all three peg kinds, zoom/pan, move them, reload, and compare positions.
3. Replace the map and confirm peg coordinates remain.
4. Attempt a duplicate peg and a cross-campaign target.
5. Fire an event, simulate/retry an ambiguous response, and verify one execution.
6. Delete a target and confirm its peg disappears.
7. Remove a map and confirm pegs remain stored; attach another map and confirm they return.
8. Delete a scene and confirm its targets remain.
9. Repeat core flows with keyboard controls and a narrow viewport.
10. Confirm demo Map mirrors navigation, empty, mapped, placement, and armed-event states.
11. Confirm Play still filters by channels, now labeled with channel terminology rather than scene
    terminology.
12. Inspect upload quota/records after failed attachment compensation and map replacement.

### Documentation closeout

Update the current-state sections of `AGENTS.md` only after the feature exists. At that point record:

- persistent scene/map backend routes are present;
- generated scene clients are current;
- frontend Map workspace is implemented;
- bot still has no map commands unless a separate approved feature changes that.

Do not edit historical plans to pretend the feature was always present. This plan and its source spec
are the implementation record.

## Deployment and Rollback

Deploy in this order:

1. Apply the additive Prisma migration.
2. Deploy backend scene/upload endpoints and OpenAPI contract.
3. Deploy regenerated client packages and frontend Map route.

The additive schema may remain if application rollback is required. Roll back frontend navigation
first, then backend code; do not destructively drop Scene tables during an operational rollback.

Before release, verify upload-enabled GM accounts and quota configuration in the target environment.
Monitor structured logs for scene-map cleanup failures, duplicate peg conflicts, and failed upload
compensation. A cleanup reconciliation job is not part of this feature, but unlinked asset rows must
retain enough metadata for one to be added safely.

## Definition of Done

- The database constraints, service tests, route tests, OpenAPI tests, BDD scenarios, and manual map
  interactions all pass.
- Scene/map state survives reload and responsive/zoom transformations.
- Event firing reuses the current reliable execution path.
- Upload ownership uses Better Auth user IDs and campaign authorization uses `CampaignScope`.
- Generated client contracts are current and browser boundaries are clean.
- Live/demo navigation and core states match.
- Existing Play filtering, bot behavior, block pipelines, and game systems are unchanged.
- Full repository gates and React Doctor are green, with any environmental database skip explicitly
  recorded.
