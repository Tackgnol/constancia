import type { LoaderFunctionArgs } from 'react-router';
import { Link, useLoaderData, useOutletContext } from 'react-router';
import { listNpcs } from '@constancia/api-client/endpoints/npcs/npcs';
import { ManagementWorkspace } from '@/components/layout/management-workspace';
import { buildServerApiOptions, resolveCurrentCampaignId } from '@/lib/api-proxy.server';
import { demoNpcs } from '@/lib/demo-npcs';
import type { WarRoomContext } from '@/lib/war-room-data';

interface SetupNpcDirectoryItem {
  id: string;
  name: string;
  primarySystemBlockLabel: string;
  factCount: number;
}

function getSetupBase(warRoom: WarRoomContext) {
  return warRoom.demoMode ? '/demo/setup' : '/setup';
}

function mapNpcDirectoryItem(input: {
  id: string;
  name: string;
  systemBlocks?: Array<{ label?: string }>;
  facts?: unknown[];
}): SetupNpcDirectoryItem {
  return {
    id: input.id,
    name: input.name,
    primarySystemBlockLabel: input.systemBlocks?.[0]?.label ?? 'No system block',
    factCount: input.facts?.length ?? 0,
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const pathname = new URL(request.url).pathname;
  if (pathname.startsWith('/demo/')) {
    return { npcs: demoNpcs.map(mapNpcDirectoryItem) };
  }

  const campaignId = await resolveCurrentCampaignId(request);
  if (!campaignId) {
    return { npcs: [] };
  }

  const response = await listNpcs({ id: campaignId }, buildServerApiOptions(request));
  return {
    npcs: response.status === 'ok' ? response.data.map(mapNpcDirectoryItem) : [],
  };
}

export default function SetupRoute() {
  const warRoom = useOutletContext<WarRoomContext>();
  const { npcs } = useLoaderData<typeof loader>();
  const setupBase = getSetupBase(warRoom);
  const hasDirectoryItems =
    warRoom.events.length > 0 ||
    warRoom.quests.length > 0 ||
    warRoom.lore.length > 0 ||
    npcs.length > 0;

  return (
    <ManagementWorkspace
      eyebrow="Setup"
      title="Stage the next move"
      description="Create and revise campaign material away from the live boards."
      meta={
        <div className="setup-hero-note">
          <p className="detail-label">Operator note</p>
          <p>Setup is the workshop. Play, NPCs, and Quests stay clean enough to run the table.</p>
        </div>
      }
    >
      <section className="setup-command-grid" aria-label="Setup workspaces">
        <Link className="setup-command-card" to={`${setupBase}/events/new`}>
          <div>
            <p className="detail-label">Events</p>
            <h2>Stage an event</h2>
            <p>Draft pipeline actions, channel targets, and trigger behavior.</p>
          </div>
        </Link>

        <Link className="setup-command-card" to={`${setupBase}/npcs/new`}>
          <div>
            <p className="detail-label">NPCs</p>
            <h2>Pin a dossier</h2>
            <p>Create a face, system blocks, and revealable facts before it reaches the board.</p>
          </div>
        </Link>

        <Link className="setup-command-card" to={`${setupBase}/quests/new`}>
          <div>
            <p className="detail-label">Quests</p>
            <h2>Bind a task thread</h2>
            <p>Prepare player-visible objectives and hidden GM threads in one focused screen.</p>
          </div>
        </Link>

        <Link className="setup-command-card" to={`${setupBase}/lore/new`}>
          <div>
            <p className="detail-label">Lore</p>
            <h2>File world knowledge</h2>
            <p>Write hidden truths and reveal them to specific players when they learn them.</p>
          </div>
        </Link>
      </section>

      {hasDirectoryItems ? (
        <section className="setup-panel">
          <div className="setup-panel-header">
            <div>
              <h2>Open an existing record</h2>
            </div>
            <p className="form-hint">
              Boards stay read-focused; edits happen through these setup routes.
            </p>
          </div>

          <div className="setup-directory-grid">
            {warRoom.events.length > 0 ? (
              <section className="setup-directory-list">
                <p className="detail-label">Events</p>
                {warRoom.events.map((event) => (
                  <Link
                    className="event-edit-row"
                    key={event.id}
                    to={`${setupBase}/events/${event.id}`}
                  >
                    <span className="event-edit-kind">{event.type}</span>
                    <span className="event-edit-name">{event.name}</span>
                    <span className="event-edit-meta">{event.status}</span>
                  </Link>
                ))}
              </section>
            ) : null}

            {npcs.length > 0 ? (
              <section className="setup-directory-list">
                <p className="detail-label">NPCs</p>
                {npcs.map((npc) => (
                  <Link className="event-edit-row" key={npc.id} to={`${setupBase}/npcs/${npc.id}`}>
                    <span className="event-edit-kind">{npc.primarySystemBlockLabel}</span>
                    <span className="event-edit-name">{npc.name}</span>
                    <span className="event-edit-meta">
                      {npc.factCount} fact{npc.factCount === 1 ? '' : 's'}
                    </span>
                  </Link>
                ))}
              </section>
            ) : null}

            {warRoom.quests.length > 0 ? (
              <section className="setup-directory-list">
                <p className="detail-label">Quests</p>
                {warRoom.quests.map((quest) => (
                  <Link
                    className="event-edit-row"
                    key={quest.id}
                    to={`${setupBase}/quests/${quest.id}`}
                  >
                    <span className="event-edit-kind">{quest.status}</span>
                    <span className="event-edit-name">{quest.name}</span>
                    <span className="event-edit-meta">
                      {quest.visible ? 'player visible' : 'gm hidden'}
                    </span>
                  </Link>
                ))}
              </section>
            ) : null}

            {warRoom.lore.length > 0 ? (
              <section className="setup-directory-list">
                <p className="detail-label">Lore</p>
                {warRoom.lore.map((loreEntry) => (
                  <Link
                    className="event-edit-row"
                    key={loreEntry.id}
                    to={`${setupBase}/lore/${loreEntry.id}`}
                  >
                    <span className="event-edit-kind">lore</span>
                    <span className="event-edit-name">{loreEntry.title}</span>
                    <span className="event-edit-meta">
                      {loreEntry.knownTo.length} player
                      {loreEntry.knownTo.length === 1 ? '' : 's'}
                    </span>
                  </Link>
                ))}
              </section>
            ) : null}
          </div>
        </section>
      ) : null}
    </ManagementWorkspace>
  );
}
