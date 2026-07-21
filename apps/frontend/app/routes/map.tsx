import {
  createScene,
  createScenePeg,
  deleteScene,
  deleteSceneMap,
  deleteScenePeg,
  setSceneMap,
  updateScene,
  updateScenePeg,
} from '@constancia/api-client/endpoints/scenes/scenes';
import type { CreateScenePegBodyKind } from '@constancia/api-client/model';
import { deleteUnlinkedUpload } from '@constancia/api-client/endpoints/uploads/uploads';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { MapWorkspaceRoot } from '@/components/maps/map-workspace';
import { ApiResponseError, assertApiOk, getApiErrorMessage } from '@/lib/api-errors';
import { buildServerApiOptions, resolveCurrentCampaignId } from '@/lib/api-proxy.server';
import { loadDemoMapWorkspaceProjection } from '@/lib/demo-map-workspace-projection';
import { fireCampaignEvent } from '@/lib/fire-event-action.server';
import { loadLiveMapWorkspaceProjection } from '@/lib/live-map-workspace-projection.server';
import { uploadImageFromFormData } from '@/lib/upload-image-action.server';

const SCENE_CREATE_ERROR =
  "We couldn't create that scene. Your name is still in the form; try again.";
const SCENE_RENAME_ERROR = "We couldn't rename that scene. Its current name is unchanged.";
const SCENE_DELETE_ERROR = "We couldn't delete that scene. It and its pegs are unchanged.";
const MAP_ATTACH_ERROR =
  "We couldn't attach that map. The scene still shows its previous map; try again.";
const MAP_REMOVE_ERROR = "We couldn't remove that map. Peg positions are unchanged.";
const PEG_CREATE_ERROR = "We couldn't place that peg. Nothing was added to the map.";
const PEG_MOVE_ERROR = "We couldn't move that peg. It stays where it was.";
const PEG_DELETE_ERROR = "We couldn't remove that peg. It is still on the map.";

/** Same execution path as Play, worded for a peg on a map rather than a row on the board. */
const MAP_FIRE_MESSAGES = {
  missingIdentifiers: "We couldn't identify this event peg. Reload Map, then arm it again.",
  fireFailed:
    "We couldn't confirm this event. Check Discord for the result before firing it again.",
  unreadableReceipt:
    "We couldn't confirm the execution receipt. Check Discord for the result before firing it again.",
} as const;

const intentFallbackMessages: Record<string, string> = {
  'create-scene': SCENE_CREATE_ERROR,
  'rename-scene': SCENE_RENAME_ERROR,
  'delete-scene': SCENE_DELETE_ERROR,
  'delete-scene-map': MAP_REMOVE_ERROR,
  'create-scene-peg': PEG_CREATE_ERROR,
  'move-scene-peg': PEG_MOVE_ERROR,
  'delete-scene-peg': PEG_DELETE_ERROR,
};

const pegKinds = ['event', 'npc', 'lore'] as const;

function parsePegKind(value: FormDataEntryValue | null): CreateScenePegBodyKind | null {
  return pegKinds.find((kind) => kind === value) ?? null;
}

/** Coordinates cross the form boundary as strings; anything out of range never reaches the API. */
function parseCoordinate(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (new URL(request.url).pathname.startsWith('/demo/')) {
    return loadDemoMapWorkspaceProjection(request.url);
  }

  return loadLiveMapWorkspaceProjection(request);
}

function failure(message: string, status: number) {
  return Response.json({ status: 'error', message }, { status });
}

/**
 * Uploading and attaching a map is one user action, so a successful upload whose attachment fails
 * must not leave an owned, unreferenced asset behind. The compensating delete is best effort: if it
 * also fails the caller still sees the original attachment error, and both ids reach the log so the
 * orphan can be reconciled.
 */
