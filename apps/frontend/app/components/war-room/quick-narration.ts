import { z } from 'zod';

export const quickNarrationSchema = z.object({
  message: z
    .string()
    .trim()
    .min(8, 'Enter at least 8 characters so the room gets a complete narration cue.')
    .max(240, 'Shorten this narration to 240 characters or fewer, then broadcast it.'),
});

export type QuickNarrationValues = z.infer<typeof quickNarrationSchema>;

export interface QuickNarrationSubmission {
  idempotencyKey: string;
  message: string;
}

export function quickNarrationActivityLabel(message: string): string {
  const summary = message.length > 60 ? `${message.slice(0, 59)}…` : message;
  return `Narration broadcast · ${summary}`;
}
