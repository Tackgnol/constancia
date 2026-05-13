ALTER TABLE "user" ADD COLUMN "isSuperUser" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "MessageReportStatus" AS ENUM ('pending', 'reviewed', 'dismissed');

CREATE TABLE "message_reports" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "campaignId" TEXT,
    "discordGuildId" TEXT,
    "discordChannelId" TEXT,
    "discordMessageId" TEXT,
    "discordUserId" TEXT NOT NULL,
    "messageTarget" TEXT,
    "messageContent" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "status" "MessageReportStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,

    CONSTRAINT "message_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "message_reports_status_createdAt_idx" ON "message_reports"("status", "createdAt");
CREATE INDEX "message_reports_eventId_idx" ON "message_reports"("eventId");
CREATE INDEX "message_reports_campaignId_idx" ON "message_reports"("campaignId");

ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
