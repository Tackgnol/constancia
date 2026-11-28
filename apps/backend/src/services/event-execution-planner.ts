import type {
  BlockEffect,
  BlockInstance,
  BlockMessage,
  BotDeliveryPayload,
  GameSystemId,
} from '@constancia/contracts';
import { PipelineRunner } from '@constancia/core';
import type { PrismaClient } from '@constancia/db';
import { randomUUID } from 'node:crypto';
import { buildBlockRegistry, findPipelineError } from '../blocks.js';
import {
  EventExecutionRequestError,
  type EventExecutionPlanner,
  type FireEventCommand,
  type PlannedEventExecution,
  type SubmitTestResultCommand,
} from './event-execution.js';
import { filterInsightResolutionPipeline, resolveInsightScore } from './insight-event.js';
import { assertCampaignActive } from './moderation-enforcement.js';
import {
  buildTestInstancePayload,
  filterManualTestResolutionPipeline,
  rollTestResult,
} from './test-instance.js';
import { PIPELINE_BLOCK } from '@constancia/block-catalogue';
import { resolveGameSystemId } from '@constancia/systems';

export function createPrismaEventExecutionPlanner(prisma: PrismaClient): EventExecutionPlanner {
  const createRunner = (gameSystemId: GameSystemId) =>
    new PipelineRunner(buildBlockRegistry(gameSystemId));

  return {
    async planFire(command: FireEventCommand): Promise<PlannedEventExecution> {
      const event = await prisma.event.findFirst({
        where: { id: command.eventId, campaignId: command.campaignId },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          campaignId: true,
          channelId: true,
          pipeline: true,
          channel: { select: { discordChannelId: true } },
          campaign: {
            select: { disabledAt: true, disabledPublicReason: true, gameSystemId: true },
          },
        },
      });

      if (!event) {
        throw new EventExecutionRequestError(404, 'EVENT_NOT_FOUND', 'Event not found.');
      }

      // Bot API-key routes bypass campaign-admin authorization.
      assertCampaignActive(event.campaign);

      if (event.status !== 'ready') {
        throw new EventExecutionRequestError(
          409,
          'EVENT_NOT_READY',
          'Only ready Events can be fired. Reset the Event to ready in Setup first.',
        );
      }

      const pipeline = parsePipeline(event.pipeline);
      const gameSystemId = resolveGameSystemId(event.campaign.gameSystemId);
      const pipelineError = findPipelineError(gameSystemId, pipeline, event.type);
      if (pipelineError) {
        throw new EventExecutionRequestError(422, 'PIPELINE_UNSUPPORTED', pipelineError);
      }

      if (event.type === 'test') {
        const instanceId = randomUUID();
        const payload = buildTestInstancePayload(
          { ...event, gameSystemId, pipeline },
          event.channel.discordChannelId,
          instanceId,
        );
        const planned = plan(event, [], [], false, payload ? [payload] : []);
        return payload ? { ...planned, testInstanceId: instanceId } : planned;
      }

      if (event.type === 'insight') {
        const characters = await prisma.character.findMany({
          where: { campaignId: event.campaignId },
          select: { discordUserId: true, systemData: true },
        });
        const resolutionPipeline = filterInsightResolutionPipeline(pipeline);
        const messages: BlockMessage[] = [];
        const registry = buildBlockRegistry(gameSystemId);
        const eventEffects = await new PipelineRunner(registry).run(
          filterEventEffectPipeline(pipeline),
          {
            campaignId: event.campaignId,
            channelId: event.channelId,
            playerId: 'system',
            characterData: {},
          },
        );

        for (const character of characters) {
          const playerCtx = {
            campaignId: event.campaignId,
            channelId: event.channelId,
            playerId: character.discordUserId,
            characterData: parseCharacterData(character.systemData),
          };
          const score = await resolveInsightScore(registry, pipeline, playerCtx);
          if (!score) continue;

          const result = await new PipelineRunner(registry).run(resolutionPipeline, {
            ...playerCtx,
            playerScore: score.score,
          });
          messages.push(...result.messages);
        }

        return plan(
          event,
          messages,
          eventEffects.effects,
          false,
          messageDeliveries(event, messages),
        );
      }

      const result = await createRunner(gameSystemId).run(pipeline, {
        campaignId: event.campaignId,
        channelId: event.channelId,
        playerId: 'system',
        characterData: {},
      });
      return plan(
        event,
        result.messages,
        result.effects,
        result.halted,
        messageDeliveries(event, result.messages),
      );
    },

    async planTestResult(command: SubmitTestResultCommand): Promise<PlannedEventExecution> {
      const instance = await prisma.testInstance.findUnique({
        where: { id: command.instanceId },
        select: {
          status: true,
          event: {
            select: {
              id: true,
              campaignId: true,
              channelId: true,
              pipeline: true,
              channel: { select: { discordChannelId: true } },
              campaign: {
                select: { disabledAt: true, disabledPublicReason: true, gameSystemId: true },
              },
            },
          },
          submissions: {
            where: { discordUserId: command.discordUserId },
            select: { id: true },
          },
        },
      });

      if (!instance) {
        throw new EventExecutionRequestError(404, 'TEST_NOT_FOUND', 'Test not found.');
      }

      const { event } = instance;
      assertCampaignActive(event.campaign);

      if (event.channel.discordChannelId !== command.discordChannelId) {
        throw new EventExecutionRequestError(
          403,
          'EVENT_CHANNEL_MISMATCH',
          'The Discord channel does not own this Event.',
        );
      }

      if (instance.status === 'closed') {
        throw new EventExecutionRequestError(
          409,
          'TEST_CLOSED',
          'The GM has closed this Test to new results.',
        );
      }

      if (instance.submissions.length > 0) {
        throw new EventExecutionRequestError(
          409,
          'ALREADY_SUBMITTED',
          'You already submitted a result for this Test. Ask the GM to reopen your submission.',
        );
      }

      const character = await prisma.character.findUnique({
        where: {
          discordUserId_campaignId: {
            discordUserId: command.discordUserId,
            campaignId: event.campaignId,
          },
        },
        select: { systemData: true },
      });

      if (!character) {
        throw new EventExecutionRequestError(
          404,
          'CHARACTER_NOT_FOUND',
          'No Character exists for this Discord player in the Campaign.',
        );
      }

      const pipeline = parsePipeline(event.pipeline);
      const playerCtx = {
        campaignId: event.campaignId,
        channelId: event.channelId,
        playerId: command.discordUserId,
        characterData: parseCharacterData(character.systemData),
      };
      const roll = command.rollForMe
        ? await rollTestResult(
            createRunner(resolveGameSystemId(event.campaign.gameSystemId)),
            pipeline,
            playerCtx,
          )
        : undefined;
      const playerScore = roll?.playerScore ?? command.playerScore;
      if (playerScore === undefined) {
        throw new EventExecutionRequestError(
          400,
          'SCORE_REQUIRED',
          'Enter your final result or ask the backend to roll for you.',
        );
      }

      const result = await createRunner(resolveGameSystemId(event.campaign.gameSystemId)).run(
        filterManualTestResolutionPipeline(pipeline),
        { ...playerCtx, playerScore },
      );

      return {
        ...plan(
          event,
          result.messages,
          result.effects,
          result.halted,
          messageDeliveries(event, result.messages),
        ),
        testSubmission: {
          instanceId: command.instanceId,
          discordUserId: command.discordUserId,
          playerScore,
        },
        ...(roll ? { roll } : {}),
      };
    },
  };
}

