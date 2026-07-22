export interface WarRoomModeTab {
  to: string;
  label: string;
  end?: boolean;
}

const sharedModeDefinitions = [
  { path: 'setup', label: 'Setup' },
  { path: '', label: 'Play', end: true },
  { path: 'map', label: 'Map' },
  { path: 'npcs', label: 'NPCs' },
  { path: 'participants', label: 'Participants' },
  { path: 'lore', label: 'Lore' },
  { path: 'log', label: 'Quests' },
] as const;

function modePath(basePath: string, path: string): string {
  if (path.length === 0) {
    return basePath.length > 0 ? basePath : '/';
  }

  return `${basePath}/${path}`;
}

export function buildWarRoomModeTabs(
  basePath: '' | '/demo',
  options: { includePlayer?: boolean } = {},
): WarRoomModeTab[] {
  const tabs = sharedModeDefinitions.map((definition) => ({
    to: modePath(basePath, definition.path),
    label: definition.label,
    ...('end' in definition ? { end: definition.end } : {}),
  }));

  return options.includePlayer
    ? [...tabs, { to: modePath(basePath, 'player/sheet'), label: 'Player' }]
    : tabs;
}
