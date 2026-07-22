import { useEffect, useState } from 'react';
import type { Tag } from '@/lib/war-room-data';

const INITIAL_SESSION_ELAPSED_MS = 47 * 60_000 + 12_000;

type ChannelRailExtrasProps = {
  tags: Tag[];
  activeTag: string | null;
  eventCount: number;
  activeEventCount: number;
};

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function formatElapsed(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function ChannelRailExtras({
  tags,
  activeTag,
  eventCount,
  activeEventCount,
}: ChannelRailExtrasProps) {
  const [elapsedMs, setElapsedMs] = useState(INITIAL_SESSION_ELAPSED_MS);

  useEffect(() => {
    const id = window.setInterval(() => setElapsedMs((current) => current + 1000), 1000);
    return () => window.clearInterval(id);
  }, []);

  const activeLabel = activeTag ? (tags.find((t) => t.id === activeTag)?.label ?? null) : null;

  return (
    <div className="rail-blocks">
      <section className="rail-card rail-card-channel">
        <p className="rail-eyebrow">Active channel</p>
        {activeLabel ? (
          <>
            <p className="rail-channel-name">{activeLabel}</p>
            <p className="rail-channel-meta">
              {activeEventCount} staged beat{activeEventCount !== 1 ? 's' : ''}
            </p>
            <p className="rail-channel-hint">Play and Quests are scoped to this thread.</p>
          </>
        ) : (
          <>
            <p className="rail-channel-name">All channels</p>
            <p className="rail-channel-meta">
              {eventCount} beat{eventCount !== 1 ? 's' : ''} across {tags.length} channels
            </p>
            <p className="rail-channel-hint">Choose a channel to narrow the board and timeline.</p>
          </>
        )}
      </section>

      <section className="rail-card rail-card-clock">
        <p className="rail-eyebrow">Session clock</p>
        <p className="rail-clock-value">{formatElapsed(elapsedMs)}</p>
        <p className="rail-channel-meta">since first beat</p>
      </section>
    </div>
  );
}
