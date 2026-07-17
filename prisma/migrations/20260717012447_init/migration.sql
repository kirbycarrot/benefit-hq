-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoPath" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#1F2937',
    "secondaryColor" TEXT NOT NULL DEFAULT '#14B8A6',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanYear" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyLine" (
    "id" TEXT NOT NULL,
    "planYearId" TEXT NOT NULL,
    "coverageType" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "employeeCost" DECIMAL(10,2) NOT NULL,
    "employerCost" DECIMAL(10,2) NOT NULL,
    "totalPremium" DECIMAL(10,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CensusUpload" (
    "id" TEXT NOT NULL,
    "planYearId" TEXT NOT NULL,
    "filenames" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "warnings" JSONB NOT NULL,
    "summary" JSONB,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CensusUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "planYearId" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "gender" TEXT,
    "hireDate" TIMESTAMP(3),
    "employmentStatus" TEXT,
    "baseSalary" DECIMAL(12,2),
    "postalCode" TEXT,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dependent" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "birthDate" TIMESTAMP(3),
    "gender" TEXT,
    "relationshipType" TEXT,

    CONSTRAINT "Dependent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenefitElection" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "benefitType" TEXT NOT NULL,
    "planName" TEXT,
    "optionName" TEXT,
    "volume" DECIMAL(12,2),

    CONSTRAINT "BenefitElection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "defaultEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChartDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckConfig" (
    "id" TEXT NOT NULL,
    "planYearId" TEXT NOT NULL,
    "selections" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeckConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" TEXT NOT NULL,
    "planYearId" TEXT NOT NULL,
    "filePath" TEXT,
    "status" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PlanYear_clientId_label_key" ON "PlanYear"("clientId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_planYearId_employeeNumber_key" ON "Employee"("planYearId", "employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ChartDefinition_key_key" ON "ChartDefinition"("key");

-- CreateIndex
CREATE UNIQUE INDEX "DeckConfig_planYearId_key" ON "DeckConfig"("planYearId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanYear" ADD CONSTRAINT "PlanYear_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyLine" ADD CONSTRAINT "PolicyLine_planYearId_fkey" FOREIGN KEY ("planYearId") REFERENCES "PlanYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CensusUpload" ADD CONSTRAINT "CensusUpload_planYearId_fkey" FOREIGN KEY ("planYearId") REFERENCES "PlanYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_planYearId_fkey" FOREIGN KEY ("planYearId") REFERENCES "PlanYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependent" ADD CONSTRAINT "Dependent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitElection" ADD CONSTRAINT "BenefitElection_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckConfig" ADD CONSTRAINT "DeckConfig_planYearId_fkey" FOREIGN KEY ("planYearId") REFERENCES "PlanYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_planYearId_fkey" FOREIGN KEY ("planYearId") REFERENCES "PlanYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
