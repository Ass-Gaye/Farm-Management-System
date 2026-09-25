-- CreateTable
CREATE TABLE "public"."daily_record_corrections" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "dailyRecordId" INTEGER NOT NULL,
    "field" TEXT NOT NULL,
    "previousValue" DOUBLE PRECISION NOT NULL,
    "correctedValue" DOUBLE PRECISION NOT NULL,
    "adjustment" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_record_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_record_corrections_dailyRecordId_idx" ON "public"."daily_record_corrections"("dailyRecordId");

-- CreateIndex
CREATE INDEX "daily_record_corrections_userId_idx" ON "public"."daily_record_corrections"("userId");

-- AddForeignKey
ALTER TABLE "public"."daily_record_corrections" ADD CONSTRAINT "daily_record_corrections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."daily_record_corrections" ADD CONSTRAINT "daily_record_corrections_dailyRecordId_fkey" FOREIGN KEY ("dailyRecordId") REFERENCES "public"."daily_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
