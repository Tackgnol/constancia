import { describe, expect, it } from 'vitest';
import {
  accessRevokedMessage,
  BotAccessRevokedError,
  BotCampaignAdminRequiredError,
  errorReplyContent,
  isRoutineBotError,
} from '../backend/access-revoked.js';

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
