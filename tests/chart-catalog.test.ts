import assert from "node:assert/strict";
import test from "node:test";
import { CHART_DEFINITIONS } from "@/lib/charts/catalog";
import { CHART_COMPUTE } from "@/lib/charts/compute";

test("chart catalog follows the presentation story order", () => {
  const categories = [...new Set(CHART_DEFINITIONS.map((definition) => definition.category))];

  assert.deepEqual(categories, [
    "overview",
    "renewal & cost",
    "plan design",
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

test("every chart exposed in the selector has a compute path for PowerPoint export", () => {
  for (const definition of CHART_DEFINITIONS) {
    assert.equal(
      typeof CHART_COMPUTE[definition.key],
      "function",
      `${definition.key} is missing a chart computation`
    );
  }
});

test("chart catalog defaults to the concise recommended deck", () => {
  const enabledKeys = CHART_DEFINITIONS.filter(
    (definition) => definition.defaultEnabled
  ).map((definition) => definition.key);

  assert.deepEqual(enabledKeys, [
    "executive-summary",
    "renewal-comparison",
    "contribution-strategy",
    "plan-design-snapshot",
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
