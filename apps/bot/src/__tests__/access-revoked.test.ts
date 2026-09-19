import { describe, expect, it } from 'vitest';
import {
  accessRevokedMessage,
  BotAccessRevokedError,
  BotCampaignAdminRequiredError,
  BotTestSubmissionRejectedError,
  errorReplyContent,
  isRoutineBotError,
  requireApiData,
  testSubmissionRejectedMessage,
} from '../backend/access-revoked.js';

describe('test submission rejections', () => {
  it.each(['TEST_CLOSED', 'ALREADY_SUBMITTED'])('maps %s to a routine, replyable error', (code) => {
    const response = { status: 'error', data: { message: 'Friendly reason.', code } };

    expect(testSubmissionRejectedMessage(response)).toBe('Friendly reason.');
    expect(() => requireApiData(response, 'submit test result')).toThrow(
      BotTestSubmissionRejectedError,
    );

    const error = new BotTestSubmissionRejectedError('Friendly reason.');
    expect(isRoutineBotError(error)).toBe(true);
    expect(errorReplyContent(error)).toBe('Friendly reason.');
  });

  it('ignores other error codes', () => {
    expect(
      testSubmissionRejectedMessage({
        status: 'error',
        data: { message: 'x', code: 'REQUEST_FAILED' },
      }),
    ).toBeNull();
  });
});

describe('accessRevokedMessage', () => {
  it('extracts only ACCESS_REVOKED messages', () => {
    expect(
      accessRevokedMessage({
        status: 'error',
        data: { message: 'Suspended pending review.', code: 'ACCESS_REVOKED' },
      }),
    ).toBe('Suspended pending review.');
    expect(
      accessRevokedMessage({
        status: 'error',
        data: { message: 'Connection terminated unexpectedly', code: 'REQUEST_FAILED' },
      }),
    ).toBeNull();
  });

  it('ignores successful and malformed envelopes', () => {
    expect(accessRevokedMessage({ status: 'ok', data: {} })).toBeNull();
    expect(accessRevokedMessage(null)).toBeNull();
    expect(accessRevokedMessage('nope')).toBeNull();
  });
});

describe('errorReplyContent', () => {
  it('returns a revocation reason verbatim', () => {
    expect(errorReplyContent(new BotAccessRevokedError('Suspended pending review.'))).toBe(
      'Suspended pending review.',
    );
  });

  it('keeps every other error private', () => {
    expect(errorReplyContent(new Error('ECONNREFUSED 127.0.0.1:3000'))).toBe(
      'Something went wrong.',
    );
  });
});

describe('isRoutineBotError', () => {
  it('treats access-revoked and admin-required as routine', () => {
    expect(isRoutineBotError(new BotAccessRevokedError('Suspended pending review.'))).toBe(true);
    expect(
      isRoutineBotError(new BotCampaignAdminRequiredError("You're not a GM for this campaign.")),
    ).toBe(true);
  });

  it('treats everything else as unexpected', () => {
    expect(isRoutineBotError(new Error('ECONNREFUSED 127.0.0.1:3000'))).toBe(false);
  });
});
