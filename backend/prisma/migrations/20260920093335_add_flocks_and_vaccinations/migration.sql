-- AlterTable
ALTER TABLE "public"."bird_conditions" ADD COLUMN     "flockId" INTEGER;

-- AlterTable
ALTER TABLE "public"."daily_records" ADD COLUMN     "avgWeightGrams" DOUBLE PRECISION,
ADD COLUMN     "flockId" INTEGER;

-- AlterTable
ALTER TABLE "public"."expenses" ADD COLUMN     "flockId" INTEGER;

-- AlterTable
ALTER TABLE "public"."income" ADD COLUMN     "flockId" INTEGER;

-- AlterTable
ALTER TABLE "public"."slaughter_plans" ADD COLUMN     "flockId" INTEGER;

-- CreateTable
CREATE TABLE "public"."flocks" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "houseId" INTEGER NOT NULL,
    "breedId" INTEGER,
    "name" TEXT NOT NULL,
    "batchNumber" TEXT,
    "purpose" TEXT NOT NULL DEFAULT 'BROILER',
    "birdsPlaced" INTEGER NOT NULL,
    "currentBirds" INTEGER NOT NULL,
    "placementDate" TIMESTAMP(3) NOT NULL,
    "expectedMarketDate" TIMESTAMP(3),
    "targetWeightKg" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vaccinations" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "flockId" INTEGER NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "disease" TEXT,
    "targetAgeDays" INTEGER,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "administeredDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dosage" TEXT,
    "administeredBy" TEXT,
    "cost" DECIMAL(12,2) DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vaccinations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flocks_userId_idx" ON "public"."flocks"("userId");

-- CreateIndex
CREATE INDEX "flocks_houseId_idx" ON "public"."flocks"("houseId");

-- CreateIndex
CREATE INDEX "flocks_status_idx" ON "public"."flocks"("status");

-- CreateIndex
CREATE INDEX "vaccinations_userId_idx" ON "public"."vaccinations"("userId");

-- CreateIndex
CREATE INDEX "vaccinations_flockId_idx" ON "public"."vaccinations"("flockId");

-- CreateIndex
CREATE INDEX "vaccinations_status_idx" ON "public"."vaccinations"("status");

-- CreateIndex
CREATE INDEX "bird_conditions_flockId_idx" ON "public"."bird_conditions"("flockId");

-- CreateIndex
CREATE INDEX "daily_records_flockId_idx" ON "public"."daily_records"("flockId");

-- CreateIndex
CREATE INDEX "expenses_flockId_idx" ON "public"."expenses"("flockId");

-- CreateIndex
CREATE INDEX "income_flockId_idx" ON "public"."income"("flockId");

-- CreateIndex
CREATE INDEX "slaughter_plans_flockId_idx" ON "public"."slaughter_plans"("flockId");

-- AddForeignKey
ALTER TABLE "public"."daily_records" ADD CONSTRAINT "daily_records_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "public"."flocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bird_conditions" ADD CONSTRAINT "bird_conditions_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "public"."flocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."slaughter_plans" ADD CONSTRAINT "slaughter_plans_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "public"."flocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expenses" ADD CONSTRAINT "expenses_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "public"."flocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."income" ADD CONSTRAINT "income_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "public"."flocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."flocks" ADD CONSTRAINT "flocks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."flocks" ADD CONSTRAINT "flocks_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "public"."poultry_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."flocks" ADD CONSTRAINT "flocks_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "public"."breeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vaccinations" ADD CONSTRAINT "vaccinations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vaccinations" ADD CONSTRAINT "vaccinations_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "public"."flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
