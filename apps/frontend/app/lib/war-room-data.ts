import type {
  ListEvents200DataItem,
  ListCharacters200DataItem,
  ListLoreEntries200DataItem,
  ListNpcs200DataItem,
  ListQuests200DataItem,
  ListSessionSummaries200DataItem,
} from '@constancia/api-client/model';
import type { GameCalendarDefinition, GameDate } from '@constancia/contracts';
import { GREGORIAN_CALENDAR } from '@constancia/systems';

export type TriggerKind = 'test' | 'narration' | 'insight' | 'message';
export type Presence = 'online' | 'offline';

export type Tag = {
  id: string;
  label: string;
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
  gameSystemId: string;
  gameDate: GameDate | null;
  channel: string;
  connectedPlayers: number;
};

export type SystemSummary = {
  id: string;
  name: string;
  defaultCalendarId: string;
  calendars: Record<string, GameCalendarDefinition>;
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
  summaries: ListSessionSummaries200DataItem[];
  lore: ListLoreEntries200DataItem[];
  npcs?: ListNpcs200DataItem[];
  demoMode?: boolean;
  firedEventIds?: string[];
  recordActivity?: (label: string) => void;
  setEventFiredState?: (eventId: string, fired: boolean) => void;
  updateSummaryGameDate?: (summaryId: string, gameDate: GameDate) => void;
};

export const fallbackCampaign: CampaignSummary = {
  id: 'local-crimson-dynasty',
  name: 'Crimson Dynasty',
  gameSystemId: 'vtm-v5',
  gameDate: null,
  channel: '# the-elysium',
  connectedPlayers: 4,
};

export const fallbackSystem: SystemSummary = {
  id: 'vtm-v5',
  name: 'VTM V5',
  defaultCalendarId: GREGORIAN_CALENDAR.id,
  calendars: { [GREGORIAN_CALENDAR.id]: GREGORIAN_CALENDAR },
};

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

export function buildRecipientOptions(
  rawCharacters: ListCharacters200DataItem[],
  fallbackPlayers: PlayerPresence[],
): RecipientOption[] {
  if (rawCharacters.length > 0) {
    const seen = new Set<string>();
    const recipients: RecipientOption[] = [];

    for (const character of rawCharacters) {
      if (!character.discordUserId || seen.has(character.discordUserId)) continue;
      seen.add(character.discordUserId);
      recipients.push({
        id: character.discordUserId,
        characterId: character.id,
        discordUserId: character.discordUserId,
        displayName: character.gameName || character.discordName || character.name,
        secondaryLabel: `${character.discordName || character.name} · ${character.discordUserId}`,
      });
    }

    return recipients;
  }

  return fallbackPlayers.map((player) => ({
    id: player.id,
    discordUserId: player.id,
    displayName: player.name,
    secondaryLabel: `${player.character} · ${player.player}`,
  }));
}
