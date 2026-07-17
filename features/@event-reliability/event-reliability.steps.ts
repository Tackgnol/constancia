import { expect } from '@playwright/test';
import { createBdd, test as base } from 'playwright-bdd';
import type {
  BotDeliveryCommand,
  BotDeliveryPort,
  BotDeliveryResult,
  EventExecution,
  EventExecutionPlanner,
  EventExecutionReceipt,
  FireEventCommand,
  SubmitTestResultCommand,
} from '../../apps/backend/src/services/event-execution.js';
import {
  createEventExecution,
  InMemoryEventExecutionStore,
} from '../../apps/backend/src/services/event-execution.js';

interface Cue {
  id: string;
  name: string;
  campaignId: string;
  kind: 'narration' | 'test';
}

class ScenarioBotDeliveryPort implements BotDeliveryPort {
  unavailable = false;
  readonly commands: BotDeliveryCommand[] = [];
  readonly deliveredIds = new Set<string>();
  readonly deliveredEventIds: string[] = [];

  async deliver(command: BotDeliveryCommand): Promise<BotDeliveryResult> {
    this.commands.push(command);

    if (this.deliveredIds.has(command.deliveryId)) {
      return { status: 'delivered', delivered: 1, skipped: 0 };
    }
    if (this.unavailable) {
      return { status: 'failed', error: 'Discord bot unavailable' };
    }

    this.deliveredIds.add(command.deliveryId);
    this.deliveredEventIds.push(command.payload.eventId);
    return { status: 'delivered', delivered: 1, skipped: 0 };
  }
}

class ReliabilityWorld {
  readonly campaignIds = new Map<string, string>();
  readonly cues = new Map<string, Cue>();
  readonly pipelineExecutions = new Map<string, number>();
  readonly observedReceipts: EventExecutionReceipt[] = [];
  readonly store = new InMemoryEventExecutionStore();
  readonly bot = new ScenarioBotDeliveryPort();
  readonly execution: EventExecution;
  activeCampaignId = '';
  lastReceipt: EventExecutionReceipt | null = null;
  lastError: Error | null = null;

  constructor() {
    const planner: EventExecutionPlanner = {
      planFire: (command) => this.planFire(command),
      planTestResult: (command) => this.planTestResult(command),
    };
    this.execution = createEventExecution({
      store: this.store,
      planner,
      delivery: this.bot,
    });
  }

  campaign(name: string): string {
    const existing = this.campaignIds.get(name);
    if (existing) return existing;
    const id = `campaign-${this.campaignIds.size + 1}`;
    this.campaignIds.set(name, id);
    return id;
  }

  addCue(name: string, campaignId: string, kind: Cue['kind']): Cue {
    const cue = { id: `event-${this.cues.size + 1}`, name, campaignId, kind };
    this.cues.set(name, cue);
    return cue;
  }

  async fire(name: string): Promise<void> {
    const cue = this.requireCue(name);
    this.lastError = null;
    try {
      this.lastReceipt = await this.execution.fire({
        idempotencyKey: `play-view:${cue.id}`,
        campaignId: this.activeCampaignId,
        eventId: cue.id,
      });
      this.observedReceipts.push(this.lastReceipt);
    } catch (error) {
      this.lastError = error instanceof Error ? error : new Error('Unknown error');
      this.lastReceipt = null;
    }
  }

  async submitScore(name: string, playerScore: number): Promise<void> {
    const cue = this.requireCue(name);
    this.lastReceipt = await this.execution.submitTestResult({
      idempotencyKey: `discord:player-1:${cue.id}`,
      eventId: cue.id,
      discordUserId: 'player-1',
      discordChannelId: 'elysium',
      playerScore,
    });
    this.observedReceipts.push(this.lastReceipt);
  }

  private async planFire(command: FireEventCommand) {
    const cue = this.findCueById(command.eventId);
    if (!cue || cue.campaignId !== command.campaignId) {
      throw new Error('Cue unavailable');
    }
    this.recordPipelineExecution(cue.id);
    const content = cue.name === 'A Door Slams' ? 'A door slams.' : 'The Prince arrives.';
    return {
      eventId: cue.id,
      campaignId: cue.campaignId,
      messages: [{ target: 'channel' as const, content }],
      halted: false,
      deliveries: [
        {
          kind: 'messages' as const,
          eventId: cue.id,
          discordChannelId: 'elysium',
          messages: [{ target: 'channel' as const, content }],
        },
      ],
    };
  }

  private async planTestResult(command: SubmitTestResultCommand) {
    const cue = this.findCueById(command.eventId);
    if (!cue || cue.kind !== 'test') throw new Error('Test cue unavailable');
    this.recordPipelineExecution(cue.id);
    const content = `Resolved outcome at score ${command.playerScore}.`;
    return {
      eventId: cue.id,
      campaignId: cue.campaignId,
      messages: [
        {
          target: 'player' as const,
          targetId: command.discordUserId,
          content,
        },
      ],
      halted: false,
      deliveries: [
        {
          kind: 'messages' as const,
          eventId: cue.id,
          discordChannelId: command.discordChannelId,
          messages: [
            {
              target: 'player' as const,
              targetId: command.discordUserId,
              content,
            },
          ],
        },
      ],
    };
  }

