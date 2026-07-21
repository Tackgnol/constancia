import type { EventStatus } from '@constancia/contracts';
import type { BackendConfig } from '../config.js';
import {
  CampaignResourceNotFoundError,
  type CampaignAccess,
  type CampaignScope,
} from './campaign-access.js';
import { buildUploadAssetUrl } from './upload-storage.js';

export type ScenePegKind = 'event' | 'npc' | 'lore';

/**
 * Peg views are discriminated by kind so a response never carries three nullable target fields and
 * the reader never has to guess which one is meaningful.
 */
export type ScenePegView =
  | {
      id: string;
      kind: 'event';
      x: number;
      y: number;
      target: { id: string; name: string; status: EventStatus };
    }
  | {
      id: string;
      kind: 'npc';
      x: number;
      y: number;
      target: { id: string; name: string; imageUrl: string | null };
    }
  | { id: string; kind: 'lore'; x: number; y: number; target: { id: string; title: string } };

export interface SceneSummaryView {
  id: string;
  name: string;
  hasMap: boolean;
  pegCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SceneView {
  id: string;
  name: string;
  mapAssetId: string | null;
  mapUrl: string | null;
  pegs: ScenePegView[];
  createdAt: string;
  updatedAt: string;
}

export class SceneValidationError extends Error {
  readonly statusCode = 400;
  readonly code = 'SCENE_VALIDATION_FAILED';

  constructor(message: string) {
    super(message);
    this.name = 'SceneValidationError';
  }
}

export class ScenePegConflictError extends Error {
  readonly statusCode = 409;
  readonly code = 'SCENE_PEG_TARGET_ALREADY_PLACED';

  constructor(message = 'That target already has a peg in this scene.') {
    super(message);
    this.name = 'ScenePegConflictError';
  }
}

const sceneSummarySelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
  mapAsset: { select: { id: true } },
  _count: { select: { pegs: true } },
} as const;

const scenePegSelect = {
  id: true,
  x: true,
  y: true,
  event: { select: { id: true, name: true, status: true } },
  npc: { select: { id: true, name: true, imageUrl: true } },
  loreEntry: { select: { id: true, title: true } },
} as const;

const sceneDetailSelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
  mapAsset: { select: { id: true } },
  pegs: { select: scenePegSelect },
} as const;

interface SceneSummaryRow {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  mapAsset: { id: string } | null;
  _count: { pegs: number };
}

interface ScenePegRow {
  id: string;
  x: number;
  y: number;
  event: { id: string; name: string; status: EventStatus } | null;
  npc: { id: string; name: string; imageUrl: string | null } | null;
  loreEntry: { id: string; title: string } | null;
}

interface SceneDetailRow {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  mapAsset: { id: string } | null;
  pegs: ScenePegRow[];
}

export interface SceneServicePrisma {
  scene: {
    findMany(args: {
      where: { campaignId: string };
      orderBy: { createdAt: 'asc' };
      select: typeof sceneSummarySelect;
    }): Promise<SceneSummaryRow[]>;
    findFirst(args: {
      where: { id: string; campaignId: string };
      select: typeof sceneDetailSelect;
    }): Promise<SceneDetailRow | null>;
    create(args: {
      data: { name: string; campaignId: string };
      select: typeof sceneDetailSelect;
    }): Promise<SceneDetailRow>;
    update(args: {
      where: { id: string };
      data: { name: string };
      select: typeof sceneDetailSelect;
    }): Promise<SceneDetailRow>;
    delete(args: { where: { id: string } }): Promise<{ id: string }>;
  };
  scenePeg: {
    create(args: {
      data: {
        sceneId: string;
        eventId?: string;
        npcId?: string;
        loreEntryId?: string;
        x: number;
        y: number;
      };
      select: typeof scenePegSelect;
    }): Promise<ScenePegRow>;
    update(args: {
      where: { id: string };
      data: { x: number; y: number };
      select: typeof scenePegSelect;
    }): Promise<ScenePegRow>;
    delete(args: { where: { id: string } }): Promise<{ id: string }>;
  };
}

export interface SceneService {
  list(scope: CampaignScope): Promise<SceneSummaryView[]>;
  get(scope: CampaignScope, sceneId: string): Promise<SceneView>;
  create(scope: CampaignScope, input: { name: string }): Promise<SceneView>;
  rename(scope: CampaignScope, sceneId: string, input: { name: string }): Promise<SceneView>;
  remove(scope: CampaignScope, sceneId: string): Promise<void>;
  createPeg(
    scope: CampaignScope,
    sceneId: string,
    input: { kind: ScenePegKind; targetId: string; x: number; y: number },
  ): Promise<ScenePegView>;
  movePeg(
    scope: CampaignScope,
    sceneId: string,
    pegId: string,
    input: { x: number; y: number },
  ): Promise<ScenePegView>;
  removePeg(scope: CampaignScope, sceneId: string, pegId: string): Promise<void>;
}

class PrismaSceneService implements SceneService {
  constructor(
    private readonly config: BackendConfig,
    private readonly prisma: SceneServicePrisma,
    private readonly access: CampaignAccess,
  ) {}

  async list(scope: CampaignScope): Promise<SceneSummaryView[]> {
    const scenes = await this.prisma.scene.findMany({
      where: { campaignId: scope.campaignId },
      orderBy: { createdAt: 'asc' },
      select: sceneSummarySelect,
    });

    return scenes.map(toSceneSummaryView);
  }

  async get(scope: CampaignScope, sceneId: string): Promise<SceneView> {
    return this.toSceneView(await this.requireScene(scope, sceneId));
  }

