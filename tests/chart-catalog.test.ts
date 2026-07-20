import assert from "node:assert/strict";
import test from "node:test";
import { CHART_DEFINITIONS } from "@/lib/charts/catalog";

test("chart catalog follows the presentation story order", () => {
  const categories = [...new Set(CHART_DEFINITIONS.map((definition) => definition.category))];

  assert.deepEqual(categories, [
    "overview",
    "renewal & cost",
    "participation & enrollment",
    "workforce profile",
    "dependent profile",
    "ancillary benefits",
    "appendix",
  ]);

  const sortOrders = CHART_DEFINITIONS.map((definition) => definition.sortOrder);
  assert.deepEqual(sortOrders, [...sortOrders].sort((left, right) => left - right));
  assert.equal(new Set(sortOrders).size, sortOrders.length);
  assert.equal(
    CHART_DEFINITIONS.some((definition) => definition.key.startsWith("mercer-")),
    false
  );
});

test("chart catalog defaults to the concise recommended deck", () => {
  const enabledKeys = CHART_DEFINITIONS.filter(
    (definition) => definition.defaultEnabled
  ).map((definition) => definition.key);

  assert.deepEqual(enabledKeys, [
    "executive-summary",
    "renewal-comparison",
    "contribution-strategy",
    "benefits-participation-funnel",
    "plan-option-enrollment",
    "medical-tier-enrollment",
    "dental-tier-enrollment",
    "vision-tier-enrollment",
    "workforce-risk-profile",
    "geographic-distribution",
    "age-gender-distribution",
    "dependent-count-distribution",
    "dependent-relationship-breakdown",
    "ancillary-volume-summary",
    "data-quality-appendix",
  ]);
});
