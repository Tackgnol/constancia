import { describe, expect, it } from 'vitest';
import { resolveVtmInsightScore, vtmInsightResolverBlock } from '../vtm-v5/insight-resolver.js';

describe('vtmInsightResolverBlock', () => {
  it('adds the configured VTM attribute and skill into a score', async () => {
    const result = await vtmInsightResolverBlock.execute(
      {
        attribute: 'wits',
        skill: 'awareness',
      },
      {
        campaignId: 'campaign-1',
        channelId: 'channel-1',
        playerId: 'player-1',
        characterData: {
          attributes: { wits: 4 },
          skills: { awareness: 3 },
        },
      },
    );

    expect(result.output).toEqual({
      attribute: 'wits',
      skill: 'awareness',
      attributeValue: 4,
      skillValue: 3,
      score: 7,
    });
  });

  it('treats missing stats as zero', () => {
    expect(
      resolveVtmInsightScore(
        {
          attribute: 'resolve',
          skill: 'occult',
        },
        {},
      ),
    ).toEqual({
      attribute: 'resolve',
      skill: 'occult',
      attributeValue: 0,
      skillValue: 0,
      score: 0,
    });
  });
});
