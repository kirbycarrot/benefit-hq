import assert from "node:assert/strict";
import test from "node:test";
import { CHART_COMPUTE } from "@/lib/charts/compute";
import type { ChartDataset } from "@/lib/charts/dataset";

function dataset(): ChartDataset {
  return {
    id: "plan-year",
    clientId: "client",
    label: "2027",
    effectiveDate: new Date("2027-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    employees: [
      {
        id: "employee",
        planYearId: "plan-year",
        employeeNumber: "E-1",
        firstName: "Avery",
        lastName: "Broker",
        birthDate: new Date("1987-01-01T00:00:00Z"),
        gender: "F",
        hireDate: new Date("2022-01-01T00:00:00Z"),
        employmentStatus: "Active",
        baseSalary: null,
        postalCode: null,
        dependents: [],
        elections: [
          {
            id: "election",
            employeeId: "employee",
            benefitType: "Medical",
            planName: "PPO",
            optionName: "EE",
            volume: null,
          },
        ],
      },
    ],
    policyLines: [
      {
        id: "policy-line",
        planYearId: "plan-year",
        coverageType: "Medical",
        planName: "PPO",
        tier: "EE",
        employeeCost: 125 as never,
        employerCost: 375 as never,
        totalPremium: 500 as never,
        ratePeriod: "monthly",
        sortOrder: 0,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ],
  };
}

function datasetWithZips(zips: string[]): ChartDataset {
  const base = dataset();
  return {
    ...base,
    employees: zips.map((postalCode, index) => ({
      ...base.employees[0],
      id: `employee-${index}`,
      employeeNumber: `E-${index + 1}`,
      postalCode,
      elections: base.employees[0].elections.map((election) => ({
        ...election,
        id: `election-${index}`,
        employeeId: `employee-${index}`,
      })),
    })),
  };
}

function participationDataset(): ChartDataset {
  const base = dataset();
  const electionSets: [string, string][][] = [
    [
      ["Medical", "Employee"],
      ["Dental", "Employee"],
      ["Vision", "Waive"],
    ],
    [
      ["Medical", "Waive"],
      ["Dental", "Employee"],
    ],
    [
      ["Medical", "Employee + Spouse"],
      ["Dental", "Waive"],
      ["Vision", "Employee"],
    ],
    [],
  ];

  return {
    ...base,
    employees: electionSets.map((elections, employeeIndex) => ({
      ...base.employees[0],
      id: `employee-${employeeIndex}`,
      employeeNumber: `E-${employeeIndex + 1}`,
      elections: elections.map(([benefitType, optionName], electionIndex) => ({
        ...base.employees[0].elections[0],
        id: `election-${employeeIndex}-${electionIndex}`,
        employeeId: `employee-${employeeIndex}`,
        benefitType,
        optionName,
      })),
    })),
  };
}

function workforceRiskDataset(): ChartDataset {
  const base = dataset();
  const dates: [string | null, string | null][] = [
    ["1995-01-01", "2026-07-01"],
    ["1985-01-01", "2020-01-01"],
    ["1964-01-01", "2018-01-01"],
    ["1962-01-01", "2014-01-01"],
    ["1959-01-01", "2011-01-01"],
    [null, null],
  ];

  return {
    ...base,
    employees: dates.map(([birthDate, hireDate], index) => ({
      ...base.employees[0],
      id: `risk-employee-${index}`,
      employeeNumber: `R-${index + 1}`,
      birthDate: birthDate ? new Date(`${birthDate}T00:00:00Z`) : null,
      hireDate: hireDate ? new Date(`${hireDate}T00:00:00Z`) : null,
      elections: [],
    })),
  };
}

function dataQualityDataset(): ChartDataset {
  const base = dataset();
  const profiles = [
    {
      birthDate: new Date("1985-01-01T00:00:00Z"),
      hireDate: new Date("2020-01-01T00:00:00Z"),
      postalCode: "80202",
      baseSalary: 75000 as never,
      optionName: "EE",
    },
    {
      birthDate: new Date("1990-01-01T00:00:00Z"),
      hireDate: new Date("2021-01-01T00:00:00Z"),
      postalCode: "99999",
      baseSalary: null,
      optionName: "Family",
    },
    {
      birthDate: null,
      hireDate: new Date("2022-01-01T00:00:00Z"),
      postalCode: "80301",
      baseSalary: 65000 as never,
      optionName: null,
    },
    {
      birthDate: new Date("1975-01-01T00:00:00Z"),
      hireDate: null,
      postalCode: null,
      baseSalary: 90000 as never,
      optionName: "Waive",
    },
  ];

  return {
    ...base,
    employees: profiles.map((profile, index) => ({
      ...base.employees[0],
      id: `quality-employee-${index}`,
      employeeNumber: `Q-${index + 1}`,
      birthDate: profile.birthDate,
      hireDate: profile.hireDate,
      postalCode: profile.postalCode,
      baseSalary: profile.baseSalary,
      elections:
        profile.optionName === null
          ? []
          : [
              {
                ...base.employees[0].elections[0],
                id: `quality-election-${index}`,
                employeeId: `quality-employee-${index}`,
                optionName: profile.optionName,
              },
            ],
    })),
  };
}

function renewalDataset(): ChartDataset {
  const current = dataset();
  return {
    ...current,
    comparisonPlanYear: {
      id: "prior-plan-year",
      label: "2026",
      effectiveDate: new Date("2026-01-01T00:00:00Z"),
      policyLines: [
        {
          ...current.policyLines[0],
          id: "prior-policy-line",
          planYearId: "prior-plan-year",
          employeeCost: 100 as never,
          employerCost: 300 as never,
          totalPremium: 400 as never,
          createdAt: new Date("2025-01-01T00:00:00Z"),
        },
      ],
    },
  };
}

test("premium chart output carries the rate period and enforced total", () => {
  const result = CHART_COMPUTE["premium-summary-table"](dataset());
  assert.equal(result.kind, "table");
  if (result.kind !== "table") return;

  assert.deepEqual(result.columns.slice(-2), ["Total premium", "Rate period"]);
  assert.equal(result.rows[0][2], "Employee");
  assert.deepEqual(result.rows[0].slice(-2), ["$500.00", "Monthly"]);

  const largeDataset = dataset();
  largeDataset.policyLines[0].employeeCost = 500 as never;
  largeDataset.policyLines[0].employerCost = 1000 as never;
  largeDataset.policyLines[0].totalPremium = 1500 as never;
  const largeResult = CHART_COMPUTE["premium-summary-table"](largeDataset);
  assert.equal(largeResult.kind, "table");
  if (largeResult.kind !== "table") return;
  assert.deepEqual(largeResult.rows[0].slice(-4, -1), ["$500.00", "$1,000.00", "$1,500.00"]);
});

test("headcount calculations include medical participation", () => {
  const result = CHART_COMPUTE["headcount-stat-tiles"](dataset());
  assert.equal(result.kind, "stats");
  if (result.kind !== "stats") return;

  assert.deepEqual(result.stats.find((stat) => stat.label === "Medical participation"), {
    label: "Medical participation",
    value: "100.0%",
  });
});

test("executive summary combines workforce metrics with data-derived observations", () => {
  const result = CHART_COMPUTE["executive-summary"](
    datasetWithZips(["80202", "80301", "10001", "90210"])
  );

  assert.equal(result.kind, "executive");
  if (result.kind !== "executive") return;
  assert.deepEqual(
    result.metrics.map((metric) => [metric.label, metric.value]),
    [
      ["Total employees", "4"],
      ["Average age", "40.0"],
      ["Average tenure", "5.0 yrs"],
      ["Geographic footprint", "3 states"],
      ["Medical participation", "100.0%"],
    ]
  );
  assert.equal(result.observations.length, 3);
  assert.match(result.observations[0], /Employees span 3 states/);
  assert.match(result.observations[1], /largest age group/);
  assert.match(result.observations[2], /largest tenure group/);
});

test("workforce risk profile combines age and tenure with transparent denominators", () => {
  const result = CHART_COMPUTE["workforce-risk-profile"](workforceRiskDataset());

  assert.equal(result.kind, "risk");
  if (result.kind !== "risk") return;
  assert.equal(result.totalEmployees, 6);
  assert.equal(result.birthDateRecords, 5);
  assert.equal(result.hireDateRecords, 5);
  assert.equal(result.completeRecords, 5);
  assert.deepEqual(
    result.indicators.map(({ key, value, percentage, denominator }) => ({
      key,
      value,
      percentage,
      denominator,
    })),
    [
      { key: "new-hires", value: 1, percentage: 20, denominator: 5 },
      { key: "established", value: 4, percentage: 80, denominator: 5 },
      { key: "medicare-horizon", value: 2, percentage: 40, denominator: 5 },
      { key: "continuity-exposure", value: 2, percentage: 40, denominator: 5 },
    ]
  );
  assert.equal(
    result.cells.reduce((sum, cell) => sum + cell.count, 0),
    result.completeRecords
  );
  assert.equal(result.observations.length, 3);
  assert.match(result.note, /do not predict retirement/);
});

test("data quality appendix reconciles field, ZIP, and election coverage", () => {
  const result = CHART_COMPUTE["data-quality-appendix"](dataQualityDataset());

  assert.equal(result.kind, "quality");
  if (result.kind !== "quality") return;
  assert.equal(result.totalEmployees, 4);
  assert.equal(result.censusCompleteness, 75);
  assert.equal(result.completeRecords, 1);
  assert.equal(result.recordedZipRecords, 3);
  assert.equal(result.validZipRecords, 2);
  assert.equal(result.activeElections, 2);
  assert.equal(result.matchedElections, 1);
  assert.equal(result.unmatchedElections, 1);
  assert.deepEqual(
    result.fields.map(({ key, complete, missing, coverage }) => ({
      key,
      complete,
      missing,
      coverage,
    })),
    [
      { key: "birth-date", complete: 3, missing: 1, coverage: 75 },
      { key: "hire-date", complete: 3, missing: 1, coverage: 75 },
      { key: "zip", complete: 3, missing: 1, coverage: 75 },
      { key: "salary", complete: 3, missing: 1, coverage: 75 },
    ]
  );
  assert.equal(result.findings.length, 3);
  assert.match(result.findings[1], /not recognized/);
  assert.match(result.findings[2], /do not match/);
});

test("benefits participation reconciles enrolled, waived, and unreported employees", () => {
  const result = CHART_COMPUTE["benefits-participation-funnel"](
    participationDataset()
  );

  assert.equal(result.kind, "participation");
  if (result.kind !== "participation") return;
  assert.deepEqual(result.benefits, [
    {
      name: "Medical",
      eligible: 4,
      enrolled: 2,
      waived: 1,
      unreported: 1,
      participation: 50,
    },
    {
      name: "Dental",
      eligible: 4,
      enrolled: 2,
      waived: 1,
      unreported: 1,
      participation: 50,
    },
    {
      name: "Vision",
      eligible: 4,
      enrolled: 1,
      waived: 1,
      unreported: 2,
      participation: 25,
    },
  ]);
  for (const benefit of result.benefits) {
    assert.equal(
      benefit.enrolled + benefit.waived + benefit.unreported,
      benefit.eligible
    );
  }
});

test("contribution strategy matches elections to tiers and annualizes monthly rates", () => {
  const ds = dataset();
  ds.employees[0].elections.push({
    id: "life-election",
    employeeId: "employee",
    benefitType: "Life",
    planName: "Basic Life",
    optionName: "Employee",
    volume: 100_000 as never,
  });
  const result = CHART_COMPUTE["contribution-strategy"](ds);

  assert.equal(result.kind, "contribution");
  if (result.kind !== "contribution") return;
  assert.equal(result.matchedElections, 1);
  assert.equal(result.totalElections, 1);
  assert.equal(result.rows[0].enrolled, 1);
  assert.equal(result.rows[0].employerPaidPercentage, 75);
  assert.equal(result.annualEmployeeSpend, 1500);
  assert.equal(result.annualEmployerSpend, 4500);
  assert.equal(result.annualTotalSpend, 6000);
  assert.deepEqual(result.benefitMatchStats, [
    { benefit: "Medical", matchedElections: 1, totalElections: 1 },
  ]);
});

test("contribution strategy assumes 26 periods and recognizes full spouse tier names", () => {
  const ds = dataset();
  ds.employees[0].elections[0].optionName = "Employee + Spouse";
  ds.policyLines[0].tier = "EE+Spouse";
  ds.policyLines[0].employeeCost = 10 as never;
  ds.policyLines[0].employerCost = 30 as never;
  ds.policyLines[0].totalPremium = 40 as never;
  ds.policyLines[0].ratePeriod = "per-pay-period";

  const result = CHART_COMPUTE["contribution-strategy"](ds);

  assert.equal(result.kind, "contribution");
  if (result.kind !== "contribution") return;
  assert.equal(result.rows[0].tier, "Employee + Spouse");
  assert.equal(result.rows[0].enrolled, 1);
  assert.equal(result.annualEmployeeSpend, 260);
  assert.equal(result.annualEmployerSpend, 780);
  assert.equal(result.annualTotalSpend, 1040);
});

test("contribution strategy matches plan aliases and combined dependent tiers", () => {
  const ds = dataset();
  ds.employees[0].elections[0].planName = "Carrier PPO Option";
  ds.employees[0].elections[0].optionName = "Employee + Spouse";
  ds.policyLines[0].tier = "EE+Dependent";
  ds.policyLines[0].aliases = ["Carrier PPO Option"];

  const result = CHART_COMPUTE["contribution-strategy"](ds);

  assert.equal(result.kind, "contribution");
  if (result.kind !== "contribution") return;
  assert.equal(result.matchedElections, 1);
  assert.equal(result.rows[0].tier, "Employee + Dependent");
  assert.equal(result.rows[0].enrolled, 1);
});

test("enrollment overrides control projected spend without hiding census match quality", () => {
  const ds = dataset();
  ds.policyLines[0].enrollmentOverride = 3;

  const result = CHART_COMPUTE["contribution-strategy"](ds);

  assert.equal(result.kind, "contribution");
  if (result.kind !== "contribution") return;
  assert.equal(result.matchedElections, 1);
  assert.equal(result.rows[0].enrolled, 3);
  assert.equal(result.annualTotalSpend, 18_000);
});

test("renewal comparison applies current enrollment to both rate sets", () => {
  const result = CHART_COMPUTE["renewal-comparison"](renewalDataset());

  assert.equal(result.kind, "renewal");
  if (result.kind !== "renewal" || !result.available) return;
  assert.equal(result.priorLabel, "2026");
  assert.equal(result.currentLabel, "2027");
  assert.equal(result.comparableRows, 1);
  assert.equal(result.newRows, 0);
  assert.equal(result.removedRows, 0);
  assert.equal(result.summary.priorAnnualEmployeeCost, 1200);
  assert.equal(result.summary.currentAnnualEmployeeCost, 1500);
  assert.equal(result.summary.employeeChange, 300);
  assert.equal(result.summary.priorAnnualEmployerCost, 3600);
  assert.equal(result.summary.currentAnnualEmployerCost, 4500);
  assert.equal(result.summary.employerChange, 900);
  assert.equal(result.summary.priorAnnualTotalCost, 4800);
  assert.equal(result.summary.currentAnnualTotalCost, 6000);
  assert.equal(result.summary.totalChange, 1200);
  assert.equal(result.summary.totalChangePercentage, 25);
  assert.equal(result.rows[0].enrolled, 1);
  assert.equal(result.rows[0].totalChange, 1200);
});

test("renewal comparison is unavailable when there is only one plan year", () => {
  const result = CHART_COMPUTE["renewal-comparison"](dataset());

  assert.deepEqual(result, {
    kind: "renewal",
    available: false,
    title: "Renewal Comparison",
    message: "Add an earlier plan year to enable renewal comparison.",
  });
});

test("renewal comparison pairs a unique plan rename without treating it as new spend", () => {
  const ds = renewalDataset();
  ds.policyLines[0].planName = "Renewal PPO";
  ds.comparisonPlanYear!.policyLines[0].planName = "Legacy PPO";

  const result = CHART_COMPUTE["renewal-comparison"](ds);

  assert.equal(result.kind, "renewal");
  if (result.kind !== "renewal" || !result.available) return;
  assert.equal(result.comparableRows, 1);
  assert.equal(result.renamedRows, 1);
  assert.equal(result.newRows, 0);
  assert.equal(result.removedRows, 0);
  assert.equal(result.rows[0].status, "renamed");
  assert.equal(result.rows[0].priorPlan, "Legacy PPO");
  assert.equal(result.rows[0].currentPlan, "Renewal PPO");
});

test("workforce geography uses a state map when employees span states", () => {
  const result = CHART_COMPUTE["geographic-distribution"](
    datasetWithZips(["80202", "80301", "10001", "90210"])
  );

  assert.equal(result.kind, "map");
  if (result.kind !== "map") return;
  assert.equal(result.level, "state");
  assert.equal(result.mappedEmployees, 4);
  assert.deepEqual(
    result.areas.map((area) => area.name).sort(),
    ["California", "Colorado", "New York"]
  );
});

test("workforce geography drills into counties for a single state", () => {
  const result = CHART_COMPUTE["geographic-distribution"](
    datasetWithZips(["80202", "80202", "80301"])
  );

  assert.equal(result.kind, "map");
  if (result.kind !== "map") return;
  assert.equal(result.level, "county");
  assert.equal(result.focusStateName, "Colorado");
  assert.deepEqual(
    result.areas.map((area) => [area.name, area.value]).sort(),
    [
      ["Boulder", 1],
      ["Denver", 2],
    ]
  );
});

test("workforce geography keeps the ZIP table when a map would add no detail", () => {
  const result = CHART_COMPUTE["geographic-distribution"](
    datasetWithZips(["80202", "80203"])
  );

  assert.equal(result.kind, "table");
  if (result.kind !== "table") return;
  assert.equal(result.title, "Workforce Geography (Top ZIP Codes)");
});
