import type {
  GetJournalForCurrentPlayer200Data,
  GetVisibleNpcForCurrentPlayer200Data,
} from '@constancia/api-client/model';
import { VTM_STAT_SCHEMA } from '@constancia/systems';
import type { CharacterSheetData } from '@/lib/character-sheet';

export const demoPlayerSheet: CharacterSheetData = {
  character: {
    id: 'demo-char-aleksei',
    name: 'aleksei',
    discordName: 'Marcin',
    gameName: 'Aleksei Volkov',
    discordUserId: 'aleksei',
    campaignId: 'demo-crimson-dynasty',
    backstory:
      'A former dock union enforcer who learned too late that righteous anger can be mortgaged by older monsters.',
    notes:
      'Owes one public boon to Prince Voss. Privately suspects the Harpy is using the missing ledger to isolate the coterie.',
    systemData: {
      clan: 'Brujah',
      attributes: {
        strength: 3,
        dexterity: 2,
        stamina: 3,
        charisma: 2,
        manipulation: 1,
        composure: 2,
        intelligence: 2,
        wits: 3,
        resolve: 3,
      },
      skills: {
        athletics: 3,
        brawl: 3,
        awareness: 2,
        insight: 2,
        intimidation: 3,
        persuasion: 1,
        stealth: 1,
        streetwise: 2,
      },
    },
  },
  campaign: {
    id: 'demo-crimson-dynasty',
    name: 'Crimson Dynasty',
    discordGuildId: 'demo-guild-1',
    gameSystemId: 'vtm-v5',
  },
  system: {
    id: 'vtm-v5',
    name: 'Vampire: The Masquerade 5th Edition',
    version: '0.1.0',
    statSchema: VTM_STAT_SCHEMA,
  },
  stats: {
    strength: 3,
    dexterity: 2,
    stamina: 3,
    charisma: 2,
    manipulation: 1,
    composure: 2,
    intelligence: 2,
    wits: 3,
    resolve: 3,
    athletics: 3,
    brawl: 3,
    awareness: 2,
    insight: 2,
    intimidation: 3,
    persuasion: 1,
    stealth: 1,
    streetwise: 2,
  },
  access: {
    mode: 'player',
    canEdit: true,
  },
};

export const demoPlayerNpcs: GetVisibleNpcForCurrentPlayer200Data[] = [
  {
    id: 'demo-prince-adrian-voss',
    name: 'Prince Adrian Voss',
    imageUrl: undefined,
    campaignId: 'demo-crimson-dynasty',
    facts: [
      {
        id: 'demo-prince-fact-1',
        content: 'He keeps a private ledger of every boon traded in Elysium.',
        sortOrder: 0,
        npcId: 'demo-prince-adrian-voss',
      },
    ],
  },
  {
    id: 'demo-mara-the-veiled',
    name: 'Mara the Veiled',
    imageUrl: undefined,
    campaignId: 'demo-crimson-dynasty',
    facts: [
      {
        id: 'demo-mara-fact-1',
        content: 'She trades in rumors only after hearing them from three different mouths.',
        sortOrder: 0,
        npcId: 'demo-mara-the-veiled',
      },
    ],
  },
];

export const demoPlayerJournal: GetJournalForCurrentPlayer200Data = {
  quests: [
    {
      id: 'demo-quest-ledger',
      name: 'Recover the Harpy ledger',
      description: 'Find who lifted the Elysium ledger before Prince Voss turns the room on you.',
      campaignId: 'demo-crimson-dynasty',
      status: 'active',
      sortOrder: 0,
      visible: true,
      entries: [
        {
          id: 'demo-quest-ledger-step-1',
          content: 'Question the last neonate seen near the gallery exit.',
          questId: 'demo-quest-ledger',
          status: 'done',
          sortOrder: 0,
        },
        {
          id: 'demo-quest-ledger-step-2',
          content: 'Get Mara to confirm whether the ledger was traded or destroyed.',
          questId: 'demo-quest-ledger',
          status: 'pending',
          sortOrder: 1,
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
      sessionDate: '2026-04-28T20:00:00.000Z',
      visible: true,
      channelId: undefined,
    },
  ],
  npcs: demoPlayerNpcs,
  lore: [
    {
      id: 'demo-lore-bells',
      title: 'The Elysium bells',
      content:
        'Three chimes mean a formal boon has been called. Four chimes mean the Keeper found blood on protected ground.',
      campaignId: 'demo-crimson-dynasty',
      sortOrder: 0,
    },
  ],
};

export function getDemoPlayerNpc(npcId: string): GetVisibleNpcForCurrentPlayer200Data | null {
  return demoPlayerNpcs.find((npc) => npc.id === npcId) ?? null;
}
