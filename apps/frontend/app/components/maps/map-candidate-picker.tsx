import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  MapCandidate,
  MapWorkspaceCandidates,
  ScenePegProjection,
} from '@/lib/map-workspace-projection';

const groupLabels: Array<{ key: keyof MapWorkspaceCandidates; label: string }> = [
  { key: 'events', label: 'Events' },
  { key: 'npcs', label: 'NPCs' },
  { key: 'lore', label: 'Lore' },
];

export function MapCandidatePicker({
  candidates,
  pegs,
  armedCandidate,
  disabled,
  onArm,
  onCancel,
}: {
  candidates: MapWorkspaceCandidates;
  pegs: readonly ScenePegProjection[];
  armedCandidate: MapCandidate | null;
  disabled: boolean;
  onArm: (candidate: MapCandidate) => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState('');
  const placedTargetIds = useMemo(() => new Set(pegs.map((peg) => peg.target.id)), [pegs]);
  const query = search.trim().toLowerCase();

  const groups = groupLabels.map(({ key, label }) => ({
    key,
    label,
    items: candidates[key].filter((candidate) => candidate.label.toLowerCase().includes(query)),
  }));
  const hasAnyCandidate = groups.some((group) => group.items.length > 0);

  return (
    <section className="map-picker" aria-label="Place a target">
      <p className="detail-label">Place on map</p>

      {armedCandidate ? (
        <div className="map-picker-armed" role="status">
          <span>
            Click the map to place <strong>{armedCandidate.label}</strong>. Press Escape to cancel.
          </span>
          <Button onClick={onCancel} type="button" variant="ghost">
            Cancel
          </Button>
        </div>
      ) : null}

      <Input
        aria-label="Search targets"
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search events, NPCs, lore…"
        value={search}
      />

      {!hasAnyCandidate ? (
        <p className="form-hint">
          {query.length > 0
            ? 'Nothing matches that search.'
            : 'This campaign has no events, NPCs, or lore to place yet. Create some in Setup.'}
        </p>
      ) : null}

      {groups.map((group) =>
        group.items.length > 0 ? (
          <div className="map-picker-group" key={group.key}>
            <p className="form-hint">{group.label}</p>
            <div className="map-picker-list">
              {group.items.map((candidate) => {
                const placed = placedTargetIds.has(candidate.id);
                return (
                  <Button
                    aria-pressed={armedCandidate?.id === candidate.id}
                    className={placed ? 'is-placed' : undefined}
                    disabled={disabled || placed}
                    key={candidate.id}
                    onClick={() => onArm(candidate)}
                    type="button"
                    variant="ghost"
                  >
                    {candidate.label}
                    {placed ? <span className="map-picker-placed"> · placed</span> : null}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : null,
      )}
    </section>
  );
}
