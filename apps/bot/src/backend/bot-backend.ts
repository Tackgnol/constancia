import {
  createMagicLink,
  createPlayerJournalMagicLink,
  createPlayerSheetMagicLink,
} from '@constancia/api-client/endpoints/auth/auth';
import {
  checkBotAccess,
  createBotMessageReport,
  getBotCampaignDate,
  getBotJournalForPlayer,
  getCampaignByGuild,
  getChannelEvents,
  listBotVisibleNpcsForPlayer,
  removeParticipant,
  setupChannel,
  submitBotTestResult,
  syncParticipants,
} from '@constancia/api-client/endpoints/bot/bot';
import { listCharacters } from '@constancia/api-client/endpoints/characters/characters';
import { listGameSystems } from '@constancia/api-client/endpoints/systems/systems';
import type {
  CreateBotMessageReportBody,
  GetBotJournalForPlayer200Data,
  GetBotJournalForPlayer200DataQuestsItemEntriesItem,
  GetCampaignByGuild200Data,
  GetChannelEvents200DataItem,
  ListBotVisibleNpcsForPlayer200DataItem,
  ListCharacters200DataItem,
  ListGameSystems200DataItem,
  SetupChannel200Data,
  SetupChannelBody,
  SubmitBotTestResult200Data,
  SubmitBotTestResultBody,
} from '@constancia/api-client/model';
import { botRequestOptions } from '../config.js';
import {
  BotCampaignAdminRequiredError,
  campaignAdminRequiredMessage,
  requireApiData,
} from './access-revoked.js';

export type BotCampaign = GetCampaignByGuild200Data;
export type BotChannelEvent = GetChannelEvents200DataItem;
export type BotGameSystem = ListGameSystems200DataItem;
export type BotJournal = GetBotJournalForPlayer200Data;
export type BotJournalQuestEntry = GetBotJournalForPlayer200DataQuestsItemEntriesItem;
export type BotParticipant = ListCharacters200DataItem;
export type BotVisibleNpc = ListBotVisibleNpcsForPlayer200DataItem;
export type BotSetupInput = SetupChannelBody;
export type BotSetupResult = SetupChannel200Data;
export type BotMessageReportInput = CreateBotMessageReportBody;
export type BotTestResultInput = SubmitBotTestResultBody;
export type BotTestResult = SubmitBotTestResult200Data;

export interface BotMagicLink {
  status: 'ok';
  url: string;
  token: string;
  discordUserId: string;
  guildId: string;
  campaignId?: string;
}

export interface BotBackend {
  requireAccess(discordUserId: string, guildId?: string): Promise<void>;
  getCampaignDate(guildId: string): Promise<string | null | undefined>;
  getCampaign(guildId: string): Promise<BotCampaign | null>;
  getChannelEvents(channelId: string): Promise<BotChannelEvent[]>;
  getJournal(campaignId: string, discordUserId: string): Promise<BotJournal>;
  listVisibleNpcs(campaignId: string, discordUserId: string): Promise<BotVisibleNpc[]>;
  listParticipants(campaignId: string): Promise<BotParticipant[]>;
  listGameSystems(): Promise<BotGameSystem[]>;
  setupChannel(input: BotSetupInput): Promise<BotSetupResult>;
  syncParticipants(
    guildId: string,
    participants: Array<{ discordUserId: string; discordName: string }>,
    callerDiscordUserId: string,
  ): Promise<void>;
  removeParticipant(
    guildId: string,
    discordUserId: string,
    callerDiscordUserId: string,
  ): Promise<boolean>;
  requestAdminMagicLink(discordUserId: string, guildId: string): Promise<BotMagicLink>;
  requestPlayerSheetMagicLink(discordUserId: string, guildId: string): Promise<BotMagicLink>;
  requestPlayerJournalMagicLink(discordUserId: string, guildId: string): Promise<BotMagicLink>;
  submitMessageReport(input: BotMessageReportInput): Promise<void>;
  submitTestResult(input: BotTestResultInput): Promise<BotTestResult>;
}

function parseMagicLink(payload: unknown, requireCampaign: boolean): BotMagicLink {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Backend returned an invalid magic link payload');
  }
  const record = payload as Record<string, unknown>;
  if (
    typeof record.url !== 'string' ||
    typeof record.token !== 'string' ||
    typeof record.discordUserId !== 'string' ||
    typeof record.guildId !== 'string' ||
    (requireCampaign && typeof record.campaignId !== 'string')
  ) {
    throw new Error('Backend returned an invalid magic link payload');
  }

  return {
    status: 'ok',
    url: record.url,
    token: record.token,
    discordUserId: record.discordUserId,
    guildId: record.guildId,
    ...(typeof record.campaignId === 'string' ? { campaignId: record.campaignId } : {}),
  };
}

