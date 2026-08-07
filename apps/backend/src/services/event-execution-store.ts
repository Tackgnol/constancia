import {
  blockMessageSchema,
  botDeliveryPayloadSchema,
  type BlockEffect,
  type BlockMessage,
} from '@constancia/contracts';
import type { Prisma, PrismaClient } from '@constancia/db';
import { parseGameDate } from '@constancia/systems';
import type {
  BotDeliveryResult,
  EventDeliveryStatus,
  EventExecutionDraft,
  EventExecutionKind,
  EventExecutionReceipt,
  EventExecutionStatus,
  EventExecutionStore,
  RetryableDelivery,
} from './event-execution.js';
import { toGameDateJson } from './game-date.js';

const executionInclude = {
  deliveries: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.EventExecutionInclude;

type StoredExecution = Prisma.EventExecutionGetPayload<{
  include: typeof executionInclude;
}>;

export function createPrismaEventExecutionStore(prisma: PrismaClient): EventExecutionStore {
  async function findByIdempotencyKey(kind: EventExecutionKind, idempotencyKey: string) {
    const execution = await prisma.eventExecution.findUnique({
      where: { kind_idempotencyKey: { kind, idempotencyKey } },
      include: executionInclude,
    });

    return execution
      ? {
          commandFingerprint: execution.commandFingerprint,
          receipt: mapExecution(execution),
        }
      : null;
  }

  return {
    findByIdempotencyKey,

    async createOnce(draft: EventExecutionDraft) {
      try {
        const execution = await prisma.$transaction(async (tx) => {
          const createdExecution = await tx.eventExecution.create({
            data: {
              kind: draft.kind,
              idempotencyKey: draft.idempotencyKey,
              commandFingerprint: draft.commandFingerprint,
              eventId: draft.eventId,
              campaignId: draft.campaignId,
              status: 'completed',
              halted: draft.halted,
              messages: draft.messages as Prisma.InputJsonValue,
              deliveries: {
                create: draft.deliveries.map((payload) => ({
                  payload: payload as Prisma.InputJsonValue,
                })),
              },
            },
            include: executionInclude,
          });

          if (draft.markEventFired) {
            const updated = await tx.event.updateMany({
              where: { id: draft.eventId, campaignId: draft.campaignId },
              data: { status: 'fired' },
            });

            if (updated.count !== 1) {
              throw new Error('The Event no longer belongs to the Campaign.');
            }
          }

          for (const effect of draft.effects) {
            await applyBlockEffect(tx, draft.campaignId, effect);
          }

          return createdExecution;
        });

        return { created: true, receipt: mapExecution(execution) };
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }

        const existing = await findByIdempotencyKey(draft.kind, draft.idempotencyKey);

        if (!existing) {
          throw error;
        }

        return { created: false, receipt: existing.receipt };
      }
    },

    async get(executionId: string) {
      const execution = await prisma.eventExecution.findUnique({
        where: { id: executionId },
        include: executionInclude,
      });
      return execution ? mapExecution(execution) : null;
    },

    async listRetryableDeliveries(input): Promise<RetryableDelivery[]> {
      const deliveries = await prisma.eventDelivery.findMany({
        where: {
          status: { in: ['pending', 'failed'] },
          nextAttemptAt: { lte: new Date() },
          // The disable handler sweeps queued rows; this also closes the race.
          execution: { campaign: { disabledAt: null } },
          ...(input.executionId ? { executionId: input.executionId } : {}),
        },
        orderBy: { nextAttemptAt: 'asc' },
        take: input.limit,
      });

      return deliveries.map((delivery) => ({
        id: delivery.id,
        executionId: delivery.executionId,
        payload: botDeliveryPayloadSchema.parse(delivery.payload),
      }));
    },

    async recordDeliveryResult(deliveryId, result: BotDeliveryResult) {
      const delivery = await prisma.eventDelivery.update({
        where: { id: deliveryId },
        data:
          result.status === 'delivered'
            ? {
                status: 'delivered',
                attempts: { increment: 1 },
                lastError: null,
                deliveredAt: new Date(),
              }
            : result.status === 'cancelled'
              ? { status: 'cancelled', lastError: null }
              : {
                  status: 'failed',
                  attempts: { increment: 1 },
                  lastError: result.error,
                  nextAttemptAt: new Date(),
                },
        select: { executionId: true },
      });
      const execution = await prisma.eventExecution.findUniqueOrThrow({
        where: { id: delivery.executionId },
        include: executionInclude,
      });
      return mapExecution(execution);
    },
  };
}

