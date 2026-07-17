import assert from "node:assert/strict";
import test from "node:test";
import type { ChartResult } from "@/lib/charts/types";
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

test("section copy provides an audience-facing transition", () => {
  assert.deepEqual(sectionNarrative("renewal & cost"), {
    title: "Renewal and cost",
    subtitle: "How rates and contributions shape the renewal outlook.",
  });
  assert.equal(sectionNarrative("appendix").title, "Data quality appendix");
});
