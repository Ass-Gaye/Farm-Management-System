-- AlterTable
ALTER TABLE "public"."egg_movements" ADD COLUMN "correctionId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "egg_movements_correctionId_key" ON "public"."egg_movements"("correctionId");

-- AddForeignKey
ALTER TABLE "public"."egg_movements" ADD CONSTRAINT "egg_movements_correctionId_fkey" FOREIGN KEY ("correctionId") REFERENCES "public"."daily_record_corrections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
