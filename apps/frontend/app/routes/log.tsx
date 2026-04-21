const timeline = [
  {
    time: '22:14',
    title: 'Stealth pressure escalated',
    body: 'The approach beat landed; table attention shifted toward the service corridor.',
  },
  {
    time: '22:12',
    title: 'Elysium opened',
    body: 'Narration pulse established the room and seeded the social stakes.',
  },
  {
    time: '22:08',
    title: 'Aleksei rolled well',
    body: 'The coterie gained leverage, so the next opposition beat should feel personal.',
  },
];

export default function LogRoute() {
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
      </section>

      <section className="detail-stack">
        {timeline.map((entry) => (
          <article key={entry.time} className="timeline-card">
            <span>{entry.time}</span>
            <div>
              <h2>{entry.title}</h2>
              <p>{entry.body}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
