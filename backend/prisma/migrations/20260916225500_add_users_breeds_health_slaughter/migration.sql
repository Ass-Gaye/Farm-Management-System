-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- Insert default user for existing data backfill
INSERT INTO "public"."users" ("email", "password", "name", "createdAt")
VALUES ('farmer@poultry.local', '$2b$10$cSBY1NQNjJdNDXNgtDu.cuDlCSnujZ92fEfa5DwOvcUZNn.gIuzTW', 'Farm Manager', CURRENT_TIMESTAMP)
ON CONFLICT ("email") DO NOTHING;

-- AlterTable poultry_houses: add column as nullable first, populate with default user id, then set NOT NULL
ALTER TABLE "public"."poultry_houses" ADD COLUMN "userId" INTEGER;

UPDATE "public"."poultry_houses"
SET "userId" = (SELECT "id" FROM "public"."users" WHERE "email" = 'farmer@poultry.local' LIMIT 1)
WHERE "userId" IS NULL;

ALTER TABLE "public"."poultry_houses" ALTER COLUMN "userId" SET NOT NULL;

-- AddForeignKey for poultry_houses
ALTER TABLE "public"."poultry_houses" ADD CONSTRAINT "poultry_houses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable breeds
CREATE TABLE "public"."breeds" (
    "id" SERIAL NOT NULL,
    "houseId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "numberOfBirds" INTEGER NOT NULL,
    "dateAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "breeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable bird_conditions
CREATE TABLE "public"."bird_conditions" (
    "id" SERIAL NOT NULL,
    "houseId" INTEGER NOT NULL,
    "breedId" INTEGER,
    "healthy" INTEGER NOT NULL DEFAULT 0,
    "sick" INTEGER NOT NULL DEFAULT 0,
    "weak" INTEGER NOT NULL DEFAULT 0,
    "underObservation" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bird_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable slaughter_plans
CREATE TABLE "public"."slaughter_plans" (
    "id" SERIAL NOT NULL,
    "houseId" INTEGER NOT NULL,
    "breedId" INTEGER,
    "numberOfBirds" INTEGER NOT NULL,
    "placementDate" TIMESTAMP(3) NOT NULL,
    "expectedSlaughterDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Upcoming',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slaughter_plans_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."breeds" ADD CONSTRAINT "breeds_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "public"."poultry_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bird_conditions" ADD CONSTRAINT "bird_conditions_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "public"."poultry_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bird_conditions" ADD CONSTRAINT "bird_conditions_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "public"."breeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."slaughter_plans" ADD CONSTRAINT "slaughter_plans_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "public"."poultry_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."slaughter_plans" ADD CONSTRAINT "slaughter_plans_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "public"."breeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
