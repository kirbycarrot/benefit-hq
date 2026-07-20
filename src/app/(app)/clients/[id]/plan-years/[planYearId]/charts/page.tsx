import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadChartDataset } from "@/lib/charts/dataset";
import { CHART_COMPUTE } from "@/lib/charts/compute";
import {
  ChartSelectionScreen,
  type AutomaticDeckContent,
} from "@/components/ChartSelectionScreen";
import { DeckGenerator } from "@/components/DeckGenerator";
import type { ChartResult } from "@/lib/charts/types";
import { loadBenchmarkDashboard } from "@/lib/benchmarks/server";
import {
  buildMercerChartResults,
  clientMedicalCostContext,
} from "@/lib/benchmarks/charts";
import {
  normalizeCoverageTierViews,
  type ChartSelection,
} from "@/lib/charts/viewOptions";
import { selectedVoluntaryPlanOfferings } from "@/lib/policy-details";

export default async function ChartsPage({
  params,
}: {
  params: Promise<{ id: string; planYearId: string }>;
}) {
  const { id: clientId, planYearId } = await params;

  const planYear = await prisma.planYear.findUnique({
    where: { id: planYearId },
    include: {
      client: true,
      deckConfig: true,
      _count: { select: { employees: true } },
      benefitPrograms: {
        where: { benefitType: "VoluntaryOfferings", offered: true },
        include: {
          plans: {
            where: { offered: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });
  if (!planYear || planYear.clientId !== clientId) notFound();

  const chartDefinitions = await prisma.chartDefinition.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const rawSelections =
    (planYear.deckConfig?.selections as Record<string, ChartSelection> | undefined) ?? {};
  const initialSelections = normalizeCoverageTierViews(
    Object.fromEntries(
      chartDefinitions.map((def) => [
        def.key,
        {
          enabled: rawSelections[def.key]?.enabled ?? def.defaultEnabled,
          params: rawSelections[def.key]?.params,
        },
      ])
    )
  );

  const additionalBenefits = selectedVoluntaryPlanOfferings(
    planYear.benefitPrograms[0]?.plans[0]?.details
  );
  let chartResults: Record<string, ChartResult> = {};
  let automaticContent: AutomaticDeckContent = {
    additionalBenefits,
    mercerCostSlides: 0,
    mercerDesignSlides: 0,
    mercerPrevalenceSlides: 0,
    peerLabel: null,
  };
  if (planYear._count.employees > 0) {
    const [dataset, benchmarkData] = await Promise.all([
      loadChartDataset(planYearId),
      loadBenchmarkDashboard(planYearId, clientId),
    ]);
    const contributionResult = CHART_COMPUTE["contribution-strategy"](dataset);
    if (contributionResult.kind !== "contribution") {
      throw new Error("Contribution strategy returned an unexpected result type");
    }
    const mercerResults = buildMercerChartResults(
      benchmarkData,
      clientMedicalCostContext(contributionResult, dataset.employees.length)
    );
    const costBenchmark = mercerResults["mercer-medical-cost-benchmark"];
    const contributionWithMarketContext =
      costBenchmark.kind === "benchmark" &&
      costBenchmark.available &&
      costBenchmark.mode === "cost" &&
      costBenchmark.medicalCostPerEmployee.available
        ? {
            ...contributionResult,
            medicalCostPerEmployeeBenchmark: costBenchmark.medicalCostPerEmployee,
          }
        : contributionResult;
    const designBenchmark = mercerResults["mercer-medical-plan-design"];
    const prevalenceBenchmark = mercerResults["mercer-medical-plan-prevalence"];
    automaticContent = {
      additionalBenefits,
      mercerCostSlides:
        costBenchmark.kind === "benchmark" &&
        costBenchmark.available &&
        costBenchmark.mode === "cost"
          ? costBenchmark.plans.length
          : 0,
      mercerDesignSlides:
        designBenchmark.kind === "benchmark" &&
        designBenchmark.available &&
        designBenchmark.mode === "design"
          ? designBenchmark.plans.reduce(
              (count, plan) => count + Math.ceil(plan.designRows.length / 8),
              0
            )
          : 0,
      mercerPrevalenceSlides:
        prevalenceBenchmark.kind === "benchmark" &&
        prevalenceBenchmark.available &&
        prevalenceBenchmark.mode === "prevalence"
          ? 1
          : 0,
      peerLabel:
        [costBenchmark, designBenchmark, prevalenceBenchmark].find(
          (result) => result.kind === "benchmark" && result.available
        )?.peerLabel ?? null,
    };
    chartResults = Object.fromEntries(
      chartDefinitions.map((def) => {
        if (def.key === "contribution-strategy") {
          return [def.key, contributionWithMarketContext];
        }
        const compute = CHART_COMPUTE[def.key];
        return [def.key, compute ? compute(dataset) : undefined];
      })
    ) as Record<string, ChartResult>;
  }

  return (
    <div>
      <Link
        href={`/clients/${clientId}/plan-years/${planYearId}`}
        className="text-[13px] text-text-600 hover:text-text-900"
      >
        &larr; {planYear.label}
      </Link>
      <h1 className="mt-1 mb-1.5 text-[26px] font-extrabold text-text-900">
        Charts &amp; tables
      </h1>
      <p className="mb-[22px] max-w-[560px] text-sm text-text-600">
        Choose the company charts and tables to include. Matching Mercer context is applied
        automatically in the background.
      </p>

      {planYear._count.employees === 0 ? (
        <p className="rounded-[10px] bg-panel-tint px-4 py-3 text-sm text-amber">
          Upload a census for this plan year first — chart previews need employee data to
          render.
        </p>
      ) : (
        <div>
          <ChartSelectionScreen
            planYearId={planYearId}
            chartDefinitions={chartDefinitions}
            initialSelections={initialSelections}
            chartResults={chartResults}
            automaticContent={automaticContent}
          />
          <div className="mt-6">
            <DeckGenerator planYearId={planYearId} />
          </div>
        </div>
      )}
    </div>
  );
}
