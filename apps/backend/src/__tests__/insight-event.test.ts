import { describe, expect, it } from 'vitest';
import { buildBlockRegistry } from '../blocks.js';
import { selectPipelinePhase } from '../services/event-pipeline-phases.js';
import { resolveInsightScore } from '../services/insight-event.js';

const ctx = (characterData: Record<string, unknown>) => ({
  campaignId: 'campaign-1',
  channelId: 'channel-1',
  playerId: 'player-1',
  characterData,
});

describe('insight-event helpers', () => {
  it("resolves the score with the campaign system's insight-resolver", async () => {
    await expect(
      resolveInsightScore(
        buildBlockRegistry('vtm-v5'),
        [{ blockType: 'insight-resolver', config: { attribute: 'wits', skill: 'awareness' } }],
        ctx({ attributes: { wits: 4 }, skills: { awareness: 3 } }),
      ),
    ).resolves.toEqual({ score: 7 });
  });

  it('returns null when the pipeline has no insight-resolver block', async () => {
    await expect(
      resolveInsightScore(
        buildBlockRegistry('vtm-v5'),
        [{ blockType: 'conditional-gate', config: { statPath: 'skills.occult', threshold: 4 } }],
        ctx({}),
      ),
    ).resolves.toBeNull();
  });

  it('returns null when the system does not implement insight-resolver', async () => {
    await expect(
      resolveInsightScore(
        buildBlockRegistry('mork-borg'),
        [{ blockType: 'insight-resolver', config: {} }],
        ctx({}),
      ),
    ).resolves.toBeNull();
  });

  it('keeps event-level writes out of each player resolution run', () => {
    expect(
      selectPipelinePhase(
        [
          { blockType: 'insight-resolver', config: { attribute: 'wits', skill: 'awareness' } },
          {
            blockType: 'add-quest',
            config: { name: 'Trace the signal', description: '', visible: true },
          },
          {
            blockType: 'outcome-map',
            config: { outcomes: [{ threshold: 0, text: 'You catch it.' }] },
          },
        ],
        'insight-outcome',
      ),
    ).toEqual([
      {
        blockType: 'outcome-map',
        config: { outcomes: [{ threshold: 0, text: 'You catch it.' }] },
      },
    ]);
  });
});
