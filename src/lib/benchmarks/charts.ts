import { buildBenchmarkComparison } from "./comparison";
import type { BenchmarkComparisonRow, BenchmarkDashboardData } from "./types";
import type {
  BenchmarkChartPlan,
  BenchmarkChartRow,
  BenchmarkChartMode,
  BenchmarkMedicalCostPerEmployee,
  ChartResult,
} from "@/lib/charts/types";

export const MERCER_CHART_KEYS = [
  "mercer-medical-cost-benchmark",
  "mercer-medical-plan-design",
  "mercer-medical-plan-prevalence",
] as const;

export type MercerChartKey = (typeof MERCER_CHART_KEYS)[number];

export type MercerClientCostContext = {
  annualMedicalSpend: number;
  employeeCount: number;
  matchedMedicalElections: number;
  totalMedicalElections: number;
};

const TITLES: Record<MercerChartKey, string> = {
  "mercer-medical-cost-benchmark": "Medical premiums and employee contributions versus market",
  "mercer-medical-plan-design": "Medical plan design versus market",
  "mercer-medical-plan-prevalence": "Medical plan prevalence versus market",
};

const MODES: Record<MercerChartKey, BenchmarkChartMode> = {
  "mercer-medical-cost-benchmark": "cost",
  "mercer-medical-plan-design": "design",
  "mercer-medical-plan-prevalence": "prevalence",
};

export function buildMercerChartResults(
  data: BenchmarkDashboardData | null,
  clientCost?: MercerClientCostContext
): Record<MercerChartKey, ChartResult> {
  if (!data) {
    return Object.fromEntries(
      MERCER_CHART_KEYS.map((key) => [
        key,
        unavailable(key, "No active Mercer benchmark dataset is available."),
      ])
    ) as Record<MercerChartKey, ChartResult>;
  }

  const comparison = buildBenchmarkComparison(data, data.selectedCohortCode);
  const national = data.cohorts.find((cohort) => cohort.code === data.nationalCohortCode);
  const peer = data.cohorts.find((cohort) => cohort.code === data.selectedCohortCode);
  const source = {
    datasetTitle: data.dataset.title,
    surveyYear: data.dataset.surveyYear,
    version: data.dataset.version,
    nationalLabel: national?.label ?? "National All",
    peerLabel: peer?.label ?? "Selected peer",
    note:
      "Mercer plan-design values are medians unless labeled as averages. ID means insufficient data; missing values are not replaced from another cohort.",
  };

  const plans: BenchmarkChartPlan[] = comparison.plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    subtype: plan.subtype,
    comparableCount: plan.comparableCount,
    possibleCount: plan.possibleCount,
    premiumRows: plan.premiumRows.map(chartRow),
    contributionRows: plan.contributionRows.map(chartRow),
    designRows: plan.designRows.map(chartRow),
  }));

  const costPlans = plans.filter(
    (plan) => plan.premiumRows.length > 0 || plan.contributionRows.length > 0
  );
  const designPlans = plans.filter((plan) => plan.designRows.length > 0);
  const costPerEmployee = medicalCostPerEmployee(data, source, clientCost);
  const prevalenceRows = comparison.prevalence
    .filter((row) => row.national.value !== null || row.peer.value !== null)
    .map((row) => ({
      subtype: row.subtype,
      label: row.label,
      offered: row.offered,
      national: chartPoint(row.national),
      peer: chartPoint(row.peer),
    }));
  return {
    "mercer-medical-cost-benchmark": costPlans.length === 0 && !costPerEmployee.available
      ? unavailable(
          "mercer-medical-cost-benchmark",
          "No calculated company medical cost metric has a corresponding Mercer value."
        )
      : {
          kind: "benchmark",
          available: true,
          mode: "cost",
          title: TITLES["mercer-medical-cost-benchmark"],
          plans: costPlans,
          medicalCostPerEmployee: costPerEmployee,
          ...source,
        },
    "mercer-medical-plan-design": designPlans.length === 0
      ? unavailable(
          "mercer-medical-plan-design",
          "No calculated company plan-design metric has a corresponding Mercer value."
        )
      : {
          kind: "benchmark",
          available: true,
          mode: "design",
          title: TITLES["mercer-medical-plan-design"],
          plans: designPlans,
          ...source,
        },
    "mercer-medical-plan-prevalence": prevalenceRows.length === 0
      ? unavailable(
          "mercer-medical-plan-prevalence",
          "No Mercer prevalence value is available for the recorded company plan lineup."
        )
      : {
          kind: "benchmark",
          available: true,
          mode: "prevalence",
          title: TITLES["mercer-medical-plan-prevalence"],
          rows: prevalenceRows,
          ...source,
        },
  };
}