interface BlockEffectTransaction {
  campaign: {
    findUniqueOrThrow(args: Prisma.CampaignFindUniqueOrThrowArgs): PromiseLike<{
      gameDate: Prisma.JsonValue;
    }>;
  };
  quest: {
    create(args: Prisma.QuestCreateArgs): PromiseLike<{ id: string }>;
  };
  sessionSummary: {
    create(args: Prisma.SessionSummaryCreateArgs): PromiseLike<{ id: string }>;
  };
}

export async function applyBlockEffect(
  tx: BlockEffectTransaction,
  campaignId: string,
  effect: BlockEffect,
): Promise<void> {
  if (effect.kind === 'add-journal-entry') {
    const campaign = await tx.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: { gameDate: true },
    });
    const gameDate = parseGameDate(campaign.gameDate);
    await tx.sessionSummary.create({
      data: {
        title: effect.title,
        content: effect.content,
        campaignId,
        sessionDate: new Date(),
        ...(gameDate === null ? {} : { gameDate: toGameDateJson(gameDate) }),
        visible: effect.visible,
        channelId: effect.channelId,
      },
    });
    return;
  }

  await tx.quest.create({
    data: {
      name: effect.name,
      description: effect.description,
      campaignId,
      visible: effect.visible,
    },
  });
}

function mapExecution(execution: StoredExecution): EventExecutionReceipt {
  return {
    id: execution.id,
    idempotencyKey: execution.idempotencyKey,
    kind: parseKind(execution.kind),
    eventId: execution.eventId,
    campaignId: execution.campaignId,
    status: parseExecutionStatus(execution.status),
    halted: execution.halted,
    messages: parseBlockMessages(execution.messages),
    deliveries: execution.deliveries.map((delivery) => ({
      id: delivery.id,
      status: parseDeliveryStatus(delivery.status),
      attempts: delivery.attempts,
      ...(delivery.lastError ? { lastError: delivery.lastError } : {}),
      ...(delivery.deliveredAt ? { deliveredAt: delivery.deliveredAt.toISOString() } : {}),
    })),
    ...(execution.errorCode && execution.errorMessage
      ? {
          error: {
            code: execution.errorCode,
            message: execution.errorMessage,
          },
        }
      : {}),
    createdAt: execution.createdAt.toISOString(),
    completedAt: execution.completedAt.toISOString(),
  };
}

function parseBlockMessages(value: unknown): BlockMessage[] {
  if (!Array.isArray(value)) {
    throw new Error('Persisted Event execution messages are invalid.');
  }
  return value.map((message) => blockMessageSchema.parse(message));
}

function parseKind(value: string): EventExecutionKind {
  if (value === 'fire' || value === 'test-result') return value;
  throw new Error(`Unknown Event execution kind: ${value}`);
}

function parseExecutionStatus(value: string): EventExecutionStatus {
  if (value === 'completed' || value === 'failed') return value;
  throw new Error(`Unknown Event execution status: ${value}`);
}

function parseDeliveryStatus(value: string): EventDeliveryStatus {
  if (value === 'pending' || value === 'delivered' || value === 'failed' || value === 'cancelled') {
    return value;
  }
  throw new Error(`Unknown Event delivery status: ${value}`);
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'P2002';
}
