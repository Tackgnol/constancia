import { useMemo, useState } from 'react';
import type { ActionFunctionArgs } from 'react-router';
import { Link, useLocation, useOutletContext, useRevalidator } from 'react-router';
import { updateSessionSummary } from '@constancia/api-client/endpoints/journal/journal';
import type {
  ListQuests200DataItem,
  ListQuests200DataItemEntriesItem,
  ListSessionSummaries200DataItem,
} from '@constancia/api-client/model';
import type { GameDate } from '@constancia/contracts';
import { parseGameDate } from '@constancia/systems';
import { GameDateControl } from '@/components/war-room/game-date-control';
import { ManagementWorkspace } from '@/components/layout/management-workspace';
import { assertApiOk, getApiErrorMessage } from '@/lib/api-errors';
import { buildServerApiOptions } from '@/lib/api-proxy.server';
import { postRouteAction } from '@/lib/route-action-client';
import {
  normalizeQuestEntryStatus,
  normalizeQuestStatus,
  sortQuestEntries,
} from '@/lib/quest-status';
import { GAME_DATE_UPDATE_ERROR } from '@/lib/war-room-feedback';
import type { WarRoomContext } from '@/lib/war-room-data';

function parseSubmittedGameDate(value: FormDataEntryValue | null): GameDate | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return parseGameDate(parsed);
  } catch {
    return null;
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const campaignId = formData.get('campaignId');
  const summaryId = formData.get('summaryId');
  const gameDate = parseSubmittedGameDate(formData.get('gameDate'));

  if (
    formData.get('intent') !== 'update-summary-game-date' ||
    typeof campaignId !== 'string' ||
    campaignId.length === 0 ||
    typeof summaryId !== 'string' ||
    summaryId.length === 0 ||
    gameDate === null
  ) {
    return Response.json(
      { status: 'error', message: 'Choose a complete journal date and try again.' },
      { status: 400 },
    );
  }

  try {
    const response = await updateSessionSummary(
      { id: campaignId, sumId: summaryId },
      { gameDate },
      buildServerApiOptions(request),
    );
    assertApiOk(response, GAME_DATE_UPDATE_ERROR);
    return Response.json({ status: 'success' });
  } catch (caught) {
    return Response.json(
      { status: 'error', message: getApiErrorMessage(caught, GAME_DATE_UPDATE_ERROR) },
      { status: 500 },
    );
  }
}

function getSetupBase(warRoom: WarRoomContext) {
  return warRoom.demoMode ? '/demo/setup' : '/setup';
}

export default function LogRoute() {
  const warRoom = useOutletContext<WarRoomContext>();
  const location = useLocation();
  const revalidator = useRevalidator();
  const quests = warRoom.quests;
  const summaries = warRoom.summaries;
  const setupBase = getSetupBase(warRoom);
  const [savingSummaryId, setSavingSummaryId] = useState<string | null>(null);
  const [summaryErrors, setSummaryErrors] = useState<Record<string, string>>({});

  const questStats = useMemo(() => {
    const visible = quests.filter((quest) => quest.visible).length;
    const completed = quests.filter((quest) => quest.status === 'completed').length;
    const steps = quests.reduce((total, quest) => total + (quest.entries?.length ?? 0), 0);

    return { visible, completed, steps };
  }, [quests]);

  const saveSummaryGameDate = async (
    summary: ListSessionSummaries200DataItem,
    gameDate: GameDate,
  ) => {
    setSavingSummaryId(summary.id);
    setSummaryErrors((current) => {
      const next = { ...current };
      delete next[summary.id];
      return next;
    });

    try {
      if (warRoom.demoMode) {
        warRoom.updateSummaryGameDate?.(summary.id, gameDate);
        return;
      }

      const response = await postRouteAction(location.pathname, {
        intent: 'update-summary-game-date',
        campaignId: warRoom.campaign.id,
        summaryId: summary.id,
        gameDate: JSON.stringify(gameDate),
      });
      if (response.status !== 'success') {
        throw new Error(response.message);
      }
      revalidator.revalidate();
    } catch (caught) {
      setSummaryErrors((current) => ({
        ...current,
        [summary.id]: getApiErrorMessage(caught, GAME_DATE_UPDATE_ERROR),
      }));
    } finally {
      setSavingSummaryId(null);
    }
  };

  return (
    <ManagementWorkspace
      eyebrow="Campaign log"
      title="Journal and quest control"
      description="Read the campaign record at speed. Journal dates stay editable when the table needs a correction."
      meta={
        <div className="log-hero-meta">
          <p className="detail-label">Campaign record</p>
          <strong>
            {summaries.length} journal entr{summaries.length === 1 ? 'y' : 'ies'}
          </strong>
          <span>
            {quests.length} quests · {questStats.completed} closed · {questStats.steps} steps
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

      <section className="journal-record" aria-label="Journal entries">
        <div className="setup-subsection-header">
          <div>
            <p className="detail-label">Journal record</p>
            <p className="form-hint">
              Entries keep the game date from the moment they were created. Correcting one does not
              move the campaign clock.
            </p>
          </div>
          <span className="quest-count">{summaries.length} entries</span>
        </div>

        {summaries.length > 0 ? (
          <div className="journal-entry-list">
            {summaries.map((summary) => {
              const gameDate = parseGameDate(summary.gameDate);
              const calendarId = gameDate?.calendarId ?? warRoom.system.defaultCalendarId;
              const calendar = warRoom.system.calendars[calendarId];

              return (
                <article className="journal-entry-row" key={summary.id}>
                  <div className="journal-entry-copy">
                    <p className="detail-label">
                      Journal entry · {summary.visible ? 'player visible' : 'gm hidden'}
                    </p>
                    <h2>{summary.title}</h2>
                    <p>{summary.content}</p>
                  </div>
                  {calendar ? (
                    <GameDateControl
                      busy={savingSummaryId === summary.id}
                      calendar={calendar}
                      error={summaryErrors[summary.id] ?? null}
                      onDraftChange={() =>
                        setSummaryErrors((current) => {
                          const next = { ...current };
                          delete next[summary.id];
                          return next;
                        })
                      }
                      onSave={(date) => void saveSummaryGameDate(summary, date)}
                      value={gameDate}
                    />
                  ) : (
                    <span className="form-error">Calendar definition unavailable.</span>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="detail-card board-empty-state">
            <h2>No journal entries have been recorded yet.</h2>
            <p>Fire an event with an Add Journal Entry block to begin the campaign record.</p>
          </div>
        )}
      </section>

      {quests.length > 0 ? (
        <section className="quest-board" aria-label="Quest board">
          {quests.map((quest) => (
            <QuestCard key={quest.id} quest={quest} setupBase={setupBase} />
          ))}
        </section>
      ) : (
        <section className="detail-card board-empty-state">
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
            <p className="form-hint">Read-only here. Use Edit in setup to change the thread.</p>
          </div>
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
  const status = normalizeQuestEntryStatus(entry.status);

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