  private requireCue(name: string): Cue {
    const cue = this.cues.get(name);
    if (!cue) throw new Error(`Unknown cue: ${name}`);
    return cue;
  }

  private findCueById(id: string): Cue | undefined {
    return [...this.cues.values()].find((cue) => cue.id === id);
  }

  private recordPipelineExecution(eventId: string): void {
    this.pipelineExecutions.set(eventId, (this.pipelineExecutions.get(eventId) ?? 0) + 1);
  }
}

export const test = base.extend<{ world: ReliabilityWorld }>({
  world: async ({ playwright }, use) => {
    void playwright;
    await use(new ReliabilityWorld());
  },
});
const { Given, When, Then } = createBdd(test, { worldFixture: 'world' });

Given('a game master administers the campaign {string}', function (name: string) {
  this.activeCampaignId = this.campaign(name);
});

Given('the campaign is connected to the Discord channel {string}', function (channel: string) {
  expect(channel).toBe('elysium');
});

Given('the narration cue {string} is ready in Play View', function (name: string) {
  this.addCue(name, this.activeCampaignId, 'narration');
});

Given('the Discord bot is temporarily unavailable', function () {
  this.bot.unavailable = true;
});

Given('the test cue {string} has been delivered to the player', function (name: string) {
  this.addCue(name, this.activeCampaignId, 'test');
});

Given('the cue {string} belongs to another campaign', function (name: string) {
  this.addCue(name, this.campaign('Foreign Campaign'), 'narration');
});

When('the game master fires {string}', async function (name: string) {
  await this.fire(name);
});

When('Play View repeats the same fire request', async function () {
  const cue = [...this.cues.values()].find(
    (candidate) => candidate.id === this.lastReceipt?.eventId,
  );
  if (!cue) throw new Error('No previously fired cue');
  await this.fire(cue.name);
});

When('the Discord bot becomes available', async function () {
  this.bot.unavailable = false;
  if (!this.lastReceipt) throw new Error('No execution awaiting delivery');
  const [receipt] = await this.execution.retryDeliveries({
    executionId: this.lastReceipt.id,
  });
  this.lastReceipt = receipt ?? null;
});

When('the player submits a score of {int} from Discord', async function (score: number) {
  await this.submitScore('Read the Sheriff', score);
});

When('Discord repeats the same test-result request', async function () {
  await this.submitScore('Read the Sheriff', 4);
});

When(
  'the game master tries to fire {string} from {string}',
  async function (cueName: string, campaignName: string) {
    this.activeCampaignId = this.campaign(campaignName);
    await this.fire(cueName);
  },
);

Then('Play View shows {string} as delivered', function (name: string) {
  expect(this.lastReceipt?.eventId).toBe(this.cues.get(name)?.id);
  expect(this.lastReceipt?.deliveries.every((delivery) => delivery.status === 'delivered')).toBe(
    true,
  );
});

Then('Play View shows {string} as awaiting delivery', function (name: string) {
  expect(this.lastReceipt?.eventId).toBe(this.cues.get(name)?.id);
  expect(this.lastReceipt?.deliveries.some((delivery) => delivery.status === 'failed')).toBe(true);
});

Then('Discord receives the narration once', function () {
  expect(this.bot.deliveredEventIds).toHaveLength(1);
});

Then('Discord eventually receives the narration once', function () {
  expect(this.bot.deliveredEventIds).toHaveLength(1);
});

Then('the cue pipeline has one execution receipt', function () {
  expect(new Set(this.observedReceipts.map((receipt) => receipt.id)).size).toBe(1);
});

Then('the cue pipeline still has one execution receipt', function () {
  expect(new Set(this.observedReceipts.map((receipt) => receipt.id)).size).toBe(1);
});

Then('the player receives the resolved outcome once', function () {
  expect(this.bot.deliveredEventIds).toHaveLength(1);
});

Then('Play View shows the result for {string}', function (name: string) {
  expect(this.lastReceipt?.eventId).toBe(this.cues.get(name)?.id);
  expect(this.lastReceipt?.status).toBe('completed');
});

Then('the test cue has one result receipt for that player', function () {
  const receipts = new Set(
    this.observedReceipts
      .filter((receipt) => receipt.kind === 'test-result')
      .map((receipt) => receipt.id),
  );
  expect(receipts.size).toBe(1);
});

Then('Play View reports that the cue is unavailable', function () {
  expect(this.lastError?.message).toContain('unavailable');
});

Then('the foreign cue pipeline is not executed', function () {
  const cue = this.cues.get('Foreign Orders');
  expect(cue ? (this.pipelineExecutions.get(cue.id) ?? 0) : -1).toBe(0);
});

Then('Discord receives no message for {string}', function (name: string) {
  const cue = this.cues.get(name);
  expect(this.bot.deliveredEventIds).not.toContain(cue?.id);
});
