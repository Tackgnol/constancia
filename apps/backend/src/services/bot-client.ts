import type { BotDeliveryPayload } from '@constancia/contracts';

export async function sendMessagesToBotAsync(
  botInternalUrl: string,
  botApiKey: string,
  payload: BotDeliveryPayload,
): Promise<void> {
  const url = `${botInternalUrl}/send-messages`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-bot-key': botApiKey,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const responseText = [204, 205, 304].includes(response.status) ? '' : await response.text();
    if (!response.ok) {
      console.error('[bot-client] Bot delivery failed:', {
        eventId: payload.eventId,
        statusCode: response.status,
        responseText,
      });
      return;
    }

    let deliveryData: Record<string, unknown> | undefined;
    if (responseText) {
      const parsed = JSON.parse(responseText) as { data?: Record<string, unknown> };
      deliveryData = parsed.data;
    }

    console.info('[bot-client] Bot delivery completed:', {
      eventId: payload.eventId,
      ...deliveryData,
    });
  } catch (err) {
    console.error('[bot-client] Failed to deliver messages to bot:', {
      eventId: payload.eventId,
      error: err,
    });
  }
}
