import {
  createScene,
  deleteScene,
  updateScene,
} from '@constancia/api-client/endpoints/scenes/scenes';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { MapWorkspace } from '@/components/maps/map-workspace';
import { assertApiOk, getApiErrorMessage } from '@/lib/api-errors';
import { buildServerApiOptions } from '@/lib/api-proxy.server';
import { loadDemoMapWorkspaceProjection } from '@/lib/demo-map-workspace-projection';
import { loadLiveMapWorkspaceProjection } from '@/lib/live-map-workspace-projection.server';

const SCENE_CREATE_ERROR =
  "We couldn't create that scene. Your name is still in the form; try again.";
const SCENE_RENAME_ERROR = "We couldn't rename that scene. Its current name is unchanged.";
const SCENE_DELETE_ERROR = "We couldn't delete that scene. It and its pegs are unchanged.";

export async function loader({ request }: LoaderFunctionArgs) {
  if (new URL(request.url).pathname.startsWith('/demo/')) {
    return loadDemoMapWorkspaceProjection(request.url);
  }

  return loadLiveMapWorkspaceProjection(request);
}

function failure(message: string, status: number) {
  return Response.json({ status: 'error', message }, { status });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const campaignId = formData.get('campaignId');

  if (typeof campaignId !== 'string' || campaignId.length === 0) {
    return failure('Reopen Map so we can identify your campaign, then try again.', 400);
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
      return Response.json({ status: 'success', data: { sceneId: response.data.id } });
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
      return Response.json({ status: 'success', data: { sceneId } });
    }

    if (intent === 'delete-scene') {
      const response = await deleteScene({ id: campaignId, sceneId }, options);
      if (response.status !== 'ok' || !response.deleted) {
        return failure(SCENE_DELETE_ERROR, 500);
      }
      return Response.json({ status: 'success' });
    }
  } catch (caught) {
    const fallback =
      intent === 'create-scene'
        ? SCENE_CREATE_ERROR
        : intent === 'rename-scene'
          ? SCENE_RENAME_ERROR
          : SCENE_DELETE_ERROR;
    return failure(getApiErrorMessage(caught, fallback), 500);
  }

  return failure('Unsupported map action.', 400);
}

export default function MapRoute() {
  const projection = useLoaderData<typeof loader>();

  return <MapWorkspace projection={projection} />;
}
