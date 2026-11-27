import { describe, expect, it } from 'vitest';
import { GAME_SYSTEM_ADAPTERS } from '@constancia/systems';
import { hasStatRowRenderer } from '../index';

describe('character sheet renderer map', () => {
  it.each(GAME_SYSTEM_ADAPTERS.map((system) => system.id))(
    'has a renderer for the registered Game System "%s"',
    (systemId) => {
      expect(hasStatRowRenderer(systemId)).toBe(true);
    },
  );
});
