import {
  demoMapCampaignId,
  demoMapCandidates,
  demoSceneDetails,
  demoScenes,
} from './demo-map-data.js';
import { selectSceneId, type MapWorkspaceProjection } from './map-workspace-projection.js';

/** Deterministic and offline: demo Map never calls the scene or upload APIs. */
export function loadDemoMapWorkspaceProjection(requestUrl: string): MapWorkspaceProjection {
  const requestedSceneId = new URL(requestUrl).searchParams.get('scene');
  const selectedSceneId = selectSceneId(demoScenes, requestedSceneId);

  return {
    campaignId: demoMapCampaignId,
    scenes: demoScenes,
    selectedScene: selectedSceneId === null ? null : (demoSceneDetails[selectedSceneId] ?? null),
    candidates: demoMapCandidates,
    apiOnline: true,
    errorMessage: null,
    demoMode: true,
  };
}
