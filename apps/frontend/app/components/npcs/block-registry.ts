import type {
  NpcSystemBlockDefinition,
  NpcSystemBlockValue,
  GameSystemId,
} from '@constancia/contracts';
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

export function getNpcBlockDefinitions(systemId: GameSystemId): NpcSystemBlockDefinition[] {
  return getNpcSystemBlockDefinitions(systemId);
}

export function getNpcBlockDefinition(
  systemId: GameSystemId,
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
  systemId: GameSystemId,
  blocks: CampaignNpcSystemBlock[],
): NpcEditorBlock[] {
  return blocks.map((block) => ({
    key: randomKey(),
    blockType: block.blockType,
    label: block.label,
    valueText: stringifyBlockValue(block.value),
  }));
}

export function toApiBlocks(
  systemId: GameSystemId,
  blocks: NpcEditorBlock[],
): CampaignNpcSystemBlock[] {
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

export function createEditorBlock(
  systemId: GameSystemId,
  blockType: string,
): NpcEditorBlock | null {
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

/** The NPC's headline blocks, in the order the Game System declares them. */
export function listHeadlineSystemBlocks(
  npc: Pick<CampaignNpc, 'systemBlocks'>,
  systemId: GameSystemId,
) {
  return getNpcSystemBlockDefinitions(systemId)
    .filter((definition) => definition.display === 'headline')
    .flatMap((definition) =>
      npc.systemBlocks.filter((block) => block.blockType === definition.blockType),
    );
}

/** Every headline block as "Label: value", joined in declared order; the first block when none is a headline. */
export function formatHeadlineSummary(
  npc: Pick<CampaignNpc, 'systemBlocks'>,
  systemId: GameSystemId,
): string | null {
  const headlines = listHeadlineSystemBlocks(npc, systemId);
  const shown = headlines.length > 0 ? headlines : npc.systemBlocks.slice(0, 1);
  if (shown.length === 0) return null;
  return shown.map((block) => `${block.label}: ${formatSystemBlockValue(block.value)}`).join(' · ');
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
