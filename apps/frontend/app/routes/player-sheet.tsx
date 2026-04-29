import { useState } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { CharacterSheetForm } from '@/components/character-sheet/character-sheet-form';
import {
  getPlayerCharacterSheet,
  updatePlayerCharacterSheet,
  type CharacterSheetData,
  type CharacterSheetPatchBody,
} from '@/lib/character-sheet';
import { demoPlayerSheet } from '@/lib/demo-player-data';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const campaignId = params.campaignId ?? 'demo-crimson-dynasty';

  if (campaignId.startsWith('demo-')) {
    return demoPlayerSheet;
  }

  try {
    return await getPlayerCharacterSheet(campaignId, {
      credentials: 'include',
      headers: {
        cookie: request.headers.get('Cookie') || '',
      },
    });
  } catch (error) {
    console.error('Failed to load player sheet:', error);
    throw new Response('Failed to load player sheet.', { status: 502 });
  }
}

export function meta() {
  return [
    { title: 'Constancia Player Sheet' },
    {
      name: 'description',
      content: 'Player-facing character sheet for updating your current campaign stats and notes.',
    },
  ];
}

export default function PlayerSheetRoute() {
  const loaderSheet = useLoaderData<typeof loader>();
  const [sheet, setSheet] = useState<CharacterSheetData>(loaderSheet);

  const handleSave = async (payload: CharacterSheetPatchBody) => {
    if (sheet.campaign.id.startsWith('demo-')) {
      const updated: CharacterSheetData = {
        ...sheet,
        character: {
          ...sheet.character,
          gameName: payload.gameName,
          backstory: payload.backstory,
          notes: payload.notes,
        },
        stats: payload.stats,
      };

      setSheet(updated);
      return updated;
    }

    const updated = await updatePlayerCharacterSheet(sheet.campaign.id, payload, {
      credentials: 'include',
    });
    setSheet(updated);
    return updated;
  };

  return (
    <main className="player-dossier-shell">
      <article className="player-dossier-sheet">
        <div className="player-dossier-strip">
          <span>PLAYER SHEET</span>
          <span>{sheet.campaign.name}</span>
          <span>{sheet.system.id}</span>
        </div>

        <section className="player-dossier-copy sheet-intro">
          <p className="eyebrow">Character file</p>
          <h1>{sheet.character.gameName || sheet.character.discordName || sheet.character.name}</h1>
          <p>
            This is your live campaign sheet. Updating it here changes the same system-backed stats
            the GM sees in the war room.
          </p>
        </section>

        <CharacterSheetForm sheet={sheet} audience="player" onSave={handleSave} />
      </article>
    </main>
  );
}
