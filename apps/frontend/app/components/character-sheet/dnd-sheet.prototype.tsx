// PROTOTYPE, throwaway (branch prototype/dnd-sheet-shape, ticket #24 "D&D character sheet shape").
// Three variants of a 5e sheet on /demo/player/sheet?variant=A|B|C. State is in memory only.
// The question: how 5e fits StatSchema (number|string|boolean only), whether expertise is a
// 0/1/2 number or two booleans, and where derived values (mods, PB, skill totals, passives) live.
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import type { StatGroup, StatSchema } from '@constancia/contracts';
import './dnd-sheet.prototype.css';

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
const TIER_NAME = ['Untrained', 'Proficient', 'Expertise'];

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
type SetStat = (k: string, v: number | boolean) => void;

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

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
const labelOf = (key: string) => SKILLS.find((s) => s.key === key)?.label ?? key;

function NumberIn({
  value,
  onChange,
  min,
  max,
  label,
  className = '',
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  label: string;
  className?: string;
}) {
  return (
    <input
      aria-label={label}
      className={`dnd-num ${className}`}
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
    />
  );
}

/** Three-state proficiency pip: cycles untrained > proficient > expertise. */
function TierPip({
  tier,
  label,
  onCycle,
}: {
  tier: 0 | 1 | 2;
  label: string;
  onCycle?: () => void;
}) {
  return (
    <button
      type="button"
      className="dnd-pip"
      data-tier={tier}
      aria-label={`${label}: ${TIER_NAME[tier]}. Change`}
      title={TIER_NAME[tier]}
      onClick={onCycle}
    />
  );
}

function StatePanel({ stats, derived }: { stats: Stats; derived: ReturnType<typeof derive> }) {
  return (
    <details className="dnd-state">
      <summary>Inspect state: stored systemData vs derived values</summary>
      <div className="dnd-state-grid">
        <div>
          <p className="dnd-label">Stored ({Object.keys(stats).length} keys)</p>
          <pre>{JSON.stringify(stats, null, 1)}</pre>
        </div>
        <div>
          <p className="dnd-label">Derived, never stored</p>
          <pre>{JSON.stringify(derived, null, 1)}</pre>
        </div>
      </div>
    </details>
  );
}

