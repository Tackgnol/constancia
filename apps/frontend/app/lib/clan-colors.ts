/**
 * Canonical clan color palette — stored here once, used anywhere in the UI
 * that needs to visually distinguish characters by clan.
 *
 * Colors are expressed as CSS custom-property-ready HSL strings so they work
 * in both light and dark contexts.  Each entry also has a Tailwind-safe
 * inline-style fallback (`bg` / `text` / `border` as hex values).
 */

export interface ClanColor {
  /** Human-readable clan name */
  clan: string;
  /** Background hex — slightly darkened/muted for badge bg */
  bg: string;
  /** Foreground hex — always light enough to read on bg */
  fg: string;
  /** Border hex — slightly brighter than bg */
  border: string;
}

/**
 * The clan → color map.
 * Key = value that appears in `PlayerPresence.character` from war-room-data.ts.
 */
export const CLAN_COLORS: Record<string, ClanColor> = {
  Ventrue: {
    clan: 'Ventrue',
    bg: '#1a2a5e', // deep royal blue
    fg: '#a8c4f5', // ice blue
    border: '#2d46a3',
  },
  Toreador: {
    clan: 'Toreador',
    bg: '#5c1a2e', // deep rose-red
    fg: '#f4a7b9', // soft rose
    border: '#a0294d',
  },
  Tremere: {
    clan: 'Tremere',
    bg: '#4a0808', // blood crimson
    fg: '#f08080', // light coral
    border: '#8b1010',
  },
  Brujah: {
    clan: 'Brujah',
    bg: '#4a2000', // scorched orange-brown
    fg: '#ffaa55', // amber-orange
    border: '#9a4200',
  },
  Gangrel: {
    clan: 'Gangrel',
    bg: '#1e3320', // forest deep
    fg: '#7dba82', // fern green
    border: '#2e5c33',
  },
  Malkavian: {
    clan: 'Malkavian',
    bg: '#2d1a4a', // twilight purple
    fg: '#c4a8f0', // lavender mist
    border: '#5a3494',
  },
  Nosferatu: {
    clan: 'Nosferatu',
    bg: '#1e2022', // near-black grey
    fg: '#9ba5b0', // steel mist
    border: '#3a4048',
  },
  'Banu Haqim': {
    clan: 'Banu Haqim',
    bg: '#0d1f3c', // midnight navy
    fg: '#7ab0e0', // shadow blue
    border: '#1a3a6e',
  },
  Lasombra: {
    clan: 'Lasombra',
    bg: '#0a0a12', // void black
    fg: '#8fa8d4', // pale royal blue
    border: '#2a2a45',
  },
  Ministry: {
    clan: 'Ministry',
    bg: '#3d2e00', // pharaonic gold-dark
    fg: '#e8c84a', // gold
    border: '#7a5e00',
  },
};

/** Fallback for clans not in the map */
export const DEFAULT_CLAN_COLOR: ClanColor = {
  clan: 'Unknown',
  bg: '#1f2329',
  fg: '#857e7b',
  border: '#2a2e36',
};

export function getClanColor(clan: string): ClanColor {
  return CLAN_COLORS[clan] ?? DEFAULT_CLAN_COLOR;
}
