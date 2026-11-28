import type { ListCharacters200DataItem } from '@constancia/api-client/model';
import { FIVE_E_STAT_SCHEMA, GREGORIAN_CALENDAR, ProficiencyTier } from '@constancia/systems';
import type { CampaignNpc } from '@/components/npcs/block-registry';
import type { CharacterSheetData } from './character-sheet.js';
import { demoContext } from './demo-data.js';
import type { PlayerPresence, WarRoomContext } from './war-room-data.js';
import { PIPELINE_BLOCK } from '@constancia/block-catalogue';
import { GAME_SYSTEM } from '@constancia/contracts';

export const DEMO_5E_CAMPAIGN_ID = 'demo-ember-vale';
// shortcut: the 5E demo is picked per request with ?system=5e-srd and links don't carry it; add a
// demo campaign switcher if the demo needs more than direct links.
export const DEMO_5E_SYSTEM_QUERY = GAME_SYSTEM.FiveESrd;

/** Whether a demo request asked for the 5E campaign. */
export function isDemo5eRequest(request: Request): boolean {
  return new URL(request.url).searchParams.get('system') === DEMO_5E_SYSTEM_QUERY;
}

const { Proficient, Expertise } = ProficiencyTier;

const party = [
  {
    id: 'demo-5e-p1',
    player: 'Ania',
    name: 'Brakka Stonehew',
    class: 'Fighter',
    species: 'Dwarf',
    stats: {
      core: { level: 5 },
      abilities: { str: 17, dex: 12, con: 16, int: 10, wis: 12, cha: 8 },
      saves: { strSave: true, conSave: true },
      skills: { athletics: Proficient, intimidation: Proficient, perception: Proficient },
      vitals: { hpMax: 49, hpCurrent: 41, ac: 18 },
    },
  },
  {
    id: 'demo-5e-p2',
    player: 'Marek',
    name: 'Wren Underbough',
    class: 'Rogue',
    species: 'Halfling',
    stats: {
      core: { level: 5 },
      abilities: { str: 8, dex: 18, con: 12, int: 13, wis: 11, cha: 14 },
      saves: { dexSave: true, intSave: true },
      skills: {
        stealth: Expertise,
        sleightOfHand: Expertise,
        acrobatics: Proficient,
        perception: Proficient,
        deception: Proficient,
        investigation: Proficient,
      },
      vitals: { hpMax: 33, hpCurrent: 33, ac: 15 },
    },
  },
  {
    id: 'demo-5e-p3',
    player: 'Ola',
    name: 'Ilvara Sel',
    class: 'Wizard',
    species: 'Elf',
    stats: {
      core: { level: 5 },
      abilities: { str: 8, dex: 14, con: 13, int: 18, wis: 12, cha: 10 },
      saves: { intSave: true, wisSave: true },
      skills: {
        arcana: Proficient,
        history: Proficient,
        investigation: Proficient,
        insight: Proficient,
      },
      vitals: { hpMax: 27, hpCurrent: 19, ac: 12 },
    },
  },
  {
    id: 'demo-5e-p4',
    player: 'Tomek',
    name: 'Corvin Ashmark',
    class: 'Cleric',
    species: 'Tiefling',
    stats: {
      core: { level: 5 },
      abilities: { str: 14, dex: 10, con: 14, int: 10, wis: 17, cha: 13 },
      saves: { wisSave: true, chaSave: true },
      skills: { insight: Proficient, medicine: Proficient, religion: Proficient },
      vitals: { hpMax: 38, hpCurrent: 38, ac: 18 },
    },
  },
] as const;

const players: PlayerPresence[] = party.map((member) => ({
  id: member.id,
  name: member.name,
  character: member.class,
  player: member.player,
  status: 'online',
}));

const rawCharacters: ListCharacters200DataItem[] = party.map((member) => ({
  id: member.id,
  name: member.player,
  discordUserId: member.id,
  discordName: member.player,
  gameName: member.name,
  campaignId: DEMO_5E_CAMPAIGN_ID,
  backstory: '',
  notes: '',
  systemData: { archetypes: { class: member.class, species: member.species }, ...member.stats },
}));

