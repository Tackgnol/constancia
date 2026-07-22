import { fireEvent } from '@constancia/api-client/endpoints/events/events';
import { assertApiOk, getApiErrorMessage } from '@/lib/api-errors';
import { buildServerApiOptions } from '@/lib/api-proxy.server';
import { toFireReceiptView, type FireReceiptView } from '@/lib/fire-event-receipt';

/**
 * Wording differs between Play and Map, but the execution path must not: both call the same
 * backend fire operation with the caller's idempotency key, so one armed attempt stays one
 * execution however many times an ambiguous response is retried.
 */
export interface FireEventMessages {
  missingIdentifiers: string;
  fireFailed: string;
  unreadableReceipt: string;
}

export type FireEventResult =
  | { status: 'success'; receipt: FireReceiptView }
  | { status: 'error'; message: string; statusCode: number };

export async function fireCampaignEvent(
  request: Request,
  params: {
    campaignId: string;
    eventId: FormDataEntryValue | null;
    idempotencyKey: FormDataEntryValue | null;
    messages: FireEventMessages;
  },
): Promise<FireEventResult> {
  const { campaignId, eventId, idempotencyKey, messages } = params;

  if (
    typeof eventId !== 'string' ||
    eventId.length === 0 ||
    typeof idempotencyKey !== 'string' ||
    idempotencyKey.length === 0
  ) {
    return { status: 'error', message: messages.missingIdentifiers, statusCode: 400 };
  }

  const apiOptions = buildServerApiOptions(request);

  try {
    const response = await fireEvent(
      { id: campaignId, eventId },
      {
        ...apiOptions,
        headers: { ...apiOptions.headers, 'idempotency-key': idempotencyKey },
      },
    );
    assertApiOk(response, messages.fireFailed);

    const receipt = toFireReceiptView(response.data);
    if (receipt === null) {
      return { status: 'error', message: messages.unreadableReceipt, statusCode: 502 };
    }

    return { status: 'success', receipt };
  } catch (caught) {
    return {
      status: 'error',
      message: getApiErrorMessage(caught, messages.fireFailed),
      statusCode: 500,
    };
  }
}
