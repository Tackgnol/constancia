import { useEffect, useRef } from 'react';
import { Controller, FormProvider, type UseFormReturn } from 'react-hook-form';
import { PipelineBuilder } from '@/components/pipeline-builder';
import { formFieldLabelClassName } from '@/components/forms/field-label';
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
import type { ChannelEntry } from '@/lib/war-room-data';
import {
  EVENT_TYPES,
  getDefaultPipelineForEventType,
  isPipelineEqualToEventDefault,
  type EventFormValues,
} from '@/lib/event-schema';

export function EventSetupForm({
  methods,
  channels,
  onSubmit,
  submitLabel = 'Save event',
}: {
  methods: UseFormReturn<EventFormValues>;
  channels: ChannelEntry[];
  onSubmit: (values: EventFormValues) => Promise<void> | void;
  submitLabel?: string;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, submitCount },
  } = methods;
  const eventType = methods.watch('type');
  const selectedChannelId = methods.watch('channelId');
  const pipeline = methods.watch('pipeline');
  const previousTypeRef = useRef(eventType);
  const hasValidationErrors = submitCount > 0 && Object.keys(errors).some((key) => key !== 'root');

  useEffect(() => {
    if (channels.length !== 1 || selectedChannelId.trim().length > 0) {
      return;
    }

    methods.setValue('channelId', channels[0].id, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [channels, methods, selectedChannelId]);

  useEffect(() => {
    const previousType = previousTypeRef.current;
    if (previousType === eventType) {
      return;
    }

    if (
      pipeline === undefined ||
      pipeline.length === 0 ||
      isPipelineEqualToEventDefault(previousType, pipeline)
    ) {
      methods.setValue('pipeline', getDefaultPipelineForEventType(eventType), {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }

    previousTypeRef.current = eventType;
  }, [eventType, methods, pipeline]);

  return (
    <FormProvider {...methods}>
      <form className="event-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        {hasValidationErrors ? (
          <div className="form-status form-status-error" role="alert">
            The event dossier still has validation gaps. Check the highlighted fields before you
            save.
          </div>
        ) : null}
        {errors.root?.serverError?.message ? (
          <div className="form-status form-status-error" role="alert">
            {errors.root.serverError.message}
          </div>
        ) : null}
        <div className="form-section">
          <div className="grid gap-1.5">
            <Label htmlFor="event-name" className={formFieldLabelClassName}>
              Event Name
            </Label>
            <Input
              id="event-name"
              type="text"
              placeholder="Perception Check · Elysium Arrival"
              {...register('name')}
            />
            {errors.name ? <span className="form-error">{errors.name.message}</span> : null}
          </div>

          <div className="form-row">
            <div className="form-field">
              <Label htmlFor="event-type" className={formFieldLabelClassName}>
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
                      {EVENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.type ? <span className="form-error">{errors.type.message}</span> : null}
            </div>

            <div className="form-field">
              <Label htmlFor="event-channel" className={formFieldLabelClassName}>
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
                    <SelectContent sideOffset={4}>
                      {channels.map((channel) => (
                        <SelectItem
                          key={channel.id}
                          value={channel.id}
                        >{`# ${channel.name}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.channelId ? (
                <span className="form-error">{errors.channelId.message}</span>
              ) : null}
            </div>

            {eventType !== 'narration' ? (
              <div className="form-field form-field-toggle">
                <Label className={formFieldLabelClassName}>Stop After Match</Label>
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
                    Stop once an action resolves the event.
                  </label>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <PipelineBuilder
          eventType={eventType}
          footer={
            <button className="form-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : submitLabel}
            </button>
          }
        />
      </form>
    </FormProvider>
  );
}
