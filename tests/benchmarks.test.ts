import test from "node:test";
import assert from "node:assert/strict";
import { buildBenchmarkComparison } from "@/lib/benchmarks/comparison";
import { buildMercerChartResults } from "@/lib/benchmarks/charts";
import { recommendBenchmarkCohort } from "@/lib/benchmarks/recommendation";
import type { BenchmarkDashboardData } from "@/lib/benchmarks/types";

const cohorts: BenchmarkDashboardData["cohorts"] = [
  {
    id: "national",
    code: "national.all",
    type: "national",
    label: "National All (50+)",
    shortLabel: "M:ALL",
    participantCount: 1991,
    sortOrder: 10,
  },
  {
    id: "technology",
    code: "industry.high-tech",
    type: "industry",
    label: "High Tech 500+",
    shortLabel: "M:HiTech",
    participantCount: 144,
    sortOrder: 20,
  },
  {
    id: "size",
    code: "size.500-999",
    type: "size",
    label: "500-999 employees",
    shortLabel: "M:500-999",
    participantCount: 303,
    sortOrder: 30,
  },
];

test("benchmark recommendation prefers a mapped industry cohort", () => {
  assert.deepEqual(
    recommendBenchmarkCohort(
      { primaryIndustry: "Technology", usEmployeeCount: 750 },
      cohorts
    ),
    {
      code: "industry.high-tech",
      reason: "Recommended from the client industry: Technology.",
    }
  );
});

test("benchmark recommendation falls back to exact employee-size cohort", () => {
  assert.equal(
    recommendBenchmarkCohort(
      { primaryIndustry: "Insurance", usEmployeeCount: 750 },
      cohorts
    ).code,
    "size.500-999"
  );
});

