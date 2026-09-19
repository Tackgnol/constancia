import type { BotDeliveryPayload } from '@constancia/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  createEventExecution,
  InMemoryBotDeliveryPort,
  InMemoryEventExecutionStore,
  type EventExecutionPlanner,
  type FireEventCommand,
  type SubmitTestResultCommand,
} from '../services/event-execution.js';

function messageDelivery(
  eventId: string,
  discordChannelId = 'discord-channel-1',
): BotDeliveryPayload {
  return {
    kind: 'messages',
    eventId,
    discordChannelId,
    messages: [{ target: 'channel', content: 'The Prince arrives.' }],
  };
}

describe('EventExecution', () => {
  it('returns the existing receipt when a fire request is repeated', async () => {
    const store = new InMemoryEventExecutionStore();
    const delivery = new InMemoryBotDeliveryPort();
    const planFire = vi.fn(async (command: FireEventCommand) => ({
      eventId: command.eventId,
      campaignId: command.campaignId,
      messages: [{ target: 'channel' as const, content: 'The Prince arrives.' }],
      effects: [
        {
          kind: 'add-quest' as const,
          name: 'Find the missing Harpy',
          description: '',
          visible: true,
        },
      ],
      halted: false,
      deliveries: [messageDelivery(command.eventId)],
    }));
    const planner: EventExecutionPlanner = {
      planFire,
      planTestResult: vi.fn(async () => {
        throw new Error('Unexpected test-result planning.');
      }),
    };
    const execution = createEventExecution({ store, planner, delivery });
    const command = {
      idempotencyKey: 'fire-interaction-1',
      campaignId: 'campaign-1',
      eventId: 'event-1',
    };

    const first = await execution.fire(command);
    const repeated = await execution.fire(command);

    expect(repeated).toEqual(first);
    expect(planFire).toHaveBeenCalledTimes(1);
    expect(delivery.commands).toHaveLength(1);
    expect(store.isEventFired('campaign-1', 'event-1')).toBe(true);
    expect(store.committedEffects).toEqual([
      {
        kind: 'add-quest',
        name: 'Find the missing Harpy',
        description: '',
        visible: true,
      },
    ]);
    expect(first.deliveries).toMatchObject([{ status: 'delivered', attempts: 1 }]);
  });

  it('coalesces concurrent fire requests before planning the pipeline', async () => {
    const store = new InMemoryEventExecutionStore();
    const delivery = new InMemoryBotDeliveryPort();
    const planFire = vi.fn(async (command: FireEventCommand) => {
      await Promise.resolve();
      return {
        eventId: command.eventId,
        campaignId: command.campaignId,
        messages: [{ target: 'channel' as const, content: 'Only once.' }],
        effects: [],
        halted: false,
        deliveries: [messageDelivery(command.eventId)],
      };
    });
    const execution = createEventExecution({
      store,
      delivery,
      planner: {
        planFire,
        planTestResult: vi.fn(async () => {
          throw new Error('Unexpected test-result planning.');
        }),
      },
    });
    const command = {
      idempotencyKey: 'concurrent-fire-1',
      campaignId: 'campaign-1',
      eventId: 'event-concurrent',
    };

    const [first, second] = await Promise.all([execution.fire(command), execution.fire(command)]);

    expect(second).toEqual(first);
    expect(planFire).toHaveBeenCalledTimes(1);
    expect(delivery.commands).toHaveLength(1);
  });

  it('retries failed delivery without rerunning the Event pipeline', async () => {
    const store = new InMemoryEventExecutionStore();
    const delivery = new InMemoryBotDeliveryPort();
    delivery.failNext('Bot unavailable');
    const planFire = vi.fn(async (command: FireEventCommand) => ({
      eventId: command.eventId,
      campaignId: command.campaignId,
      messages: [{ target: 'channel' as const, content: 'A door slams.' }],
      effects: [],
      halted: false,
      deliveries: [messageDelivery(command.eventId)],
    }));
    const planner: EventExecutionPlanner = {
      planFire,
      planTestResult: vi.fn(async () => {
        throw new Error('Unexpected test-result planning.');
      }),
    };
    const execution = createEventExecution({ store, planner, delivery });

    const first = await execution.fire({
      idempotencyKey: 'fire-interaction-2',
      campaignId: 'campaign-1',
      eventId: 'event-2',
    });

    expect(first.deliveries).toMatchObject([
      { status: 'failed', attempts: 1, lastError: 'Bot unavailable' },
    ]);

    const [retried] = await execution.retryDeliveries({
      executionId: first.id,
    });

    expect(retried?.deliveries).toMatchObject([{ status: 'delivered', attempts: 2 }]);
    expect(planFire).toHaveBeenCalledTimes(1);
    expect(delivery.commands).toHaveLength(2);
    expect(delivery.commands[0]?.deliveryId).toBe(delivery.commands[1]?.deliveryId);
  });

  it('returns one receipt when a player test result is repeated', async () => {
    const store = new InMemoryEventExecutionStore();
    const delivery = new InMemoryBotDeliveryPort();
    const planTestResult = vi.fn(async (command: SubmitTestResultCommand) => ({
      eventId: 'event-3',
      campaignId: 'campaign-1',
      testSubmission: {
        instanceId: command.instanceId,
        discordUserId: command.discordUserId,
        playerScore: command.playerScore,
      },
      messages: [
        {
          target: 'player' as const,
          targetId: command.discordUserId,
          content: 'You read the Sheriff successfully.',
        },
      ],
      effects: [],
      halted: false,
      deliveries: [
        {
          kind: 'messages' as const,
          eventId: 'event-3',
          discordChannelId: command.discordChannelId,
          messages: [
            {
              target: 'player' as const,
              targetId: command.discordUserId,
              content: 'You read the Sheriff successfully.',
            },
          ],
        },
      ],
    }));
    const planner: EventExecutionPlanner = {
      planFire: vi.fn(async () => {
        throw new Error('Unexpected fire planning.');
      }),
      planTestResult,
    };
    const execution = createEventExecution({ store, planner, delivery });
    const command = {
      idempotencyKey: 'discord-interaction-1',
      instanceId: 'instance-3',
      discordUserId: 'discord-player-1',
      discordChannelId: 'discord-channel-1',
      playerScore: 4,
    };

    const first = await execution.submitTestResult(command);
    const repeated = await execution.submitTestResult(command);

    expect(repeated).toEqual(first);
    expect(planTestResult).toHaveBeenCalledTimes(1);
    expect(delivery.commands).toHaveLength(1);
    expect(first.deliveries).toMatchObject([{ status: 'delivered', attempts: 1 }]);
  });
});

describe('cancelled deliveries', () => {
  it('never returns cancelled deliveries as retryable', async () => {
    const store = new InMemoryEventExecutionStore();
    await store.createOnce({
      kind: 'fire',
      idempotencyKey: 'key-cancelled-1',
      commandFingerprint: 'fire:campaign-1:event-1',
      eventId: 'event-1',
      campaignId: 'campaign-1',
      messages: [],
      effects: [],
      halted: false,
      markEventFired: false,
      deliveries: [messageDelivery('event-1')],
    });

    const [job] = await store.listRetryableDeliveries({ limit: 10 });
    expect(job).toBeDefined();
    await store.recordDeliveryResult(job!.id, { status: 'cancelled' });

    expect(await store.listRetryableDeliveries({ limit: 10 })).toEqual([]);
  });
});
