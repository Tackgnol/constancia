import type { LoaderFunctionArgs } from 'react-router';
import { Link, useLoaderData, useParams } from 'react-router';
import { getJournalForCurrentPlayer } from '@constancia/api-client/endpoints/journal/journal';
import type {
  GetJournalForCurrentPlayer200DataLoreItem,
  GetJournalForCurrentPlayer200DataNpcsItem,
  GetJournalForCurrentPlayer200DataQuestsItem,
  GetJournalForCurrentPlayer200DataQuestsItemEntriesItem,
  GetJournalForCurrentPlayer200DataSummariesItem,
} from '@constancia/api-client/model';
import { formatGameDate, gameSystemRegistry, parseGameDate } from '@constancia/systems';
import { demoPlayerJournal } from '@/lib/demo-player-data';
import {
  normalizeQuestEntryStatus,
  normalizeQuestStatus,
  sortQuestEntries,
} from '@/lib/quest-status';

const SESSION_DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export async function loader({ params, request }: LoaderFunctionArgs) {
  const campaignId = params.campaignId ?? 'demo-crimson-dynasty';

  if (campaignId.startsWith('demo-')) {
    return demoPlayerJournal;
  }

  try {
    const response = await getJournalForCurrentPlayer(
      { id: campaignId },
      {
        credentials: 'include',
        headers: {
          cookie: request.headers.get('Cookie') || '',
        },
      },
    );

    if (response.status !== 'ok') {
      throw new Response('Player journal not found.', { status: 404 });
    }

    return response.data;
  } catch (error) {
    console.error('Failed to load player journal:', error);
    throw new Response('Failed to load player journal.', { status: 502 });
  }
}

export function meta() {
  return [
    { title: 'Constancia Player Journal' },
    {
      name: 'description',
      content: 'Player-facing journal with visible quests, summaries, and known NPC facts.',
    },
  ];
}

function formatSessionDate(value: string) {
  return SESSION_DATE_FORMATTER.format(new Date(value));
}

function formatJournalGameDate(value: unknown): string | null {
  const gameDate = parseGameDate(value);
  if (gameDate === null) {
    return null;
  }

  const calendar = gameSystemRegistry
    .list()
    .map((system) => system.calendars[gameDate.calendarId])
    .find((candidate) => candidate !== undefined);

  return calendar
    ? formatGameDate(gameDate, calendar)
    : `${gameDate.day} ${gameDate.monthId} ${gameDate.year}`;
}

export default function PlayerJournalRoute() {
  const journal = useLoaderData<typeof loader>();
  const params = useParams();
  const campaignId = params.campaignId ?? 'demo-crimson-dynasty';
  const isDemo = campaignId.startsWith('demo-');
  const playerBasePath = isDemo ? '/demo/player' : `/player/campaigns/${campaignId}`;
  const visibleItems =
    journal.quests.length + journal.summaries.length + journal.npcs.length + journal.lore.length;

  return (
    <main className="player-dossier-shell">
      <article className="player-dossier-sheet player-journal-sheet">
        <div className="player-dossier-strip">
          <span>Player journal</span>
          <span>{journal.quests.length} QUESTS</span>
          <span>{journal.npcs.length} DOSSIERS</span>
          <span>{journal.lore.length} LORE</span>
        </div>

        <div className="player-journal-nav">
          {isDemo ? (
            <Link className="ghost-action ghost-action-inline" to="/demo">
              Return to war room
            </Link>
          ) : null}
          <Link className="ghost-action ghost-action-inline" to={`${playerBasePath}/sheet`}>
            Open sheet
          </Link>
        </div>

        <section className="player-dossier-copy sheet-intro">
          <p className="eyebrow">Field record</p>
          <h1>Known leads</h1>
          <p>
            This view only shows material already opened to your character: visible quest threads,
            session summaries, confirmed NPC facts, and revealed lore.
          </p>
        </section>

        {visibleItems === 0 ? (
          <section className="detail-card board-empty-state">
            <h2>Your journal is empty.</h2>
            <p>When the GM reveals quests, summaries, or NPC facts, they will appear here.</p>
          </section>
        ) : (
          <div className="player-journal-grid">
            <section className="player-dossier-facts">
              <div className="setup-subsection-header">
                <div>
                  <p className="detail-label">Visible quests</p>
                  <p className="form-hint">Only threads marked player-visible are listed.</p>
                </div>
              </div>
              {journal.quests.length > 0 ? (
                <div className="quest-board">
                  {journal.quests.map((quest) => (
                    <PlayerQuestCard key={quest.id} quest={quest} />
                  ))}
                </div>
              ) : (
                <p className="quest-empty">No visible quests yet.</p>
              )}
            </section>

            <section className="player-dossier-facts">
              <div className="setup-subsection-header">
                <div>
                  <p className="detail-label">Session record</p>
                  <p className="form-hint">Visible summaries from previous sessions.</p>
                </div>
              </div>
              {journal.summaries.length > 0 ? (
                <div className="player-summary-list">
                  {journal.summaries.map((summary) => (
                    <PlayerSummaryCard key={summary.id} summary={summary} />
                  ))}
                </div>
              ) : (
                <p className="quest-empty">No session summaries released.</p>
              )}
            </section>

            <section className="player-dossier-facts">
              <div className="setup-subsection-header">
                <div>
                  <p className="detail-label">Known lore</p>
                  <p className="form-hint">World knowledge revealed to your character.</p>
                </div>
              </div>
              {journal.lore.length > 0 ? (
                <div className="npc-facts-grid">
                  {journal.lore.map((loreEntry) => (
                    <PlayerLoreCard key={loreEntry.id} loreEntry={loreEntry} />
                  ))}
                </div>
              ) : (
                <p className="quest-empty">No lore revealed yet.</p>
              )}
            </section>

            <section className="player-dossier-facts">
              <div className="setup-subsection-header">
                <div>
                  <p className="detail-label">Known NPCs</p>
                  <p className="form-hint">Dossiers contain only facts revealed to you.</p>
                </div>
              </div>
              {journal.npcs.length > 0 ? (
                <div className="npc-facts-grid">
                  {journal.npcs.map((npc) => (
                    <PlayerNpcJournalCard key={npc.id} npc={npc} playerBasePath={playerBasePath} />
                  ))}
                </div>
              ) : (
                <p className="quest-empty">No confirmed NPC facts yet.</p>
              )}
            </section>
          </div>
        )}
      </article>
    </main>
  );
}

