import type { ChartDataset } from "./dataset";
import { ageInYears, tenureInYears } from "./dataset";
import type { ChartResult } from "./types";
import { RATE_PERIOD_LABELS, TIER_LABELS } from "@/lib/validation";
import { POLICY_TIER_LABELS, type PolicyTierCode } from "@/lib/policy-details";
import { lookupPostalGeography, normalizeUsZip } from "@/lib/geography/lookup";

type Employee = ChartDataset["employees"][number];
type Election = Employee["elections"][number];

const DEPENDENT_AGE_BANDS: [string, number, number][] = [
  ["<18", 0, 18],
  ["18-25", 18, 26],
  ["26-45", 26, 46],
  ["46-64", 46, 65],
  ["65+", 65, Infinity],
];

const LIFE_VOLUME_BANDS: [string, number, number][] = [
  ["<$50k", 0, 50000],
  ["$50-100k", 50000, 100000],
  ["$100-200k", 100000, 200000],
  ["$200-300k", 200000, 300000],
  ["$300k+", 300000, Infinity],
];

const AGE_BANDS: [string, number, number][] = [
  ["<25", 0, 25],
  ["25-34", 25, 35],
  ["35-44", 35, 45],
  ["45-54", 45, 55],
  ["55-64", 55, 65],
  ["65+", 65, Infinity],
];

const SALARY_BANDS: [string, number, number][] = [
  ["<$40k", 0, 40000],
  ["$40-60k", 40000, 60000],
  ["$60-80k", 60000, 80000],
  ["$80-100k", 80000, 100000],
  ["$100-150k", 100000, 150000],
  ["$150k+", 150000, Infinity],
];

const TENURE_BANDS: [string, number, number][] = [
  ["<1 yr", 0, 1],
  ["1-3 yrs", 1, 3],
  ["3-5 yrs", 3, 5],
  ["5-10 yrs", 5, 10],
  ["10+ yrs", 10, Infinity],
];

const RISK_AGE_BANDS: [string, number, number][] = [
  ["<35", 0, 35],
  ["35-44", 35, 45],
  ["45-54", 45, 55],
  ["55-59", 55, 60],
  ["60-64", 60, 65],
  ["65+", 65, Infinity],
];

const RISK_TENURE_BANDS: [string, number, number][] = [
  ["<1 yr", 0, 1],
  ["1-4 yrs", 1, 5],
  ["5-9 yrs", 5, 10],
  ["10+ yrs", 10, Infinity],
];

function bandFor(value: number, bands: [string, number, number][]): string {
  const found = bands.find(([, min, max]) => value >= min && value < max);
  return found ? found[0] : bands[bands.length - 1][0];
}

function isWaived(el: Election): boolean {
  return (el.optionName ?? "").toLowerCase().includes("waive");
}

// Carrier exports abbreviate tiers inconsistently (e.g. "EE/SP", "EE/CH",
// "Employee + Spouse"), so match both spelled-out words and the common
// delimiter-prefixed abbreviations rather than requiring exact substrings.
type TierCode = keyof typeof TIER_LABELS;

function tierCodeFromOption(optionName: string | null): TierCode {
  const text = (optionName ?? "").toLowerCase();
  const hasSpouse = /spouse|[/+\- ]sp\b/.test(text);
  const hasChild = /child|[/+\- ]ch\b/.test(text);
  if (text.includes("family") || (hasSpouse && hasChild)) return "Family";
  if (hasSpouse) return "EE+Spouse";
  if (hasChild) return "EE+Child";
  return "EE";
}

function tierFromOption(optionName: string | null): string {
  return TIER_LABELS[tierCodeFromOption(optionName)];
}

function tierLabel(tier: string): string {
  return POLICY_TIER_LABELS[tier as PolicyTierCode] ?? tier;
}

function rateTierMatches(rateTier: string, censusTier: TierCode): boolean {
  if (rateTier === censusTier) return true;
  if (rateTier === "EE+Dependent") {
    return censusTier === "EE+Spouse" || censusTier === "EE+Child";
  }
  if (rateTier === "EE+Family") return censusTier !== "EE";
  return false;
}

function isSpouseRelationship(relationshipType: string | null | undefined): boolean {
  const text = (relationshipType ?? "").toLowerCase();
  return text.includes("spouse") || text.includes("husband") || text.includes("wife");
}

function pct(count: number, total: number): string {
  if (total === 0) return "0%";
  return `${((count / total) * 100).toFixed(1)}%`;
}

function percentage(count: number, total: number): number {
  return total === 0 ? 0 : (count / total) * 100;
}

function largestBand(values: number[], bands: [string, number, number][]) {
  const counts = bands.map(([label, min, max]) => ({
    label,
    count: values.filter((value) => value >= min && value < max).length,
  }));
  return counts.sort((a, b) => b.count - a.count)[0];
}

