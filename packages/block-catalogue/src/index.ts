import type { JSONSchema7 } from 'json-schema';

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

/** Every pipeline block type by name; use these instead of the raw strings. */
export const PIPELINE_BLOCK = {
  OutcomeMap: 'outcome-map',
  ConditionalGate: 'conditional-gate',
  MessagePlayer: 'message-player',
  MessageChannel: 'message-channel',
  MessageGroup: 'message-group',
  DisplayImage: 'display-image',
  RetrieveData: 'retrieve-data',
  AddJournalEntry: 'add-journal-entry',
  AddQuest: 'add-quest',
  TestResolver: 'test-resolver',
  InsightResolver: 'insight-resolver',
  RollModifier: 'roll-modifier',
} as const;

/** How outcome-map compares the score with each outcome's threshold. */
export enum OutcomeComparison {
  Above = 'gt',
  AtLeast = 'gte',
}

/** How conditional-gate compares a character stat with its threshold. */
export enum GateOperator {
  AtLeast = 'gte',
  Above = 'gt',
  AtMost = 'lte',
  Below = 'lt',
  Exactly = 'eq',
}

/** Whether a raw config value is a conditional-gate operator. */
export function isGateOperator(value: unknown): value is GateOperator {
  return Object.values(GateOperator).some((operator) => operator === value);
}

export const PIPELINE_BLOCK_ROLES = [
  PIPELINE_BLOCK.TestResolver,
  PIPELINE_BLOCK.InsightResolver,
  PIPELINE_BLOCK.RollModifier,
] as const;
export type PipelineBlockRole = (typeof PIPELINE_BLOCK_ROLES)[number];

export type PipelineBlockAvailability =
  | { kind: 'common' }
  | { kind: 'role'; role: PipelineBlockRole };

export interface PipelineEditorFieldPresentation {
  optional?: boolean;
  placeholder?: string;
  hint?: string;
  rows?: number;
  columnSpan?: 1 | 2 | 3;
  /** Show the field only while another config field holds one of these values; hidden values are cleared. */
  visibleWhen?: { path: string; equals: readonly string[] };
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

/** What a Game System supplies for a role block: its config schema, default config and editor layout. */
export interface RoleBlockImplementationSpec {
  configSchema: JSONSchema7;
  defaultConfig: JsonObject;
  editor: PipelineBlockSpec['editor'];
}

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
    blockType: PIPELINE_BLOCK.MessagePlayer,
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
    blockType: PIPELINE_BLOCK.MessageChannel,
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
    blockType: PIPELINE_BLOCK.MessageGroup,
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
    blockType: PIPELINE_BLOCK.DisplayImage,
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
    blockType: PIPELINE_BLOCK.AddJournalEntry,
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
    blockType: PIPELINE_BLOCK.AddQuest,
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
    blockType: PIPELINE_BLOCK.ConditionalGate,
    version: 1,
    label: 'Conditional Gate',
    availability: { kind: 'common' },
    configSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        statPath: { type: 'string' },
        operator: { type: 'string', enum: Object.values(GateOperator) },
        threshold: { type: 'number' },
      },
      required: ['statPath', 'operator', 'threshold'],
    },
    defaultConfig: { statPath: '', operator: GateOperator.AtLeast, threshold: 1 },
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
            { value: GateOperator.AtLeast, label: 'At least' },
            { value: GateOperator.Above, label: 'More than' },
            { value: GateOperator.AtMost, label: 'At most' },
            { value: GateOperator.Below, label: 'Less than' },
            { value: GateOperator.Exactly, label: 'Exactly' },
          ],
        },
        { kind: 'number', path: 'threshold', label: 'Threshold', placeholder: '1' },
      ],
    },
  },
  {
    blockType: PIPELINE_BLOCK.OutcomeMap,
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
              loreEntryIds: { type: 'array', items: { type: 'string' } },
              npcFactIds: { type: 'array', items: { type: 'string' } },
            },
            required: ['threshold', 'text'],
          },
        },
        shortCircuit: { type: 'boolean' },
        comparison: {
          type: 'string',
          enum: Object.values(OutcomeComparison),
          description: 'How the score is compared with each threshold; missing means gt.',
        },
      },
      required: ['outcomes'],
    },
    defaultConfig: {
      outcomes: [{ threshold: 0, text: '' }],
      shortCircuit: true,
    },
    editor: {
      fields: [
        {
          kind: 'select',
          path: 'comparison',
          label: 'Score must be',
          optional: true,
          options: [
            { value: OutcomeComparison.Above, label: 'Above the threshold' },
            { value: OutcomeComparison.AtLeast, label: 'At or above the threshold' },
          ],
        },
        { kind: 'outcome-list', path: 'outcomes', label: 'Outcomes' },
      ],
    },
  },
  {
    blockType: PIPELINE_BLOCK.RetrieveData,
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
    blockType: PIPELINE_BLOCK.TestResolver,
    version: 1,
    label: 'Test resolver',
    availability: { kind: 'role', role: 'test-resolver' },
    // Open on purpose: the campaign's Game System supplies and validates the real shape.
    configSchema: { type: 'object', additionalProperties: true },
    defaultConfig: {},
    editor: { fields: [] },
  },
  {
    blockType: PIPELINE_BLOCK.RollModifier,
    version: 1,
    label: 'Roll modifier',
    availability: { kind: 'role', role: 'roll-modifier' },
    // Open on purpose: the campaign's Game System supplies and validates the real shape.
    configSchema: { type: 'object', additionalProperties: true },
    defaultConfig: {},
    editor: { fields: [] },
  },
  {
    blockType: PIPELINE_BLOCK.InsightResolver,
    version: 1,
    label: 'Insight resolver',
    availability: { kind: 'role', role: 'insight-resolver' },
    // Open on purpose: the campaign's Game System supplies and validates the real shape.
    configSchema: { type: 'object', additionalProperties: true },
    defaultConfig: {},
    editor: { fields: [] },
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

export function isPipelineBlockRole(value: string): value is PipelineBlockRole {
  return PIPELINE_BLOCK_ROLES.some((role) => role === value);
}

const EVENT_TYPE_ROLES: Partial<Record<string, PipelineBlockRole>> = {
  test: PIPELINE_BLOCK.TestResolver,
  insight: PIPELINE_BLOCK.InsightResolver,
};

/** The role a Game System must implement to run this Event type, or undefined when none is needed. */
export function getEventTypeRole(eventType: string): PipelineBlockRole | undefined {
  return EVENT_TYPE_ROLES[eventType];
}

/** A block is available when it is common or the Game System implements its role. */
export function isPipelineBlockAvailable(
  spec: PipelineBlockSpec,
  implementedRoles: readonly PipelineBlockRole[],
): boolean {
  return spec.availability.kind === 'common' || implementedRoles.includes(spec.availability.role);
}

export function listPipelineBlockSpecs(
  implementedRoles?: readonly PipelineBlockRole[],
): readonly PipelineBlockSpec[] {
  if (!implementedRoles) {
    return PIPELINE_BLOCK_SPECS;
  }
  return PIPELINE_BLOCK_SPECS.filter((spec) => isPipelineBlockAvailable(spec, implementedRoles));
}

/** Overlays a Game System's role implementation onto the catalogue's role spec. */
export function withRoleImplementation(
  spec: PipelineBlockSpec,
  implementation: RoleBlockImplementationSpec,
): PipelineBlockSpec {
  return { ...spec, ...implementation };
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
