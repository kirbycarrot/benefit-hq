-- Mercer and future benchmark datasets are immutable, versioned reference data.
-- Client plan years point to a dataset version and one primary peer cohort.

CREATE TABLE "BenchmarkDataset" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "surveyYear" INTEGER NOT NULL,
    "publicationYear" INTEGER,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sourceFilename" TEXT NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "BenchmarkDataset_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BenchmarkDataset_status_check" CHECK ("status" IN ('draft', 'active', 'retired')),
    CONSTRAINT "BenchmarkDataset_year_check" CHECK ("surveyYear" BETWEEN 2000 AND 2100)
);

CREATE TABLE "BenchmarkCohort" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "shortLabel" TEXT NOT NULL,
    "sourceColumn" TEXT NOT NULL,
    "participantCount" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BenchmarkCohort_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BenchmarkCohort_type_check" CHECK ("type" IN ('national', 'region', 'size', 'industry')),
    CONSTRAINT "BenchmarkCohort_participants_check" CHECK ("participantCount" IS NULL OR "participantCount" >= 0)
);

CREATE TABLE "BenchmarkMetric" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "statistic" TEXT NOT NULL,
    "comparisonKind" TEXT NOT NULL DEFAULT 'direct',
    "benefitType" TEXT,
    "planSubtype" TEXT,
    "tier" TEXT,
    "clientFieldKey" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'neutral',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BenchmarkMetric_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BenchmarkMetric_unit_check" CHECK ("unit" IN ('percentage', 'currency_monthly', 'currency_annual', 'currency_pepy', 'count')),
    CONSTRAINT "BenchmarkMetric_statistic_check" CHECK ("statistic" IN ('average', 'median', 'prevalence')),
    CONSTRAINT "BenchmarkMetric_kind_check" CHECK ("comparisonKind" IN ('direct', 'market_practice')),
    CONSTRAINT "BenchmarkMetric_direction_check" CHECK ("direction" IN ('lower', 'higher', 'neutral'))
);

CREATE TABLE "BenchmarkValue" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "numericValue" DECIMAL(18,6),
    "availability" TEXT NOT NULL DEFAULT 'available',
    "sourceCell" TEXT NOT NULL,
    "rawValue" TEXT,
    CONSTRAINT "BenchmarkValue_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BenchmarkValue_availability_check" CHECK ("availability" IN ('available', 'insufficient_data', 'not_reported', 'not_applicable')),
    CONSTRAINT "BenchmarkValue_value_check" CHECK (
      ("availability" = 'available' AND "numericValue" IS NOT NULL)
      OR ("availability" <> 'available' AND "numericValue" IS NULL)
    )
);

CREATE TABLE "BenchmarkImportRun" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "metricCount" INTEGER NOT NULL DEFAULT 0,
    "cohortCount" INTEGER NOT NULL DEFAULT 0,
    "valueCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "BenchmarkImportRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BenchmarkImportRun_status_check" CHECK ("status" IN ('running', 'succeeded', 'failed'))
);

CREATE TABLE "PlanYearBenchmarkProfile" (
    "id" TEXT NOT NULL,
    "planYearId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "primaryCohortId" TEXT NOT NULL,
    "trendRate" DECIMAL(7,6),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanYearBenchmarkProfile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PlanYearBenchmarkProfile_trend_check" CHECK ("trendRate" IS NULL OR "trendRate" BETWEEN -0.5 AND 1.0)
);

CREATE UNIQUE INDEX "BenchmarkDataset_provider_surveyYear_version_key" ON "BenchmarkDataset"("provider", "surveyYear", "version");
CREATE INDEX "BenchmarkDataset_status_surveyYear_idx" ON "BenchmarkDataset"("status", "surveyYear");
CREATE UNIQUE INDEX "BenchmarkCohort_datasetId_code_key" ON "BenchmarkCohort"("datasetId", "code");
CREATE INDEX "BenchmarkCohort_datasetId_type_sortOrder_idx" ON "BenchmarkCohort"("datasetId", "type", "sortOrder");
CREATE UNIQUE INDEX "BenchmarkMetric_code_key" ON "BenchmarkMetric"("code");
CREATE INDEX "BenchmarkMetric_category_sortOrder_idx" ON "BenchmarkMetric"("category", "sortOrder");
CREATE INDEX "BenchmarkMetric_benefitType_planSubtype_idx" ON "BenchmarkMetric"("benefitType", "planSubtype");
CREATE UNIQUE INDEX "BenchmarkValue_datasetId_cohortId_metricId_key" ON "BenchmarkValue"("datasetId", "cohortId", "metricId");
CREATE INDEX "BenchmarkValue_datasetId_metricId_idx" ON "BenchmarkValue"("datasetId", "metricId");
CREATE INDEX "BenchmarkValue_cohortId_metricId_idx" ON "BenchmarkValue"("cohortId", "metricId");
CREATE INDEX "BenchmarkImportRun_datasetId_startedAt_idx" ON "BenchmarkImportRun"("datasetId", "startedAt");
CREATE UNIQUE INDEX "PlanYearBenchmarkProfile_planYearId_key" ON "PlanYearBenchmarkProfile"("planYearId");
CREATE INDEX "PlanYearBenchmarkProfile_datasetId_idx" ON "PlanYearBenchmarkProfile"("datasetId");
CREATE INDEX "PlanYearBenchmarkProfile_primaryCohortId_idx" ON "PlanYearBenchmarkProfile"("primaryCohortId");

ALTER TABLE "BenchmarkCohort" ADD CONSTRAINT "BenchmarkCohort_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "BenchmarkDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BenchmarkValue" ADD CONSTRAINT "BenchmarkValue_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "BenchmarkDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BenchmarkValue" ADD CONSTRAINT "BenchmarkValue_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "BenchmarkCohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BenchmarkValue" ADD CONSTRAINT "BenchmarkValue_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "BenchmarkMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BenchmarkImportRun" ADD CONSTRAINT "BenchmarkImportRun_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "BenchmarkDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanYearBenchmarkProfile" ADD CONSTRAINT "PlanYearBenchmarkProfile_planYearId_fkey" FOREIGN KEY ("planYearId") REFERENCES "PlanYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanYearBenchmarkProfile" ADD CONSTRAINT "PlanYearBenchmarkProfile_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "BenchmarkDataset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlanYearBenchmarkProfile" ADD CONSTRAINT "PlanYearBenchmarkProfile_primaryCohortId_fkey" FOREIGN KEY ("primaryCohortId") REFERENCES "BenchmarkCohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
