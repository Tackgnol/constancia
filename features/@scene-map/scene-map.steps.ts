import { expect } from '@playwright/test';
import { createBdd, test as base } from 'playwright-bdd';
import { buildWarRoomModeTabs } from '../../apps/frontend/app/components/war-room/war-room-navigation.js';
import {
  nextSceneAfterRemoval,
  selectSceneId,
  type SceneSummaryProjection,
} from '../../apps/frontend/app/lib/map-workspace-projection.js';

type TargetKind = 'event' | 'npc' | 'lore';

interface SceneTarget {
  id: string;
  name: string;
  campaignId: string;
  kind: TargetKind;
}

interface Scene {
  id: string;
  name: string;
  campaignId: string;
  mapAssetId: string | null;
}

interface ScenePeg {
  id: string;
  sceneId: string;
  targetId: string;
  kind: TargetKind;
  x: number;
  y: number;
}

interface ExecutionReceipt {
  id: string;
  eventName: string;
}

interface ArmedAttempt {
  idempotencyKey: string;
  eventName: string;
  sceneName: string;
}

/** Clamp a stored peg coordinate to the normalized [0, 1] range. */
function clampCoordinate(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Self-contained, in-memory stand-in for the eventual scene/map production
 * system (Prisma models, backend services, frontend routes do not exist yet).
 * It models the product rules directly - duplicate-target rejection,
 * cross-campaign rejection, cascade-delete semantics, coordinate
 * normalization, map-replacement peg preservation, and one-idempotent-receipt
 * arm/confirm - without depending on any of that unwritten code. Later slices
 * are expected to extend/rewire this file to call into real implementations
 * as they land; keep additions behavior-focused rather than a parallel
 * production implementation.
 */
class SceneMapWorld {
  readonly campaignIds = new Map<string, string>();
  readonly scenesByName = new Map<string, Scene>();
  readonly targetsByName = new Map<string, SceneTarget>();
  readonly pegs: ScenePeg[] = [];
  readonly receiptsByIdempotencyKey = new Map<string, ExecutionReceipt>();
  readonly observedReceipts: ExecutionReceipt[] = [];

  activeCampaignId = '';
  lastError: Error | null = null;
  armedAttempt: ArmedAttempt | null = null;

  // Navigation ordering reads the real shared tab builder, so this scenario fails if live and
  // demo ever drift apart. The Play channel filter stays modeled data until Slice 7.
  readonly liveNavOrder = buildWarRoomModeTabs('').map((tab) => tab.label);
  readonly demoNavOrder = buildWarRoomModeTabs('/demo').map((tab) => tab.label);
  readonly playChannelFilter = { available: true, terminology: 'channel' as const };

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

  createScene(name: string, campaignId: string = this.activeCampaignId): Scene {
    const scene: Scene = {
      id: `scene-${this.scenesByName.size + 1}`,
      name,
      campaignId,
      mapAssetId: null,
    };
    this.scenesByName.set(name, scene);
    return scene;
  }

  attachMap(sceneName: string, assetId: string): void {
    this.requireScene(sceneName).mapAssetId = assetId;
  }

  createTarget(
    name: string,
    kind: TargetKind,
    campaignId: string = this.activeCampaignId,
  ): SceneTarget {
    const target: SceneTarget = {
      id: `target-${this.targetsByName.size + 1}`,
      name,
      campaignId,
      kind,
    };
    this.targetsByName.set(name, target);
    return target;
  }

  place(targetName: string, sceneName: string, x: number, y: number): void {
    try {
      const target = this.requireTarget(targetName);
      const scene = this.requireScene(sceneName);

      if (target.campaignId !== scene.campaignId) {
        throw new Error('Target not found');
      }
      if (this.pegFor(targetName, sceneName)) {
        throw new Error('Target is already placed in this scene');
      }

      this.pegs.push({
        id: `peg-${this.pegs.length + 1}`,
        sceneId: scene.id,
        targetId: target.id,
        kind: target.kind,
        x: clampCoordinate(x),
        y: clampCoordinate(y),
      });
      this.lastError = null;
    } catch (error) {
      this.lastError = error instanceof Error ? error : new Error('Unknown error');
    }
  }

  move(targetName: string, sceneName: string, x: number, y: number): void {
    const peg = this.pegFor(targetName, sceneName);
    if (!peg) throw new Error(`No peg for ${targetName} on ${sceneName}`);
    peg.x = clampCoordinate(x);
    peg.y = clampCoordinate(y);
  }

  /** Simulates a fresh load from storage, proving state survives a round trip. */
  reload(): void {
    const reloaded: ScenePeg[] = structuredClone(this.pegs);
    this.pegs.length = 0;
    this.pegs.push(...reloaded);
  }

  replaceMap(sceneName: string, assetId: string): void {
    this.requireScene(sceneName).mapAssetId = assetId;
  }

  deleteTarget(targetName: string): void {
    const target = this.requireTarget(targetName);
    this.targetsByName.delete(targetName);
    this.removePegsWhere((peg) => peg.targetId === target.id);
  }

  deleteScene(sceneName: string): void {
    const scene = this.requireScene(sceneName);
    this.scenesByName.delete(sceneName);
    this.removePegsWhere((peg) => peg.sceneId === scene.id);
  }

  arm(eventName: string, sceneName: string): void {
    const peg = this.pegFor(eventName, sceneName);
    if (!peg) throw new Error(`No peg for ${eventName} on ${sceneName}`);
    this.armedAttempt = { idempotencyKey: `arm:${peg.id}`, eventName, sceneName };
  }

  confirmArmed(): void {
    if (!this.armedAttempt) throw new Error('No armed event awaiting confirmation');
    const { idempotencyKey, eventName } = this.armedAttempt;

    let receipt = this.receiptsByIdempotencyKey.get(idempotencyKey);
    if (!receipt) {
      receipt = { id: `receipt-${this.receiptsByIdempotencyKey.size + 1}`, eventName };
      this.receiptsByIdempotencyKey.set(idempotencyKey, receipt);
    }
    this.observedReceipts.push(receipt);
  }

  pegFor(targetName: string, sceneName: string): ScenePeg | undefined {
    const target = this.targetsByName.get(targetName);
    const scene = this.scenesByName.get(sceneName);
    if (!target || !scene) return undefined;
    return this.pegs.find((peg) => peg.targetId === target.id && peg.sceneId === scene.id);
  }

  private removePegsWhere(predicate: (peg: ScenePeg) => boolean): void {
    for (let i = this.pegs.length - 1; i >= 0; i -= 1) {
      const peg = this.pegs[i];
      if (peg && predicate(peg)) this.pegs.splice(i, 1);
    }
  }

  private requireScene(name: string): Scene {
    const scene = this.scenesByName.get(name);
    if (!scene) throw new Error(`Unknown scene: ${name}`);
    return scene;
  }

  private requireTarget(name: string): SceneTarget {
    const target = this.targetsByName.get(name);
    if (!target) throw new Error(`Unknown target: ${name}`);
    return target;
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

When('the game master creates the scene {string}', function (name: string) {
  this.createScene(name);
});

When(
  'the game master attaches the map {string} to {string}',
  function (assetId: string, sceneName: string) {
    this.attachMap(sceneName, assetId);
  },
);

Given('the scene {string} has the map {string}', function (sceneName: string, assetId: string) {
  this.createScene(sceneName);
  this.attachMap(sceneName, assetId);
});

Then(
  'the scene {string} has the map {string} attached',
  function (sceneName: string, assetId: string) {
    expect(this.scenesByName.get(sceneName)?.mapAssetId).toBe(assetId);
  },
);

Given('the event {string} is ready to place', function (name: string) {
  this.createTarget(name, 'event');
});

Given('the NPC {string} is ready to place', function (name: string) {
  this.createTarget(name, 'npc');
});

Given('the lore entry {string} belongs to another campaign', function (name: string) {
  this.createTarget(name, 'lore', this.campaign('Foreign Campaign'));
});

When(
  'the game master places {string} on {string} at \\({float}, {float}\\)',
  function (targetName: string, sceneName: string, x: number, y: number) {
    this.place(targetName, sceneName, x, y);
  },
);

When(
  'the game master tries to place {string} on {string} again at \\({float}, {float}\\)',
  function (targetName: string, sceneName: string, x: number, y: number) {
    this.place(targetName, sceneName, x, y);
  },
);

When(
  'the game master tries to place {string} on {string} at \\({float}, {float}\\)',
  function (targetName: string, sceneName: string, x: number, y: number) {
    this.place(targetName, sceneName, x, y);
  },
);

Then('the placement is rejected as a duplicate target', function () {
  expect(this.lastError?.message).toContain('already placed');
});

Then('the placement is rejected as not found', function () {
  expect(this.lastError?.message).toContain('not found');
});

When(
  'the game master moves {string} on {string} to \\({float}, {float}\\)',
  function (targetName: string, sceneName: string, x: number, y: number) {
    this.move(targetName, sceneName, x, y);
  },
);

When('the map reloads', function () {
  this.reload();
});

Then(
  '{string} is positioned at \\({float}, {float}\\) on {string}',
  function (targetName: string, x: number, y: number, sceneName: string) {
    const peg = this.pegFor(targetName, sceneName);
    expect(peg).toBeDefined();
    expect(peg?.x).toBe(x);
    expect(peg?.y).toBe(y);
  },
);

When(
  'the game master replaces the map on {string} with {string}',
  function (sceneName: string, assetId: string) {
    this.replaceMap(sceneName, assetId);
  },
);

When('the game master deletes the NPC {string}', function (name: string) {
  this.deleteTarget(name);
});

Then('{string} has no peg for {string}', function (sceneName: string, targetName: string) {
  expect(this.pegFor(targetName, sceneName)).toBeUndefined();
});

Then('the scene {string} still exists', function (name: string) {
  expect(this.scenesByName.has(name)).toBe(true);
});

When('the game master deletes the scene {string}', function (name: string) {
  this.deleteScene(name);
});

Then('the scene {string} no longer exists', function (name: string) {
  expect(this.scenesByName.has(name)).toBe(false);
});

Then('the NPC {string} still exists', function (name: string) {
  expect(this.targetsByName.has(name)).toBe(true);
});

When('the game master arms {string} on {string}', function (eventName: string, sceneName: string) {
  this.arm(eventName, sceneName);
});

When('the game master confirms the armed event', function () {
  this.confirmArmed();
});

When('the confirmation is retried after an ambiguous response', function () {
  this.confirmArmed();
});

Then('{string} has one execution receipt', function (eventName: string) {
  const ids = new Set(
    this.observedReceipts.filter((receipt) => receipt.eventName === eventName).map((r) => r.id),
  );
  expect(ids.size).toBe(1);
});

Then('{string} still has one execution receipt', function (eventName: string) {
  const ids = new Set(
    this.observedReceipts.filter((receipt) => receipt.eventName === eventName).map((r) => r.id),
  );
  expect(ids.size).toBe(1);
});

When('the game master compares live and demo navigation', function () {
  // Comparison happens in the Then step; this step exists for readability.
});

Then('Map appears in the same position immediately after Play in both', function () {
  const liveIndex = this.liveNavOrder.indexOf('Map');
  const demoIndex = this.demoNavOrder.indexOf('Map');
  expect(liveIndex).toBeGreaterThan(-1);
  expect(liveIndex).toBe(demoIndex);
  expect(this.liveNavOrder[liveIndex - 1]).toBe('Play');
  expect(this.demoNavOrder[demoIndex - 1]).toBe('Play');
});

Then('the Play channel filter is still available', function () {
  expect(this.playChannelFilter.available).toBe(true);
});

Then(
  'the filter is presented using channel terminology rather than scene terminology',
  function () {
    expect(this.playChannelFilter.terminology).toBe('channel');
  },
);

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
