import type { ChartResult } from "./types";

type BarResult = Extract<ChartResult, { kind: "bar" }>;
type TableResult = Extract<ChartResult, { kind: "table" }>;
type MapResult = Extract<ChartResult, { kind: "map" }>;
type ParticipationResult = Extract<ChartResult, { kind: "participation" }>;
type ContributionResult = Extract<ChartResult, { kind: "contribution" }>;
type RenewalResult = Extract<ChartResult, { kind: "renewal"; available: true }>;

export function geographyBarResult(result: MapResult): BarResult {
  return {
    kind: "bar",
    title: result.title,
    xKey: "Location",
    series: [{ key: "Employees", label: "Employees" }],
    data: [...result.areas]
      .sort((left, right) => right.value - left.value)
      .slice(0, 10)
      .map((area) => ({ Location: area.name, Employees: area.value })),
  };
}

export function geographyTableResult(result: MapResult): TableResult {
  return {
    kind: "table",
    title: result.title,
    columns: ["Location", "Employees", "Share of mapped"],
    rows: [...result.areas]
      .sort((left, right) => right.value - left.value)
      .map((area) => [
        area.name,
        area.value,
        result.mappedEmployees
          ? `${((area.value / result.mappedEmployees) * 100).toFixed(1)}%`
          : "0.0%",
      ]),
  };
}

export function participationBarResult(result: ParticipationResult): BarResult {
  return {
    kind: "bar",
    title: result.title,
    xKey: "Benefit",
    series: [
      { key: "Enrolled", label: "Enrolled" },
      { key: "Waived", label: "Waived" },
      { key: "Not recorded", label: "Not recorded" },
    ],
    data: result.benefits.map((benefit) => ({
      Benefit: benefit.name,
      Enrolled: benefit.enrolled,
      Waived: benefit.waived,
      "Not recorded": benefit.unreported,
    })),
  };
}

export function participationTableResult(result: ParticipationResult): TableResult {
  return {
    kind: "table",
    title: result.title,
    columns: ["Benefit", "Eligible", "Enrolled", "Waived", "Not recorded", "Participation"],
    rows: result.benefits.map((benefit) => [
      benefit.name,
      benefit.eligible,
      benefit.enrolled,
      benefit.waived,
      benefit.unreported,
      `${benefit.participation.toFixed(1)}%`,
    ]),
  };
}

export function contributionBarResult(result: ContributionResult): BarResult {
  const totals = new Map<string, { employee: number; employer: number }>();
  for (const row of result.rows) {
    const total = totals.get(row.benefit) ?? { employee: 0, employer: 0 };
    total.employee += row.annualEmployeeSpend;
    total.employer += row.annualEmployerSpend;
    totals.set(row.benefit, total);
  }

  return {
    kind: "bar",
    title: result.title,
    xKey: "Benefit",
    series: [
      { key: "Employee", label: "Employee funded" },
      { key: "Employer", label: "Employer funded" },
    ],
    data: [...totals].map(([benefit, total]) => ({
      Benefit: benefit,
      Employee: Math.round(total.employee),
      Employer: Math.round(total.employer),
    })),
  };
}

export function renewalBarResult(result: RenewalResult): BarResult {
  return {
    kind: "bar",
    title: result.title,
    xKey: "Cost",
    series: [
      { key: "Prior", label: result.priorLabel },
      { key: "Current", label: result.currentLabel },
    ],
    data: [
      {
        Cost: "Employer",
        Prior: Math.round(result.summary.priorAnnualEmployerCost),
        Current: Math.round(result.summary.currentAnnualEmployerCost),
      },
      {
        Cost: "Employee",
        Prior: Math.round(result.summary.priorAnnualEmployeeCost),
        Current: Math.round(result.summary.currentAnnualEmployeeCost),
      },
      {
        Cost: "Total",
        Prior: Math.round(result.summary.priorAnnualTotalCost),
        Current: Math.round(result.summary.currentAnnualTotalCost),
      },
    ],
  };
}

export function tierTableResult(results: BarResult[]): TableResult {
  const series = results[0]?.series ?? [];
  return {
    kind: "table",
    title: results.length > 1 ? "Coverage Tier Enrollment" : results[0]?.title ?? "Coverage Tier Enrollment",
    columns: ["Benefit", ...series.map((item) => item.label)],
    rows: results.map((result) => {
      const row = result.data[0] ?? {};
      return [String(row[result.xKey] ?? result.title), ...series.map((item) => Number(row[item.key]) || 0)];
    }),
  };
}

type ContributionRow = ContributionResult["rows"][number];

