import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  GameSystem,
  BlockDefinition,
  BlockContext,
   BlockMessage,
  Character,
  GameEvent,
  Npc,
  NpcFactWithKnowledge,
  NpcSystemBlock,
  PlayerUserRef,
  Quest,
  QuestEntry,
  SessionSummary,
  SendMessagesPayload,
} from '../index.js';
import { resolveMessageRecipients, sendMessagesPayloadSchema } from '../index.js';

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

  it('NPC system blocks are a flexible array of typed blocks', () => {
    expectTypeOf<Npc['systemBlocks']>().toEqualTypeOf<NpcSystemBlock[]>();
  });

  it('NPC fact knowledge carries rich player references', () => {
    expectTypeOf<NpcFactWithKnowledge['knownTo']>().toEqualTypeOf<PlayerUserRef[]>();
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

  it('SendMessagesPayload includes event and delivery target information', () => {
    expectTypeOf<SendMessagesPayload>().toHaveProperty('eventId');
    expectTypeOf<SendMessagesPayload>().toHaveProperty('discordChannelId');
    expectTypeOf<SendMessagesPayload['messages']>().toBeArray();
  });

  it('sendMessagesPayloadSchema accepts a valid payload', () => {
    expect(
      sendMessagesPayloadSchema.safeParse({
        eventId: 'event-1',
        discordChannelId: 'channel-1',
        messages: [{ target: 'channel', content: 'The coterie hears the door unlock.' }],
      }).success,
    ).toBe(true);
  });

  it('sendMessagesPayloadSchema rejects an invalid payload', () => {
    expect(
      sendMessagesPayloadSchema.safeParse({
        eventId: '',
        discordChannelId: 'channel-1',
        messages: [{ target: 'group', content: 'Missing target ids' }],
      }).success,
    ).toBe(false);
  });

  it('resolveMessageRecipients resolves channel, player, and group targets', () => {
    const messages: BlockMessage[] = [
      { target: 'channel', content: 'Channel narration' },
      { target: 'player', targetId: 'player-1', content: 'Private clue' },
      { target: 'group', targetIds: ['player-2', 'player-3'], content: 'Scout briefing' },
    ];

    expect(resolveMessageRecipients('channel-1', messages[0])).toEqual({
      target: 'channel',
      channelId: 'channel-1',
    });
    expect(resolveMessageRecipients('channel-1', messages[1])).toEqual({
      target: 'player',
      userIds: ['player-1'],
    });
    expect(resolveMessageRecipients('channel-1', messages[2])).toEqual({
      target: 'group',
      userIds: ['player-2', 'player-3'],
    });
  });
});
