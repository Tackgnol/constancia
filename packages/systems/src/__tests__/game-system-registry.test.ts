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
import {
  getPipelineBlockSpecForSystem,
  listImplementedRoles,
  listPipelineBlockSpecsForSystem,
  listRoleBlocks,
} from '../role-blocks.js';

describe('GameSystemRegistry', () => {
  it('registers the concrete VTM V5 and Mork Borg adapters', () => {
    expect(gameSystemRegistry.list().map((system) => system.id)).toEqual(['vtm-v5', 'mork-borg']);
  });

  it('resolves canonical IDs and normalized aliases', () => {
    expect(gameSystemRegistry.require('VtM5').id).toBe('vtm-v5');
    expect(gameSystemRegistry.require('Vampire The Masquerade 5th Edition').id).toBe('vtm-v5');
    expect(gameSystemRegistry.require('MORKBORG').id).toBe('mork-borg');
  });

  it('keeps role pipeline blocks separate from NPC system blocks', () => {
    const vtm = gameSystemRegistry.require('vtm-v5');
    const morkBorg = gameSystemRegistry.require('mork-borg');

    expect(listImplementedRoles(vtm)).toEqual(['test-resolver', 'insight-resolver']);
    expect(listRoleBlocks(vtm).map((block) => block.type)).toEqual([
      'test-resolver',
      'insight-resolver',
    ]);
    expect(vtm.npcBlocks?.map((block) => block.blockType)).toContain('clan');
    expect(listImplementedRoles(morkBorg)).toEqual([]);
    expect(morkBorg.npcBlocks?.map((block) => block.blockType)).toContain('creature-type');
  });

  it('resolves role block specs from the campaign system', () => {
    const vtm = gameSystemRegistry.require('vtm-v5');
    const morkBorg = gameSystemRegistry.require('mork-borg');

    const vtmSpec = getPipelineBlockSpecForSystem('test-resolver', vtm);
    expect(vtmSpec?.label).toBe('Test resolver');
    expect(vtmSpec?.editor.fields.map((field) => field.path)).toEqual([
      'attribute',
      'skill',
      'difficulty',
    ]);
    expect(getPipelineBlockSpecForSystem('test-resolver', morkBorg)).toBeUndefined();
    expect(getPipelineBlockSpecForSystem('message-channel', morkBorg)?.blockType).toBe(
      'message-channel',
    );
    expect(listPipelineBlockSpecsForSystem(morkBorg).map((spec) => spec.blockType)).not.toContain(
      'insight-resolver',
    );
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
      archetypes: [],
      testConfig: { label: 'Test', fields: [] },
      blocks: [],
      roleBlocks: {},
      importers: [],
    };

    expect(() => registry.register(duplicate)).toThrow(DuplicateGameSystemKeyError);
  });

  it('reports unknown adapters explicitly', () => {
    expect(() => gameSystemRegistry.require('unknown-system')).toThrow(UnknownGameSystemError);
  });
});
