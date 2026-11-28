/** Every Game System by name. Adding a system is a code change, so the set is closed. */
export const GAME_SYSTEM = {
  VtmV5: 'vtm-v5',
  MorkBorg: 'mork-borg',
  FiveESrd: '5e-srd',
} as const;

export type GameSystemId = (typeof GAME_SYSTEM)[keyof typeof GAME_SYSTEM];

export const GAME_SYSTEM_IDS: readonly GameSystemId[] = Object.values(GAME_SYSTEM);

/** Whether a raw value (from the database, an API body or a Discord option) is a known Game System id. */
export function isGameSystemId(value: string): value is GameSystemId {
  return (GAME_SYSTEM_IDS as readonly string[]).includes(value);
}
