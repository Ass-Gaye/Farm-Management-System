-- AlterTable
ALTER TABLE "public"."expenses" ADD COLUMN     "amountDue" DECIMAL(12,2) DEFAULT 0,
ADD COLUMN     "amountPaid" DECIMAL(12,2) DEFAULT 0,
ADD COLUMN     "paymentStatus" TEXT DEFAULT 'PAID',
ADD COLUMN     "quantity" DECIMAL(12,2),
ADD COLUMN     "supplierId" INTEGER,
ADD COLUMN     "unit" TEXT,
ADD COLUMN     "unitPrice" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "public"."income" ADD COLUMN     "amountDue" DECIMAL(12,2) DEFAULT 0,
ADD COLUMN     "amountPaid" DECIMAL(12,2) DEFAULT 0,
ADD COLUMN     "customerId" INTEGER,
ADD COLUMN     "paymentStatus" TEXT DEFAULT 'PAID',
ADD COLUMN     "quantity" DECIMAL(12,2),
ADD COLUMN     "unit" TEXT,
ADD COLUMN     "unitPrice" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "public"."customers" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."suppliers" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "category" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_userId_idx" ON "public"."customers"("userId");

-- CreateIndex
CREATE INDEX "suppliers_userId_idx" ON "public"."suppliers"("userId");

-- CreateIndex
CREATE INDEX "expenses_supplierId_idx" ON "public"."expenses"("supplierId");

-- CreateIndex
CREATE INDEX "income_customerId_idx" ON "public"."income"("customerId");

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."suppliers" ADD CONSTRAINT "suppliers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expenses" ADD CONSTRAINT "expenses_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."income" ADD CONSTRAINT "income_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
