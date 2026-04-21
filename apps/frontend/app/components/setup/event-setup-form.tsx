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
import type { EventFormValues } from '@/lib/event-schema';

const EVENT_TYPES = ['test', 'narration', 'insight', 'message'] as const;

export function EventSetupForm({
  methods,
  channels,
  onSubmit,
}: {
  methods: UseFormReturn<EventFormValues>;
  channels: ChannelEntry[];
  onSubmit: (values: EventFormValues) => Promise<void> | void;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = methods;

  return (
    <FormProvider {...methods}>
      <form className="event-form" onSubmit={handleSubmit(onSubmit)} noValidate>
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
                    <SelectContent>
                      {channels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>{`# ${channel.name}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.channelId ? <span className="form-error">{errors.channelId.message}</span> : null}
            </div>

            <div className="form-field form-field-toggle">
              <Label className={formFieldLabelClassName}>Short Circuit</Label>
              <div className="toggle-row">
                <Controller
                  control={control}
                  name="shortCircuit"
                  render={({ field }) => (
                    <Checkbox id="event-sc" checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
                <label htmlFor="event-sc" className="form-hint cursor-pointer select-none">
                  Single-pass evaluation
                </label>
              </div>
            </div>
          </div>
        </div>

        <PipelineBuilder />

        <div className="form-actions">
          <button className="form-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save Event'}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
