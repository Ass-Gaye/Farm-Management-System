-- CreateTable
CREATE TABLE "public"."depopulation_events" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "flockId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "incomeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "depopulation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "depopulation_events_userId_idx" ON "public"."depopulation_events"("userId");

-- CreateIndex
CREATE INDEX "depopulation_events_flockId_idx" ON "public"."depopulation_events"("flockId");

-- CreateIndex
CREATE INDEX "depopulation_events_incomeId_idx" ON "public"."depopulation_events"("incomeId");

-- AddForeignKey
ALTER TABLE "public"."depopulation_events" ADD CONSTRAINT "depopulation_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."depopulation_events" ADD CONSTRAINT "depopulation_events_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "public"."flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."depopulation_events" ADD CONSTRAINT "depopulation_events_incomeId_fkey" FOREIGN KEY ("incomeId") REFERENCES "public"."income"("id") ON DELETE SET NULL ON UPDATE CASCADE;
