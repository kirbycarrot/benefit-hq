-- Add the client onboarding workspace beside the existing Client model. All
-- existing client, plan-year, policy, census, and deck data remains intact.

-- AlterTable
ALTER TABLE "BenefitPlan" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "BenefitProgram" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PlanRate" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ClientProfile" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "website" TEXT,
    "primaryIndustry" TEXT,
    "secondaryIndustry" TEXT,
    "industryCode" TEXT,
    "ownershipType" TEXT,
    "parentCompany" TEXT,
    "privateEquitySponsor" TEXT,
    "fiscalYearEndMonth" INTEGER,
    "fiscalYearEndDay" INTEGER,
    "primaryRenewalMonth" INTEGER,
    "primaryRenewalDay" INTEGER,
    "usEmployeeCount" INTEGER,
    "globalEmployeeCount" INTEGER,
    "benefitsEligibleCount" INTEGER,
    "enrolledEmployeeCount" INTEGER,
    "entityStructure" TEXT,
    "numberOfEins" INTEGER,
    "benefitsConsistentAcrossEntities" BOOLEAN,
    "hasUnionPopulation" BOOLEAN,
    "hasCollectivelyBargainedPlans" BOOLEAN,
    "hasAcquiredCompanies" BOOLEAN,
    "hasInternationalEmployees" BOOLEAN,
    "workforceTypes" JSONB NOT NULL DEFAULT '[]',
    "coveredThroughPeo" BOOLEAN,
    "statesWithEmployees" JSONB NOT NULL DEFAULT '[]',
    "remoteEmployeePercentage" DECIMAL(5,2),
    "benefitChallenges" TEXT,
    "renewalSuccessOutcomes" TEXT,
    "budgetTarget" DECIMAL(14,2),
    "maximumAcceptableIncrease" DECIMAL(5,2),
    "disruptionTolerance" TEXT,
    "excludedCarriers" JSONB NOT NULL DEFAULT '[]',
    "acquisitionsExpected" BOOLEAN,
    "headcountChangesExpected" BOOLEAN,
    "harmonizationUnderway" BOOLEAN,
    "preparingForTransaction" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClientProfile_dates_check" CHECK (
      ("fiscalYearEndMonth" IS NULL OR "fiscalYearEndMonth" BETWEEN 1 AND 12)
      AND ("fiscalYearEndDay" IS NULL OR "fiscalYearEndDay" BETWEEN 1 AND 31)
      AND ("primaryRenewalMonth" IS NULL OR "primaryRenewalMonth" BETWEEN 1 AND 12)
      AND ("primaryRenewalDay" IS NULL OR "primaryRenewalDay" BETWEEN 1 AND 31)
    ),
    CONSTRAINT "ClientProfile_counts_check" CHECK (
      ("usEmployeeCount" IS NULL OR "usEmployeeCount" >= 0)
      AND ("globalEmployeeCount" IS NULL OR "globalEmployeeCount" >= 0)
      AND ("benefitsEligibleCount" IS NULL OR "benefitsEligibleCount" >= 0)
      AND ("enrolledEmployeeCount" IS NULL OR "enrolledEmployeeCount" >= 0)
      AND ("numberOfEins" IS NULL OR "numberOfEins" >= 1)
    ),
    CONSTRAINT "ClientProfile_percentages_check" CHECK (
      ("remoteEmployeePercentage" IS NULL OR "remoteEmployeePercentage" BETWEEN 0 AND 100)
      AND ("maximumAcceptableIncrease" IS NULL OR "maximumAcceptableIncrease" BETWEEN 0 AND 100)
      AND ("budgetTarget" IS NULL OR "budgetTarget" >= 0)
    )
);

-- CreateTable
CREATE TABLE "ClientTeamAssignment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientTeamAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientContact" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "roles" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientLocation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'United States',
    "isHeadquarters" BOOLEAN NOT NULL DEFAULT false,
    "employeeCount" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientLocation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClientLocation_employee_count_check" CHECK ("employeeCount" IS NULL OR "employeeCount" >= 0)
);

-- CreateTable
CREATE TABLE "ClientEntity" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "taxIdLastFour" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPriority" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "currentState" TEXT,
    "desiredOutcome" TEXT,
    "measurementKpi" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPriority_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClientPriority_rank_check" CHECK ("rank" >= 1)
);

-- CreateTable
CREATE TABLE "ClientDocument" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "planYearId" TEXT,
    "category" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientDocument_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClientDocument_size_check" CHECK ("sizeBytes" > 0)
);

-- Existing clients start with a draft profile using the name already shown in
-- navigation and reports. The remaining intake sections can be completed over time.
INSERT INTO "ClientProfile" (
  "id", "clientId", "legalName", "createdAt", "updatedAt"
)
SELECT
  'client-profile-' || md5("id"),
  "id",
  "name",
  "createdAt",
  CURRENT_TIMESTAMP
FROM "Client";

-- CreateIndex
CREATE UNIQUE INDEX "ClientProfile_clientId_key" ON "ClientProfile"("clientId");

-- CreateIndex
CREATE INDEX "ClientTeamAssignment_userId_idx" ON "ClientTeamAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientTeamAssignment_clientId_role_key" ON "ClientTeamAssignment"("clientId", "role");

-- CreateIndex
CREATE INDEX "ClientContact_clientId_sortOrder_idx" ON "ClientContact"("clientId", "sortOrder");

-- CreateIndex
CREATE INDEX "ClientLocation_clientId_sortOrder_idx" ON "ClientLocation"("clientId", "sortOrder");
CREATE UNIQUE INDEX "ClientLocation_clientId_headquarters_key" ON "ClientLocation"("clientId") WHERE "isHeadquarters" = true;

-- CreateIndex
CREATE INDEX "ClientEntity_clientId_sortOrder_idx" ON "ClientEntity"("clientId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPriority_clientId_objective_key" ON "ClientPriority"("clientId", "objective");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPriority_clientId_rank_key" ON "ClientPriority"("clientId", "rank");

-- CreateIndex
CREATE INDEX "ClientDocument_clientId_category_idx" ON "ClientDocument"("clientId", "category");

-- CreateIndex
CREATE INDEX "ClientDocument_planYearId_idx" ON "ClientDocument"("planYearId");

-- CreateIndex
CREATE INDEX "ClientDocument_uploadedById_idx" ON "ClientDocument"("uploadedById");

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTeamAssignment" ADD CONSTRAINT "ClientTeamAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTeamAssignment" ADD CONSTRAINT "ClientTeamAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientLocation" ADD CONSTRAINT "ClientLocation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientEntity" ADD CONSTRAINT "ClientEntity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPriority" ADD CONSTRAINT "ClientPriority_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_planYearId_fkey" FOREIGN KEY ("planYearId") REFERENCES "PlanYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
