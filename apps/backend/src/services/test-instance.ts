import type {
  BlockContext,
  BlockInstance,
  SendTestInstancePayload,
  TestThreshold,
} from '@constancia/contracts';
import type { PipelineRunner } from '@constancia/core';
import { gameSystemRegistry } from '@constancia/systems';
import { EventExecutionRequestError, type TestRollResult } from './event-execution.js';
import { PIPELINE_BLOCK } from '@constancia/block-catalogue';

interface GameEventLike {
  id: string;
  name: string;
  campaignId: string;
  gameSystemId: string;
  pipeline: unknown;
}

function isBlockInstanceArray(value: unknown): value is BlockInstance[] {
  return Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function extractThresholds(pipeline: BlockInstance[]): TestThreshold[] {
  const outcomeMap = pipeline.find((block) => block.blockType === PIPELINE_BLOCK.OutcomeMap);
  if (!outcomeMap || !isRecord(outcomeMap.config)) {
    return [];
  }

  const outcomes = outcomeMap.config.outcomes;
  if (!Array.isArray(outcomes)) {
    return [];
  }

  return outcomes.flatMap((outcome) => {
    if (!isRecord(outcome)) {
      return [];
    }

    const threshold = readNumber(outcome.threshold);
    const text = readString(outcome.text);

    if (threshold === undefined || text === undefined) {
      return [];
    }

    return [{ threshold, text }];
  });
}

function extractImageUrl(pipeline: BlockInstance[]): string | undefined {
  for (const block of pipeline) {
    if (block.blockType !== PIPELINE_BLOCK.DisplayImage || !isRecord(block.config)) {
      continue;
    }

    const imageUrl = readString(block.config.imageUrl);
    if (imageUrl) {
      return imageUrl;
    }
  }

  return undefined;
}

function extractDescription(pipeline: BlockInstance[]): string | undefined {
  for (const block of pipeline) {
    if (!isRecord(block.config)) {
      continue;
    }

    if (block.blockType === PIPELINE_BLOCK.MessageChannel) {
      const content = readString(block.config.content);
      if (content) {
        return content;
      }
    }

    if (block.blockType === PIPELINE_BLOCK.DisplayImage) {
      const caption = readString(block.config.caption);
      if (caption) {
        return caption;
      }
    }
  }

  return undefined;
}

export function buildTestInstancePayload(
  event: GameEventLike,
  discordChannelId: string,
  instanceId: string,
): SendTestInstancePayload | null {
  if (!isBlockInstanceArray(event.pipeline)) {
    return null;
  }

  const thresholds = extractThresholds(event.pipeline);
  if (thresholds.length === 0) {
    return null;
  }
  const rollModifier = event.pipeline.find(
    (block) => block.blockType === PIPELINE_BLOCK.RollModifier,
  );
  const cardLine = gameSystemRegistry.get(event.gameSystemId)?.roleBlocks[
    PIPELINE_BLOCK.RollModifier
  ]?.cardLine;
  const rollModifierLine =
    rollModifier && cardLine && isRecord(rollModifier.config)
      ? (cardLine(rollModifier.config) ?? undefined)
      : undefined;

  return {
    kind: 'test-instance',
    instanceId,
    eventId: event.id,
    campaignId: event.campaignId,
    discordChannelId,
    title: event.name,
    description: extractDescription(event.pipeline),
    imageUrl: extractImageUrl(event.pipeline),
    ...(rollModifierLine ? { rollModifierLine } : {}),
    thresholds,
  };
}

const ROLL_BLOCK_TYPES = new Set<string>([
  PIPELINE_BLOCK.RollModifier,
  PIPELINE_BLOCK.TestResolver,
]);

/**
 * Runs only the pipeline's roll blocks for Roll for me. The resolver's player messages become the
 * private dice breakdown; its channel messages are dropped so nothing new is posted publicly.
 */
export async function rollTestResult(
  runner: PipelineRunner,
  pipeline: BlockInstance[],
  ctx: BlockContext,
): Promise<TestRollResult> {
  const rollBlocks = pipeline.filter((block) => ROLL_BLOCK_TYPES.has(block.blockType));
  if (!rollBlocks.some((block) => block.blockType === PIPELINE_BLOCK.TestResolver)) {
    throw new EventExecutionRequestError(
      422,
      'ROLL_UNSUPPORTED',
      'This Test has no resolver, so it cannot roll for you. Enter your final result instead.',
    );
  }

  const result = await runner.run(rollBlocks, ctx);
  if (result.playerScore === undefined) {
    throw new Error('test-resolver finished without setting playerScore.');
  }

  return {
    playerScore: result.playerScore,
    breakdown: result.messages
      .filter((message) => message.target === 'player')
      .map((message) => message.content),
  };
}

export function filterManualTestResolutionPipeline(blocks: BlockInstance[]): BlockInstance[] {
  const manualMetadataBlocks = new Set<string>([
    PIPELINE_BLOCK.RollModifier,
    PIPELINE_BLOCK.TestResolver,
    PIPELINE_BLOCK.MessageChannel,
    PIPELINE_BLOCK.DisplayImage,
  ]);
  return blocks.filter((block) => !manualMetadataBlocks.has(block.blockType));
}
