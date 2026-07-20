import type { BenchmarkCohortOption } from "./types";

type RecommendationProfile = {
  primaryIndustry?: string | null;
  usEmployeeCount?: number | null;
  statesWithEmployees?: unknown;
  headquartersState?: string | null;
};

const INDUSTRY_COHORTS: Record<string, string> = {
  Construction: "industry.construction",
  Education: "industry.higher-education",
  "Energy & Utilities": "industry.energy",
  "Financial Services": "industry.financial-services",
  Government: "industry.government",
  Healthcare: "industry.health-care",
  "Legal & Professional Services": "industry.legal-services",
  Manufacturing: "industry.manufacturing",
  Nonprofit: "industry.nonprofit",
  "Real Estate": "industry.real-estate",
  Retail: "industry.trade",
  Technology: "industry.high-tech",
  Telecommunications: "industry.tcu",
  "Wholesale & Distribution": "industry.trade",
};

const REGIONS: Record<string, string> = Object.fromEntries(
  [
    ["west", ["AK", "AZ", "CA", "CO", "HI", "ID", "MT", "NM", "NV", "OR", "UT", "WA", "WY"]],
    ["midwest", ["IA", "IL", "IN", "KS", "MI", "MN", "MO", "ND", "NE", "OH", "SD", "WI"]],
    ["northeast", ["CT", "DC", "DE", "MA", "MD", "ME", "NH", "NJ", "NY", "PA", "RI", "VT"]],
    ["south", ["AL", "AR", "FL", "GA", "KY", "LA", "MS", "NC", "OK", "SC", "TN", "TX", "VA", "WV"]],
  ].flatMap(([region, states]) =>
    (states as string[]).map((state) => [state, `region.${region}`])
  )
);

export function recommendBenchmarkCohort(
  profile: RecommendationProfile,
  cohorts: readonly BenchmarkCohortOption[]
): { code: string; reason: string } {
  const available = new Set(cohorts.map((cohort) => cohort.code));
  const industryCode = profile.primaryIndustry
    ? INDUSTRY_COHORTS[profile.primaryIndustry]
    : undefined;
  if (industryCode && available.has(industryCode)) {
    return {
      code: industryCode,
      reason: `Recommended from the client industry: ${profile.primaryIndustry}.`,
    };
  }

  const sizeCode = employeeSizeCohort(profile.usEmployeeCount);
  if (sizeCode && available.has(sizeCode)) {
    return {
      code: sizeCode,
      reason: `Recommended from ${profile.usEmployeeCount?.toLocaleString("en-US")} U.S. employees.`,
    };
  }

  const state = profile.headquartersState ?? firstState(profile.statesWithEmployees);
  const regionCode = state ? REGIONS[state.toUpperCase()] : undefined;
  if (regionCode && available.has(regionCode)) {
    return { code: regionCode, reason: `Recommended from the client location in ${state}.` };
  }

  return {
    code: available.has("national.all") ? "national.all" : cohorts[0]?.code ?? "national.all",
    reason: "National All Employers is recommended because the client profile does not identify a closer peer group.",
  };
}

function employeeSizeCohort(count: number | null | undefined): string | null {
  if (count === null || count === undefined || count < 50) return null;
  if (count < 500) return "size.50-499";
  if (count < 1_000) return "size.500-999";
  if (count < 5_000) return "size.1000-4999";
  if (count < 10_000) return "size.5000-9999";
  if (count < 20_000) return "size.10000-19999";
  return "size.20000-plus";
}

function firstState(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  return value.find((item): item is string => typeof item === "string" && item.length === 2) ?? null;
}
