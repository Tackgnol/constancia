import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router';
import { revealLoreEntry } from '@constancia/api-client/endpoints/lore/lore';
import type {
  ListLoreEntries200DataItem,
  RevealLoreEntry200Data,
} from '@constancia/api-client/model';
import { ManagementWorkspace } from '@/components/layout/management-workspace';
import { SetupNotice } from '@/components/setup/setup-notice';
import { assertApiOk, getApiErrorMessage } from '@/lib/api-errors';
import {
  buildRecipientOptions,
  players,
  type RecipientOption,
  type WarRoomContext,
} from '@/lib/war-room-data';

type LoreEntry = ListLoreEntries200DataItem;
type ApiLoreEntry = ListLoreEntries200DataItem | RevealLoreEntry200Data;
type KnownPlayer = ListLoreEntries200DataItem['knownTo'][number];

function getSetupBase(warRoom: WarRoomContext) {
  return warRoom.demoMode ? '/demo/setup' : '/setup';
}

function normalizeLoreEntry(input: ApiLoreEntry): LoreEntry {
  return {
    id: input.id,
    title: input.title,
    content: input.content,
    campaignId: input.campaignId,
    sortOrder: input.sortOrder,
    knownTo: input.knownTo ?? [],
  };
}

function sortLoreEntries(loreEntries: LoreEntry[]): LoreEntry[] {
  return [...loreEntries].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title),
  );
}

function isKnownToPlayer(loreEntry: LoreEntry, option: RecipientOption) {
  return loreEntry.knownTo.some((entry) => entry.discordUserId === option.discordUserId);
}

function knownPlayerFromOption(option: RecipientOption): KnownPlayer {
  return {
    characterId: option.characterId ?? option.id,
    discordUserId: option.discordUserId,
    displayName: option.displayName,
    secondaryLabel: option.secondaryLabel,
  };
}

