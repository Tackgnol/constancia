import { startTransition, useEffect, useEffectEvent, useRef, useState } from 'react';
import type { ActionFunctionArgs } from 'react-router';
import { useOutletContext } from 'react-router';

import { fireEvent } from '@constancia/api-client/endpoints/events/events';
import { sendPlayerMessage } from '@constancia/api-client/endpoints/messages/messages';
import type { ListEvents200DataItem } from '@constancia/api-client/model';
import { buildServerApiOptions } from '@/lib/api-proxy.server';
import { assertApiOk, getApiErrorMessage } from '@/lib/api-errors';
import { postRouteAction } from '@/lib/route-action-client';
import { handleUploadImageAction } from '@/lib/upload-image-action.server';
import type { TriggerKind, WarRoomContext } from '@/lib/war-room-data';

const HOLD_DURATION_MS = 1800;

const PREVIEW_MAX = 72;

type TriggerView = {
  id: string;
  kind: TriggerKind;
  name: string;
  meta: string;
  scene: string | null;
  sceneLabel: string | null;
  target: string | null;
  preview: string | null;
};

type ArtifactSize = 'standard' | 'half' | 'wide' | 'tall';
type DeliveryViewState = 'not-required' | 'pending' | 'delivered' | 'failed';
type FireReceiptView = {
  eventId: string;
  executionId: string;
  executionStatus: 'completed' | 'failed';
  deliveryStatus: DeliveryViewState;
};
type PendingUndo = {
  id: string;
  name: string;
  target: string | null;
  expiresAt: number;
};

function asStringArray(input: FormDataEntryValue | null): string[] {
  if (typeof input !== 'string' || input.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(input) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string')
      : [];
  } catch {
    return [];
  }
}

function toFireReceiptView(input: unknown): FireReceiptView | null {
  if (typeof input !== 'object' || input === null) {
    return null;
  }

  const receipt = input as Record<string, unknown>;
  if (
    typeof receipt.id !== 'string' ||
    typeof receipt.eventId !== 'string' ||
    (receipt.status !== 'completed' && receipt.status !== 'failed') ||
    !Array.isArray(receipt.deliveries)
  ) {
    return null;
  }

  const deliveryStatuses = receipt.deliveries.flatMap((delivery) => {
    if (
      typeof delivery !== 'object' ||
      delivery === null ||
      !('status' in delivery) ||
      (delivery.status !== 'pending' &&
        delivery.status !== 'delivered' &&
        delivery.status !== 'failed')
    ) {
      return [];
    }

    return [delivery.status];
  });
  if (deliveryStatuses.length !== receipt.deliveries.length) {
    return null;
  }

  const deliveryStatus: DeliveryViewState =
    deliveryStatuses.length === 0
      ? 'not-required'
      : deliveryStatuses.every((status) => status === 'delivered')
        ? 'delivered'
        : deliveryStatuses.some((status) => status === 'pending')
          ? 'pending'
          : 'failed';

  return {
    eventId: receipt.eventId,
    executionId: receipt.id,
    executionStatus: receipt.status,
    deliveryStatus,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'upload-image') {
    return handleUploadImageAction(request, formData);
  }

  const campaignId = formData.get('campaignId');
  const apiOptions = buildServerApiOptions(request);

  if (typeof campaignId !== 'string' || campaignId.length === 0) {
    return Response.json(
      {
        status: 'error',
        message: "We couldn't identify this campaign. Reload Play before firing another event.",
      },
      { status: 400 },
    );
  }

  try {
    if (intent === 'fire-event') {
      const eventId = formData.get('eventId');
      const idempotencyKey = formData.get('idempotencyKey');

      if (
        typeof eventId !== 'string' ||
        eventId.length === 0 ||
        typeof idempotencyKey !== 'string' ||
        idempotencyKey.length === 0
      ) {
        return Response.json(
          {
            status: 'error',
            message: "We couldn't identify this event. Refresh Play, then arm it again.",
          },
          { status: 400 },
        );
      }

      const response = await fireEvent(
        { id: campaignId, eventId },
        {
          ...apiOptions,
          headers: {
            ...apiOptions.headers,
            'idempotency-key': idempotencyKey,
          },
        },
      );
      assertApiOk(
        response,
        "We couldn't confirm this trigger. Check Discord for the result before firing it again.",
      );
      const receipt = toFireReceiptView(response.data);
      if (receipt === null) {
        return Response.json(
          {
            status: 'error',
            message:
              "We couldn't confirm the trigger receipt. Check Discord for the result before firing it again.",
          },
          { status: 502 },
        );
      }

      return Response.json({ status: 'success', data: receipt });
    }

    if (intent === 'send-player-message') {
      const channelId = formData.get('channelId');
      const content = formData.get('content');
      const imageUrl = formData.get('imageUrl');
      const discordUserIds = asStringArray(formData.get('playerIds'));
      const idempotencyKey = formData.get('idempotencyKey');

      if (
        typeof channelId !== 'string' ||
        channelId.length === 0 ||
        typeof content !== 'string' ||
        content.length === 0 ||
        discordUserIds.length === 0 ||
        typeof idempotencyKey !== 'string' ||
        idempotencyKey.length === 0
      ) {
        return Response.json(
          {
            status: 'error',
            message:
              "We couldn't read this whisper. Keep the panel open, review the recipient and message, then try again.",
          },
          { status: 400 },
        );
      }

      const response = await sendPlayerMessage(
        { id: campaignId },
        {
          channelId,
          content,
          discordUserIds,
          ...(typeof imageUrl === 'string' && imageUrl.length > 0 ? { imageUrl } : {}),
        },
        {
          ...apiOptions,
          headers: {
            ...apiOptions.headers,
            'idempotency-key': idempotencyKey,
          },
        },
      );
      assertApiOk(
        response,
        "We couldn't send this whisper. Your message is still in the panel; review it and try again.",
      );

      return Response.json({ status: 'success' });
    }

    return Response.json({ status: 'error', message: 'Unsupported play action.' }, { status: 400 });
  } catch (caught) {
    return Response.json(
      {
        status: 'error',
        message: getApiErrorMessage(
          caught,
          intent === 'send-player-message'
            ? "We couldn't send this whisper. Your message is still in the panel; review it and try again."
            : "We couldn't confirm this trigger. Check Discord for the result before firing it again.",
        ),
      },
      { status: 500 },
    );
  }
}