interface EventPlanSource {
  id: string;
  campaignId: string;
  channel: { discordChannelId: string };
}

function plan(
  event: EventPlanSource,
  messages: BlockMessage[],
  effects: BlockEffect[],
  halted: boolean,
  deliveries: BotDeliveryPayload[],
): PlannedEventExecution {
  return {
    eventId: event.id,
    campaignId: event.campaignId,
    messages,
    effects,
    halted,
    deliveries,
  };
}

function messageDeliveries(event: EventPlanSource, messages: BlockMessage[]): BotDeliveryPayload[] {
  return messages.length === 0
    ? []
    : [
        {
          kind: 'messages',
          eventId: event.id,
          discordChannelId: event.channel.discordChannelId,
          messages,
        },
      ];
}

const EVENT_EFFECT_BLOCK_TYPES = new Set<string>([
  PIPELINE_BLOCK.AddJournalEntry,
  PIPELINE_BLOCK.AddQuest,
]);

function filterEventEffectPipeline(blocks: BlockInstance[]): BlockInstance[] {
  return blocks.filter((block) => EVENT_EFFECT_BLOCK_TYPES.has(block.blockType));
}

function parsePipeline(value: unknown): BlockInstance[] {
  if (!Array.isArray(value) || !value.every(isBlockInstance)) {
    throw new EventExecutionRequestError(
      422,
      'INVALID_EVENT_PIPELINE',
      'The Event pipeline is invalid.',
    );
  }
  return value;
}

function isBlockInstance(value: unknown): value is BlockInstance {
  return isRecord(value) && typeof value.blockType === 'string' && isRecord(value.config);
}

function parseCharacterData(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