export default function LoreRoute() {
  const warRoom = useOutletContext<WarRoomContext>();
  const setupBase = getSetupBase(warRoom);
  const isDemoMode = warRoom.demoMode === true;
  const [loreEntries, setLoreEntries] = useState<LoreEntry[]>(() =>
    sortLoreEntries(warRoom.lore.map(normalizeLoreEntry)),
  );
  const [pendingAssignments, setPendingAssignments] = useState<Record<string, string[]>>({});
  const [assigningLoreId, setAssigningLoreId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recipientOptions = useMemo(
    () => buildRecipientOptions(warRoom.rawCharacters, players),
    [warRoom.rawCharacters],
  );
  const revealedCount = loreEntries.filter((entry) => entry.knownTo.length > 0).length;

  const togglePendingAssignment = (loreId: string, recipientId: string) => {
    setPendingAssignments((current) => {
      const currentIds = current[loreId] ?? [];
      const nextIds = currentIds.includes(recipientId)
        ? currentIds.filter((entry) => entry !== recipientId)
        : [...currentIds, recipientId];

      return { ...current, [loreId]: nextIds };
    });
  };

  const applyLoreKnowledge = async (loreEntry: LoreEntry) => {
    const pending = pendingAssignments[loreEntry.id] ?? [];
    const selectedRecipients = recipientOptions.filter((option) => pending.includes(option.id));
    const discordUserIds = selectedRecipients.map((option) => option.discordUserId);

    if (discordUserIds.length === 0) {
      return;
    }

    try {
      setAssigningLoreId(loreEntry.id);
      setError(null);

      if (isDemoMode) {
        setLoreEntries((current) =>
          sortLoreEntries(
            current.map((entry) =>
              entry.id === loreEntry.id
                ? {
                    ...entry,
                    knownTo: [
                      ...entry.knownTo,
                      ...selectedRecipients
                        .filter((recipient) => !isKnownToPlayer(entry, recipient))
                        .map(knownPlayerFromOption),
                    ],
                  }
                : entry,
            ),
          ),
        );
      } else {
        const response = await revealLoreEntry(
          { id: warRoom.campaign.id, loreId: loreEntry.id },
          { discordUserIds },
          { credentials: 'include' },
        );
        assertApiOk(response, 'Lore reveal failed. Try the assignment again.');
        const refreshedLore = normalizeLoreEntry(response.data);
        setLoreEntries((current) =>
          sortLoreEntries(
            current.map((entry) => (entry.id === refreshedLore.id ? refreshedLore : entry)),
          ),
        );
      }

      setPendingAssignments((current) => ({ ...current, [loreEntry.id]: [] }));
      warRoom.recordActivity?.(`Lore revealed: ${loreEntry.title}`);
    } catch (caught) {
      console.error('Reveal lore error:', caught);
      setError(getApiErrorMessage(caught, 'Lore reveal failed. Try the assignment again.'));
    } finally {
      setAssigningLoreId(null);
    }
  };

  return (
    <ManagementWorkspace
      eyebrow="Lore"
      title="World knowledge"
      description="Read the canon at speed. Creation and edits live in Setup; reveals happen here."
      meta={
        <div className="log-hero-meta">
          <p className="detail-label">Lore scope</p>
          <strong>
            {loreEntries.length} entr{loreEntries.length === 1 ? 'y' : 'ies'}
          </strong>
          <span>
            {revealedCount} revealed · {recipientOptions.length} player
            {recipientOptions.length === 1 ? '' : 's'} available
          </span>
        </div>
      }
    >
      <div className="setup-back-row">
        <Link className="setup-inline-link" to={`${setupBase}/lore/new`}>
          Add lore
        </Link>
        <Link className="setup-inline-link" to={setupBase}>
          Open setup
        </Link>
      </div>

      {error ? (
        <SetupNotice label="Lore board warning" tone="error">
          <span>{error}</span>
        </SetupNotice>
      ) : null}

      {loreEntries.length > 0 ? (
        <section className="quest-board" aria-label="Lore board">
          {loreEntries.map((loreEntry) => (
            <LoreCard
              key={loreEntry.id}
              loreEntry={loreEntry}
              setupBase={setupBase}
              recipientOptions={recipientOptions}
              pending={pendingAssignments[loreEntry.id] ?? []}
              assigning={assigningLoreId === loreEntry.id}
              onToggle={(recipientId) => togglePendingAssignment(loreEntry.id, recipientId)}
              onApply={() => void applyLoreKnowledge(loreEntry)}
            />
          ))}
        </section>
      ) : (
        <section className="detail-card board-empty-state">
          <p className="eyebrow">No lore</p>
          <h2>No hidden world knowledge is on file yet.</h2>
          <p>Create lore in Setup, then reveal it to players when they earn it.</p>
          <Link className="ghost-action ghost-action-inline" to={`${setupBase}/lore/new`}>
            Add lore
          </Link>
        </section>
      )}
    </ManagementWorkspace>
  );
}

function LoreCard({
  loreEntry,
  setupBase,
  recipientOptions,
  pending,
  assigning,
  onToggle,
  onApply,
}: {
  loreEntry: LoreEntry;
  setupBase: string;
  recipientOptions: RecipientOption[];
  pending: string[];
  assigning: boolean;
  onToggle: (recipientId: string) => void;
  onApply: () => void;
}) {
  return (
    <article className="quest-card quest-card-active lore-card">
      <div className="quest-summary-header">
        <div className="quest-summary-copy">
          <p className="detail-label">
            lore · {loreEntry.knownTo.length} player
            {loreEntry.knownTo.length === 1 ? '' : 's'}
          </p>
          <h2>{loreEntry.title}</h2>
          <p>{loreEntry.content}</p>
        </div>

        <div className="quest-summary-actions">
          <span className="quest-count">#{String(loreEntry.sortOrder + 1).padStart(2, '0')}</span>
          <Link
            className="ghost-action ghost-action-inline"
            to={`${setupBase}/lore/${loreEntry.id}`}
          >
            Edit in setup
          </Link>
        </div>
      </div>

      <div className="quest-entry-section">
        <div className="setup-subsection-header">
          <div>
            <p className="detail-label">Known to</p>
            <p className="form-hint">
              Lore reveal is additive; this screen does not retract memory.
            </p>
          </div>
        </div>

        {loreEntry.knownTo.length > 0 ? (
          <div className="npc-chip-row">
            {loreEntry.knownTo.map((knownPlayer) => (
              <span
                key={`${loreEntry.id}-${knownPlayer.discordUserId}`}
                className="npc-chip is-known"
                title={knownPlayer.secondaryLabel}
              >
                {knownPlayer.displayName}
              </span>
            ))}
          </div>
        ) : (
          <p className="quest-empty">Hidden from every player.</p>
        )}

        <LoreRevealPicker
          loreEntry={loreEntry}
          recipientOptions={recipientOptions}
          pending={pending}
          assigning={assigning}
          onToggle={onToggle}
          onApply={onApply}
        />
      </div>
    </article>
  );
}

function LoreRevealPicker({
  loreEntry,
  recipientOptions,
  pending,
  assigning,
  onToggle,
  onApply,
}: {
  loreEntry: LoreEntry;
  recipientOptions: RecipientOption[];
  pending: string[];
  assigning: boolean;
  onToggle: (recipientId: string) => void;
  onApply: () => void;
}) {
  const unrevealedRecipients = recipientOptions.filter(
    (option) => !isKnownToPlayer(loreEntry, option),
  );

  if (recipientOptions.length === 0) {
    return (
      <p className="form-hint">
        Player identities are still loading. Lore can be assigned once characters are present in
        this campaign.
      </p>
    );
  }

  if (unrevealedRecipients.length === 0) {
    return <p className="form-hint">Everyone on the board already knows this lore.</p>;
  }

  return (
    <>
      <div className="npc-chip-row">
        {recipientOptions.map((option) => {
          const isKnown = isKnownToPlayer(loreEntry, option);
          const isPending = pending.includes(option.id);
          return (
            <button
              key={option.id}
              className={`npc-chip-button${isKnown ? ' is-known' : ''}${isPending ? ' is-pending' : ''}`}
              type="button"
              onClick={() => {
                if (!isKnown) {
                  onToggle(option.id);
                }
              }}
              aria-pressed={isKnown ? undefined : isPending}
              disabled={isKnown}
              title={option.secondaryLabel}
            >
              {option.displayName}
            </button>
          );
        })}
      </div>

      <div className="npc-fact-actions">
        <button
          className="form-submit"
          type="button"
          disabled={pending.length === 0 || assigning}
          onClick={onApply}
        >
          {assigning
            ? 'Revealing...'
            : pending.length > 0
              ? `Mark known to ${pending.length}`
              : 'Select players'}
        </button>
        <span className="form-hint">This only grants knowledge; it does not retract it.</span>
      </div>
    </>
  );
}
