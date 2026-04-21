import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useOutletContext } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { createEvent } from '@/api/generated/endpoints/events/events';
import type { CreateEventBody } from '@/api/generated/model';
import { EventSetupForm } from '@/components/setup/event-setup-form';
import { SetupNotice } from '@/components/setup/setup-notice';
import { SetupNpcForm } from '@/components/npcs/setup-npc-form';
import {
  defaultBlockConfigs,
  eventFormSchema,
  normalizeEventFormValues,
  type EventFormValues,
} from '@/lib/event-schema';
import type { WarRoomContext } from '@/lib/war-room-data';

export default function SetupRoute() {
  const warRoom = useOutletContext<WarRoomContext>();
  const isDemoCampaign = warRoom.campaign.id.startsWith('demo-');
  const [savedEvent, setSavedEvent] = useState<EventFormValues | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [savedNpc, setSavedNpc] = useState<{ name: string; factCount: number } | null>(null);
  const [npcError, setNpcError] = useState<string | null>(null);

  const eventMethods = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: '',
      type: 'narration',
      channelId: '',
      shortCircuit: false,
      pipeline: [{ blockType: 'message-channel', config: defaultBlockConfigs['message-channel'] }],
    },
  });

  const onSubmitEvent = async (values: EventFormValues) => {
    try {
      setEventError(null);
      const normalizedValues = normalizeEventFormValues(values);

      if (!isDemoCampaign) {
        await createEvent({ id: warRoom.campaign.id }, normalizedValues as CreateEventBody, {
          credentials: 'include',
        });
      }

      setSavedEvent(normalizedValues);
      eventMethods.reset({
        name: '',
        type: 'narration',
        channelId: '',
        shortCircuit: false,
        pipeline: [{ blockType: 'message-channel', config: defaultBlockConfigs['message-channel'] }],
      });
    } catch (err) {
      console.error('Create event error:', err);
      setEventError('The event dossier did not stage cleanly. Try again in a moment.');
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

      <div className="setup-grid">
        <section className="setup-panel">
          <div className="setup-panel-header">
            <div>
              <p className="eyebrow">Event staging</p>
              <h2>Queue the next move</h2>
            </div>
            <p className="form-hint">Draft the trigger now; fire it when the table is ready.</p>
          </div>

          {savedEvent ? (
            <SetupNotice label="Event staged">
              <strong>{savedEvent.name}</strong>
              <span>
                {savedEvent.pipeline.length} block{savedEvent.pipeline.length !== 1 ? 's' : ''} are
                ready to fire.
              </span>
            </SetupNotice>
          ) : null}

          {eventError ? (
            <SetupNotice label="Event staging failed" tone="error">
              <span>{eventError}</span>
            </SetupNotice>
          ) : null}

          <EventSetupForm methods={eventMethods} channels={warRoom.channels} onSubmit={onSubmitEvent} />
        </section>

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
      </div>
    </div>
  );
}
