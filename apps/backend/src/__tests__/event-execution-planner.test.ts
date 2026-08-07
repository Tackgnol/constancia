import { describe, expect, it, vi } from 'vitest';
import { createPrismaEventExecutionPlanner } from '../services/event-execution-planner.js';

function plannerPrisma(disabledAt: Date | null) {
  return {
    event: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'event-1',
        name: 'The Prince Arrives',
        type: 'narration',
        campaignId: 'campaign-1',
        channelId: 'channel-1',
        pipeline: [],
        channel: { discordChannelId: 'discord-channel-1' },
        campaign: { disabledAt, disabledPublicReason: 'Suspended pending review.' },
      }),
    },
    character: { findMany: vi.fn().mockResolvedValue([]) },
  } as never;
}

describe('planFire campaign suspension guard', () => {
  it('refuses to plan for a disabled campaign', async () => {
    const planner = createPrismaEventExecutionPlanner(
      plannerPrisma(new Date('2026-08-06T00:00:00.000Z')),
    );

    await expect(
      planner.planFire({
        kind: 'fire',
        idempotencyKey: 'k1',
        campaignId: 'campaign-1',
        eventId: 'event-1',
      }),
    ).rejects.toThrow('Suspended pending review.');
  });

  it('plans normally for an active campaign', async () => {
    const plan = await createPrismaEventExecutionPlanner(plannerPrisma(null)).planFire({
      kind: 'fire',
      idempotencyKey: 'k1',
      campaignId: 'campaign-1',
      eventId: 'event-1',
    });

    expect(plan.eventId).toBe('event-1');
  });
});
