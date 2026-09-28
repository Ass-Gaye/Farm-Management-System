-- CreateTable
CREATE TABLE "public"."egg_inventory" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'pieces',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "egg_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."egg_sales" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "houseId" INTEGER,
    "flockId" INTEGER,
    "customerId" INTEGER,
    "incomeId" INTEGER,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2),
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "egg_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."egg_movements" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "houseId" INTEGER,
    "flockId" INTEGER,
    "dailyRecordId" INTEGER,
    "eggSaleId" INTEGER,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pieces',
    "balanceAfter" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "egg_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "egg_inventory_userId_key" ON "public"."egg_inventory"("userId");

-- CreateIndex
CREATE INDEX "egg_sales_userId_idx" ON "public"."egg_sales"("userId");

-- CreateIndex
CREATE INDEX "egg_sales_incomeId_idx" ON "public"."egg_sales"("incomeId");

-- CreateIndex
CREATE INDEX "egg_movements_userId_idx" ON "public"."egg_movements"("userId");

-- CreateIndex
CREATE INDEX "egg_movements_type_idx" ON "public"."egg_movements"("type");

-- CreateIndex
CREATE UNIQUE INDEX "egg_movements_dailyRecordId_type_key" ON "public"."egg_movements"("dailyRecordId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "egg_movements_eggSaleId_key" ON "public"."egg_movements"("eggSaleId");

-- AddForeignKey
ALTER TABLE "public"."egg_inventory" ADD CONSTRAINT "egg_inventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."egg_sales" ADD CONSTRAINT "egg_sales_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."egg_sales" ADD CONSTRAINT "egg_sales_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "public"."poultry_houses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."egg_sales" ADD CONSTRAINT "egg_sales_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "public"."flocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."egg_sales" ADD CONSTRAINT "egg_sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."egg_sales" ADD CONSTRAINT "egg_sales_incomeId_fkey" FOREIGN KEY ("incomeId") REFERENCES "public"."income"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."egg_movements" ADD CONSTRAINT "egg_movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."egg_movements" ADD CONSTRAINT "egg_movements_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "public"."poultry_houses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."egg_movements" ADD CONSTRAINT "egg_movements_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "public"."flocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."egg_movements" ADD CONSTRAINT "egg_movements_dailyRecordId_fkey" FOREIGN KEY ("dailyRecordId") REFERENCES "public"."daily_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."egg_movements" ADD CONSTRAINT "egg_movements_eggSaleId_fkey" FOREIGN KEY ("eggSaleId") REFERENCES "public"."egg_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
