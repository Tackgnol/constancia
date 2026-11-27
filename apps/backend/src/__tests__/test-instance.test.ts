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
        gameSystemId: 'vtm-v5',
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
                { threshold: 0, text: 'They fall over.' },
                { threshold: 3, text: 'They pull it off.' },
              ],
            },
          },
        ] satisfies BlockInstance[],
      },
      'channel-1',
      'instance-1',
    );

    expect(payload).toEqual({
      kind: 'test-instance',
      instanceId: 'instance-1',
      eventId: 'event-1',
      campaignId: 'campaign-1',
      discordChannelId: 'channel-1',
      title: 'Sneak Past the Hounds',
      description: 'Slip through the courtyard before the ghoul turns.',
      imageUrl: 'https://example.com/hounds.jpg',
      thresholds: [
        { threshold: 0, text: 'They fall over.' },
        { threshold: 3, text: 'They pull it off.' },
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
          gameSystemId: 'vtm-v5',
          pipeline: [{ blockType: 'message-channel', config: { content: 'Just narration.' } }],
        },
        'channel-1',
        'instance-1',
      ),
    ).toBeNull();
  });

  it('removes automated resolver blocks from manual test resolution', () => {
    expect(
      filterManualTestResolutionPipeline([
        { blockType: 'test-resolver', config: { attribute: 'dexterity', skill: 'stealth' } },
        { blockType: 'message-channel', config: { content: 'Cross the gallery unseen.' } },
        { blockType: 'display-image', config: { imageUrl: 'https://example.com/gallery.jpg' } },
        { blockType: 'outcome-map', config: { outcomes: [] } },
        { blockType: 'message-channel', config: { content: 'Alarm bells ring.' } },
      ]),
    ).toEqual([{ blockType: 'outcome-map', config: { outcomes: [] } }]);
  });

  it('puts the roll-modifier line on the card and keeps the block out of manual resolution', () => {
    const pipeline = [
      { blockType: 'roll-modifier', config: { mode: 'advantage' } },
      { blockType: 'test-resolver', config: { mode: 'check', ability: 'dex' } },
      { blockType: 'outcome-map', config: { outcomes: [{ threshold: 15, text: 'You slip by.' }] } },
    ];
    const payload = buildTestInstancePayload(
      {
        id: 'event-2',
        name: 'Stealth',
        campaignId: 'campaign-1',
        gameSystemId: '5e-srd',
        pipeline,
      },
      'discord-channel-1',
      'instance-2',
    );

    expect(payload?.rollModifierLine).toBe('🎲 Roll with advantage');
    expect(filterManualTestResolutionPipeline(pipeline).map((block) => block.blockType)).toEqual([
      'outcome-map',
    ]);
  });
});
