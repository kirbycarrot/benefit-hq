import assert from "node:assert/strict";
import test from "node:test";
import {
  clientDeletionNameMatches,
  planYearDeletionLabelMatches,
} from "@/lib/clients";

test("permanent deletion requires the exact client name", () => {
  assert.equal(clientDeletionNameMatches("Acme Benefits", "Acme Benefits"), true);
  assert.equal(clientDeletionNameMatches("  Acme Benefits  ", "Acme Benefits"), true);
  assert.equal(clientDeletionNameMatches("acme benefits", "Acme Benefits"), false);
  assert.equal(clientDeletionNameMatches(undefined, "Acme Benefits"), false);
});

test("plan year deletion requires the exact plan year label", () => {
  assert.equal(planYearDeletionLabelMatches("2026 Plan Year", "2026 Plan Year"), true);
  assert.equal(planYearDeletionLabelMatches("  2026 Plan Year  ", "2026 Plan Year"), true);
  assert.equal(planYearDeletionLabelMatches("2026 plan year", "2026 Plan Year"), false);
  assert.equal(planYearDeletionLabelMatches(null, "2026 Plan Year"), false);
});
