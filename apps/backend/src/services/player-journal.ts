import type { Prisma } from '@constancia/db';
import type { getPrismaClient } from '../auth/prisma.js';
import { listVisibleNpcRecordsForPlayer, mapPlayerVisibleNpc } from './player-visible-npcs.js';

type PrismaClient = ReturnType<typeof getPrismaClient>;

export const questSelect = {
  id: true,
  name: true,
  description: true,
  campaignId: true,
  status: true,
  sortOrder: true,
  visible: true,
} satisfies Prisma.QuestSelect;

export const questEntrySelect = {
  id: true,
  content: true,
  questId: true,
  status: true,
  sortOrder: true,
} satisfies Prisma.QuestEntrySelect;

export const summarySelect = {
  id: true,
  title: true,
  content: true,
  campaignId: true,
  sessionDate: true,
  visible: true,
  channelId: true,
} satisfies Prisma.SessionSummarySelect;

export async function getPlayerJournal(
  prisma: PrismaClient,
  campaignId: string,
  discordUserId: string,
) {
  const character = await prisma.character.findUnique({
    where: { discordUserId_campaignId: { discordUserId, campaignId } },
    select: { id: true },
  });

  if (character === null) {
    return { quests: [], summaries: [], npcs: [] };
  }

  const [quests, summaries, npcs] = await Promise.all([
    prisma.quest.findMany({
      where: { campaignId, visible: true },
      select: { ...questSelect, entries: { select: questEntrySelect } },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.sessionSummary.findMany({
      where: { campaignId, visible: true },
      select: summarySelect,
      orderBy: { sessionDate: 'desc' },
    }),
    listVisibleNpcRecordsForPlayer(prisma, campaignId, discordUserId),
  ]);

  return {
    quests,
    summaries,
    npcs: npcs.map(mapPlayerVisibleNpc),
  };
}
