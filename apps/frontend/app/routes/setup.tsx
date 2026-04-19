import { useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useOutletContext } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { createEvent } from '@/api/generated/endpoints/events/events';
import type { CreateEventBody } from '@/api/generated/model';
import { PipelineBuilder } from '@/components/pipeline-builder';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { defaultBlockConfigs, eventFormSchema, type EventFormValues } from '@/lib/event-schema';
import type { WarRoomContext } from '@/lib/war-room-data';

const EVENT_TYPES = ['test', 'narration', 'insight', 'message'] as const;

// Label style shared across all form fields — matches the app's mono/muted eyebrow style
const fieldLabel =
  'text-muted-foreground text-[0.65rem] tracking-[0.18em] uppercase font-mono font-semibold';

export default function SetupRoute() {
  const warRoom = useOutletContext<WarRoomContext>();
  const [savedEvent, setSavedEvent] = useState<EventFormValues | null>(null);

  const methods = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: '',
      type: 'narration',
      channelId: '',
      shortCircuit: false,
      pipeline: [{ blockType: 'message-channel', config: defaultBlockConfigs['message-channel'] }],
    },
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = methods;

  const onSubmit = async (values: EventFormValues) => {
    try {
      await createEvent({ id: warRoom.campaign.id }, values as CreateEventBody, {
        credentials: 'include',
      });
      setSavedEvent(values);
    } catch (err) {
      console.error('Create event error:', err);
      // In a real app we'd show a toast here
    }
  };

  if (savedEvent) {
    return (
      <div className="mode-route">
        <div className="event-saved">
          <p className="eyebrow">Event Staged</p>
          <h2 className="event-saved-name">{savedEvent.name}</h2>
          <p className="form-hint">
            {savedEvent.pipeline.length} block{savedEvent.pipeline.length !== 1 ? 's' : ''} in
            pipeline
          </p>
          <div className="event-payload">
            <span className="form-label">Pipeline payload</span>
            <pre className="event-json">{JSON.stringify(savedEvent, null, 2)}</pre>
          </div>
          <button className="form-submit" onClick={() => setSavedEvent(null)} type="button">
            Create another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mode-route">
      <FormProvider {...methods}>
        <form className="event-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* ── Basic fields ─────────────────────────────────────────────── */}
          <div className="form-section">
            {/* Event Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="event-name" className={fieldLabel}>
                Event Name
              </Label>
              <Input
                id="event-name"
                type="text"
                placeholder="Perception Check · Elysium Arrival"
                {...register('name')}
              />
              {errors.name && <span className="form-error">{errors.name.message}</span>}
            </div>

            {/* Type + Channel row */}
            <div className="form-row">
              <div className="form-field">
                <Label htmlFor="event-type" className={fieldLabel}>
                  Type
                </Label>
                <Controller
                  control={control}
                  name="type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="event-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.type && <span className="form-error">{errors.type.message}</span>}
              </div>

              <div className="form-field">
                <Label htmlFor="event-channel" className={fieldLabel}>
                  Channel
                </Label>
                <Controller
                  control={control}
                  name="channelId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="event-channel">
                        <SelectValue placeholder="Select channel…" />
                      </SelectTrigger>
                      <SelectContent>
                        {warRoom.channels.map((ch) => (
                          <SelectItem key={ch.id} value={ch.id}>{`# ${ch.name}`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.channelId && <span className="form-error">{errors.channelId.message}</span>}
              </div>

              {/* Short Circuit — toggle row style matching original */}
              <div className="form-field form-field-toggle">
                <Label className={fieldLabel}>Short Circuit</Label>
                <div className="toggle-row">
                  <Controller
                    control={control}
                    name="shortCircuit"
                    render={({ field }) => (
                      <Checkbox
                        id="event-sc"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <label htmlFor="event-sc" className="form-hint cursor-pointer select-none">
                    Single-pass evaluation
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* ── Pipeline ─────────────────────────────────────────────────── */}
          <PipelineBuilder />

          {/* ── Submit ───────────────────────────────────────────────────── */}
          <div className="form-actions">
            <button className="form-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save Event'}
            </button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
