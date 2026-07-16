import {
  listCampaigns,
  updateCampaign,
} from '@constancia/api-client/endpoints/campaigns/campaigns';
import { listChannels } from '@constancia/api-client/endpoints/channels/channels';
import { listCharacters } from '@constancia/api-client/endpoints/characters/characters';
import { listEvents } from '@constancia/api-client/endpoints/events/events';
import { listQuests } from '@constancia/api-client/endpoints/journal/journal';
import { listLoreEntries } from '@constancia/api-client/endpoints/lore/lore';
import { getServiceHealth } from '@constancia/api-client/endpoints/meta/meta';
import { listGameSystems } from '@constancia/api-client/endpoints/systems/systems';
import { PlayerWhisperForm } from '@/components/war-room/player-whisper-form';
import { SceneRailExtras } from '@/components/war-room/scene-rail-extras';
import { WarRoomModeTabs } from '@/components/war-room/mode-tabs';
import { assertApiOk, getApiErrorMessage } from '@/lib/api-errors';
import { buildServerApiOptions } from '@/lib/api-proxy.server';
import type { PlayerPresence } from '@/lib/war-room-data';
import {
  activityFeed,
  fallbackCampaign,
  fallbackSystem,
  normalizeCampaigns,
  normalizeSystems,
  players,
  type WarRoomContext,
} from '@/lib/war-room-data';
import { useEffect, useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import {
  Form,
  Outlet,
  redirect,
  useFetcher,
  useLoaderData,
  useLocation,
  useRevalidator,
} from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
  const fetchOpts: RequestInit = {
    credentials: 'include',
    headers: {
      cookie: request.headers.get('Cookie') || '',
    },
  };

  const [health, campaigns, systems] = await Promise.all([
    getServiceHealth(fetchOpts),
    listCampaigns(fetchOpts),
    listGameSystems(fetchOpts),
  ]);

  if (campaigns.status !== 'ok') {
    throw redirect('/auth');
  }

  const campaignId = campaigns.data[0]?.id;
  const [channels, events, characters, quests, lore] = campaignId
    ? await Promise.all([
        listChannels({ id: campaignId }, fetchOpts),
        listEvents({ id: campaignId }, fetchOpts),
        listCharacters({ id: campaignId }, fetchOpts),
        listQuests({ id: campaignId }, fetchOpts),
        listLoreEntries({ id: campaignId }, fetchOpts),
      ])
    : [
        { status: 'error', data: [] },
        { status: 'error', data: [] },
        { status: 'error', data: [] },
        { status: 'error', data: [] },
        { status: 'error', data: [] },
      ];

  return { health, campaigns, systems, channels, events, characters, quests, lore };
}

type RenameCampaignActionData = { status: 'success' } | { status: 'error'; message: string };

function isRenameCampaignActionData(value: unknown): value is RenameCampaignActionData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    ((value as { status?: unknown }).status === 'success' ||
      ((value as { status?: unknown }).status === 'error' &&
        typeof (value as { message?: unknown }).message === 'string'))
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const campaignId = formData.get('campaignId');
  const name = formData.get('name');

  if (intent !== 'rename-campaign') {
    return Response.json(
      { status: 'error', message: 'Unsupported campaign action.' },
      { status: 400 },
    );
  }

  if (
    typeof campaignId !== 'string' ||
    campaignId.length === 0 ||
    typeof name !== 'string' ||
    name.trim().length === 0
  ) {
    return Response.json(
      { status: 'error', message: 'Campaign name is incomplete.' },
      { status: 400 },
    );
  }

  try {
    const response = await updateCampaign(
      { id: campaignId },
      { name: name.trim() },
      buildServerApiOptions(request),
    );
    assertApiOk(response, 'The campaign name did not update cleanly. Try again.');
    return Response.json({ status: 'success' });
  } catch (caught) {
    return Response.json(
      {
        status: 'error',
        message: getApiErrorMessage(caught, 'The campaign name did not update cleanly. Try again.'),
      },
      { status: 500 },
    );
  }
}

const tabs = [
  { to: '/setup', label: 'Setup' },
  { to: '/', label: 'Play', end: true },
  { to: '/npcs', label: 'NPCs' },
  { to: '/lore', label: 'Lore' },
  { to: '/participants', label: 'Participants' },
  { to: '/log', label: 'Quests' },
];

