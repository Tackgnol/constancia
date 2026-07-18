import { describe, expect, it } from 'vitest';
import {
  DuplicateGameSystemKeyError,
  GAME_SYSTEM_ADAPTERS,
  GameSystemRegistry,
  type GameSystemAdapter,
  UnknownGameSystemError,
  gameSystemRegistry,
} from '../game-system-registry.js';
import { GREGORIAN_CALENDAR } from '../calendar.js';

describe('GameSystemRegistry', () => {
  it('registers the concrete VTM V5 and Mork Borg adapters', () => {
    expect(gameSystemRegistry.list().map((system) => system.id)).toEqual(['vtm-v5', 'mork-borg']);
  });

  it('resolves canonical IDs and normalized aliases', () => {
    expect(gameSystemRegistry.require('VtM5').id).toBe('vtm-v5');
    expect(gameSystemRegistry.require('Vampire The Masquerade 5th Edition').id).toBe('vtm-v5');
    expect(gameSystemRegistry.require('MORKBORG').id).toBe('mork-borg');
  });

  it('keeps executable pipeline blocks separate from NPC system blocks', () => {
    const vtm = gameSystemRegistry.require('vtm-v5');
    const morkBorg = gameSystemRegistry.require('mork-borg');

    expect(vtm.blocks.map((block) => block.type)).toEqual([
      'vtm-pool-resolver',
      'vtm-insight-resolver',
    ]);
    expect(vtm.npcBlocks?.map((block) => block.blockType)).toContain('clan');
    expect(morkBorg.blocks).toEqual([]);
    expect(morkBorg.npcBlocks?.map((block) => block.blockType)).toContain('creature-type');
  });

  it('provides every system-specific pipeline block through the adapter seam', () => {
    const registeredSystemBlockTypes = GAME_SYSTEM_ADAPTERS.flatMap((system) =>
      system.blocks.map((block) => block.type),
    );

    expect(registeredSystemBlockTypes).toEqual(['vtm-pool-resolver', 'vtm-insight-resolver']);
    expect(new Set(registeredSystemBlockTypes).size).toBe(registeredSystemBlockTypes.length);
  });

  it('rejects duplicate canonical or alias lookup keys', () => {
    const registry = new GameSystemRegistry(GAME_SYSTEM_ADAPTERS);
    const duplicate: GameSystemAdapter = {
      id: 'another-system',
      aliases: ['vtm5'],
      name: 'Another System',
      version: '0.1.0',
      defaultCalendarId: GREGORIAN_CALENDAR.id,
      calendars: { [GREGORIAN_CALENDAR.id]: GREGORIAN_CALENDAR },
      statSchema: { groups: [] },
      testConfig: { label: 'Test', fields: [] },
      blocks: [],
    };

    expect(() => registry.register(duplicate)).toThrow(DuplicateGameSystemKeyError);
  });

  it('reports unknown adapters explicitly', () => {
    expect(() => gameSystemRegistry.require('unknown-system')).toThrow(UnknownGameSystemError);
  });
});
