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
    };
