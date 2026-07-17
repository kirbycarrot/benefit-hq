import assert from "node:assert/strict";
import test from "node:test";
import { addCurrencyAmounts, policyLineSchema } from "@/lib/validation";

test("policy lines require an explicit supported rate period", () => {
  const parsed = policyLineSchema.safeParse({
    coverageType: "Medical",
    planName: "PPO",
    tier: "EE",
    employeeCost: "125.10",
    employerCost: "374.90",
    ratePeriod: "monthly",
  });

  assert.equal(parsed.success, true);
  assert.equal(policyLineSchema.safeParse({
    coverageType: "Medical",
    planName: "PPO",
    tier: "EE",
    employeeCost: 1,
    employerCost: 2,
    ratePeriod: "sometimes",
  }).success, false);
});

test("currency addition is stable at cent precision", () => {
  assert.equal(addCurrencyAmounts(0.1, 0.2), 0.3);
  assert.equal(addCurrencyAmounts(125.105, 374.904), 500.01);
});
