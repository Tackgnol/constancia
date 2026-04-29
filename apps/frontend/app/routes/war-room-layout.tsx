import { listCampaigns } from '@constancia/api-client/endpoints/campaigns/campaigns';
import { listChannels } from '@constancia/api-client/endpoints/channels/channels';
import { listCharacters } from '@constancia/api-client/endpoints/characters/characters';
import { listEvents } from '@constancia/api-client/endpoints/events/events';
import { getServiceHealth } from '@constancia/api-client/endpoints/meta/meta';
import { listGameSystems } from '@constancia/api-client/endpoints/systems/systems';
import { PlayerWhisperForm } from '@/components/war-room/player-whisper-form';
import { SceneRailExtras } from '@/components/war-room/scene-rail-extras';
import { authClient } from '@/lib/auth-client';
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
import { useState } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { NavLink, Outlet, redirect, useLoaderData, useNavigate } from 'react-router';

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
  const [channels, events, characters] = campaignId
    ? await Promise.all([
        listChannels({ id: campaignId }, fetchOpts),
        listEvents({ id: campaignId }, fetchOpts),
        listCharacters({ id: campaignId }, fetchOpts),
      ])
    : [
        { status: 'error', data: [] },
        { status: 'error', data: [] },
        { status: 'error', data: [] },
      ];

  return { health, campaigns, systems, channels, events, characters };
}

const tabs = [
  { to: '/setup', label: 'Setup' },
  { to: '/', label: 'Play', end: true },
  { to: '/npcs', label: 'NPCs' },
  { to: '/participants', label: 'Participants' },
  { to: '/log', label: 'Log' },
];

export default function WarRoomLayout() {
  const navigate = useNavigate();
  const { health, campaigns, systems, channels, events, characters } =
    useLoaderData<typeof loader>();
  const session = authClient.useSession();

  const [activeTag, setActiveTag] = useState<string | null>(null);

  const liveCampaign = normalizeCampaigns(campaigns).at(0) ?? fallbackCampaign;
  const liveSystem = normalizeSystems(systems).at(0) ?? fallbackSystem;
  const onlinePlayers = players.filter((player) => player.status === 'online').length;

  const liveChannels = (channels.status === 'ok' ? channels.data : []).map((ch) => ({
    id: ch.id,
    discordId: ch.discordChannelId,
    name: ch.name,
  }));

  const liveEvents = events.status === 'ok' ? events.data : [];
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

  const outletContext: WarRoomContext = {
    campaign: {
      ...liveCampaign,
      connectedPlayers: liveCampaign.connectedPlayers || onlinePlayers,
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
  };

  return (
    <div className="war-room-shell">
      <div className="design-label">A - War Room</div>

      <header className="topbar">
        <div className="topbar-group">
          <span className="campaign-name">{outletContext.campaign.name}</span>
          <span className="system-badge">{outletContext.system.name}</span>
          <span className="channel-name">{outletContext.campaign.channel}</span>
          <span className="channel-name">GM: {session.data?.user.name ?? '—'}</span>
        </div>

        <div className="topbar-group topbar-status">
          <span
            className={`status-dot ${outletContext.apiOnline ? 'is-live' : 'is-stale'}`}
            aria-hidden="true"
          />
          <span className={outletContext.apiOnline ? 'status-live' : 'status-stale'}>
            {outletContext.apiOnline ? 'Live' : 'Offline'}
          </span>
          <span className="status-meta">
            {outletContext.campaign.connectedPlayers} players connected
          </span>
          <button
            className="signout-button"
            onClick={() => {
              void authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    navigate('/auth', { replace: true });
                  },
                },
              });
            }}
            type="button"
          >
            Sign Out
          </button>
        </div>
      </header>

      <nav className="mode-tabs" aria-label="War room modes">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            className={({ isActive }) => `mode-tab${isActive ? ' is-active' : ''}`}
            end={tab.end}
            to={tab.to}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="war-room-grid">
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

        <main className="route-panel">
          <Outlet context={outletContext} />
        </main>

        <aside className="players-panel">
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

          <div className="panel-title panel-title-secondary">Recent Activity</div>
          <div className="activity-feed">
            {outletContext.activity.map((entry) => (
              <p key={entry.id}>
                <span>{entry.time}</span>
                {entry.label}
              </p>
            ))}
          </div>
        </aside>
      </div>

      <footer className="quick-bar">
        <input
          aria-label="Quick narration"
          className="quick-input"
          placeholder="Quick narration... type and press Enter to broadcast to channel"
          type="text"
        />
        <button className="quick-send" type="button">
          Broadcast
        </button>
      </footer>
    </div>
  );
}
