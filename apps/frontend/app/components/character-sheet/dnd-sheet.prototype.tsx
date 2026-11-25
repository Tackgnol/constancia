// PROTOTYPE, throwaway (branch prototype/dnd-sheet-shape, ticket #24 "D&D character sheet shape").
// Three variants of a 5e sheet on /demo/player/sheet?variant=A|B|C. State is in memory only.
// The question: how 5e fits StatSchema (number|string|boolean only), whether expertise is a
// 0/1/2 number or two booleans, and where derived values (mods, PB, skill totals, passives) live.
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { StatGroup, StatSchema } from '@constancia/contracts';

type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
const ABILITIES: { key: Ability; label: string }[] = [
  { key: 'str', label: 'Strength' },
  { key: 'dex', label: 'Dexterity' },
  { key: 'con', label: 'Constitution' },
  { key: 'int', label: 'Intelligence' },
  { key: 'wis', label: 'Wisdom' },
  { key: 'cha', label: 'Charisma' },
];
const SKILLS: { key: string; label: string; ability: Ability }[] = [
  { key: 'athletics', label: 'Athletics', ability: 'str' },
  { key: 'acrobatics', label: 'Acrobatics', ability: 'dex' },
  { key: 'sleightOfHand', label: 'Sleight of Hand', ability: 'dex' },
  { key: 'stealth', label: 'Stealth', ability: 'dex' },
  { key: 'arcana', label: 'Arcana', ability: 'int' },
  { key: 'history', label: 'History', ability: 'int' },
  { key: 'investigation', label: 'Investigation', ability: 'int' },
  { key: 'nature', label: 'Nature', ability: 'int' },
  { key: 'religion', label: 'Religion', ability: 'int' },
  { key: 'animalHandling', label: 'Animal Handling', ability: 'wis' },
  { key: 'insight', label: 'Insight', ability: 'wis' },
  { key: 'medicine', label: 'Medicine', ability: 'wis' },
  { key: 'perception', label: 'Perception', ability: 'wis' },
  { key: 'survival', label: 'Survival', ability: 'wis' },
  { key: 'deception', label: 'Deception', ability: 'cha' },
  { key: 'intimidation', label: 'Intimidation', ability: 'cha' },
  { key: 'performance', label: 'Performance', ability: 'cha' },
  { key: 'persuasion', label: 'Persuasion', ability: 'cha' },
];
const PASSIVES = ['perception', 'insight', 'investigation'];

// Encoding A/C: one number per skill, 0 none, 1 proficient, 2 expertise.
// Save keys get a `Save` suffix because extractSystemStats flattens every group into one key space.
const sharedGroups: StatGroup[] = [
  {
    key: 'core',
    label: 'Core',
    fields: [{ key: 'level', label: 'Level', type: 'number', min: 1, max: 20, defaultValue: 1 }],
  },
  {
    key: 'abilities',
    label: 'Abilities',
    fields: ABILITIES.map((a) => ({
      key: a.key,
      label: a.label,
      type: 'number',
      min: 1,
      max: 30,
      defaultValue: 10,
    })),
  },
  {
    key: 'saves',
    label: 'Saving throw proficiency',
    fields: ABILITIES.map((a) => ({
      key: `${a.key}Save`,
      label: a.label,
      type: 'boolean',
      defaultValue: false,
    })),
  },
  {
    key: 'vitals',
    label: 'Vitals (display only)',
    fields: [
      { key: 'hpMax', label: 'HP max', type: 'number', min: 1, max: 999, defaultValue: 8 },
      { key: 'hpCurrent', label: 'HP current', type: 'number', min: 0, max: 999, defaultValue: 8 },
      { key: 'ac', label: 'AC', type: 'number', min: 0, max: 40, defaultValue: 10 },
    ],
  },
];
const SCHEMA_TIER: StatSchema = {
  groups: [
    ...sharedGroups,
    {
      key: 'skills',
      label: 'Skills (0 none / 1 proficient / 2 expertise)',
      fields: SKILLS.map((s) => ({
        key: s.key,
        label: s.label,
        type: 'number',
        min: 0,
        max: 2,
        defaultValue: 0,
      })),
    },
  ],
};
// Encoding B: two booleans per skill. Allows the invalid state "expertise without proficiency".
const SCHEMA_BOOLS: StatSchema = {
  groups: [
    ...sharedGroups,
    {
      key: 'skills',
      label: 'Skills',
      fields: SKILLS.flatMap((s) => [
        {
          key: `${s.key}Prof`,
          label: `${s.label} proficient`,
          type: 'boolean' as const,
          defaultValue: false,
        },
        {
          key: `${s.key}Exp`,
          label: `${s.label} expertise`,
          type: 'boolean' as const,
          defaultValue: false,
        },
      ]),
    },
  ],
};

