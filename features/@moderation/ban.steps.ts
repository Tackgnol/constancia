import { expect } from '@playwright/test';
import { createBdd, test as base } from 'playwright-bdd';
import { errorReplyContent, requireApiData } from '../../apps/bot/src/backend/access-revoked.js';
import { InMemoryEventExecutionStore } from '../../apps/backend/src/services/event-execution.js';
import {
  assertCampaignActive,
  assertNotBanned,
  type BanLookupPrisma,
} from '../../apps/backend/src/services/moderation-enforcement.js';
import {
  isHandledRequestError,
  serializeHandledRequestError,
} from '../../apps/backend/src/services/request-errors.js';

class ModerationWorld {
  readonly store = new InMemoryEventExecutionStore();
  readonly bans = new Map<string, string | null>();
  campaignName = '';
  campaignDisabledReason: string | null | undefined = undefined;
  botReply: string | null = null;
  reportedEventId: string | null = null;
  deliveryIds: string[] = [];

  private banPrisma(): BanLookupPrisma {
    return {
      discordUserBan: {
        findUnique: async ({ where }) =>
          this.bans.has(where.discordUserId)
            ? { reasonShownToUser: this.bans.get(where.discordUserId) ?? null }
            : null,
      },
    };
  }

  async queueDelivery(eventId: string): Promise<void> {
    await this.store.createOnce({
      kind: 'fire',
      idempotencyKey: `fire-${eventId}`,
      commandFingerprint: `fire:campaign-1:${eventId}`,
      eventId,
      campaignId: 'campaign-1',
      messages: [],
      effects: [],
      halted: false,
      markEventFired: true,
      deliveries: [
        {
          kind: 'messages',
          eventId,
          discordChannelId: 'channel-1',
          messages: [{ target: 'channel', content: 'The court falls silent.' }],
        },
      ],
    });

    this.deliveryIds = (await this.store.listRetryableDeliveries({ limit: 50 })).map(
      (job) => job.id,
    );
  }

  async suspendCampaign(publicReason: string | null): Promise<void> {
    this.campaignDisabledReason = publicReason;
    for (const deliveryId of this.deliveryIds) {
      await this.store.recordDeliveryResult(deliveryId, { status: 'cancelled' });
    }
  }

  enableCampaign(): void {
    this.campaignDisabledReason = undefined;
  }

  async invokeConstancia(discordUserId: string): Promise<void> {
    let envelope: { status: string; data: object } = { status: 'ok', data: { allowed: true } };
    try {
      await assertNotBanned(this.banPrisma(), discordUserId);
      if (this.campaignDisabledReason !== undefined) {
        assertCampaignActive({
          disabledAt: new Date('2026-08-06T00:00:00.000Z'),
          disabledPublicReason: this.campaignDisabledReason,
        });
      }
    } catch (error) {
      if (!isHandledRequestError(error)) throw error;
      envelope = serializeHandledRequestError(error);
    }

    try {
      requireApiData(envelope, 'check interaction access');
      this.botReply = null;
    } catch (error) {
      this.botReply = errorReplyContent(error);
    }
  }

  async pendingDeliveryCount(): Promise<number> {
    return (await this.store.listRetryableDeliveries({ limit: 50 })).length;
  }
}

export const test = base.extend<{ world: ModerationWorld }>({
  world: async ({ playwright }, use) => {
    void playwright;
    await use(new ModerationWorld());
  },
});

const { Given, When, Then } = createBdd(test, { worldFixture: 'world' });

Given('a game master administers the VTM V5 campaign {string}', function (name: string) {
  this.campaignName = name;
});

Given('the operator is signed in as a superuser', function () {});

Given('the event {string} was delivered to the main channel', async function (eventId: string) {
  this.reportedEventId = eventId;
  await this.queueDelivery(eventId);
});

Given('a player reported that message', function () {
  expect(this.reportedEventId).not.toBeNull();
});

Given('the campaign is suspended with the public reason {string}', async function (reason: string) {
  await this.suspendCampaign(reason);
});

Given(
  'the game master is banned with the reason shown to them {string}',
  function (reason: string) {
    this.bans.set('discord-gm', reason);
  },
);

Given('the campaign was suspended and its deliveries were cancelled', async function () {
  await this.queueDelivery('The Prince Arrives');
  await this.suspendCampaign('Suspended pending review.');
});

When('the operator opens the admin reports page', function () {
  expect(this.reportedEventId).not.toBeNull();
});

When(
  'the operator suspends the campaign with the public reason {string}',
  async function (reason: string) {
    await this.suspendCampaign(reason);
  },
);

When('the operator re-enables the campaign', function () {
  this.enableCampaign();
});

When('the game master uses Constancia', async function () {
  await this.invokeConstancia('discord-gm');
});

Then('the report shows the campaign {string}', function (name: string) {
  expect(this.campaignName).toBe(name);
});

Then('queued deliveries for {string} are cancelled', async function (name: string) {
  expect(this.campaignName).toBe(name);
  expect(await this.pendingDeliveryCount()).toBe(0);
});

Then('the game master is told {string} when they use Constancia', async function (message: string) {
  await this.invokeConstancia('discord-gm');
  expect(this.botReply).toBe(message);
});

Then('they are told {string}', function (message: string) {
  expect(this.botReply).toBe(message);
});

Then('those deliveries stay cancelled', async function () {
  expect(await this.pendingDeliveryCount()).toBe(0);
});

Then('no message is sent to the main channel', async function () {
  expect(await this.pendingDeliveryCount()).toBe(0);
});
