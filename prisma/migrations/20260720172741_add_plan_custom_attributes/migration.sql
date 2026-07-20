-- AlterTable
ALTER TABLE "BenefitPlan" ADD COLUMN     "customAttributes" JSONB NOT NULL DEFAULT '[]';
