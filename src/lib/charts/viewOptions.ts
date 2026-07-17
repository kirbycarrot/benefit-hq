export type ChartSelection = {
  enabled: boolean;
  params?: {
    view?: string;
  };
};

export type ChartViewOption = {
  value: string;
  label: string;
};

export const COVERAGE_TIER_KEYS = [
  "medical-tier-enrollment",
  "dental-tier-enrollment",
  "vision-tier-enrollment",
] as const;

const VIEW_OPTIONS: Record<string, readonly ChartViewOption[]> = {
  "geographic-distribution": [
    { value: "map", label: "Map" },
    { value: "bar", label: "Ranked bars" },
    { value: "table", label: "Table" },
  ],
  "benefits-participation-funnel": [
    { value: "funnel", label: "Participation cards" },
    { value: "stacked", label: "Stacked bars" },
    { value: "table", label: "Table" },
  ],
  "renewal-comparison": [
    { value: "table", label: "Comparison table" },
    { value: "bar", label: "Cost bars" },
  ],
  "contribution-strategy": [
    { value: "table", label: "Detailed table" },
    { value: "stacked", label: "Contribution bars" },
  ],
  "medical-tier-enrollment": [
    { value: "grouped", label: "Grouped bars" },
    { value: "stacked", label: "100% stacked" },
    { value: "table", label: "Table" },
  ],
  "dental-tier-enrollment": [
    { value: "grouped", label: "Grouped bars" },
    { value: "stacked", label: "100% stacked" },
    { value: "table", label: "Table" },
  ],
  "vision-tier-enrollment": [
    { value: "grouped", label: "Grouped bars" },
    { value: "stacked", label: "100% stacked" },
    { value: "table", label: "Table" },
  ],
};

export function chartViewOptions(chartKey: string): readonly ChartViewOption[] | undefined {
  return VIEW_OPTIONS[chartKey];
}

export function chartView(chartKey: string, selection?: ChartSelection): string | undefined {
  const options = chartViewOptions(chartKey);
  if (!options) return undefined;
  const requested = selection?.params?.view;
  return options.some((option) => option.value === requested)
    ? requested
    : options[0].value;
}

export function normalizeCoverageTierViews(
  selections: Record<string, ChartSelection>
): Record<string, ChartSelection> {
  const selectedView = COVERAGE_TIER_KEYS.map((key) => chartView(key, selections[key])).find(
    (view) => view !== "grouped"
  ) ?? "grouped";

  return Object.fromEntries(
    Object.entries(selections).map(([key, selection]) => [
      key,
      COVERAGE_TIER_KEYS.includes(key as (typeof COVERAGE_TIER_KEYS)[number])
        ? { ...selection, params: { ...selection.params, view: selectedView } }
        : selection,
    ])
  );
}
