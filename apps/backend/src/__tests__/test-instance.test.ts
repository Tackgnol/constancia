import { describe, expect, it } from 'vitest';
import type { BlockInstance } from '@constancia/contracts';
import {
  buildTestInstancePayload,
  filterManualTestResolutionPipeline,
} from '../services/test-instance.js';

describe('test-instance helpers', () => {
  it('builds a test-instance payload from the event pipeline metadata', () => {
    const payload = buildTestInstancePayload(
      {
        id: 'event-1',
        name: 'Sneak Past the Hounds',
        campaignId: 'campaign-1',
        pipeline: [
          {
            blockType: 'message-channel',
            config: { content: 'Slip through the courtyard before the ghoul turns.' },
          },
          {
            blockType: 'display-image',
            config: {
              imageUrl: 'https://example.com/hounds.jpg',
              caption: 'A narrow gate opens onto the service yard.',
            },
          },
          {
            blockType: 'outcome-map',
            config: {
              outcomes: [
                { minScore: 0, maxScore: 3, text: 'They fall over.' },
                { minScore: 4, maxScore: 6, text: 'They pull it off.' },
              ],
            },
          },
        ] satisfies BlockInstance[],
      },
      'channel-1',
    );

    expect(payload).toEqual({
      kind: 'test-instance',
      eventId: 'event-1',
      campaignId: 'campaign-1',
      discordChannelId: 'channel-1',
      title: 'Sneak Past the Hounds',
      description: 'Slip through the courtyard before the ghoul turns.',
      imageUrl: 'https://example.com/hounds.jpg',
      thresholds: [
        { minScore: 0, maxScore: 3, text: 'They fall over.' },
        { minScore: 4, maxScore: 6, text: 'They pull it off.' },
      ],
    });
  });

  it('returns null when the pipeline does not expose threshold metadata', () => {
    expect(
      buildTestInstancePayload(
        {
          id: 'event-1',
          name: 'No Thresholds',
          campaignId: 'campaign-1',
          pipeline: [{ blockType: 'message-channel', config: { content: 'Just narration.' } }],
        },
        'channel-1',
      ),
    ).toBeNull();
  });

  it('removes automated resolver blocks from manual test resolution', () => {
    expect(
      filterManualTestResolutionPipeline([
        { blockType: 'vtm-pool-resolver', config: { attribute: 'dexterity', skill: 'stealth' } },
        { blockType: 'message-channel', config: { content: 'Cross the gallery unseen.' } },
        { blockType: 'display-image', config: { imageUrl: 'https://example.com/gallery.jpg' } },
        { blockType: 'outcome-map', config: { outcomes: [] } },
        { blockType: 'message-channel', config: { content: 'Alarm bells ring.' } },
      ]),
    ).toEqual([{ blockType: 'outcome-map', config: { outcomes: [] } }]);
  });
});
