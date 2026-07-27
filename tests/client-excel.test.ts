import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import {
  buildClientExcelWorkbook,
  ClientExcelValidationError,
  parseClientExcelWorkbook,
} from "@/lib/client-excel";
import {
  CLIENT_EXPORT_FORMAT,
  CLIENT_EXPORT_VERSION,
  parseClientExportPayload,
} from "@/lib/client-transfer";

function samplePayload() {
  return parseClientExportPayload({
    format: CLIENT_EXPORT_FORMAT,
    version: CLIENT_EXPORT_VERSION,
    exportedAt: "2026-07-26T12:00:00.000Z",
    client: {
      name: "Acme",
      primaryColor: "#1F2937",
      secondaryColor: "#14B8A6",
      logo: null,
      profile: {
        legalName: "Acme Holdings, Inc.",
        website: "https://acme.example",
        primaryIndustry: "Technology",
        secondaryIndustry: null,
        industryCode: null,
        ownershipType: "Privately Held",
        parentCompany: null,
        privateEquitySponsor: null,
        fiscalYearEndMonth: 12,
        fiscalYearEndDay: 31,
        primaryRenewalMonth: 1,
        primaryRenewalDay: 1,
        usEmployeeCount: 100,
        globalEmployeeCount: 100,
        benefitsEligibleCount: 90,
        enrolledEmployeeCount: 80,
        entityStructure: "Single Entity",
        numberOfEins: 1,
        benefitsConsistentAcrossEntities: true,
        benefitsConsistencyNotes: null,
        hasUnionPopulation: false,
        hasCollectivelyBargainedPlans: false,
        hasAcquiredCompanies: false,
        hasInternationalEmployees: false,
        workforceTypes: ["None of These"],
        coveredThroughPeo: false,
        statesWithEmployees: ["CO"],
        remoteEmployeePercentage: "20",
        benefitChallenges: "Cost trend",
        renewalSuccessOutcomes: "Stay within budget",
        budgetTarget: "1000000",
        maximumAcceptableIncrease: "8",
        disruptionTolerance: "Minimal Disruption",
        excludedCarriers: [],
        acquisitionsExpected: false,
        headcountChangesExpected: false,
        harmonizationUnderway: false,
        preparingForTransaction: false,
      },
      teamAssignments: [{ role: "Lead Consultant", userEmail: "consultant@example.com" }],
      contacts: [{
        name: "Jamie Client",
        title: "VP, People",
        email: "jamie@example.com",
        phone: "303-555-0100",
        roles: ["Primary Benefits Contact"],
        notes: null,
        sortOrder: 0,
      }],
      locations: [{
        name: "Headquarters",
        line1: "1 Main St",
        line2: null,
        city: "Denver",
        state: "CO",
        postalCode: "80202",
        country: "United States",
        isHeadquarters: true,
        employeeCount: 100,
        sortOrder: 0,
      }],
      entities: [],
      priorities: [{
        objective: "Reduce overall benefit cost",
        rank: 1,
        currentState: "Current trend is above target",
        desiredOutcome: "Reduce renewal increase",
        measurementKpi: "Renewal increase",
        notes: null,
      }],
      documents: [],
      planYears: [
        {
          label: "2026",
          effectiveDate: "2026-01-01T00:00:00.000Z",
          policyLines: [],
          benefitPrograms: [{
            benefitType: "Medical",
            offered: true,
            sortOrder: 10,
            plans: [{
              exportId: "old-plan",
              name: "Acme PPO",
              carrierName: "Example Health",
              subtype: "PPO",
              offered: true,
              details: { deductibleIndividual: 1000, memberCoinsurance: 20 },
              customAttributes: [{ label: "Network", value: "National" }],
              detailSchemaVersion: 1,
              renewedFromExportId: null,
              sortOrder: 0,
              rates: [{
                tier: "EE",
                grossPremium: "800",
                employeeContribution: "160",
                employerContribution: "640",
                ratePeriod: "monthly",
                enrollmentOverride: 50,
                sortOrder: 0,
              }],
              aliases: [{ alias: "Acme PPO", normalizedAlias: "acme ppo" }],
            }],
          }],
          censusUploads: [],
          employees: [{
            employeeNumber: "E-100",
            firstName: "Taylor",
            lastName: "Example",
            birthDate: "1990-05-01T00:00:00.000Z",
            gender: "F",
            hireDate: "2020-04-15T00:00:00.000Z",
            employmentStatus: "Active",
            baseSalary: "85000",
            postalCode: "80202",
            dependents: [],
            elections: [{
              benefitType: "Medical",
              planName: "Acme PPO",
              optionName: "EE",
              volume: null,
            }],
          }],
          deckConfig: null,
          benchmarkProfile: null,
        },
        {
          label: "2027",
          effectiveDate: "2027-01-01T00:00:00.000Z",
          policyLines: [],
          benefitPrograms: [{
            benefitType: "Medical",
            offered: true,
            sortOrder: 10,
            plans: [{
              exportId: "renewal-plan",
              name: "Acme PPO 2027",
              carrierName: "Example Health",
              subtype: "PPO",
              offered: true,
              details: { deductibleIndividual: 1250 },
              customAttributes: [],
              detailSchemaVersion: 1,
              renewedFromExportId: "old-plan",
              sortOrder: 0,
              rates: [],
              aliases: [],
            }],
          }],
          censusUploads: [],
          employees: [],
          deckConfig: null,
          benchmarkProfile: null,
        },
      ],
    },
  });
}

