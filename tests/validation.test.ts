import assert from "node:assert/strict";
import test from "node:test";
import {
  TIER_LABELS,
  addCurrencyAmounts,
  deckSelectionsSchema,
  policyLineSchema,
  ratePeriodSchema,
} from "@/lib/validation";

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

test("rate period updates accept only supported values", () => {
  assert.equal(ratePeriodSchema.safeParse({ ratePeriod: "annual" }).success, true);
  assert.equal(ratePeriodSchema.safeParse({ ratePeriod: "sometimes" }).success, false);
});

test("deck selections accept persisted chart views", () => {
  assert.equal(
    deckSelectionsSchema.safeParse({
      "geographic-distribution": { enabled: true, params: { view: "bar" } },
    }).success,
    true
  );
  assert.equal(
    deckSelectionsSchema.safeParse({
      "geographic-distribution": { enabled: "yes", params: { view: "bar" } },
    }).success,
    false
  );
});

test("employee tier labels use full names", () => {
  assert.equal(TIER_LABELS.EE, "Employee");
  assert.equal(TIER_LABELS["EE+Spouse"], "Employee + Spouse");
  assert.equal(TIER_LABELS["EE+Child"], "Employee + Child");
});

test("currency addition is stable at cent precision", () => {
  assert.equal(addCurrencyAmounts(0.1, 0.2), 0.3);
  assert.equal(addCurrencyAmounts(125.105, 374.904), 500.01);
});
