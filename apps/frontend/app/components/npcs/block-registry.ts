import type { NpcSystemBlockDefinition, NpcSystemBlockValue } from '@constancia/contracts';
import { getNpcSystemBlockDefinitions } from '@constancia/systems';

export type KnownPlayerRef = {
  characterId: string;
  discordUserId: string;
  displayName: string;
  secondaryLabel: string;
};

export type CampaignNpcSystemBlock = {
  systemId?: string;
  blockType: string;
  label: string;
  value: NpcSystemBlockValue;
};

export type CampaignNpcFact = {
  id: string;
  content: string;
  sortOrder: number;
  npcId: string;
  knownTo: KnownPlayerRef[];
};

export type CampaignNpc = {
  id: string;
  name: string;
  imageUrl?: string | null;
  description: string;
  systemBlocks: CampaignNpcSystemBlock[];
  campaignId: string;
  facts: CampaignNpcFact[];
};

export type NpcEditorBlock = {
  key: string;
  blockType: string;
  label: string;
  valueText: string;
};

function randomKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getNpcBlockDefinitions(systemId: string): NpcSystemBlockDefinition[] {
  return getNpcSystemBlockDefinitions(systemId);
}

export function getNpcBlockDefinition(
  systemId: string,
  blockType: string,
): NpcSystemBlockDefinition | undefined {
  return getNpcBlockDefinitions(systemId).find((definition) => definition.blockType === blockType);
}

export function stringifyBlockValue(value: NpcSystemBlockValue): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null) {
    return '';
  }

  return JSON.stringify(value, null, 2);
}

export function parseEditorBlockValue(
  definition: NpcSystemBlockDefinition,
  valueText: string,
): NpcSystemBlockValue {
  const trimmed = valueText.trim();

  if (definition.editor === 'number') {
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  if (definition.editor === 'json') {
    if (!trimmed) {
      return definition.defaultValue ?? {};
    }

    try {
      return JSON.parse(trimmed) as NpcSystemBlockValue;
    } catch {
      return definition.defaultValue ?? {};
    }
  }

  return trimmed;
}

export function toEditorBlocks(
  systemId: string,
  blocks: CampaignNpcSystemBlock[],
): NpcEditorBlock[] {
  return blocks.map((block) => ({
    key: randomKey(),
    blockType: block.blockType,
    label: block.label,
    valueText: stringifyBlockValue(block.value),
  }));
}

export function toApiBlocks(systemId: string, blocks: NpcEditorBlock[]): CampaignNpcSystemBlock[] {
  return blocks.flatMap((block) => {
    const definition = getNpcBlockDefinition(systemId, block.blockType);

    if (!definition) {
      return [];
    }

    return [
      {
        systemId,
        blockType: definition.blockType,
        label: definition.label,
        value: parseEditorBlockValue(definition, block.valueText),
      },
    ];
  });
}

export function createEditorBlock(systemId: string, blockType: string): NpcEditorBlock | null {
  const definition = getNpcBlockDefinition(systemId, blockType);

  if (!definition) {
    return null;
  }

  return {
    key: randomKey(),
    blockType: definition.blockType,
    label: definition.label,
    valueText: stringifyBlockValue(definition.defaultValue ?? ''),
  };
}

export function readPrimarySystemBlock(npc: Pick<CampaignNpc, 'systemBlocks'>) {
  return (
    npc.systemBlocks.find((block) => block.blockType === 'clan') ??
    npc.systemBlocks.find((block) => block.label.toLowerCase().includes('clan')) ??
    npc.systemBlocks[0] ??
    null
  );
}

export function formatSystemBlockValue(value: NpcSystemBlockValue): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null) {
    return 'Unset';
  }

  return 'Structured';
}

export function normalizeNpc(input: CampaignNpc): CampaignNpc {
  return {
    ...input,
    systemBlocks: input.systemBlocks ?? [],
    facts: [...(input.facts ?? [])].sort((left, right) => left.sortOrder - right.sortOrder),
  };
}

