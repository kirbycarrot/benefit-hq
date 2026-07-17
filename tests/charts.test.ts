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

test("premium chart output carries the rate period and enforced total", () => {
  const result = CHART_COMPUTE["premium-summary-table"](dataset());
  assert.equal(result.kind, "table");
  if (result.kind !== "table") return;

  assert.deepEqual(result.columns.slice(-2), ["Total premium", "Rate period"]);
  assert.equal(result.rows[0][2], "Employee");
  assert.deepEqual(result.rows[0].slice(-2), ["$500.00", "Monthly"]);
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
