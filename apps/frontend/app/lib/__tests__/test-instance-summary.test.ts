import { describe, expect, it } from 'vitest';
import { summarizeSubmissions } from '../test-instance-summary';

describe('summarizeSubmissions', () => {
  it('counts submitted participants against every campaign character', () => {
    expect(
      summarizeSubmissions([
        { discordUserId: '1', label: 'Ada', submitted: true, playerScore: 3 },
        { discordUserId: '2', label: 'Bo', submitted: false },
        { discordUserId: '3', label: 'Cy', submitted: true, playerScore: 0 },
      ]),
    ).toBe('2 of 3 submitted');
  });

  it('handles a campaign with no characters', () => {
    expect(summarizeSubmissions([])).toBe('0 of 0 submitted');
  });
});
