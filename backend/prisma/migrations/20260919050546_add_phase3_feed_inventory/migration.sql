-- AlterTable
ALTER TABLE "public"."daily_records" ADD COLUMN     "feedTypeId" INTEGER;

-- AlterTable
ALTER TABLE "public"."expenses" ADD COLUMN     "feedTypeId" INTEGER;

-- CreateTable
CREATE TABLE "public"."feed_types" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'FEED',
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "bagWeightKg" DOUBLE PRECISION DEFAULT 50,
    "minimumStock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currentStock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feed_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inventory_movements" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "feedTypeId" INTEGER NOT NULL,
    "houseId" INTEGER,
    "dailyRecordId" INTEGER,
    "expenseId" INTEGER,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitCost" DECIMAL(12,2),
    "totalCost" DECIMAL(12,2),
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feed_types_userId_idx" ON "public"."feed_types"("userId");

-- CreateIndex
CREATE INDEX "feed_types_userId_category_idx" ON "public"."feed_types"("userId", "category");

-- CreateIndex
CREATE INDEX "inventory_movements_userId_date_idx" ON "public"."inventory_movements"("userId", "date");

-- CreateIndex
CREATE INDEX "inventory_movements_feedTypeId_idx" ON "public"."inventory_movements"("feedTypeId");

-- CreateIndex
CREATE INDEX "inventory_movements_houseId_idx" ON "public"."inventory_movements"("houseId");

-- CreateIndex
CREATE INDEX "inventory_movements_type_idx" ON "public"."inventory_movements"("type");

-- CreateIndex
CREATE INDEX "daily_records_feedTypeId_idx" ON "public"."daily_records"("feedTypeId");

-- CreateIndex
CREATE INDEX "expenses_feedTypeId_idx" ON "public"."expenses"("feedTypeId");

-- AddForeignKey
ALTER TABLE "public"."daily_records" ADD CONSTRAINT "daily_records_feedTypeId_fkey" FOREIGN KEY ("feedTypeId") REFERENCES "public"."feed_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expenses" ADD CONSTRAINT "expenses_feedTypeId_fkey" FOREIGN KEY ("feedTypeId") REFERENCES "public"."feed_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feed_types" ADD CONSTRAINT "feed_types_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_movements" ADD CONSTRAINT "inventory_movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_movements" ADD CONSTRAINT "inventory_movements_feedTypeId_fkey" FOREIGN KEY ("feedTypeId") REFERENCES "public"."feed_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_movements" ADD CONSTRAINT "inventory_movements_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "public"."poultry_houses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_movements" ADD CONSTRAINT "inventory_movements_dailyRecordId_fkey" FOREIGN KEY ("dailyRecordId") REFERENCES "public"."daily_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_movements" ADD CONSTRAINT "inventory_movements_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "public"."expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