type Stats = Record<string, number | boolean>;

const seed: Stats = {
  level: 5,
  str: 8,
  dex: 16,
  con: 14,
  int: 12,
  wis: 13,
  cha: 10,
  dexSave: true,
  intSave: true,
  hpMax: 33,
  hpCurrent: 27,
  ac: 15,
  stealth: 2,
  acrobatics: 1,
  perception: 1,
  investigation: 1,
  insight: 0,
  sleightOfHand: 2,
  deception: 1,
  // same character in encoding B
  stealthProf: true,
  stealthExp: true,
  acrobaticsProf: true,
  perceptionProf: true,
  investigationProf: true,
  sleightOfHandProf: true,
  sleightOfHandExp: true,
  deceptionProf: true,
};

function tierOf(stats: Stats, skill: string, encoding: 'tier' | 'bools'): 0 | 1 | 2 {
  if (encoding === 'tier') return Math.max(0, Math.min(2, Number(stats[skill] ?? 0))) as 0 | 1 | 2;
  if (stats[`${skill}Exp`] === true) return 2; // exp without prof is read as expertise: a policy we'd have to pick
  return stats[`${skill}Prof`] === true ? 1 : 0;
}

/** Derives every computed 5e number from stored stats; would live in packages/systems if kept. */
function derive(stats: Stats, encoding: 'tier' | 'bools') {
  const level = Number(stats.level ?? 1);
  const pb = 2 + Math.floor((level - 1) / 4);
  const mod = Object.fromEntries(
    ABILITIES.map((a) => [a.key, Math.floor((Number(stats[a.key] ?? 10) - 10) / 2)]),
  ) as Record<Ability, number>;
  const saves = Object.fromEntries(
    ABILITIES.map((a) => [a.key, mod[a.key] + (stats[`${a.key}Save`] === true ? pb : 0)]),
  ) as Record<Ability, number>;
  const skills = Object.fromEntries(
    SKILLS.map((s) => [s.key, mod[s.ability] + pb * tierOf(stats, s.key, encoding)]),
  );
  const passives = Object.fromEntries(PASSIVES.map((p) => [p, 10 + skills[p]]));
  return { pb, mod, saves, skills, passives };
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const box: React.CSSProperties = {
  border: '1px solid #1b2028',
  background: '#161b22',
  padding: 8,
  borderRadius: 4,
};
const mono: React.CSSProperties = { fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 };

function NumberIn({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <input
      className="form-input"
      style={{ width: 64 }}
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
    />
  );
}

function StatePanel({ stats, derived }: { stats: Stats; derived: ReturnType<typeof derive> }) {
  return (
    <details open style={{ ...box, marginTop: 16 }}>
      <summary className="detail-label">State: stored systemData vs derived (never stored)</summary>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, ...mono }}>
        <pre>{JSON.stringify(stats, null, 1)}</pre>
        <pre>{JSON.stringify(derived, null, 1)}</pre>
      </div>
    </details>
  );
}