// Collapses a plan's per-tier rate rows (e.g. Employee / Spouse / Child / Family)
// into a single summary row so tables stay readable for plans with many tiers.
export function combineContributionRowsByPlan(rows: ContributionRow[]): ContributionRow[] {
  const groups = new Map<string, ContributionRow[]>();
  for (const row of rows) {
    const key = `${row.benefit}||${row.plan}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return Array.from(groups.values()).map((group) => {
    if (group.length === 1) return group[0];

    const enrolled = group.reduce((sum, row) => sum + row.enrolled, 0);
    const annualEmployeeSpend = group.reduce((sum, row) => sum + row.annualEmployeeSpend, 0);
    const annualEmployerSpend = group.reduce((sum, row) => sum + row.annualEmployerSpend, 0);
    const annualTotalSpend = annualEmployeeSpend + annualEmployerSpend;
    const weightedRate = (pick: (row: ContributionRow) => number) =>
      enrolled > 0
        ? group.reduce((sum, row) => sum + pick(row) * row.enrolled, 0) / enrolled
        : group.reduce((sum, row) => sum + pick(row), 0) / group.length;

    return {
      benefit: group[0].benefit,
      plan: group[0].plan,
      tier: "All tiers",
      enrolled,
      employeeRate: weightedRate((row) => row.employeeRate),
      employerRate: weightedRate((row) => row.employerRate),
      employerPaidPercentage: annualTotalSpend
        ? (annualEmployerSpend / annualTotalSpend) * 100
        : 0,
      ratePeriod: group[0].ratePeriod,
      annualEmployeeSpend,
      annualEmployerSpend,
      annualTotalSpend,
    };
  });
}

type RenewalRow = RenewalResult["rows"][number];

function renewalPercentageChange(current: number, prior: number): number | null {
  return prior === 0 ? null : ((current - prior) / prior) * 100;
}

// Collapses a plan's per-tier rows (e.g. Employee / Spouse / Child / Family) into a
// single summary row so tables stay readable for plans with many tiers.
export function combineRenewalRowsByPlan(rows: RenewalRow[]): RenewalRow[] {
  const groups = new Map<string, RenewalRow[]>();
  for (const row of rows) {
    const key = `${row.benefit}||${row.currentPlan ?? row.priorPlan ?? ""}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return Array.from(groups.values()).map((group) => {
    if (group.length === 1) return group[0];

    const allRemoved = group.every((row) => row.status === "removed");
    const allNew = group.every((row) => row.status === "new");
    const anyRenamed = group.some((row) => row.status === "renamed");
    const status: RenewalRow["status"] = allRemoved
      ? "removed"
      : allNew
        ? "new"
        : anyRenamed
          ? "renamed"
          : "matched";

    const enrolled = group.reduce((sum, row) => sum + row.enrolled, 0);
    const sumOrNull = (pick: (row: RenewalRow) => number | null) => {
      const values = group.map(pick).filter((value): value is number => value !== null);
      return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
    };
    const weightedRate = (pick: (row: RenewalRow) => number | null) => {
      const withRate = group.filter((row) => pick(row) !== null);
      if (!withRate.length) return null;
      const totalEnrolled = withRate.reduce((sum, row) => sum + row.enrolled, 0);
      if (totalEnrolled > 0) {
        return (
          withRate.reduce((sum, row) => sum + (pick(row) ?? 0) * row.enrolled, 0) /
          totalEnrolled
        );
      }
      return withRate.reduce((sum, row) => sum + (pick(row) ?? 0), 0) / withRate.length;
    };

    const priorAnnualEmployeeCost = sumOrNull((row) => row.priorAnnualEmployeeCost);
    const currentAnnualEmployeeCost = sumOrNull((row) => row.currentAnnualEmployeeCost);
    const priorAnnualEmployerCost = sumOrNull((row) => row.priorAnnualEmployerCost);
    const currentAnnualEmployerCost = sumOrNull((row) => row.currentAnnualEmployerCost);
    const priorAnnualTotalCost =
      priorAnnualEmployeeCost !== null && priorAnnualEmployerCost !== null
        ? priorAnnualEmployeeCost + priorAnnualEmployerCost
        : null;
    const currentAnnualTotalCost =
      currentAnnualEmployeeCost !== null && currentAnnualEmployerCost !== null
        ? currentAnnualEmployeeCost + currentAnnualEmployerCost
        : null;
    const totalChange =
      priorAnnualTotalCost !== null && currentAnnualTotalCost !== null
        ? currentAnnualTotalCost - priorAnnualTotalCost
        : null;

    return {
      status,
      benefit: group[0].benefit,
      priorPlan: group.find((row) => row.priorPlan !== null)?.priorPlan ?? null,
      currentPlan: group.find((row) => row.currentPlan !== null)?.currentPlan ?? null,
      tier: "All tiers",
      enrolled,
      priorEmployeeRate: weightedRate((row) => row.priorEmployeeRate),
      currentEmployeeRate: weightedRate((row) => row.currentEmployeeRate),
      priorEmployerRate: weightedRate((row) => row.priorEmployerRate),
      currentEmployerRate: weightedRate((row) => row.currentEmployerRate),
      priorRatePeriod: group.find((row) => row.priorRatePeriod !== null)?.priorRatePeriod ?? null,
      currentRatePeriod:
        group.find((row) => row.currentRatePeriod !== null)?.currentRatePeriod ?? null,
      priorAnnualEmployeeCost,
      currentAnnualEmployeeCost,
      priorAnnualEmployerCost,
      currentAnnualEmployerCost,
      totalChange,
      totalChangePercentage:
        priorAnnualTotalCost !== null && currentAnnualTotalCost !== null
          ? renewalPercentageChange(currentAnnualTotalCost, priorAnnualTotalCost)
          : null,
    };
  });
}

export function tierCombinedBarResult(results: BarResult[]): BarResult {
  const first = results[0];
  return {
    kind: "bar",
    title: "Coverage Tier Enrollment",
    xKey: "Benefit",
    series: first?.series ?? [],
    data: results.map((result) => {
      const row = result.data[0] ?? {};
      return {
        Benefit: String(row[result.xKey] ?? result.title),
        ...Object.fromEntries(result.series.map((series) => [series.key, Number(row[series.key]) || 0])),
      };
    }),
  };
}
