CREATE TYPE "TestInstanceStatus" AS ENUM ('open', 'closed');

CREATE TABLE "test_instances" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "status" "TestInstanceStatus" NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "test_instances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "test_submissions" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "playerScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "test_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "test_instances_executionId_key" ON "test_instances"("executionId");
CREATE INDEX "test_instances_eventId_createdAt_idx" ON "test_instances"("eventId", "createdAt");
CREATE UNIQUE INDEX "test_submissions_instanceId_discordUserId_key"
ON "test_submissions"("instanceId", "discordUserId");

ALTER TABLE "test_instances"
ADD CONSTRAINT "test_instances_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "test_instances"
ADD CONSTRAINT "test_instances_executionId_fkey"
FOREIGN KEY ("executionId") REFERENCES "event_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "test_submissions"
ADD CONSTRAINT "test_submissions_instanceId_fkey"
FOREIGN KEY ("instanceId") REFERENCES "test_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