function PlayerQuestCard({ quest }: { quest: GetJournalForCurrentPlayer200DataQuestsItem }) {
  const entries = sortQuestEntries(quest.entries);
  const completedEntryCount = entries.filter((entry) => entry.status === 'done').length;
  const questStatus = normalizeQuestStatus(quest.status);

  return (
    <article className={`quest-card quest-card-${questStatus}`}>
      <div className="quest-summary-header">
        <div className="quest-summary-copy">
          <p className="detail-label">{questStatus}</p>
          <h2>{quest.name}</h2>
          <p>{quest.description || 'No brief filed yet.'}</p>
        </div>

        <span className="quest-count">
          {completedEntryCount}/{entries.length} done
        </span>
      </div>

      {entries.length > 0 ? (
        <div className="quest-entry-list">
          {entries.map((entry) => (
            <PlayerQuestEntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      ) : (
        <p className="quest-empty">No steps filed yet.</p>
      )}
    </article>
  );
}

function PlayerQuestEntryRow({
  entry,
}: {
  entry: GetJournalForCurrentPlayer200DataQuestsItemEntriesItem;
}) {
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

function PlayerSummaryCard({
  summary,
}: {
  summary: GetJournalForCurrentPlayer200DataSummariesItem;
}) {
  const gameDate = formatJournalGameDate(summary.gameDate);

  return (
    <article className="npc-fact-card player-summary-card">
      <div className="npc-fact-card-header">
        <span className="npc-fact-number">
          {gameDate ?? formatSessionDate(summary.sessionDate)}
        </span>
        <p className="detail-label">{gameDate ? 'Game date' : 'Session summary'}</p>
      </div>
      <h2>{summary.title}</h2>
      <p className="npc-fact-copy">{summary.content}</p>
    </article>
  );
}

function PlayerLoreCard({ loreEntry }: { loreEntry: GetJournalForCurrentPlayer200DataLoreItem }) {
  return (
    <article className="npc-fact-card player-summary-card player-lore-card">
      <div className="npc-fact-card-header">
        <span className="npc-fact-number">{String(loreEntry.sortOrder + 1).padStart(2, '0')}</span>
        <p className="detail-label">Lore</p>
      </div>
      <h2>{loreEntry.title}</h2>
      <p className="npc-fact-copy">{loreEntry.content}</p>
    </article>
  );
}

function PlayerNpcJournalCard({
  npc,
  playerBasePath,
}: {
  npc: GetJournalForCurrentPlayer200DataNpcsItem;
  playerBasePath: string;
}) {
  return (
    <article className="npc-fact-card player-npc-fact-card">
      <div className="npc-fact-card-header">
        <span className="npc-fact-number">{npc.facts.length}</span>
        <p className="detail-label">Confirmed facts</p>
      </div>
      <h2>{npc.name}</h2>
      <div className="quest-entry-list">
        {npc.facts.map((fact) => (
          <p key={fact.id} className="npc-fact-copy">
            {fact.content}
          </p>
        ))}
      </div>
      <Link className="ghost-action ghost-action-inline" to={`${playerBasePath}/npcs/${npc.id}`}>
        Open dossier
      </Link>
    </article>
  );
}