  async create(scope: CampaignScope, input: { name: string }): Promise<SceneView> {
    const scene = await this.prisma.scene.create({
      data: { name: normalizeSceneName(input.name), campaignId: scope.campaignId },
      select: sceneDetailSelect,
    });

    return this.toSceneView(scene);
  }

  async rename(scope: CampaignScope, sceneId: string, input: { name: string }): Promise<SceneView> {
    await this.requireScene(scope, sceneId);
    const scene = await this.prisma.scene.update({
      where: { id: sceneId },
      data: { name: normalizeSceneName(input.name) },
      select: sceneDetailSelect,
    });

    return this.toSceneView(scene);
  }

  async remove(scope: CampaignScope, sceneId: string): Promise<void> {
    await this.requireScene(scope, sceneId);
    await this.prisma.scene.delete({ where: { id: sceneId } });
  }

  async createPeg(
    scope: CampaignScope,
    sceneId: string,
    input: { kind: ScenePegKind; targetId: string; x: number; y: number },
  ): Promise<ScenePegView> {
    await this.requireScene(scope, sceneId);
    // A target outside this campaign must read as not found, never as a placement failure.
    await this.access.requireResource(scope, {
      kind: input.kind === 'lore' ? 'lore' : input.kind,
      id: input.targetId,
    });

    try {
      const peg = await this.prisma.scenePeg.create({
        data: {
          sceneId,
          ...targetColumn(input.kind, input.targetId),
          ...assertCoordinates(input),
        },
        select: scenePegSelect,
      });

      return toScenePegView(peg);
    } catch (error) {
      if (isUniqueConstraintViolation(error, 'ScenePeg')) {
        throw new ScenePegConflictError();
      }

      throw error;
    }
  }

  async movePeg(
    scope: CampaignScope,
    sceneId: string,
    pegId: string,
    input: { x: number; y: number },
  ): Promise<ScenePegView> {
    await this.access.requireResource(scope, { kind: 'scene-peg', id: pegId, sceneId });
    const peg = await this.prisma.scenePeg.update({
      where: { id: pegId },
      data: assertCoordinates(input),
      select: scenePegSelect,
    });

    return toScenePegView(peg);
  }

  async removePeg(scope: CampaignScope, sceneId: string, pegId: string): Promise<void> {
    await this.access.requireResource(scope, { kind: 'scene-peg', id: pegId, sceneId });
    await this.prisma.scenePeg.delete({ where: { id: pegId } });
  }

  private async requireScene(scope: CampaignScope, sceneId: string): Promise<SceneDetailRow> {
    const scene = await this.prisma.scene.findFirst({
      where: { id: sceneId, campaignId: scope.campaignId },
      select: sceneDetailSelect,
    });
    if (scene === null) {
      throw new CampaignResourceNotFoundError('Scene not found.');
    }

    return scene;
  }

  private toSceneView(scene: SceneDetailRow): SceneView {
    return {
      id: scene.id,
      name: scene.name,
      mapAssetId: scene.mapAsset?.id ?? null,
      mapUrl: scene.mapAsset ? buildUploadAssetUrl(this.config, scene.mapAsset.id) : null,
      pegs: scene.pegs.map(toScenePegView),
      createdAt: scene.createdAt.toISOString(),
      updatedAt: scene.updatedAt.toISOString(),
    };
  }
}

export function createSceneService(
  config: BackendConfig,
  prisma: SceneServicePrisma,
  access: CampaignAccess,
): SceneService {
  return new PrismaSceneService(config, prisma, access);
}

export function normalizeSceneName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (normalized.length === 0) {
    throw new SceneValidationError('Give the scene a name.');
  }

  return normalized;
}

function assertCoordinates(input: { x: number; y: number }): { x: number; y: number } {
  for (const [axis, value] of [
    ['x', input.x],
    ['y', input.y],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new SceneValidationError(`Peg ${axis} must be between 0 and 1.`);
    }
  }

  return { x: input.x, y: input.y };
}

function targetColumn(
  kind: ScenePegKind,
  targetId: string,
): { eventId: string } | { npcId: string } | { loreEntryId: string } {
  switch (kind) {
    case 'event':
      return { eventId: targetId };
    case 'npc':
      return { npcId: targetId };
    case 'lore':
      return { loreEntryId: targetId };
  }
}

function toSceneSummaryView(scene: SceneSummaryRow): SceneSummaryView {
  return {
    id: scene.id,
    name: scene.name,
    hasMap: scene.mapAsset !== null,
    pegCount: scene._count.pegs,
    createdAt: scene.createdAt.toISOString(),
    updatedAt: scene.updatedAt.toISOString(),
  };
}

function toScenePegView(peg: ScenePegRow): ScenePegView {
  const position = { id: peg.id, x: peg.x, y: peg.y };

  if (peg.event !== null) {
    return { ...position, kind: 'event', target: peg.event };
  }
  if (peg.npc !== null) {
    return { ...position, kind: 'npc', target: peg.npc };
  }
  if (peg.loreEntry !== null) {
    return { ...position, kind: 'lore', target: peg.loreEntry };
  }

  // The database enforces exactly one target, so this only fires if that constraint is dropped.
  throw new Error(`Scene peg ${peg.id} has no target.`);
}

/**
 * Under the pg driver adapter a P2002 carries no `meta.target`, so the model name is the stable
 * signal that a duplicate target — rather than some other unique column — caused the failure.
 */
function isUniqueConstraintViolation(error: unknown, modelName: string): boolean {
  if (!(error instanceof Error) || !('code' in error) || error.code !== 'P2002') {
    return false;
  }

  const meta: unknown = 'meta' in error ? error.meta : undefined;
  return (
    typeof meta === 'object' &&
    meta !== null &&
    'modelName' in meta &&
    (meta as { modelName: unknown }).modelName === modelName
  );
}
