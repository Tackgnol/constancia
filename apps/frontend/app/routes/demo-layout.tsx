import { useState } from 'react';
import { Outlet, useLoaderData, useLocation } from 'react-router';
import { WarRoomModeTabs } from '@/components/war-room/mode-tabs';
import { GameDateControl } from '@/components/war-room/game-date-control';
import { PlayerRail } from '@/components/war-room/player-rail';
import { QuickNarrationForm } from '@/components/war-room/quick-narration-form';
import { quickNarrationActivityLabel } from '@/components/war-room/quick-narration';
import { buildWarRoomModeTabs } from '@/components/war-room/war-room-navigation';
import { SceneRailExtras } from '@/components/war-room/scene-rail-extras';
import { loadDemoWarRoomProjection } from '@/lib/demo-war-room-projection';
import type { GameDate } from '@constancia/contracts';

export function loader() {
  return loadDemoWarRoomProjection();
}

const tabs = buildWarRoomModeTabs('/demo', { includePlayer: true });
const activityTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatActivityTime() {
  return activityTimeFormatter.format(new Date());
}

export default function DemoLayout() {
  const projection = useLoaderData<typeof loader>();

  const location = useLocation();
  const isPlayRoute = location.pathname === '/demo' || location.pathname === '/demo/';
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activity, setActivity] = useState(projection.activity);
  const [firedEventIds, setFiredEventIds] = useState<string[]>([]);
  const [mobilePlayersOpen, setMobilePlayersOpen] = useState(false);
  const [gameDate, setGameDate] = useState<GameDate | null>(projection.campaign.gameDate);
  const [summaries, setSummaries] = useState(projection.summaries);
  const tagEventCounts = new Map(Object.entries(projection.eventCountByTag));

  const recordActivity = (label: string) => {
    setActivity((current) => [
      {
        id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: formatActivityTime(),
        label,
      },
      ...current,
    ]);
  };

  const setEventFiredState = (eventId: string, fired: boolean) => {
    setFiredEventIds((current) => {
      if (fired) {
        return current.includes(eventId) ? current : [eventId, ...current];
      }

      return current.filter((entry) => entry !== eventId);
    });
  };

  const outletContext = {
    ...projection,
    campaign: { ...projection.campaign, gameDate },
    summaries,
    activeTag,
    activity,
    demoMode: true,
    firedEventIds,
    recordActivity,
    setEventFiredState,
    updateSummaryGameDate: (summaryId: string, nextGameDate: GameDate) => {
      setSummaries((current) =>
        current.map((summary) =>
          summary.id === summaryId ? { ...summary, gameDate: nextGameDate } : summary,
        ),
      );
    },
  };

  return (
    <div className={`war-room-shell ${isPlayRoute ? 'is-live-play' : 'is-management'}`}>
      <div className="demo-banner" role="status">
        Demo mode: no auth required. Data stays local, and state resets on refresh.
      </div>

      <header className="topbar">
        <div className="topbar-group">
          <span className="campaign-name">{outletContext.campaign.name}</span>
          <span className="system-badge">{outletContext.system.name}</span>
          <GameDateControl
            calendar={outletContext.system.calendars[outletContext.system.defaultCalendarId]}
            onSave={setGameDate}
            value={outletContext.campaign.gameDate}
          />
          <span className="channel-name campaign-channel">{outletContext.campaign.channel}</span>
          <span className="channel-name gm-name">GM: Demo GM</span>
        </div>

        <div className="topbar-group topbar-status">
          <span className="status-dot is-live" aria-hidden="true" />
          <span className="status-live">Live</span>
          <span className="status-meta">{outletContext.campaign.connectedPlayers} online</span>
        </div>
      </header>

      <WarRoomModeTabs tabs={tabs} />

      <div className="war-room-grid">
        {isPlayRoute ? (
          <aside className="filter-panel">
            <div className="panel-title">Channel Filter</div>
            <div className="filter-tag-list">
              <button
                className={`filter-tag${activeTag === null ? ' is-active' : ''}`}
                onClick={() => setActiveTag(null)}
                type="button"
              >
                All Channels
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
          <PlayerRail
            contentId="demo-players-panel-content"
            mobileOpen={mobilePlayersOpen}
            onToggleMobile={() => setMobilePlayersOpen((current) => !current)}
            resetKey={location.pathname}
            warRoom={outletContext}
          />
        ) : null}
      </div>

      {isPlayRoute ? (
        <QuickNarrationForm
          onBroadcast={async ({ message }) => {
            recordActivity(quickNarrationActivityLabel(message));
          }}
          successMessage="Narration pulse pushed to the room."
        />
      ) : null}
    </div>
  );
}
