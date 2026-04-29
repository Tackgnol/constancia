import type {
  ListEvents200DataItem,
  ListCharacters200DataItem,
  ListLoreEntries200DataItem,
  ListQuests200DataItem,
} from '@constancia/api-client/model';

export type TriggerKind = 'test' | 'narration' | 'insight' | 'message';
export type Presence = 'online' | 'offline';

export type Tag = {
  id: string;
  label: string;
};

export type TriggerCard = {
  id: string;
  kind: TriggerKind;
  name: string;
  meta: string;
  fired?: boolean;
  tags?: string[];
};

export type TriggerSection = {
  id: string;
  title: string;
  kind: TriggerKind;
  items: TriggerCard[];
};

export type PlayerPresence = {
  id: string;
  name: string;
  character: string;
  player: string;
  status: Presence;
};

export type ActivityItem = {
  id: string;
  time: string;
  label: string;
};

export type ChannelEntry = {
  id: string;
  discordId: string;
  name: string;
};

export type CampaignSummary = {
  id: string;
  name: string;
  channel: string;
  connectedPlayers: number;
};

export type SystemSummary = {
  id: string;
  name: string;
};

export type RecipientOption = {
  id: string;
  characterId?: string;
  discordUserId: string;
  displayName: string;
  secondaryLabel: string;
};

export type WarRoomContext = {
  campaign: CampaignSummary;
  channels: ChannelEntry[];
  system: SystemSummary;
  tags: Tag[];
  activeTag: string | null;
  players: PlayerPresence[];
  rawCharacters: ListCharacters200DataItem[];
  activity: ActivityItem[];
  apiOnline: boolean;
  events: ListEvents200DataItem[];
  quests: ListQuests200DataItem[];
  lore: ListLoreEntries200DataItem[];
  demoMode?: boolean;
  firedEventIds?: string[];
  recordActivity?: (label: string) => void;
  setEventFiredState?: (eventId: string, fired: boolean) => void;
};

export const fallbackCampaign: CampaignSummary = {
  id: 'local-crimson-dynasty',
  name: 'Crimson Dynasty',
  channel: '# the-elysium',
  connectedPlayers: 4,
};

export const fallbackSystem: SystemSummary = {
  id: 'vtm-v5',
  name: 'VTM V5',
};

export const sessionTags: Tag[] = [
  { id: 'the-elysium', label: 'The Elysium' },
  { id: 'harpy-court', label: "Harpy's Court" },
  { id: 'victim-bedroom', label: "Victim's Bedroom" },
  { id: 'basement', label: 'House Basement' },
  { id: 'streets', label: 'The Streets' },
];

export const triggerSections: TriggerSection[] = [
  {
    id: 'tests',
    title: 'Tests',
    kind: 'test',
    items: [
      {
        id: 'perception-check',
        kind: 'test',
        name: 'Perception Check',
        meta: 'Wits + Awareness · d3',
        tags: ['the-elysium'],
      },
      {
        id: 'social-manipulation',
        kind: 'test',
        name: 'Social Manipulation',
        meta: 'Manipulation + Persuasion · d4',
        tags: ['harpy-court'],
      },
      {
        id: 'stealth-approach',
        kind: 'test',
        name: 'Stealth Approach',
        meta: 'Dexterity + Stealth · d2',
        fired: true,
        tags: ['basement'],
      },
      {
        id: 'resist-dominate',
        kind: 'test',
        name: 'Resist Dominate',
        meta: 'Resolve + Composure · d5',
        tags: ['harpy-court'],
      },
    ],
  },
  {
    id: 'narrations',
    title: 'Narrations',
    kind: 'narration',
    items: [
      {
        id: 'the-arrival',
        kind: 'narration',
        name: 'The Arrival',
        meta: 'image + text',
        tags: ['the-elysium'],
      },
      {
        id: 'elysium-opens',
        kind: 'narration',
        name: 'Elysium Opens',
        meta: 'text only',
        fired: true,
        tags: ['the-elysium'],
      },
      {
        id: 'the-betrayal',
        kind: 'narration',
        name: 'The Betrayal',
        meta: 'image + text',
        tags: ['harpy-court'],
      },
    ],
  },
  {
    id: 'insights',
    title: 'Stat Insights',
    kind: 'insight',
    items: [
      {
        id: 'occult-sigils',
        kind: 'insight',
        name: 'Occult Sigils',
        meta: 'Occult ≥ 4',
        tags: ['victim-bedroom'],
      },
      {
        id: 'political-tension',
        kind: 'insight',
        name: 'Political Tension',
        meta: 'Politics ≥ 3',
        tags: ['harpy-court'],
      },
      {
        id: 'hidden-weapon',
        kind: 'insight',
        name: 'Hidden Weapon',
        meta: 'Awareness ≥ 3',
        fired: true,
        tags: ['basement'],
      },
    ],
  },
  {
    id: 'messages',
    title: 'Direct Messages',
    kind: 'message',
    items: [
      {
        id: 'princes-warning',
        kind: 'message',
        name: "Prince's Warning",
        meta: '→ Aleksei',
        tags: ['harpy-court'],
      },
      {
        id: 'sires-whisper',
        kind: 'message',
        name: "Sire's Whisper",
        meta: '→ Vivienne',
        tags: ['the-elysium'],
      },
    ],
  },
];

