import { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router';
import type {
  ListQuests200DataItem,
  ListQuests200DataItemEntriesItem,
} from '@constancia/api-client/model';
import { ManagementWorkspace } from '@/components/layout/management-workspace';
import type { WarRoomContext } from '@/lib/war-room-data';

const QUEST_STATUSES = ['active', 'completed', 'failed'] as const;
const ENTRY_STATUSES = ['pending', 'done'] as const;

type QuestStatus = (typeof QUEST_STATUSES)[number];
type QuestEntryStatus = (typeof ENTRY_STATUSES)[number];

function getSetupBase(warRoom: WarRoomContext) {
  return warRoom.demoMode ? '/demo/setup' : '/setup';
}

function normalizeQuestStatus(status: string): QuestStatus {
  return QUEST_STATUSES.includes(status as QuestStatus) ? (status as QuestStatus) : 'active';
}

function normalizeEntryStatus(status: string): QuestEntryStatus {
  return ENTRY_STATUSES.includes(status as QuestEntryStatus)
    ? (status as QuestEntryStatus)
    : 'pending';
}

function sortQuestEntries(
  entries: ListQuests200DataItemEntriesItem[] | undefined,
): ListQuests200DataItemEntriesItem[] {
  return [...(entries ?? [])].sort((left, right) => left.sortOrder - right.sortOrder);
}

export default function LogRoute() {
  const warRoom = useOutletContext<WarRoomContext>();
  const quests = warRoom.quests;
  const setupBase = getSetupBase(warRoom);

  const questStats = useMemo(() => {
    const visible = quests.filter((quest) => quest.visible).length;
    const completed = quests.filter((quest) => quest.status === 'completed').length;
    const steps = quests.reduce((total, quest) => total + (quest.entries?.length ?? 0), 0);

    return { visible, completed, steps };
  }, [quests]);

  return (
    <ManagementWorkspace
      eyebrow="Quests"
      title="Quest control"
      description="Read the campaign ledger at speed. Creation and edits now live in Setup."
      meta={
        <div className="log-hero-meta">
          <p className="detail-label">Quest scope</p>
          <strong>
            {quests.length} quest{quests.length === 1 ? '' : 's'}
          </strong>
          <span>
            {questStats.visible} visible · {questStats.completed} closed · {questStats.steps} steps
          </span>
        </div>
      }
    >
      <div className="setup-back-row">
        <Link className="setup-inline-link" to={`${setupBase}/quests/new`}>
          Add quest
        </Link>
        <Link className="setup-inline-link" to={setupBase}>
          Open setup
        </Link>
      </div>

      {quests.length > 0 ? (
        <section className="quest-board" aria-label="Quest board">
          {quests.map((quest) => (
            <QuestCard key={quest.id} quest={quest} setupBase={setupBase} />
          ))}
        </section>
      ) : (
        <section className="detail-card board-empty-state">
          <p className="eyebrow">No quests</p>
          <h2>No player work is on the board yet.</h2>
          <p>Create a hidden task in Setup, then reveal it when the table has earned the lead.</p>
          <Link className="ghost-action ghost-action-inline" to={`${setupBase}/quests/new`}>
            Add quest
          </Link>
        </section>
      )}
    </ManagementWorkspace>
  );
}

function QuestCard({ quest, setupBase }: { quest: ListQuests200DataItem; setupBase: string }) {
  const entries = sortQuestEntries(quest.entries);
  const completedEntryCount = entries.filter((entry) => entry.status === 'done').length;
  const questStatus = normalizeQuestStatus(quest.status);

  return (
    <article className={`quest-card quest-card-${questStatus}`}>
      <div className="quest-summary-header">
        <div className="quest-summary-copy">
          <p className="detail-label">
            {questStatus} · {quest.visible ? 'player visible' : 'gm hidden'}
          </p>
          <h2>{quest.name}</h2>
          <p>{quest.description || 'No brief filed yet.'}</p>
        </div>

        <div className="quest-summary-actions">
          <span className="quest-count">
            {completedEntryCount}/{entries.length} done
          </span>
          <Link className="ghost-action ghost-action-inline" to={`${setupBase}/quests/${quest.id}`}>
            Edit in setup
          </Link>
        </div>
      </div>

      <div className="quest-entry-section">
        <div className="setup-subsection-header">
          <div>
            <p className="detail-label">Steps</p>
            <p className="form-hint">
              Quest steps are read-only here so the board stays scannable.
            </p>
          </div>
          <Link className="ghost-action ghost-action-inline" to={`${setupBase}/quests/${quest.id}`}>
            Manage thread
          </Link>
        </div>

        {entries.length > 0 ? (
          <div className="quest-entry-list">
            {entries.map((entry) => (
              <QuestEntrySummaryRow key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <p className="quest-empty">No steps filed yet.</p>
        )}
      </div>
    </article>
  );
}

function QuestEntrySummaryRow({ entry }: { entry: ListQuests200DataItemEntriesItem }) {
  const status = normalizeEntryStatus(entry.status);

  return (
    <div className="quest-entry-summary-row">
      <span className={`quest-entry-led quest-entry-${status}`}>
        {String(entry.sortOrder + 1).padStart(2, '0')}
      </span>
      <div className="quest-entry-summary-copy">
        <p>{entry.content}</p>
        <span>{status}</span>
      </div>
    </div>
  );
}