function truncate(text: string, limit = PREVIEW_MAX) {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length > limit ? `${trimmed.slice(0, limit - 1)}…` : trimmed;
}

function extractTargetAndPreview(
  event: ListEvents200DataItem,
  channelName: string | null,
  playerLabelById: Map<string, string>,
): { target: string | null; preview: string | null } {
  let target: string | null = channelName ? `#${channelName}` : null;
  let preview: string | null = null;

  for (const block of event.pipeline ?? []) {
    const cfg = (block?.config ?? {}) as Record<string, unknown>;

    if (block.blockType === 'message-channel' && typeof cfg.content === 'string' && !preview) {
      preview = cfg.content;
    }
    if (block.blockType === 'display-image' && typeof cfg.caption === 'string' && !preview) {
      preview = cfg.caption;
    }
    if (block.blockType === 'message-player') {
      const ids = Array.isArray(cfg.playerIds) ? (cfg.playerIds as string[]) : [];
      if (ids.length > 0) {
        const labels = ids.map((id) => playerLabelById.get(id) ?? id);
        target = labels.length === 1 ? `→ ${labels[0]}` : `→ ${labels.length} players`;
      }
      if (typeof cfg.content === 'string' && !preview) {
        preview = cfg.content;
      }
    }
    if (block.blockType === 'message-group') {
      const ids = Array.isArray(cfg.groupPlayerIds) ? (cfg.groupPlayerIds as string[]) : [];
      target = ids.length > 0 ? `→ ${ids.length} player group` : target;
      if (typeof cfg.content === 'string' && !preview) {
        preview = cfg.content;
      }
    }
    if (block.blockType === 'conditional-gate') {
      const op =
        cfg.operator === 'gte'
          ? '≥'
          : cfg.operator === 'lte'
            ? '≤'
            : cfg.operator === 'gt'
              ? '>'
              : cfg.operator === 'lt'
                ? '<'
                : '=';
      const stat = typeof cfg.statPath === 'string' ? cfg.statPath.split('.').pop() : '?';
      const threshold = cfg.threshold ?? '?';
      target = `→ players where ${stat} ${op} ${threshold}`;
    }
    if (block.blockType === 'vtm-pool-resolver' && !preview) {
      const attr = typeof cfg.attribute === 'string' ? cfg.attribute : '?';
      const skill = typeof cfg.skill === 'string' ? cfg.skill : '?';
      preview = `${attr} + ${skill}`;
      target = null;
    }
  }

  return { target, preview: preview ? truncate(preview) : null };
}

