import { describe, expect, it } from 'vitest';
import { normalizeNpcSystemBlocks, toNpcSystemBlocksInput } from '../services/npc-system-blocks.js';

describe('NPC system block utilities', () => {
  it('keeps valid database blocks and drops malformed entries', () => {
    expect(
      normalizeNpcSystemBlocks([
        {
          systemId: 'vtm-v5',
          blockType: 'clan',
          label: 'Clan',
          value: 'Brujah',
        },
        { blockType: 'missing-value', label: 'Broken' },
        null,
      ]),
    ).toEqual([
      {
        systemId: 'vtm-v5',
        blockType: 'clan',
        label: 'Clan',
        value: 'Brujah',
      },
    ]);
  });

  it('returns no blocks for a non-array database value', () => {
    expect(normalizeNpcSystemBlocks({ blockType: 'clan' })).toEqual([]);
  });

  it('serializes API blocks to Prisma JSON input', () => {
    expect(
      toNpcSystemBlocksInput([
        {
          blockType: 'threat',
          label: 'Threat',
          value: { rating: 3 },
        },
      ]),
    ).toEqual([
      {
        systemId: undefined,
        blockType: 'threat',
        label: 'Threat',
        value: { rating: 3 },
      },
    ]);
  });
});
