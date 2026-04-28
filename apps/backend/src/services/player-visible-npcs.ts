import type { Prisma } from '@constancia/db';
import type { getPrismaClient } from '../auth/prisma.js';

type PrismaClient = ReturnType<typeof getPrismaClient>;

type NpcFactRecord = {
  id: string;
  content: string;
  sortOrder: number;
  npcId: string;
};

export type PlayerVisibleNpcRecord = {
  id: string;
  name: string;
  imageUrl: string | null;
  campaignId: string;
  facts: NpcFactRecord[];
};

const npcFactSelect = {
  id: true,
  content: true,
  sortOrder: true,
  npcId: true,
} satisfies Prisma.NpcFactSelect;

export function mapPlayerVisibleNpc(npc: PlayerVisibleNpcRecord) {
  return {
    id: npc.id,
    name: npc.name,
    imageUrl: npc.imageUrl ?? undefined,
    campaignId: npc.campaignId,
    facts: [...npc.facts].sort((left, right) => left.sortOrder - right.sortOrder),
  };
}

export async function listVisibleNpcRecordsForPlayer(
  prisma: PrismaClient,
  campaignId: string,
  discordUserId: string,
): Promise<PlayerVisibleNpcRecord[]> {
  const character = await prisma.character.findUnique({
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

  if (character === null) {
    return [];
  }

  const knowledge = await prisma.npcKnowledge.findMany({
    where: { characterId: character.id },
    select: {
      npcFact: {
        select: {
          ...npcFactSelect,
          npc: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              campaignId: true,
            },
          },
        },
      },
    },
  });

  const npcMap = new Map<string, PlayerVisibleNpcRecord>();

  for (const { npcFact } of knowledge) {
    const npc = npcFact.npc;
    const existing = npcMap.get(npc.id);

    if (existing === undefined) {
      npcMap.set(npc.id, {
        id: npc.id,
        name: npc.name,
        imageUrl: npc.imageUrl,
        campaignId: npc.campaignId,
        facts: [npcFact],
      });
      continue;
    }

    existing.facts.push(npcFact);
  }

  return [...npcMap.values()].sort((left, right) => left.name.localeCompare(right.name));
}
