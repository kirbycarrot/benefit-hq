-- AlterTable
ALTER TABLE "BenefitPlan" ADD COLUMN     "carrierName" TEXT;

-- CreateTable
CREATE TABLE "Carrier" (
    "id" TEXT NOT NULL,
    "benefitType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Carrier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Carrier_benefitType_idx" ON "Carrier"("benefitType");

-- CreateIndex
CREATE UNIQUE INDEX "Carrier_benefitType_name_key" ON "Carrier"("benefitType", "name");
