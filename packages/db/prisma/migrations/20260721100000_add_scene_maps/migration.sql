-- AlterTable
ALTER TABLE "upload_assets" ADD COLUMN     "sceneId" TEXT;

-- CreateTable
CREATE TABLE "scenes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_pegs" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "eventId" TEXT,
    "npcId" TEXT,
    "loreEntryId" TEXT,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scene_pegs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scenes_campaignId_createdAt_idx" ON "scenes"("campaignId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "scene_pegs_sceneId_eventId_key" ON "scene_pegs"("sceneId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "scene_pegs_sceneId_npcId_key" ON "scene_pegs"("sceneId", "npcId");

-- CreateIndex
CREATE UNIQUE INDEX "scene_pegs_sceneId_loreEntryId_key" ON "scene_pegs"("sceneId", "loreEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "upload_assets_sceneId_key" ON "upload_assets"("sceneId");

-- AddForeignKey
ALTER TABLE "upload_assets" ADD CONSTRAINT "upload_assets_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_pegs" ADD CONSTRAINT "scene_pegs_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_pegs" ADD CONSTRAINT "scene_pegs_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_pegs" ADD CONSTRAINT "scene_pegs_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "npcs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_pegs" ADD CONSTRAINT "scene_pegs_loreEntryId_fkey" FOREIGN KEY ("loreEntryId") REFERENCES "lore_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Constraints Prisma Schema Language cannot express.
-- An upload asset belongs to at most one owner resource.
ALTER TABLE "upload_assets"
    ADD CONSTRAINT "upload_assets_single_owner_check"
    CHECK ("eventId" IS NULL OR "sceneId" IS NULL);

-- A peg points at exactly one target.
ALTER TABLE "scene_pegs"
    ADD CONSTRAINT "scene_pegs_exactly_one_target_check"
    CHECK (
        (CASE WHEN "eventId" IS NULL THEN 0 ELSE 1 END)
        + (CASE WHEN "npcId" IS NULL THEN 0 ELSE 1 END)
        + (CASE WHEN "loreEntryId" IS NULL THEN 0 ELSE 1 END)
        = 1
    );

-- Peg coordinates are normalized to the map image.
ALTER TABLE "scene_pegs"
    ADD CONSTRAINT "scene_pegs_x_range_check" CHECK ("x" >= 0 AND "x" <= 1);

ALTER TABLE "scene_pegs"
    ADD CONSTRAINT "scene_pegs_y_range_check" CHECK ("y" >= 0 AND "y" <= 1);
