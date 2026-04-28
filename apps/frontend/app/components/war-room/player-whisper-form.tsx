import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { MessageSquare, Send, X } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { sendPlayerMessage } from '@/api/generated/endpoints/messages/messages';
import type { SendPlayerMessageBody } from '@/api/generated/model';
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
import { Textarea } from '@/components/ui/textarea';
import { buildRecipientOptions, type WarRoomContext } from '@/lib/war-room-data';

const whisperSchema = z.object({
  channelId: z.string().min(1, 'Choose the table channel context.'),
  playerIds: z.array(z.string()).min(1, 'Select at least one player.'),
  content: z
    .string()
    .trim()
    .min(1, 'Write the whisper before sending.')
    .max(1000, 'Keep one-off whispers under 1000 characters.'),
  imageUrl: z.string().trim().optional(),
});

type WhisperFormValues = z.infer<typeof whisperSchema>;

interface PlayerWhisperFormProps {
  warRoom: WarRoomContext;
}

function selectedPlayerLabel(selectedCount: number) {
  if (selectedCount === 0) {
    return 'No recipients selected';
  }

  return selectedCount === 1 ? '1 recipient selected' : `${selectedCount} recipients selected`;
}

function sentPlayerLabel(sentCount: number) {
  return sentCount === 1
    ? 'Whisper sent to 1 recipient'
    : `Whisper sent to ${sentCount} recipients`;
}

export function PlayerWhisperForm({ warRoom }: PlayerWhisperFormProps) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const recipientOptions = useMemo(
    () => buildRecipientOptions(warRoom.rawCharacters, warRoom.players),
    [warRoom.rawCharacters, warRoom.players],
  );
  const isDemoMode = warRoom.demoMode ?? warRoom.campaign.id.startsWith('demo-');

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<WhisperFormValues>({
    resolver: zodResolver(whisperSchema),
    defaultValues: {
      channelId: warRoom.channels[0]?.id ?? '',
      playerIds: [],
      content: '',
      imageUrl: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const imageUrl = values.imageUrl?.trim();
    const payload: SendPlayerMessageBody = {
      channelId: values.channelId,
      discordUserIds: values.playerIds,
      content: values.content.trim(),
      ...(imageUrl ? { imageUrl } : {}),
    };

    try {
      clearErrors('root');

      if (!isDemoMode) {
        await sendPlayerMessage({ id: warRoom.campaign.id }, payload, { credentials: 'include' });
      }

      const sentLabel = sentPlayerLabel(values.playerIds.length);
      warRoom.recordActivity?.(sentLabel);
      setNotice(sentLabel);
      reset({
        channelId: values.channelId,
        playerIds: [],
        content: '',
        imageUrl: '',
      });
    } catch (error) {
      console.error('Whisper send error:', error);
      setNotice(null);
      setError('root.serverError', {
        type: 'manual',
        message: 'The whisper did not leave the board. Try again.',
      });
    }
  });

  return (
    <div className="whisper-panel">
      <button
        className="ghost-action whisper-toggle"
        onClick={() => setOpen((current) => !current)}
        title="Send a private Discord DM to selected players"
        type="button"
      >
        <MessageSquare size={15} aria-hidden="true" />
        <span>Whisper a player</span>
      </button>

      {open ? (
        <form className="whisper-form" onSubmit={onSubmit} noValidate>
          <div className="whisper-form-header">
            <div>
              <p className="eyebrow">Player message</p>
              <h3>Private Discord whisper</h3>
            </div>
            <button
              aria-label="Close whisper panel"
              className="icon-action"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>

          <div className="form-field form-field-full">
            <Label className={formFieldLabelClassName}>Recipients</Label>
            <Controller
              control={control}
              name="playerIds"
              render={({ field }) => {
                const selectedIds = field.value;

                return (
                  <div className="whisper-recipient-list">
                    <span className="whisper-recipient-summary">
                      {selectedPlayerLabel(selectedIds.length)}
                    </span>
                    {recipientOptions.map((option) => {
                      const checked = selectedIds.includes(option.id);
                      return (
                        <label key={option.id} className="whisper-recipient-row">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(nextChecked) => {
                              if (nextChecked === true) {
                                field.onChange(checked ? selectedIds : [...selectedIds, option.id]);
                                return;
                              }

                              field.onChange(selectedIds.filter((id) => id !== option.id));
                            }}
                          />
                          <span>
                            <strong>{option.displayName}</strong>
                            <small>{option.secondaryLabel}</small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                );
              }}
            />
            {errors.playerIds ? (
              <span className="form-error">{errors.playerIds.message}</span>
            ) : null}
          </div>

          <div className="form-field form-field-full">
            <Label className={formFieldLabelClassName}>Channel Context</Label>
            <Controller
              control={control}
              name="channelId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select channel..." />
                  </SelectTrigger>
                  <SelectContent>
                    {warRoom.channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        # {channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.channelId ? (
              <span className="form-error">{errors.channelId.message}</span>
            ) : null}
          </div>

          <div className="form-field form-field-full">
            <Label className={formFieldLabelClassName}>Message</Label>
            <Textarea rows={4} placeholder="What only they hear..." {...register('content')} />
            {errors.content ? <span className="form-error">{errors.content.message}</span> : null}
          </div>

          <div className="form-field form-field-full">
            <Label className={formFieldLabelClassName}>Image URL</Label>
            <Input type="text" placeholder="Optional image URL..." {...register('imageUrl')} />
          </div>

          {errors.root?.serverError?.message ? (
            <p className="whisper-feedback is-error">{errors.root.serverError.message}</p>
          ) : null}
          {notice && !errors.root?.serverError?.message ? (
            <p className="whisper-feedback is-success">{notice}</p>
          ) : null}

          <button className="form-submit whisper-submit" type="submit" disabled={isSubmitting}>
            <Send size={14} aria-hidden="true" />
            <span>{isSubmitting ? 'Sending...' : 'Send Whisper'}</span>
          </button>
        </form>
      ) : null}
    </div>
  );
}
