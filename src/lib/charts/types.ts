export type ChartResult =
  | { kind: "stats"; title: string; stats: { label: string; value: string }[] }
  | {
      kind: "bar";
      title: string;
      xKey: string;
      series: { key: string; label: string }[];
      data: Record<string, string | number>[];
    }
  | { kind: "table"; title: string; columns: string[]; rows: (string | number)[][] }
  | { kind: "pie"; title: string; data: { name: string; value: number }[] };
