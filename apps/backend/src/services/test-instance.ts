import type { BlockInstance, SendTestInstancePayload, TestThreshold } from '@constancia/contracts';

interface GameEventLike {
  id: string;
  name: string;
  campaignId: string;
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
  const outcomeMap = pipeline.find((block) => block.blockType === 'outcome-map');
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

    const minScore = readNumber(outcome.minScore);
    const maxScore = readNumber(outcome.maxScore);
    const text = readString(outcome.text);

    if (minScore === undefined || maxScore === undefined || text === undefined) {
      return [];
    }

    return [{ minScore, maxScore, text }];
  });
}

function extractImageUrl(pipeline: BlockInstance[]): string | undefined {
  for (const block of pipeline) {
    if (block.blockType !== 'display-image' || !isRecord(block.config)) {
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

    if (block.blockType === 'message-channel') {
      const content = readString(block.config.content);
      if (content) {
        return content;
      }
    }

    if (block.blockType === 'display-image') {
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
): SendTestInstancePayload | null {
  if (!isBlockInstanceArray(event.pipeline)) {
    return null;
  }

  const thresholds = extractThresholds(event.pipeline);
  if (thresholds.length === 0) {
    return null;
  }

  return {
    kind: 'test-instance',
    eventId: event.id,
    campaignId: event.campaignId,
    discordChannelId,
    title: event.name,
    description: extractDescription(event.pipeline),
    imageUrl: extractImageUrl(event.pipeline),
    thresholds,
  };
}

export function filterManualTestResolutionPipeline(blocks: BlockInstance[]): BlockInstance[] {
  const manualMetadataBlocks = new Set(['vtm-pool-resolver', 'message-channel', 'display-image']);
  return blocks.filter((block) => !manualMetadataBlocks.has(block.blockType));
}
