import { describe, expect, it } from 'vitest';
import { ProgenyImportError, parseProgenyVtmCharacter } from '../vtm-v5/progeny.js';

const progenyExport = {
  id: '',
  name: 'Dr. Henryk Miedziński',
  description: 'A spectral surgeon turned apex predator.',
  player: '',
  chronicle: '',
  clan: 'Lasombra',
  attributes: {
    strength: 4,
    charisma: 2,
    intelligence: 3,
  },
  skills: {
    brawl: 3,
    intimidation: 3,
    'animal ken': 2,
  },
  disciplines: [
    {
      name: 'Cloud Memory',
      discipline: 'dominate',
      level: 1,
    },
  ],
  touchstones: [
    {
      name: "His Sire's Field Surgeon's Kit",
      conviction: 'Every blade has two purposes.',
    },
  ],
  notes: 'Keep the tools clean.',
  version: 7,
  characterVersion: 0,
};

describe('Progeny VTM import', () => {
  it('maps a Progeny export into the canonical VTM sheet shape', () => {
    const imported = parseProgenyVtmCharacter(progenyExport);

    expect(imported.gameName).toBe('Dr. Henryk Miedziński');
    expect(imported.backstory).toBe('A spectral surgeon turned apex predator.');
    expect(imported.notes).toBe('Keep the tools clean.');
    expect(imported.systemData.clan).toBe('Lasombra');
    expect(imported.systemData.attributes).toMatchObject({
      strength: 4,
      charisma: 2,
      intelligence: 3,
      dexterity: 0,
    });
    expect(imported.systemData.skills).toMatchObject({
      brawl: 3,
      intimidation: 3,
      animalKen: 2,
      athletics: 0,
    });
    expect(imported.systemData.disciplines).toEqual(progenyExport.disciplines);
    expect(imported.systemData.touchstones).toEqual(progenyExport.touchstones);
    expect(imported.systemData.progeny).toEqual({
      source: 'progeny',
      version: 7,
      id: '',
      player: '',
      chronicle: '',
      characterVersion: 0,
    });
    expect(imported.systemData).not.toHaveProperty('name');
    expect(imported.systemData).not.toHaveProperty('description');
  });

  it('rejects a non-Progeny JSON object', () => {
    expect(() => parseProgenyVtmCharacter({ name: 'Henryk' })).toThrow(ProgenyImportError);
  });

  it('rejects invalid VTM dot values instead of silently clamping them', () => {
    expect(() =>
      parseProgenyVtmCharacter({
        ...progenyExport,
        attributes: { ...progenyExport.attributes, strength: 6 },
      }),
    ).toThrow('attributes.strength must be a whole number from 0 to 5');
  });

  it('does not copy prototype-related keys into system data', () => {
    const parsed = JSON.parse(
      JSON.stringify(progenyExport).replace(
        '"clan":"Lasombra"',
        '"__proto__":{"polluted":true},"clan":"Lasombra"',
      ),
    ) as unknown;

    const imported = parseProgenyVtmCharacter(parsed);

    expect(imported.systemData).not.toHaveProperty('__proto__.polluted');
    expect(Object.prototype).not.toHaveProperty('polluted');
  });
});
