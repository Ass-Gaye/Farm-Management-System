-- CreateTable
CREATE TABLE "public"."poultry_houses" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "birdsPlaced" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poultry_houses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."daily_records" (
    "id" SERIAL NOT NULL,
    "houseId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mortality" INTEGER NOT NULL DEFAULT 0,
    "feedUsedKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "eggsCollected" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_records_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."daily_records" ADD CONSTRAINT "daily_records_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "public"."poultry_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