async function replaceSceneMap(
  request: Request,
  formData: FormData,
  campaignId: string,
  sceneId: string,
): Promise<Response> {
  const upload = await uploadImageFromFormData(request, formData);
  if (upload.status === 'error') {
    return failure(upload.message, upload.statusCode);
  }

  const { assetId, quota } = upload.data;
  const options = buildServerApiOptions(request);

  try {
    const response = await setSceneMap({ id: campaignId, sceneId }, { assetId }, options);
    assertApiOk(response, MAP_ATTACH_ERROR);
    return Response.json({ status: 'success', data: { quota } });
  } catch (caught) {
    const message = getApiErrorMessage(caught, MAP_ATTACH_ERROR);

    try {
      await deleteUnlinkedUpload({ assetId }, options);
    } catch (cleanupFailure) {
      console.error('Scene map compensation failed', {
        operation: 'delete-unlinked-upload',
        campaignId,
        sceneId,
        assetId,
        reason: cleanupFailure instanceof Error ? cleanupFailure.message : String(cleanupFailure),
      });
    }

    return failure(message, 500);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  // Resolved the same way the loader does, so a client-supplied value is never trusted for
  // authorization or lookup purposes.
  const campaignId = await resolveCurrentCampaignId(request);
  if (campaignId === null) {
    return failure(
      'No campaign is connected yet. Finish Setup, then return to build your maps.',
      400,
    );
  }

  const options = buildServerApiOptions(request);

  try {
    if (intent === 'create-scene') {
      const name = formData.get('name');
      if (typeof name !== 'string' || name.trim().length === 0) {
        return failure('Give the scene a name before creating it.', 400);
      }

      const response = await createScene({ id: campaignId }, { name: name.trim() }, options);
      assertApiOk(response, SCENE_CREATE_ERROR);
      return Response.json({
        status: 'success',
        data: { sceneId: response.data.id, name: response.data.name },
      });
    }

    // Firing is a campaign-level operation reusing Play's execution path; it needs no scene.
    if (intent === 'fire-event') {
      const result = await fireCampaignEvent(request, {
        campaignId,
        eventId: formData.get('eventId'),
        idempotencyKey: formData.get('idempotencyKey'),
        messages: MAP_FIRE_MESSAGES,
      });

      return result.status === 'error'
        ? failure(result.message, result.statusCode)
        : Response.json({ status: 'success', data: { receipt: result.receipt } });
    }

    const sceneId = formData.get('sceneId');
    if (typeof sceneId !== 'string' || sceneId.length === 0) {
      return failure('Select a scene before changing it.', 400);
    }

    if (intent === 'rename-scene') {
      const name = formData.get('name');
      if (typeof name !== 'string' || name.trim().length === 0) {
        return failure('Give the scene a name before saving it.', 400);
      }

      const response = await updateScene(
        { id: campaignId, sceneId },
        { name: name.trim() },
        options,
      );
      assertApiOk(response, SCENE_RENAME_ERROR);
      return Response.json({
        status: 'success',
        data: { sceneId, name: response.data.name },
      });
    }

    if (intent === 'delete-scene') {
      const response = await deleteScene({ id: campaignId, sceneId }, options);
      if (response.status !== 'ok' || !response.deleted) {
        return failure(SCENE_DELETE_ERROR, 500);
      }
      return Response.json({ status: 'success' });
    }

    if (intent === 'replace-scene-map') {
      return replaceSceneMap(request, formData, campaignId, sceneId);
    }

    if (intent === 'delete-scene-map') {
      const response = await deleteSceneMap({ id: campaignId, sceneId }, options);
      if (response.status !== 'ok' || !response.deleted) {
        return failure(MAP_REMOVE_ERROR, 500);
      }
      return Response.json({ status: 'success' });
    }

    if (intent === 'create-scene-peg') {
      const kind = parsePegKind(formData.get('kind'));
      const targetId = formData.get('targetId');
      const x = parseCoordinate(formData.get('x'));
      const y = parseCoordinate(formData.get('y'));

      if (kind === null || typeof targetId !== 'string' || targetId.length === 0) {
        return failure('Choose a target before placing it on the map.', 400);
      }
      if (x === null || y === null) {
        return failure('Place the peg inside the map image and try again.', 400);
      }

      const response = await createScenePeg(
        { id: campaignId, sceneId },
        { kind, targetId, x, y },
        options,
      );
      assertApiOk(response, PEG_CREATE_ERROR);
      return Response.json({ status: 'success' });
    }

    const pegId = formData.get('pegId');

    if (intent === 'move-scene-peg') {
      const x = parseCoordinate(formData.get('x'));
      const y = parseCoordinate(formData.get('y'));

      if (typeof pegId !== 'string' || pegId.length === 0) {
        return failure('Select a peg before moving it.', 400);
      }
      if (x === null || y === null) {
        return failure('Move the peg inside the map image and try again.', 400);
      }

      const response = await updateScenePeg({ id: campaignId, sceneId, pegId }, { x, y }, options);
      assertApiOk(response, PEG_MOVE_ERROR);
      return Response.json({ status: 'success' });
    }

    if (intent === 'delete-scene-peg') {
      if (typeof pegId !== 'string' || pegId.length === 0) {
        return failure('Select a peg before removing it.', 400);
      }

      const response = await deleteScenePeg({ id: campaignId, sceneId, pegId }, options);
      if (response.status !== 'ok' || !response.deleted) {
        return failure(PEG_DELETE_ERROR, 500);
      }
      return Response.json({ status: 'success' });
    }
  } catch (caught) {
    // A duplicate target is not a failure the user must recover from: the peg they wanted already
    // exists, so the workspace selects it instead of stranding an armed placement.
    if (caught instanceof ApiResponseError && caught.code === 'SCENE_PEG_TARGET_ALREADY_PLACED') {
      return Response.json({ status: 'success', data: { duplicateTarget: true } });
    }

    return failure(getApiErrorMessage(caught, intentFallbackMessages[String(intent)] ?? ''), 500);
  }

  return failure('Unsupported map action.', 400);
}

export default function MapRoute() {
  const projection = useLoaderData<typeof loader>();

  return <MapWorkspaceRoot projection={projection} />;
}
