/*
  Warnings:

  - A unique constraint covering the columns `[houseId,date]` on the table `daily_records` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "daily_records_houseId_date_key" ON "public"."daily_records"("houseId", "date");
