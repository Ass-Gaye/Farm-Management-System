-- CreateEnum
CREATE TYPE "public"."FlockPurpose" AS ENUM ('BROILER', 'LAYER', 'BREEDER', 'DUAL_PURPOSE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."FlockStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'SOLD', 'SLAUGHTERED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."VaccinationStatus" AS ENUM ('PENDING', 'COMPLETED', 'MISSED');

-- CreateEnum
CREATE TYPE "public"."DepopulationReason" AS ENUM ('SOLD', 'SLAUGHTERED', 'CULLED', 'TRANSFERRED', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PAID', 'PARTIALLY_PAID', 'UNPAID');

-- CreateEnum
CREATE TYPE "public"."InventoryMovementType" AS ENUM ('PURCHASE', 'CONSUMPTION', 'ADJUSTMENT', 'WASTAGE', 'RETURN');

-- AlterTable
ALTER TABLE "public"."poultry_houses" ADD COLUMN     "address" TEXT;

-- AlterTable
ALTER TABLE "public"."users" ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);
