import { startTransition, useRef, useState } from 'react';
import { useOutletContext } from 'react-router';

import { fireEvent } from '@/api/generated/endpoints/events/events';
import type { TriggerCard, TriggerKind, WarRoomContext } from '@/lib/war-room-data';

const HOLD_DURATION_MS = 1800;

export default function PlayRoute() {
  const warRoom = useOutletContext<WarRoomContext>();
  const liveEvents = warRoom.events;

  const [firedItems, setFiredItems] = useState(new Set<string>());
  const [lastAction, setLastAction] = useState(
    'Elysium narration is queued and ready for the next beat.',
  );
  const [armedItemId, setArmedItemId] = useState<string | null>(null);
  const [errorItemId, setErrorItemId] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const armedItemRef = useRef<string | null>(null);

  const sections: { id: TriggerKind; title: string; items: TriggerCard[] }[] = [
    { id: 'test', title: 'Tests', items: [] },
    { id: 'narration', title: 'Narrations', items: [] },
    { id: 'insight', title: 'Stat Insights', items: [] },
    { id: 'message', title: 'Direct Messages', items: [] },
  ];

  for (const event of liveEvents) {
    const section = sections.find((s) => s.id === event.type) || sections[3];
    if (warRoom.activeTag && event.channelId !== warRoom.activeTag) continue;

    section.items.push({
      id: event.id,
      kind: (event.type as TriggerKind) ?? 'message',
      name: event.name,
      meta: event.status,
      tags: [event.channelId],
    });
  }

  const clearHoldRefs = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    holdTimerRef.current = null;
    holdIntervalRef.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, itemId: string) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    armedItemRef.current = itemId;
    setArmedItemId(itemId);
    setErrorItemId(null);

    const startTime = Date.now();
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setHoldProgress(Math.min(elapsed / HOLD_DURATION_MS, 1));
    }, 16);

    holdTimerRef.current = setTimeout(async () => {
      clearHoldRefs();
      const currentItemId = armedItemRef.current;
      armedItemRef.current = null;
      if (!currentItemId) return;

      try {
        await fireEvent(
          { id: warRoom.campaign.id, eventId: currentItemId },
          { credentials: 'include' },
        );

        startTransition(() => {
          setFiredItems((current) => {
            const next = new Set(current);
            next.add(currentItemId);
            return next;
          });
          const item = liveEvents.find((i) => i.id === currentItemId);
          setLastAction(`${item?.name ?? 'Event'} fired.`);
        });
      } catch (err) {
        console.error('Fire event error:', err);
        setLastAction('Failed to fire event.');
      }

      setArmedItemId(null);
      setHoldProgress(0);
    }, HOLD_DURATION_MS);
  };

  const handlePointerUp = (itemId: string) => {
    if (armedItemRef.current !== itemId) return;
    clearHoldRefs();
    armedItemRef.current = null;
    setErrorItemId(itemId);
    setLastAction('Hold cancelled — hold longer to fire.');
    setArmedItemId(null);
    setHoldProgress(0);
  };

  return (
    <div className="play-route">
      <section className="last-action-banner">
        <span className="eyebrow">Command Echo</span>
        <p key={lastAction} className="command-echo-text">
          {lastAction}
        </p>
      </section>

      {sections.map((section) => {
        if (section.items.length === 0) return null;

        return (
          <section key={section.id} className="board-section">
            <header className="board-section-header">{section.title}</header>

            <div className="board-grid">
              {section.items.map((item) => {
                const isFired = firedItems.has(item.id);
                const isArmed = armedItemId === item.id && !isFired;
                const hasError = errorItemId === item.id && !isFired;

                return (
                  <button
                    key={item.id}
                    className={`trigger-card is-${item.kind}${isFired ? ' is-fired' : ''}${isArmed ? ' is-armed' : ''}${hasError ? ' is-error' : ''}`}
                    onPointerDown={(e) => {
                      if (!isFired) handlePointerDown(e, item.id);
                    }}
                    onPointerUp={() => handlePointerUp(item.id)}
                    type="button"
                  >
                    <span className="trigger-type">
                      {item.kind === 'message' ? 'DM' : item.kind}
                    </span>
                    <strong className="trigger-name">{item.name}</strong>
                    <span className="trigger-meta">{item.meta}</span>
                    {isFired ? (
                      <span className="trigger-flag">Fired</span>
                    ) : isArmed ? (
                      <span className="trigger-flag">Hold to fire</span>
                    ) : hasError ? (
                      <span className="trigger-flag is-error-flag">Cancelled</span>
                    ) : null}
                    {isArmed ? (
                      <span
                        className="trigger-progress"
                        style={
                          {
                            '--progress': holdProgress,
                          } as React.CSSProperties
                        }
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
