import { useEffect, useState } from 'react';
import { PlayerWhisperForm } from '@/components/war-room/player-whisper-form';
import { getClanTone } from '@/components/war-room/player-tone';
import type { WarRoomContext } from '@/lib/war-room-data';

interface PlayerRailProps {
  contentId: string;
  mobileOpen: boolean;
  onToggleMobile: () => void;
  resetKey: string;
  warRoom: WarRoomContext;
}

export function PlayerRail({
  contentId,
  mobileOpen,
  onToggleMobile,
  resetKey,
  warRoom,
}: PlayerRailProps) {
  const [pulseEntries, setPulseEntries] = useState(() => warRoom.activity.slice(0, 3));

  useEffect(() => {
    setPulseEntries(warRoom.activity.slice(0, 3));

    const timer = window.setTimeout(() => {
      setPulseEntries([]);
    }, 12_000);

    return () => window.clearTimeout(timer);
  }, [resetKey, warRoom.activity]);

  return (
    <aside className={`players-panel${mobileOpen ? ' is-mobile-open' : ''}`}>
      <button
        className="mobile-panel-toggle"
        type="button"
        aria-controls={contentId}
        aria-expanded={mobileOpen}
        onClick={onToggleMobile}
      >
        <span>Players and pulse</span>
        <span>{mobileOpen ? 'Close' : `${warRoom.players.length} players`}</span>
      </button>

      <div className="players-panel-content" id={contentId}>
        <div className="panel-title">Players</div>

        <div className="player-list">
          {warRoom.players.map((player) => (
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

        <PlayerWhisperForm warRoom={warRoom} />

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
  );
}
