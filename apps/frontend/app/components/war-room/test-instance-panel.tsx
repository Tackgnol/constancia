import { useEffect, useEffectEvent, useState } from 'react';
import { postRouteAction } from '@/lib/route-action-client';
import { summarizeSubmissions, type TestInstanceView } from '@/lib/test-instance-summary';

const LOAD_ERROR = "We couldn't reach this Test. Refresh it before changing anything.";

/** GM-only breakdown of who has submitted a result for the selected Test Event. */
export function TestInstancePanel({
  actionPath,
  campaignId,
  eventId,
  eventName,
}: {
  actionPath: string;
  campaignId: string;
  eventId: string;
  eventName: string;
}) {
  // undefined = still loading, null = the Event has not been fired yet.
  const [instance, setInstance] = useState<TestInstanceView | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (values: Record<string, string>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await postRouteAction<TestInstanceView | null>(actionPath, {
        campaignId,
        eventId,
        ...values,
      });
      if (result.status === 'success') {
        setInstance(result.data ?? null);
      } else {
        setError(result.message);
      }
    } catch {
      setError(LOAD_ERROR);
    } finally {
      setBusy(false);
    }
  };

  const refresh = useEffectEvent(() => {
    void run({ intent: 'list-test-instances' });
  });

  useEffect(() => {
    refresh();
  }, [campaignId, eventId]);

  const isClosed = instance?.status === 'closed';

  return (
    <section className="detail-card test-instance-panel" aria-label={`Test results: ${eventName}`}>
      <header className="test-instance-header">
        <p className="detail-label">Test results · {eventName}</p>
        <div className="test-instance-controls">
          <button
            className="ghost-action ghost-action-inline"
            disabled={busy}
            onClick={() => refresh()}
            type="button"
          >
            Refresh
          </button>
          {instance ? (
            <button
              className="ghost-action ghost-action-inline"
              disabled={busy}
              onClick={() =>
                void run({
                  intent: isClosed ? 'reopen-test-instance' : 'close-test-instance',
                  instanceId: instance.id,
                })
              }
              type="button"
            >
              {isClosed ? 'Reopen Test' : 'Close Test'}
            </button>
          ) : null}
        </div>
      </header>

      {error ? <p role="alert">{error}</p> : null}

      {instance === undefined ? <p>Loading results…</p> : null}
      {instance === null ? <p>Not fired yet. Fire this Test to open it to players.</p> : null}

      {instance ? (
        <>
          <p>
            {isClosed ? 'Closed' : 'Open'} · {summarizeSubmissions(instance.participants)}
          </p>
          <ul className="test-instance-rows">
            {instance.participants.map((participant) => (
              <li key={participant.discordUserId} className="test-instance-row">
                <span>{participant.label}</span>
                <span>
                  {participant.submitted ? `Score ${participant.playerScore}` : 'Missing'}
                </span>
                {participant.submitted ? (
                  <button
                    className="ghost-action ghost-action-inline"
                    disabled={busy}
                    onClick={() =>
                      void run({
                        intent: 'reopen-test-submission',
                        instanceId: instance.id,
                        discordUserId: participant.discordUserId,
                      })
                    }
                    title="Lets this player resubmit. Effects already applied are not undone."
                    type="button"
                  >
                    Reopen
                  </button>
                ) : (
                  <span aria-hidden="true" />
                )}
              </li>
            ))}
          </ul>
          <p className="detail-label">
            Reopening a player frees their slot to resubmit; it does not undo earlier effects.
          </p>
        </>
      ) : null}
    </section>
  );
}