function computeExecutiveSummary(ds: ChartDataset): ChartResult {
  const total = ds.employees.length;
  const ages = ds.employees
    .map((employee) => ageInYears(employee.birthDate, ds.effectiveDate))
    .filter((age): age is number => age !== null);
  const tenures = ds.employees
    .map((employee) => tenureInYears(employee.hireDate, ds.effectiveDate))
    .filter((tenure): tenure is number => tenure !== null);
  const enrolledMedical = ds.employees.filter((employee) =>
    employee.elections.some(
      (election) => election.benefitType === "Medical" && !isWaived(election)
    )
  ).length;

  const stateCounts = new Map<string, { name: string; count: number }>();
  const countyCounts = new Map<
    string,
    { name: string; stateName: string; count: number }
  >();
  let mappedEmployees = 0;

  for (const employee of ds.employees) {
    const geography = lookupPostalGeography(employee.postalCode);
    if (!geography) continue;
    mappedEmployees++;

    const state = stateCounts.get(geography.stateFips) ?? {
      name: geography.stateName,
      count: 0,
    };
    state.count++;
    stateCounts.set(geography.stateFips, state);

    const county = countyCounts.get(geography.countyFips) ?? {
      name: geography.countyName,
      stateName: geography.stateName,
      count: 0,
    };
    county.count++;
    countyCounts.set(geography.countyFips, county);
  }

  const averageAge = ages.length
    ? (ages.reduce((sum, age) => sum + age, 0) / ages.length).toFixed(1)
    : "—";
  const averageTenure = tenures.length
    ? `${(tenures.reduce((sum, tenure) => sum + tenure, 0) / tenures.length).toFixed(1)} yrs`
    : "—";

  let footprintValue = "—";
  let footprintDetail = "No valid ZIP codes";
  if (stateCounts.size > 1) {
    footprintValue = `${stateCounts.size} states`;
    footprintDetail = `${mappedEmployees} of ${total} employees mapped`;
  } else if (stateCounts.size === 1) {
    const state = [...stateCounts.values()][0];
    footprintValue = `${countyCounts.size} ${countyCounts.size === 1 ? "county" : "counties"}`;
    footprintDetail = `${state.name} · ${mappedEmployees} of ${total} mapped`;
  }

  const observations: string[] = [];
  if (stateCounts.size > 1) {
    const topState = [...stateCounts.values()].sort((a, b) => b.count - a.count)[0];
    observations.push(
      `Employees span ${stateCounts.size} states; ${topState.name} has the largest concentration with ${topState.count} of ${mappedEmployees} mapped employees (${Math.round((topState.count / mappedEmployees) * 100)}%).`
    );
  } else if (stateCounts.size === 1 && countyCounts.size > 0) {
    const topCounty = [...countyCounts.values()].sort((a, b) => b.count - a.count)[0];
    observations.push(
      `Employees span ${countyCounts.size} ${countyCounts.size === 1 ? "county" : "counties"} in ${topCounty.stateName}; ${topCounty.name} has the largest concentration with ${topCounty.count} of ${mappedEmployees} mapped employees (${Math.round((topCounty.count / mappedEmployees) * 100)}%).`
    );
  } else {
    observations.push(
      "Geographic concentration is unavailable because the census does not contain mappable employee ZIP codes."
    );
  }

  if (ages.length) {
    const topAgeBand = largestBand(ages, AGE_BANDS);
    observations.push(
      `${topAgeBand.label.replace("-", "–")} is the largest age group, representing ${topAgeBand.count} of ${ages.length} employees with a recorded birth date (${Math.round((topAgeBand.count / ages.length) * 100)}%).`
    );
  } else {
    observations.push(
      "Age observations are unavailable because employee birth dates are missing."
    );
  }

  if (tenures.length) {
    const topTenureBand = largestBand(tenures, TENURE_BANDS);
    observations.push(
      `${topTenureBand.label.replace("-", "–")} is the largest tenure group, representing ${topTenureBand.count} of ${tenures.length} employees with a recorded hire date (${Math.round((topTenureBand.count / tenures.length) * 100)}%).`
    );
  } else {
    observations.push(
      "Tenure observations are unavailable because employee hire dates are missing."
    );
  }

  return {
    kind: "executive",
    title: "Executive Summary",
    metrics: [
      { label: "Total employees", value: String(total), detail: "Census headcount" },
      {
        label: "Average age",
        value: averageAge,
        detail: `${ages.length} of ${total} records`,
      },
      {
        label: "Average tenure",
        value: averageTenure,
        detail: `${tenures.length} of ${total} records`,
      },
      { label: "Geographic footprint", value: footprintValue, detail: footprintDetail },
      {
        label: "Medical participation",
        value: pct(enrolledMedical, total),
        detail: `${enrolledMedical} of ${total} enrolled`,
      },
    ],
    observations,
  };
}

function computeWorkforceRiskProfile(ds: ChartDataset): ChartResult {
  const ageRecords = ds.employees
    .map((employee) => ({
      employee,
      age: ageInYears(employee.birthDate, ds.effectiveDate),
    }))
    .filter((record): record is { employee: Employee; age: number } =>
      record.age !== null && record.age >= 0
    );
  const tenureRecords = ds.employees
    .map((employee) => ({
      employee,
      tenure: tenureInYears(employee.hireDate, ds.effectiveDate),
    }))
    .filter((record): record is { employee: Employee; tenure: number } =>
      record.tenure !== null && record.tenure >= 0
    );
  const combinedRecords = ds.employees.flatMap((employee) => {
    const age = ageInYears(employee.birthDate, ds.effectiveDate);
    const tenure = tenureInYears(employee.hireDate, ds.effectiveDate);
    return age !== null && age >= 0 && tenure !== null && tenure >= 0
      ? [{ age, tenure }]
      : [];
  });

  const newHires = tenureRecords.filter(({ tenure }) => tenure < 1).length;
  const established = tenureRecords.filter(({ tenure }) => tenure >= 5).length;
  const medicareHorizon = ageRecords.filter(({ age }) => age >= 60 && age < 65).length;
  const continuityExposure = combinedRecords.filter(
    ({ age, tenure }) => age >= 60 && tenure >= 10
  ).length;
  const age65Plus = ageRecords.filter(({ age }) => age >= 65).length;

  const cells = RISK_AGE_BANDS.flatMap(([ageBand]) =>
    RISK_TENURE_BANDS.map(([tenureBand]) => ({ ageBand, tenureBand, count: 0 }))
  );
  for (const { age, tenure } of combinedRecords) {
    const ageBand = bandFor(age, RISK_AGE_BANDS);
    const tenureBand = bandFor(tenure, RISK_TENURE_BANDS);
    cells.find(
      (cell) => cell.ageBand === ageBand && cell.tenureBand === tenureBand
    )!.count++;
  }

  const newHirePercentage = percentage(newHires, tenureRecords.length);
  const establishedPercentage = percentage(established, tenureRecords.length);
  const medicareHorizonPercentage = percentage(medicareHorizon, ageRecords.length);
  const continuityPercentage = percentage(continuityExposure, combinedRecords.length);

  const observations = [
    tenureRecords.length
      ? `${newHires} new hire${newHires === 1 ? "" : "s"} (${newHirePercentage.toFixed(1)}%) and ${established} established employee${established === 1 ? "" : "s"} (${establishedPercentage.toFixed(1)}%) show the current balance between onboarding and retained experience.`
      : "New-hire and established-workforce indicators are unavailable because hire dates are missing.",
    ageRecords.length
      ? `${medicareHorizon} employee${medicareHorizon === 1 ? " is" : "s are"} age 60–64, while ${age65Plus} ${age65Plus === 1 ? "is" : "are"} age 65 or older.`
      : "Age-horizon indicators are unavailable because birth dates are missing.",
    combinedRecords.length
      ? `${continuityExposure} employee${continuityExposure === 1 ? "" : "s"} (${continuityPercentage.toFixed(1)}%) combine age 60+ with 10+ years of service, highlighting where continuity planning may have the greatest value.`
      : "Continuity exposure is unavailable because no employee records contain both birth and hire dates.",
  ];

  return {
    kind: "risk",
    title: "Workforce Risk & Continuity Profile",
    indicators: [
      {
        key: "new-hires",
        label: "New hires",
        value: newHires,
        percentage: newHirePercentage,
        denominator: tenureRecords.length,
        definition: "Less than 1 year of service",
      },
      {
        key: "established",
        label: "Established workforce",
        value: established,
        percentage: establishedPercentage,
        denominator: tenureRecords.length,
        definition: "5 or more years of service",
      },
      {
        key: "medicare-horizon",
        label: "Medicare horizon",
        value: medicareHorizon,
        percentage: medicareHorizonPercentage,
        denominator: ageRecords.length,
        definition: "Age 60–64",
      },
      {
        key: "continuity-exposure",
        label: "Continuity exposure",
        value: continuityExposure,
        percentage: continuityPercentage,
        denominator: combinedRecords.length,
        definition: "Age 60+ and 10+ years of service",
      },
    ],
    ageBands: RISK_AGE_BANDS.map(([label]) => label),
    tenureBands: RISK_TENURE_BANDS.map(([label]) => label),
    cells,
    birthDateRecords: ageRecords.length,
    hireDateRecords: tenureRecords.length,
    completeRecords: combinedRecords.length,
    totalEmployees: ds.employees.length,
    observations,
    note: "Planning indicators use recorded birth and hire dates and do not predict retirement or individual Medicare eligibility. Percentages use records with the required dates.",
  };
}

