import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { ActionFunctionArgs } from 'react-router';
import {
  Link,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
  useRevalidator,
} from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createEvent,
  deleteEvent,
  updateEvent,
} from '@constancia/api-client/endpoints/events/events';
import type {
  CreateEventBody,
  ListEvents200DataItem,
  UpdateEventBody,
} from '@constancia/api-client/model';
import { ManagementWorkspace } from '@/components/layout/management-workspace';
import { EventSetupForm } from '@/components/setup/event-setup-form';
import { buildServerApiOptions } from '@/lib/api-proxy.server';
import { postRouteAction } from '@/lib/route-action-client';
import { SetupNotice } from '@/components/setup/setup-notice';
import { assertApiOk, getApiErrorMessage } from '@/lib/api-errors';
import { handleUploadImageAction } from '@/lib/upload-image-action.server';
import {
  BLOCK_TYPES,
  EVENT_TYPES,
  eventFormSchema,
  getDefaultPipelineForEventType,
  normalizeEventFormValues,
  type EventFormValues,
  type PipelineBlock,
} from '@/lib/event-schema';
import type { WarRoomContext } from '@/lib/war-room-data';

const eventSaveError =
  "We couldn't save this event. Your pipeline is still in the editor; review the highlighted fields and try again.";
const eventDeleteError =
  "We couldn't delete this event. It remains on the board; reopen it from Setup and try again.";

