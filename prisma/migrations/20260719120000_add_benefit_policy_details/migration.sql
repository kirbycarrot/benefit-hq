-- Add the richer policy-details model beside the legacy PolicyLine table.
-- The legacy rows remain in place so the application can be rolled back without
-- a destructive reverse migration.
CREATE TABLE "BenefitProgram" (
    "id" TEXT NOT NULL,
    "planYearId" TEXT NOT NULL,
    "benefitType" TEXT NOT NULL,
    "offered" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BenefitProgram_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BenefitPlan" (
    "id" TEXT NOT NULL,
    "benefitProgramId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subtype" TEXT NOT NULL,
    "offered" BOOLEAN NOT NULL DEFAULT true,
    "details" JSONB NOT NULL DEFAULT '{}',
    "detailSchemaVersion" INTEGER NOT NULL DEFAULT 1,
    "renewedFromPlanId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BenefitPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanRate" (
    "id" TEXT NOT NULL,
    "benefitPlanId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "grossPremium" DECIMAL(10,2) NOT NULL,
    "employeeContribution" DECIMAL(10,2) NOT NULL,
    "employerContribution" DECIMAL(10,2) NOT NULL,
    "ratePeriod" TEXT NOT NULL DEFAULT 'monthly',
    "enrollmentOverride" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanRate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PlanRate_amounts_check" CHECK (
      "grossPremium" >= 0
      AND "employeeContribution" >= 0
      AND "employerContribution" >= 0
      AND "grossPremium" = "employeeContribution" + "employerContribution"
    ),
    CONSTRAINT "PlanRate_period_check" CHECK ("ratePeriod" IN ('monthly', 'per-pay-period', 'annual')),
    CONSTRAINT "PlanRate_enrollment_check" CHECK ("enrollmentOverride" IS NULL OR "enrollmentOverride" >= 0)
);

CREATE TABLE "PlanAlias" (
    "id" TEXT NOT NULL,
    "benefitPlanId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BenefitProgram_planYearId_benefitType_key" ON "BenefitProgram"("planYearId", "benefitType");
CREATE INDEX "BenefitProgram_planYearId_sortOrder_idx" ON "BenefitProgram"("planYearId", "sortOrder");
CREATE INDEX "BenefitPlan_benefitProgramId_sortOrder_idx" ON "BenefitPlan"("benefitProgramId", "sortOrder");
CREATE INDEX "BenefitPlan_renewedFromPlanId_idx" ON "BenefitPlan"("renewedFromPlanId");
CREATE UNIQUE INDEX "PlanRate_benefitPlanId_tier_key" ON "PlanRate"("benefitPlanId", "tier");
CREATE INDEX "PlanRate_benefitPlanId_sortOrder_idx" ON "PlanRate"("benefitPlanId", "sortOrder");
CREATE UNIQUE INDEX "PlanAlias_benefitPlanId_normalizedAlias_key" ON "PlanAlias"("benefitPlanId", "normalizedAlias");
CREATE INDEX "PlanAlias_normalizedAlias_idx" ON "PlanAlias"("normalizedAlias");

ALTER TABLE "BenefitProgram" ADD CONSTRAINT "BenefitProgram_planYearId_fkey"
FOREIGN KEY ("planYearId") REFERENCES "PlanYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BenefitPlan" ADD CONSTRAINT "BenefitPlan_benefitProgramId_fkey"
FOREIGN KEY ("benefitProgramId") REFERENCES "BenefitProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BenefitPlan" ADD CONSTRAINT "BenefitPlan_renewedFromPlanId_fkey"
FOREIGN KEY ("renewedFromPlanId") REFERENCES "BenefitPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlanRate" ADD CONSTRAINT "PlanRate_benefitPlanId_fkey"
FOREIGN KEY ("benefitPlanId") REFERENCES "BenefitPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanAlias" ADD CONSTRAINT "PlanAlias_benefitPlanId_fkey"
FOREIGN KEY ("benefitPlanId") REFERENCES "BenefitPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill the new structure from existing policy lines. IDs are deterministic
-- so the migration remains idempotent during restore/rehearsal workflows.
INSERT INTO "BenefitProgram" ("id", "planYearId", "benefitType", "offered", "sortOrder", "createdAt", "updatedAt")
SELECT
  'legacy-program-' || md5("planYearId" || ':' || CASE WHEN "coverageType" = 'Life' THEN 'BasicLife' ELSE "coverageType" END),
  "planYearId",
  CASE WHEN "coverageType" = 'Life' THEN 'BasicLife' ELSE "coverageType" END,
  true,
  MIN("sortOrder"),
  MIN("createdAt"),
  CURRENT_TIMESTAMP
FROM "PolicyLine"
GROUP BY "planYearId", CASE WHEN "coverageType" = 'Life' THEN 'BasicLife' ELSE "coverageType" END;

INSERT INTO "BenefitPlan" ("id", "benefitProgramId", "name", "subtype", "offered", "details", "detailSchemaVersion", "sortOrder", "createdAt", "updatedAt")
SELECT
  'legacy-plan-' || md5("planYearId" || ':' || "coverageType" || ':' || "planName"),
  'legacy-program-' || md5("planYearId" || ':' || CASE WHEN "coverageType" = 'Life' THEN 'BasicLife' ELSE "coverageType" END),
  "planName",
  CASE
    WHEN "coverageType" = 'Medical' AND lower("planName") ~ '(hdhp|hsa)' THEN 'HDHP'
    WHEN "coverageType" = 'Medical' AND lower("planName") LIKE '%hmo%' THEN 'HMO'
    WHEN "coverageType" = 'Medical' THEN 'PPO'
    WHEN "coverageType" = 'Dental' AND lower("planName") LIKE '%hmo%' THEN 'DHMO'
    WHEN "coverageType" = 'Dental' THEN 'DPPO'
    WHEN "coverageType" = 'Vision' THEN 'Vision'
    WHEN "coverageType" = 'Life' THEN 'Basic Life'
    ELSE "coverageType"
  END,
  true,
  '{}'::jsonb,
  1,
  MIN("sortOrder"),
  MIN("createdAt"),
  CURRENT_TIMESTAMP
FROM "PolicyLine"
GROUP BY "planYearId", "coverageType", "planName";

INSERT INTO "PlanRate" ("id", "benefitPlanId", "tier", "grossPremium", "employeeContribution", "employerContribution", "ratePeriod", "sortOrder", "createdAt", "updatedAt")
SELECT DISTINCT ON ("planYearId", "coverageType", "planName", "tier")
  'legacy-rate-' || md5("id"),
  'legacy-plan-' || md5("planYearId" || ':' || "coverageType" || ':' || "planName"),
  "tier",
  "totalPremium",
  "employeeCost",
  "employerCost",
  "ratePeriod",
  "sortOrder",
  "createdAt",
  CURRENT_TIMESTAMP
FROM "PolicyLine"
WHERE "coverageType" IN ('Medical', 'Dental', 'Vision')
ORDER BY "planYearId", "coverageType", "planName", "tier", "createdAt" DESC, "id" DESC;

INSERT INTO "PlanAlias" ("id", "benefitPlanId", "alias", "normalizedAlias", "createdAt")
SELECT
  'legacy-alias-' || md5("planYearId" || ':' || "coverageType" || ':' || "planName"),
  'legacy-plan-' || md5("planYearId" || ':' || "coverageType" || ':' || "planName"),
  "planName",
  lower(regexp_replace(trim("planName"), '[[:space:]]+', ' ', 'g')),
  MIN("createdAt")
FROM "PolicyLine"
GROUP BY "planYearId", "coverageType", "planName";
