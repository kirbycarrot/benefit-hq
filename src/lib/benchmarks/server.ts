import "server-only";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { recommendBenchmarkCohort } from "./recommendation";
import type {
  BenchmarkAvailability,
  BenchmarkCohortOption,
  BenchmarkDashboardData,
  BenchmarkMetricDefinition,
  BenchmarkUnit,
} from "./types";

export async function loadBenchmarkDashboard(
  planYearId: string,
  expectedClientId: string
): Promise<BenchmarkDashboardData | null> {
  const planYear = await prisma.planYear.findUnique({
    where: { id: planYearId },
    include: {
      client: {
        include: {
          profile: true,
          locations: {
            where: { isHeadquarters: true },
            take: 1,
          },
        },
      },
      benchmarkProfile: true,
      benefitPrograms: {
        where: { benefitType: "Medical", offered: true },
        include: {
          plans: {
            where: { offered: true },
            orderBy: { sortOrder: "asc" },
            include: { rates: { orderBy: { sortOrder: "asc" } } },
          },
        },
      },
    },
  });
  if (!planYear || planYear.clientId !== expectedClientId) notFound();

  const dataset = planYear.benchmarkProfile
    ? await prisma.benchmarkDataset.findUnique({
        where: { id: planYear.benchmarkProfile.datasetId },
        include: benchmarkDatasetInclude,
      })
    : await prisma.benchmarkDataset.findFirst({
        where: { provider: "Mercer", status: "active" },
        orderBy: [{ surveyYear: "desc" }, { importedAt: "desc" }],
        include: benchmarkDatasetInclude,
      });
  if (!dataset) return null;

  const cohorts: BenchmarkCohortOption[] = dataset.cohorts.map((cohort) => ({
    id: cohort.id,
    code: cohort.code,
    type: cohort.type as BenchmarkCohortOption["type"],
    label: cohort.label,
    shortLabel: cohort.shortLabel,
    participantCount: cohort.participantCount,
    sortOrder: cohort.sortOrder,
  }));
  const recommendation = recommendBenchmarkCohort(
    {
      primaryIndustry: planYear.client.profile?.primaryIndustry,
      usEmployeeCount: planYear.client.profile?.usEmployeeCount,
      statesWithEmployees: planYear.client.profile?.statesWithEmployees,
      headquartersState: planYear.client.locations[0]?.state,
    },
    cohorts
  );
  const selected =
    cohorts.find((cohort) => cohort.id === planYear.benchmarkProfile?.primaryCohortId)?.code ??
    recommendation.code;

  const values: BenchmarkDashboardData["values"] = {};
  for (const value of dataset.values) {
    const metricValues = (values[value.metric.code] ??= {});
    metricValues[value.cohort.code] = {
      value: value.numericValue?.toNumber() ?? null,
      availability: value.availability as BenchmarkAvailability,
      sourceCell: `dMercer!${value.sourceCell}`,
    };
  }

  const medicalPlans = planYear.benefitPrograms.flatMap((program) => program.plans);
  return {
    dataset: {
      id: dataset.id,
      provider: dataset.provider,
      title: dataset.title,
      surveyYear: dataset.surveyYear,
      publicationYear: dataset.publicationYear,
      version: dataset.version,
      notes: dataset.notes,
    },
    cohorts,
    nationalCohortCode:
      cohorts.find((cohort) => cohort.code === "national.all")?.code ?? cohorts[0]?.code ?? "national.all",
    selectedCohortCode: selected,
    recommendedCohortCode: recommendation.code,
    recommendationReason: recommendation.reason,
    metrics: dataset.values
      .map((value) => value.metric)
      .filter((metric, index, all) => all.findIndex((item) => item.id === metric.id) === index)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(
        (metric): BenchmarkMetricDefinition => ({
          code: metric.code,
          category: metric.category,
          label: metric.label,
          description: metric.description,
          unit: metric.unit as BenchmarkUnit,
          statistic: metric.statistic as BenchmarkMetricDefinition["statistic"],
          comparisonKind: metric.comparisonKind as BenchmarkMetricDefinition["comparisonKind"],
          benefitType: metric.benefitType,
          planSubtype: metric.planSubtype,
          tier: metric.tier,
          clientFieldKey: metric.clientFieldKey,
          direction: metric.direction as BenchmarkMetricDefinition["direction"],
          sortOrder: metric.sortOrder,
        })
      ),
    values,
    client: {
      name: planYear.client.name,
      industry: planYear.client.profile?.primaryIndustry ?? null,
      employeeCount: planYear.client.profile?.usEmployeeCount ?? null,
      plans: medicalPlans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        subtype: plan.subtype,
        details: policyDetails(plan.details),
        rates: plan.rates.map((rate) => ({
          tier: rate.tier,
          grossPremium: rate.grossPremium.toNumber(),
          employeeContribution: rate.employeeContribution.toNumber(),
          ratePeriod: rate.ratePeriod,
        })),
      })),
    },
  };
}

const benchmarkDatasetInclude = {
  cohorts: { orderBy: { sortOrder: "asc" as const } },
  values: {
    include: { cohort: true, metric: true },
  },
};

function policyDetails(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string | number | boolean | null] => {
      const item = entry[1];
      return item === null || ["string", "number", "boolean"].includes(typeof item);
    })
  );
}
