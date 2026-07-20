import type {
  BenchmarkComparison,
  BenchmarkComparisonRow,
  BenchmarkDashboardData,
  BenchmarkMetricDefinition,
  BenchmarkPoint,
  PlanBenchmarkComparison,
} from "./types";

const EMPTY_POINT: BenchmarkPoint = {
  value: null,
  availability: "not_reported",
  sourceCell: "",
};

export function buildBenchmarkComparison(
  data: BenchmarkDashboardData,
  peerCohortCode: string
): BenchmarkComparison {
  const plans = data.client.plans.map((plan) =>
    comparePlan(data, peerCohortCode, plan)
  );
  const offeredSubtypes = new Set(data.client.plans.map((plan) => plan.subtype));
  const prevalence = data.metrics
    .filter((metric) => metric.code.startsWith("medical.prevalence."))
    .map((metric) => ({
      subtype: metric.planSubtype ?? metric.code.split(".").at(-1)?.toUpperCase() ?? "Plan",
      label: metric.label,
      offered: metric.planSubtype ? offeredSubtypes.has(metric.planSubtype) : false,
      national: point(data, metric.code, data.nationalCohortCode),
      peer: point(data, metric.code, peerCohortCode),
    }));

  return {
    plans,
    prevalence,
    comparableCount: plans.reduce((sum, plan) => sum + plan.comparableCount, 0),
    possibleCount: plans.reduce((sum, plan) => sum + plan.possibleCount, 0),
  };
}

function comparePlan(
  data: BenchmarkDashboardData,
  peerCohortCode: string,
  plan: BenchmarkDashboardData["client"]["plans"][number]
): PlanBenchmarkComparison {
  const planMetrics = data.metrics.filter(
    (metric) =>
      metric.comparisonKind === "direct" &&
      metric.clientFieldKey &&
      (metric.planSubtype === plan.subtype ||
        (metric.planSubtype === null && metric.benefitType === "Medical"))
  );
  const rows = planMetrics.map((metric) =>
    comparisonRow(data, peerCohortCode, plan, metric)
  );
  const displayRows = rows.filter(
    (row) =>
      row.clientValue !== null &&
      (row.national.value !== null || row.peer.value !== null)
  );

  return {
    id: plan.id,
    name: plan.name,
    subtype: plan.subtype,
    premiumRows: displayRows.filter((row) => row.metricCode.startsWith("medical.premium.")),
    contributionRows: displayRows.filter((row) =>
      row.metricCode.startsWith("medical.employee_contribution.")
    ),
    designRows: displayRows.filter(
      (row) =>
        row.metricCode.startsWith("medical.design.") ||
        row.metricCode.startsWith("medical.hsa.") ||
        row.metricCode.startsWith("medical.rx.")
    ),
    comparableCount: displayRows.length,
    possibleCount: rows.length,
  };
}

function comparisonRow(
  data: BenchmarkDashboardData,
  peerCohortCode: string,
  plan: BenchmarkDashboardData["client"]["plans"][number],
  metric: BenchmarkMetricDefinition
): BenchmarkComparisonRow {
  const clientValue = clientMetricValue(plan, metric);
  const national = point(data, metric.code, data.nationalCohortCode);
  const peer = point(data, metric.code, peerCohortCode);
  return {
    metricCode: metric.code,
    label: metric.label,
    unit: metric.unit,
    statistic: metric.statistic,
    direction: metric.direction,
    tier: metric.tier,
    clientValue,
    national,
    peer,
    nationalVariance:
      clientValue !== null && national.value !== null ? clientValue - national.value : null,
    peerVariance: clientValue !== null && peer.value !== null ? clientValue - peer.value : null,
  };
}

function clientMetricValue(
  plan: BenchmarkDashboardData["client"]["plans"][number],
  metric: BenchmarkMetricDefinition
): number | null {
  if (!metric.clientFieldKey) return null;
  if (metric.clientFieldKey === "grossPremium" || metric.clientFieldKey === "employeeContribution") {
    const rate = plan.rates.find((item) => item.tier === metric.tier);
    if (!rate) return null;
    return monthlyValue(rate[metric.clientFieldKey], rate.ratePeriod);
  }

  const value = plan.details[metric.clientFieldKey];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return metric.unit === "percentage" ? value / 100 : value;
}

function monthlyValue(value: number, ratePeriod: string): number | null {
  if (ratePeriod === "monthly") return value;
  if (ratePeriod === "annual") return value / 12;
  return null;
}

function point(
  data: BenchmarkDashboardData,
  metricCode: string,
  cohortCode: string
): BenchmarkPoint {
  return data.values[metricCode]?.[cohortCode] ?? EMPTY_POINT;
}
