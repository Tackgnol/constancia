import type { JSONSchema7 } from 'json-schema';

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type PipelineBlockAvailability =
  | { kind: 'common' }
  | { kind: 'game-system'; gameSystemIds: readonly string[] };

export type PipelineEditorField =
  | {
      kind: 'text' | 'textarea' | 'number' | 'boolean' | 'json';
      path: string;
      label: string;
      optional?: boolean;
      placeholder?: string;
    }
  | {
      kind: 'select';
      path: string;
      label: string;
      options: readonly { value: string; label: string }[];
    }
  | {
      kind: 'system-stat-select';
      path: string;
      label: string;
      statGroup: string;
    }
  | {
      kind: 'recipients';
      path: string;
      label: string;
      mode: 'player' | 'group';
      optional?: boolean;
    }
  | {
      kind: 'image';
      path: string;
      label: string;
      captionPath?: string;
      optional?: boolean;
    }
  | {
      kind: 'outcome-list';
      path: string;
      label: string;
    };

export interface PipelineBlockSpec {
  blockType: string;
  version: number;
  label: string;
  availability: PipelineBlockAvailability;
  configSchema: JSONSchema7;
  defaultConfig: JsonObject;
  editor: {
    fields: readonly PipelineEditorField[];
  };
}

export const PIPELINE_BLOCK_SPECS = [
  {
    blockType: 'message-player',
    version: 1,
    label: 'Message Player',
    availability: { kind: 'common' },
    configSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        content: { type: 'string' },
        imageUrl: { type: 'string' },
        playerIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['content'],
    },
    defaultConfig: { content: '', imageUrl: '', playerIds: [] },
    editor: {
      fields: [
        { kind: 'textarea', path: 'content', label: 'Content' },
        {
          kind: 'recipients',
          path: 'playerIds',
          label: 'Player IDs',
          mode: 'player',
          optional: true,
        },
        { kind: 'image', path: 'imageUrl', label: 'Image URL', optional: true },
      ],
    },
  },
  {
    blockType: 'message-channel',
    version: 1,
    label: 'Message Channel',
    availability: { kind: 'common' },
    configSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        content: { type: 'string' },
        imageUrl: { type: 'string' },
      },
      required: ['content'],
    },
    defaultConfig: { content: '', imageUrl: '' },
    editor: {
      fields: [
        { kind: 'textarea', path: 'content', label: 'Content' },
        { kind: 'image', path: 'imageUrl', label: 'Image URL', optional: true },
      ],
    },
  },
  {
    blockType: 'message-group',
    version: 1,
    label: 'Message Group',
    availability: { kind: 'common' },
    configSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        content: { type: 'string' },
        imageUrl: { type: 'string' },
        groupPlayerIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['content'],
    },
    defaultConfig: { content: '', imageUrl: '', groupPlayerIds: [] },
    editor: {
      fields: [
        { kind: 'textarea', path: 'content', label: 'Content' },
        {
          kind: 'recipients',
          path: 'groupPlayerIds',
          label: 'Player IDs',
          mode: 'group',
          optional: true,
        },
        { kind: 'image', path: 'imageUrl', label: 'Image URL', optional: true },
      ],
    },
  },
  {
    blockType: 'display-image',
    version: 1,
    label: 'Display Image',
    availability: { kind: 'common' },
    configSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        imageUrl: { type: 'string' },
        caption: { type: 'string' },
      },
      required: ['imageUrl'],
    },
    defaultConfig: { imageUrl: '', caption: '' },
    editor: {
      fields: [
        {
          kind: 'image',
          path: 'imageUrl',
          label: 'Image URL',
          captionPath: 'caption',
        },
        { kind: 'text', path: 'caption', label: 'Caption', optional: true },
      ],
    },
  },
  {
    blockType: 'conditional-gate',
    version: 1,
    label: 'Conditional Gate',
    availability: { kind: 'common' },
    configSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        statPath: { type: 'string' },
        operator: { type: 'string', enum: ['gte', 'gt', 'lte', 'lt', 'eq'] },
        threshold: { type: 'number' },
      },
      required: ['statPath', 'operator', 'threshold'],
    },
    defaultConfig: { statPath: '', operator: 'gte', threshold: 1 },
    editor: {
      fields: [
        {
          kind: 'text',
          path: 'statPath',
          label: 'Stat Path',
          placeholder: 'attributes.strength',
        },
        {
          kind: 'select',
          path: 'operator',
          label: 'Operator',
          options: [
            { value: 'gte', label: 'At least' },
            { value: 'gt', label: 'More than' },
            { value: 'lte', label: 'At most' },
            { value: 'lt', label: 'Less than' },
            { value: 'eq', label: 'Exactly' },
          ],
        },
        { kind: 'number', path: 'threshold', label: 'Threshold' },
      ],
    },
  },
  {
    blockType: 'outcome-map',
    version: 1,
    label: 'Outcome Map',
    availability: { kind: 'common' },
    configSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        outcomes: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              threshold: { type: 'number' },
              text: { type: 'string' },
            },
            required: ['threshold', 'text'],
          },
        },
        shortCircuit: { type: 'boolean' },
      },
      required: ['outcomes'],
    },
    defaultConfig: {
      outcomes: [{ threshold: 0, text: '' }],
      shortCircuit: true,
    },
    editor: {
      fields: [{ kind: 'outcome-list', path: 'outcomes', label: 'Outcomes' }],
    },
  },
  {
    blockType: 'retrieve-data',
    version: 1,
    label: 'Retrieve Data',
    availability: { kind: 'common' },
    configSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        dataType: { type: 'string' },
        query: { type: 'object', additionalProperties: true },
      },
      required: ['dataType'],
    },
    defaultConfig: { dataType: '', query: {} },
    editor: {
      fields: [
        { kind: 'text', path: 'dataType', label: 'Data Type' },
        { kind: 'json', path: 'query', label: 'Query', optional: true },
      ],
    },
  },
  {
    blockType: 'vtm-pool-resolver',
    version: 1,
    label: 'VTM V5 Dice Pool Resolver',
    availability: { kind: 'game-system', gameSystemIds: ['vtm-v5'] },
    configSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        attribute: { type: 'string', description: 'Key into characterData.attributes' },
        skill: { type: 'string', description: 'Key into characterData.skills' },
        difficulty: { type: 'number', description: 'Number of successes needed to succeed' },
      },
      required: ['attribute', 'skill'],
    },
    defaultConfig: { attribute: '', skill: '' },
    editor: {
      fields: [
        {
          kind: 'system-stat-select',
          path: 'attribute',
          label: 'Attribute',
          statGroup: 'attributes',
        },
        {
          kind: 'system-stat-select',
          path: 'skill',
          label: 'Skill',
          statGroup: 'skills',
        },
        { kind: 'number', path: 'difficulty', label: 'Difficulty', optional: true },
      ],
    },
  },
  {
    blockType: 'vtm-insight-resolver',
    version: 1,
    label: 'VTM V5 Insight Resolver',
    availability: { kind: 'game-system', gameSystemIds: ['vtm-v5'] },
    configSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        attribute: { type: 'string', description: 'Key into characterData.attributes' },
        skill: { type: 'string', description: 'Key into characterData.skills' },
      },
      required: ['attribute', 'skill'],
    },
    defaultConfig: { attribute: '', skill: '' },
    editor: {
      fields: [
        {
          kind: 'system-stat-select',
          path: 'attribute',
          label: 'Attribute',
          statGroup: 'attributes',
        },
        {
          kind: 'system-stat-select',
          path: 'skill',
          label: 'Skill',
          statGroup: 'skills',
        },
      ],
    },
  },
] as const satisfies readonly PipelineBlockSpec[];

