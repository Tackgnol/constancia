import { FallbackStatRow } from './fallback-stat-row';
import { MorkBorgStatRow } from './mork-borg-stat-row';
import type { StatRowComponent } from './types';
import { VtmStatRow } from './vtm-stat-row';

const REGISTRY: Record<string, StatRowComponent> = {
  'vtm-v5': VtmStatRow,
  'mork-borg': MorkBorgStatRow,
};

export function resolveStatRow(systemId: string | undefined): StatRowComponent {
  if (!systemId) return FallbackStatRow;
  return REGISTRY[systemId] ?? FallbackStatRow;
}

export { VtmStatRow, MorkBorgStatRow, FallbackStatRow };
export type { StatRowProps, StatRowComponent, StatValue } from './types';
