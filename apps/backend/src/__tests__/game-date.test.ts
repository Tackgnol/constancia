import { describe, expect, it } from 'vitest';
import { formatCampaignGameDate } from '../services/game-date.js';

describe('formatCampaignGameDate', () => {
  it('formats a registered campaign calendar date', () => {
    expect(
      formatCampaignGameDate('vtm-v5', {
        calendarId: 'gregorian',
        year: 2026,
        monthId: 'july',
        day: 17,
      }),
    ).toBe('17 July 2026');
  });

  it('returns null for missing or unsupported dates', () => {
    expect(formatCampaignGameDate('vtm-v5', null)).toBeNull();
    expect(
      formatCampaignGameDate('unknown-system', {
        calendarId: 'gregorian',
        year: 2026,
        monthId: 'july',
        day: 17,
      }),
    ).toBeNull();
  });
});
