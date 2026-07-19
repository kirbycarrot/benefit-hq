import assert from "node:assert/strict";
import test from "node:test";
import {
  benefitProgramInputSchema,
  policyReadinessIssues,
  policyTierFromCensusOption,
  type PolicyProgramInput,
} from "@/lib/policy-details";

function medicalProgram(): PolicyProgramInput {
  return {
    benefitType: "Medical",
    offered: true,
    plans: [
      {
        name: "PPO 1",
        subtype: "PPO",
        offered: true,
        details: {
          tierStructure: "four-tier",
          deductibleIndividual: 1_000,
          deductibleFamily: 2_000,
          oopMaximumIndividual: 5_000,
        },
        detailSchemaVersion: 1,
        renewedFromPlanId: null,
        sortOrder: 0,
        aliases: ["Carrier PPO"],
        rates: [
          {
            tier: "EE",
            grossPremium: 500,
            employeeContribution: 125,
            ratePeriod: "monthly",
            enrollmentOverride: 12,
            sortOrder: 0,
          },
        ],
      },
    ],
  };
}

test("structured medical policy details accept rates, provisions, and aliases", () => {
  const result = benefitProgramInputSchema.safeParse(medicalProgram());
  assert.equal(result.success, true);
});

test("employee contributions cannot exceed gross premium", () => {
  const program = medicalProgram();
  program.plans[0].rates[0].employeeContribution = 501;
  const result = benefitProgramInputSchema.safeParse(program);
  assert.equal(result.success, false);
  if (result.success) return;
  assert.match(result.error.issues[0].message, /cannot exceed gross premium/i);
});

test("census aliases cannot ambiguously point to two plans", () => {
  const program = medicalProgram();
  program.plans.push({
    ...program.plans[0],
    name: "PPO 2",
    aliases: ["Carrier PPO"],
    sortOrder: 1,
  });
  const result = benefitProgramInputSchema.safeParse(program);
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(
    result.error.issues.some((issue) => /aliases must be unique/i.test(issue.message)),
    true
  );
});

test("readiness ignores retained plans for benefits marked not offered", () => {
  const program = medicalProgram();
  program.offered = false;
  program.plans[0].rates = [];
  assert.deepEqual(policyReadinessIssues([program]), []);
});

test("readiness flags internally inconsistent plan limits", () => {
  const program = medicalProgram();
  program.plans[0].details.oopMaximumIndividual = 500;
  const issues = policyReadinessIssues([program]);
  assert.equal(issues.some((issue) => issue.severity === "error"), true);
  assert.match(issues[0].message, /out-of-pocket maximum/i);
});

test("census option labels map to the standard policy tiers", () => {
  assert.equal(policyTierFromCensusOption("Employee only"), "EE");
  assert.equal(policyTierFromCensusOption("EE/SP"), "EE+Spouse");
  assert.equal(policyTierFromCensusOption("Employee + Child"), "EE+Child");
  assert.equal(policyTierFromCensusOption("Employee + Family"), "Family");
});
