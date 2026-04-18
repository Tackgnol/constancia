import { describe, it, expectTypeOf } from 'vitest';
import type {
  GameSystem,
  BlockDefinition,
  BlockContext,
  Character,
  GameEvent,
  Quest,
  QuestEntry,
  SessionSummary,
} from '../index.js';

describe('Contract types', () => {
  it('GameSystem has required properties', () => {
    expectTypeOf<GameSystem>().toHaveProperty('id');
    expectTypeOf<GameSystem>().toHaveProperty('name');
    expectTypeOf<GameSystem>().toHaveProperty('version');
    expectTypeOf<GameSystem>().toHaveProperty('statSchema');
    expectTypeOf<GameSystem>().toHaveProperty('testConfig');
    expectTypeOf<GameSystem>().toHaveProperty('blocks');
  });

  it('BlockDefinition has execute method', () => {
    expectTypeOf<BlockDefinition>().toHaveProperty('execute');
    expectTypeOf<BlockDefinition['execute']>().toBeFunction();
  });

  it('BlockContext carries player score optionally', () => {
    expectTypeOf<BlockContext>().toHaveProperty('playerScore');
    expectTypeOf<BlockContext['playerScore']>().toEqualTypeOf<number | undefined>();
  });

  it('Character systemData is a flexible record', () => {
    expectTypeOf<Character['systemData']>().toEqualTypeOf<Record<string, unknown>>();
  });

  it('GameEvent pipeline is an array of BlockInstance', () => {
    expectTypeOf<GameEvent['pipeline']>().toBeArray();
  });

  it('Quest has correct status union', () => {
    expectTypeOf<Quest['status']>().toEqualTypeOf<'active' | 'completed' | 'failed'>();
  });

  it('QuestEntry has correct status union', () => {
    expectTypeOf<QuestEntry['status']>().toEqualTypeOf<'pending' | 'done'>();
  });

  it('SessionSummary channelId is optional', () => {
    expectTypeOf<SessionSummary['channelId']>().toEqualTypeOf<string | undefined>();
  });
});
