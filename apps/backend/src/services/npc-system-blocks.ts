import type { Prisma } from '@constancia/db';

export type NpcSystemBlockInput = {
  systemId?: string;
  blockType: string;
  label: string;
  value: Prisma.InputJsonValue;
};

export type NpcSystemBlockRecord = {
  systemId?: string;
  blockType: string;
  label: string;
  value: Prisma.JsonValue;
};

function isRecord(value: Prisma.JsonValue): value is Record<string, Prisma.JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeNpcSystemBlocks(input: Prisma.JsonValue): NpcSystemBlockRecord[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const blockType = typeof entry.blockType === 'string' ? entry.blockType : null;
    const label = typeof entry.label === 'string' ? entry.label : null;

    if (blockType === null || label === null || !('value' in entry)) {
      return [];
    }

    return [
      {
        systemId: typeof entry.systemId === 'string' ? entry.systemId : undefined,
        blockType,
        label,
        value: entry.value,
      },
    ];
  });
}

export function toNpcSystemBlocksInput(
  systemBlocks: NpcSystemBlockInput[] | undefined,
): Prisma.InputJsonValue {
  return (systemBlocks ?? []).map((block) => ({
    systemId: block.systemId,
    blockType: block.blockType,
    label: block.label,
    value: block.value,
  })) as Prisma.InputJsonValue;
}
