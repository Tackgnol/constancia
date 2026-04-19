const dossiers = [
  {
    name: 'Prince Adrian Voss',
    role: 'Court anchor',
    note: 'Use direct warnings to push the coterie into debt.',
  },
  {
    name: 'Mara the Veiled',
    role: 'Information broker',
    note: 'Pairs well with insight beats and occult reveals.',
  },
  {
    name: 'Sister Caligo',
    role: 'Religious threat',
    note: 'Escalates tension when players grow too comfortable.',
  },
];

export default function NpcsRoute() {
  return (
    <div className="mode-route">
      <section className="hero-strip hero-strip-compact">
        <div>
          <p className="eyebrow">NPCs</p>
          <h1>Pressure points</h1>
          <p className="hero-copy">
            Keep every important face legible: who they are, what they want, and which lever to pull
            next.
          </p>
        </div>
      </section>

      <section className="detail-stack">
        {dossiers.map((dossier) => (
          <article key={dossier.name} className="detail-card">
            <p className="detail-label">{dossier.role}</p>
            <h2>{dossier.name}</h2>
            <p>{dossier.note}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
