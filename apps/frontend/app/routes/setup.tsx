import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useOutletContext, useRevalidator } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { createEvent, updateEvent } from '@constancia/api-client/endpoints/events/events';
import type {
  CreateEventBody,
  ListEvents200DataItem,
  UpdateEventBody,
} from '@constancia/api-client/model';
import { EventSetupForm } from '@/components/setup/event-setup-form';
import { SetupNotice } from '@/components/setup/setup-notice';
import { SetupNpcForm } from '@/components/npcs/setup-npc-form';
import {
  BLOCK_TYPES,
  EVENT_TYPES,
  eventFormSchema,
  getDefaultPipelineForEventType,
  normalizeEventFormValues,
  type PipelineBlock,
  type EventFormValues,
} from '@/lib/event-schema';
import type { WarRoomContext } from '@/lib/war-room-data';

type SetupStep = 'event' | 'dossier';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEventType(value: string): value is EventFormValues['type'] {
  return EVENT_TYPES.includes(value as EventFormValues['type']);
}

function isPipelineBlockType(value: string): value is PipelineBlock['blockType'] {
  return BLOCK_TYPES.includes(value as PipelineBlock['blockType']);
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
        config: isRecord(block.config) ? block.config : {},
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

export default function SetupRoute() {
  const warRoom = useOutletContext<WarRoomContext>();
  const revalidator = useRevalidator();
  const isDemoCampaign = warRoom.campaign.id.startsWith('demo-');
  const [savedEvent, setSavedEvent] = useState<EventFormValues | null>(null);
  const [savedEventMode, setSavedEventMode] = useState<'created' | 'updated'>('created');
  const [eventError, setEventError] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [savedNpc, setSavedNpc] = useState<{ name: string; factCount: number } | null>(null);
  const [npcError, setNpcError] = useState<string | null>(null);
  const [step, setStep] = useState<SetupStep>('event');

  const eventMethods = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: '',
      type: 'narration',
      channelId: '',
      shortCircuit: false,
      pipeline: getDefaultPipelineForEventType('narration'),
    },
  });

  const editingEvent = warRoom.events.find((event) => event.id === editingEventId) ?? null;

  const startEventEdit = (event: ListEvents200DataItem) => {
    setEventError(null);
    setSavedEvent(null);
    setEditingEventId(event.id);
    setStep('event');
    eventMethods.clearErrors();
    eventMethods.reset(eventToFormValues(event));
  };

  const cancelEventEdit = () => {
    setEditingEventId(null);
    setEventError(null);
    eventMethods.clearErrors();
    eventMethods.reset({
      name: '',
      type: 'narration',
      channelId: '',
      shortCircuit: false,
      pipeline: getDefaultPipelineForEventType('narration'),
    });
  };

  const onSubmitEvent = async (values: EventFormValues) => {
    try {
      setEventError(null);
      eventMethods.clearErrors('root');
      const normalizedValues = normalizeEventFormValues(values);
      const isEditing = editingEventId !== null;

      if (!isDemoCampaign) {
        if (isEditing) {
          await updateEvent(
            { id: warRoom.campaign.id, eventId: editingEventId },
            normalizedValues as UpdateEventBody,
            { credentials: 'include' },
          );
        } else {
          await createEvent({ id: warRoom.campaign.id }, normalizedValues as CreateEventBody, {
            credentials: 'include',
          });
        }
        revalidator.revalidate();
      }

      setSavedEventMode(isEditing ? 'updated' : 'created');
      setSavedEvent(normalizedValues);
      setEditingEventId(null);
      eventMethods.reset({
        name: '',
        type: 'narration',
        channelId: '',
        shortCircuit: false,
        pipeline: getDefaultPipelineForEventType('narration'),
      });
    } catch (err) {
      console.error('Save event error:', err);
      const message = editingEventId
        ? 'The event dossier did not update cleanly. Try again in a moment.'
        : 'The event dossier did not stage cleanly. Try again in a moment.';
      eventMethods.setError('root.serverError', { type: 'manual', message });
      setEventError(message);
    }
  };

  return (
    <div className="mode-route">
      <section className="hero-strip hero-strip-compact setup-hero">
        <div>
          <p className="eyebrow">Setup</p>
          <h1>Stage the next pressure point.</h1>
          <p className="hero-copy">
            Build beats for the room, then pin the faces and secrets that will matter when the
            coterie leans the wrong way.
          </p>
        </div>
        <div className="setup-hero-note">
          <p className="detail-label">Operator note</p>
          <p>
            Keep dossiers terse. If a portrait matters, host it on Imgur or a similar service and
            paste the direct image URL — no uploads in the war room.
          </p>
        </div>
      </section>

      <nav className="setup-steps" aria-label="Setup steps">
        <button
          aria-current={step === 'event' ? 'step' : undefined}
          className={`setup-step${step === 'event' ? ' is-active' : ''}`}
          onClick={() => setStep('event')}
          type="button"
        >
          <span className="setup-step-index">01</span>
          <span className="setup-step-label">Stage event</span>
        </button>
        <button
          aria-current={step === 'dossier' ? 'step' : undefined}
          className={`setup-step${step === 'dossier' ? ' is-active' : ''}`}
          onClick={() => setStep('dossier')}
          type="button"
        >
          <span className="setup-step-index">02</span>
          <span className="setup-step-label">Pin dossier</span>
        </button>
      </nav>

      {step === 'event' ? (
        <section className="setup-panel">
          <div className="setup-panel-header">
            <div>
              <p className="eyebrow">Event staging</p>
              <h2>{editingEvent ? 'Revise a staged move' : 'Queue the next move'}</h2>
            </div>
            <p className="form-hint">
              {editingEvent
                ? `Editing ${editingEvent.name}. Save it before firing from Play.`
                : 'Draft the trigger now; fire it when the table is ready.'}
            </p>
          </div>

          {savedEvent ? (
            <SetupNotice label={savedEventMode === 'updated' ? 'Event updated' : 'Event staged'}>
              <strong>{savedEvent.name}</strong>
              <span>
                {savedEvent.pipeline.length} block{savedEvent.pipeline.length !== 1 ? 's' : ''} are
                ready.
              </span>
              <button
                className="setup-inline-link"
                onClick={() => setStep('dossier')}
                type="button"
              >
                Next: pin a dossier →
              </button>
            </SetupNotice>
          ) : null}

          {eventError ? (
            <SetupNotice label="Event staging failed" tone="error">
              <span>{eventError}</span>
            </SetupNotice>
          ) : null}

          <EventSetupForm
            methods={eventMethods}
            channels={warRoom.channels}
            onSubmit={onSubmitEvent}
            submitLabel={editingEvent ? 'Update Event' : 'Save Event'}
          />

          {editingEvent ? (
            <button className="setup-inline-link" onClick={cancelEventEdit} type="button">
              Cancel edit
            </button>
          ) : null}

          {warRoom.events.length > 0 ? (
            <section className="setup-subsection">
              <div className="setup-subsection-header">
                <div>
                  <p className="eyebrow">Existing events</p>
                  <h3>Patch the board before the table sees it.</h3>
                </div>
              </div>
              <div className="event-edit-list">
                {warRoom.events.map((event) => {
                  const channel = warRoom.channels.find((entry) => entry.id === event.channelId);
                  return (
                    <button
                      key={event.id}
                      className={`event-edit-row${editingEventId === event.id ? ' is-active' : ''}`}
                      onClick={() => startEventEdit(event)}
                      type="button"
                    >
                      <span className="event-edit-kind">{event.type}</span>
                      <span className="event-edit-name">{event.name}</span>
                      <span className="event-edit-meta">
                        {channel ? `# ${channel.name}` : event.channelId} · {event.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </section>
      ) : (
        <section className="setup-panel">
          <div className="setup-panel-header">
            <div>
              <p className="eyebrow">NPC dossier</p>
              <h2>Pin a face to the board</h2>
            </div>
            <p className="form-hint">
              Facts become revealable on the NPC screen, where you can mark exactly which players
              know what.
            </p>
          </div>

          {savedNpc ? (
            <SetupNotice label="Dossier added">
              <strong>{savedNpc.name}</strong>
              <span>
                {savedNpc.factCount} fact{savedNpc.factCount !== 1 ? 's' : ''} filed for reveal.
              </span>
              <Link className="setup-inline-link" to="/npcs">
                Review dossiers
              </Link>
            </SetupNotice>
          ) : null}

          {npcError ? (
            <SetupNotice label="Dossier failed" tone="error">
              <span>{npcError}</span>
            </SetupNotice>
          ) : null}

          <SetupNpcForm
            campaignId={warRoom.campaign.id}
            systemId={warRoom.system.id}
            isDemoCampaign={isDemoCampaign}
            onSuccess={setSavedNpc}
            onError={setNpcError}
          />
        </section>
      )}
    </div>
  );
}
