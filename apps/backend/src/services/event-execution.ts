import type { BlockMessage, BotDeliveryPayload } from '@constancia/contracts';

export type EventExecutionKind = 'fire' | 'test-result';
export type EventExecutionStatus = 'completed' | 'failed';
export type EventDeliveryStatus = 'pending' | 'delivered' | 'failed';

export interface FireEventCommand {
  kind: 'fire';
  idempotencyKey: string;
  campaignId: string;
  eventId: string;
}

export interface SubmitTestResultCommand {
  kind: 'test-result';
  idempotencyKey: string;
  eventId: string;
  discordUserId: string;
  discordChannelId: string;
  playerScore: number;
}

export interface PlannedEventExecution {
  eventId: string;
  campaignId: string;
  messages: BlockMessage[];
  halted: boolean;
  deliveries: BotDeliveryPayload[];
}

export interface EventExecutionPlanner {
  planFire(command: FireEventCommand): Promise<PlannedEventExecution>;
  planTestResult(command: SubmitTestResultCommand): Promise<PlannedEventExecution>;
}

export interface EventDeliveryReceipt {
  id: string;
  status: EventDeliveryStatus;
  attempts: number;
  lastError?: string;
  deliveredAt?: string;
}

export interface EventExecutionReceipt {
  id: string;
  idempotencyKey: string;
  kind: EventExecutionKind;
  eventId: string;
  campaignId: string;
  status: EventExecutionStatus;
  halted: boolean;
  messages: BlockMessage[];
  deliveries: EventDeliveryReceipt[];
  error?: { code: string; message: string };
  createdAt: string;
  completedAt: string;
}

export interface EventExecutionDraft extends PlannedEventExecution {
  idempotencyKey: string;
  commandFingerprint: string;
  kind: EventExecutionKind;
  markEventFired: boolean;
}

export interface RetryableDelivery {
  id: string;
  executionId: string;
  payload: BotDeliveryPayload;
}

export interface EventExecutionStore {
  findByIdempotencyKey(
    kind: EventExecutionKind,
    idempotencyKey: string,
  ): Promise<{ commandFingerprint: string; receipt: EventExecutionReceipt } | null>;
  createOnce(
    draft: EventExecutionDraft,
  ): Promise<{ created: boolean; receipt: EventExecutionReceipt }>;
  get(executionId: string): Promise<EventExecutionReceipt | null>;
  listRetryableDeliveries(input: {
    executionId?: string;
    limit: number;
  }): Promise<RetryableDelivery[]>;
  recordDeliveryResult(
    deliveryId: string,
    result: BotDeliveryResult,
  ): Promise<EventExecutionReceipt>;
}

export interface BotDeliveryCommand {
  deliveryId: string;
  payload: BotDeliveryPayload;
}

export type BotDeliveryResult =
  | { status: 'delivered'; delivered: number; skipped: number }
  | { status: 'failed'; error: string };

export interface BotDeliveryPort {
  deliver(command: BotDeliveryCommand): Promise<BotDeliveryResult>;
}

export interface EventExecution {
  fire(command: Omit<FireEventCommand, 'kind'>): Promise<EventExecutionReceipt>;
  submitTestResult(command: Omit<SubmitTestResultCommand, 'kind'>): Promise<EventExecutionReceipt>;
  retryDeliveries(input?: {
    executionId?: string;
    limit?: number;
  }): Promise<EventExecutionReceipt[]>;
}

export class IdempotencyConflictError extends Error {
  readonly statusCode = 409;
  readonly code = 'IDEMPOTENCY_CONFLICT';

  constructor(readonly idempotencyKey: string) {
    super(`Idempotency key "${idempotencyKey}" was already used for a different command.`);
    this.name = 'IdempotencyConflictError';
  }
}

export class EventExecutionNotFoundError extends Error {
  constructor(readonly executionId: string) {
    super(`Event execution "${executionId}" was not found.`);
    this.name = 'EventExecutionNotFoundError';
  }
}

