-- CreateTable
CREATE TABLE "lore_entries" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lore_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lore_knowledge" (
    "characterId" TEXT NOT NULL,
    "loreEntryId" TEXT NOT NULL,
    "revealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lore_knowledge_pkey" PRIMARY KEY ("characterId","loreEntryId")
);

-- CreateIndex
CREATE INDEX "lore_entries_campaignId_sortOrder_idx" ON "lore_entries"("campaignId", "sortOrder");

-- AddForeignKey
ALTER TABLE "lore_entries" ADD CONSTRAINT "lore_entries_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lore_knowledge" ADD CONSTRAINT "lore_knowledge_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lore_knowledge" ADD CONSTRAINT "lore_knowledge_loreEntryId_fkey" FOREIGN KEY ("loreEntryId") REFERENCES "lore_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