function getArtifactSize(kind: TriggerKind, index: number, length: number): ArtifactSize {
  if (length < 2) {
    return 'standard';
  }

  if (length === 2) {
    return 'half';
  }

  if (kind === 'narration' && index === 0) {
    return 'wide';
  }

  if (kind === 'test' && length > 2 && index === 0) {
    return 'tall';
  }

  if (kind === 'insight' && length > 2 && index === length - 1) {
    return 'wide';
  }

  if (kind === 'message' && index === 0 && length > 1) {
    return 'wide';
  }

  if (length > 3 && index === 1) {
    return 'wide';
  }

  return 'standard';
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    target.isContentEditable ||
    target.getAttribute('role') === 'textbox'
  );
}

type TriggerSectionView = { id: TriggerKind; title: string; items: TriggerView[] };

const TRIGGER_SECTION_DEFINITIONS: ReadonlyArray<Pick<TriggerSectionView, 'id' | 'title'>> = [
  { id: 'test', title: 'Tests' },
  { id: 'narration', title: 'Narrations' },
  { id: 'insight', title: 'Stat Insights' },
  { id: 'message', title: 'Direct Messages' },
];

function buildTriggerSections(
  events: ListEvents200DataItem[],
  activeTag: string | null,
  channelById: Map<string, WarRoomContext['channels'][number]>,
  tagLabelById: Map<string, string>,
  playerLabelById: Map<string, string>,
): TriggerSectionView[] {
  const sections: TriggerSectionView[] = TRIGGER_SECTION_DEFINITIONS.map((section) => ({
    ...section,
    items: [],
  }));
  const sectionByKind = new Map(sections.map((section) => [section.id, section]));

  for (const event of events) {
    const kind = event.type as TriggerKind;
    const section = sectionByKind.get(kind) ?? sectionByKind.get('message');
    if (!section) continue;
    const channel = event.channelId ? (channelById.get(event.channelId) ?? null) : null;
    const sceneId = channel?.id ?? null;

    if (activeTag && sceneId !== activeTag) continue;

    const { target, preview } = extractTargetAndPreview(
      event,
      channel?.name ?? null,
      playerLabelById,
    );

    section.items.push({
      id: event.id,
      kind,
      name: event.name,
      meta: event.status,
      scene: sceneId,
      sceneLabel: sceneId ? (tagLabelById.get(sceneId) ?? channel?.name ?? sceneId) : null,
      target,
      preview,
    });
  }

  return sections;
}

