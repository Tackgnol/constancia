import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCharacterSheetForActor,
  getPlayerCharacterSheet,
  updateCharacterSheetForActor,
} from '../services/character-sheets.js';

const prismaMock = {
  character: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  campaignAdmin: {
    findUnique: vi.fn(),
  },
} as const;

const baseRecord = {
  id: 'char-1',
  name: 'Player One',
  discordName: 'discord-one',
  gameName: 'Lucien',
  discordUserId: 'discord-user-1',
  campaignId: 'campaign-1',
  backstory: 'Backstory',
  notes: 'Notes',
  systemData: {
    clan: 'Toreador',
    attributes: { wits: 3, resolve: 2 },
    skills: { awareness: 2, occult: 1 },
  },
  campaign: {
    id: 'campaign-1',
    name: 'Chicago by Night',
    discordGuildId: 'guild-1',
    gameSystemId: 'vtm-v5',
  },
};

describe('character sheet service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lets a GM read another player sheet', async () => {
    prismaMock.character.findUnique.mockResolvedValue(baseRecord);
    prismaMock.campaignAdmin.findUnique.mockResolvedValue({ id: 'admin-1' });

    const sheet = await getCharacterSheetForActor(
      prismaMock as never,
      'campaign-1',
      'char-1',
      'discord-gm-1',
    );

    expect(sheet?.access).toEqual({ mode: 'gm', canEdit: true });
    expect(sheet?.stats).toMatchObject({ wits: 3, awareness: 2 });
  });

  it('blocks a player from reading someone else sheet', async () => {
    prismaMock.character.findUnique.mockResolvedValue(baseRecord);
    prismaMock.campaignAdmin.findUnique.mockResolvedValue(null);

    await expect(
      getCharacterSheetForActor(prismaMock as never, 'campaign-1', 'char-1', 'discord-user-2'),
    ).resolves.toBeNull();
  });

  it('loads the current player sheet by discord identity', async () => {
    prismaMock.character.findUnique.mockResolvedValue(baseRecord);
    prismaMock.campaignAdmin.findUnique.mockResolvedValue(null);

    const sheet = await getPlayerCharacterSheet(
      prismaMock as never,
      'campaign-1',
      'discord-user-1',
    );

    expect(sheet?.access).toEqual({ mode: 'player', canEdit: true });
    expect(sheet?.character.discordUserId).toBe('discord-user-1');
  });

  it('updates structured stats while preserving unrelated system data', async () => {
    prismaMock.character.findUnique.mockResolvedValue(baseRecord);
    prismaMock.campaignAdmin.findUnique.mockResolvedValue({ id: 'admin-1' });
    prismaMock.character.update.mockResolvedValue({
      ...baseRecord,
      gameName: 'Lucien Vale',
      systemData: {
        clan: 'Toreador',
        attributes: {
          strength: 0,
          dexterity: 0,
          stamina: 0,
          charisma: 0,
          manipulation: 0,
          composure: 0,
          intelligence: 0,
          wits: 4,
          resolve: 2,
        },
        skills: {
          athletics: 0,
          brawl: 0,
          craft: 0,
          drive: 0,
          firearms: 0,
          larceny: 0,
          melee: 0,
          stealth: 0,
          survival: 0,
          animalKen: 0,
          etiquette: 0,
          insight: 0,
          intimidation: 0,
          leadership: 0,
          performance: 0,
          persuasion: 0,
          streetwise: 0,
          subterfuge: 0,
          academics: 0,
          awareness: 3,
          finance: 0,
          investigation: 0,
          medicine: 0,
          occult: 1,
          politics: 0,
          science: 0,
          technology: 0,
        },
      },
    });

    const sheet = await updateCharacterSheetForActor(
      prismaMock as never,
      'campaign-1',
      'char-1',
      'discord-gm-1',
      {
        gameName: 'Lucien Vale',
        stats: {
          wits: 4,
          awareness: 3,
        },
      },
    );

    expect(prismaMock.character.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'char-1' },
        data: expect.objectContaining({
          gameName: 'Lucien Vale',
          systemData: expect.objectContaining({
            clan: 'Toreador',
            attributes: expect.objectContaining({ wits: 4, resolve: 2 }),
            skills: expect.objectContaining({ awareness: 3, occult: 1 }),
          }),
        }),
      }),
    );
    expect(sheet?.stats).toMatchObject({ wits: 4, awareness: 3 });
  });
});
