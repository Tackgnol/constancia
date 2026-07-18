import type { ListCharacters200DataItem } from '@constancia/api-client/model';
import { GREGORIAN_CALENDAR } from '@constancia/systems';
import { activityFeed, players, sessionTags } from './war-room-data.js';
import type { WarRoomContext } from './war-room-data.js';

const demoCharacters: ListCharacters200DataItem[] = players.map((player) => ({
  id: player.id,
  name: player.player,
  discordUserId: player.id,
  discordName: player.player,
  gameName: player.name,
  campaignId: 'demo-crimson-dynasty',
  backstory: '',
  notes: '',
  systemData: { clan: player.character },
}));

export const demoContext: WarRoomContext = {
  rawCharacters: demoCharacters,
  campaign: {
    id: 'demo-crimson-dynasty',
    name: 'Crimson Dynasty',
    gameSystemId: 'vtm-v5',
    gameDate: { calendarId: 'gregorian', year: 2026, monthId: 'july', day: 17 },
    channel: '# the-elysium',
    connectedPlayers: players.filter((p) => p.status === 'online').length,
  },
  channels: [
    { id: 'ch-1', discordId: '1', name: 'the-elysium' },
    { id: 'ch-2', discordId: '2', name: 'harpy-court' },
    { id: 'ch-3', discordId: '3', name: 'basement' },
  ],
  system: {
    id: 'vtm-v5',
    name: 'VTM V5',
    defaultCalendarId: GREGORIAN_CALENDAR.id,
    calendars: { [GREGORIAN_CALENDAR.id]: GREGORIAN_CALENDAR },
  },
  tags: sessionTags,
  activeTag: null,
  players,
  activity: activityFeed,
  apiOnline: true,
  lore: [
    {
      id: 'lore-elysium-bells',
      title: 'The Elysium bells',
      content:
        'Three chimes mean a formal boon has been called. Four chimes mean the Keeper has found blood on protected ground.',
      campaignId: 'demo-crimson-dynasty',
      sortOrder: 0,
      knownTo: [
        {
          characterId: 'aleksei',
          discordUserId: 'aleksei',
          displayName: 'Aleksei Volkov',
          secondaryLabel: 'Brujah · Marcin',
        },
      ],
    },
    {
      id: 'lore-harpy-ledger',
      title: 'The Harpy ledger',
      content:
        'The missing ledger tracks boons in red ink and punishments in black. A blank line beside a name is worse than a debt.',
      campaignId: 'demo-crimson-dynasty',
      sortOrder: 1,
      knownTo: [],
    },
  ],
  quests: [
    {
      id: 'quest-blood-ledger',
      name: 'Recover the blood ledger',
      description:
        'Find the ledger before the Harpy can use the debt records to fracture the coterie.',
      campaignId: 'demo-crimson-dynasty',
      status: 'active',
      sortOrder: 0,
      visible: true,
      entries: [
        {
          id: 'quest-entry-ledger-1',
          questId: 'quest-blood-ledger',
          content: 'Question the Elysium steward about the missing archive key.',
          status: 'done',
          sortOrder: 0,
        },
        {
          id: 'quest-entry-ledger-2',
          questId: 'quest-blood-ledger',
          content: 'Search the basement records room before dawn.',
          status: 'pending',
          sortOrder: 1,
        },
      ],
    },
    {
      id: 'quest-chantry-signal',
      name: 'Trace the chantry signal',
      description: 'Identify who placed Tremere marks inside the court without causing open panic.',
      campaignId: 'demo-crimson-dynasty',
      status: 'active',
      sortOrder: 1,
      visible: false,
      entries: [
        {
          id: 'quest-entry-chantry-1',
          questId: 'quest-chantry-signal',
          content: 'Compare the sigils against Vivienne’s occult notes.',
          status: 'pending',
          sortOrder: 0,
        },
      ],
    },
  ],
  summaries: [
    {
      id: 'demo-summary-elysium',
      title: 'Elysium fractures',
      content:
        'The ledger vanished during the prince’s reception. The coterie left with one boon, two enemies, and a name nobody wanted spoken aloud.',
      campaignId: 'demo-crimson-dynasty',
      sessionDate: '2026-07-17T20:00:00.000Z',
      gameDate: { calendarId: 'gregorian', year: 2026, monthId: 'july', day: 17 },
      visible: true,
    },
  ],
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
          config: { attribute: 'Dexterity', skill: 'Stealth' },
        },
        {
          blockType: 'outcome-map',
          config: {
            outcomes: [
              { threshold: 0, text: 'You stumble over a bucket and alert the guard!' },
              { threshold: 1, text: 'You move silently through the shadows.' },
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
          config: { attribute: 'Manipulation', skill: 'Persuasion' },
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