export function createGeneratedBotBackend(
  requestOptions: () => RequestInit = botRequestOptions,
): BotBackend {
  return {
    requireAccess: async (discordUserId, guildId) => {
      requireApiData(
        await checkBotAccess({ discordUserId, ...(guildId ? { guildId } : {}) }, requestOptions()),
        'check interaction access',
      );
    },
    getCampaignDate: async (guildId) => {
      const response = await getBotCampaignDate({ guildId }, requestOptions());
      return response.status === 'ok' ? response.data.formatted : undefined;
    },
    getCampaign: async (guildId) => {
      const response = await getCampaignByGuild({ guildId }, requestOptions());
      return response.status === 'ok' ? response.data : null;
    },
    getChannelEvents: async (channelId) =>
      requireApiData(await getChannelEvents({ channelId }, requestOptions()), 'get channel events'),
    getJournal: async (campaignId, discordUserId) =>
      requireApiData(
        await getBotJournalForPlayer({ id: campaignId, discordUserId }, requestOptions()),
        'get player journal',
      ),
    listVisibleNpcs: async (campaignId, discordUserId) =>
      requireApiData(
        await listBotVisibleNpcsForPlayer({ id: campaignId, discordUserId }, requestOptions()),
        'list visible NPCs',
      ),
    listParticipants: async (campaignId) =>
      requireApiData(
        await listCharacters({ id: campaignId }, requestOptions()),
        'list participants',
      ),
    listGameSystems: async () =>
      requireApiData(await listGameSystems(requestOptions()), 'list game systems'),
    setupChannel: async (input) =>
      requireApiData(await setupChannel(input, requestOptions()), 'set up channel'),
    syncParticipants: async (guildId, participants, callerDiscordUserId) => {
      requireApiData(
        await syncParticipants({ guildId, participants, callerDiscordUserId }, requestOptions()),
        'sync participants',
      );
    },
    removeParticipant: async (guildId, discordUserId, callerDiscordUserId) => {
      const response = await removeParticipant(
        { guildId, discordUserId },
        { callerDiscordUserId },
        requestOptions(),
      );
      if (response.status !== 'ok') {
        const adminRequired = campaignAdminRequiredMessage(response);
        if (adminRequired !== null) throw new BotCampaignAdminRequiredError(adminRequired);
        throw new Error('Backend failed to remove participant');
      }
      return response.deleted;
    },
    requestAdminMagicLink: async (discordUserId, guildId) => {
      const response = await createMagicLink({ discordUserId, guildId }, requestOptions());
      return parseMagicLink(requireApiData(response, 'create admin magic link'), false);
    },
    requestPlayerSheetMagicLink: async (discordUserId, guildId) => {
      const response = await createPlayerSheetMagicLink(
        { discordUserId, guildId },
        requestOptions(),
      );
      return parseMagicLink(requireApiData(response, 'create player sheet magic link'), true);
    },
    requestPlayerJournalMagicLink: async (discordUserId, guildId) => {
      const response = await createPlayerJournalMagicLink(
        { discordUserId, guildId },
        requestOptions(),
      );
      return parseMagicLink(requireApiData(response, 'create player journal magic link'), true);
    },
    submitMessageReport: async (input) => {
      requireApiData(
        await createBotMessageReport(input, requestOptions()),
        'submit message report',
      );
    },
    submitTestResult: async (input) =>
      requireApiData(await submitBotTestResult(input, requestOptions()), 'submit test result'),
  };
}

const notConfigured = async (): Promise<never> => {
  throw new Error('In-memory bot backend method was not configured');
};

export function createInMemoryBotBackend(overrides: Partial<BotBackend> = {}): BotBackend {
  return {
    requireAccess: notConfigured,
    getCampaignDate: notConfigured,
    getCampaign: notConfigured,
    getChannelEvents: notConfigured,
    getJournal: notConfigured,
    listVisibleNpcs: notConfigured,
    listParticipants: notConfigured,
    listGameSystems: notConfigured,
    setupChannel: notConfigured,
    syncParticipants: notConfigured,
    removeParticipant: notConfigured,
    requestAdminMagicLink: notConfigured,
    requestPlayerSheetMagicLink: notConfigured,
    requestPlayerJournalMagicLink: notConfigured,
    submitMessageReport: notConfigured,
    submitTestResult: notConfigured,
    ...overrides,
  };
}

export const botBackend = createGeneratedBotBackend();
