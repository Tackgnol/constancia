import { getPublicVisibleNpcForPlayer } from '@/api/generated/endpoints/npcs/npcs';
import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const campaignId = params.campaignId;
  const npcId = params.npcId;
  const discordId = params.discordId;

  if (!campaignId || !npcId || !discordId) {
    throw new Response('NPC dossier link is incomplete.', { status: 400 });
  }

  const response = await getPublicVisibleNpcForPlayer(
    { id: campaignId, npcId, discordId },
    {
      headers: {
        cookie: request.headers.get('Cookie') || '',
      },
    },
  );

  if (response.status !== 'ok') {
    throw new Response('NPC dossier not found.', { status: 404 });
  }

  return response.data;
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

  return (
    <main className="player-dossier-shell">
      <article className="player-dossier-sheet">
        <div className="player-dossier-strip">
          <span>FIELD DOSSIER</span>
          <span>PLAYER-SAFE EXCERPT</span>
          <span>{npc.facts.length} CONFIRMED</span>
        </div>

        <section className="player-dossier-hero">
          <div className="npc-portrait-shell npc-portrait-shell-dossier">
            {npc.imageUrl ? (
              <img className="npc-portrait" src={npc.imageUrl} alt={`${npc.name} portrait`} />
            ) : (
              <div className="npc-portrait npc-portrait-fallback" aria-hidden="true">
                {npc.name
                  .split(' ')
                  .slice(0, 2)
                  .map((part) => part.charAt(0))
                  .join('')}
              </div>
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
              <p className="form-hint">Everything below has been explicitly marked as known to your character.</p>
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