function computeHeadcountStatTiles(ds: ChartDataset): ChartResult {
  const total = ds.employees.length;
  const ages = ds.employees
    .map((e) => ageInYears(e.birthDate, ds.effectiveDate))
    .filter((a): a is number => a !== null);
  const tenures = ds.employees
    .map((e) => tenureInYears(e.hireDate, ds.effectiveDate))
    .filter((t): t is number => t !== null);
  const enrolledMedical = ds.employees.filter((e) =>
    e.elections.some((el) => el.benefitType === "Medical" && !isWaived(el))
  ).length;

  return {
    kind: "stats",
    title: "Census Snapshot",
    stats: [
      { label: "Headcount", value: String(total) },
      {
        label: "Average age",
        value: ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : "-",
      },
      {
        label: "Average tenure",
        value: tenures.length
          ? `${(tenures.reduce((a, b) => a + b, 0) / tenures.length).toFixed(1)} yrs`
          : "-",
      },
      { label: "Medical participation", value: pct(enrolledMedical, total) },
    ],
  };
}

function computeAgeGenderDistribution(ds: ChartDataset): ChartResult {
  const rows = AGE_BANDS.map(([label]) => ({ band: label, Male: 0, Female: 0, Other: 0 }));

  for (const e of ds.employees) {
    const age = ageInYears(e.birthDate, ds.effectiveDate);
    if (age === null) continue;
    const band = bandFor(age, AGE_BANDS);
    const row = rows.find((r) => r.band === band)!;
    const gender = (e.gender ?? "").toUpperCase();
    if (gender.startsWith("M")) row.Male++;
    else if (gender.startsWith("F")) row.Female++;
    else row.Other++;
  }

  return {
    kind: "bar",
    title: "Age & Gender Distribution",
    xKey: "band",
    series: [
      { key: "Male", label: "Male" },
      { key: "Female", label: "Female" },
      { key: "Other", label: "Other/Unknown" },
    ],
    data: rows,
  };
}

function computeDemographicSummary(ds: ChartDataset): ChartResult {
  const ages = ds.employees
    .map((e) => ageInYears(e.birthDate, ds.effectiveDate))
    .filter((a): a is number => a !== null);
  const tenures = ds.employees
    .map((e) => tenureInYears(e.hireDate, ds.effectiveDate))
    .filter((t): t is number => t !== null);
  const total = ages.length;

  return {
    kind: "stats",
    title: "Demographic Summary",
    stats: [
      {
        label: "Average age",
        value: total ? (ages.reduce((a, b) => a + b, 0) / total).toFixed(1) : "-",
      },
      { label: "% over 55", value: pct(ages.filter((a) => a >= 55).length, total) },
      { label: "% over 65", value: pct(ages.filter((a) => a >= 65).length, total) },
      {
        label: "Average tenure",
        value: tenures.length
          ? `${(tenures.reduce((a, b) => a + b, 0) / tenures.length).toFixed(1)} yrs`
          : "-",
      },
    ],
  };
}

function computeTenureDistribution(ds: ChartDataset): ChartResult {
  const rows = TENURE_BANDS.map(([label]) => ({ band: label, Employees: 0 }));
  for (const e of ds.employees) {
    const tenure = tenureInYears(e.hireDate, ds.effectiveDate);
    if (tenure === null) continue;
    const band = bandFor(tenure, TENURE_BANDS);
    rows.find((r) => r.band === band)!.Employees++;
  }
  return {
    kind: "bar",
    title: "Tenure Distribution",
    xKey: "band",
    series: [{ key: "Employees", label: "Employees" }],
    data: rows,
  };
}

function computeSalaryBandDistribution(ds: ChartDataset): ChartResult {
  const rows = SALARY_BANDS.map(([label]) => ({ band: label, Employees: 0 }));
  for (const e of ds.employees) {
    const salary = e.baseSalary ? Number(e.baseSalary) : null;
    if (salary === null) continue;
    const band = bandFor(salary, SALARY_BANDS);
    rows.find((r) => r.band === band)!.Employees++;
  }
  return {
    kind: "bar",
    title: "Salary Band Distribution",
    xKey: "band",
    series: [{ key: "Employees", label: "Employees" }],
    data: rows,
  };
}

function computeTierEnrollment(ds: ChartDataset, benefitType: string, title: string): ChartResult {
  const tiers = ["Employee", "Employee + Spouse", "Employee + Child", "Family"];
  const row: Record<string, string | number> = { plan: benefitType };
  for (const t of tiers) row[t] = 0;
  let waived = 0;

  for (const e of ds.employees) {
    const el = e.elections.find((x) => x.benefitType === benefitType);
    if (!el) continue;
    if (isWaived(el)) {
      waived++;
      continue;
    }
    const tier = tierFromOption(el.optionName);
    row[tier] = (row[tier] as number) + 1;
  }
  row["Waived"] = waived;

  return {
    kind: "bar",
    title,
    xKey: "plan",
    series: [...tiers, "Waived"].map((t) => ({ key: t, label: t })),
    data: [row],
  };
}

function computeBenefitsParticipation(ds: ChartDataset): ChartResult {
  const eligible = ds.employees.length;
  const benefitTypes = ["Medical", "Dental", "Vision"];

  const benefits = benefitTypes.map((benefitType) => {
    let enrolled = 0;
    let waived = 0;

    for (const employee of ds.employees) {
      const elections = employee.elections.filter(
        (election) => election.benefitType === benefitType
      );
      if (elections.some((election) => !isWaived(election))) enrolled++;
      else if (elections.length > 0) waived++;
    }

    const unreported = Math.max(0, eligible - enrolled - waived);
    return {
      name: benefitType,
      eligible,
      enrolled,
      waived,
      unreported,
      participation: eligible ? (enrolled / eligible) * 100 : 0,
    };
  });

  return {
    kind: "participation",
    title: "Benefits Participation & Waivers",
    benefits,
    note: "Eligible reflects census headcount. Not recorded means no election or waiver was found for that benefit.",
  };
}

