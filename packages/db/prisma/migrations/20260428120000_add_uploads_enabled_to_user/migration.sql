-- AlterTable
ALTER TABLE "user" ADD COLUMN "uploadsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN "uploadAllowanceBytes" INTEGER NOT NULL DEFAULT 52428800;

-- CreateTable
CREATE TABLE "upload_assets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "bucket" TEXT,
    "publicUrl" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalMimeType" TEXT NOT NULL,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "upload_assets_storageKey_key" ON "upload_assets"("storageKey");

-- CreateIndex
CREATE INDEX "upload_assets_userId_createdAt_idx" ON "upload_assets"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "upload_assets_eventId_idx" ON "upload_assets"("eventId");

-- AddForeignKey
ALTER TABLE "upload_assets" ADD CONSTRAINT "upload_assets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_assets" ADD CONSTRAINT "upload_assets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