export default function WarRoomLayout() {
  const location = useLocation();
  const { health, campaigns, systems, channels, events, characters, quests, lore } =
    useLoaderData<typeof loader>();
  const renameFetcher = useFetcher<RenameCampaignActionData>();
  const revalidator = useRevalidator();

  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [mobilePlayersOpen, setMobilePlayersOpen] = useState(false);

  const liveCampaign = normalizeCampaigns(campaigns).at(0) ?? fallbackCampaign;
  const liveSystem = normalizeSystems(systems).at(0) ?? fallbackSystem;
  const [editNameValue, setEditNameValue] = useState(liveCampaign.name);

  const liveChannels = (channels.status === 'ok' ? channels.data : []).map((ch) => ({
    id: ch.id,
    discordId: ch.discordChannelId,
    name: ch.name,
  }));

  const liveEvents = events.status === 'ok' ? events.data : [];
  const liveQuests = quests.status === 'ok' ? quests.data : [];
  const liveLore = lore.status === 'ok' ? lore.data : [];
  const isPlayRoute = location.pathname === '/';
  const tagEventCounts = new Map<string, number>();
  for (const event of liveEvents) {
    tagEventCounts.set(event.channelId, (tagEventCounts.get(event.channelId) ?? 0) + 1);
  }

  const liveCharacters = characters.status === 'ok' ? characters.data : [];
  const livePlayers: PlayerPresence[] = liveCharacters.map((char) => {
    const systemData = char.systemData as Record<string, unknown> | undefined;
    const clan = typeof systemData?.clan === 'string' ? systemData.clan : 'Unknown';
    const discordName = (char as Record<string, unknown>).discordName as string | undefined;
    const gameName = (char as Record<string, unknown>).gameName as string | undefined;

    return {
      id: char.id,
      name: gameName || discordName || char.name, // game name when set, else discord name
      character: clan,
      player: discordName || char.name, // always the Discord display name
      status: 'online',
    };
  });

  const renameActionData = isRenameCampaignActionData(renameFetcher.data)
    ? renameFetcher.data
    : undefined;

  useEffect(() => {
    if (!isEditingName) {
      setEditNameValue(liveCampaign.name);
    }
  }, [isEditingName, liveCampaign.name]);

  useEffect(() => {
    if (renameActionData?.status === 'success') {
      setIsEditingName(false);
      revalidator.revalidate();
    }
  }, [renameActionData, revalidator]);

  const submitCampaignName = () => {
    const trimmed = editNameValue.trim();
    if (trimmed.length === 0 || trimmed === liveCampaign.name || renameFetcher.state !== 'idle') {
      if (trimmed === liveCampaign.name) {
        setIsEditingName(false);
      }
      return;
    }

    renameFetcher.submit(
      {
        intent: 'rename-campaign',
        campaignId: liveCampaign.id,
        name: trimmed,
      },
      { method: 'post' },
    );
  };

  const outletContext: WarRoomContext = {
    campaign: {
      ...liveCampaign,
      connectedPlayers: livePlayers.length,
    },
    channels: liveChannels,
    system: liveSystem,
    tags: liveChannels.map((ch) => ({ id: ch.id, label: `# ${ch.name}` })),
    activeTag,
    players: livePlayers.length > 0 ? livePlayers : players,
    rawCharacters: liveCharacters.length > 0 ? liveCharacters : [],
    activity: activityFeed,
    apiOnline: health.status === 'ok',
    events: liveEvents,
    quests: liveQuests,
    lore: liveLore,
  };

  return (
    <div className={`war-room-shell ${isPlayRoute ? 'is-live-play' : 'is-management'}`}>
      <div className="design-label">A - War Room</div>

      <header className="topbar">
        <div className="topbar-group">
          {isEditingName ? (
            <form
              className="campaign-name-form"
              onSubmit={(event) => {
                event.preventDefault();
                submitCampaignName();
              }}
            >
              <input
                aria-label="Campaign name"
                className="campaign-name-input"
                onChange={(event) => setEditNameValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setEditNameValue(liveCampaign.name);
                    setIsEditingName(false);
                  }
                }}
                value={editNameValue}
              />
              <button
                className="campaign-name-action"
                disabled={renameFetcher.state !== 'idle'}
                type="submit"
              >
                Save
              </button>
            </form>
          ) : (
            <button
              className="campaign-name campaign-name-button"
              onClick={() => setIsEditingName(true)}
              type="button"
            >
              {outletContext.campaign.name}
            </button>
          )}
          <span className="system-badge">{outletContext.system.name}</span>
          <span className="channel-name campaign-channel">{outletContext.campaign.channel}</span>
          <span className="channel-name gm-name">GM: authenticated</span>
        </div>

        <div className="topbar-group topbar-status">
          <span
            className={`status-dot ${outletContext.apiOnline ? 'is-live' : 'is-stale'}`}
            aria-hidden="true"
          />
          <span className={outletContext.apiOnline ? 'status-live' : 'status-stale'}>
            {outletContext.apiOnline ? 'Live' : 'Offline'}
          </span>
          <span className="status-meta">{outletContext.campaign.connectedPlayers} online</span>
          <Form action="/logout" method="post">
            <button className="signout-button" type="submit">
              Sign Out
            </button>
          </Form>
        </div>
      </header>

      <WarRoomModeTabs tabs={tabs} />

      <div className="war-room-grid">
        {isPlayRoute ? (
          <aside className="filter-panel">
            <div className="panel-title">Scene Filter</div>
            <div className="filter-tag-list">
              <button
                className={`filter-tag${activeTag === null ? ' is-active' : ''}`}
                onClick={() => setActiveTag(null)}
                type="button"
              >
                All Scenes
              </button>
              {outletContext.tags.map((tag) => {
                const count = tagEventCounts.get(tag.id) ?? 0;
                return (
                  <button
                    key={tag.id}
                    className={`filter-tag${activeTag === tag.id ? ' is-active' : ''}`}
                    disabled={count === 0}
                    onClick={() => setActiveTag(activeTag === tag.id ? null : tag.id)}
                    type="button"
                  >
                    {tag.label}
                    {count > 0 && <span className="filter-tag-count">{count}</span>}
                  </button>
                );
              })}
            </div>

            <SceneRailExtras
              tags={outletContext.tags}
              activeTag={activeTag}
              eventCount={Array.from(tagEventCounts.values()).reduce((a, b) => a + b, 0)}
              activeEventCount={activeTag ? (tagEventCounts.get(activeTag) ?? 0) : 0}
            />
          </aside>
        ) : null}

        <main className="route-panel">
          <Outlet context={outletContext} />
        </main>

        {isPlayRoute ? (
          <aside className={`players-panel${mobilePlayersOpen ? ' is-mobile-open' : ''}`}>
            <button
              className="mobile-panel-toggle"
              type="button"
              aria-controls="live-players-panel-content"
              aria-expanded={mobilePlayersOpen}
              onClick={() => setMobilePlayersOpen((current) => !current)}
            >
              <span>Players and activity</span>
              <span>{mobilePlayersOpen ? 'Close' : `${outletContext.players.length} players`}</span>
            </button>

            <div className="players-panel-content" id="live-players-panel-content">
              <div className="panel-title">Players</div>

              <div className="player-list">
                {outletContext.players.map((player) => (
                  <button key={player.id} className="player-row" type="button">
                    <span className="player-avatar" aria-hidden="true">
                      {player.name.charAt(0)}
                    </span>
                    <span className="player-copy">
                      <span className="player-name">{player.name}</span>
                      <span className="player-meta">
                        {player.character} · {player.player}
                      </span>
                    </span>
                    <span className={`player-status ${player.status}`} aria-label={player.status} />
                  </button>
                ))}
              </div>

              <PlayerWhisperForm warRoom={outletContext} />

              <div className="panel-title panel-title-secondary">Recent activity</div>
              <div className="activity-feed">
                {outletContext.activity.map((entry) => (
                  <p key={entry.id}>
                    <span>{entry.time}</span>
                    {entry.label}
                  </p>
                ))}
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      {isPlayRoute ? (
        <footer className="quick-bar">
          <input
            aria-label="Quick narration"
            className="quick-input"
            placeholder="Broadcast a quick narration..."
            type="text"
          />
          <button className="quick-send" type="button">
            Broadcast
          </button>
        </footer>
      ) : null}
    </div>
  );
}
