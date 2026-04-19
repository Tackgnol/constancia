export interface MagicLinkDelivery {
  requestId: string;
  email: string;
  token: string;
  url: string;
  metadata?: Record<string, unknown>;
}

const deliveries = new Map<string, MagicLinkDelivery>();

export function rememberMagicLinkDelivery(delivery: MagicLinkDelivery) {
  deliveries.set(delivery.requestId, delivery);
}

export function consumeMagicLinkDelivery(requestId: string) {
  const delivery = deliveries.get(requestId);
  deliveries.delete(requestId);
  return delivery;
}
