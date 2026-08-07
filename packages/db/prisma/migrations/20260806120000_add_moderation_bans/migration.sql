-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN "disabledAt" TIMESTAMP(3);
ALTER TABLE "campaigns" ADD COLUMN "disabledInternalNote" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "disabledPublicReason" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "disabledByUserId" TEXT;

-- CreateTable
CREATE TABLE "discord_user_bans" (
    "id" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "internalNote" TEXT NOT NULL,
    "reasonShownToUser" TEXT,
    "bannedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discord_user_bans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "discord_user_bans_discordUserId_key" ON "discord_user_bans"("discordUserId");

-- AddForeignKey
ALTER TABLE "discord_user_bans" ADD CONSTRAINT "discord_user_bans_bannedByUserId_fkey" FOREIGN KEY ("bannedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