function getSetupBase(warRoom: WarRoomContext) {
  return warRoom.demoMode ? '/demo/setup' : '/setup';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEventType(value: string): value is EventFormValues['type'] {
  return EVENT_TYPES.includes(value as EventFormValues['type']);
}

function isPipelineBlockType(value: string): value is PipelineBlock['blockType'] {
  return BLOCK_TYPES.includes(value as PipelineBlock['blockType']);
}

function normalizeOutcomeConfig(config: Record<string, unknown>): Record<string, unknown> {
  const outcomes = config.outcomes;
  if (!Array.isArray(outcomes)) {
    return config;
  }

  return {
    ...config,
    outcomes: outcomes.map((entry) => {
      if (!isRecord(entry) || 'threshold' in entry || !('minScore' in entry)) {
        return entry;
      }

      return {
        threshold: entry.minScore,
        text: entry.text,
      };
    }),
  };
}

function normalizeEventPipeline(event: ListEvents200DataItem): PipelineBlock[] {
  const type = isEventType(event.type) ? event.type : 'narration';
  if (!Array.isArray(event.pipeline)) {
    return getDefaultPipelineForEventType(type);
  }

  const pipeline = event.pipeline.flatMap((block): PipelineBlock[] => {
    if (!isRecord(block) || typeof block.blockType !== 'string') {
      return [];
    }

    if (!isPipelineBlockType(block.blockType)) {
      return [];
    }

    return [
      {
        blockType: block.blockType,
        config:
          isRecord(block.config) && block.blockType === 'outcome-map'
            ? normalizeOutcomeConfig(block.config)
            : isRecord(block.config)
              ? block.config
              : {},
      },
    ];
  });

  return pipeline.length > 0 ? pipeline : getDefaultPipelineForEventType(type);
}

function eventToFormValues(event: ListEvents200DataItem): EventFormValues {
  const type = isEventType(event.type) ? event.type : 'narration';

  return {
    name: event.name,
    type,
    channelId: event.channelId,
    shortCircuit: event.shortCircuit,
    pipeline: normalizeEventPipeline(event),
  };
}

function emptyEventValues(): EventFormValues {
  return {
    name: '',
    type: 'narration',
    channelId: '',
    shortCircuit: false,
    pipeline: getDefaultPipelineForEventType('narration'),
  };
}

function parseEventPayload(
  input: FormDataEntryValue | null,
): CreateEventBody | UpdateEventBody | null {
  if (typeof input !== 'string' || input.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(input) as unknown;
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as CreateEventBody | UpdateEventBody)
      : null;
  } catch {
    return null;
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const campaignId = formData.get('campaignId');
  const eventId = formData.get('eventId');
  const payload = parseEventPayload(formData.get('payload'));
  const apiOptions = buildServerApiOptions(request);

  try {
    if (intent === 'upload-image') {
      return handleUploadImageAction(request, formData);
    }

    if (typeof campaignId !== 'string' || campaignId.length === 0) {
      return Response.json(
        {
          status: 'error',
          message: "We couldn't identify this campaign. Return to Setup and reopen the event.",
        },
        { status: 400 },
      );
    }

    if (intent === 'delete-event') {
      if (typeof eventId !== 'string' || eventId.length === 0) {
        return Response.json(
          {
            status: 'error',
            message: "We couldn't identify this event. Return to Setup and open it again.",
          },
          { status: 400 },
        );
      }

      const response = await deleteEvent({ id: campaignId, eventId }, apiOptions);
      assertApiOk(response, eventDeleteError);
      return Response.json({ status: 'success' });
    }

    if (!payload) {
      return Response.json(
        {
          status: 'error',
          message: "We couldn't read this event draft. Review the highlighted fields and retry.",
        },
        { status: 400 },
      );
    }

    if (typeof eventId === 'string' && eventId.length > 0) {
      const response = await updateEvent(
        { id: campaignId, eventId },
        payload as UpdateEventBody,
        apiOptions,
      );
      assertApiOk(response, eventSaveError);
    } else {
      const response = await createEvent(
        { id: campaignId },
        payload as CreateEventBody,
        apiOptions,
      );
      assertApiOk(response, eventSaveError);
    }

    return Response.json({ status: 'success' });
  } catch (caught) {
    return Response.json(
      {
        status: 'error',
        message: getApiErrorMessage(caught, eventSaveError),
      },
      { status: 500 },
    );
  }
}

export default function SetupEventRoute() {
  const warRoom = useOutletContext<WarRoomContext>();
  const { eventId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const setupBase = getSetupBase(warRoom);
  const isDemoCampaign = warRoom.campaign.id.startsWith('demo-');
  const editingEvent = useMemo(
    () => warRoom.events.find((event) => event.id === eventId) ?? null,
    [eventId, warRoom.events],
  );
  const isEditing = Boolean(eventId);
  const [savedEvent, setSavedEvent] = useState<EventFormValues | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);

  const eventMethods = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: editingEvent ? eventToFormValues(editingEvent) : emptyEventValues(),
  });

  const onSubmitEvent = async (values: EventFormValues) => {
    try {
      setEventError(null);
      eventMethods.clearErrors('root');
      const normalizedValues = normalizeEventFormValues(values);

      if (!isDemoCampaign) {
        const response = await postRouteAction(location.pathname, {
          campaignId: warRoom.campaign.id,
          eventId: eventId ?? '',
          payload: JSON.stringify(normalizedValues),
        });

        if (response.status !== 'success') {
          throw new Error(response.message);
        }

        await revalidator.revalidate();
      }

      setSavedEvent(normalizedValues);
      if (!isEditing) {
        eventMethods.reset(emptyEventValues());
      }
    } catch (err) {
      console.error('Save event error:', err);
      const message = getApiErrorMessage(err, eventSaveError);
      eventMethods.setError('root.serverError', { type: 'manual', message });
      setEventError(message);
    }
  };

  const removeEvent = async () => {
    if (!isEditing || !eventId) {
      return;
    }

    try {
      setEventError(null);
      eventMethods.clearErrors('root');

      if (!isDemoCampaign) {
        const response = await postRouteAction(location.pathname, {
          intent: 'delete-event',
          campaignId: warRoom.campaign.id,
          eventId,
        });

        if (response.status !== 'success') {
          throw new Error(response.message);
        }

        revalidator.revalidate();
      }

      const message = `Event removed: ${editingEvent?.name ?? eventId}`;
      warRoom.recordActivity?.(message);
      navigate(setupBase);
    } catch (err) {
      console.error('Delete event error:', err);
      const message = getApiErrorMessage(err, eventDeleteError);
      eventMethods.setError('root.serverError', { type: 'manual', message });
      setEventError(message);
    }
  };

  return (
    <ManagementWorkspace
      eyebrow="Setup / Events"
      title={isEditing ? 'Revise a staged move' : 'Queue the next move'}
      description={
        isEditing
          ? 'Edit the event through its URL, then return to Play when the move is ready.'
          : 'Build a focused event without loading the live control board with editor state.'
      }
      meta={
        <div className="setup-hero-note">
          <p className="detail-label">{isEditing ? 'Editing' : 'New event'}</p>
          <p>{editingEvent ? editingEvent.name : 'Draft the trigger now; fire it from Play.'}</p>
        </div>
      }
    >
      <div className="setup-back-row">
        <Link className="setup-inline-link" to={setupBase}>
          Back to setup
        </Link>
        <Link className="setup-inline-link" to={warRoom.demoMode ? '/demo' : '/'}>
          Open play board
        </Link>
      </div>

      {isEditing && !editingEvent ? (
        <SetupNotice label="Event not found" tone="error">
          <span>This event is not present in the current campaign payload.</span>
        </SetupNotice>
      ) : null}

      {savedEvent ? (
        <SetupNotice label={isEditing ? 'Event updated' : 'Event staged'}>
          <strong>{savedEvent.name}</strong>
          <span>
            {savedEvent.pipeline.length} action{savedEvent.pipeline.length !== 1 ? 's' : ''} ready.
          </span>
        </SetupNotice>
      ) : null}

      {eventError ? (
        <SetupNotice label="Event staging failed" tone="error">
          <span>{eventError}</span>
        </SetupNotice>
      ) : null}

      {!isEditing || editingEvent ? (
        <section className="setup-panel">
          <EventSetupForm
            methods={eventMethods}
            channels={warRoom.channels}
            onSubmit={onSubmitEvent}
            submitLabel={isEditing ? 'Save event' : 'Create event'}
          />
          {isEditing ? (
            <div className="form-actions">
              <button
                className="ghost-action ghost-action-inline"
                type="button"
                onClick={() => void removeEvent()}
              >
                Delete event
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </ManagementWorkspace>
  );
}
