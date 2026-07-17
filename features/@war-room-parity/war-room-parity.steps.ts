import { expect } from '@playwright/test';
import { createBdd, test as base } from 'playwright-bdd';
import { deliverAdHocChannelMessage } from '../../apps/backend/src/services/ad-hoc-channel-message.js';
import { InMemoryBotDeliveryPort } from '../../apps/backend/src/services/event-execution.js';
import { getClanTone } from '../../apps/frontend/app/components/war-room/player-tone.js';
import { quickNarrationSchema } from '../../apps/frontend/app/components/war-room/quick-narration.js';
import { buildWarRoomModeTabs } from '../../apps/frontend/app/components/war-room/war-room-navigation.js';
import {
  CAMPAIGN_RENAME_ERROR,
  QUICK_NARRATION_ERROR,
} from '../../apps/frontend/app/lib/war-room-feedback.js';
import type { GameDate } from '../../packages/contracts/src/game-date.js';
import {
  GREGORIAN_CALENDAR,
  formatGameDate,
  validateGameDate,
} from '../../packages/systems/src/calendar.js';

function parseGregorianDate(label: string): GameDate {
  const match = /^(\d+) (.+) (\d+)$/.exec(label);
  if (!match) {
    throw new Error(`Invalid game date label: ${label}`);
  }

  const monthId = Object.entries(GREGORIAN_CALENDAR.months).find(
    ([, month]) => month.name.toLowerCase() === match[2]?.toLowerCase(),
  )?.[0];
  if (!monthId) {
    throw new Error(`Unknown Gregorian month in: ${label}`);
  }

  const date: GameDate = {
    calendarId: GREGORIAN_CALENDAR.id,
    day: Number(match[1]),
    monthId,
    year: Number(match[3]),
  };
  const validation = validateGameDate(GREGORIAN_CALENDAR, date);
  if (!validation.valid) {
    throw new Error(validation.message);
  }
  return date;
}

class WarRoomParityWorld {
  readonly bot = new InMemoryBotDeliveryPort();
  readonly successfulDeliveryIds = new Set<string>();
  campaignName = '';
  channelName = '';
  draft = '';
  error: string | null = null;
  notice: string | null = null;
  livePlayOpen = false;
  comparedWarRooms = false;
  deliveryUnavailable = false;
  campaignUpdatesUnavailable = false;
  campaignNameDraft = '';
  renameError: string | null = null;
  gameSystemId = '';
  gameDate: GameDate | null = null;
  readonly journalDates = new Map<string, GameDate>();
  private attempt: { idempotencyKey: string; message: string } | null = null;
  private attemptSequence = 0;

  async broadcast(message?: string): Promise<void> {
    if (message !== undefined) {
      if (this.draft !== message) {
        this.attempt = null;
      }
      this.draft = message;
    }

    const parsed = quickNarrationSchema.safeParse({ message: this.draft });
    if (!parsed.success) {
      this.error = parsed.error.issues[0]?.message ?? 'Narration is invalid.';
      this.notice = null;
      return;
    }

    const normalized = parsed.data.message;
    const attempt =
      this.attempt?.message === normalized
        ? this.attempt
        : {
            idempotencyKey: `quick-narration-${++this.attemptSequence}`,
            message: normalized,
          };
    this.attempt = attempt;

    if (this.deliveryUnavailable) {
      this.bot.failNext('Discord unavailable');
    }

    const result = await deliverAdHocChannelMessage(this.bot, {
      campaignId: 'campaign-midnight-chronicle',
      channelId: 'channel-elysium',
      discordChannelId: this.channelName,
      content: attempt.message,
      idempotencyKey: attempt.idempotencyKey,
    });

    if (result.delivery.status === 'failed') {
      this.error = QUICK_NARRATION_ERROR;
      this.notice = null;
      return;
    }

    this.successfulDeliveryIds.add(result.deliveryId);
    this.error = null;
    this.notice = 'Narration broadcast to the room.';
    this.draft = '';
    this.attempt = null;
  }

  saveCampaignName(): void {
    if (this.campaignUpdatesUnavailable) {
      this.renameError = CAMPAIGN_RENAME_ERROR;
      return;
    }

    this.campaignName = this.campaignNameDraft;
    this.renameError = null;
  }

  setGameDate(label: string): void {
    this.gameDate = parseGregorianDate(label);
  }

  addJournalEntry(title: string): void {
    if (this.gameDate === null) {
      throw new Error('Set the campaign game date before adding this journal entry.');
    }
    this.journalDates.set(title, structuredClone(this.gameDate));
  }

  changeJournalDate(title: string, label: string): void {
    if (!this.journalDates.has(title)) {
      throw new Error(`Journal entry not found: ${title}`);
    }
    this.journalDates.set(title, parseGregorianDate(label));
  }
}

export const test = base.extend<{ world: WarRoomParityWorld }>({
  world: async ({ playwright }, use) => {
    void playwright;
    await use(new WarRoomParityWorld());
  },
});

