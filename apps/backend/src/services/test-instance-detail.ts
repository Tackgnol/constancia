import type { PrismaClient } from '@constancia/db';

export interface TestInstanceParticipant {
  discordUserId: string;
  label: string;
  submitted: boolean;
  playerScore?: number;
  submittedAt?: Date;
}

export interface TestInstanceDetail {
  id: string;
  eventId: string;
  status: 'open' | 'closed';
  closedAt?: Date;
  createdAt: Date;
  participants: TestInstanceParticipant[];
}

const instanceSelect = {
  id: true,
  eventId: true,
  status: true,
  closedAt: true,
  createdAt: true,
  submissions: { select: { discordUserId: true, playerScore: true, createdAt: true } },
} as const;

/** Builds the GM-only per-player breakdown: every Campaign Character, submitted or still missing. */
export async function listTestInstanceDetails(
  prisma: PrismaClient,
  input: { campaignId: string; eventId: string; instanceId?: string; limit?: number },
): Promise<TestInstanceDetail[]> {
  const [instances, characters] = await Promise.all([
    prisma.testInstance.findMany({
      where: { eventId: input.eventId, ...(input.instanceId ? { id: input.instanceId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: input.limit ?? 5,
      select: instanceSelect,
    }),
    prisma.character.findMany({
      where: { campaignId: input.campaignId },
      orderBy: { createdAt: 'asc' },
      select: { discordUserId: true, name: true, discordName: true, gameName: true },
    }),
  ]);

  return instances.map((instance) => {
    const submissionByUser = new Map(
      instance.submissions.map((submission) => [submission.discordUserId, submission]),
    );

    return {
      id: instance.id,
      eventId: instance.eventId,
      status: instance.status,
      ...(instance.closedAt ? { closedAt: instance.closedAt } : {}),
      createdAt: instance.createdAt,
      participants: characters.map((character) => {
        const submission = submissionByUser.get(character.discordUserId);
        return {
          discordUserId: character.discordUserId,
          label: character.gameName || character.discordName || character.name,
          submitted: submission !== undefined,
          ...(submission
            ? { playerScore: submission.playerScore, submittedAt: submission.createdAt }
            : {}),
        };
      }),
    };
  });
}