export default function PlayRoute() {
  const warRoom = useOutletContext<WarRoomContext>();
  const liveEvents = warRoom.events;
  const isDemoMode = warRoom.demoMode ?? warRoom.campaign.id.startsWith('demo-');
  const actionPath = isDemoMode ? '/demo?index' : '/?index';

  const [lastAction, setLastAction] = useState<string | null>(null);
  const [armedItemId, setArmedItemId] = useState<string | null>(null);
  const [errorItemId, setErrorItemId] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const [undoCountdownMs, setUndoCountdownMs] = useState(0);
  const [deliveryByEventId, setDeliveryByEventId] = useState<Record<string, DeliveryViewState>>({});

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const armedItemRef = useRef<string | null>(null);
  const pendingUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fireIdempotencyKeysRef = useRef(new Map<string, string>());

  const channelById = new Map(warRoom.channels.map((c) => [c.id, c]));
  const tagLabelById = new Map(warRoom.tags.map((t) => [t.id, t.label]));
  const playerLabelById = new Map(warRoom.players.map((p) => [p.id, p.name]));

  const sections = buildTriggerSections(
    liveEvents,
    warRoom.activeTag,
    channelById,
    tagLabelById,
    playerLabelById,
  );

  const visibleItems = sections.flatMap((section) => section.items);
  const firedItems = new Set([...(warRoom.firedEventIds ?? []), ...Object.keys(deliveryByEventId)]);
  for (const event of liveEvents) {
    if (event.status === 'fired') firedItems.add(event.id);
  }
  const nextUpItem = visibleItems.find((item) => !firedItems.has(item.id)) ?? null;
  const commandEcho =
    lastAction ??
    (nextUpItem
      ? `${nextUpItem.name} queued${nextUpItem.target ? ` ${nextUpItem.target}` : nextUpItem.sceneLabel ? ` in ${nextUpItem.sceneLabel}` : ''}.`
      : 'Standing by — no commands fired yet.');
  const selectedItem =
    visibleItems.find((item) => item.id === selectedItemId) ?? nextUpItem ?? null;

  useEffect(() => {
    if (pendingUndo === null) {
      setUndoCountdownMs(0);
      return;
    }

    setUndoCountdownMs(Math.max(pendingUndo.expiresAt - Date.now(), 0));
    const intervalId = window.setInterval(() => {
      const remaining = Math.max(pendingUndo.expiresAt - Date.now(), 0);
      setUndoCountdownMs(remaining);
      if (remaining === 0) {
        setPendingUndo(null);
      }
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [pendingUndo]);

  useEffect(() => {
    if (selectedItemId && visibleItems.some((item) => item.id === selectedItemId)) {
      return;
    }

    setSelectedItemId(nextUpItem?.id ?? visibleItems[0]?.id ?? null);
  }, [nextUpItem?.id, selectedItemId, visibleItems]);

  const clearHoldRefs = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    holdTimerRef.current = null;
    holdIntervalRef.current = null;
  };

  const clearUndoRefs = () => {
    if (pendingUndoTimerRef.current) {
      clearTimeout(pendingUndoTimerRef.current);
      pendingUndoTimerRef.current = null;
    }
  };

  const armTrigger = (itemId: string) => {
    setArmedItemId(itemId);
    armedItemRef.current = itemId;
    setErrorItemId(null);
    const item = visibleItems.find((entry) => entry.id === itemId);
    setLastAction(
      item ? `${item.name} armed. Press Enter again to fire or Escape to stand down.` : null,
    );
  };

  const finalizeFire = async (itemId: string) => {
    const item = visibleItems.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }

    try {
      let firedDeliveryStatus: DeliveryViewState | undefined;
      if (!isDemoMode) {
        const idempotencyKey = fireIdempotencyKeysRef.current.get(itemId) ?? crypto.randomUUID();
        fireIdempotencyKeysRef.current.set(itemId, idempotencyKey);
        const result = await postRouteAction<FireReceiptView>(actionPath, {
          intent: 'fire-event',
          campaignId: warRoom.campaign.id,
          eventId: itemId,
          idempotencyKey,
        });

        if (result.status !== 'success') {
          throw new Error(result.message);
        }
        if (result.data === undefined) {
          throw new Error('The frontend action omitted the execution receipt.');
        }

        firedDeliveryStatus = result.data.deliveryStatus;
        setDeliveryByEventId((current) => ({
          ...current,
          [itemId]: result.data?.deliveryStatus ?? 'failed',
        }));
      }

      warRoom.setEventFiredState?.(itemId, true);
      warRoom.recordActivity?.(`${item.name} fired${item.target ? ` ${item.target}` : ''}`);

      startTransition(() => {
        setLastAction(
          firedDeliveryStatus === 'pending'
            ? `${item.name} fired; awaiting Discord delivery.`
            : firedDeliveryStatus === 'failed'
              ? `${item.name} fired; Discord delivery will be retried.`
              : `${item.name} fired.`,
        );
        setSelectedItemId(itemId);
      });

      if (isDemoMode) {
        clearUndoRefs();
        const expiresAt = Date.now() + 5000;
        setPendingUndo({ id: itemId, name: item.name, target: item.target, expiresAt });
        pendingUndoTimerRef.current = setTimeout(() => {
          setPendingUndo(null);
          pendingUndoTimerRef.current = null;
        }, 5000);
      } else {
        setPendingUndo(null);
      }
    } catch (err) {
      console.error('Fire event error:', err);
      setLastAction('Failed to fire event.');
      setErrorItemId(itemId);
    } finally {
      setArmedItemId(null);
      armedItemRef.current = null;
      setHoldProgress(0);
    }
  };

  const handleUndo = () => {
    if (!pendingUndo) {
      return;
    }

    clearUndoRefs();
    warRoom.setEventFiredState?.(pendingUndo.id, false);
    warRoom.recordActivity?.(`${pendingUndo.name} re-armed for correction`);
    setLastAction(`${pendingUndo.name} re-armed.`);
    setSelectedItemId(pendingUndo.id);
    setPendingUndo(null);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, itemId: string) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    setSelectedItemId(itemId);
    armedItemRef.current = itemId;
    setArmedItemId(itemId);
    setErrorItemId(null);

    const startTime = Date.now();
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setHoldProgress(Math.min(elapsed / HOLD_DURATION_MS, 1));
    }, 16);

    holdTimerRef.current = setTimeout(async () => {
      clearHoldRefs();
      const currentItemId = armedItemRef.current;
      armedItemRef.current = null;
      if (!currentItemId) return;
      await finalizeFire(currentItemId);
    }, HOLD_DURATION_MS);
  };

  const handlePointerUp = (itemId: string) => {
    if (armedItemRef.current !== itemId) return;
    clearHoldRefs();
    armedItemRef.current = null;
    setErrorItemId(itemId);
    setLastAction('Hold cancelled — hold longer to fire.');
    setArmedItemId(null);
    setHoldProgress(0);
  };

  const handleGlobalKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) {
      return;
    }

    const visibleItemIds = visibleItems.map((item) => item.id);
    if ((event.key === '?' || (event.key === '/' && event.shiftKey)) && !event.metaKey) {
      event.preventDefault();
      setShortcutsOpen((current) => !current);
      return;
    }

    if (event.key === 'Escape') {
      if (shortcutsOpen) {
        event.preventDefault();
        setShortcutsOpen(false);
        return;
      }

      if (armedItemId) {
        event.preventDefault();
        clearHoldRefs();
        armedItemRef.current = null;
        setArmedItemId(null);
        setHoldProgress(0);
        setLastAction('Command stood down.');
      }
      return;
    }

    if (visibleItemIds.length === 0) {
      return;
    }

    const currentIndex = selectedItem ? visibleItemIds.indexOf(selectedItem.id) : 0;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = (currentIndex + 1 + visibleItemIds.length) % visibleItemIds.length;
      setSelectedItemId(visibleItemIds[nextIndex]);
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = (currentIndex - 1 + visibleItemIds.length) % visibleItemIds.length;
      setSelectedItemId(visibleItemIds[nextIndex]);
      return;
    }

    if ((event.key === 'u' || event.key === 'U') && pendingUndo) {
      event.preventDefault();
      handleUndo();
      return;
    }

    if (event.key !== 'Enter' || !selectedItem || firedItems.has(selectedItem.id)) {
      return;
    }

    event.preventDefault();
    if (armedItemId === selectedItem.id) {
      void finalizeFire(selectedItem.id);
      return;
    }

    armTrigger(selectedItem.id);
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      handleGlobalKeyDown(event);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="play-route">
      <section className="last-action-banner">
        <span className="eyebrow">Command Echo</span>
        <p key={lastAction} className="command-echo-text">
          {commandEcho}
        </p>
      </section>

      {pendingUndo ? (
        <section className="undo-banner" aria-live="polite">
          <div>
            <p className="eyebrow">Undo window</p>
            <p className="undo-copy">
              {pendingUndo.name} just fired. Retract the cue within{' '}
              {Math.max(1, Math.ceil(undoCountdownMs / 1000))}s if it was a misfire.
            </p>
          </div>
          <button className="undo-button" onClick={handleUndo} type="button">
            Undo misfire
          </button>
        </section>
      ) : null}

      {shortcutsOpen ? (
        <section className="shortcut-panel">
          <div className="shortcut-panel-header">
            <div>
              <p className="eyebrow">Keyboard guide</p>
              <h2>Run the board without hunting.</h2>
            </div>
            <button
              className="ghost-action ghost-action-inline"
              onClick={() => setShortcutsOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>
          <div className="shortcut-grid">
            <div className="shortcut-row">
              <span className="shortcut-key">?</span>
              <span className="shortcut-copy">Open or close this legend.</span>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-key">← ↑ ↓ →</span>
              <span className="shortcut-copy">Move the active selection across staged beats.</span>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-key">Enter</span>
              <span className="shortcut-copy">
                Arm the selected beat, then press again to fire.
              </span>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-key">Esc</span>
              <span className="shortcut-copy">Stand down the armed beat or close the legend.</span>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-key">U</span>
              <span className="shortcut-copy">
                Undo the latest demo misfire while the retract window is live.
              </span>
            </div>
          </div>
        </section>
      ) : null}

      {visibleItems.length === 0 ? (
        <section className="detail-card board-empty-state">
          <h2>No staged beats for this thread.</h2>
          <p>
            This channel does not have a ready trigger yet. Clear the filter or stage a fresh beat
            in Setup.
          </p>
        </section>
      ) : null}

      {sections.map((section) => {
        if (section.items.length === 0) return null;

        return (
          <section key={section.id} className="board-section">
            <header className="board-section-header">{section.title}</header>

            <div className="board-grid">
              {section.items.map((item) => {
                const isFired = firedItems.has(item.id);
                const deliveryStatus = deliveryByEventId[item.id];
                const isArmed = armedItemId === item.id && !isFired;
                const hasError = errorItemId === item.id && !isFired;
                const isNextUp = nextUpItem?.id === item.id && !isArmed && !isFired && !hasError;
                const artifactSize = getArtifactSize(
                  section.id,
                  section.items.indexOf(item),
                  section.items.length,
                );

                return (
                  <button
                    key={item.id}
                    className={`trigger-card is-${item.kind} is-${artifactSize}${isFired ? ' is-fired' : ''}${isArmed ? ' is-armed' : ''}${hasError ? ' is-error' : ''}${isNextUp ? ' is-next-up' : ''}${selectedItem?.id === item.id ? ' is-selected' : ''}`}
                    onFocus={() => setSelectedItemId(item.id)}
                    onPointerDown={(e) => {
                      if (!isFired) handlePointerDown(e, item.id);
                    }}
                    onPointerUp={() => handlePointerUp(item.id)}
                    type="button"
                  >
                    <span className="trigger-type-row">
                      <span className="trigger-type">
                        {item.kind === 'message' ? 'DM' : item.kind}
                      </span>
                      {item.sceneLabel ? (
                        <span className="trigger-scene">{item.sceneLabel}</span>
                      ) : null}
                    </span>
                    <strong className="trigger-name">{item.name}</strong>
                    {item.target ? <span className="trigger-target">{item.target}</span> : null}
                    {item.preview ? (
                      <span className="trigger-preview">{item.preview}</span>
                    ) : (
                      <span className="trigger-meta">{item.meta}</span>
                    )}
                    {!isFired && !isArmed ? (
                      <span className="trigger-gesture-hint">Hold 1s · Enter twice</span>
                    ) : null}
                    {isFired ? (
                      <span className="trigger-flag">
                        {deliveryStatus === 'pending'
                          ? 'Awaiting Discord'
                          : deliveryStatus === 'failed'
                            ? 'Delivery retrying'
                            : deliveryStatus === 'delivered'
                              ? 'Delivered'
                              : 'Fired'}
                      </span>
                    ) : isNextUp ? (
                      <span className="trigger-flag is-next-up-flag">Next up</span>
                    ) : isArmed ? (
                      <span className="trigger-flag">Hold to fire</span>
                    ) : hasError ? (
                      <span className="trigger-flag is-error-flag">Cancelled</span>
                    ) : null}
                    {isArmed ? (
                      <span
                        className="trigger-progress"
                        style={
                          {
                            '--progress': holdProgress,
                          } as React.CSSProperties
                        }
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
