import { useOutletContext } from 'react-router';
import type { WarRoomContext } from '@/lib/war-room-data';

const timeline = [
  {
    id: 'log-stealth-pressure',
    time: '22:14',
    sceneId: 'basement',
    scene: 'House Basement',
    actor: 'Aleksei Volkov',
    kind: 'test',
    title: 'Stealth pressure escalated',
    body: 'The approach beat landed; table attention shifted toward the service corridor.',
  },
  {
    id: 'log-elysium-opened',
    time: '22:12',
    sceneId: 'the-elysium',
    scene: 'The Elysium',
    actor: 'War room',
    kind: 'narration',
    title: 'Elysium opened',
    body: 'Narration pulse established the room and seeded the social stakes.',
  },
  {
    id: 'log-prince-warning',
    time: '22:10',
    sceneId: 'harpy-court',
    scene: "Harpy's Court",
    actor: 'Prince Adrian Voss',
    kind: 'dm',
    title: "Prince's warning delivered",
    body: 'Aleksei received a private pressure beat before the room turned against him.',
  },
  {
    id: 'log-occult-sigils',
    time: '22:09',
    sceneId: 'harpy-court',
    scene: "Harpy's Court",
    actor: 'Vivienne Lacroix',
    kind: 'insight',
    title: 'Occult marks identified',
    body: 'The coterie caught the Tremere signature early, shifting suspicion toward the chantry.',
  },
  {
    id: 'log-aleksei-roll',
    time: '22:08',
    sceneId: 'harpy-court',
    scene: "Harpy's Court",
    actor: 'Aleksei Volkov',
    kind: 'test',
    title: 'Aleksei rolled well',
    body: 'The coterie gained leverage, so the next opposition beat should feel personal.',
  },
];

export default function LogRoute() {
  const warRoom = useOutletContext<WarRoomContext>();
  const filteredEntries = warRoom.activeTag
    ? timeline.filter((entry) => entry.sceneId === warRoom.activeTag)
    : timeline;

  return (
    <div className="mode-route">
      <section className="hero-strip hero-strip-compact">
        <div>
          <p className="eyebrow">Log</p>
          <h1>Session memory</h1>
          <p className="hero-copy">
            A terse operational timeline for what fired, what changed, and what the table now knows.
          </p>
        </div>
        <div className="log-hero-meta">
          <p className="detail-label">Timeline scope</p>
          <strong>{warRoom.activeTag ? 'Scene-filtered' : 'All scenes'}</strong>
          <span>
            {filteredEntries.length} recorded beat{filteredEntries.length === 1 ? '' : 's'}
          </span>
        </div>
      </section>

      {filteredEntries.length > 0 ? (
        <section className="detail-stack">
          {filteredEntries.map((entry) => (
            <article key={entry.id} className="timeline-card">
              <span>{entry.time}</span>
              <div className="timeline-card-copy">
                <div className="timeline-meta-row">
                  <span className="timeline-chip">{entry.scene}</span>
                  <span className="timeline-chip is-muted">{entry.actor}</span>
                  <span className="timeline-chip is-kind">{entry.kind}</span>
                </div>
                <div>
                  <h2>{entry.title}</h2>
                  <p>{entry.body}</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="detail-card board-empty-state">
          <p className="eyebrow">No entries</p>
          <h2>This scene has not generated a log trail yet.</h2>
          <p>Clear the scene filter to review the full session memory.</p>
        </section>
      )}
    </div>
  );
}
