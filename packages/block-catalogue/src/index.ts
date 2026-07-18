import type { JSONSchema7 } from 'json-schema';

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type PipelineBlockAvailability =
  | { kind: 'common' }
  | { kind: 'game-system'; gameSystemIds: readonly string[] };

export interface PipelineEditorFieldPresentation {
  optional?: boolean;
  placeholder?: string;
  hint?: string;
  rows?: number;
  columnSpan?: 1 | 2 | 3;
}

export type PipelineEditorField = PipelineEditorFieldPresentation &
  (
    | {
        kind: 'text' | 'textarea' | 'number' | 'boolean' | 'json';
        path: string;
        label: string;
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
        emptyLabel?: string;
      }
    | {
        kind: 'image';
        path: string;
        label: string;
        captionPath?: string;
      }
    | {
        kind: 'outcome-list';
        path: string;
        label: string;
      }
  );

export interface PipelineBlockSpec {
  blockType: string;
  version: number;
  label: string;
  availability: PipelineBlockAvailability;
  configSchema: JSONSchema7;
  defaultConfig: JsonObject;
  editor: {
    columns?: 1 | 2 | 3;
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
      columns: 2,
      fields: [
        {
          kind: 'textarea',
          path: 'content',
          label: 'Content',
          rows: 3,
          columnSpan: 2,
          placeholder: 'Message text sent to the player…',
        },
        {
          kind: 'recipients',
          path: 'playerIds',
          label: 'Player IDs',
          mode: 'player',
          optional: true,
          hint: 'Leave blank to target the triggering player. Choose one or many recipients below.',
          emptyLabel:
            'No specific recipients selected — the triggering player will receive the message.',
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
        {
          kind: 'textarea',
          path: 'content',
          label: 'Content',
          rows: 3,
          placeholder: 'Message text sent to the channel…',
        },
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
      columns: 2,
      fields: [
        {
          kind: 'textarea',
          path: 'content',
          label: 'Content',
          rows: 3,
          columnSpan: 2,
          placeholder: 'Message text sent to the group…',
        },
        {
          kind: 'recipients',
          path: 'groupPlayerIds',
          label: 'Player IDs',
          mode: 'group',
          optional: true,
          hint: 'Pick the group recipients explicitly. Empty groups will not emit a message.',
          emptyLabel: 'No group recipients selected yet.',
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
      columns: 2,
      fields: [
        {
          kind: 'image',
          path: 'imageUrl',
          label: 'Image URL',
          captionPath: 'caption',
        },
        {
          kind: 'text',
          path: 'caption',
          label: 'Caption',
          optional: true,
          placeholder: 'What appears below the image…',
        },
      ],
    },
  },
  {
    blockType: 'add-journal-entry',
    version: 1,
    label: 'Add Journal Entry',
    availability: { kind: 'common' },
    configSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        visible: { type: 'boolean' },
      },
      required: ['title', 'content'],
    },
    defaultConfig: { title: '', content: '', visible: true },
    editor: {
      fields: [
        {
          kind: 'text',
          path: 'title',
          label: 'Title',
          placeholder: 'What players will recognize in their journal…',
        },
        {
          kind: 'textarea',
          path: 'content',
          label: 'Entry',
          rows: 3,
          placeholder: 'The event detail worth preserving…',
        },
        { kind: 'boolean', path: 'visible', label: 'Reveal in player journals' },
      ],
    },
  },
  {
    blockType: 'add-quest',
    version: 1,
    label: 'Add Quest',
    availability: { kind: 'common' },
    configSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        visible: { type: 'boolean' },
      },
      required: ['name'],
    },
    defaultConfig: { name: '', description: '', visible: true },
    editor: {
      fields: [
        {
          kind: 'text',
          path: 'name',
          label: 'Quest name',
          placeholder: 'The objective added when this event fires…',
        },
        {
          kind: 'textarea',
          path: 'description',
          label: 'Description',
          rows: 3,
          optional: true,
          placeholder: 'What the players need to do and why it matters…',
        },
        { kind: 'boolean', path: 'visible', label: 'Reveal in player journals' },
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
      columns: 3,
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
        { kind: 'number', path: 'threshold', label: 'Threshold', placeholder: '1' },
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
        {
          kind: 'text',
          path: 'dataType',
          label: 'Data Type',
          placeholder: 'character, npc, location…',
        },
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
      columns: 2,
      fields: [
        {
          kind: 'system-stat-select',
          path: 'attribute',
          label: 'Attribute',
          statGroup: 'attributes',
          hint: 'System attribute used to build the dice pool.',
        },
        {
          kind: 'system-stat-select',
          path: 'skill',
          label: 'Skill',
          statGroup: 'skills',
          hint: 'System skill used to build the dice pool.',
        },
        {
          kind: 'number',
          path: 'difficulty',
          label: 'Difficulty',
          optional: true,
          placeholder: '1',
          columnSpan: 2,
        },
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
      columns: 2,
      fields: [
        {
          kind: 'system-stat-select',
          path: 'attribute',
          label: 'Attribute',
          statGroup: 'attributes',
          hint: 'System attribute used in the passive insight total.',
        },
        {
          kind: 'system-stat-select',
          path: 'skill',
          label: 'Skill',
          statGroup: 'skills',
          hint: 'System skill added to the passive insight total.',
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
