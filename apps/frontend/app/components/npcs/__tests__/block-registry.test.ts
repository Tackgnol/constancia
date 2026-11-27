import { describe, expect, it } from 'vitest';
import { listHeadlineSystemBlocks, readPrimarySystemBlock } from '../block-registry';

const block = (blockType: string, value: string) => ({
  systemId: 'vtm-v5',
  blockType,
  label: blockType,
  value,
});

describe('NPC headline system blocks', () => {
  it('orders headline blocks as the Game System declares them and skips detail blocks', () => {
    const npc = {
      systemBlocks: [block('demeanor', 'Calm'), block('title', 'Prince'), block('clan', 'Ventrue')],
    };

    expect(listHeadlineSystemBlocks(npc, 'vtm-v5').map((entry) => entry.blockType)).toEqual([
      'clan',
      'title',
    ]);
    expect(readPrimarySystemBlock(npc, 'vtm-v5')?.value).toBe('Ventrue');
  });

  it('falls back to the first block when the NPC has no headline block', () => {
    expect(
      readPrimarySystemBlock({ systemBlocks: [block('demeanor', 'Calm')] }, 'vtm-v5')?.value,
    ).toBe('Calm');
  });
});