export const demo5eContext: WarRoomContext = {
  ...demoContext,
  rawCharacters,
  players,
  campaign: {
    id: DEMO_5E_CAMPAIGN_ID,
    name: 'Ember Vale',
    gameSystemId: GAME_SYSTEM.FiveESrd,
    gameDate: { calendarId: 'gregorian', year: 1492, monthId: 'march', day: 3 },
    channel: '# the-ember-road',
    connectedPlayers: players.length,
  },
  system: {
    id: GAME_SYSTEM.FiveESrd,
    name: '5E (SRD 5.2.1)',
    defaultCalendarId: GREGORIAN_CALENDAR.id,
    calendars: { [GREGORIAN_CALENDAR.id]: GREGORIAN_CALENDAR },
  },
  lore: [],
  quests: [],
  summaries: [],
  events: [
    {
      id: 'event-5e-sneak',
      name: 'Slip Past the Toll Gate',
      type: 'test',
      channelId: 'ch-3',
      campaignId: DEMO_5E_CAMPAIGN_ID,
      status: 'ready',
      shortCircuit: true,
      pipeline: [
        { blockType: PIPELINE_BLOCK.RollModifier, config: { mode: 'advantage' } },
        {
          blockType: PIPELINE_BLOCK.TestResolver,
          config: { mode: 'check', ability: 'dex', skill: 'stealth' },
        },
        {
          blockType: PIPELINE_BLOCK.OutcomeMap,
          config: {
            comparison: 'gte',
            outcomes: [
              { threshold: 0, text: 'A guard turns; the lantern swings your way.' },
              { threshold: 15, text: 'You pass under the gate unseen.' },
            ],
          },
        },
      ],
    },
    {
      id: 'event-5e-rockfall',
      name: 'Rockfall',
      type: 'test',
      channelId: 'ch-1',
      campaignId: DEMO_5E_CAMPAIGN_ID,
      status: 'ready',
      shortCircuit: true,
      pipeline: [
        { blockType: PIPELINE_BLOCK.TestResolver, config: { mode: 'save', ability: 'dex' } },
        {
          blockType: PIPELINE_BLOCK.OutcomeMap,
          config: {
            comparison: 'gte',
            outcomes: [
              { threshold: 0, text: 'Stones hammer your shoulders as you dive aside.' },
              { threshold: 13, text: 'You roll clear of the falling rock.' },
            ],
          },
        },
      ],
    },
    {
      id: 'event-5e-ambush-sign',
      name: 'Signs of an Ambush',
      type: 'insight',
      channelId: 'ch-1',
      campaignId: DEMO_5E_CAMPAIGN_ID,
      status: 'ready',
      shortCircuit: true,
      pipeline: [
        {
          blockType: PIPELINE_BLOCK.InsightResolver,
          config: { ability: 'wis', skill: 'perception' },
        },
        {
          blockType: PIPELINE_BLOCK.OutcomeMap,
          config: {
            comparison: 'gte',
            outcomes: [
              { threshold: 14, text: 'Fresh boot prints lead off the road into the brush.' },
            ],
          },
        },
      ],
    },
  ],
};

export const demo5eNpcs: CampaignNpc[] = [
  {
    id: 'npc-5e-warden',
    campaignId: DEMO_5E_CAMPAIGN_ID,
    name: 'Warden Hessa Coil',
    description: 'Keeper of the toll gate who counts every coin twice.',
    systemBlocks: [
      {
        systemId: GAME_SYSTEM.FiveESrd,
        blockType: '5e-srd-creature-type',
        label: 'Creature type',
        value: 'Humanoid',
      },
      {
        systemId: GAME_SYSTEM.FiveESrd,
        blockType: '5e-srd-challenge-rating',
        label: 'Challenge rating',
        value: '3',
      },
      {
        systemId: GAME_SYSTEM.FiveESrd,
        blockType: '5e-srd-stat-summary',
        label: 'Stat summary',
        value: { ac: 16, hp: 58, str: 14, dex: 12, con: 14, int: 11, wis: 13, cha: 12 },
      },
    ],
    facts: [],
  },
  {
    id: 'npc-5e-ashwing',
    campaignId: DEMO_5E_CAMPAIGN_ID,
    name: 'Ashwing',
    description: 'A young red dragon nesting above the vale.',
    systemBlocks: [
      {
        systemId: GAME_SYSTEM.FiveESrd,
        blockType: '5e-srd-creature-type',
        label: 'Creature type',
        value: 'Dragon',
      },
      {
        systemId: GAME_SYSTEM.FiveESrd,
        blockType: '5e-srd-challenge-rating',
        label: 'Challenge rating',
        value: '10',
      },
    ],
    facts: [],
  },
];

const wren = party[1];

export const demo5ePlayerSheet: CharacterSheetData = {
  character: {
    id: wren.id,
    name: wren.player,
    discordName: wren.player,
    gameName: wren.name,
    discordUserId: wren.id,
    campaignId: DEMO_5E_CAMPAIGN_ID,
    backstory: 'A gate-runner who learned every rooftop in the vale before she could read.',
    notes: 'Owes Warden Coil twelve silver.',
    systemData: { archetypes: { class: wren.class, species: wren.species }, ...wren.stats },
  },
  campaign: {
    id: DEMO_5E_CAMPAIGN_ID,
    name: 'Ember Vale',
    discordGuildId: 'demo',
    gameSystemId: GAME_SYSTEM.FiveESrd,
  },
  system: {
    id: GAME_SYSTEM.FiveESrd,
    name: '5E (SRD 5.2.1)',
    version: '0.1.0',
    statSchema: FIVE_E_STAT_SCHEMA,
  },
  stats: {
    level: 5,
    ...wren.stats.abilities,
    ...wren.stats.saves,
    ...wren.stats.skills,
    ...wren.stats.vitals,
  },
  access: { mode: 'player', canEdit: true },
};
