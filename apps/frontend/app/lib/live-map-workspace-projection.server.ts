import { listEvents } from '@constancia/api-client/endpoints/events/events';
import { listLoreEntries } from '@constancia/api-client/endpoints/lore/lore';
import { listNpcs } from '@constancia/api-client/endpoints/npcs/npcs';
import { getScene, listScenes } from '@constancia/api-client/endpoints/scenes/scenes';
import type { GetScene200Data, ListScenes200DataItem } from '@constancia/api-client/model';
import { buildServerApiOptions, resolveCurrentCampaignId } from './api-proxy.server.js';
import {
  assembleScenePeg,
  noMapCandidates,
  selectSceneId,
  unavailableMapWorkspace,
  type MapCandidate,
  type MapWorkspaceProjection,
  type SceneDetailProjection,
  type ScenePegProjection,
  type SceneSummaryProjection,
} from './map-workspace-projection.js';

const NO_CAMPAIGN_MESSAGE =
  'No campaign is connected yet. Finish Setup, then return to build your maps.';
const API_UNAVAILABLE_MESSAGE =
  "We couldn't reach the scene service. Your maps are safe; refresh to try again.";

/**
 * Orval names inline oneOf branches positionally, so peg types are read back off the response
 * rather than imported by name — those names shift whenever endpoints are added.
 */
type ApiScenePeg = GetScene200Data['pegs'][number];

function toSceneSummary(scene: ListScenes200DataItem): SceneSummaryProjection {
  return {
    id: scene.id,
    name: scene.name,
    hasMap: scene.hasMap,
    pegCount: scene.pegCount,
  };
}

function toScenePeg(peg: ApiScenePeg): ScenePegProjection {
  return assembleScenePeg(peg.id, { x: peg.x, y: peg.y }, peg);
}

function toSceneDetail(scene: GetScene200Data): SceneDetailProjection {
  return {
    id: scene.id,
    name: scene.name,
    mapUrl: scene.mapUrl ?? null,
    pegs: scene.pegs.map(toScenePeg),
  };
}

export async function loadLiveMapWorkspaceProjection(
  request: Request,
): Promise<MapWorkspaceProjection> {
  const campaignId = await resolveCurrentCampaignId(request);
  if (campaignId === null) {
    return unavailableMapWorkspace(false, NO_CAMPAIGN_MESSAGE);
  }

  const options = buildServerApiOptions(request);
  const scenesResponse = await listScenes({ id: campaignId }, options);
  if (scenesResponse.status !== 'ok') {
    return unavailableMapWorkspace(false, API_UNAVAILABLE_MESSAGE);
  }

  const scenes = scenesResponse.data.map(toSceneSummary);
  const requestedSceneId = new URL(request.url).searchParams.get('scene');
  const selectedSceneId = selectSceneId(scenes, requestedSceneId);

  if (selectedSceneId === null) {
    return {
      campaignId,
      scenes,
      selectedScene: null,
      candidates: noMapCandidates,
      errorMessage: null,
      demoMode: false,
    };
  }

  const [sceneResponse, eventsResponse, npcsResponse, loreResponse] = await Promise.all([
    getScene({ id: campaignId, sceneId: selectedSceneId }, options),
    listEvents({ id: campaignId }, options),
    listNpcs({ id: campaignId }, options),
    listLoreEntries({ id: campaignId }, options),
  ]);

  const events: MapCandidate[] =
    eventsResponse.status === 'ok'
      ? eventsResponse.data.map((event) => ({ id: event.id, kind: 'event', label: event.name }))
      : [];
  const npcs: MapCandidate[] =
    npcsResponse.status === 'ok'
      ? npcsResponse.data.map((npc) => ({ id: npc.id, kind: 'npc', label: npc.name }))
      : [];
  const lore: MapCandidate[] =
    loreResponse.status === 'ok'
      ? loreResponse.data.map((entry) => ({ id: entry.id, kind: 'lore', label: entry.title }))
      : [];

  return {
    campaignId,
    scenes,
    // A scene deleted by another request between the two calls simply reads as no selection.
    selectedScene: sceneResponse.status === 'ok' ? toSceneDetail(sceneResponse.data) : null,
    candidates: { events, npcs, lore },
    errorMessage: null,
    demoMode: false,
  };
}
