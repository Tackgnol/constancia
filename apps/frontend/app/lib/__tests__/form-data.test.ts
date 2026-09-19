import { describe, expect, it } from 'vitest';
import { parseStringArrayFormValue } from '../form-data';

describe('parseStringArrayFormValue', () => {
  it('keeps string entries and discards other JSON values', () => {
    expect(parseStringArrayFormValue('["player-1", 2, null, "player-2"]')).toEqual([
      'player-1',
      'player-2',
    ]);
  });

  it.each([null, '', '{}', 'not-json'])('returns an empty array for %j', (input) => {
    expect(parseStringArrayFormValue(input)).toEqual([]);
  });
});
