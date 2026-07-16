import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Outlet, useLoaderData, useLocation } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlayerWhisperForm } from '@/components/war-room/player-whisper-form';
import { SceneRailExtras } from '@/components/war-room/scene-rail-extras';
import { WarRoomModeTabs } from '@/components/war-room/mode-tabs';
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
  { to: '/demo/participants', label: 'Participants' },
  { to: '/demo/lore', label: 'Lore' },
  { to: '/demo/log', label: 'Quests' },
  { to: '/demo/player/sheet', label: 'Player' },
];

const quickNarrationSchema = z.object({
  message: z
    .string()
    .trim()
    .min(8, 'Enter at least 8 characters so the room gets a complete narration cue.')
    .max(240, 'Shorten this narration to 240 characters or fewer, then broadcast it.'),
});

type QuickNarrationValues = z.infer<typeof quickNarrationSchema>;

const clanToneByCharacter: Record<string, string> = {
  Brujah: 'brujah',
  Toreador: 'toreador',
  Nosferatu: 'nosferatu',
  Malkavian: 'malkavian',
};

function getClanTone(character: string) {
  return clanToneByCharacter[character] ?? 'neutral';
}

function formatActivityTime() {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

function truncateActivityLabel(message: string) {
  return message.length > 60 ? `${message.slice(0, 59)}…` : message;
}

export default function DemoLayout() {
  useLoaderData<typeof loader>();

  const location = useLocation();
  const isPlayRoute = location.pathname === '/demo' || location.pathname === '/demo/';
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activity, setActivity] = useState(demoContext.activity);
  const [firedEventIds, setFiredEventIds] = useState<string[]>([]);
  const [quickBarNotice, setQuickBarNotice] = useState<string | null>(null);
  const [mobilePlayersOpen, setMobilePlayersOpen] = useState(false);
  const [pulseEntries, setPulseEntries] = useState(() => activity.slice(0, 3));
  const quickBarForm = useForm<QuickNarrationValues>({
    resolver: zodResolver(quickNarrationSchema),
    defaultValues: { message: '' },
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = quickBarForm;

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
    ...demoContext,
    activeTag,
    activity,
    demoMode: true,
    firedEventIds,
    recordActivity,
    setEventFiredState,
  };

  useEffect(() => {
    setPulseEntries(activity.slice(0, 3));

    const timer = window.setTimeout(() => {
      setPulseEntries([]);
    }, 12_000);

    return () => window.clearTimeout(timer);
  }, [activity, location.pathname]);

  const onSubmitQuickBar = handleSubmit(async (values) => {
    try {
      clearErrors('root');
      const message = values.message.trim();

      recordActivity(`Broadcast queued · ${truncateActivityLabel(message)}`);
      setQuickBarNotice('Narration pulse pushed to the room.');
      reset({ message: '' });
    } catch (error) {
      console.error('Quick narration error:', error);
      setError('root.serverError', {
        type: 'manual',
        message:
          "We couldn't broadcast this narration. Your text is still here; review it and try again.",
      });
      setQuickBarNotice(null);
    }
  });

  const quickBarError = errors.message?.message ?? errors.root?.serverError?.message;

  return (
    <div className={`war-room-shell ${isPlayRoute ? 'is-live-play' : 'is-management'}`}>
      <div className="demo-banner" role="status">
        Demo mode: no auth required. Data stays local, and state resets on refresh.
      </div>

      <header className="topbar">
        <div className="topbar-group">
          <span className="campaign-name">{outletContext.campaign.name}</span>
          <span className="system-badge">{outletContext.system.name}</span>
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
              aria-controls="demo-players-panel-content"
              aria-expanded={mobilePlayersOpen}
              onClick={() => setMobilePlayersOpen((current) => !current)}
            >
              <span>Players and pulse</span>
              <span>{mobilePlayersOpen ? 'Close' : `${outletContext.players.length} players`}</span>
            </button>

            <div className="players-panel-content" id="demo-players-panel-content">
              <div className="panel-title">Players</div>

              <div className="player-list">
                {outletContext.players.map((player) => (
                  <button
                    key={player.id}
                    className="player-row"
                    data-clan={getClanTone(player.character)}
                    type="button"
                  >
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

              <div className="panel-title panel-title-secondary">Pulse</div>
              <p className="panel-copy">
                Three fresh beats only. The rail clears itself when the room moves on.
              </p>
              {pulseEntries.length > 0 ? (
                <div className="activity-feed">
                  {pulseEntries.map((entry) => (
                    <p key={entry.id}>
                      <span>{entry.time}</span>
                      {entry.label}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="panel-empty">
                  No fresh pulses on this route. Quest history stays in Quests.
                </p>
              )}
            </div>
          </aside>
        ) : null}
      </div>

      {isPlayRoute ? (
        <footer className="quick-bar">
          <form className="quick-form" onSubmit={onSubmitQuickBar} noValidate>
            <div className="quick-form-row">
              <input
                aria-describedby="quick-bar-feedback"
                aria-invalid={quickBarError ? true : undefined}
                aria-label="Quick narration"
                className="quick-input"
                placeholder="Broadcast a quick narration..."
                type="text"
                {...register('message')}
              />
              <button className="quick-send" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Broadcasting…' : 'Broadcast'}
              </button>
            </div>
            {quickBarError ? (
              <p
                className="quick-bar-feedback quick-bar-error"
                id="quick-bar-feedback"
                role="alert"
              >
                {quickBarError}
              </p>
            ) : quickBarNotice ? (
              <p
                className="quick-bar-feedback quick-bar-success"
                id="quick-bar-feedback"
                role="status"
              >
                {quickBarNotice}
              </p>
            ) : (
              <p className="quick-bar-feedback quick-bar-hint" id="quick-bar-feedback">
                Press Enter to send. Keep it short enough to play like a live cue.
              </p>
            )}
          </form>
        </footer>
      ) : null}
    </div>
  );
}
