import { listCampaigns } from '@constancia/api-client/endpoints/campaigns/campaigns';
import { listChannels } from '@constancia/api-client/endpoints/channels/channels';
import { listCharacters } from '@constancia/api-client/endpoints/characters/characters';
import { listEvents } from '@constancia/api-client/endpoints/events/events';
import { listQuests, listSessionSummaries } from '@constancia/api-client/endpoints/journal/journal';
import { listLoreEntries } from '@constancia/api-client/endpoints/lore/lore';
import { getServiceHealth } from '@constancia/api-client/endpoints/meta/meta';
import { listNpcs } from '@constancia/api-client/endpoints/npcs/npcs';
import { listGameSystems } from '@constancia/api-client/endpoints/systems/systems';
import { parseGameDate } from '@constancia/systems';
import { buildServerApiOptions } from './api-proxy.server.js';
import {
  fallbackCampaign,
  fallbackSystem,
  players as fallbackPlayers,
  type CampaignSummary,
  type ChannelEntry,
  type PlayerPresence,
  type SystemSummary,
} from './war-room-data.js';
import { countEventsByChannel, type WarRoomProjection } from './war-room-projection.js';

export type LiveWarRoomProjectionResult =
  | { status: 'authenticated'; projection: WarRoomProjection }
  | { status: 'unauthenticated' };

export async function loadLiveWarRoomProjection(
  request: Request,
): Promise<LiveWarRoomProjectionResult> {
  const options = buildServerApiOptions(request);
  const [health, campaigns, systems] = await Promise.all([
    getServiceHealth(options),
    listCampaigns(options),
    listGameSystems(options),
  ]);

  if (campaigns.status !== 'ok') {
    return { status: 'unauthenticated' };
  }

  const campaignRecord = campaigns.data[0];
  const campaignId = campaignRecord?.id;
  const [
    channelsResponse,
    eventsResponse,
    charactersResponse,
    questsResponse,
    summariesResponse,
    loreResponse,
    npcsResponse,
  ] = campaignId
    ? await Promise.all([
        listChannels({ id: campaignId }, options),
        listEvents({ id: campaignId }, options),
        listCharacters({ id: campaignId }, options),
        listQuests({ id: campaignId }, options),
        listSessionSummaries({ id: campaignId }, options),
        listLoreEntries({ id: campaignId }, options),
        listNpcs({ id: campaignId }, options),
      ])
    : [null, null, null, null, null, null, null];

  const channels: ChannelEntry[] =
    channelsResponse?.status === 'ok'
      ? channelsResponse.data.map((channel) => ({
          id: channel.id,
          discordId: channel.discordChannelId,
          name: channel.name,
        }))
      : [];
  const rawCharacters = charactersResponse?.status === 'ok' ? charactersResponse.data : [];
  const players: PlayerPresence[] = rawCharacters.map((character) => {
    const clan =
      typeof character.systemData?.clan === 'string' ? character.systemData.clan : 'Unknown';
    return {
      id: character.id,
      name: character.gameName || character.discordName || character.name,
      character: clan,
      player: character.discordName || character.name,
      status: 'online',
    };
  });

  const campaign: CampaignSummary = campaignRecord
    ? {
        id: campaignRecord.id,
        name: campaignRecord.name,
        gameSystemId: campaignRecord.gameSystemId,
        gameDate: parseGameDate(campaignRecord.gameDate),
        channel: channels[0] ? `# ${channels[0].name}` : fallbackCampaign.channel,
        connectedPlayers: players.length,
      }
    : fallbackCampaign;
  const systemRecord =
    systems.status === 'ok'
      ? (systems.data.find((system) => system.id === campaign.gameSystemId) ?? systems.data[0])
      : undefined;
  const system: SystemSummary = systemRecord
    ? {
        id: systemRecord.id,
        name: systemRecord.name,
        defaultCalendarId: systemRecord.defaultCalendarId,
        calendars: systemRecord.calendars,
      }
    : fallbackSystem;
  const events = eventsResponse?.status === 'ok' ? eventsResponse.data : [];

  return {
    status: 'authenticated',
    projection: {
      campaign,
      channels,
      system,
      tags: channels.map((channel) => ({ id: channel.id, label: `# ${channel.name}` })),
      players: players.length > 0 ? players : fallbackPlayers,
      rawCharacters,
      // No live activity-feed endpoint exists yet (see apps/backend/src/routes).
      // Do not fall back to the demo fixture here: an authenticated live campaign
      // must never display another table's hardcoded demo activity. Once a real
      // endpoint exists, source this from it instead of leaving it empty.
      activity: [],
      apiOnline: health.status === 'ok',
      events,
      quests: questsResponse?.status === 'ok' ? questsResponse.data : [],
      summaries: summariesResponse?.status === 'ok' ? summariesResponse.data : [],
      lore: loreResponse?.status === 'ok' ? loreResponse.data : [],
      npcs: npcsResponse?.status === 'ok' ? npcsResponse.data : [],
      eventCountByTag: countEventsByChannel(events),
    },
  };
}
