import assert from "node:assert/strict";
import test from "node:test";
import {
  clientOnboardingSchema,
  computeOnboardingProgress,
  newClientIntakeSchema,
  type ClientOnboardingInput,
} from "@/lib/client-onboarding";
import { detectClientDocumentType } from "@/lib/uploads";

function onboarding(): ClientOnboardingInput {
  return {
    displayName: "Acme",
    primaryColor: "#1F2937",
    secondaryColor: "#14B8A6",
    profile: {
      legalName: "Acme Holdings, Inc.", website: null, primaryIndustry: "Technology",
      secondaryIndustry: null, industryCode: null, ownershipType: "Privately Held",
      parentCompany: null, privateEquitySponsor: null, fiscalYearEndMonth: 12,
      fiscalYearEndDay: 31, primaryRenewalMonth: 1, primaryRenewalDay: 1,
      usEmployeeCount: 100, globalEmployeeCount: 100, benefitsEligibleCount: 90,
      enrolledEmployeeCount: 80, entityStructure: "Single Entity", numberOfEins: 1,
      benefitsConsistentAcrossEntities: true, hasUnionPopulation: false,
      hasCollectivelyBargainedPlans: false, hasAcquiredCompanies: false,
      hasInternationalEmployees: false, workforceTypes: ["None of These"],
      coveredThroughPeo: false, statesWithEmployees: ["CO"], remoteEmployeePercentage: 20,
      benefitChallenges: "Cost trend", renewalSuccessOutcomes: "Stay within budget",
      budgetTarget: 1_000_000, maximumAcceptableIncrease: 8,
      disruptionTolerance: "Minimal Disruption", excludedCarriers: [],
      acquisitionsExpected: false, headcountChangesExpected: false,
      harmonizationUnderway: false, preparingForTransaction: false,
    },
    teamAssignments: [{ role: "Lead Consultant", userId: "user-1" }],
    contacts: [{ name: "Jamie Client", title: null, email: "jamie@example.com", phone: null, roles: ["Primary Benefits Contact"], notes: null, sortOrder: 0 }],
    locations: [{ name: "Headquarters", line1: "1 Main St", line2: null, city: "Denver", state: "CO", postalCode: "80202", country: "United States", isHeadquarters: true, employeeCount: 100, sortOrder: 0 }],
    entities: [],
    priorities: [{ objective: "Reduce overall benefit cost", rank: 1, currentState: null, desiredOutcome: null, measurementKpi: null, notes: null }],
  };
}

test("client onboarding accepts the complete structured intake", () => {
  assert.equal(clientOnboardingSchema.safeParse(onboarding()).success, true);
});

test("client onboarding rejects enrollment above eligibility", () => {
  const value = onboarding();
  value.profile.enrolledEmployeeCount = 91;
  const result = clientOnboardingSchema.safeParse(value);
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(result.error.issues.some((issue) => /cannot exceed/i.test(issue.message)), true);
});

test("client onboarding rejects conflicting workforce selections", () => {
  const value = onboarding();
  value.profile.workforceTypes = ["None of These", "Seasonal"];
  const result = clientOnboardingSchema.safeParse(value);
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(result.error.issues.some((issue) => /cannot be combined/i.test(issue.message)), true);
});

test("client onboarding rejects unsupported employee state codes", () => {
  const value = onboarding();
  value.profile.statesWithEmployees = ["ZZ"];
  const result = clientOnboardingSchema.safeParse(value);
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(result.error.issues.some((issue) => /supported list/i.test(issue.message)), true);
});

test("new client intake rejects impossible renewal dates", () => {
  const result = newClientIntakeSchema.safeParse({
    legalName: "Acme", displayName: "Acme", primaryIndustry: "Technology",
    primaryRenewalMonth: 2, primaryRenewalDay: 31, headquartersLine1: "1 Main",
    headquartersCity: "Denver", headquartersState: "CO", headquartersPostalCode: "80202",
    primaryColor: "#1F2937", secondaryColor: "#14B8A6",
  });
  assert.equal(result.success, false);
});

test("onboarding progress excludes optional documents from completion", () => {
  const value = onboarding();
  const withoutDocuments = computeOnboardingProgress(value, 0);
  const withDocuments = computeOnboardingProgress(value, 12);

  assert.equal(withoutDocuments.percentage, 100);
  assert.equal(withoutDocuments.completed, withoutDocuments.total);
  assert.equal(withoutDocuments.documentCount, 0);
  assert.equal(withDocuments.percentage, withoutDocuments.percentage);
  assert.equal(withDocuments.completed, withoutDocuments.completed);
  assert.equal(withDocuments.total, withoutDocuments.total);
  assert.equal(withDocuments.documentCount, 12);
});

test("client document detection checks both extension and file signature", () => {
  assert.deepEqual(detectClientDocumentType("summary.pdf", Buffer.from("%PDF-1.7")), {
    extension: "pdf", mediaType: "application/pdf",
  });
  assert.equal(detectClientDocumentType("summary.pdf", Buffer.from("not a pdf")), null);
  assert.equal(detectClientDocumentType("malware.exe", Buffer.from("MZ")), null);
});