const { Given, When, Then } = createBdd(test, { worldFixture: 'world' });

Given('a game master administers the campaign {string}', function (name: string) {
  this.campaignName = name;
});

Given('a game master administers the VTM V5 campaign {string}', function (name: string) {
  this.campaignName = name;
  this.gameSystemId = 'vtm-v5';
});

Given('the campaign game date has not been set', function () {
  this.gameDate = null;
});

Given('the campaign game date is {string}', function (label: string) {
  this.setGameDate(label);
});

Given('a journal entry {string} was tagged {string}', function (title: string, label: string) {
  this.journalDates.set(title, parseGregorianDate(label));
});

When('the game master sets the game date to {string} from the top bar', function (label: string) {
  this.setGameDate(label);
});

When(
  'the event {string} adds the journal entry {string}',
  function (_eventName: string, title: string) {
    this.addJournalEntry(title);
  },
);

When('the game master changes that journal entry date to {string}', function (label: string) {
  const title = [...this.journalDates.keys()].at(-1);
  if (!title) {
    throw new Error('No journal entry is available to edit.');
  }
  this.changeJournalDate(title, label);
});

Then('the top bar shows the game date {string}', function (label: string) {
  expect(this.gameSystemId).toBe('vtm-v5');
  expect(this.gameDate).not.toBeNull();
  expect(formatGameDate(this.gameDate!, GREGORIAN_CALENDAR)).toBe(label);
});

Then('the top bar still shows the game date {string}', function (label: string) {
  expect(this.gameDate).not.toBeNull();
  expect(formatGameDate(this.gameDate!, GREGORIAN_CALENDAR)).toBe(label);
});

Then('the journal entry {string} is tagged {string}', function (title: string, label: string) {
  const date = this.journalDates.get(title);
  expect(date).toBeDefined();
  expect(formatGameDate(date!, GREGORIAN_CALENDAR)).toBe(label);
});

Given('the campaign is connected to the Discord channel {string}', function (channel: string) {
  this.channelName = channel;
});

Given('the live Play View is open', function () {
  this.livePlayOpen = true;
});

When(
  'the game master tries to broadcast the incomplete narration {string}',
  async function (message: string) {
    await this.broadcast(message);
  },
);

Then('the quick bar explains how to complete the narration', function () {
  expect(this.error).toContain('at least 8 characters');
});

Then('the quick bar keeps {string} for correction', function (message: string) {
  expect(this.draft).toBe(message);
});

When('the game master broadcasts {string}', async function (message: string) {
  await this.broadcast(message);
});

Then('Discord receives the channel narration once', function () {
  expect(this.successfulDeliveryIds.size).toBe(1);
});

Then('the quick bar confirms the broadcast and clears the narration', function () {
  expect(this.notice).toBe('Narration broadcast to the room.');
  expect(this.draft).toBe('');
});

Given('Discord delivery is temporarily unavailable', function () {
  this.deliveryUnavailable = true;
});

Then('the quick bar explains that the broadcast failed', function () {
  expect(this.error).toBe(QUICK_NARRATION_ERROR);
});

Then('the quick bar keeps {string} for retry', function (message: string) {
  expect(this.draft).toBe(message);
});

When('Discord delivery becomes available', function () {
  this.deliveryUnavailable = false;
});

When('the game master retries the quick narration', async function () {
  await this.broadcast();
});

Given('the game master is editing the campaign name as {string}', function (name: string) {
  this.campaignNameDraft = name;
});

Given('campaign updates are temporarily unavailable', function () {
  this.campaignUpdatesUnavailable = true;
});

When('the game master saves the campaign name', function () {
  this.saveCampaignName();
});

Then('the top bar explains that the campaign name was not updated', function () {
  expect(this.renameError).toBe(CAMPAIGN_RENAME_ERROR);
});

Then('{string} remains available for correction', function (name: string) {
  expect(this.campaignNameDraft).toBe(name);
});

Given('the demo and live War Rooms contain equivalent campaign data', function () {
  expect(this.campaignName).toBe('Midnight Chronicle');
  expect(this.channelName).toBe('elysium');
});

When('the game master compares their navigation and player rails', function () {
  this.comparedWarRooms = true;
});

Then('shared modes appear in the same order with the same names', function () {
  expect(this.comparedWarRooms).toBe(true);
  const demoLabels = buildWarRoomModeTabs('/demo', { includePlayer: true })
    .filter((tab) => tab.label !== 'Player')
    .map((tab) => tab.label);
  const liveLabels = buildWarRoomModeTabs('').map((tab) => tab.label);

  expect(demoLabels).toEqual(liveLabels);
});

Then('equivalent players expose the same clan identity cues', function () {
  expect(this.comparedWarRooms).toBe(true);
  expect(getClanTone('Brujah')).toBe('brujah');
  expect(getClanTone('Toreador')).toBe('toreador');
  expect(getClanTone('Unknown')).toBe('neutral');
});