export function createEventExecution(input: {
  store: EventExecutionStore;
  planner: EventExecutionPlanner;
  delivery: BotDeliveryPort;
}): EventExecution {
  const { store, planner, delivery } = input;
  const inFlight = new Map<string, Promise<EventExecutionReceipt>>();

  async function execute(
    command: FireEventCommand | SubmitTestResultCommand,
  ): Promise<EventExecutionReceipt> {
    assertIdempotencyKey(command.idempotencyKey);

    const key = `${command.kind}:${command.idempotencyKey}`;
    const active = inFlight.get(key);
    if (active) {
      await active;
      return executeOnce(command);
    }

    const current = executeOnce(command);
    inFlight.set(key, current);
    try {
      return await current;
    } finally {
      inFlight.delete(key);
    }
  }

  async function executeOnce(
    command: FireEventCommand | SubmitTestResultCommand,
  ): Promise<EventExecutionReceipt> {
    const fingerprint = commandFingerprint(command);
    const existing = await store.findByIdempotencyKey(command.kind, command.idempotencyKey);

    if (existing) {
      assertMatchingFingerprint(command.idempotencyKey, fingerprint, existing.commandFingerprint);
      const [retried] = await retryDeliveries({
        executionId: existing.receipt.id,
        limit: 100,
      });
      return retried ?? existing.receipt;
    }

    const plan =
      command.kind === 'fire'
        ? await planner.planFire(command)
        : await planner.planTestResult(command);

    assertPlanMatchesCommand(command, plan);

    const persisted = await store.createOnce({
      ...plan,
      idempotencyKey: command.idempotencyKey,
      commandFingerprint: fingerprint,
      kind: command.kind,
      markEventFired: command.kind === 'fire',
    });

    if (!persisted.created) {
      const stored = await store.findByIdempotencyKey(command.kind, command.idempotencyKey);

      if (!stored) {
        throw new Error('Event execution disappeared after an idempotency conflict.');
      }

      assertMatchingFingerprint(command.idempotencyKey, fingerprint, stored.commandFingerprint);
      return stored.receipt;
    }

    const [receipt] = await retryDeliveries({
      executionId: persisted.receipt.id,
      limit: 100,
    });

    return receipt ?? persisted.receipt;
  }

  async function retryDeliveries(
    retryInput: { executionId?: string; limit?: number } = {},
  ): Promise<EventExecutionReceipt[]> {
    const jobs = await store.listRetryableDeliveries({
      executionId: retryInput.executionId,
      limit: normalizeRetryLimit(retryInput.limit),
    });
    const receipts = new Map<string, EventExecutionReceipt>();

    for (const job of jobs) {
      const result = await delivery.deliver({
        deliveryId: job.id,
        payload: job.payload,
      });

      receipts.set(job.executionId, await store.recordDeliveryResult(job.id, result));
    }

    if (retryInput.executionId && !receipts.has(retryInput.executionId)) {
      const receipt = await store.get(retryInput.executionId);

      if (!receipt) {
        throw new EventExecutionNotFoundError(retryInput.executionId);
      }

      receipts.set(receipt.id, receipt);
    }

    return [...receipts.values()];
  }

  return {
    fire: (command) => execute({ ...command, kind: 'fire' }),
    submitTestResult: (command) => execute({ ...command, kind: 'test-result' }),
    retryDeliveries,
  };
}

function assertIdempotencyKey(idempotencyKey: string): void {
  if (idempotencyKey.trim().length === 0) {
    throw new Error('An idempotency key is required.');
  }
}

function assertMatchingFingerprint(
  idempotencyKey: string,
  requested: string,
  persisted: string,
): void {
  if (requested !== persisted) {
    throw new IdempotencyConflictError(idempotencyKey);
  }
}

function assertPlanMatchesCommand(
  command: FireEventCommand | SubmitTestResultCommand,
  plan: PlannedEventExecution,
): void {
  if (command.eventId !== plan.eventId) {
    throw new Error('The planned Event does not match the requested Event.');
  }

  if (command.kind === 'fire' && command.campaignId !== plan.campaignId) {
    throw new Error('The planned Event does not belong to the requested Campaign.');
  }
}

function commandFingerprint(command: FireEventCommand | SubmitTestResultCommand): string {
  return command.kind === 'fire'
    ? `fire:${command.campaignId}:${command.eventId}`
    : [
        'test-result',
        command.eventId,
        command.discordUserId,
        command.discordChannelId,
        command.playerScore,
      ].join(':');
}

function normalizeRetryLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return 25;
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Delivery retry limit must be an integer between 1 and 100.');
  }

  return limit;
}

interface StoredDelivery extends RetryableDelivery {
  status: EventDeliveryStatus;
}

interface StoredExecution {
  commandFingerprint: string;
  receipt: EventExecutionReceipt;
  deliveries: StoredDelivery[];
}

export class InMemoryEventExecutionStore implements EventExecutionStore {
  private sequence = 0;
  private executionsById = new Map<string, StoredExecution>();
  private executionIdByKey = new Map<string, string>();
  private firedEvents = new Set<string>();

  async findByIdempotencyKey(
    kind: EventExecutionKind,
    idempotencyKey: string,
  ): Promise<{ commandFingerprint: string; receipt: EventExecutionReceipt } | null> {
    const executionId = this.executionIdByKey.get(`${kind}:${idempotencyKey}`);
    const stored = executionId ? this.executionsById.get(executionId) : undefined;

    return stored
      ? {
          commandFingerprint: stored.commandFingerprint,
          receipt: cloneReceipt(stored.receipt),
        }
      : null;
  }

