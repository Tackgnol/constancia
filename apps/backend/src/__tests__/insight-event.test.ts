import { describe, expect, it } from 'vitest';
import { filterInsightResolutionPipeline, resolveInsightScore } from '../services/insight-event.js';

describe('insight-event helpers', () => {
  it('resolves a VTM insight score from attribute + skill', () => {
    expect(
      resolveInsightScore(
        [
          {
            blockType: 'vtm-insight-resolver',
            config: { attribute: 'wits', skill: 'awareness' },
          },
        ],
        {
          attributes: { wits: 4 },
          skills: { awareness: 3 },
        },
      ),
    ).toEqual({
      attribute: 'wits',
      skill: 'awareness',
      attributeValue: 4,
      skillValue: 3,
      score: 7,
    });
  });

  it('returns null when no supported insight resolver block exists', () => {
    expect(
      resolveInsightScore(
        [{ blockType: 'conditional-gate', config: { statPath: 'skills.occult', threshold: 4 } }],
        {},
      ),
    ).toBeNull();
  });

  it('keeps event-level writes out of each player resolution run', () => {
    expect(
      filterInsightResolutionPipeline([
        { blockType: 'vtm-insight-resolver', config: { attribute: 'wits', skill: 'awareness' } },
        {
          blockType: 'add-quest',
          config: { name: 'Trace the signal', description: '', visible: true },
        },
        {
          blockType: 'outcome-map',
          config: { outcomes: [{ threshold: 0, text: 'You catch it.' }] },
        },
      ]),
    ).toEqual([
      {
        blockType: 'outcome-map',
        config: { outcomes: [{ threshold: 0, text: 'You catch it.' }] },
      },
    ]);
  });
});
