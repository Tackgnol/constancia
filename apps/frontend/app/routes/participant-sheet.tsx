import { useEffect, useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Link, useLoaderData, useLocation } from 'react-router';
import {
  getCharacterSheet,
  updateCharacterSheet,
} from '@constancia/api-client/endpoints/characters/characters';
import { CharacterSheetForm } from '@/components/character-sheet/character-sheet-form';
import { Button } from '@/components/ui/button';
import {
  parseCharacterSheetPatchPayload,
  readCharacterSheetData,
  type CharacterSheetData,
  type CharacterSheetPatchBody,
} from '@/lib/character-sheet';
import { assertApiOk, getApiErrorMessage } from '@/lib/api-errors';
import { buildServerApiOptions, resolveCurrentCampaignId } from '@/lib/api-proxy.server';
import { postRouteAction } from '@/lib/route-action-client';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const charId = params.charId;
  const campaignId = await resolveCurrentCampaignId(request);

  if (!campaignId || !charId) {
    return { sheet: null };
  }

  const response = await getCharacterSheet(
    { id: campaignId, charId },
    buildServerApiOptions(request),
  );
  assertApiOk(
    response,
    "We couldn't load this character sheet. Return to Participants and reopen it.",
  );

  return { sheet: readCharacterSheetData(response.data) };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const charId = params.charId;
  const campaignId = await resolveCurrentCampaignId(request);

  if (intent !== 'update-sheet') {
    return Response.json(
      { status: 'error', message: 'Unsupported sheet action.' },
      { status: 400 },
    );
  }

  const payload = parseCharacterSheetPatchPayload(formData.get('payload'));
  if (!campaignId || !charId || !payload) {
    return Response.json(
      {
        status: 'error',
        message: "We couldn't identify this character sheet. Return to Participants and reopen it.",
      },
      { status: 400 },
    );
  }

  try {
    const response = await updateCharacterSheet(
      { id: campaignId, charId },
      payload,
      buildServerApiOptions(request),
    );
    assertApiOk(
      response,
      "We couldn't save this sheet. Your changes are still in the form; review the highlighted fields and try again.",
    );
    return Response.json({ status: 'success', data: readCharacterSheetData(response.data) });
  } catch (caught) {
    return Response.json(
      {
        status: 'error',
        message: getApiErrorMessage(
          caught,
          "We couldn't save this sheet. Your changes are still in the form; review the highlighted fields and try again.",
        ),
      },
      { status: 500 },
    );
  }
}

export default function ParticipantSheetRoute() {
  const { sheet: loadedSheet } = useLoaderData<typeof loader>();
  const location = useLocation();
  const [sheet, setSheet] = useState<CharacterSheetData | null>(loadedSheet);

  useEffect(() => {
    setSheet(loadedSheet);
  }, [loadedSheet]);

  const handleSave = async (payload: CharacterSheetPatchBody) => {
    const response = await postRouteAction<CharacterSheetData>(location.pathname, {
      intent: 'update-sheet',
      payload: JSON.stringify(payload),
    });

    if (response.status !== 'success' || !response.data) {
      throw new Error(
        response.status === 'error'
          ? response.message
          : "We couldn't save this sheet. Your changes are still in the form; review the highlighted fields and try again.",
      );
    }

    const updated = response.data;
    setSheet(updated);
    return updated;
  };

  return (
    <div className="mode-route">
      <section className="hero-strip hero-strip-compact">
        <div className="sheet-hero-copy">
          <p className="eyebrow">Participant Sheet</p>
          <h1>{sheet?.character.gameName || sheet?.character.discordName || 'Unavailable'}</h1>
          <p className="hero-copy">
            This GM view edits the same system-backed sheet the player can access through their own
            magic link.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/participants">Back to participants</Link>
        </Button>
      </section>

      {!sheet ? (
        <section className="detail-card sheet-loading-card">
          <p className="detail-label">Unavailable</p>
          <p className="hero-copy">
            This character sheet could not be loaded. Check that the participant exists in the
            active campaign and that your session still has access.
          </p>
        </section>
      ) : null}

      {sheet ? <CharacterSheetForm sheet={sheet} audience="gm" onSave={handleSave} /> : null}
    </div>
  );
}
