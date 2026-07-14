import type { PrismaClient } from '@constancia/db';
import type { Prisma } from '@constancia/db';
import {
  extractSystemStats,
  getGameSystemSummary,
  getStatSchemaForSystem,
  mergeSystemStats,
  parseProgenyVtmCharacter,
  type JsonObject,
} from '@constancia/systems';

const characterSheetSelect = {
  id: true,
  name: true,
  discordName: true,
  gameName: true,
  discordUserId: true,
  campaignId: true,
  backstory: true,
  notes: true,
  systemData: true,
  campaign: {
    select: {
      id: true,
      name: true,
      discordGuildId: true,
      gameSystemId: true,
    },
  },
} as const;

type CharacterSheetRecord = Awaited<
  Promise<{
    id: string;
    name: string;
    discordName: string;
    gameName: string;
    discordUserId: string;
    campaignId: string;
    backstory: string;
    notes: string;
    systemData: Prisma.JsonValue;
    campaign: {
      id: string;
      name: string;
      discordGuildId: string;
      gameSystemId: string;
    };
  } | null>
>;

export interface CharacterSheetAccess {
  mode: 'gm' | 'player';
  canEdit: boolean;
}

export interface CharacterSheetPayload {
  character: {
    id: string;
    name: string;
    discordName: string;
    gameName: string;
    discordUserId: string;
    campaignId: string;
    backstory: string;
    notes: string;
    systemData: Record<string, unknown>;
  };
  campaign: {
    id: string;
    name: string;
    discordGuildId: string;
    gameSystemId: string;
  };
  system: {
    id: string;
    name: string;
    version: string;
    statSchema: ReturnType<typeof getStatSchemaForSystem>;
  };
  stats: Record<string, string | number | boolean>;
  access: CharacterSheetAccess;
}

export interface CharacterSheetPatchInput {
  gameName?: string;
  backstory?: string;
  notes?: string;
  stats?: Record<string, unknown>;
}

export type PlayerCharacterImportResult =
  | { status: 'imported'; sheet: CharacterSheetPayload }
  | { status: 'not-found' }
  | { status: 'unsupported-system' };

function toCharacterSheetPayload(
  record: NonNullable<CharacterSheetRecord>,
  access: CharacterSheetAccess,
): CharacterSheetPayload {
  const systemId = record.campaign.gameSystemId;
  const summary = getGameSystemSummary(systemId) ?? {
    id: systemId,
    name: systemId,
    version: '0.1.0',
  };
  const systemData = (record.systemData ?? {}) as Record<string, unknown>;

  return {
    character: {
      id: record.id,
      name: record.name,
      discordName: record.discordName,
      gameName: record.gameName,
      discordUserId: record.discordUserId,
      campaignId: record.campaignId,
      backstory: record.backstory,
      notes: record.notes,
      systemData,
    },
    campaign: record.campaign,
    system: {
      id: summary.id,
      name: summary.name,
      version: summary.version,
      statSchema: getStatSchemaForSystem(systemId),
    },
    stats: extractSystemStats(systemId, systemData),
    access,
  };
}

async function isCampaignAdmin(
  prisma: PrismaClient,
  campaignId: string,
  discordUserId: string,
): Promise<boolean> {
  const admin = await prisma.campaignAdmin.findUnique({
    where: {
      discordUserId_campaignId: {
        discordUserId,
        campaignId,
      },
    },
    select: {
      id: true,
    },
  });

  return admin !== null;
}

export async function getCharacterSheetForActor(
  prisma: PrismaClient,
  campaignId: string,
  charId: string,
  discordUserId: string,
): Promise<CharacterSheetPayload | null> {
  const record = await prisma.character.findUnique({
    where: { id: charId },
    select: characterSheetSelect,
  });

  if (record === null || record.campaignId !== campaignId) {
    return null;
  }

  const gmAccess = await isCampaignAdmin(prisma, campaignId, discordUserId);
  const isOwnSheet = record.discordUserId === discordUserId;

  if (!gmAccess && !isOwnSheet) {
    return null;
  }

  return toCharacterSheetPayload(record, {
    mode: gmAccess ? 'gm' : 'player',
    canEdit: true,
  });
}

