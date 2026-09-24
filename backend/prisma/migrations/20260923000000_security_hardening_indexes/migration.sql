-- Additive hardening migration: missing indexes + User.updatedAt.
-- Enums are application-level only in this step (columns stay TEXT); a
-- follow-up migration can alter column types to native PG enums.
-- Run with: npx prisma migrate dev (requires DATABASE_URL/DIRECT_URL).

CREATE INDEX IF NOT EXISTS "breeds_houseId_idx" ON "breeds"("houseId");
CREATE INDEX IF NOT EXISTS "bird_conditions_houseId_idx" ON "bird_conditions"("houseId");
CREATE INDEX IF NOT EXISTS "slaughter_plans_houseId_idx" ON "slaughter_plans"("houseId");

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;
