import assert from "node:assert/strict";
import test from "node:test";
import type { ChartResult } from "@/lib/charts/types";
import { generateCaption } from "@/lib/deck/captions";
import {
  buildDeckRecommendations,
  insightTitle,
  sectionNarrative,
  takeawayForResult,
} from "@/lib/deck/narrative";

test("narrative titles turn chart labels into data-led conclusions", () => {
  const participation = {
    kind: "participation",
    title: "Benefits Participation & Waivers",
    benefits: [
      { name: "Medical", eligible: 100, enrolled: 92, waived: 8, unreported: 0, participation: 92 },
      { name: "Dental", eligible: 100, enrolled: 80, waived: 20, unreported: 0, participation: 80 },
      { name: "Vision", eligible: 100, enrolled: 65, waived: 30, unreported: 5, participation: 65 },
    ],
    note: "Test note",
  } satisfies Extract<ChartResult, { kind: "participation" }>;

  assert.equal(
    insightTitle(participation),
    "Medical leads participation at 92.0%; Vision trails at 65.0%"
  );
  assert.match(takeawayForResult(participation), /5 benefit elections are not recorded/);
});

test("recommendations are prioritized and derived from material exceptions", () => {
  const quality = {
    kind: "quality",
    title: "Data Quality",
    totalEmployees: 100,
    censusCompleteness: 82,
    completeRecords: 60,
    validZipRecords: 90,
    recordedZipRecords: 95,
    activeElections: 120,
    matchedElections: 114,
    unmatchedElections: 6,
    fields: [],
    findings: ["Core fields are 82% complete."],
    note: "Test note",
  } satisfies Extract<ChartResult, { kind: "quality" }>;

  const recommendations = buildDeckRecommendations([quality]);
  assert.equal(recommendations[0].priority, "Immediate attention");
  assert.match(recommendations[0].detail, /6 elections are unmatched/);
});

test("a renewal exceeding the client's stated guardrails surfaces an immediate-attention recommendation", () => {
  const renewal = {
    kind: "renewal",
    available: true,
    title: "Renewal Comparison",
    priorLabel: "2026",
    currentLabel: "2027",
    priorEffectiveDate: new Date("2026-01-01T00:00:00Z"),
    currentEffectiveDate: new Date("2027-01-01T00:00:00Z"),
    summary: {
      priorAnnualEmployerCost: 3600,
      currentAnnualEmployerCost: 4500,
      employerChange: 900,
      employerChangePercentage: 25,
      priorAnnualEmployeeCost: 1200,
      currentAnnualEmployeeCost: 1500,
      employeeChange: 300,
      employeeChangePercentage: 25,
      priorAnnualTotalCost: 4800,
      currentAnnualTotalCost: 6000,
      totalChange: 1200,
      totalChangePercentage: 25,
    },
    rows: [],
    comparableRows: 1,
    renamedRows: 0,
    newRows: 0,
    removedRows: 0,
    guardrails: {
      budgetTarget: 5000,
      maximumAcceptableIncrease: 10,
      overBudget: true,
      overIncreaseTolerance: true,
    },
    note: "Test note",
  } satisfies Extract<ChartResult, { kind: "renewal"; available: true }>;

  const recommendations = buildDeckRecommendations([renewal]);
  const titles = recommendations.map((r) => r.title);
  assert.ok(titles.includes("Renewal exceeds the client's stated increase tolerance"));
  assert.ok(titles.includes("Renewal exceeds the client's defined budget target"));
  assert.ok(
    recommendations.find((r) => r.title.startsWith("Renewal exceeds"))?.priority ===
      "Immediate attention"
  );
});

test("section copy provides an audience-facing transition", () => {
  assert.deepEqual(sectionNarrative("renewal & cost"), {
    title: "Renewal and cost",
    subtitle: "How rates and contributions shape the renewal outlook.",
  });
  assert.equal(sectionNarrative("appendix").title, "Data quality appendix");
});

test("deck captions add separators to large values", () => {
  const result = {
    kind: "pie",
    title: "Employer vs. Employee Cost Split",
    data: [
      { name: "Employer", value: 2_699_947.56 },
      { name: "Employee", value: 894_500.16 },
    ],
  } satisfies Extract<ChartResult, { kind: "pie" }>;

  assert.equal(
    generateCaption(result),
    "Employer accounts for 75% of the total (2,699,947.56 of 3,594,447.72)."
  );
  assert.equal(
    insightTitle(result),
    "Employer accounts for 75% of the total (2,699,947.56 of 3,594,447.72)"
  );
});