function computeDentalVisionEnrollment(ds: ChartDataset): ChartResult {
  const types = ["Dental", "Vision"];
  const data = types.map((benefitType) => {
    let enrolled = 0;
    let waived = 0;
    for (const e of ds.employees) {
      const el = e.elections.find((x) => x.benefitType === benefitType);
      if (!el) continue;
      if (isWaived(el)) waived++;
      else enrolled++;
    }
    return { plan: benefitType, Enrolled: enrolled, Waived: waived };
  });

  return {
    kind: "bar",
    title: "Dental & Vision Enrollment",
    xKey: "plan",
    series: [
      { key: "Enrolled", label: "Enrolled" },
      { key: "Waived", label: "Waived" },
    ],
    data,
  };
}

function computePlanOptionEnrollment(ds: ChartDataset): ChartResult {
  const counts = new Map<string, number>();
  for (const e of ds.employees) {
    for (const el of e.elections) {
      if (el.benefitType !== "Medical") continue;
      const key = el.optionName ?? el.planName ?? "Unknown";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const rows = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([option, count]) => [option, count]);

  return {
    kind: "table",
    title: "Enrollment by Plan Option (Medical)",
    columns: ["Plan option", "Employees"],
    rows,
  };
}

function computeWaivedCoverageSummary(ds: ChartDataset): ChartResult {
  const total = ds.employees.length;
  const types = ["Medical", "Dental", "Vision"];
  return {
    kind: "stats",
    title: "Waived Coverage Summary",
    stats: types.map((benefitType) => {
      const waived = ds.employees.filter((e) => {
        const el = e.elections.find((x) => x.benefitType === benefitType);
        return el && isWaived(el);
      }).length;
      return { label: `${benefitType} waived`, value: pct(waived, total) };
    }),
  };
}

function computePremiumSummaryTable(ds: ChartDataset): ChartResult {
  const rows = ds.policyLines.map((line) => [
    line.coverageType,
    line.planName,
    tierLabel(line.tier),
    `$${Number(line.employeeCost).toFixed(2)}`,
    `$${Number(line.employerCost).toFixed(2)}`,
    `$${Number(line.totalPremium).toFixed(2)}`,
    RATE_PERIOD_LABELS[line.ratePeriod as keyof typeof RATE_PERIOD_LABELS] ?? line.ratePeriod,
  ]);
  return {
    kind: "table",
    title: "Premium Summary by Tier",
    columns: [
      "Coverage",
      "Plan",
      "Tier",
      "Employee cost",
      "Employer cost",
      "Total premium",
      "Rate period",
    ],
    rows,
  };
}

function computeAncillaryVolumeSummary(ds: ChartDataset): ChartResult {
  const total = ds.employees.length;
  const types = [
    { key: "Life", label: "Basic Life" },
    { key: "LTD", label: "LTD" },
    { key: "STD", label: "STD" },
    { key: "VoluntaryLife", label: "Voluntary Life" },
    { key: "VoluntaryAD&D", label: "Voluntary AD&D" },
  ];

  const rows = types.map(({ key, label }) => {
    const volumes = ds.employees
      .flatMap((e) => e.elections)
      .filter((el) => el.benefitType === key && el.volume !== null)
      .map((el) => Number(el.volume));
    const count = volumes.length;
    const totalVolume = volumes.reduce((a, b) => a + b, 0);
    const avgVolume = count ? totalVolume / count : 0;
    return [label, count, pct(count, total), `$${avgVolume.toFixed(0)}`, `$${totalVolume.toFixed(0)}`];
  });

  return {
    kind: "table",
    title: "Life / STD / LTD Volume Summary",
    columns: ["Coverage", "Participants", "Participation", "Avg volume", "Total volume"],
    rows,
  };
}

function computeGenderBreakdown(ds: ChartDataset): ChartResult {
  let male = 0;
  let female = 0;
  let other = 0;
  for (const e of ds.employees) {
    const gender = (e.gender ?? "").toUpperCase();
    if (gender.startsWith("M")) male++;
    else if (gender.startsWith("F")) female++;
    else other++;
  }
  const data = [
    { name: "Male", value: male },
    { name: "Female", value: female },
  ];
  if (other > 0) data.push({ name: "Other/Unknown", value: other });
  return { kind: "pie", title: "Gender Breakdown", data };
}

function computeEmploymentStatusBreakdown(ds: ChartDataset): ChartResult {
  const counts = new Map<string, number>();
  for (const e of ds.employees) {
    const status = e.employmentStatus ?? "Unknown";
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return {
    kind: "pie",
    title: "Employment Status Breakdown",
    data: Array.from(counts.entries()).map(([name, value]) => ({ name, value })),
  };
}

function computeDependentCountDistribution(ds: ChartDataset): ChartResult {
  const bands = ["0", "1", "2", "3+"];
  const rows = bands.map((band) => ({ band, Employees: 0 }));
  for (const e of ds.employees) {
    const count = e.dependents.length;
    const band = count >= 3 ? "3+" : String(count);
    rows.find((r) => r.band === band)!.Employees++;
  }
  return {
    kind: "bar",
    title: "Dependent Count Distribution",
    xKey: "band",
    series: [{ key: "Employees", label: "Employees" }],
    data: rows,
  };
}

function computeNewHireSnapshot(ds: ChartDataset): ChartResult {
  const total = ds.employees.length;
  const newHires = ds.employees.filter((e) => {
    const tenure = tenureInYears(e.hireDate, ds.effectiveDate);
    return tenure !== null && tenure < 1;
  });
  const tenures = ds.employees
    .map((e) => tenureInYears(e.hireDate, ds.effectiveDate))
    .filter((t): t is number => t !== null);
  const under2 = tenures.filter((t) => t < 2).length;

  return {
    kind: "stats",
    title: "New Hire Snapshot",
    stats: [
      { label: "Hired in last 12 months", value: String(newHires.length) },
      { label: "New-hire %", value: pct(newHires.length, total) },
      { label: "Tenure < 2 years", value: pct(under2, total) },
    ],
  };
}

function computeDependentRelationshipBreakdown(ds: ChartDataset): ChartResult {
  const counts = new Map<string, number>();
  for (const e of ds.employees) {
    for (const dep of e.dependents) {
      // Normalize "Husband"/"Wife"/"Spouse" into one bucket — carriers vary on which they export.
      const rel = isSpouseRelationship(dep.relationshipType)
        ? "Spouse"
        : (dep.relationshipType ?? "Unknown");
      counts.set(rel, (counts.get(rel) ?? 0) + 1);
    }
  }
  return {
    kind: "pie",
    title: "Dependent Relationship Breakdown",
    data: Array.from(counts.entries()).map(([name, value]) => ({ name, value })),
  };
}

function computeDependentAgeDistribution(ds: ChartDataset): ChartResult {
  const rows = DEPENDENT_AGE_BANDS.map(([label]) => ({ band: label, Spouse: 0, Child: 0, Other: 0 }));
  for (const e of ds.employees) {
    for (const dep of e.dependents) {
      const age = ageInYears(dep.birthDate, ds.effectiveDate);
      if (age === null) continue;
      const band = bandFor(age, DEPENDENT_AGE_BANDS);
      const row = rows.find((r) => r.band === band)!;
      if (isSpouseRelationship(dep.relationshipType)) row.Spouse++;
      else if ((dep.relationshipType ?? "").toLowerCase().includes("child")) row.Child++;
      else row.Other++;
    }
  }
  return {
    kind: "bar",
    title: "Dependent Age Distribution",
    xKey: "band",
    series: [
      { key: "Spouse", label: "Spouse" },
      { key: "Child", label: "Child" },
      { key: "Other", label: "Other" },
    ],
    data: rows,
  };
}

function computeGeographicDistribution(ds: ChartDataset): ChartResult {
  const zipCounts = new Map<string, number>();
  const stateCounts = new Map<string, { name: string; value: number }>();
  const countyCounts = new Map<string, { name: string; value: number; stateFips: string; stateName: string }>();
  let mappedEmployees = 0;

  for (const e of ds.employees) {
    const zip = normalizeUsZip(e.postalCode) ?? "Unknown";
    zipCounts.set(zip, (zipCounts.get(zip) ?? 0) + 1);

    const geography = lookupPostalGeography(e.postalCode);
    if (!geography) continue;
    mappedEmployees++;

    const state = stateCounts.get(geography.stateFips) ?? {
      name: geography.stateName,
      value: 0,
    };
    state.value++;
    stateCounts.set(geography.stateFips, state);

    const county = countyCounts.get(geography.countyFips) ?? {
      name: geography.countyName,
      value: 0,
      stateFips: geography.stateFips,
      stateName: geography.stateName,
    };
    county.value++;
    countyCounts.set(geography.countyFips, county);
  }

  const totalEmployees = ds.employees.length;
  const coverage = totalEmployees ? mappedEmployees / totalEmployees : 0;
  const hasEnoughCoverage = mappedEmployees >= 2 && coverage >= 0.6;

  if (hasEnoughCoverage && stateCounts.size > 1) {
    return {
      kind: "map",
      title: "Workforce Geography",
      level: "state",
      areas: [...stateCounts.entries()].map(([id, state]) => ({ id, ...state })),
      totalEmployees,
      mappedEmployees,
      note: "Based on employee ZIP codes; 2020 Census ZCTA geography.",
    };
  }

  if (hasEnoughCoverage && stateCounts.size === 1 && countyCounts.size > 1) {
    const [focusStateFips, focusState] = [...stateCounts.entries()][0];
    return {
      kind: "map",
      title: `Workforce Geography — ${focusState.name}`,
      level: "county",
      focusStateFips,
      focusStateName: focusState.name,
      areas: [...countyCounts.entries()].map(([id, county]) => ({
        id,
        name: county.name,
        value: county.value,
      })),
      totalEmployees,
      mappedEmployees,
      note: "County estimated from ZIP code; 2020 Census ZCTA geography.",
    };
  }

  const rows = Array.from(zipCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([zip, count]) => [zip, count]);
  return {
    kind: "table",
    title: "Workforce Geography (Top ZIP Codes)",
    columns: ["Postal code", "Employees"],
    rows,
  };
}

function computeCostByCoverageSummary(ds: ChartDataset): ChartResult {
  const contribution = computeContributionStrategy(ds);
  const totals = new Map<string, { employeeCost: number; employerCost: number; totalPremium: number }>();
  for (const row of contribution.rows) {
    const existing = totals.get(row.benefit) ?? {
      employeeCost: 0,
      employerCost: 0,
      totalPremium: 0,
    };
    existing.employeeCost += row.annualEmployeeSpend;
    existing.employerCost += row.annualEmployerSpend;
    existing.totalPremium += row.annualTotalSpend;
    totals.set(row.benefit, existing);
  }
  const rows = Array.from(totals.entries()).map(([coverageType, t]) => [
    coverageType,
    `$${t.employeeCost.toFixed(2)}`,
    `$${t.employerCost.toFixed(2)}`,
    `$${t.totalPremium.toFixed(2)}`,
  ]);
  return {
    kind: "table",
    title: "Estimated Annual Cost by Coverage Type",
    columns: ["Coverage", "Employee cost", "Employer cost", "Total cost"],
    rows,
  };
}

function computeEmployerEmployeeCostSplit(ds: ChartDataset): ChartResult {
  const contribution = computeContributionStrategy(ds);
  const employeeTotal = contribution.annualEmployeeSpend;
  const employerTotal = contribution.annualEmployerSpend;
  return {
    kind: "pie",
    title: "Estimated Annual Employer vs. Employee Cost Split",
    data: [
      { name: "Employer", value: Math.round(employerTotal * 100) / 100 },
      { name: "Employee", value: Math.round(employeeTotal * 100) / 100 },
    ],
  };
}

function normalizedMatchKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function annualizationFactor(ratePeriod: string): number {
  if (ratePeriod === "monthly") return 12;
  if (ratePeriod === "per-pay-period") return 26;
  if (ratePeriod === "annual") return 1;
  return 0;
}

function percentageChange(current: number, prior: number): number | null {
  return prior === 0 ? null : ((current - prior) / prior) * 100;
}

function computeContributionStrategy(
  ds: ChartDataset
): Extract<ChartResult, { kind: "contribution" }> {
  const rows = ds.policyLines.map((line) => {
    const employeeRate = Number(line.employeeCost);
    const employerRate = Number(line.employerCost);
    const totalRate = employeeRate + employerRate;
    return {
      benefit: line.coverageType,
      plan: line.planName,
      tierCode: line.tier,
      tier: tierLabel(line.tier),
      aliases: line.aliases ?? [],
      enrollmentOverride: line.enrollmentOverride,
      enrolled: 0,
      employeeRate,
      employerRate,
      employerPaidPercentage: totalRate ? (employerRate / totalRate) * 100 : 0,
      ratePeriod: line.ratePeriod,
      annualEmployeeSpend: 0,
      annualEmployerSpend: 0,
      annualTotalSpend: 0,
    };
  });

  let totalElections = 0;
  let matchedElections = 0;

  for (const employee of ds.employees) {
    const electionsByBenefit = new Map<string, Election[]>();
    for (const election of employee.elections) {
      const benefitKey = normalizedMatchKey(election.benefitType);
      const elections = electionsByBenefit.get(benefitKey) ?? [];
      elections.push(election);
      electionsByBenefit.set(benefitKey, elections);
    }

    for (const elections of electionsByBenefit.values()) {
      const election = elections.find((item) => !isWaived(item));
      if (!election) continue;
      totalElections++;

      const benefitKey = normalizedMatchKey(election.benefitType);
      const tierCode = tierCodeFromOption(election.optionName);
      const tierCandidates = rows.filter(
        (row) =>
          normalizedMatchKey(row.benefit) === benefitKey &&
          rateTierMatches(row.tierCode, tierCode)
      );
      const planKey = normalizedMatchKey(election.planName);
      const exactPlanCandidates = planKey
        ? tierCandidates.filter(
            (row) =>
              normalizedMatchKey(row.plan) === planKey ||
              row.aliases.some((alias) => normalizedMatchKey(alias) === planKey)
          )
        : [];

      let matchedRow: (typeof rows)[number] | undefined;
      if (exactPlanCandidates.length === 1) matchedRow = exactPlanCandidates[0];
      else if (tierCandidates.length === 1) matchedRow = tierCandidates[0];

      if (!matchedRow) continue;
      matchedRow.enrolled++;
      matchedElections++;
    }
  }

  for (const row of rows) {
    if (row.enrollmentOverride !== null && row.enrollmentOverride !== undefined) {
      row.enrolled = row.enrollmentOverride;
    }
    const factor = annualizationFactor(row.ratePeriod);
    row.annualEmployeeSpend = row.employeeRate * factor * row.enrolled;
    row.annualEmployerSpend = row.employerRate * factor * row.enrolled;
    row.annualTotalSpend = row.annualEmployeeSpend + row.annualEmployerSpend;
  }

  const annualEmployeeSpend = rows.reduce(
    (sum, row) => sum + row.annualEmployeeSpend,
    0
  );
  const annualEmployerSpend = rows.reduce(
    (sum, row) => sum + row.annualEmployerSpend,
    0
  );

  return {
    kind: "contribution",
    title: "Employer vs. Employee Cost Strategy",
    rows: rows.map((row) => ({
      benefit: row.benefit,
      plan: row.plan,
      tier: row.tier,
      enrolled: row.enrolled,
      employeeRate: row.employeeRate,
      employerRate: row.employerRate,
      employerPaidPercentage: row.employerPaidPercentage,
      ratePeriod: row.ratePeriod,
      annualEmployeeSpend: row.annualEmployeeSpend,
      annualEmployerSpend: row.annualEmployerSpend,
      annualTotalSpend: row.annualTotalSpend,
    })),
    annualEmployeeSpend,
    annualEmployerSpend,
    annualTotalSpend: annualEmployeeSpend + annualEmployerSpend,
    matchedElections,
    totalElections,
    note: `Annual estimates use enrollment overrides when entered; otherwise they use census elections matched by benefit, plan alias, and tier. Monthly rates are multiplied by 12; per-pay-period rates assume 26 pay periods; annual rates are used as entered.${totalElections > matchedElections ? ` ${totalElections - matchedElections} active election${totalElections - matchedElections === 1 ? " was" : "s were"} not matched to a rate row.` : ""}`,
  };
}

function computeRenewalComparison(ds: ChartDataset): ChartResult {
  const priorPlanYear = ds.comparisonPlanYear;
  if (!priorPlanYear) {
    return {
      kind: "renewal",
      available: false,
      title: "Renewal Comparison",
      message: "Add an earlier plan year to enable renewal comparison.",
    };
  }

  const contribution = computeContributionStrategy(ds);
  const currentEntries = ds.policyLines.map((line, index) => ({
    line,
    index,
    enrolled: contribution.rows[index]?.enrolled ?? 0,
  }));
  const priorEntries = priorPlanYear.policyLines.map((line, index) => ({ line, index }));
  const usedPrior = new Set<number>();
  const pairs = new Map<
    number,
    { priorIndex: number; status: "matched" | "renamed" }
  >();

  const exactKey = (line: (typeof ds.policyLines)[number]) =>
    [
      normalizedMatchKey(line.coverageType),
      normalizedMatchKey(line.planName),
      line.tier,
    ].join("|");
  const benefitTierKey = (line: (typeof ds.policyLines)[number]) =>
    [normalizedMatchKey(line.coverageType), line.tier].join("|");

  for (const current of currentEntries) {
    if (!current.line.renewedFromPlanId) continue;
    const priorCandidates = priorEntries.filter(
      (entry) =>
        !usedPrior.has(entry.index) &&
        entry.line.planId === current.line.renewedFromPlanId &&
        entry.line.tier === current.line.tier
    );
    if (priorCandidates.length !== 1) continue;
    const prior = priorCandidates[0];
    pairs.set(current.index, {
      priorIndex: prior.index,
      status:
        normalizedMatchKey(current.line.planName) === normalizedMatchKey(prior.line.planName)
          ? "matched"
          : "renamed",
    });
    usedPrior.add(prior.index);
  }

  for (const current of currentEntries) {
    if (pairs.has(current.index)) continue;
    const key = exactKey(current.line);
    const currentWithKey = currentEntries.filter((entry) => exactKey(entry.line) === key);
    const priorCandidates = priorEntries.filter(
      (entry) => !usedPrior.has(entry.index) && exactKey(entry.line) === key
    );
    if (currentWithKey.length !== 1 || priorCandidates.length !== 1) continue;
    pairs.set(current.index, {
      priorIndex: priorCandidates[0].index,
      status: "matched",
    });
    usedPrior.add(priorCandidates[0].index);
  }

  const unmatchedCurrent = currentEntries.filter((entry) => !pairs.has(entry.index));
  const unmatchedPrior = priorEntries.filter((entry) => !usedPrior.has(entry.index));
  const fallbackKeys = new Set([
    ...unmatchedCurrent.map((entry) => benefitTierKey(entry.line)),
    ...unmatchedPrior.map((entry) => benefitTierKey(entry.line)),
  ]);
  for (const key of fallbackKeys) {
    const currentCandidates = unmatchedCurrent.filter(
      (entry) => !pairs.has(entry.index) && benefitTierKey(entry.line) === key
    );
    const priorCandidates = unmatchedPrior.filter(
      (entry) => !usedPrior.has(entry.index) && benefitTierKey(entry.line) === key
    );
    if (currentCandidates.length !== 1 || priorCandidates.length !== 1) continue;
    const current = currentCandidates[0];
    const prior = priorCandidates[0];
    pairs.set(current.index, {
      priorIndex: prior.index,
      status:
        normalizedMatchKey(current.line.planName) === normalizedMatchKey(prior.line.planName)
          ? "matched"
          : "renamed",
    });
    usedPrior.add(prior.index);
  }

  type RenewalRow = Extract<
    ChartResult,
    { kind: "renewal"; available: true }
  >["rows"][number];

  const rows: RenewalRow[] = currentEntries.map((current) => {
    const pair = pairs.get(current.index);
    const prior = pair ? priorEntries[pair.priorIndex].line : null;
    const currentEmployeeRate = Number(current.line.employeeCost);
    const currentEmployerRate = Number(current.line.employerCost);
    const currentFactor = annualizationFactor(current.line.ratePeriod);
    const currentAnnualEmployeeCost =
      currentEmployeeRate * currentFactor * current.enrolled;
    const currentAnnualEmployerCost =
      currentEmployerRate * currentFactor * current.enrolled;

    if (!prior || !pair) {
      return {
        status: "new",
        benefit: current.line.coverageType,
        priorPlan: null,
        currentPlan: current.line.planName,
        tier: tierLabel(current.line.tier),
        enrolled: current.enrolled,
        priorEmployeeRate: null,
        currentEmployeeRate,
        priorEmployerRate: null,
        currentEmployerRate,
        priorRatePeriod: null,
        currentRatePeriod: current.line.ratePeriod,
        priorAnnualEmployeeCost: null,
        currentAnnualEmployeeCost,
        priorAnnualEmployerCost: null,
        currentAnnualEmployerCost,
        totalChange: null,
        totalChangePercentage: null,
      };
    }

    const priorEmployeeRate = Number(prior.employeeCost);
    const priorEmployerRate = Number(prior.employerCost);
    const priorFactor = annualizationFactor(prior.ratePeriod);
    const priorAnnualEmployeeCost = priorEmployeeRate * priorFactor * current.enrolled;
    const priorAnnualEmployerCost = priorEmployerRate * priorFactor * current.enrolled;
    const priorAnnualTotalCost = priorAnnualEmployeeCost + priorAnnualEmployerCost;
    const currentAnnualTotalCost =
      currentAnnualEmployeeCost + currentAnnualEmployerCost;

    return {
      status: pair.status,
      benefit: current.line.coverageType,
      priorPlan: prior.planName,
      currentPlan: current.line.planName,
      tier: tierLabel(current.line.tier),
      enrolled: current.enrolled,
      priorEmployeeRate,
      currentEmployeeRate,
      priorEmployerRate,
      currentEmployerRate,
      priorRatePeriod: prior.ratePeriod,
      currentRatePeriod: current.line.ratePeriod,
      priorAnnualEmployeeCost,
      currentAnnualEmployeeCost,
      priorAnnualEmployerCost,
      currentAnnualEmployerCost,
      totalChange: currentAnnualTotalCost - priorAnnualTotalCost,
      totalChangePercentage: percentageChange(
        currentAnnualTotalCost,
        priorAnnualTotalCost
      ),
    };
  });

  for (const prior of priorEntries.filter((entry) => !usedPrior.has(entry.index))) {
    rows.push({
      status: "removed",
      benefit: prior.line.coverageType,
      priorPlan: prior.line.planName,
      currentPlan: null,
      tier: tierLabel(prior.line.tier),
      enrolled: 0,
      priorEmployeeRate: Number(prior.line.employeeCost),
      currentEmployeeRate: null,
      priorEmployerRate: Number(prior.line.employerCost),
      currentEmployerRate: null,
      priorRatePeriod: prior.line.ratePeriod,
      currentRatePeriod: null,
      priorAnnualEmployeeCost: null,
      currentAnnualEmployeeCost: null,
      priorAnnualEmployerCost: null,
      currentAnnualEmployerCost: null,
      totalChange: null,
      totalChangePercentage: null,
    });
  }

  const comparable = rows.filter(
    (row) => row.status === "matched" || row.status === "renamed"
  );
  const priorAnnualEmployeeCost = comparable.reduce(
    (sum, row) => sum + (row.priorAnnualEmployeeCost ?? 0),
    0
  );
  const currentAnnualEmployeeCost = comparable.reduce(
    (sum, row) => sum + (row.currentAnnualEmployeeCost ?? 0),
    0
  );
  const priorAnnualEmployerCost = comparable.reduce(
    (sum, row) => sum + (row.priorAnnualEmployerCost ?? 0),
    0
  );
  const currentAnnualEmployerCost = comparable.reduce(
    (sum, row) => sum + (row.currentAnnualEmployerCost ?? 0),
    0
  );
  const priorAnnualTotalCost = priorAnnualEmployeeCost + priorAnnualEmployerCost;
  const currentAnnualTotalCost = currentAnnualEmployeeCost + currentAnnualEmployerCost;
  const newRows = rows.filter((row) => row.status === "new").length;
  const removedRows = rows.filter((row) => row.status === "removed").length;
  const renamedRows = rows.filter((row) => row.status === "renamed").length;

  return {
    kind: "renewal",
    available: true,
    title: `Renewal Comparison — ${priorPlanYear.label} to ${ds.label}`,
    priorLabel: priorPlanYear.label,
    currentLabel: ds.label,
    priorEffectiveDate: priorPlanYear.effectiveDate,
    currentEffectiveDate: ds.effectiveDate,
    summary: {
      priorAnnualEmployerCost,
      currentAnnualEmployerCost,
      employerChange: currentAnnualEmployerCost - priorAnnualEmployerCost,
      employerChangePercentage: percentageChange(
        currentAnnualEmployerCost,
        priorAnnualEmployerCost
      ),
      priorAnnualEmployeeCost,
      currentAnnualEmployeeCost,
      employeeChange: currentAnnualEmployeeCost - priorAnnualEmployeeCost,
      employeeChangePercentage: percentageChange(
        currentAnnualEmployeeCost,
        priorAnnualEmployeeCost
      ),
      priorAnnualTotalCost,
      currentAnnualTotalCost,
      totalChange: currentAnnualTotalCost - priorAnnualTotalCost,
      totalChangePercentage: percentageChange(
        currentAnnualTotalCost,
        priorAnnualTotalCost
      ),
    },
    rows,
    comparableRows: comparable.length,
    renamedRows,
    newRows,
    removedRows,
    note: `Annual impact applies ${ds.label} enrollment to both rate sets for comparable rows, isolating rate changes from headcount changes.${newRows || removedRows ? ` ${newRows} new and ${removedRows} removed rate row${newRows + removedRows === 1 ? " is" : "s are"} excluded from the impact totals until uniquely matched.` : ""}${renamedRows ? ` ${renamedRows} uniquely paired row${renamedRows === 1 ? " was" : "s were"} treated as a plan rename.` : ""}`,
  };
}

function computeDataQualityAppendix(
  ds: ChartDataset
): Extract<ChartResult, { kind: "quality" }> {
  const totalEmployees = ds.employees.length;
  const fieldDefinitions = [
    {
      key: "birth-date" as const,
      label: "Birth date",
      isComplete: (employee: Employee) => employee.birthDate !== null,
    },
    {
      key: "hire-date" as const,
      label: "Hire date",
      isComplete: (employee: Employee) => employee.hireDate !== null,
    },
    {
      key: "zip" as const,
      label: "ZIP code",
      isComplete: (employee: Employee) => Boolean(employee.postalCode?.trim()),
    },
    {
      key: "salary" as const,
      label: "Base salary",
      isComplete: (employee: Employee) => employee.baseSalary !== null,
    },
  ];

  const fields = fieldDefinitions.map((field) => {
    const complete = ds.employees.filter(field.isComplete).length;
    return {
      key: field.key,
      label: field.label,
      complete,
      missing: totalEmployees - complete,
      coverage: percentage(complete, totalEmployees),
    };
  });
  const completedFieldValues = fields.reduce((sum, field) => sum + field.complete, 0);
  const censusCompleteness = percentage(
    completedFieldValues,
    totalEmployees * fieldDefinitions.length
  );
  const completeRecords = ds.employees.filter((employee) =>
    fieldDefinitions.every((field) => field.isComplete(employee))
  ).length;
  const recordedZipRecords = ds.employees.filter((employee) =>
    Boolean(employee.postalCode?.trim())
  ).length;
  const validZipRecords = ds.employees.filter((employee) =>
    Boolean(lookupPostalGeography(employee.postalCode))
  ).length;

  const contribution = computeContributionStrategy(ds);
  const unmatchedElections = contribution.totalElections - contribution.matchedElections;
  const largestGap = [...fields].sort((a, b) => b.missing - a.missing)[0];
  const invalidRecordedZips = recordedZipRecords - validZipRecords;

  const findings = [
    totalEmployees === 0
      ? "No employee census records are available to audit."
      : largestGap.missing === 0
        ? "Birth date, hire date, ZIP, and salary are present for every employee."
        : `${largestGap.label} has the largest completion gap: ${largestGap.missing} of ${totalEmployees} employee records are missing it.`,
    totalEmployees === 0
      ? "ZIP coverage is unavailable without employee records."
      : invalidRecordedZips > 0
        ? `${validZipRecords} of ${totalEmployees} employees have a mappable ZIP; ${invalidRecordedZips} recorded ZIP${invalidRecordedZips === 1 ? " is" : "s are"} not recognized.`
        : `${validZipRecords} of ${totalEmployees} employees have a mappable ZIP; ${totalEmployees - recordedZipRecords} ${totalEmployees - recordedZipRecords === 1 ? "record is" : "records are"} missing ZIP data.`,
    contribution.totalElections === 0
      ? "No active, non-waived plan elections are available for rate matching."
      : unmatchedElections === 0
        ? `All ${contribution.totalElections} active plan elections match a policy rate row.`
        : `${unmatchedElections} of ${contribution.totalElections} active plan elections do not match a unique policy rate row by benefit, plan, and tier.`,
  ];

  return {
    kind: "quality",
    title: "Data Quality Appendix",
    totalEmployees,
    censusCompleteness,
    completeRecords,
    validZipRecords,
    recordedZipRecords,
    activeElections: contribution.totalElections,
    matchedElections: contribution.matchedElections,
    unmatchedElections,
    fields,
    findings,
    note: "Core census completeness measures the presence of birth date, hire date, ZIP code, and base salary. Valid ZIPs must map to the packaged U.S. geography. Election matching uses benefit, plan, and coverage tier; waived elections are excluded.",
  };
}

function computeLifeVolumeDistribution(ds: ChartDataset): ChartResult {
  const rows = LIFE_VOLUME_BANDS.map(([label]) => ({ band: label, Employees: 0 }));
  for (const e of ds.employees) {
    const el = e.elections.find((x) => x.benefitType === "Life" && x.volume !== null);
    if (!el) continue;
    const band = bandFor(Number(el.volume), LIFE_VOLUME_BANDS);
    rows.find((r) => r.band === band)!.Employees++;
  }
  return {
    kind: "bar",
    title: "Basic Life Volume Distribution",
    xKey: "band",
    series: [{ key: "Employees", label: "Employees" }],
    data: rows,
  };
}

export const CHART_COMPUTE: Record<string, (ds: ChartDataset) => ChartResult> = {
  "executive-summary": computeExecutiveSummary,
  "workforce-risk-profile": computeWorkforceRiskProfile,
  "headcount-stat-tiles": computeHeadcountStatTiles,
  "age-gender-distribution": computeAgeGenderDistribution,
  "demographic-summary": computeDemographicSummary,
  "tenure-distribution": computeTenureDistribution,
  "salary-band-distribution": computeSalaryBandDistribution,
  "benefits-participation-funnel": computeBenefitsParticipation,
  "medical-tier-enrollment": (ds) => computeTierEnrollment(ds, "Medical", "Medical Coverage Tier Enrollment"),
  "dental-vision-enrollment": computeDentalVisionEnrollment,
  "dental-tier-enrollment": (ds) => computeTierEnrollment(ds, "Dental", "Dental Coverage Tier Enrollment"),
  "vision-tier-enrollment": (ds) => computeTierEnrollment(ds, "Vision", "Vision Coverage Tier Enrollment"),
  "plan-option-enrollment": computePlanOptionEnrollment,
  "waived-coverage-summary": computeWaivedCoverageSummary,
  "premium-summary-table": computePremiumSummaryTable,
  "contribution-strategy": computeContributionStrategy,
  "renewal-comparison": computeRenewalComparison,
  "ancillary-volume-summary": computeAncillaryVolumeSummary,
  "gender-breakdown": computeGenderBreakdown,
  "employment-status-breakdown": computeEmploymentStatusBreakdown,
  "dependent-count-distribution": computeDependentCountDistribution,
  "new-hire-snapshot": computeNewHireSnapshot,
  "dependent-relationship-breakdown": computeDependentRelationshipBreakdown,
  "dependent-age-distribution": computeDependentAgeDistribution,
  "geographic-distribution": computeGeographicDistribution,
  "cost-by-coverage-summary": computeCostByCoverageSummary,
  "employer-employee-cost-split": computeEmployerEmployeeCostSplit,
  "life-volume-distribution": computeLifeVolumeDistribution,
  "data-quality-appendix": computeDataQualityAppendix,
};
