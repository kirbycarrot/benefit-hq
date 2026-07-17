import type { ChartDataset } from "./dataset";
import { ageInYears, tenureInYears } from "./dataset";
import type { ChartResult } from "./types";
import { RATE_PERIOD_LABELS, TIER_LABELS } from "@/lib/validation";
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
function tierFromOption(optionName: string | null): string {
  const text = (optionName ?? "").toLowerCase();
  const hasSpouse = /spouse|[/+\- ]sp\b/.test(text);
  const hasChild = /child|[/+\- ]ch\b/.test(text);
  if (text.includes("family") || (hasSpouse && hasChild)) return "Family";
  if (hasSpouse) return "Employee + Spouse";
  if (hasChild) return "Employee + Child";
  return "Employee";
}

function isSpouseRelationship(relationshipType: string | null | undefined): boolean {
  const text = (relationshipType ?? "").toLowerCase();
  return text.includes("spouse") || text.includes("husband") || text.includes("wife");
}

function pct(count: number, total: number): string {
  if (total === 0) return "0%";
  return `${((count / total) * 100).toFixed(1)}%`;
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
    TIER_LABELS[line.tier as keyof typeof TIER_LABELS] ?? line.tier,
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
  const totals = new Map<string, { employeeCost: number; employerCost: number; totalPremium: number }>();
  for (const line of ds.policyLines) {
    const existing = totals.get(line.coverageType) ?? {
      employeeCost: 0,
      employerCost: 0,
      totalPremium: 0,
    };
    existing.employeeCost += Number(line.employeeCost);
    existing.employerCost += Number(line.employerCost);
    existing.totalPremium += Number(line.totalPremium);
    totals.set(line.coverageType, existing);
  }
  const rows = Array.from(totals.entries()).map(([coverageType, t]) => [
    coverageType,
    `$${t.employeeCost.toFixed(2)}`,
    `$${t.employerCost.toFixed(2)}`,
    `$${t.totalPremium.toFixed(2)}`,
  ]);
  return {
    kind: "table",
    title: `Cost Summary by Coverage Type (${RATE_PERIOD_LABELS[ds.policyLines[0]?.ratePeriod as keyof typeof RATE_PERIOD_LABELS] ?? "Rate"})`,
    columns: ["Coverage", "Employee cost", "Employer cost", "Total premium"],
    rows,
  };
}

function computeEmployerEmployeeCostSplit(ds: ChartDataset): ChartResult {
  let employeeTotal = 0;
  let employerTotal = 0;
  for (const line of ds.policyLines) {
    employeeTotal += Number(line.employeeCost);
    employerTotal += Number(line.employerCost);
  }
  return {
    kind: "pie",
    title: `Employer vs. Employee Cost Split (${RATE_PERIOD_LABELS[ds.policyLines[0]?.ratePeriod as keyof typeof RATE_PERIOD_LABELS] ?? "Rate"})`,
    data: [
      { name: "Employer", value: Math.round(employerTotal * 100) / 100 },
      { name: "Employee", value: Math.round(employeeTotal * 100) / 100 },
    ],
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
};
