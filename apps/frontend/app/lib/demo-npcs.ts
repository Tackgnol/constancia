import type { CampaignNpc } from '@/components/npcs/block-registry';

export const demoNpcs: CampaignNpc[] = [
  {
    id: 'demo-prince-adrian-voss',
    name: 'Prince Adrian Voss',
    imageUrl: null,
    description:
      'Keeps the city stable through debt, spectacle, and the quiet certainty that everybody already owes him twice.',
    systemBlocks: [
      { systemId: 'vtm-v5', blockType: 'clan', label: 'Clan', value: 'Ventrue' },
      { systemId: 'vtm-v5', blockType: 'title', label: 'Title', value: 'Prince' },
      {
        systemId: 'vtm-v5',
        blockType: 'demeanor',
        label: 'Demeanor',
        value: 'Measured, aristocratic, and incapable of sounding hurried even when furious.',
      },
    ],
    campaignId: 'demo-crimson-dynasty',
    facts: [
      {
        id: 'demo-prince-fact-1',
        content: 'He keeps a private ledger of every boon traded in Elysium.',
        sortOrder: 0,
        npcId: 'demo-prince-adrian-voss',
        knownTo: [
          {
            characterId: 'demo-char-aleksei',
            discordUserId: 'aleksei',
            displayName: 'Aleksei Volkov',
            secondaryLabel: 'Marcin · aleksei',
          },
          {
            characterId: 'demo-char-vivienne',
            discordUserId: 'vivienne',
            displayName: 'Vivienne Lacroix',
            secondaryLabel: 'Kasia · vivienne',
          },
        ],
      },
      {
        id: 'demo-prince-fact-2',
        content: 'The Prince still answers to a mortal accountant who never learned the truth.',
        sortOrder: 1,
        npcId: 'demo-prince-adrian-voss',
        knownTo: [],
      },
    ],
  },
  {
    id: 'demo-mara-the-veiled',
    name: 'Mara the Veiled',
    imageUrl: null,
    description:
      'Information broker, court whisperer, and the first person to know when a secret starts to rot.',
    systemBlocks: [
      { systemId: 'vtm-v5', blockType: 'clan', label: 'Clan', value: 'Nosferatu' },
      { systemId: 'vtm-v5', blockType: 'network', label: 'Network', value: 'Sewer couriers' },
    ],
    campaignId: 'demo-crimson-dynasty',
    facts: [
      {
        id: 'demo-mara-fact-1',
        content: 'She trades in rumors only after hearing them from three different mouths.',
        sortOrder: 0,
        npcId: 'demo-mara-the-veiled',
        knownTo: [
          {
            characterId: 'demo-char-marcus',
            discordUserId: 'marcus',
            displayName: 'Marcus Webb',
            secondaryLabel: 'Piotr · marcus',
          },
        ],
      },
      {
        id: 'demo-mara-fact-2',
        content: 'She maintains a dead-drop under the third pew in Saint Brigid’s chapel.',
        sortOrder: 1,
        npcId: 'demo-mara-the-veiled',
        knownTo: [
          {
            characterId: 'demo-char-vivienne',
            discordUserId: 'vivienne',
            displayName: 'Vivienne Lacroix',
            secondaryLabel: 'Kasia · vivienne',
          },
        ],
      },
    ],
  },
];
