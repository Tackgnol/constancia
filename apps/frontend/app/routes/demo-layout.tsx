import { useState } from 'react';
import { NavLink, Outlet, useLoaderData } from 'react-router';
import { demoContext, demoCampaigns, demoHealth, demoSystems } from '@/lib/demo-data';
import { triggerSections } from '@/lib/war-room-data';

const tagEventCounts = new Map<string, number>();
for (const section of triggerSections) {
  for (const item of section.items) {
    for (const tag of item.tags ?? []) {
      tagEventCounts.set(tag, (tagEventCounts.get(tag) ?? 0) + 1);
    }
  }
}

export function loader() {
  return { health: demoHealth, campaigns: demoCampaigns, systems: demoSystems };
}

const tabs = [
  { to: '/demo/setup', label: 'Setup' },
  { to: '/demo', label: 'Play', end: true },
  { to: '/demo/npcs', label: 'NPCs' },
  { to: '/demo/log', label: 'Log' },
];

export default function DemoLayout() {
  useLoaderData<typeof loader>();

  const [activeTag, setActiveTag] = useState<string | null>(null);
  const outletContext = { ...demoContext, activeTag };

  return (
    <div className="war-room-shell">
      <div className="demo-banner" role="status">
        Demo Mode — no auth required, all data is local
      </div>

      <div className="design-label">A - War Room</div>

      <header className="topbar">
        <div className="topbar-group">
          <span className="campaign-name">{outletContext.campaign.name}</span>
          <span className="system-badge">{outletContext.system.name}</span>
          <span className="channel-name">{outletContext.campaign.channel}</span>
          <span className="channel-name">GM: Demo GM</span>
        </div>

        <div className="topbar-group topbar-status">
          <span className="status-dot is-live" aria-hidden="true" />
          <span className="status-live">Live</span>
          <span className="status-meta">
            {outletContext.campaign.connectedPlayers} players connected
          </span>
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

          <button className="ghost-action" type="button">
            + Quick Message
          </button>

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
