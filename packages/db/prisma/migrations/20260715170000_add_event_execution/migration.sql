CREATE TABLE "event_executions" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "commandFingerprint" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "halted" BOOLEAN NOT NULL DEFAULT false,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_deliveries" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "event_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_executions_kind_idempotencyKey_key"
ON "event_executions"("kind", "idempotencyKey");
CREATE INDEX "event_executions_eventId_createdAt_idx"
ON "event_executions"("eventId", "createdAt");
CREATE INDEX "event_executions_campaignId_createdAt_idx"
ON "event_executions"("campaignId", "createdAt");
CREATE INDEX "event_deliveries_status_nextAttemptAt_idx"
ON "event_deliveries"("status", "nextAttemptAt");
CREATE INDEX "event_deliveries_executionId_idx"
ON "event_deliveries"("executionId");

ALTER TABLE "event_executions"
ADD CONSTRAINT "event_executions_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_executions"
ADD CONSTRAINT "event_executions_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_deliveries"
ADD CONSTRAINT "event_deliveries_executionId_fkey"
FOREIGN KEY ("executionId") REFERENCES "event_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
