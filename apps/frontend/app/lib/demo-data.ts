import type {
  GetServiceHealth200,
  ListCampaigns200,
  ListGameSystems200,
} from '@constancia/api-client/model';
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
  events: [
    {
      id: 'event-stealth-approach',
      name: 'Stealth Approach',
      type: 'test',
      channelId: 'ch-3',
      campaignId: 'demo-crimson-dynasty',
      status: 'ready',
      shortCircuit: false,
      pipeline: [
        {
          blockType: 'vtm-pool-resolver',
          config: { attribute: 'Dexterity', skill: 'Stealth', difficulty: 2 },
        },
        {
          blockType: 'outcome-map',
          config: {
            outcomes: [
              { minScore: 0, maxScore: 1, text: 'You stumble over a bucket and alert the guard!' },
              { minScore: 2, maxScore: 10, text: 'You move silently through the shadows.' },
            ],
          },
        },
      ],
    },
    {
      id: 'event-social-manipulation',
      name: 'Social Manipulation',
      type: 'test',
      channelId: 'ch-2',
      campaignId: 'demo-crimson-dynasty',
      status: 'ready',
      shortCircuit: false,
      pipeline: [
        {
          blockType: 'vtm-pool-resolver',
          config: { attribute: 'Manipulation', skill: 'Persuasion', difficulty: 4 },
        },
      ],
    },
    {
      id: 'event-elysium-opens',
      name: 'Elysium Opens',
      type: 'narration',
      channelId: 'ch-1',
      campaignId: 'demo-crimson-dynasty',
      status: 'ready',
      shortCircuit: false,
      pipeline: [
        {
          blockType: 'display-image',
          config: {
            imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23',
            caption: 'The grand gates of the Elysium swing open.',
          },
        },
        {
          blockType: 'message-channel',
          config: {
            content: 'The Keeper of Elysium welcomes you to the Crimson Dynasty gathering.',
          },
        },
      ],
    },
    {
      id: 'event-the-betrayal',
      name: 'The Betrayal',
      type: 'narration',
      channelId: 'ch-2',
      campaignId: 'demo-crimson-dynasty',
      status: 'ready',
      shortCircuit: false,
      pipeline: [
        {
          blockType: 'display-image',
          config: {
            imageUrl: 'https://images.unsplash.com/photo-1501446522555-3290b7af2eb4',
            caption: 'Gasps echo through the court as the truth comes to light.',
          },
        },
        {
          blockType: 'message-channel',
          config: {
            content: 'The Harpy reveals a secret that could destroy the local hierarchy.',
          },
        },
      ],
    },
    {
      id: 'event-princes-warning',
      name: "Prince's Warning",
      type: 'message',
      channelId: 'ch-2',
      campaignId: 'demo-crimson-dynasty',
      status: 'ready',
      shortCircuit: false,
      pipeline: [
        {
          blockType: 'message-player',
          config: {
            content: 'Watch your step, Aleksei. The Harpy has eyes everywhere tonight.',
            playerIds: ['aleksei'],
          },
        },
      ],
    },
    {
      id: 'event-sires-whisper',
      name: "Sire's Whisper",
      type: 'message',
      channelId: 'ch-1',
      campaignId: 'demo-crimson-dynasty',
      status: 'ready',
      shortCircuit: false,
      pipeline: [
        {
          blockType: 'message-player',
          config: {
            content: 'Do not forget who you serve, Vivienne. The gathering is a test.',
            playerIds: ['vivienne'],
          },
        },
      ],
    },
    {
      id: 'event-occult-sigils',
      name: 'Occult Sigils',
      type: 'insight',
      channelId: 'ch-2',
      campaignId: 'demo-crimson-dynasty',
      status: 'ready',
      shortCircuit: false,
      pipeline: [
        {
          blockType: 'conditional-gate',
          config: { statPath: 'skills.occult', operator: 'gte', threshold: 4 },
        },
        {
          blockType: 'message-player',
          config: {
            content: 'The sigils on the wall are clearly Tremere warding marks.',
          },
        },
      ],
    },
    {
      id: 'event-hidden-weapon',
      name: 'Hidden Weapon',
      type: 'insight',
      channelId: 'ch-3',
      campaignId: 'demo-crimson-dynasty',
      status: 'ready',
      shortCircuit: false,
      pipeline: [
        {
          blockType: 'conditional-gate',
          config: { statPath: 'skills.awareness', operator: 'gte', threshold: 3 },
        },
        {
          blockType: 'message-player',
          config: {
            content: 'You notice a glint of steel hidden under the table.',
          },
        },
      ],
    },
  ],
};
