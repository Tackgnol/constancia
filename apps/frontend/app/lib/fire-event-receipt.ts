/**
 * Pure translation of an execution receipt into the view Play and Map both render. Kept free of
 * the generated API client so components and tests can use it without pulling in server-only code.
 */

export type DeliveryViewState = 'not-required' | 'pending' | 'delivered' | 'failed';

export interface FireReceiptView {
  eventId: string;
  executionId: string;
  executionStatus: 'completed' | 'failed';
  deliveryStatus: DeliveryViewState;
}

export function toFireReceiptView(input: unknown): FireReceiptView | null {
  if (typeof input !== 'object' || input === null) {
    return null;
  }

  const receipt = input as Record<string, unknown>;
  if (
    typeof receipt.id !== 'string' ||
    typeof receipt.eventId !== 'string' ||
    (receipt.status !== 'completed' && receipt.status !== 'failed') ||
    !Array.isArray(receipt.deliveries)
  ) {
    return null;
  }

  const deliveryStatuses = receipt.deliveries.flatMap((delivery) => {
    if (
      typeof delivery !== 'object' ||
      delivery === null ||
      !('status' in delivery) ||
      (delivery.status !== 'pending' &&
        delivery.status !== 'delivered' &&
        delivery.status !== 'failed')
    ) {
      return [];
    }

    return [delivery.status];
  });
  if (deliveryStatuses.length !== receipt.deliveries.length) {
    return null;
  }

  const deliveryStatus: DeliveryViewState =
    deliveryStatuses.length === 0
      ? 'not-required'
      : deliveryStatuses.every((status) => status === 'delivered')
        ? 'delivered'
        : deliveryStatuses.some((status) => status === 'pending')
          ? 'pending'
          : 'failed';

  return {
    eventId: receipt.eventId,
    executionId: receipt.id,
    executionStatus: receipt.status,
    deliveryStatus,
  };
}