// A: today's generic per-field grid unchanged, plus a derived strip computed by the shared function.
function VariantA({ stats, set }: { stats: Stats; set: SetStat }) {
  const d = derive(stats, 'tier');
  return (
    <div className="dnd-variant">
      <p className="dnd-thesis">
        Today’s per-row renderer, unchanged. A row sees only its own field, so totals can’t sit
        beside their inputs; they live in a derived ledger above the form.
      </p>
      <dl className="dnd-ledger">
        <div>
          <dt>Prof</dt>
          <dd>{signed(d.pb)}</dd>
        </div>
        {ABILITIES.map((a) => (
          <div key={a.key}>
            <dt>{a.key}</dt>
            <dd>{signed(d.mod[a.key])}</dd>
          </div>
        ))}
        {PASSIVES.map((p) => (
          <div key={p} className="is-passive">
            <dt>Passive {labelOf(p)}</dt>
            <dd>{d.passives[p]}</dd>
          </div>
        ))}
      </dl>
      {SCHEMA_TIER.groups.map((g) => (
        <details key={g.key} open className="sheet-stat-group">
          <summary className="sheet-stat-group-header">
            <span className="detail-label">{g.label}</span>
            <span className="sheet-stat-group-count">{g.fields.length} fields</span>
          </summary>
          <div className="dnd-a-grid">
            {g.fields.map((f) => (
              <label key={f.key} className="dnd-a-cell">
                <span className="dnd-label">{f.label}</span>
                {f.type === 'boolean' ? (
                  <input
                    className="dnd-check"
                    type="checkbox"
                    checked={stats[f.key] === true}
                    onChange={(e) => set(f.key, e.target.checked)}
                  />
                ) : (
                  <NumberIn
                    label={f.label}
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
function VariantB({ stats, set }: { stats: Stats; set: SetStat }) {
  const d = derive(stats, 'bools');
  return (
    <div className="dnd-variant">
      <p className="dnd-thesis">
        Two booleans per skill: {SCHEMA_BOOLS.groups.at(-1)?.fields.length} fields where tiers need
        18. Tick Expertise without Proficient to see the state this encoding lets through.
      </p>
      <div className="dnd-b">
        <aside className="dnd-b-rail">
          <label className="dnd-b-level">
            <span className="dnd-label">Level</span>
            <NumberIn
              label="Level"
              value={Number(stats.level)}
              min={1}
              max={20}
              onChange={(n) => set('level', n)}
            />
            <strong title="Proficiency bonus">{signed(d.pb)}</strong>
          </label>
          {ABILITIES.map((a) => (
            <div key={a.key} className="dnd-b-ability">
              <span className="dnd-label">{a.label}</span>
              <NumberIn
                label={a.label}
                value={Number(stats[a.key])}
                min={1}
                max={30}
                onChange={(n) => set(a.key, n)}
              />
              <strong>{signed(d.mod[a.key])}</strong>
            </div>
          ))}
        </aside>
        <table className="dnd-b-table">
          <thead>
            <tr>
              <th scope="col">Skill</th>
              <th scope="col">Prof</th>
              <th scope="col">Exp</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {SKILLS.map((s) => {
              const bad = stats[`${s.key}Exp`] === true && stats[`${s.key}Prof`] !== true;
              return (
                <tr key={s.key} className={bad ? 'is-invalid' : undefined}>
                  <th scope="row">
                    {s.label} <span className="dnd-abbr">{s.ability}</span>
                    {bad ? <span className="dnd-flag">Exp without prof</span> : null}
                  </th>
                  <td>
                    <input
                      className="dnd-check"
                      aria-label={`${s.label} proficient`}
                      type="checkbox"
                      checked={stats[`${s.key}Prof`] === true}
                      onChange={(e) => set(`${s.key}Prof`, e.target.checked)}
                    />
                  </td>
                  <td>
                    <input
                      className="dnd-check"
                      aria-label={`${s.label} expertise`}
                      type="checkbox"
                      checked={stats[`${s.key}Exp`] === true}
                      onChange={(e) => set(`${s.key}Exp`, e.target.checked)}
                    />
                  </td>
                  <td className="dnd-total">{signed(d.skills[s.key])}</td>
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

// C: a whole-sheet renderer (not per-row): ability blocks own their saves and skills.
function VariantC({ stats, set }: { stats: Stats; set: SetStat }) {
  const d = derive(stats, 'tier');
  const hpMax = Math.max(1, Number(stats.hpMax));
  const hp = Math.min(hpMax, Number(stats.hpCurrent));
  return (
    <div className="dnd-variant">
      <p className="dnd-thesis">
        A sheet-level renderer: each ability owns its save and skills, and every total sits beside
        the pip that changes it. Needs the renderer to receive the whole stats record.
      </p>

      <header className="dnd-c-head">
        <div className="dnd-c-vital">
          <span className="dnd-label">Level</span>
          <NumberIn
            className="dnd-num-display"
            label="Level"
            value={Number(stats.level)}
            min={1}
            max={20}
            onChange={(n) => set('level', n)}
          />
        </div>
        <div className="dnd-c-vital">
          <span className="dnd-label">Proficiency</span>
          <strong className="dnd-display">{signed(d.pb)}</strong>
        </div>
        <div className="dnd-c-vital">
          <span className="dnd-label">Armor class</span>
          <strong className="dnd-display">{String(stats.ac)}</strong>
        </div>
        <div className="dnd-c-vital dnd-c-hp">
          <span className="dnd-label">
            Hit points <span className="dnd-quiet">display only</span>
          </span>
          <strong className="dnd-display">
            {hp}
            <span className="dnd-quiet"> / {hpMax}</span>
          </strong>
          <div
            className="dnd-hp-track"
            role="meter"
            aria-label="Hit points"
            aria-valuemin={0}
            aria-valuemax={hpMax}
            aria-valuenow={hp}
          >
            <span style={{ inlineSize: `${(hp / hpMax) * 100}%` }} />
          </div>
        </div>
        <dl className="dnd-c-passives">
          {PASSIVES.map((p) => (
            <div key={p}>
              <dt>Passive {labelOf(p)}</dt>
              <dd>{d.passives[p]}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="dnd-c-grid">
        {ABILITIES.map((a) => {
          const saveProf = stats[`${a.key}Save`] === true;
          return (
            <section key={a.key} className="dnd-c-ability" aria-label={a.label}>
              <div className="dnd-c-ability-head">
                <h3>{a.label}</h3>
                <strong className="dnd-c-mod">{signed(d.mod[a.key])}</strong>
                <label className="dnd-c-score">
                  <span className="dnd-label">Score</span>
                  <NumberIn
                    label={`${a.label} score`}
                    value={Number(stats[a.key])}
                    min={1}
                    max={30}
                    onChange={(n) => set(a.key, n)}
                  />
                </label>
              </div>
              <ul className="dnd-c-rows">
                <li className="dnd-c-row is-save">
                  <TierPip
                    tier={saveProf ? 1 : 0}
                    label={`${a.label} saving throw`}
                    onCycle={() => set(`${a.key}Save`, !saveProf)}
                  />
                  <span>Saving throw</span>
                  <span className="dnd-total">{signed(d.saves[a.key])}</span>
                </li>
                {SKILLS.some((s) => s.ability === a.key) ? null : (
                  <li className="dnd-c-row is-empty">No skills use {a.label}</li>
                )}
                {SKILLS.filter((s) => s.ability === a.key).map((s) => {
                  const t = tierOf(stats, s.key, 'tier');
                  return (
                    <li key={s.key} className="dnd-c-row" data-tier={t}>
                      <TierPip tier={t} label={s.label} onCycle={() => set(s.key, (t + 1) % 3)} />
                      <span>{s.label}</span>
                      <span className="dnd-total">{signed(d.skills[s.key])}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="dnd-legend">
        {TIER_NAME.map((name, t) => (
          <span key={name}>
            <span className="dnd-pip" data-tier={t} aria-hidden="true" />
            {t === 2 ? `${name} (double proficiency)` : name}
          </span>
        ))}
      </p>
      <StatePanel stats={stats} derived={d} />
    </div>
  );
}

const VARIANTS = [
  { key: 'A', name: 'Generic grid + derived ledger', C: VariantA },
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
    <div className="dnd-switcher">
      <button type="button" aria-label="Previous variant" onClick={() => go(-1)}>
        <ChevronLeft size={16} />
      </button>
      <span>
        <b>{VARIANTS[index].key}</b> <i>{VARIANTS[index].name}</i>
      </span>
      <button type="button" aria-label="Next variant" onClick={() => go(1)}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

export function DndSheetPrototype() {
  const [params] = useSearchParams();
  const current = params.get('variant') ?? 'A';
  const [stats, setStats] = useState<Stats>(seed);
  const set: SetStat = (k, v) => setStats((s) => ({ ...s, [k]: v }));
  const Variant = (VARIANTS.find((v) => v.key === current) ?? VARIANTS[0]).C;
  return (
    <section className="dnd-proto">
      <div className="dnd-proto-head">
        <h2>Mira Thistledown</h2>
        <p>Rogue 5 · Halfling · 5E (SRD 5.2.1)</p>
        <span className="dnd-proto-tag">Prototype · variant {current}</span>
      </div>
      <Variant stats={stats} set={set} />
      <PrototypeSwitcher current={current} />
    </section>
  );
}
