import assert from "node:assert/strict";
import test from "node:test";
import { parseSbcFields } from "@/lib/sbc/parse";

const SAMPLE_SBC_TEXT = `
Acme Health Plan: Gold PPO 1500
Coverage Period: 01/01/2026 - 12/31/2026

What is the overall deductible?
$1,500 individual / $3,000 family. Does not apply to preventive care.

What is the out-of-pocket limit for this plan?
$6,000 individual / $12,000 family.

Common Medical Events
Primary care visit $30 copay/visit, 20% coinsurance after deductible
Specialist visit $60 copay/visit
Urgent care $75 copay/visit
Emergency room care $350 copay/visit then 20% coinsurance
Generic drugs $15 copay/prescription
Preferred brand drugs $50 copay/prescription
Non-preferred brand drugs $90 copay/prescription
Specialty drugs $250 copay/prescription
`;

test("parses the standard SBC deductible/OOP dollar pairs", () => {
  const fields = parseSbcFields(SAMPLE_SBC_TEXT);
  assert.equal(fields.deductibleIndividual, 1500);
  assert.equal(fields.deductibleFamily, 3000);
  assert.equal(fields.oopMaximumIndividual, 6000);
  assert.equal(fields.oopMaximumFamily, 12000);
});

test("parses coinsurance and the standard copay lines", () => {
  const fields = parseSbcFields(SAMPLE_SBC_TEXT);
  assert.equal(fields.memberCoinsurance, 20);
  assert.equal(fields.primaryCareCopay, 30);
  assert.equal(fields.specialistCopay, 60);
  assert.equal(fields.urgentCareCopay, 75);
  assert.equal(fields.emergencyRoomCopay, 350);
  assert.equal(fields.genericCopay, 15);
  assert.equal(fields.formularyBrandCopay, 50);
  assert.equal(fields.nonFormularyBrandCopay, 90);
  assert.equal(fields.specialtyCopay, 250);
});

test("guesses a plan name from the first meaningful line", () => {
  const fields = parseSbcFields(SAMPLE_SBC_TEXT);
  assert.equal(fields.planNameGuess, "Acme Health Plan: Gold PPO 1500");
});

test("returns nulls instead of throwing on text with none of the expected sections", () => {
  const fields = parseSbcFields("This document has no recognizable SBC sections at all.");
  assert.equal(fields.deductibleIndividual, null);
  assert.equal(fields.memberCoinsurance, null);
  assert.equal(fields.primaryCareCopay, null);
});
