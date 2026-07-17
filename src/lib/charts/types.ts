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
