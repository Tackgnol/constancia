import { describe, expect, it } from 'vitest';
import { formatHeadlineSummary, listHeadlineSystemBlocks } from '../block-registry';

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
    expect(formatHeadlineSummary(npc, 'vtm-v5')).toBe('clan: Ventrue · title: Prince');
  });

  it('falls back to the first block when the NPC has no headline block', () => {
    expect(formatHeadlineSummary({ systemBlocks: [block('demeanor', 'Calm')] }, 'vtm-v5')).toBe(
      'demeanor: Calm',
    );
    expect(formatHeadlineSummary({ systemBlocks: [] }, 'vtm-v5')).toBeNull();
  });
});
