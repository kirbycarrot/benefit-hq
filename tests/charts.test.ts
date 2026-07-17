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