// A: today's generic per-field grid unchanged, plus a derived strip computed by the shared function.
function VariantA({ stats, set }: { stats: Stats; set: (k: string, v: number | boolean) => void }) {
  const d = derive(stats, 'tier');
  return (
    <div>
      <p className="form-hint">
        A: existing per-row renderer, tier encoding (0/1/2 number). Derived values can't sit in the
        rows (a row only sees its own field), so they live in a separate summary strip.
      </p>
      <div style={{ ...box, display: 'flex', flexWrap: 'wrap', gap: 16, ...mono }}>
        <span>PB {signed(d.pb)}</span>
        {ABILITIES.map((a) => (
          <span key={a.key}>
            {a.key.toUpperCase()} {signed(d.mod[a.key])}
          </span>
        ))}
        {PASSIVES.map((p) => (
          <span key={p}>
            Passive {p} {d.passives[p]}
          </span>
        ))}
      </div>
      {SCHEMA_TIER.groups.map((g) => (
        <details key={g.key} open className="sheet-stat-group" style={{ marginTop: 8 }}>
          <summary className="sheet-stat-group-header">
            <span className="detail-label">{g.label}</span>
          </summary>
          <div className="sheet-stat-grid">
            {g.fields.map((f) => (
              <label key={f.key} className="sheet-stat-cell">
                <span className="form-label">{f.label}</span>
                {f.type === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={stats[f.key] === true}
                    onChange={(e) => set(f.key, e.target.checked)}
                  />
                ) : (
                  <NumberIn
                    value={Number(stats[f.key] ?? f.defaultValue ?? 0)}
                    min={f.min ?? 0}
                    max={f.max ?? 99}
                    onChange={(n) => set(f.key, n)}
                  />
                )}
              </label>
            ))}
          </div>
        </details>
      ))}
      <StatePanel stats={stats} derived={d} />
    </div>
  );
}

