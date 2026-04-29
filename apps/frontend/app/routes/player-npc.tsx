import type { LoaderFunctionArgs } from 'react-router';
import { Link, useLoaderData } from 'react-router';
import { getVisibleNpcForCurrentPlayer } from '@constancia/api-client/endpoints/npcs/npcs';
import { NpcPortraitFallback } from '@/components/npcs/npc-portrait-fallback';
import { getDemoPlayerNpc } from '@/lib/demo-player-data';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const campaignId = params.campaignId ?? 'demo-crimson-dynasty';
  const npcId = params.npcId;

  if (!npcId) {
    throw new Response('NPC dossier link is incomplete.', { status: 400 });
  }

  if (campaignId.startsWith('demo-')) {
    const demoNpc = getDemoPlayerNpc(npcId);

    if (!demoNpc) {
      throw new Response('NPC dossier not found.', { status: 404 });
    }

    return demoNpc;
  }

  try {
    const response = await getVisibleNpcForCurrentPlayer(
      { id: campaignId, npcId },
      {
        credentials: 'include',
        headers: {
          cookie: request.headers.get('Cookie') || '',
        },
      },
    );

    if (!response || response.status !== 'ok' || !response.data) {
      throw new Response('NPC dossier not found.', { status: 404 });
    }

    return response.data;
  } catch (err) {
    console.error('Failed to load NPC dossier:', err);
    throw new Response('Failed to load NPC dossier.', { status: 502 });
  }
}

export function meta() {
  return [
    { title: 'Constancia Player Dossier' },
    {
      name: 'description',
      content: 'Player-safe NPC dossier containing only revealed facts.',
    },
  ];
}

export default function PlayerNpcRoute() {
  const npc = useLoaderData<typeof loader>();
  const playerBasePath = npc.campaignId.startsWith('demo-')
    ? '/demo/player'
    : `/player/campaigns/${npc.campaignId}`;

  return (
    <main className="player-dossier-shell">
      <article className="player-dossier-sheet">
        <div className="player-dossier-strip">
          <span>FIELD DOSSIER</span>
          <span>PLAYER-SAFE EXCERPT</span>
          <span>{npc.facts.length} CONFIRMED</span>
        </div>

        <div className="player-journal-nav">
          <Link className="ghost-action ghost-action-inline" to={`${playerBasePath}/journal`}>
            Back to journal
          </Link>
        </div>

        <section className="player-dossier-hero">
          <div className="npc-portrait-shell npc-portrait-shell-dossier">
            {npc.imageUrl ? (
              <img className="npc-portrait" src={npc.imageUrl} alt={`${npc.name} portrait`} />
            ) : (
              <NpcPortraitFallback name={npc.name} />
            )}
            <div className="npc-portrait-stamp">known</div>
          </div>

          <div className="player-dossier-copy">
            <p className="eyebrow">NPC dossier</p>
            <h1>{npc.name}</h1>
            <p>
              This page only contains facts that have already been revealed to you in play. The rest
              of the file remains sealed.
            </p>
          </div>
        </section>

        <section className="player-dossier-facts">
          <div className="setup-subsection-header">
            <div>
              <p className="detail-label">Confirmed knowledge</p>
              <p className="form-hint">
                Everything below has been explicitly marked as known to your character.
              </p>
            </div>
          </div>

          <div className="npc-facts-grid">
            {npc.facts.map((fact, index) => (
              <article key={fact.id} className="npc-fact-card player-npc-fact-card">
                <div className="npc-fact-card-header">
                  <span className="npc-fact-number">{String(index + 1).padStart(2, '0')}</span>
                  <p className="detail-label">Revealed intel</p>
                </div>
                <p className="npc-fact-copy">{fact.content}</p>
              </article>
            ))}
          </div>
        </section>
      </article>
    </main>
  );
}
