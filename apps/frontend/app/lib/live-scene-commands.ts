import { useState } from 'react';
import { useNavigate, useRevalidator } from 'react-router';
import type { FireReceiptView } from './fire-event-receipt.js';
import {
  buildSceneMapPath,
  nextSceneAfterRemoval,
  type MapWorkspaceProjection,
  type SceneCommands,
  type SceneDetailProjection,
  type SceneSummaryProjection,
} from './map-workspace-projection.js';
import { postRouteAction } from './route-action-client.js';

interface UploadQuota {
  uploadRemainingBytes: number;
  uploadUsagePercent: number;
  uploadNearLimit: boolean;
}

interface MapActionData {
  sceneId?: string;
  name?: string;
  quota?: UploadQuota;
  duplicateTarget?: boolean;
  receipt?: FireReceiptView;
}

function formatQuotaWarning(quota: UploadQuota | undefined): string | null {
  if (!quota?.uploadNearLimit) {
    return null;
  }

  const remainingMb = Math.max(quota.uploadRemainingBytes, 0) / (1024 * 1024);
  return `Upload allowance is ${quota.uploadUsagePercent}% used. About ${remainingMb.toFixed(1)} MB remain.`;
}

/**
 * The live implementation of `SceneCommands`: every mutation posts to the Map route action, which
 * resolves the current campaign server-side, and a successful mutation revalidates the loader
 * (or navigates, for operations that change which scene is selected) so `MapWorkspaceProjection`
 * stays the single source of read-side truth.
 */
export function useLiveSceneCommands(projection: MapWorkspaceProjection): {
  commands: SceneCommands;
  scenes: SceneSummaryProjection[];
  selectedScene: SceneDetailProjection | null;
} {
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [quotaWarning, setQuotaWarning] = useState<string | null>(null);
  const clearError = () => setError(null);

  const runLive = async (
    values: Record<string, FormDataEntryValue>,
    onDone: (data: MapActionData | undefined) => Promise<void> | void,
    successMessage?: string,
  ): Promise<boolean> => {
    setPending(true);
    setError(null);
    setStatus(null);
    try {
      const response = await postRouteAction<MapActionData>('/map', values);

      if (response.status !== 'success') {
        setError(response.message);
        return false;
      }

      setQuotaWarning(formatQuotaWarning(response.data?.quota));
      setStatus(
        response.data?.duplicateTarget === true
          ? 'That target already had a peg here, so we selected it.'
          : (successMessage ?? null),
      );
      await onDone(response.data);
      return true;
    } finally {
      setPending(false);
    }
  };

  return {
    scenes: projection.scenes,
    selectedScene: projection.selectedScene,
    commands: {
      pending,
      error,
      status,
      quotaWarning,
      clearError,
      create: (name) =>
        runLive({ intent: 'create-scene', name }, async (data) => {
          // The backend normalizes the name; the announcement uses that, not the raw input.
          setStatus(`Scene "${data?.name ?? name}" created.`);
          await navigate(buildSceneMapPath(false, data?.sceneId ?? null));
        }),
      rename: (sceneId, name) =>
        runLive({ intent: 'rename-scene', sceneId, name }, (data) => {
          setStatus(`Scene renamed to "${data?.name ?? name}".`);
          revalidator.revalidate();
        }),
      remove: (sceneId) =>
        runLive(
          { intent: 'delete-scene', sceneId },
          async () => {
            await navigate(
              buildSceneMapPath(false, nextSceneAfterRemoval(projection.scenes, sceneId)),
            );
          },
          'Scene deleted. Its targets were kept.',
        ),
      replaceMap: (sceneId, file) =>
        runLive({ intent: 'replace-scene-map', sceneId, file }, () => {
          revalidator.revalidate();
        }),
      removeMap: (sceneId) =>
        runLive(
          { intent: 'delete-scene-map', sceneId },
          () => {
            revalidator.revalidate();
          },
          'Map removed. Peg positions were kept.',
        ),
      createPeg: (sceneId, candidate, point) =>
        runLive(
          {
            intent: 'create-scene-peg',
            sceneId,
            kind: candidate.kind,
            targetId: candidate.id,
            x: String(point.x),
            y: String(point.y),
          },
          () => {
            revalidator.revalidate();
          },
          `${candidate.label} placed.`,
        ),
      movePeg: (sceneId, pegId, point) =>
        runLive(
          { intent: 'move-scene-peg', sceneId, pegId, x: String(point.x), y: String(point.y) },
          () => {
            revalidator.revalidate();
          },
          'Peg moved.',
        ),
      removePeg: (sceneId, pegId) =>
        runLive(
          { intent: 'delete-scene-peg', sceneId, pegId },
          () => {
            revalidator.revalidate();
          },
          'Peg removed.',
        ),
      fireEvent: async (attempt) => {
        let fired: FireReceiptView | null = null;
        await runLive(
          {
            intent: 'fire-event',
            eventId: attempt.eventId,
            idempotencyKey: attempt.idempotencyKey,
          },
          (data) => {
            fired = data?.receipt ?? null;
          },
        );

        return fired;
      },
    },
  };
}