test("Excel client workbook round-trips editable client data", async () => {
  const workbook = await buildClientExcelWorkbook(samplePayload());
  const parsed = await parseClientExcelWorkbook(workbook);

  assert.equal(parsed.client.name, "Acme");
  assert.equal(parsed.client.profile?.legalName, "Acme Holdings, Inc.");
  assert.deepEqual(parsed.client.profile?.statesWithEmployees, ["CO"]);
  assert.equal(parsed.client.contacts[0]?.email, "jamie@example.com");
  assert.equal(parsed.client.planYears.length, 2);
  assert.equal(
    (parsed.client.planYears[0]?.benefitPrograms[0]?.plans[0]?.details as Record<string, unknown>)
      .deductibleIndividual,
    1000
  );
  assert.equal(parsed.client.planYears[0]?.benefitPrograms[0]?.plans[0]?.rates[0]?.employerContribution, "640");
  assert.equal(parsed.client.planYears[0]?.employees[0]?.elections[0]?.optionName, "EE");
  assert.equal(
    parsed.client.planYears[1]?.benefitPrograms[0]?.plans[0]?.renewedFromExportId,
    parsed.client.planYears[0]?.benefitPrograms[0]?.plans[0]?.exportId
  );
});

test("blank Excel intake template contains the professional workbook structure", async () => {
  const buffer = await buildClientExcelWorkbook();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  assert.deepEqual(
    workbook.worksheets.filter((sheet) => !sheet.name.startsWith("_")).map((sheet) => sheet.name),
    [
      "Start Here",
      "Client Profile",
      "Internal Team",
      "Client Contacts",
      "Locations",
      "Legal Entities",
      "Strategic Priorities",
      "Plan Years",
      "Benefit Plans",
      "Rates & Contributions",
      "Plan Details",
      "Custom Plan Fields",
      "Employees",
      "Dependents",
      "Employee Elections",
    ]
  );
  assert.equal(workbook.getWorksheet("_BenefitHQ")?.state, "veryHidden");
  assert.equal(workbook.getWorksheet("Client Profile")?.getCell("B6").fill.type, "pattern");
  assert.equal(workbook.getWorksheet("Benefit Plans")?.getCell("C5").dataValidation.type, "list");
});

test("Excel import rejects workbooks without Benefit HQ metadata", async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Client Profile");
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  await assert.rejects(
    () => parseClientExcelWorkbook(buffer),
    (error: unknown) =>
      error instanceof ClientExcelValidationError &&
      /not a Benefit HQ client intake/i.test(error.message)
  );
});