  async createOnce(
    draft: EventExecutionDraft,
  ): Promise<{ created: boolean; receipt: EventExecutionReceipt }> {
    const key = `${draft.kind}:${draft.idempotencyKey}`;
    const existingId = this.executionIdByKey.get(key);

    if (existingId) {
      const existing = this.executionsById.get(existingId);
      if (!existing) {
        throw new Error('In-memory execution index is inconsistent.');
      }

      assertMatchingFingerprint(
        draft.idempotencyKey,
        draft.commandFingerprint,
        existing.commandFingerprint,
      );
      return { created: false, receipt: cloneReceipt(existing.receipt) };
    }

    const id = `execution-${++this.sequence}`;
    const now = new Date().toISOString();
    const deliveries: StoredDelivery[] = draft.deliveries.map((payload, index) => ({
      id: `${id}-delivery-${index + 1}`,
      executionId: id,
      payload,
      status: 'pending',
    }));

    const receipt: EventExecutionReceipt = {
      id,
      idempotencyKey: draft.idempotencyKey,
      kind: draft.kind,
      eventId: draft.eventId,
      campaignId: draft.campaignId,
      status: 'completed',
      halted: draft.halted,
      messages: draft.messages,
      deliveries: deliveries.map((item) => ({
        id: item.id,
        status: 'pending',
        attempts: 0,
      })),
      createdAt: now,
      completedAt: now,
    };

    this.executionsById.set(id, {
      commandFingerprint: draft.commandFingerprint,
      receipt,
      deliveries,
    });
    this.executionIdByKey.set(key, id);

    if (draft.markEventFired) {
      this.firedEvents.add(`${draft.campaignId}:${draft.eventId}`);
    }

    return { created: true, receipt: cloneReceipt(receipt) };
  }

  async get(executionId: string): Promise<EventExecutionReceipt | null> {
    const stored = this.executionsById.get(executionId);
    return stored ? cloneReceipt(stored.receipt) : null;
  }

  async listRetryableDeliveries(input: {
    executionId?: string;
    limit: number;
  }): Promise<RetryableDelivery[]> {
    return [...this.executionsById.values()]
      .flatMap((stored) => stored.deliveries)
      .filter(
        (item) =>
          item.status !== 'delivered' &&
          (input.executionId === undefined || item.executionId === input.executionId),
      )
      .slice(0, input.limit)
      .map(({ id, executionId, payload }) => ({ id, executionId, payload }));
  }

  async recordDeliveryResult(
    deliveryId: string,
    result: BotDeliveryResult,
  ): Promise<EventExecutionReceipt> {
    for (const stored of this.executionsById.values()) {
      const delivery = stored.deliveries.find((candidate) => candidate.id === deliveryId);

      if (!delivery) {
        continue;
      }

      delivery.status = result.status;
      const receiptDelivery = stored.receipt.deliveries.find(
        (candidate) => candidate.id === deliveryId,
      );

      if (!receiptDelivery) {
        throw new Error('In-memory delivery receipt is inconsistent.');
      }

      receiptDelivery.attempts += 1;
      receiptDelivery.status = result.status;

      if (result.status === 'delivered') {
        receiptDelivery.deliveredAt = new Date().toISOString();
        delete receiptDelivery.lastError;
      } else {
        receiptDelivery.lastError = result.error;
      }

      return cloneReceipt(stored.receipt);
    }

    throw new Error(`Event delivery "${deliveryId}" was not found.`);
  }

  isEventFired(campaignId: string, eventId: string): boolean {
    return this.firedEvents.has(`${campaignId}:${eventId}`);
  }
}

export class InMemoryBotDeliveryPort implements BotDeliveryPort {
  readonly commands: BotDeliveryCommand[] = [];
  private failures: string[] = [];
  private delivered = new Map<string, Extract<BotDeliveryResult, { status: 'delivered' }>>();

  failNext(error: string): void {
    this.failures.push(error);
  }

  async deliver(command: BotDeliveryCommand): Promise<BotDeliveryResult> {
    this.commands.push(command);

    const existing = this.delivered.get(command.deliveryId);
    if (existing) {
      return existing;
    }

    const failure = this.failures.shift();
    if (failure) {
      return { status: 'failed', error: failure };
    }

    const result = {
      status: 'delivered',
      delivered: 1,
      skipped: 0,
    } as const;

    this.delivered.set(command.deliveryId, result);
    return result;
  }
}

function cloneReceipt(receipt: EventExecutionReceipt): EventExecutionReceipt {
  return structuredClone(receipt);
}
