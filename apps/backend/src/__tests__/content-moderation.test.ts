import { describe, expect, it } from 'vitest';
import { extractModeratableTextEntries } from '../services/content-moderation.js';
import {
  ModerationBlockedError,
  serializeHandledRequestError,
} from '../services/request-errors.js';

describe('content moderation helpers', () => {
  it('extracts nested submitted text while skipping ids, enum-like values, and URLs', () => {
    const entries = extractModeratableTextEntries({
      id: 'campaign-1',
      name: 'The Red Door',
      imageUrl: 'https://example.test/image.webp',
      pipeline: [
        {
          blockType: 'message-channel',
          config: {
            content: 'The room is quiet.',
            channelId: 'channel-1',
            outcomeMap: {
              success: {
                message: 'You find a handwritten note.',
              },
            },
          },
        },
      ],
    });

    expect(entries).toEqual([
      { path: 'body.name', text: 'The Red Door' },
      { path: 'body.pipeline[0].config.content', text: 'The room is quiet.' },
      {
        path: 'body.pipeline[0].config.outcomeMap.success.message',
        text: 'You find a handwritten note.',
      },
    ]);
  });

  it('serializes moderation rejections with category details for forms', () => {
    const error = new ModerationBlockedError('Submission rejected by safety filters.', [
      {
        path: 'body.description',
        categories: ['hate'],
        inputTypes: ['text'],
      },
    ]);

    expect(serializeHandledRequestError(error)).toEqual({
      status: 'error',
      data: {
        message: 'Submission rejected by safety filters.',
        code: 'CONTENT_MODERATION_BLOCKED',
        details: [
          {
            path: 'body.description',
            categories: ['hate'],
            inputTypes: ['text'],
          },
        ],
      },
    });
  });
});
