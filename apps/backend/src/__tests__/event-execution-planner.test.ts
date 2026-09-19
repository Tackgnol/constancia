import { describe, expect, it, vi } from 'vitest';
import { createPrismaEventExecutionPlanner } from '../services/event-execution-planner.js';

function plannerPrisma(disabledAt: Date | null, status = 'ready') {
  return {
    event: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'event-1',
        name: 'The Prince Arrives',
        type: 'narration',
        status,
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

function testInstancePrisma(overrides: { status?: string; submissions?: { id: string }[] } = {}) {
  return {
    testInstance: {
      findUnique: vi.fn().mockResolvedValue({
        status: overrides.status ?? 'open',
        submissions: overrides.submissions ?? [],
        event: {
          id: 'event-1',
          campaignId: 'campaign-1',
          channelId: 'channel-1',
          pipeline: [],
          channel: { discordChannelId: 'discord-channel-1' },
          campaign: { disabledAt: null, disabledPublicReason: null },
        },
      }),
    },
    character: { findUnique: vi.fn().mockResolvedValue({ systemData: {} }) },
  } as never;
}

const testResultCommand = {
  kind: 'test-result' as const,
  idempotencyKey: 'k1',
  instanceId: 'instance-1',
  discordUserId: 'player-1',
  discordChannelId: 'discord-channel-1',
  playerScore: 3,
};

describe('planFire for a test Event', () => {
  it('mints a Test instance and addresses the delivery to it', async () => {
    const prisma = {
      event: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'event-1',
          name: 'Sneak',
          type: 'test',
          status: 'ready',
          campaignId: 'campaign-1',
          channelId: 'channel-1',
          pipeline: [
            { blockType: 'outcome-map', config: { outcomes: [{ threshold: 0, text: 'Fail' }] } },
          ],
          channel: { discordChannelId: 'discord-channel-1' },
          campaign: { disabledAt: null, disabledPublicReason: null },
        }),
      },
    } as never;

    const plan = await createPrismaEventExecutionPlanner(prisma).planFire({
      kind: 'fire',
      idempotencyKey: 'k1',
      campaignId: 'campaign-1',
      eventId: 'event-1',
    });

    expect(plan.testInstanceId).toEqual(expect.any(String));
    expect(plan.deliveries).toMatchObject([
      { kind: 'test-instance', instanceId: plan.testInstanceId },
    ]);
  });
});

describe('planTestResult submission rules', () => {
  it('plans one submission for a player on an open instance', async () => {
    const plan =
      await createPrismaEventExecutionPlanner(testInstancePrisma()).planTestResult(
        testResultCommand,
      );

    expect(plan.testSubmission).toEqual({
      instanceId: 'instance-1',
      discordUserId: 'player-1',
      playerScore: 3,
    });
  });

  it('refuses results once the GM closed the instance', async () => {
    const planner = createPrismaEventExecutionPlanner(testInstancePrisma({ status: 'closed' }));

    await expect(planner.planTestResult(testResultCommand)).rejects.toMatchObject({
      statusCode: 409,
      code: 'TEST_CLOSED',
    });
  });

  it('refuses a second submission from the same player', async () => {
    const planner = createPrismaEventExecutionPlanner(
      testInstancePrisma({ submissions: [{ id: 'submission-1' }] }),
    );

    await expect(planner.planTestResult(testResultCommand)).rejects.toMatchObject({
      statusCode: 409,
      code: 'ALREADY_SUBMITTED',
    });
  });
});

describe('planFire readiness guard', () => {
  it.each(['draft', 'fired', 'archived'])('refuses to fire a %s Event', async (status) => {
    const planner = createPrismaEventExecutionPlanner(plannerPrisma(null, status));

    await expect(
      planner.planFire({
        kind: 'fire',
        idempotencyKey: 'k1',
        campaignId: 'campaign-1',
        eventId: 'event-1',
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'EVENT_NOT_READY' });
  });
});