export const players: PlayerPresence[] = [
  {
    id: 'aleksei',
    name: 'Aleksei Volkov',
    character: 'Brujah',
    player: 'Marcin',
    status: 'online',
  },
  {
    id: 'vivienne',
    name: 'Vivienne Lacroix',
    character: 'Toreador',
    player: 'Kasia',
    status: 'online',
  },
  { id: 'marcus', name: 'Marcus Webb', character: 'Nosferatu', player: 'Piotr', status: 'online' },
  { id: 'helena', name: 'Sister Helena', character: 'Malkavian', player: 'Ola', status: 'offline' },
];

export const activityFeed: ActivityItem[] = [
  { id: 'activity-stealth', time: '22:14', label: 'Stealth Approach fired' },
  { id: 'activity-elysium', time: '22:12', label: 'Elysium narration sent' },
  { id: 'activity-roll', time: '22:08', label: 'Aleksei rolled 3 successes' },
  { id: 'activity-start', time: '22:05', label: 'Session started' },
];

function asRecord(input: unknown): Record<string, unknown> | null {
  return typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : null;
}

function extractArray(input: unknown): unknown[] {
  if (Array.isArray(input)) {
    return input;
  }

  const record = asRecord(input);
  const data = record?.data;

  return Array.isArray(data) ? data : [];
}

function readString(
  input: Record<string, unknown> | null,
  keys: string[],
  fallback: string,
): string {
  if (input === null) {
    return fallback;
  }

  for (const key of keys) {
    const value = input[key];

    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return fallback;
}

function readNumber(
  input: Record<string, unknown> | null,
  keys: string[],
  fallback: number,
): number {
  if (input === null) {
    return fallback;
  }

  for (const key of keys) {
    const value = input[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return fallback;
}

export function normalizeCampaigns(input: unknown): CampaignSummary[] {
  return extractArray(input).map((entry, index) => {
    const record = asRecord(entry);

    return {
      id: readString(record, ['id', 'campaignId', 'slug'], `campaign-${index + 1}`),
      name: readString(record, ['name', 'title'], `Campaign ${index + 1}`),
      channel: readString(
        record,
        ['channelName', 'channel', 'discordChannel'],
        fallbackCampaign.channel,
      ),
      connectedPlayers: readNumber(record, ['connectedPlayers', 'playerCount', 'players'], 0),
    };
  });
}

export function normalizeSystems(input: unknown): SystemSummary[] {
  return extractArray(input).map((entry, index) => {
    const record = asRecord(entry);

    return {
      id: readString(record, ['id', 'slug', 'key'], `system-${index + 1}`),
      name: readString(record, ['name', 'label', 'displayName'], `System ${index + 1}`),
    };
  });
}

export function buildRecipientOptions(
  rawCharacters: ListCharacters200DataItem[],
  fallbackPlayers: PlayerPresence[],
): RecipientOption[] {
  if (rawCharacters.length > 0) {
    const seen = new Set<string>();

    return rawCharacters
      .filter((character) => {
        if (!character.discordUserId || seen.has(character.discordUserId)) {
          return false;
        }

        seen.add(character.discordUserId);
        return true;
      })
      .map((character) => ({
        id: character.discordUserId,
        characterId: character.id,
        discordUserId: character.discordUserId,
        displayName: character.gameName || character.discordName || character.name,
        secondaryLabel: [character.discordName || character.name, character.discordUserId]
          .filter(Boolean)
          .join(' · '),
      }));
  }

  return fallbackPlayers.map((player) => ({
    id: player.id,
    discordUserId: player.id,
    displayName: player.name,
    secondaryLabel: `${player.character} · ${player.player}`,
  }));
}
