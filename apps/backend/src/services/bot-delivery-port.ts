import { z } from 'zod';
import type { BotDeliveryPort, BotDeliveryResult } from './event-execution.js';

const botResponseSchema = z.object({
  status: z.literal('ok'),
  data: z.object({
    delivered: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
  }),
});

export function createHttpBotDeliveryPort(input: {
  botInternalUrl: string;
  botApiKey: string;
  fetch?: typeof globalThis.fetch;
}): BotDeliveryPort {
  const request = input.fetch ?? globalThis.fetch;

  return {
    async deliver(command): Promise<BotDeliveryResult> {
      try {
        const response = await request(`${input.botInternalUrl}/send-messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-bot-key': input.botApiKey,
            'x-delivery-id': command.deliveryId,
          },
          body: JSON.stringify(command.payload),
        });

        if (!response.ok) {
          return {
            status: 'failed',
            error: `Bot returned HTTP ${response.status}`,
          };
        }

        const parsed = botResponseSchema.safeParse(await response.json());
        if (!parsed.success) {
          return { status: 'failed', error: 'Bot returned an invalid response' };
        }

        return {
          status: 'delivered',
          delivered: parsed.data.data.delivered,
          skipped: parsed.data.data.skipped,
        };
      } catch (error) {
        return {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Bot delivery failed',
        };
      }
    },
  };
}
