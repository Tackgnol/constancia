import { expect } from '@playwright/test';
import { createBdd, test as base } from 'playwright-bdd';
import { buildWarRoomModeTabs } from '../../apps/frontend/app/components/war-room/war-room-navigation.js';
import {
  arrowKeyDelta,
  normalizePointInRect,
  nudgePoint,
  type NormalizedPoint,
  type RenderedRect,
} from '../../apps/frontend/app/lib/map-coordinates.js';
import { toFireReceiptView } from '../../apps/frontend/app/lib/fire-event-receipt.js';
import {
  buildTargetWorkspacePath,
  nextSceneAfterRemoval,
  selectSceneId,
  type SceneSummaryProjection,
} from '../../apps/frontend/app/lib/map-workspace-projection.js';

/**
 * Scene, map, and peg persistence rules - duplicate-target rejection, cross-campaign rejection,
 * cascade-delete semantics, coordinate range checks, and the upload/attach/compensate flow - now
 * run for real against Prisma models and backend services and are covered there:
 * `apps/backend/src/__tests__/scene-service.test.ts`, `scene-routes.test.ts`,
 * `scene-persistence.db.test.ts`, and `scene-map-assets.test.ts`. Event arm/confirm idempotency is
 * covered by `apps/backend/src/__tests__/event-execution.test.ts`. This file keeps only the
 * scenarios that exercise real, shared frontend modules directly, so a fixture World is not needed
 * beyond the small amount of state those modules' inputs and outputs require.
 */
class SceneMapWorld {
  readonly campaignIds = new Map<string, string>();
  activeCampaignId = '';

  // Navigation ordering reads the real shared tab builder, so this scenario fails if live and
  // demo ever drift apart.
  readonly liveNavOrder = buildWarRoomModeTabs('').map((tab) => tab.label);
  readonly demoNavOrder = buildWarRoomModeTabs('/demo').map((tab) => tab.label);

  // The rendered image box already includes pan and zoom, so the same helpers cover both cameras.
  renderedRect: RenderedRect = { left: 0, top: 0, width: 0, height: 0 };
  placementPoint: NormalizedPoint = { x: 0, y: 0 };
  keyboardPoint: NormalizedPoint = { x: 0, y: 0 };

  /** Mirrors the Map route's scene index; selection rules come from the real projection helpers. */
  sceneIndex: SceneSummaryProjection[] = [];
  selectedSceneId: string | null = null;

  campaign(name: string): string {
    const existing = this.campaignIds.get(name);
    if (existing) return existing;
    const id = `campaign-${this.campaignIds.size + 1}`;
    this.campaignIds.set(name, id);
    return id;
  }
}

export const test = base.extend<{ world: SceneMapWorld }>({
  world: async ({ playwright }, use) => {
    void playwright;
    await use(new SceneMapWorld());
  },
});
const { Given, When, Then } = createBdd(test, { worldFixture: 'world' });

Given('a game master administers the campaign {string}', function (name: string) {
  this.activeCampaignId = this.campaign(name);
});

Then('Map and Play use the same event fire translation', function () {
  // Both routes call the shared helper, so one raw receipt yields one view for either wording.
  const raw = {
    id: 'execution-1',
    eventId: 'event-1',
    status: 'completed',
    deliveries: [{ status: 'delivered' }, { status: 'pending' }],
  };

  expect(toFireReceiptView(raw)).toEqual({
    eventId: 'event-1',
    executionId: 'execution-1',
    executionStatus: 'completed',
    deliveryStatus: 'pending',
  });
  expect(toFireReceiptView({ ...raw, deliveries: 'not-an-array' })).toBeNull();
});

Then(
  'an NPC peg links to {string} live and {string} in demo',
  function (live: string, demo: string) {
    expect(buildTargetWorkspacePath('npc', 'npc-1', false)).toBe(live);
    expect(buildTargetWorkspacePath('npc', 'npc-1', true)).toBe(demo);
  },
);

Then(
  'a lore peg links to {string} live and {string} in demo',
  function (live: string, demo: string) {
    expect(buildTargetWorkspacePath('lore', 'lore-1', false)).toBe(live);
    expect(buildTargetWorkspacePath('lore', 'lore-1', true)).toBe(demo);
  },
);

Then('Map appears in the same position immediately after Play in both', function () {
  const liveIndex = this.liveNavOrder.indexOf('Map');
  const demoIndex = this.demoNavOrder.indexOf('Map');
  expect(liveIndex).toBeGreaterThan(-1);
  expect(liveIndex).toBe(demoIndex);
  expect(this.liveNavOrder[liveIndex - 1]).toBe('Play');
  expect(this.demoNavOrder[demoIndex - 1]).toBe('Play');
});

Given(
  'the map image is rendered at {int} by {int} starting at {int}, {int}',
  function (width: number, height: number, left: number, top: number) {
    this.renderedRect = { left, top, width, height };
  },
);

When('the game master clicks the map at {int}, {int}', function (clientX: number, clientY: number) {
  this.placementPoint = normalizePointInRect(clientX, clientY, this.renderedRect);
});

Then('the placement point is \\({float}, {float}\\)', function (x: number, y: number) {
  expect(this.placementPoint.x).toBeCloseTo(x, 5);
  expect(this.placementPoint.y).toBeCloseTo(y, 5);
});

Given('a peg sits at \\({float}, {float}\\)', function (x: number, y: number) {
  this.keyboardPoint = { x, y };
});

When('the game master presses {string} {int} times', function (key: string, times: number) {
  for (let index = 0; index < times; index += 1) {
    const delta = arrowKeyDelta(key, false);
    expect(delta).not.toBeNull();
    this.keyboardPoint = nudgePoint(this.keyboardPoint, delta?.deltaX ?? 0, delta?.deltaY ?? 0);
  }
});

When(
  'the game master presses {string} with shift {int} times',
  function (key: string, times: number) {
    for (let index = 0; index < times; index += 1) {
      const delta = arrowKeyDelta(key, true);
      expect(delta).not.toBeNull();
      this.keyboardPoint = nudgePoint(this.keyboardPoint, delta?.deltaX ?? 0, delta?.deltaY ?? 0);
    }
  },
);

Then('the peg sits at \\({float}, {float}\\)', function (x: number, y: number) {
  expect(this.keyboardPoint.x).toBeCloseTo(x, 5);
  expect(this.keyboardPoint.y).toBeCloseTo(y, 5);
});

Given('the campaign has the scenes {string}', function (names: string) {
  this.sceneIndex = names.split(', ').map((name, index) => ({
    id: `scene-${index + 1}`,
    name,
    hasMap: false,
    pegCount: 0,
  }));
});

When('the map workspace opens with the scene query {string}', function (requested: string) {
  this.selectedSceneId = selectSceneId(this.sceneIndex, requested.length === 0 ? null : requested);
});

When('the game master removes the scene named {string} from the index', function (name: string) {
  const removed = this.sceneIndex.find((scene) => scene.name === name);
  expect(removed).toBeDefined();
  this.selectedSceneId = nextSceneAfterRemoval(this.sceneIndex, removed?.id ?? '');
  this.sceneIndex = this.sceneIndex.filter((scene) => scene.id !== removed?.id);
});

Then('the workspace selects the scene named {string}', function (name: string) {
  const selected = this.sceneIndex.find((scene) => scene.id === this.selectedSceneId);
  expect(selected?.name).toBe(name);
});

Then('the workspace selects no scene', function () {
  expect(this.selectedSceneId).toBeNull();
});
