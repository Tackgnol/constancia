import { describe, expect, it } from 'vitest';
import {
  extractSystemStats,
  getGameSystemSummary,
  getStatSchemaForSystem,
  mergeSystemStats,
} from '../stat-schemas.js';

describe('system stat schemas', () => {
  it('returns the configured VTM stat schema', () => {
    const schema = getStatSchemaForSystem('vtm-v5');

    expect(schema.groups.map((group) => group.key)).toEqual(['attributes', 'skills']);
    expect(schema.groups[0]?.fields.some((field) => field.key === 'strength')).toBe(true);
    expect(schema.groups[1]?.fields.some((field) => field.key === 'occult')).toBe(true);
  });

  it('resolves legacy VTM system ids to the configured stat schema', () => {
    const schema = getStatSchemaForSystem('VtM5');

    expect(getGameSystemSummary('VtM5')?.id).toBe('vtm-v5');
    expect(schema.groups.map((group) => group.key)).toEqual(['attributes', 'skills']);
    expect(extractSystemStats('VtM5', { attributes: { wits: 2 } })).toMatchObject({
      wits: 2,
      strength: 0,
    });
  });

  it('extracts VTM stats from nested system data', () => {
    expect(
      extractSystemStats('vtm-v5', {
        clan: 'Toreador',
        attributes: { wits: 4 },
        skills: { awareness: 3 },
      }),
    ).toMatchObject({
      wits: 4,
      awareness: 3,
      strength: 0,
    });
  });

  it('merges sheet stats without discarding unrelated system data', () => {
    expect(
      mergeSystemStats(
        'vtm-v5',
        {
          clan: 'Brujah',
          hunger: 2,
          attributes: { strength: 2 },
          skills: { athletics: 1 },
        },
        {
          strength: 4,
          athletics: 3,
        },
      ),
    ).toEqual({
      clan: 'Brujah',
      hunger: 2,
      attributes: {
        strength: 4,
        dexterity: 0,
        stamina: 0,
        charisma: 0,
        manipulation: 0,
        composure: 0,
        intelligence: 0,
        wits: 0,
        resolve: 0,
      },
      skills: {
        athletics: 3,
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
        awareness: 0,
        finance: 0,
        investigation: 0,
        medicine: 0,
        occult: 0,
        politics: 0,
        science: 0,
        technology: 0,
      },
    });
  });

  it('exposes system metadata for known systems', () => {
    expect(getGameSystemSummary('vtm-v5')?.name).toBe('Vampire: The Masquerade 5th Edition');
    expect(getGameSystemSummary('unknown-system')).toBeNull();
  });
});
