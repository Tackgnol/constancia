import type { PrismaClient } from '@constancia/db';
import { gameSystemRegistry } from '@constancia/systems';
import { PIPELINE_BLOCK } from '@constancia/block-catalogue';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The Game System's modifier hint for one player on one Test instance, or null when it has none. */
export async function getTestModifierHint(
  prisma: PrismaClient,
  instanceId: string,
  discordUserId: string,
): Promise<string | null> {
  const instance = await prisma.testInstance.findUnique({
    where: { id: instanceId },
    select: {
      event: {
        select: { campaignId: true, pipeline: true, campaign: { select: { gameSystemId: true } } },
      },
    },
  });
  if (!instance) return null;

  const { event } = instance;
  const resolver = (Array.isArray(event.pipeline) ? event.pipeline : []).find(
    (block) => isRecord(block) && block.blockType === PIPELINE_BLOCK.TestResolver,
  );
  const hint = gameSystemRegistry.get(event.campaign.gameSystemId)?.roleBlocks[
    PIPELINE_BLOCK.TestResolver
  ]?.hint;
  if (!isRecord(resolver) || !isRecord(resolver.config) || !hint) return null;

  const character = await prisma.character.findUnique({
    where: { discordUserId_campaignId: { discordUserId, campaignId: event.campaignId } },
    select: { systemData: true },
  });
  return character && isRecord(character.systemData)
    ? hint(resolver.config, character.systemData)
    : null;
}
