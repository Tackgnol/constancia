import { useEffect, useState } from 'react';
import type { Tag } from '@/lib/war-room-data';

const INITIAL_SESSION_ELAPSED_MS = 47 * 60_000 + 12_000;

type SceneRailExtrasProps = {
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

export function SceneRailExtras({
  tags,
  activeTag,
  eventCount,
  activeEventCount,
}: SceneRailExtrasProps) {
  const [elapsedMs, setElapsedMs] = useState(INITIAL_SESSION_ELAPSED_MS);

  useEffect(() => {
    const id = window.setInterval(() => setElapsedMs((current) => current + 1000), 1000);
    return () => window.clearInterval(id);
  }, []);

  const activeLabel = activeTag ? (tags.find((t) => t.id === activeTag)?.label ?? null) : null;

  return (
    <div className="rail-blocks">
      <section className="rail-card rail-card-scene">
        <p className="rail-eyebrow">Active scene</p>
        {activeLabel ? (
          <>
            <p className="rail-scene-name">{activeLabel}</p>
            <p className="rail-scene-meta">
              {activeEventCount} staged beat{activeEventCount !== 1 ? 's' : ''}
            </p>
            <p className="rail-scene-hint">Play and Log are scoped to this thread.</p>
          </>
        ) : (
          <>
            <p className="rail-scene-name">All scenes</p>
            <p className="rail-scene-meta">
              {eventCount} beat{eventCount !== 1 ? 's' : ''} across {tags.length} scenes
            </p>
            <p className="rail-scene-hint">Choose a scene to narrow the board and timeline.</p>
          </>
        )}
      </section>

      <section className="rail-card rail-card-clock">
        <p className="rail-eyebrow">Session clock</p>
        <p className="rail-clock-value">{formatElapsed(elapsedMs)}</p>
        <p className="rail-scene-meta">since first beat</p>
      </section>
    </div>
  );
}
