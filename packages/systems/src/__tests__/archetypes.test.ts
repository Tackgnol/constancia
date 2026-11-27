import { describe, expect, it } from 'vitest';
import {
  getPrimaryArchetype,
  getPrimaryArchetypeChoice,
  readArchetypeChoices,
  validateArchetypeChoices,
} from '../archetypes.js';
import { morkBorgGameSystem, vtmV5GameSystem } from '../game-system-registry.js';

describe('archetypes', () => {
  it('uses the first archetype as primary', () => {
    expect(getPrimaryArchetype(vtmV5GameSystem)?.key).toBe('clan');
    expect(getPrimaryArchetype(morkBorgGameSystem)?.key).toBe('class');
    expect(getPrimaryArchetype({ archetypes: [] })).toBeUndefined();
  });

  it('reads the chosen primary archetype option', () => {
    expect(
      getPrimaryArchetypeChoice(vtmV5GameSystem, { archetypes: { clan: 'Brujah' } })?.name,
    ).toBe('Brujah');
    expect(getPrimaryArchetypeChoice(vtmV5GameSystem, { clan: 'Brujah' })).toBeUndefined();
    expect(
      getPrimaryArchetypeChoice(vtmV5GameSystem, { archetypes: { clan: 'Nope' } }),
    ).toBeUndefined();
  });

  it('ignores non-string choices', () => {
    expect(readArchetypeChoices({ archetypes: { clan: 3, class: 'X' } })).toEqual({ class: 'X' });
    expect(readArchetypeChoices({ archetypes: ['Brujah'] })).toEqual({});
  });

  it('accepts only known archetypes and options', () => {
    expect(validateArchetypeChoices(vtmV5GameSystem, {})).toBeNull();
    expect(
      validateArchetypeChoices(vtmV5GameSystem, { archetypes: { clan: 'Brujah' } }),
    ).toBeNull();
    expect(validateArchetypeChoices(vtmV5GameSystem, { archetypes: { clan: '' } })).toBeNull();
    expect(validateArchetypeChoices(vtmV5GameSystem, { archetypes: { clan: 'Nope' } })).toMatch(
      /not a valid Clan/,
    );
    expect(
      validateArchetypeChoices(vtmV5GameSystem, { archetypes: { class: 'Fanged Deserter' } }),
    ).toMatch(/Unknown archetype "class"/);
    expect(validateArchetypeChoices(vtmV5GameSystem, { archetypes: 'Brujah' })).toMatch(/object/);
  });
});
