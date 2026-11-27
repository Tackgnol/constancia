import { FallbackStatRow } from './fallback-stat-row';
import { MorkBorgStatRow } from './mork-borg-stat-row';
import { FiveESheet } from './FiveESheet/FiveESheet';
import type { SheetRendererComponent, StatRowComponent } from './types';
import { VtmStatRow } from './vtm-stat-row';

const REGISTRY: Record<string, StatRowComponent> = {
  'vtm-v5': VtmStatRow,
  'mork-borg': MorkBorgStatRow,
};

/** Systems whose sheet needs the whole stats record at once rather than one row per field. */
const SHEET_REGISTRY: Record<string, SheetRendererComponent> = {
  '5e-srd': FiveESheet,
};

export function resolveSheetRenderer(systemId: string | undefined): SheetRendererComponent | null {
  return systemId ? (SHEET_REGISTRY[systemId] ?? null) : null;
}

/** Whether a Game System has its own row renderer rather than the fallback. */
export function hasStatRowRenderer(systemId: string): boolean {
  return systemId in REGISTRY || systemId in SHEET_REGISTRY;
}

export function resolveStatRow(systemId: string | undefined): StatRowComponent {
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
