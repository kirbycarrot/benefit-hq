export type BenchmarkAvailability =
  | "available"
  | "insufficient_data"
  | "not_reported"
  | "not_applicable";

export type BenchmarkUnit =
  | "percentage"
  | "currency_monthly"
  | "currency_annual"
  | "currency_pepy"
  | "count";

export type BenchmarkCohortOption = {
  id: string;
  code: string;
  type: "national" | "region" | "size" | "industry";
  label: string;
  shortLabel: string;
  participantCount: number | null;
  sortOrder: number;
};

export type BenchmarkMetricDefinition = {
  code: string;
  category: string;
  label: string;
  description: string | null;
  unit: BenchmarkUnit;
  statistic: "average" | "median" | "prevalence";
  comparisonKind: "direct" | "market_practice";
  benefitType: string | null;
  planSubtype: string | null;
  tier: string | null;
  clientFieldKey: string | null;
  direction: "lower" | "higher" | "neutral";
  sortOrder: number;
};

export type BenchmarkPoint = {
  value: number | null;
  availability: BenchmarkAvailability;
  sourceCell: string;
};

export type BenchmarkClientRate = {
  tier: string;
  grossPremium: number;
  employeeContribution: number;
  ratePeriod: string;
};

export type BenchmarkClientPlan = {
  id: string;
  name: string;
  subtype: string;
  details: Record<string, string | number | boolean | null>;
  rates: BenchmarkClientRate[];
};

export type BenchmarkDashboardData = {
  dataset: {
    id: string;
    provider: string;
    title: string;
    surveyYear: number;
    publicationYear: number | null;
    version: string;
    notes: string | null;
  };
  cohorts: BenchmarkCohortOption[];
  nationalCohortCode: string;
  selectedCohortCode: string;
  recommendedCohortCode: string;
  recommendationReason: string;
  metrics: BenchmarkMetricDefinition[];
  values: Record<string, Record<string, BenchmarkPoint>>;
  client: {
    name: string;
    industry: string | null;
    employeeCount: number | null;
    plans: BenchmarkClientPlan[];
  };
};

export type BenchmarkComparisonRow = {
  metricCode: string;
  label: string;
  unit: BenchmarkUnit;
  statistic: BenchmarkMetricDefinition["statistic"];
  direction: BenchmarkMetricDefinition["direction"];
  tier: string | null;
  clientValue: number | null;
  national: BenchmarkPoint;
  peer: BenchmarkPoint;
  nationalVariance: number | null;
  peerVariance: number | null;
};

export type PlanBenchmarkComparison = {
  id: string;
  name: string;
  subtype: string;
  premiumRows: BenchmarkComparisonRow[];
  contributionRows: BenchmarkComparisonRow[];
  designRows: BenchmarkComparisonRow[];
  comparableCount: number;
  possibleCount: number;
};

export type BenchmarkComparison = {
  plans: PlanBenchmarkComparison[];
  prevalence: Array<{
    subtype: string;
    label: string;
    offered: boolean;
    national: BenchmarkPoint;
    peer: BenchmarkPoint;
  }>;
  comparableCount: number;
  possibleCount: number;
};