export async function getPlayerCharacterSheet(
  prisma: PrismaClient,
  campaignId: string,
  discordUserId: string,
): Promise<CharacterSheetPayload | null> {
  const record = await prisma.character.findUnique({
    where: {
      discordUserId_campaignId: {
        discordUserId,
        campaignId,
      },
    },
    select: characterSheetSelect,
  });

  if (record === null) {
    return null;
  }

  const gmAccess = await isCampaignAdmin(prisma, campaignId, discordUserId);

  return toCharacterSheetPayload(record, {
    mode: gmAccess ? 'gm' : 'player',
    canEdit: true,
  });
}

export async function updateCharacterSheetForActor(
  prisma: PrismaClient,
  campaignId: string,
  charId: string,
  discordUserId: string,
  patch: CharacterSheetPatchInput,
): Promise<CharacterSheetPayload | null> {
  const current = await getCharacterSheetForActor(prisma, campaignId, charId, discordUserId);
  if (current === null) {
    return null;
  }

  const data: Prisma.CharacterUpdateInput = {};
  if (patch.gameName !== undefined) data.gameName = patch.gameName;
  if (patch.backstory !== undefined) data.backstory = patch.backstory;
  if (patch.notes !== undefined) data.notes = patch.notes;
  if (patch.stats !== undefined) {
    data.systemData = mergeSystemStats(
      current.system.id,
      current.character.systemData,
      patch.stats,
    ) as Prisma.InputJsonValue;
  }

  const updated = await prisma.character.update({
    where: { id: charId },
    data,
    select: characterSheetSelect,
  });

  return toCharacterSheetPayload(updated, current.access);
}

export async function updatePlayerCharacterSheet(
  prisma: PrismaClient,
  campaignId: string,
  discordUserId: string,
  patch: CharacterSheetPatchInput,
): Promise<CharacterSheetPayload | null> {
  const current = await getPlayerCharacterSheet(prisma, campaignId, discordUserId);
  if (current === null) {
    return null;
  }

  const data: Prisma.CharacterUpdateInput = {};
  if (patch.gameName !== undefined) data.gameName = patch.gameName;
  if (patch.backstory !== undefined) data.backstory = patch.backstory;
  if (patch.notes !== undefined) data.notes = patch.notes;
  if (patch.stats !== undefined) {
    data.systemData = mergeSystemStats(
      current.system.id,
      current.character.systemData,
      patch.stats,
    ) as Prisma.InputJsonValue;
  }

  const updated = await prisma.character.update({
    where: {
      discordUserId_campaignId: {
        discordUserId,
        campaignId,
      },
    },
    data,
    select: characterSheetSelect,
  });

  return toCharacterSheetPayload(updated, current.access);
}

export async function importPlayerCharacterFromProgeny(
  prisma: PrismaClient,
  campaignId: string,
  discordUserId: string,
  source: JsonObject,
): Promise<PlayerCharacterImportResult> {
  const current = await getPlayerCharacterSheet(prisma, campaignId, discordUserId);
  if (current === null) {
    return { status: 'not-found' };
  }
  if (current.system.id !== 'vtm-v5') {
    return { status: 'unsupported-system' };
  }

  const imported = parseProgenyVtmCharacter(source);
  const updated = await prisma.character.update({
    where: {
      discordUserId_campaignId: {
        discordUserId,
        campaignId,
      },
    },
    data: {
      gameName: imported.gameName,
      backstory: imported.backstory,
      notes: imported.notes,
      systemData: {
        ...current.character.systemData,
        ...imported.systemData,
      } as Prisma.InputJsonValue,
    },
    select: characterSheetSelect,
  });

  return {
    status: 'imported',
    sheet: toCharacterSheetPayload(updated, current.access),
  };
}