test("comparison normalizes percentages and preserves national and peer values", () => {
  const data: BenchmarkDashboardData = {
    dataset: {
      id: "mercer-2025-v1",
      provider: "Mercer",
      title: "Mercer survey",
      surveyYear: 2025,
      publicationYear: 2026,
      version: "2025.1",
      notes: null,
    },
    cohorts,
    nationalCohortCode: "national.all",
    selectedCohortCode: "industry.high-tech",
    recommendedCohortCode: "industry.high-tech",
    recommendationReason: "Recommended from the client industry: Technology.",
    metrics: [
      {
        code: "medical.cost.pepy.total",
        category: "Medical cost",
        label: "Average total health benefit cost per employee",
        description: null,
        unit: "currency_pepy",
        statistic: "average",
        comparisonKind: "direct",
        benefitType: "Medical",
        planSubtype: null,
        tier: null,
        clientFieldKey: null,
        direction: "lower",
        sortOrder: 5,
      },
      {
        code: "medical.premium.ppo.ee",
        category: "Medical premium",
        label: "PPO employee-only monthly premium",
        description: null,
        unit: "currency_monthly",
        statistic: "average",
        comparisonKind: "direct",
        benefitType: "Medical",
        planSubtype: "PPO",
        tier: "EE",
        clientFieldKey: "grossPremium",
        direction: "lower",
        sortOrder: 10,
      },
      {
        code: "medical.design.ppo.actuarial_value",
        category: "Plan design",
        label: "PPO actuarial value",
        description: null,
        unit: "percentage",
        statistic: "average",
        comparisonKind: "direct",
        benefitType: "Medical",
        planSubtype: "PPO",
        tier: null,
        clientFieldKey: "actuarialValue",
        direction: "higher",
        sortOrder: 20,
      },
      {
        code: "medical.prevalence.ppo",
        category: "Medical prevalence",
        label: "Employers offering PPO / POS",
        description: null,
        unit: "percentage",
        statistic: "prevalence",
        comparisonKind: "market_practice",
        benefitType: "Medical",
        planSubtype: "PPO",
        tier: null,
        clientFieldKey: "offered",
        direction: "neutral",
        sortOrder: 30,
      },
      {
        code: "medical.design.ppo.deductible_individual",
        category: "Plan design",
        label: "PPO individual deductible",
        description: null,
        unit: "currency_annual",
        statistic: "median",
        comparisonKind: "direct",
        benefitType: "Medical",
        planSubtype: "PPO",
        tier: null,
        clientFieldKey: "deductibleIndividual",
        direction: "lower",
        sortOrder: 25,
      },
    ],
    values: {
      "medical.cost.pepy.total": {
        "national.all": { value: 14500, availability: "available", sourceCell: "dMercer!T51" },
        "industry.high-tech": { value: 15200, availability: "available", sourceCell: "dMercer!AH51" },
      },
      "medical.premium.ppo.ee": {
        "national.all": { value: 850, availability: "available", sourceCell: "dMercer!T359" },
        "industry.high-tech": { value: 880, availability: "available", sourceCell: "dMercer!AH359" },
      },
      "medical.design.ppo.actuarial_value": {
        "national.all": { value: 0.89, availability: "available", sourceCell: "dMercer!T364" },
        "industry.high-tech": { value: 0.91, availability: "available", sourceCell: "dMercer!AH364" },
      },
      "medical.prevalence.ppo": {
        "national.all": { value: 0.84, availability: "available", sourceCell: "dMercer!T25" },
        "industry.high-tech": { value: 0.92, availability: "available", sourceCell: "dMercer!AH25" },
      },
      "medical.design.ppo.deductible_individual": {
        "national.all": { value: 750, availability: "available", sourceCell: "dMercer!T365" },
        "industry.high-tech": { value: 1000, availability: "available", sourceCell: "dMercer!AH365" },
      },
    },
    client: {
      name: "Example Client",
      industry: "Technology",
      employeeCount: 750,
      plans: [
        {
          id: "ppo-plan",
          name: "Core PPO",
          subtype: "PPO",
          details: { actuarialValue: 85 },
          rates: [
            {
              tier: "EE",
              grossPremium: 900,
              employeeContribution: 200,
              ratePeriod: "monthly",
            },
          ],
        },
      ],
    },
  };

  const result = buildBenchmarkComparison(data, "industry.high-tech");
  const plan = result.plans[0];
  assert.equal(plan.premiumRows[0]?.clientValue, 900);
  assert.equal(plan.premiumRows[0]?.peer.value, 880);
  assert.equal(plan.premiumRows[0]?.peerVariance, 20);
  assert.equal(plan.designRows[0]?.clientValue, 0.85);
  assert.equal(plan.designRows[0]?.national.value, 0.89);
  assert.equal(plan.designRows.length, 1);
  assert.equal(
    plan.designRows.some((row) => row.metricCode.endsWith("deductible_individual")),
    false
  );
  assert.equal(result.prevalence[0]?.offered, true);
  assert.equal(result.prevalence[0]?.peer.value, 0.92);

  const charts = buildMercerChartResults(data);
  const cost = charts["mercer-medical-cost-benchmark"];
  assert.equal(cost.kind, "benchmark");
  assert.equal(cost.available, true);
  if (cost.kind !== "benchmark" || !cost.available || cost.mode !== "cost") {
    assert.fail("Expected an available Mercer cost comparison");
  }
  assert.equal(cost.plans[0]?.premiumRows[0]?.peerVariance, 20);
  assert.equal(cost.medicalCostPerEmployee.available, false);

  const reliableCharts = buildMercerChartResults(data, {
    annualMedicalSpend: 3_600_000,
    employeeCount: 240,
    matchedMedicalElections: 190,
    totalMedicalElections: 200,
  });
  const reliableCost = reliableCharts["mercer-medical-cost-benchmark"];
  if (reliableCost.kind !== "benchmark" || !reliableCost.available || reliableCost.mode !== "cost") {
    assert.fail("Expected an available Mercer cost comparison");
  }
  assert.equal(reliableCost.medicalCostPerEmployee.available, true);
  if (!reliableCost.medicalCostPerEmployee.available) {
    assert.fail("Expected a reliable cost-per-employee comparison");
  }
  assert.equal(reliableCost.medicalCostPerEmployee.clientValue, 15000);
  assert.equal(reliableCost.medicalCostPerEmployee.peer.value, 15200);

  const unreliableCharts = buildMercerChartResults(data, {
    annualMedicalSpend: 3_600_000,
    employeeCount: 240,
    matchedMedicalElections: 179,
    totalMedicalElections: 200,
  });
  const unreliableCost = unreliableCharts["mercer-medical-cost-benchmark"];
  if (unreliableCost.kind !== "benchmark" || !unreliableCost.available || unreliableCost.mode !== "cost") {
    assert.fail("Expected an available Mercer cost comparison");
  }
  assert.equal(unreliableCost.medicalCostPerEmployee.available, false);

  const prevalence = charts["mercer-medical-plan-prevalence"];
  if (prevalence.kind !== "benchmark" || !prevalence.available || prevalence.mode !== "prevalence") {
    assert.fail("Expected an available Mercer prevalence comparison");
  }
  assert.equal(prevalence.rows[0]?.offered, true);
  assert.equal(prevalence.peerLabel, "High Tech 500+");

  const withoutPlanDesign: BenchmarkDashboardData = {
    ...data,
    client: {
      ...data.client,
      plans: data.client.plans.map((plan) => ({ ...plan, details: {} })),
    },
  };
  const noDesignCharts = buildMercerChartResults(withoutPlanDesign);
  const design = noDesignCharts["mercer-medical-plan-design"];
  assert.equal(design.kind, "benchmark");
  assert.equal(design.available, false);
});

test("Mercer deck charts explain when no benchmark dataset is available", () => {
  const charts = buildMercerChartResults(null);
  for (const result of Object.values(charts)) {
    assert.equal(result.kind, "benchmark");
    assert.equal(result.available, false);
  }
});
