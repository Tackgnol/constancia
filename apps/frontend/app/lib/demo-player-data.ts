import type { GetVisibleNpcForCurrentPlayer200Data } from '@constancia/api-client/model';
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

export function getDemoPlayerNpc(npcId: string): GetVisibleNpcForCurrentPlayer200Data | null {
  return demoPlayerNpcs.find((npc) => npc.id === npcId) ?? null;
}
