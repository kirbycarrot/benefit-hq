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
