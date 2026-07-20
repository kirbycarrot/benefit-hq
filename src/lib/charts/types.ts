export type BenchmarkChartMode = "cost" | "design" | "prevalence";

export type BenchmarkChartPoint = {
  value: number | null;
  availability: "available" | "insufficient_data" | "not_reported" | "not_applicable";
};

export type BenchmarkChartRow = {
  metricCode: string;
  label: string;
  tier: string | null;
  unit: "percentage" | "currency_monthly" | "currency_annual" | "currency_pepy" | "count";
  statistic: "average" | "median" | "prevalence";
  clientValue: number | null;
  national: BenchmarkChartPoint;
  peer: BenchmarkChartPoint;
  peerVariance: number | null;
};

export type BenchmarkChartPlan = {
  id: string;
  name: string;
  subtype: string;
  comparableCount: number;
  possibleCount: number;
  premiumRows: BenchmarkChartRow[];
  contributionRows: BenchmarkChartRow[];
  designRows: BenchmarkChartRow[];
};

export type BenchmarkMedicalCostPerEmployee =
  | {
      available: false;
      matchRate: number;
      message: string;
    }
  | {
      available: true;
      clientValue: number;
      annualMedicalSpend: number;
      employeeCount: number;
      matchRate: number;
      national: BenchmarkChartPoint;
      peer: BenchmarkChartPoint;
      nationalLabel: string;
      peerLabel: string;
      datasetTitle: string;
      surveyYear: number;
      version: string;
    };

type BenchmarkChartSource = {
  datasetTitle: string;
  surveyYear: number;
  version: string;
  nationalLabel: string;
  peerLabel: string;
  note: string;
};

export type ChartResult =
  | {
      kind: "executive";
      title: string;
      metrics: { label: string; value: string; detail: string }[];
      observations: string[];
    }
  | {
      kind: "participation";
      title: string;
      benefits: {
        name: string;
        eligible: number;
        enrolled: number;
        waived: number;
        unreported: number;
        participation: number;
      }[];
      note: string;
    }
  | {
      kind: "contribution";
      title: string;
      rows: {
        benefit: string;
        plan: string;
        tier: string;
        enrolled: number;
        employeeRate: number;
        employerRate: number;
        employerPaidPercentage: number;
        ratePeriod: string;
        annualEmployeeSpend: number;
        annualEmployerSpend: number;
        annualTotalSpend: number;
      }[];
      annualEmployeeSpend: number;
      annualEmployerSpend: number;
      annualTotalSpend: number;
      matchedElections: number;
      totalElections: number;
      benefitMatchStats?: {
        benefit: string;
        matchedElections: number;
        totalElections: number;
      }[];
      medicalCostPerEmployeeBenchmark?: Extract<
        BenchmarkMedicalCostPerEmployee,
        { available: true }
      >;
      note: string;
    }
  | {
      kind: "plan-design";
      title: string;
      plans: Array<{
        benefitType: string;
        benefitLabel: string;
        planName: string;
        subtype: string;
        groups: Array<{
          key: string;
          label: string;
          items: Array<{ key: string; label: string; value: string }>;
        }>;
      }>;
      note: string;
    }
  | {
      kind: "risk";
      title: string;
      indicators: {
        key: "new-hires" | "established" | "medicare-horizon" | "continuity-exposure";
        label: string;
        value: number;
        percentage: number;
        denominator: number;
        definition: string;
      }[];
      ageBands: string[];
      tenureBands: string[];
      cells: { ageBand: string; tenureBand: string; count: number }[];
      birthDateRecords: number;
      hireDateRecords: number;
      completeRecords: number;
      totalEmployees: number;
      observations: string[];
      note: string;
    }
  | {
      kind: "quality";
      title: string;
      totalEmployees: number;
      censusCompleteness: number;
      completeRecords: number;
      validZipRecords: number;
      recordedZipRecords: number;
      activeElections: number;
      matchedElections: number;
      unmatchedElections: number;
      fields: {
        key: "birth-date" | "hire-date" | "zip" | "salary";
        label: string;
        complete: number;
        missing: number;
        coverage: number;
      }[];
      findings: string[];
      note: string;
    }
  | {
      kind: "renewal";
      available: false;
      title: string;
      message: string;
    }
  | {
      kind: "renewal";
      available: true;
      title: string;
      priorLabel: string;
      currentLabel: string;
      priorEffectiveDate: Date;
      currentEffectiveDate: Date;
      summary: {
        priorAnnualEmployerCost: number;
        currentAnnualEmployerCost: number;
        employerChange: number;
        employerChangePercentage: number | null;
        priorAnnualEmployeeCost: number;
        currentAnnualEmployeeCost: number;
        employeeChange: number;
        employeeChangePercentage: number | null;
        priorAnnualTotalCost: number;
        currentAnnualTotalCost: number;
        totalChange: number;
        totalChangePercentage: number | null;
      };
      rows: {
        status: "matched" | "renamed" | "new" | "removed";
        benefit: string;
        priorPlan: string | null;
        currentPlan: string | null;
        tier: string;
        enrolled: number;
        priorEmployeeRate: number | null;
        currentEmployeeRate: number | null;
        priorEmployerRate: number | null;
        currentEmployerRate: number | null;
        priorRatePeriod: string | null;
        currentRatePeriod: string | null;
        priorAnnualEmployeeCost: number | null;
        currentAnnualEmployeeCost: number | null;
        priorAnnualEmployerCost: number | null;
        currentAnnualEmployerCost: number | null;
        totalChange: number | null;
        totalChangePercentage: number | null;
      }[];
      comparableRows: number;
      renamedRows: number;
      newRows: number;
      removedRows: number;
      note: string;
    }
  | { kind: "stats"; title: string; stats: { label: string; value: string }[] }
  | {
      kind: "bar";
      title: string;
      xKey: string;
      series: { key: string; label: string }[];
      data: Record<string, string | number>[];
    }
  | { kind: "table"; title: string; columns: string[]; rows: (string | number)[][] }
  | { kind: "pie"; title: string; data: { name: string; value: number }[] }
  | {
      kind: "map";
      title: string;
      level: "state" | "county";
      focusStateFips?: string;
      focusStateName?: string;
      areas: { id: string; name: string; value: number }[];
      totalEmployees: number;
      mappedEmployees: number;
      note: string;
    }
  | {
      kind: "benchmark";
      available: false;
      mode: BenchmarkChartMode;
      title: string;
      message: string;
    }
  | ({
      kind: "benchmark";
      available: true;
      mode: "cost";
      title: string;
      plans: BenchmarkChartPlan[];
      medicalCostPerEmployee: BenchmarkMedicalCostPerEmployee;
    } & BenchmarkChartSource)
  | ({
      kind: "benchmark";
      available: true;
      mode: "design";
      title: string;
      plans: BenchmarkChartPlan[];
    } & BenchmarkChartSource)
  | ({
      kind: "benchmark";
      available: true;
      mode: "prevalence";
      title: string;
      rows: Array<{
        subtype: string;
        label: string;
        offered: boolean;
        national: BenchmarkChartPoint;
        peer: BenchmarkChartPoint;
      }>;
    } & BenchmarkChartSource);