export function clientMedicalCostContext(
  contribution: Extract<ChartResult, { kind: "contribution" }>,
  employeeCount: number
): MercerClientCostContext {
  const medicalStats = contribution.benefitMatchStats?.find(
    (item) => item.benefit.trim().toLowerCase() === "medical"
  );
  return {
    annualMedicalSpend: contribution.rows
      .filter((row) => row.benefit.trim().toLowerCase() === "medical")
      .reduce((sum, row) => sum + row.annualTotalSpend, 0),
    employeeCount,
    matchedMedicalElections: medicalStats?.matchedElections ?? 0,
    totalMedicalElections: medicalStats?.totalElections ?? 0,
  };
}

function medicalCostPerEmployee(
  data: BenchmarkDashboardData,
  source: {
    datasetTitle: string;
    surveyYear: number;
    version: string;
    nationalLabel: string;
    peerLabel: string;
  },
  clientCost?: MercerClientCostContext
): BenchmarkMedicalCostPerEmployee {
  const matchRate = clientCost?.totalMedicalElections
    ? clientCost.matchedMedicalElections / clientCost.totalMedicalElections
    : 0;
  if (!clientCost || clientCost.employeeCount <= 0 || clientCost.annualMedicalSpend <= 0) {
    return {
      available: false,
      matchRate,
      message: "Medical cost per employee requires census headcount and matched annual medical cost.",
    };
  }
  if (matchRate < 0.9) {
    return {
      available: false,
      matchRate,
      message: `Medical election matching is ${Math.round(matchRate * 100)}%; 90% is required before showing a cost-per-employee benchmark.`,
    };
  }

  const metricCode = "medical.cost.pepy.total";
  const national = data.values[metricCode]?.[data.nationalCohortCode];
  const peer = data.values[metricCode]?.[data.selectedCohortCode];
  if (!national || !peer || (national.value === null && peer.value === null)) {
    return {
      available: false,
      matchRate,
      message: "Mercer cost-per-employee values are unavailable for the selected cohorts.",
    };
  }

  return {
    available: true,
    clientValue: clientCost.annualMedicalSpend / clientCost.employeeCount,
    annualMedicalSpend: clientCost.annualMedicalSpend,
    employeeCount: clientCost.employeeCount,
    matchRate,
    national: chartPoint(national),
    peer: chartPoint(peer),
    ...source,
  };
}

function unavailable(key: MercerChartKey, message: string): ChartResult {
  return {
    kind: "benchmark",
    available: false,
    mode: MODES[key],
    title: TITLES[key],
    message,
  };
}

function chartRow(row: BenchmarkComparisonRow): BenchmarkChartRow {
  return {
    metricCode: row.metricCode,
    label: row.label,
    tier: row.tier,
    unit: row.unit,
    statistic: row.statistic,
    clientValue: row.clientValue,
    national: chartPoint(row.national),
    peer: chartPoint(row.peer),
    peerVariance: row.peerVariance,
  };
}

function chartPoint(point: {
  value: number | null;
  availability: BenchmarkChartRow["national"]["availability"];
}): BenchmarkChartRow["national"] {
  return { value: point.value, availability: point.availability };
}
