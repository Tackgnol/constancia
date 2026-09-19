import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@constancia/db';
import { createPrismaEventExecutionStore } from '../services/event-execution-store.js';

const captureExceptionMock = vi.hoisted(() => vi.fn());
vi.mock('../instrument.js', () => ({ Sentry: { captureException: captureExceptionMock } }));

function storedExecution() {
  return {
    id: 'execution-1',
    kind: 'fire',
    idempotencyKey: 'idempotency-1',
    commandFingerprint: 'fingerprint-1',
    eventId: 'event-1',
    campaignId: 'campaign-1',
    status: 'completed',
    halted: false,
    messages: [],
    errorCode: null,
    errorMessage: null,
    createdAt: new Date('2026-09-17T00:00:00.000Z'),
    completedAt: new Date('2026-09-17T00:00:00.000Z'),
    deliveries: [],
  };
}

function createPrismaMock(deliveryAttempts: number) {
  return {
    eventDelivery: {
      findUniqueOrThrow: vi.fn(async () => ({
        attempts: deliveryAttempts,
        executionId: 'execution-1',
      })),
      update: vi.fn(async () => ({})),
    },
    eventExecution: {
      findUniqueOrThrow: vi.fn(async () => storedExecution()),
    },
  } as unknown as PrismaClient;
}

describe('createOnce fire guard', () => {
  it('rejects with EVENT_NOT_READY when the Event is no longer ready', async () => {
    const tx = {
      eventExecution: { create: vi.fn(async () => storedExecution()) },
      event: { updateMany: vi.fn(async () => ({ count: 0 })) },
    };
    const prisma = {
      $transaction: vi.fn(async (run: (client: typeof tx) => Promise<unknown>) => run(tx)),
    } as unknown as PrismaClient;

    await expect(
      createPrismaEventExecutionStore(prisma).createOnce({
        kind: 'fire',
        idempotencyKey: 'idempotency-1',
        commandFingerprint: 'fingerprint-1',
        eventId: 'event-1',
        campaignId: 'campaign-1',
        messages: [],
        effects: [],
        halted: false,
        deliveries: [],
        markEventFired: true,
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'EVENT_NOT_READY' });
    expect(tx.event.updateMany).toHaveBeenCalledWith({
      where: { id: 'event-1', campaignId: 'campaign-1', status: 'ready' },
      data: { status: 'fired' },
    });
  });
});

describe('createOnce test submission guard', () => {
  it('maps a duplicate player submission to ALREADY_SUBMITTED', async () => {
    const prisma = {
      $transaction: vi.fn(async () => {
        throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      }),
      eventExecution: { findUnique: vi.fn(async () => null) },
    } as unknown as PrismaClient;

    await expect(
      createPrismaEventExecutionStore(prisma).createOnce({
        kind: 'test-result',
        idempotencyKey: 'interaction-2',
        commandFingerprint: 'fingerprint-2',
        eventId: 'event-1',
        campaignId: 'campaign-1',
        messages: [],
        effects: [],
        halted: false,
        deliveries: [],
        markEventFired: false,
        testSubmission: { instanceId: 'instance-1', discordUserId: 'player-1', playerScore: 3 },
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ALREADY_SUBMITTED' });
  });
});

describe('recordDeliveryResult retry backoff', () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('backs off with an increasing delay below the attempt cap', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-17T12:00:00.000Z'));
    const prisma = createPrismaMock(1);
    const store = createPrismaEventExecutionStore(prisma);

    await store.recordDeliveryResult('delivery-1', { status: 'failed', error: 'Discord 500' });

    expect(prisma.eventDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: {
        status: 'failed',
        attempts: 2,
        lastError: 'Discord 500',
        nextAttemptAt: new Date('2026-09-17T12:00:30.000Z'), // 30s backoff for the 2nd attempt
      },
    });
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('cancels and captures to GlitchTip once the attempt cap is reached', async () => {
    const prisma = createPrismaMock(5); // this failure becomes attempt 6, the cap
    const store = createPrismaEventExecutionStore(prisma);

    await store.recordDeliveryResult('delivery-1', { status: 'failed', error: 'Unknown channel' });

    expect(prisma.eventDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: { status: 'cancelled', attempts: 6, lastError: 'Unknown channel' },
    });
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: { deliveryId: 'delivery-1', executionId: 'execution-1' },
      }),
    );
  });
});
