import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { QUICK_NARRATION_ERROR } from '@/lib/war-room-feedback';
import {
  quickNarrationSchema,
  type QuickNarrationSubmission,
  type QuickNarrationValues,
} from '@/components/war-room/quick-narration';

interface QuickNarrationFormProps {
  onBroadcast: (submission: QuickNarrationSubmission) => Promise<void>;
  successMessage?: string;
}

export function QuickNarrationForm({
  onBroadcast,
  successMessage = 'Narration broadcast to the room.',
}: QuickNarrationFormProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const attemptRef = useRef<{ idempotencyKey: string; message: string } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<QuickNarrationValues>({
    resolver: zodResolver(quickNarrationSchema),
    defaultValues: { message: '' },
  });

  const submit = handleSubmit(async (values) => {
    const message = values.message.trim();
    const attempt =
      attemptRef.current?.message === message
        ? attemptRef.current
        : { idempotencyKey: crypto.randomUUID(), message };

    attemptRef.current = attempt;
    clearErrors('root');
    setNotice(null);

    try {
      await onBroadcast(attempt);
      attemptRef.current = null;
      reset({ message: '' });
      setNotice(successMessage);
    } catch (caught) {
      setError('root.serverError', {
        type: 'server',
        message:
          caught instanceof Error && caught.message.trim().length > 0
            ? caught.message
            : QUICK_NARRATION_ERROR,
      });
    }
  });

  const feedback = errors.message?.message ?? errors.root?.serverError?.message;

  return (
    <footer className="quick-bar">
      <form className="quick-form" onSubmit={submit} noValidate>
        <div className="quick-form-row">
          <input
            aria-describedby="quick-bar-feedback"
            aria-invalid={feedback ? true : undefined}
            aria-label="Quick narration"
            className="quick-input"
            placeholder="Broadcast a quick narration..."
            type="text"
            {...register('message', {
              onChange: () => {
                attemptRef.current = null;
                clearErrors('root');
                setNotice(null);
              },
            })}
          />
          <button className="quick-send" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Broadcasting…' : 'Broadcast'}
          </button>
        </div>
        {feedback ? (
          <p className="quick-bar-feedback quick-bar-error" id="quick-bar-feedback" role="alert">
            {feedback}
          </p>
        ) : notice ? (
          <p className="quick-bar-feedback quick-bar-success" id="quick-bar-feedback" role="status">
            {notice}
          </p>
        ) : (
          <p className="quick-bar-feedback quick-bar-hint" id="quick-bar-feedback">
            Press Enter to send. Keep it short enough to play like a live cue.
          </p>
        )}
      </form>
    </footer>
  );
}