// B: two booleans per skill, derived total inline in a table row.
function VariantB({ stats, set }: { stats: Stats; set: (k: string, v: number | boolean) => void }) {
  const d = derive(stats, 'bools');
  return (
    <div>
      <p className="form-hint">
        B: two-boolean encoding ({SCHEMA_BOOLS.groups.at(-1)?.fields.length} skill fields). Tick
        Expertise without Proficient to see the invalid state the schema allows.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
        <div style={box}>
          <div style={mono}>
            Level{' '}
            <NumberIn
              value={Number(stats.level)}
              min={1}
              max={20}
              onChange={(n) => set('level', n)}
            />{' '}
            PB {signed(d.pb)}
          </div>
          {ABILITIES.map((a) => (
            <div
              key={a.key}
              style={{ ...mono, display: 'flex', justifyContent: 'space-between', marginTop: 6 }}
            >
              <span>{a.label}</span>
              <NumberIn
                value={Number(stats[a.key])}
                min={1}
                max={30}
                onChange={(n) => set(a.key, n)}
              />
              <span>{signed(d.mod[a.key])}</span>
            </div>
          ))}
        </div>
        <table style={{ ...mono, width: '100%' }}>
          <thead>
            <tr>
              <th align="left">Skill</th>
              <th>Prof</th>
              <th>Exp</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {SKILLS.map((s) => {
              const bad = stats[`${s.key}Exp`] === true && stats[`${s.key}Prof`] !== true;
              return (
                <tr key={s.key} style={bad ? { color: '#f85149' } : undefined}>
                  <td>
                    {s.label} <span style={{ opacity: 0.5 }}>({s.ability})</span>
                  </td>
                  <td align="center">
                    <input
                      type="checkbox"
                      checked={stats[`${s.key}Prof`] === true}
                      onChange={(e) => set(`${s.key}Prof`, e.target.checked)}
                    />
                  </td>
                  <td align="center">
                    <input
                      type="checkbox"
                      checked={stats[`${s.key}Exp`] === true}
                      onChange={(e) => set(`${s.key}Exp`, e.target.checked)}
                    />
                  </td>
                  <td align="center">{signed(d.skills[s.key])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <StatePanel stats={stats} derived={d} />
    </div>
  );
}

const TIER_GLYPH = ['○', '◐', '●'];

// C: a whole-sheet renderer (not per-row): ability blocks own their saves and skills, tier pip cycles 0>1>2>0.
function VariantC({ stats, set }: { stats: Stats; set: (k: string, v: number | boolean) => void }) {
  const d = derive(stats, 'tier');
  return (
    <div>
      <p className="form-hint">
        C: sheet-level renderer, tier encoding. Click a pip to cycle none / proficient / expertise.
        Needs the renderer contract to receive the whole stats record, not one field.
      </p>
      <div style={{ ...box, display: 'flex', gap: 24, ...mono, marginBottom: 12 }}>
        <span>
          Level{' '}
          <NumberIn
            value={Number(stats.level)}
            min={1}
            max={20}
            onChange={(n) => set('level', n)}
          />
        </span>
        <span>PB {signed(d.pb)}</span>
        <span>AC {String(stats.ac)}</span>
        <span>
          HP {String(stats.hpCurrent)}/{String(stats.hpMax)}
        </span>
        {PASSIVES.map((p) => (
          <span key={p}>
            Passive {p.slice(0, 5)} {d.passives[p]}
          </span>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {ABILITIES.map((a) => (
          <section key={a.key} style={box}>
            <div
              style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}
            >
              <span className="detail-label">{a.label}</span>
              <span style={{ fontSize: 22 }}>{signed(d.mod[a.key])}</span>
            </div>
            <NumberIn
              value={Number(stats[a.key])}
              min={1}
              max={30}
              onChange={(n) => set(a.key, n)}
            />
            <div style={{ ...mono, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => set(`${a.key}Save`, stats[`${a.key}Save`] !== true)}
              >
                {stats[`${a.key}Save`] === true ? '●' : '○'}
              </button>{' '}
              Save {signed(d.saves[a.key])}
            </div>
            {SKILLS.filter((s) => s.ability === a.key).map((s) => {
              const t = tierOf(stats, s.key, 'tier');
              return (
                <div key={s.key} style={mono}>
                  <button
                    type="button"
                    aria-label={`${s.label} tier ${t}`}
                    onClick={() => set(s.key, (t + 1) % 3)}
                  >
                    {TIER_GLYPH[t]}
                  </button>{' '}
                  {s.label} {signed(d.skills[s.key])}
                </div>
              );
            })}
          </section>
        ))}
      </div>
      <StatePanel stats={stats} derived={d} />
    </div>
  );
}

const VARIANTS = [
  { key: 'A', name: 'Generic grid + derived strip', C: VariantA },
  { key: 'B', name: 'Two booleans, skill table', C: VariantB },
  { key: 'C', name: 'Sheet-level renderer, tier pips', C: VariantC },
];

function PrototypeSwitcher({ current }: { current: string }) {
  const navigate = useNavigate();
  const index = Math.max(
    0,
    VARIANTS.findIndex((v) => v.key === current),
  );
  const go = (step: number) =>
    navigate(`?variant=${VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length].key}`, {
      replace: true,
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (import.meta.env.PROD) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#fff',
        color: '#000',
        borderRadius: 999,
        padding: '6px 14px',
        boxShadow: '0 4px 16px rgba(0,0,0,.5)',
        display: 'flex',
        gap: 12,
        zIndex: 1000,
        ...mono,
      }}
    >
      <button type="button" onClick={() => go(-1)}>
        ←
      </button>
      <span>
        {VARIANTS[index].key} ({VARIANTS[index].name})
      </span>
      <button type="button" onClick={() => go(1)}>
        →
      </button>
    </div>
  );
}

export function DndSheetPrototype() {
  const [params] = useSearchParams();
  const current = params.get('variant') ?? 'A';
  const [stats, setStats] = useState<Stats>(seed);
  const set = (k: string, v: number | boolean) => setStats((s) => ({ ...s, [k]: v }));
  const Variant = (VARIANTS.find((v) => v.key === current) ?? VARIANTS[0]).C;
  return (
    <section className="form-section">
      <p className="eyebrow">PROTOTYPE: 5e (SRD 5.2.1) sheet, Mira (Rogue 5, Halfling)</p>
      <Variant stats={stats} set={set} />
      <PrototypeSwitcher current={current} />
    </section>
  );
}
