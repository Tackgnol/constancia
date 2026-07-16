import { useState } from 'react';
import {
  ProgenyImportError,
  extractSystemStats,
  parseProgenyVtmCharacter,
  type ProgenyVtmCharacterExport,
} from '@constancia/systems';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Link, useLoaderData, useLocation } from 'react-router';
import {
  getPlayerCharacterSheet,
  importPlayerCharacterFromProgeny,
  updatePlayerCharacterSheet,
} from '@constancia/api-client/endpoints/characters/characters';
import { CharacterSheetForm } from '@/components/character-sheet/character-sheet-form';
import { assertApiOk, getApiErrorMessage } from '@/lib/api-errors';
import { buildServerApiOptions } from '@/lib/api-proxy.server';
import {
  parseCharacterSheetPatchPayload,
  readCharacterSheetData,
  type CharacterSheetData,
  type CharacterSheetPatchBody,
} from '@/lib/character-sheet';
import { demoPlayerSheet } from '@/lib/demo-player-data';
import { postRouteAction } from '@/lib/route-action-client';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const campaignId = params.campaignId ?? 'demo-crimson-dynasty';

  if (campaignId.startsWith('demo-')) {
    return demoPlayerSheet;
  }

  try {
    const response = await getPlayerCharacterSheet(
      { id: campaignId },
      buildServerApiOptions(request),
    );
    assertApiOk(response, 'Failed to load player sheet.');
    return readCharacterSheetData(response.data);
  } catch (error) {
    console.error('Failed to load player sheet:', error);
    throw new Response('Failed to load player sheet.', { status: 502 });
  }
}

function readProgenyPayload(input: FormDataEntryValue | null): ProgenyVtmCharacterExport {
  if (typeof input !== 'string' || input.length === 0) {
    throw new ProgenyImportError('The Progeny import payload is missing.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new ProgenyImportError('The selected file is not valid JSON.');
  }

  return parseProgenyVtmCharacter(parsed).source;
}

export async function action({ request, params }: ActionFunctionArgs) {
  const campaignId = params.campaignId;
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (!campaignId || campaignId.startsWith('demo-')) {
    return Response.json(
      { status: 'error', message: 'The player sheet action is unavailable.' },
      { status: 400 },
    );
  }

  try {
    if (intent === 'update-sheet') {
      const payload = parseCharacterSheetPatchPayload(formData.get('payload'));
      if (!payload) {
        return Response.json(
          {
            status: 'error',
            message: "We couldn't identify your character sheet. Reload this page and try again.",
          },
          { status: 400 },
        );
      }

      const response = await updatePlayerCharacterSheet(
        { id: campaignId },
        payload,
        buildServerApiOptions(request),
      );
      assertApiOk(
        response,
        "We couldn't save your sheet. Your changes are still in the form; review the highlighted fields and try again.",
      );
      return Response.json({
        status: 'success',
        data: readCharacterSheetData(response.data),
      });
    }

    if (intent === 'import-progeny') {
      const source = readProgenyPayload(formData.get('payload'));
      const response = await importPlayerCharacterFromProgeny(
        { id: campaignId },
        source,
        buildServerApiOptions(request),
      );
      assertApiOk(response, 'The Progeny character could not be imported.');
      return Response.json({
        status: 'success',
        data: readCharacterSheetData(response.data),
      });
    }

    return Response.json(
      { status: 'error', message: 'Unsupported player sheet action.' },
      { status: 400 },
    );
  } catch (caught) {
    const isImportValidationError = caught instanceof ProgenyImportError;
    return Response.json(
      {
        status: 'error',
        message: isImportValidationError
          ? caught.message
          : getApiErrorMessage(
              caught,
              "We couldn't save your sheet. Your changes are still in the form; review the highlighted fields and try again.",
            ),
      },
      { status: isImportValidationError ? 400 : 500 },
    );
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
  const location = useLocation();
  const [sheet, setSheet] = useState<CharacterSheetData>(loaderSheet);
  const isDemo = sheet.campaign.id.startsWith('demo-');
  const playerBasePath = isDemo ? '/demo/player' : `/player/campaigns/${sheet.campaign.id}`;

  const handleSave = async (payload: CharacterSheetPatchBody) => {
    if (isDemo) {
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

    const response = await postRouteAction<CharacterSheetData>(location.pathname, {
      intent: 'update-sheet',
      payload: JSON.stringify(payload),
    });
    if (response.status !== 'success' || !response.data) {
      throw new Error(
        response.status === 'error'
          ? response.message
          : "We couldn't save your sheet. Your changes are still in the form; review the highlighted fields and try again.",
      );
    }

    setSheet(response.data);
    return response.data;
  };

  const handleProgenyImport = async (source: ProgenyVtmCharacterExport) => {
    if (isDemo) {
      const imported = parseProgenyVtmCharacter(source);
      const systemData = {
        ...sheet.character.systemData,
        ...imported.systemData,
      };
      const updated: CharacterSheetData = {
        ...sheet,
        character: {
          ...sheet.character,
          gameName: imported.gameName,
          backstory: imported.backstory,
          notes: imported.notes,
          systemData,
        },
        stats: extractSystemStats(sheet.system.id, systemData),
      };

      setSheet(updated);
      return updated;
    }

    const response = await postRouteAction<CharacterSheetData>(location.pathname, {
      intent: 'import-progeny',
      payload: JSON.stringify(source),
    });
    if (response.status !== 'success' || !response.data) {
      throw new Error(
        response.status === 'error'
          ? response.message
          : 'The Progeny character could not be imported.',
      );
    }

    setSheet(response.data);
    return response.data;
  };

  return (
    <main className="player-dossier-shell">
      <article className="player-dossier-sheet">
        <div className="player-dossier-strip">
          <span>Player sheet</span>
          <span>{sheet.campaign.name}</span>
          <span>{sheet.system.name}</span>
        </div>

        <div className="player-journal-nav">
          {isDemo ? (
            <Link className="ghost-action ghost-action-inline" to="/demo">
              Return to war room
            </Link>
          ) : null}
          <Link className="ghost-action ghost-action-inline" to={`${playerBasePath}/journal`}>
            Open journal
          </Link>
        </div>

        <section className="player-dossier-copy sheet-intro">
          <p className="eyebrow">Character file</p>
          <h1>{sheet.character.gameName || sheet.character.discordName || sheet.character.name}</h1>
          <p>
            This is your live campaign sheet. Updating it here changes the same system-backed stats
            the GM sees in the war room.
          </p>
        </section>

        <CharacterSheetForm
          sheet={sheet}
          audience="player"
          onSave={handleSave}
          onImportProgeny={handleProgenyImport}
        />
      </article>
    </main>
  );
}
