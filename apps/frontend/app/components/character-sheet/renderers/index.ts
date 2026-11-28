import { FallbackStatRow } from './fallback-stat-row';
import { MorkBorgStatRow } from './mork-borg-stat-row';
import { FiveESheet } from './FiveESheet/FiveESheet';
import type { SheetRendererComponent, StatRowComponent } from './types';
import { VtmStatRow } from './vtm-stat-row';
import { GAME_SYSTEM, type GameSystemId } from '@constancia/contracts';

const REGISTRY: Record<string, StatRowComponent> = {
  [GAME_SYSTEM.VtmV5]: VtmStatRow,
  [GAME_SYSTEM.MorkBorg]: MorkBorgStatRow,
};

/** Systems whose sheet needs the whole stats record at once rather than one row per field. */
const SHEET_REGISTRY: Record<string, SheetRendererComponent> = {
  [GAME_SYSTEM.FiveESrd]: FiveESheet,
};

export function resolveSheetRenderer(
  systemId: GameSystemId | undefined,
): SheetRendererComponent | null {
  return systemId ? (SHEET_REGISTRY[systemId] ?? null) : null;
}

/** Whether a Game System has its own row renderer rather than the fallback. */
export function hasStatRowRenderer(systemId: GameSystemId): boolean {
  return systemId in REGISTRY || systemId in SHEET_REGISTRY;
}

export function resolveStatRow(systemId: GameSystemId | undefined): StatRowComponent {
  if (!systemId) return FallbackStatRow;
  return REGISTRY[systemId] ?? FallbackStatRow;
}

export { VtmStatRow, MorkBorgStatRow, FallbackStatRow };
export type {
  SheetRendererComponent,
  SheetRendererProps,
  StatRowProps,
  StatRowComponent,
  StatValue,
} from './types';