export type PipelineBlockType = (typeof PIPELINE_BLOCK_SPECS)[number]['blockType'];

export const PIPELINE_BLOCK_TYPES: readonly PipelineBlockType[] = PIPELINE_BLOCK_SPECS.map(
  (spec) => spec.blockType,
);

export function isPipelineBlockType(value: string): value is PipelineBlockType {
  return PIPELINE_BLOCK_TYPES.some((blockType) => blockType === value);
}

export function getPipelineBlockSpec(blockType: string): PipelineBlockSpec | undefined {
  return PIPELINE_BLOCK_SPECS.find((candidate) => candidate.blockType === blockType);
}

export function requirePipelineBlockSpec(blockType: PipelineBlockType): PipelineBlockSpec {
  const spec = getPipelineBlockSpec(blockType);
  if (!spec) {
    throw new Error(`Pipeline block spec not found: "${blockType}"`);
  }
  return spec;
}

export function isPipelineBlockAvailable(spec: PipelineBlockSpec, gameSystemId: string): boolean {
  return (
    spec.availability.kind === 'common' ||
    spec.availability.gameSystemIds.some((candidate) => candidate === gameSystemId)
  );
}

export function listPipelineBlockSpecs(gameSystemId?: string): readonly PipelineBlockSpec[] {
  if (!gameSystemId) {
    return PIPELINE_BLOCK_SPECS;
  }
  return PIPELINE_BLOCK_SPECS.filter((spec) => isPipelineBlockAvailable(spec, gameSystemId));
}

export function createDefaultPipelineBlock(blockType: PipelineBlockType): {
  blockType: PipelineBlockType;
  config: JsonObject;
} {
  return {
    blockType,
    config: structuredClone(requirePipelineBlockSpec(blockType).defaultConfig),
  };
}
