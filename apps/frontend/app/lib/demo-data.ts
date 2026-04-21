import type {
  GetServiceHealth200,
  ListCampaigns200,
  ListGameSystems200,
} from '@/api/generated/model';
import { activityFeed, players, sessionTags } from './war-room-data.js';
import type { WarRoomContext } from './war-room-data.js';

export const demoHealth: GetServiceHealth200 = {
  status: 'ok',
  service: 'constancia-backend',
  environment: 'demo',
};

export const demoCampaigns: ListCampaigns200 = {
  status: 'ok',
  data: [
    {
      id: 'demo-crimson-dynasty',
      name: 'Crimson Dynasty',
      discordGuildId: 'demo-guild-1',
      gameSystemId: 'vtm-v5',
    },
  ],
};

export const demoSystems: ListGameSystems200 = {
  status: 'ok',
  data: [
    { id: 'vtm-v5', name: 'Vampire: The Masquerade V5', version: '0.1.0' },
    { id: 'mork-borg', name: 'Mörk Borg', version: '0.1.0' },
  ],
};

export const demoContext: WarRoomContext = {
  rawCharacters: [],
  campaign: {
    id: 'demo-crimson-dynasty',
    name: 'Crimson Dynasty',
    channel: '# the-elysium',
    connectedPlayers: players.filter((p) => p.status === 'online').length,
  },
  channels: [
    { id: 'ch-1', discordId: '1', name: 'the-elysium' },
    { id: 'ch-2', discordId: '2', name: 'harpy-court' },
    { id: 'ch-3', discordId: '3', name: 'basement' },
  ],
  system: { id: 'vtm-v5', name: 'VTM V5' },
  tags: sessionTags,
  activeTag: null,
  players,
  activity: activityFeed,
  apiOnline: true,
  events: [],
};
