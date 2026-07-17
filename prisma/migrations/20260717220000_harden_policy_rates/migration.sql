-- Existing policy lines predate explicit rate periods. They were presented as
-- unqualified rates, so preserve them as monthly and repair any inconsistent
-- totals before enforcing the invariant at the database boundary.
ALTER TABLE "PolicyLine"
ADD COLUMN "ratePeriod" TEXT NOT NULL DEFAULT 'monthly';

UPDATE "PolicyLine"
SET "totalPremium" = "employeeCost" + "employerCost";

ALTER TABLE "PolicyLine"
ADD CONSTRAINT "PolicyLine_ratePeriod_check"
CHECK ("ratePeriod" IN ('monthly', 'per-pay-period', 'annual'));

ALTER TABLE "PolicyLine"
ADD CONSTRAINT "PolicyLine_totalPremium_check"
CHECK ("totalPremium" = "employeeCost" + "employerCost");
