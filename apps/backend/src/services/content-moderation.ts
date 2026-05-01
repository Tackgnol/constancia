import OpenAI from 'openai';
import type { Moderation } from 'openai/resources/moderations';
import type { BackendConfig } from '../config.js';
import {
  type ModerationBlockDetail,
  ModerationBlockedError,
  ModerationUnavailableError,
} from './request-errors.js';

export interface ModerationTextEntry {
  path: string;
  text: string;
}

type ModerationResult = Moderation;

const skippedKeys = new Set([
  'id',
  'ids',
  'discordUserId',
  'discordUserIds',
  'discordGuildId',
  'discordChannelId',
  'guildId',
  'channelId',
  'campaignId',
  'characterId',
  'npcId',
  'questId',
  'entryId',
  'sumId',
  'eventId',
  'chanId',
  'charId',
  'npcFactIds',
  'gameSystemId',
  'imageUrl',
  'playerIds',
  'groupPlayerIds',
  'type',
  'status',
  'operator',
  'statPath',
  'attribute',
  'skill',
  'difficulty',
  'threshold',
  'shortCircuit',
  'sortOrder',
  'systemId',
  'blockType',
  'dataType',
  'role',
  'visible',
  'sessionDate',
]);

let cachedClient: OpenAI | null = null;
let cachedApiKey: string | undefined;

export async function moderatePayloadText(config: BackendConfig, payload: unknown): Promise<void> {
  const entries = extractModeratableTextEntries(payload);
  await moderateTextEntries(config, entries);
}

export async function moderateTextEntries(
  config: BackendConfig,
  entries: ModerationTextEntry[],
): Promise<void> {
  if (!config.contentModerationEnabled) {
    return;
  }

  const populatedEntries = entries.filter((entry) => entry.text.trim().length > 0);
  if (populatedEntries.length === 0) {
    return;
  }

  const client = getClient(config);
  const results = await runModeration(config, () =>
    client.moderations.create({
      model: config.contentModerationModel,
      input: populatedEntries.map((entry) => entry.text),
    }),
  );

  const blockedDetails = results.flatMap((result, index) =>
    buildModerationDetails(populatedEntries[index]?.path ?? 'body', result),
  );

  if (blockedDetails.length > 0) {
    throw new ModerationBlockedError(undefined, blockedDetails);
  }
}

export async function moderateUploadedImage(
  config: BackendConfig,
  caption: string,
  imageBuffer: Buffer,
  mimeType: string,
): Promise<void> {
  if (!config.contentModerationEnabled) {
    return;
  }

  const client = getClient(config);
  const dataUri = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
  const results = await runModeration(config, () =>
    client.moderations.create({
      model: config.contentModerationModel,
      input: [
        { type: 'text', text: caption.trim() || 'No text provided' },
        { type: 'image_url', image_url: { url: dataUri } },
      ],
    }),
  );

  const blockedDetails = buildModerationDetails('file', results[0]);
  if (blockedDetails.length > 0) {
    throw new ModerationBlockedError('Upload rejected by safety filters.', blockedDetails);
  }
}

export function extractModeratableTextEntries(
  value: unknown,
  path = 'body',
  parentKey?: string,
): ModerationTextEntry[] {
  if (typeof value === 'string') {
    return shouldModerateString(value, parentKey)
      ? [
          {
            path,
            text: value,
          },
        ]
      : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      extractModeratableTextEntries(item, `${path}[${index}]`, parentKey),
    );
  }

  if (!isPlainObject(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    if (shouldSkipKey(key)) {
      return [];
    }

    return extractModeratableTextEntries(nestedValue, `${path}.${key}`, key);
  });
}

function shouldModerateString(value: string, parentKey?: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (parentKey && shouldSkipKey(parentKey)) {
    return false;
  }

  if (/^(https?:\/\/|data:)/i.test(trimmed)) {
    return false;
  }

  return true;
}

function shouldSkipKey(key: string): boolean {
  return skippedKeys.has(key) || key.endsWith('Id') || key.endsWith('Ids');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getClient(config: BackendConfig): OpenAI {
  if (!config.openAiApiKey) {
    throw new ModerationUnavailableError();
  }

  if (cachedClient === null || cachedApiKey !== config.openAiApiKey) {
    cachedApiKey = config.openAiApiKey;
    cachedClient = new OpenAI({ apiKey: config.openAiApiKey });
  }

  return cachedClient;
}

async function runModeration(
  config: BackendConfig,
  operation: () => Promise<{ results: ModerationResult[] }>,
): Promise<ModerationResult[]> {
  try {
    const response = await operation();
    return response.results;
  } catch (error) {
    if (config.contentModerationFailClosed) {
      throw new ModerationUnavailableError();
    }

    console.warn('[moderation] falling back to allow because fail-closed is disabled', error);
    return [];
  }
}

function buildModerationDetails(
  path: string,
  result: ModerationResult | undefined,
): ModerationBlockDetail[] {
  if (!result?.flagged) {
    return [];
  }

  const categories = Object.entries(result.categories)
    .filter(([category, flagged]) => flagged === true && category === 'sexual/minors')
    .map(([category]) => category);

  if (categories.length === 0) {
    return [];
  }

  const inputTypes = new Set<string>();
  if (result.category_applied_input_types) {
    for (const [category, appliedInputTypes] of Object.entries(
      result.category_applied_input_types,
    )) {
      if (!categories.includes(category)) {
        continue;
      }

      for (const inputType of appliedInputTypes) {
        inputTypes.add(inputType);
      }
    }
  }

  return [
    {
      path,
      categories,
      inputTypes: [...inputTypes],
    },
  ];
}
