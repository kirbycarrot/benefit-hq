import ExcelJS from "exceljs";
import { z } from "zod";
import {
  CLIENT_CONTACT_ROLES,
  CLIENT_PRIORITY_OPTIONS,
  DISRUPTION_TOLERANCE_OPTIONS,
  ENTITY_STRUCTURES,
  INDUSTRY_OPTIONS,
  INTERNAL_TEAM_ROLES,
  OWNERSHIP_TYPES,
  US_STATES,
  WORKFORCE_TYPES,
} from "@/lib/client-onboarding";
import {
  BENEFIT_META,
  BENEFIT_TYPES,
  normalizePolicyName,
  PLAN_SUBTYPES,
  POLICY_DETAIL_GROUPS,
  TIER_CODES,
  VOLUNTARY_PLAN_OFFERINGS,
  type BenefitType,
  type PolicyDetailField,
  type PolicyDetailValue,
} from "@/lib/policy-details";
import {
  CLIENT_EXPORT_FORMAT,
  CLIENT_EXPORT_VERSION,
  parseClientExportPayload,
  type ClientExportPayload,
} from "@/lib/client-transfer";
import { RATE_PERIODS } from "@/lib/validation";

export const CLIENT_EXCEL_FORMAT = "benefithq.client-intake";
export const CLIENT_EXCEL_VERSION = 1;
export const CLIENT_EXCEL_EXTENSION = ".xlsx";
export const CLIENT_EXCEL_MAX_BYTES = 25 * 1024 * 1024;

const COLORS = {
  ink: "142A3A",
  teal: "0F766E",
  tealLight: "DDF1EC",
  gold: "D1A64A",
  cream: "FFF8DD",
  panel: "F3F7F6",
  white: "FFFFFF",
  text: "23323B",
  muted: "5E7079",
  border: "D8E2E0",
  danger: "B42318",
};

const TABLE_PREVIEW_ROWS = 12;

const PROFILE_FIELDS = [
  field("company", "Display name", "displayName", "required", "The client name shown throughout Benefit HQ."),
  field("company", "Legal company name", "legalName", "required", "Full legal name used for contracts and plan records."),
  field("company", "Website", "website", "text"),
  field("company", "Primary industry", "primaryIndustry", "list", undefined, INDUSTRY_OPTIONS),
  field("company", "Secondary industry", "secondaryIndustry", "list", undefined, INDUSTRY_OPTIONS),
  field("company", "Industry code", "industryCode", "text", "NAICS, SIC, or another internal industry code."),
  field("company", "Ownership type", "ownershipType", "list", undefined, OWNERSHIP_TYPES),
  field("company", "Parent company", "parentCompany", "text"),
  field("company", "Private equity sponsor", "privateEquitySponsor", "text"),
  field("company", "Primary brand color", "primaryColor", "required", "Six-digit hex color, for example #1F2937."),
  field("company", "Secondary brand color", "secondaryColor", "required", "Six-digit hex color, for example #14B8A6."),
  field("dates", "Fiscal year-end month", "fiscalYearEndMonth", "integer", "Enter 1–12."),
  field("dates", "Fiscal year-end day", "fiscalYearEndDay", "integer", "Enter 1–31."),
  field("dates", "Primary renewal month", "primaryRenewalMonth", "integer", "Enter 1–12."),
  field("dates", "Primary renewal day", "primaryRenewalDay", "integer", "Enter 1–31."),
  field("workforce", "U.S. employee count", "usEmployeeCount", "integer"),
  field("workforce", "Global employee count", "globalEmployeeCount", "integer"),
  field("workforce", "Benefits-eligible count", "benefitsEligibleCount", "integer"),
  field("workforce", "Enrolled employee count", "enrolledEmployeeCount", "integer"),
  field("organization", "Entity structure", "entityStructure", "list", undefined, ENTITY_STRUCTURES),
  field("organization", "Number of EINs", "numberOfEins", "integer"),
  field("organization", "Benefits consistent across entities?", "benefitsConsistentAcrossEntities", "boolean"),
  field("organization", "Benefits consistency notes", "benefitsConsistencyNotes", "text"),
  field("organization", "Union population?", "hasUnionPopulation", "boolean"),
  field("organization", "Collectively bargained plans?", "hasCollectivelyBargainedPlans", "boolean"),
  field("organization", "Acquired companies?", "hasAcquiredCompanies", "boolean"),
  field("organization", "International employees?", "hasInternationalEmployees", "boolean"),
  field("workforce", "Workforce types", "workforceTypes", "multi", "Separate multiple values with semicolons.", WORKFORCE_TYPES),
  field("workforce", "Covered through a PEO?", "coveredThroughPeo", "boolean"),
  field("workforce", "States with employees", "statesWithEmployees", "multi", "Use two-letter state codes separated by semicolons."),
  field("workforce", "Remote employee percentage", "remoteEmployeePercentage", "percent", "Enter 20 for 20%."),
  field("strategy", "Three most significant benefit challenges", "benefitChallenges", "text"),
  field("strategy", "Successful renewal outcomes", "renewalSuccessOutcomes", "text"),
  field("strategy", "Defined budget target", "budgetTarget", "currency"),
  field("strategy", "Maximum acceptable increase", "maximumAcceptableIncrease", "percent", "Enter 8 for 8%."),
  field("strategy", "Disruption tolerance", "disruptionTolerance", "list", undefined, DISRUPTION_TOLERANCE_OPTIONS),
  field("strategy", "Excluded carriers", "excludedCarriers", "multi", "Separate multiple carrier names with semicolons."),
  field("strategy", "Acquisitions or divestitures expected?", "acquisitionsExpected", "boolean"),
  field("strategy", "Significant headcount changes expected?", "headcountChangesExpected", "boolean"),
  field("strategy", "Benefits harmonization underway?", "harmonizationUnderway", "boolean"),
  field("strategy", "Preparing for a transaction?", "preparingForTransaction", "boolean"),
] as const;

type ProfileField = (typeof PROFILE_FIELDS)[number];

function field(
  section: string,
  label: string,
  key: string,
  type: "required" | "text" | "list" | "multi" | "integer" | "boolean" | "percent" | "currency",
  guidance?: string,
  options?: readonly string[]
) {
  return { section, label, key, type, guidance: guidance ?? "", options };
}

const SECTION_LABELS: Record<string, string> = {
  company: "Company & branding",
  dates: "Key dates",
  workforce: "Workforce",
  organization: "Organization",
  strategy: "Renewal strategy",
};

type DetailDefinition = {
  benefitType: BenefitType;
  groupLabel: string;
  field: PolicyDetailField;
};

const DETAIL_DEFINITIONS: DetailDefinition[] = BENEFIT_TYPES.flatMap((benefitType) =>
  POLICY_DETAIL_GROUPS[benefitType].flatMap((group) =>
    group.fields.map((detailField) => ({
      benefitType,
      groupLabel: group.label,
      field: detailField,
    }))
  )
);

const detailByBenefitAndKey = new Map(
  DETAIL_DEFINITIONS.map((definition) => [
    `${definition.benefitType}|${definition.field.key}`,
    definition,
  ])
);

export class ClientExcelValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues[0] ?? "The Excel intake workbook is invalid.");
    this.name = "ClientExcelValidationError";
  }
}

export async function buildClientExcelWorkbook(payload?: ClientExportPayload): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Benefit HQ";
  workbook.company = "Benefit HQ";
  workbook.title = payload
    ? `${payload.client.name} — Benefit HQ client intake`
    : "Benefit HQ client intake template";
  workbook.subject = "Structured client onboarding and benefits intake";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const references = buildWorkbookReferences(payload);
  addMetadataSheet(workbook);
  const listRefs = addListsSheet(workbook);
  addStartSheet(workbook, Boolean(payload));
  addProfileSheet(workbook, payload, listRefs);
  addTableSheet(workbook, {
    name: "Internal Team",
    title: "Internal team assignments",
    note: "Optional. The email must match an existing Benefit HQ user; unmatched assignments import with a warning.",
    headers: ["Role *", "User Email *"],
    widths: [30, 36],
    rows: payload?.client.teamAssignments.map((item) => [item.role, item.userEmail]) ?? [],
    validations: [{ column: 1, formula: listRefs.internalRoles }],
  });
  addTableSheet(workbook, {
    name: "Client Contacts",
    title: "Client contacts",
    note: "List each client-side decision maker or operational contact. Separate multiple roles with semicolons.",
    headers: ["Name *", "Title", "Email", "Phone", "Roles *", "Notes"],
    widths: [24, 24, 32, 20, 38, 44],
    rows:
      payload?.client.contacts.map((item) => [
        item.name,
        item.title,
        item.email,
        item.phone,
        item.roles.join("; "),
        item.notes,
      ]) ?? [],
  });
  addTableSheet(workbook, {
    name: "Locations",
    title: "Worksites and locations",
    note: "Add the headquarters and any other locations used for workforce or benefit planning.",
    headers: [
      "Location Name *",
      "Address 1 *",
      "Address 2",
      "City *",
      "State *",
      "Postal Code *",
      "Country",
      "Headquarters?",
      "Employee Count",
    ],
    widths: [24, 28, 20, 20, 13, 16, 20, 16, 16],
    rows:
      payload?.client.locations.map((item) => [
        item.name,
        item.line1,
        item.line2,
        item.city,
        item.state,
        item.postalCode,
        item.country,
        yesNo(item.isHeadquarters),
        item.employeeCount,
      ]) ?? [],
    validations: [
      { column: 5, formula: listRefs.states },
      { column: 8, formula: listRefs.yesNo },
    ],
  });
  addTableSheet(workbook, {
    name: "Legal Entities",
    title: "Legal entities",
    note: "For privacy, enter only the final four digits of each EIN.",
    headers: ["Legal Name *", "EIN Last Four", "Notes"],
    widths: [36, 18, 52],
    rows:
      payload?.client.entities.map((item) => [
        item.legalName,
        item.taxIdLastFour,
        item.notes,
      ]) ?? [],
  });
  addTableSheet(workbook, {
    name: "Strategic Priorities",
    title: "Ranked strategic priorities",
    note: "Use each rank and objective once. Rank 1 is the highest priority.",
    headers: ["Rank *", "Objective *", "Current State", "Desired Outcome", "Measurement / KPI", "Notes"],
    widths: [11, 38, 38, 38, 30, 38],
    rows:
      payload?.client.priorities.map((item) => [
        item.rank,
        item.objective,
        item.currentState,
        item.desiredOutcome,
        item.measurementKpi,
        item.notes,
      ]) ?? [],
    validations: [{ column: 2, formula: listRefs.priorities }],
  });
  addTableSheet(workbook, {
    name: "Plan Years",
    title: "Plan years",
    note: "Create a short Plan Year ID (for example PY-2027) and reuse it on the remaining tabs.",
    headers: ["Plan Year ID *", "Label *", "Effective Date *"],
    widths: [20, 26, 22],
    rows: references.planYears.map((item) => [item.ref, item.planYear.label, toExcelDate(item.planYear.effectiveDate)]),
    dateColumns: [3],
  });
  addBenefitPlansSheet(workbook, references, listRefs);
  addRatesSheet(workbook, references, listRefs);
  addPlanDetailsSheet(workbook, references);
  addCustomFieldsSheet(workbook, references);
  addEmployeesSheet(workbook, references);
  addDependentsSheet(workbook, references);
  addElectionsSheet(workbook, references, listRefs);

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

export async function parseClientExcelWorkbook(buffer: Buffer): Promise<ClientExportPayload> {
  if (buffer.length > CLIENT_EXCEL_MAX_BYTES) {
    throw new ClientExcelValidationError(["Excel intake files must be 25 MB or smaller."]);
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new ClientExcelValidationError(["This file is not a readable .xlsx workbook."]);
  }

  const metadata = workbook.getWorksheet("_BenefitHQ");
  if (!metadata || textValue(metadata.getCell("B1")) !== CLIENT_EXCEL_FORMAT) {
    throw new ClientExcelValidationError([
      "This workbook is not a Benefit HQ client intake file. Download a fresh template and copy the data into it.",
    ]);
  }
  if (numberValue(metadata.getCell("B2")) !== CLIENT_EXCEL_VERSION) {
    throw new ClientExcelValidationError([
      "This workbook was created by an incompatible version of the Excel intake feature.",
    ]);
  }

  const issues: string[] = [];
  const profileValues = readProfileValues(workbook, issues);
  const displayName = requiredProfileText(profileValues, "displayName", "Display name", issues);
  const legalName = requiredProfileText(profileValues, "legalName", "Legal company name", issues);
  const primaryColor = parseHex(profileValues.primaryColor, "#1F2937", "Primary brand color", issues);
  const secondaryColor = parseHex(profileValues.secondaryColor, "#14B8A6", "Secondary brand color", issues);

  const planYearRows = readRows(workbook, "Plan Years", issues);
  const planYears = new Map<
    string,
    ClientExportPayload["client"]["planYears"][number]
  >();
  for (const row of planYearRows) {
    if (rowIsBlank(row)) continue;
    const rowLabel = `Plan Years row ${row.rowNumber}`;
    const ref = requiredRowText(row, "plan year id", rowLabel, issues);
    const label = requiredRowText(row, "label", rowLabel, issues);
    const effectiveDate = isoDateValue(row.values["effective date"]);
    if (!effectiveDate) issues.push(`${rowLabel}: Effective Date is required and must be a valid date.`);
    if (!ref || !label || !effectiveDate) continue;
    if (planYears.has(ref)) {
      issues.push(`${rowLabel}: Plan Year ID "${ref}" is duplicated.`);
      continue;
    }
    planYears.set(ref, {
      label,
      effectiveDate,
      policyLines: [],
      benefitPrograms: [],
      censusUploads: [],
      employees: [],
      deckConfig: null,
      benchmarkProfile: null,
    });
  }

  const plans = parsePlans(workbook, planYears, issues);
  parseRates(workbook, plans, issues);
  parsePlanDetails(workbook, plans, issues);
  parseCustomFields(workbook, plans, issues);
  parseEmployees(workbook, planYears, issues);
  parseDependents(workbook, planYears, issues);
  parseElections(workbook, planYears, issues);

  const teamAssignments = readRows(workbook, "Internal Team", issues).flatMap((row) => {
    if (rowIsBlank(row)) return [];
    const label = `Internal Team row ${row.rowNumber}`;
    const role = requiredRowText(row, "role", label, issues);
    const userEmail = requiredRowText(row, "user email", label, issues);
    return role && userEmail ? [{ role, userEmail }] : [];
  });

  const contacts = readRows(workbook, "Client Contacts", issues).flatMap((row, index) => {
    if (rowIsBlank(row)) return [];
    const label = `Client Contacts row ${row.rowNumber}`;
    const name = requiredRowText(row, "name", label, issues);
    const roles = splitList(textValue(row.values.roles));
    if (roles.length === 0) issues.push(`${label}: at least one Role is required.`);
    return name && roles.length
      ? [{
          name,
          title: nullableText(row.values.title),
          email: nullableText(row.values.email),
          phone: nullableText(row.values.phone),
          roles,
          notes: nullableText(row.values.notes),
          sortOrder: index,
        }]
      : [];
  });

  const locations = readRows(workbook, "Locations", issues).flatMap((row, index) => {
    if (rowIsBlank(row)) return [];
    const label = `Locations row ${row.rowNumber}`;
    const name = requiredRowText(row, "location name", label, issues);
    const line1 = requiredRowText(row, "address 1", label, issues);
    const city = requiredRowText(row, "city", label, issues);
    const state = requiredRowText(row, "state", label, issues);
    const postalCode = requiredRowText(row, "postal code", label, issues);
    return name && line1 && city && state && postalCode
      ? [{
          name,
          line1,
          line2: nullableText(row.values["address 2"]),
          city,
          state,
          postalCode,
          country: nullableText(row.values.country) ?? "United States",
          isHeadquarters: booleanValue(row.values.headquarters) ?? false,
          employeeCount: nullableInteger(row.values["employee count"], label, "Employee Count", issues),
          sortOrder: index,
        }]
      : [];
  });

  const entities = readRows(workbook, "Legal Entities", issues).flatMap((row, index) => {
    if (rowIsBlank(row)) return [];
    const label = `Legal Entities row ${row.rowNumber}`;
    const entityLegalName = requiredRowText(row, "legal name", label, issues);
    return entityLegalName
      ? [{
          legalName: entityLegalName,
          taxIdLastFour: nullableText(row.values["ein last four"]),
          notes: nullableText(row.values.notes),
          sortOrder: index,
        }]
      : [];
  });

  const priorities = readRows(workbook, "Strategic Priorities", issues).flatMap((row) => {
    if (rowIsBlank(row)) return [];
    const label = `Strategic Priorities row ${row.rowNumber}`;
    const objective = requiredRowText(row, "objective", label, issues);
    const rank = nullableInteger(row.values.rank, label, "Rank", issues);
    if (rank === null) issues.push(`${label}: Rank is required.`);
    return objective && rank !== null
      ? [{
          objective,
          rank,
          currentState: nullableText(row.values["current state"]),
          desiredOutcome: nullableText(row.values["desired outcome"]),
          measurementKpi: nullableText(row.values["measurement / kpi"]),
          notes: nullableText(row.values.notes),
        }]
      : [];
  });

  if (issues.length > 0) throw new ClientExcelValidationError(issues.slice(0, 25));

  const profile = {
    legalName,
    website: nullableProfileText(profileValues, "website"),
    primaryIndustry: nullableProfileText(profileValues, "primaryIndustry"),
    secondaryIndustry: nullableProfileText(profileValues, "secondaryIndustry"),
    industryCode: nullableProfileText(profileValues, "industryCode"),
    ownershipType: nullableProfileText(profileValues, "ownershipType"),
    parentCompany: nullableProfileText(profileValues, "parentCompany"),
    privateEquitySponsor: nullableProfileText(profileValues, "privateEquitySponsor"),
    fiscalYearEndMonth: profileInteger(profileValues, "fiscalYearEndMonth"),
    fiscalYearEndDay: profileInteger(profileValues, "fiscalYearEndDay"),
    primaryRenewalMonth: profileInteger(profileValues, "primaryRenewalMonth"),
    primaryRenewalDay: profileInteger(profileValues, "primaryRenewalDay"),
    usEmployeeCount: profileInteger(profileValues, "usEmployeeCount"),
    globalEmployeeCount: profileInteger(profileValues, "globalEmployeeCount"),
    benefitsEligibleCount: profileInteger(profileValues, "benefitsEligibleCount"),
    enrolledEmployeeCount: profileInteger(profileValues, "enrolledEmployeeCount"),
    entityStructure: nullableProfileText(profileValues, "entityStructure"),
    numberOfEins: profileInteger(profileValues, "numberOfEins"),
    benefitsConsistentAcrossEntities: profileBoolean(profileValues, "benefitsConsistentAcrossEntities"),
    benefitsConsistencyNotes: nullableProfileText(profileValues, "benefitsConsistencyNotes"),
    hasUnionPopulation: profileBoolean(profileValues, "hasUnionPopulation"),
    hasCollectivelyBargainedPlans: profileBoolean(profileValues, "hasCollectivelyBargainedPlans"),
    hasAcquiredCompanies: profileBoolean(profileValues, "hasAcquiredCompanies"),
    hasInternationalEmployees: profileBoolean(profileValues, "hasInternationalEmployees"),
    workforceTypes: splitList(textValue(profileValues.workforceTypes)),
    coveredThroughPeo: profileBoolean(profileValues, "coveredThroughPeo"),
    statesWithEmployees: splitList(textValue(profileValues.statesWithEmployees)).map((value) => value.toUpperCase()),
    remoteEmployeePercentage: profileDecimalString(profileValues, "remoteEmployeePercentage"),
    benefitChallenges: nullableProfileText(profileValues, "benefitChallenges"),
    renewalSuccessOutcomes: nullableProfileText(profileValues, "renewalSuccessOutcomes"),
    budgetTarget: profileDecimalString(profileValues, "budgetTarget"),
    maximumAcceptableIncrease: profileDecimalString(profileValues, "maximumAcceptableIncrease"),
    disruptionTolerance: nullableProfileText(profileValues, "disruptionTolerance"),
    excludedCarriers: splitList(textValue(profileValues.excludedCarriers)),
    acquisitionsExpected: profileBoolean(profileValues, "acquisitionsExpected"),
    headcountChangesExpected: profileBoolean(profileValues, "headcountChangesExpected"),
    harmonizationUnderway: profileBoolean(profileValues, "harmonizationUnderway"),
    preparingForTransaction: profileBoolean(profileValues, "preparingForTransaction"),
  };

  try {
    return parseClientExportPayload({
      format: CLIENT_EXPORT_FORMAT,
      version: CLIENT_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      client: {
        name: displayName,
        primaryColor,
        secondaryColor,
        logo: null,
        profile,
        teamAssignments,
        contacts,
        locations,
        entities,
        priorities,
        documents: [],
        planYears: Array.from(planYears.values()),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const first = error.issues[0];
      throw new ClientExcelValidationError([
        `${first?.path.join(" → ") || "Workbook"}: ${first?.message ?? "Invalid value"}`,
      ]);
    }
    throw error;
  }
}

export function clientExcelFilename(clientName?: string): string {
  const slug =
    clientName
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "new-client";
  return `${slug}-benefit-hq-intake${CLIENT_EXCEL_EXTENSION}`;
}

function buildWorkbookReferences(payload?: ClientExportPayload) {
  const planYears =
    payload?.client.planYears.map((planYear, index) => ({
      ref: `PY-${String(index + 1).padStart(3, "0")}`,
      planYear,
    })) ?? [];
  const planYearRefByLabel = new Map(planYears.map((item) => [item.planYear.label, item.ref]));
  const plans = planYears.flatMap((planYearItem) =>
    planYearItem.planYear.benefitPrograms.flatMap((program) =>
      program.plans.map((plan) => ({ planYearItem, program, plan }))
    )
  );
  const planRefByExportId = new Map(
    plans.map((item, index) => [item.plan.exportId, `PLAN-${String(index + 1).padStart(3, "0")}`])
  );
  return { planYears, planYearRefByLabel, plans, planRefByExportId };
}

function addMetadataSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet("_BenefitHQ", { state: "veryHidden" });
  sheet.getCell("A1").value = "Format";
  sheet.getCell("B1").value = CLIENT_EXCEL_FORMAT;
  sheet.getCell("A2").value = "Version";
  sheet.getCell("B2").value = CLIENT_EXCEL_VERSION;
  sheet.getCell("A3").value = "Generated";
  sheet.getCell("B3").value = new Date().toISOString();
}

function addListsSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet("_Lists", { state: "veryHidden" });
  const lists: Array<[string, readonly string[]]> = [
    ["YesNo", ["Yes", "No"]],
    ["States", US_STATES.map(([code]) => code)],
    ["Industries", INDUSTRY_OPTIONS],
    ["Ownership", OWNERSHIP_TYPES],
    ["EntityStructures", ENTITY_STRUCTURES],
    ["Disruption", DISRUPTION_TOLERANCE_OPTIONS],
    ["InternalRoles", INTERNAL_TEAM_ROLES],
    ["ContactRoles", CLIENT_CONTACT_ROLES],
    ["Priorities", CLIENT_PRIORITY_OPTIONS],
    ["BenefitTypes", BENEFIT_TYPES],
    ["Subtypes", Array.from(new Set(Object.values(PLAN_SUBTYPES).flat()))],
    ["RatePeriods", RATE_PERIODS],
    ["Tiers", TIER_CODES],
  ];
  const refs: Record<string, string> = {};
  lists.forEach(([name, values], columnIndex) => {
    const column = sheet.getColumn(columnIndex + 1);
    column.values = [name, ...values];
    const letter = column.letter;
    refs[name] = `'${sheet.name}'!$${letter}$2:$${letter}$${values.length + 1}`;
  });
  return {
    yesNo: refs.YesNo,
    states: refs.States,
    industries: refs.Industries,
    ownership: refs.Ownership,
    entityStructures: refs.EntityStructures,
    disruption: refs.Disruption,
    internalRoles: refs.InternalRoles,
    contactRoles: refs.ContactRoles,
    priorities: refs.Priorities,
    benefitTypes: refs.BenefitTypes,
    subtypes: refs.Subtypes,
    ratePeriods: refs.RatePeriods,
    tiers: refs.Tiers,
  };
}

function addStartSheet(workbook: ExcelJS.Workbook, populated: boolean) {
  const sheet = workbook.addWorksheet("Start Here");
  sheet.views = [{ showGridLines: false, zoomScale: 90 }];
  sheet.columns = [
    { width: 4 },
    { width: 10 },
    { width: 56 },
    { width: 52 },
    { width: 4 },
  ];
  sheet.mergeCells("B2:D3");
  sheet.getCell("B2").value = populated
    ? "Benefit HQ Client Workbook"
    : "Benefit HQ Client Intake";
  sheet.getCell("B2").style = {
    fill: solid(COLORS.ink),
    font: { name: "Aptos Display", size: 24, bold: true, color: { argb: COLORS.white } },
    alignment: { vertical: "middle", horizontal: "left" },
  };
  sheet.getRow(2).height = 30;
  sheet.getRow(3).height = 30;
  sheet.mergeCells("B5:D5");
  sheet.getCell("B5").value =
    "A structured workbook your team completes once, then Benefit HQ imports directly. Start with Client Profile, then add only the tabs that apply — contacts, locations, benefit plans, rates, and optional census data.";
  sheet.getCell("B5").font = { name: "Aptos", size: 11, color: { argb: COLORS.muted } };
  sheet.getCell("B5").alignment = { wrapText: true, vertical: "middle" };
  sheet.getRow(5).height = 42;

  const steps = [
    ["Complete the yellow cells", "Required columns are marked with an asterisk."],
    ["Keep reference IDs consistent", "Reuse each Plan Year ID and Plan ID exactly on related tabs."],
    ["Use the provided choices", "Dropdowns match the values Benefit HQ supports. Separate multiple values with semicolons."],
    ["Import from Client Management", "Upload this .xlsx file. Import is all-or-nothing and reports the first actionable issues."],
  ];
  let row = 7;
  for (const [title, description] of steps) {
    const badgeRow = row;
    const descriptionRow = row + 1;
    sheet.getCell(badgeRow, 2).value = (row - 5) / 2;
    sheet.getCell(badgeRow, 2).style = {
      fill: solid(COLORS.teal),
      font: { name: "Aptos", size: 13, bold: true, color: { argb: COLORS.white } },
      alignment: { horizontal: "center", vertical: "middle" },
    };
    sheet.mergeCells(badgeRow, 3, badgeRow, 4);
    sheet.getCell(badgeRow, 3).value = title;
    sheet.getCell(badgeRow, 3).font = { name: "Aptos", size: 12, bold: true, color: { argb: COLORS.text } };
    sheet.getCell(badgeRow, 3).alignment = { vertical: "middle" };
    sheet.getRow(badgeRow).height = 20;

    sheet.mergeCells(descriptionRow, 3, descriptionRow, 4);
    sheet.getCell(descriptionRow, 3).value = description;
    sheet.getCell(descriptionRow, 3).font = { name: "Aptos", size: 10, color: { argb: COLORS.muted } };
    sheet.getCell(descriptionRow, 3).alignment = { wrapText: true, vertical: "top" };
    sheet.getRow(descriptionRow).height = 28;
    row += 2;
  }

  const privacyRow = row + 1;
  sheet.mergeCells(privacyRow, 2, privacyRow, 4);
  sheet.getCell(privacyRow, 2).value = "Privacy";
  sheet.getCell(privacyRow, 2).style = {
    font: { name: "Aptos", size: 11, bold: true, color: { argb: COLORS.teal } },
    border: { bottom: { style: "thin", color: { argb: COLORS.gold } } },
  };
  sheet.getRow(privacyRow).height = 22;

  const privacyBodyRow = privacyRow + 1;
  sheet.mergeCells(privacyBodyRow, 2, privacyBodyRow, 4);
  sheet.getCell(privacyBodyRow, 2).value =
    "This workbook can contain personal and benefits information. Store and transmit it only through approved secure channels.";
  sheet.getCell(privacyBodyRow, 2).font = { name: "Aptos", size: 9, italic: true, color: { argb: COLORS.muted } };
  sheet.getCell(privacyBodyRow, 2).alignment = { wrapText: true, vertical: "top" };
  sheet.getRow(privacyBodyRow).height = 30;

  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 };
}

function addProfileSheet(
  workbook: ExcelJS.Workbook,
  payload: ClientExportPayload | undefined,
  lists: ReturnType<typeof addListsSheet>
) {
  const sheet = workbook.addWorksheet("Client Profile");
  sheet.columns = [
    { width: 36 },
    { width: 34 },
    { width: 60 },
    { width: 2, hidden: true },
  ];
  setupSheetTitle(
    sheet,
    "Client profile",
    "Complete the yellow response cells. Multiple-value fields use semicolons.",
    4
  );
  sheet.getRow(4).values = ["Field", "Response", "Guidance", "Key"];
  styleHeader(sheet.getRow(4), 4);
  sheet.views = [{ state: "frozen", ySplit: 4, showGridLines: false, zoomScale: 90 }];

  const source = profileSource(payload);
  let rowIndex = 5;
  let section = "";
  for (const definition of PROFILE_FIELDS) {
    if (definition.section !== section) {
      section = definition.section;
      sheet.mergeCells(rowIndex, 1, rowIndex, 3);
      sheet.getCell(rowIndex, 1).value = SECTION_LABELS[section] ?? section;
      sectionStyle(sheet.getCell(rowIndex, 1));
      sheet.getRow(rowIndex).height = 24;
      rowIndex += 1;
    }
    const response = sheet.getCell(rowIndex, 2);
    sheet.getCell(rowIndex, 1).value =
      definition.type === "required" ? `${definition.label} *` : definition.label;
    response.value = profileDisplayValue(definition, source[definition.key]);
    sheet.getCell(rowIndex, 3).value =
      definition.guidance ||
      (definition.options ? `Choose from: ${definition.options.join("; ")}` : null);
    sheet.getCell(rowIndex, 4).value = definition.key;
    sheet.getCell(rowIndex, 1).font = { name: "Aptos", size: 10, color: { argb: COLORS.text } };
    response.style = inputStyle();
    sheet.getCell(rowIndex, 3).style = {
      font: { name: "Aptos", size: 9, color: { argb: COLORS.muted } },
      alignment: { wrapText: true, vertical: "top" },
    };
    sheet.getRow(rowIndex).height = definition.type === "text" && definition.guidance ? 34 : 24;
    applyProfileValidation(response, definition, lists);
    if (definition.type === "currency") response.numFmt = "$#,##0.00";
    if (definition.type === "percent") response.numFmt = '0.0"%"';
    if (definition.type === "integer") response.numFmt = "0";
    rowIndex += 1;
  }
  sheet.autoFilter = { from: "A4", to: `C${rowIndex - 1}` };
  sheet.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

function addTableSheet(
  workbook: ExcelJS.Workbook,
  config: {
    name: string;
    title: string;
    note: string;
    headers: string[];
    widths: number[];
    rows: ExcelJS.CellValue[][];
    validations?: Array<{ column: number; formula: string }>;
    dateColumns?: number[];
  }
) {
  const sheet = workbook.addWorksheet(config.name);
  sheet.columns = config.widths.map((width) => ({ width }));
  setupSheetTitle(sheet, config.title, config.note, config.headers.length);
  const rows = config.rows.length > 0 ? config.rows : [config.headers.map(() => null)];
  sheet.addTable({
    name: tableName(config.name),
    ref: "A4",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: true, showColumnStripes: false },
    columns: config.headers.map((name) => ({ name, filterButton: true })),
    rows,
  });
  sheet.views = [{ state: "frozen", ySplit: 4, showGridLines: false, zoomScale: 90 }];
  const lastColumn = config.headers.length;
  const lastBandedRow = Math.min(304, 4 + Math.max(TABLE_PREVIEW_ROWS, rows.length));
  for (let row = 5; row <= lastBandedRow; row += 1) {
    const fill = solid((row - 5) % 2 === 0 ? COLORS.white : COLORS.panel);
    for (let column = 1; column <= lastColumn; column += 1) {
      const cell = sheet.getCell(row, column);
      cell.fill = fill;
      cell.border = bottomBorder(COLORS.border);
    }
  }
  for (const validation of config.validations ?? []) {
    for (let row = 5; row <= 304; row += 1) {
      sheet.getCell(row, validation.column).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [validation.formula],
        showErrorMessage: true,
        errorTitle: "Choose a supported value",
        error: "Select a value from the dropdown list.",
      };
    }
  }
  for (const column of config.dateColumns ?? []) {
    sheet.getColumn(column).numFmt = "mmm d, yyyy";
  }
  sheet.pageSetup = { orientation: lastColumn > 6 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  return sheet;
}

function addBenefitPlansSheet(
  workbook: ExcelJS.Workbook,
  references: ReturnType<typeof buildWorkbookReferences>,
  lists: ReturnType<typeof addListsSheet>
) {
  const rows = references.plans.map(({ planYearItem, program, plan }) => [
    references.planRefByExportId.get(plan.exportId) ?? "",
    planYearItem.ref,
    program.benefitType,
    yesNo(plan.offered),
    plan.name,
    plan.carrierName,
    plan.subtype,
    plan.aliases.map((alias) => alias.alias).filter((alias) => normalizePolicyName(alias) !== normalizePolicyName(plan.name)).join("; "),
    plan.renewedFromExportId ? (references.planRefByExportId.get(plan.renewedFromExportId) ?? "") : "",
    program.benefitType === "VoluntaryOfferings"
      ? VOLUNTARY_PLAN_OFFERINGS.filter(
          (offering) =>
            (plan.details as Record<string, unknown>)[offering.key] === true
        ).map((offering) => offering.label).join("; ")
      : "",
  ]);
  addTableSheet(workbook, {
    name: "Benefit Plans",
    title: "Benefit plans and classes",
    note: "Create a unique Plan ID for each plan or class. Use the supported subtype for the selected benefit.",
    headers: [
      "Plan ID *",
      "Plan Year ID *",
      "Benefit Type *",
      "Offered?",
      "Plan / Class Name *",
      "Carrier",
      "Subtype *",
      "Census Aliases",
      "Renewed From Plan ID",
      "Additional Offerings",
    ],
    widths: [18, 18, 20, 13, 32, 26, 22, 36, 24, 42],
    rows,
    validations: [
      { column: 3, formula: lists.benefitTypes },
      { column: 4, formula: lists.yesNo },
      { column: 7, formula: lists.subtypes },
    ],
  });
}

function addRatesSheet(
  workbook: ExcelJS.Workbook,
  references: ReturnType<typeof buildWorkbookReferences>,
  lists: ReturnType<typeof addListsSheet>
) {
  const rows = references.plans.flatMap(({ plan }) =>
    plan.rates.map((rate) => [
      references.planRefByExportId.get(plan.exportId) ?? "",
      rate.tier,
      Number(rate.grossPremium),
      Number(rate.employeeContribution),
      Number(rate.employerContribution),
      rate.ratePeriod,
      rate.enrollmentOverride,
    ])
  );
  const sheet = addTableSheet(workbook, {
    name: "Rates & Contributions",
    title: "Rates and contributions",
    note: "Applicable to Medical, Dental, and Vision. Employer contribution is checked against gross premium less employee contribution during import.",
    headers: [
      "Plan ID *",
      "Tier *",
      "Gross Premium *",
      "Employee Contribution *",
      "Employer Contribution",
      "Rate Period *",
      "Enrollment Override",
    ],
    widths: [18, 20, 20, 23, 23, 20, 22],
    rows,
    validations: [
      { column: 2, formula: lists.tiers },
      { column: 6, formula: lists.ratePeriods },
    ],
  });
  ["C", "D", "E"].forEach((column) => {
    sheet.getColumn(column).numFmt = "$#,##0.00";
  });
  sheet.getColumn("G").numFmt = "#,##0";
}

function addPlanDetailsSheet(
  workbook: ExcelJS.Workbook,
  references: ReturnType<typeof buildWorkbookReferences>
) {
  const rows =
    references.plans.length > 0
      ? references.plans.flatMap(({ program, plan }) =>
          detailRowsForPlan(
            references.planRefByExportId.get(plan.exportId) ?? "",
            program.benefitType as BenefitType,
            plan.subtype,
            plan.details as Record<string, unknown>
          )
        )
      : [
          ...DETAIL_DEFINITIONS.map((definition) => detailDefinitionRow("", definition, null)),
          ...BENEFIT_TYPES.filter((benefitType) => benefitType !== "VoluntaryOfferings").map(
            (benefitType) => [
              null,
              benefitType,
              "Plan notes",
              "Notes",
              null,
              "Optional context or an explanation for an “Other” selection.",
              "notes",
            ]
          ),
        ];
  const sheet = addTableSheet(workbook, {
    name: "Plan Details",
    title: "Plan design details",
    note: "Filter by benefit type, enter the Plan ID beside applicable provisions, and complete only the responses that apply. Copy rows when multiple plans use the same provision.",
    headers: ["Plan ID *", "Benefit Type", "Section", "Provision", "Response", "Guidance", "Field Key"],
    widths: [18, 20, 30, 38, 24, 54, 2],
    rows,
  });
  sheet.getColumn(7).hidden = true;
  for (let row = 5; row <= sheet.rowCount; row += 1) {
    for (const column of [2, 3, 4, 6]) {
      sheet.getCell(row, column).fill = solid(COLORS.panel);
      sheet.getCell(row, column).font = {
        name: "Aptos",
        size: 9,
        color: { argb: column === 2 ? COLORS.teal : COLORS.muted },
      };
    }
    const benefitType = textValue(sheet.getCell(row, 2)) as BenefitType;
    const key = textValue(sheet.getCell(row, 7));
    const definition = detailByBenefitAndKey.get(`${benefitType}|${key}`);
    if (definition?.field.options?.length) {
      sheet.getCell(row, 5).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${definition.field.options.join(",")}"`],
        showErrorMessage: true,
        errorTitle: "Choose a supported value",
        error: `Choose one of: ${definition.field.options.join(", ")}`,
      };
    } else if (
      definition &&
      ["currency", "number", "percent"].includes(definition.field.type)
    ) {
      sheet.getCell(row, 5).dataValidation = {
        type: "decimal",
        operator: "greaterThanOrEqual",
        allowBlank: true,
        formulae: [0],
        showErrorMessage: true,
        errorTitle: "Enter a non-negative number",
        error: "Enter zero or a positive number.",
      };
    }
  }
}

function addCustomFieldsSheet(
  workbook: ExcelJS.Workbook,
  references: ReturnType<typeof buildWorkbookReferences>
) {
  addTableSheet(workbook, {
    name: "Custom Plan Fields",
    title: "Custom plan fields",
    note: "Optional free-form label/value pairs for provisions that are not represented on Plan Details.",
    headers: ["Plan ID *", "Label *", "Value"],
    widths: [18, 34, 56],
    rows: references.plans.flatMap(({ plan }) =>
      plan.customAttributes.map((attribute) => [
        references.planRefByExportId.get(plan.exportId) ?? "",
        attribute.label,
        attribute.value,
      ])
    ),
  });
}

function addEmployeesSheet(
  workbook: ExcelJS.Workbook,
  references: ReturnType<typeof buildWorkbookReferences>
) {
  const rows = references.planYears.flatMap(({ ref, planYear }) =>
    planYear.employees.map((employee) => [
      ref,
      employee.employeeNumber,
      employee.firstName,
      employee.lastName,
      employee.birthDate ? toExcelDate(employee.birthDate) : null,
      employee.gender,
      employee.hireDate ? toExcelDate(employee.hireDate) : null,
      employee.employmentStatus,
      employee.baseSalary === null ? null : Number(employee.baseSalary),
      employee.postalCode,
    ])
  );
  const sheet = addTableSheet(workbook, {
    name: "Employees",
    title: "Employees (optional)",
    note: "Use the same Employee Number on Dependents and Employee Elections. Do not add Social Security numbers.",
    headers: [
      "Plan Year ID *",
      "Employee Number *",
      "First Name *",
      "Last Name *",
      "Birth Date",
      "Gender",
      "Hire Date",
      "Employment Status",
      "Base Salary",
      "Postal Code",
    ],
    widths: [18, 22, 20, 22, 16, 14, 16, 22, 18, 16],
    rows,
    dateColumns: [5, 7],
  });
  sheet.getColumn(9).numFmt = "$#,##0.00";
}

function addDependentsSheet(
  workbook: ExcelJS.Workbook,
  references: ReturnType<typeof buildWorkbookReferences>
) {
  addTableSheet(workbook, {
    name: "Dependents",
    title: "Dependents (optional)",
    note: "Match each dependent to an employee using Plan Year ID and Employee Number.",
    headers: [
      "Plan Year ID *",
      "Employee Number *",
      "First Name",
      "Last Name",
      "Birth Date",
      "Gender",
      "Relationship",
    ],
    widths: [18, 22, 20, 22, 16, 14, 20],
    rows: references.planYears.flatMap(({ ref, planYear }) =>
      planYear.employees.flatMap((employee) =>
        employee.dependents.map((dependent) => [
          ref,
          employee.employeeNumber,
          dependent.firstName,
          dependent.lastName,
          dependent.birthDate ? toExcelDate(dependent.birthDate) : null,
          dependent.gender,
          dependent.relationshipType,
        ])
      )
    ),
    dateColumns: [5],
  });
}

function addElectionsSheet(
  workbook: ExcelJS.Workbook,
  references: ReturnType<typeof buildWorkbookReferences>,
  lists: ReturnType<typeof addListsSheet>
) {
  const sheet = addTableSheet(workbook, {
    name: "Employee Elections",
    title: "Employee benefit elections (optional)",
    note: "One row per employee election. Plan Name and Option / Tier should match carrier or census naming.",
    headers: [
      "Plan Year ID *",
      "Employee Number *",
      "Benefit Type *",
      "Plan Name",
      "Option / Tier",
      "Volume",
    ],
    widths: [18, 22, 20, 30, 24, 18],
    rows: references.planYears.flatMap(({ ref, planYear }) =>
      planYear.employees.flatMap((employee) =>
        employee.elections.map((election) => [
          ref,
          employee.employeeNumber,
          election.benefitType,
          election.planName,
          election.optionName,
          election.volume === null ? null : Number(election.volume),
        ])
      )
    ),
    validations: [{ column: 3, formula: lists.benefitTypes }],
  });
  sheet.getColumn(6).numFmt = "#,##0.00";
}

function detailRowsForPlan(
  planRef: string,
  benefitType: BenefitType,
  subtype: string,
  details: Record<string, unknown>
) {
  const rows = DETAIL_DEFINITIONS.filter(
    (definition) =>
      definition.benefitType === benefitType &&
      (!definition.field.subtypes || definition.field.subtypes.includes(subtype))
  ).map((definition) =>
    detailDefinitionRow(
      planRef,
      definition,
      (details[definition.field.key] as PolicyDetailValue | undefined) ?? null
    )
  );
  if (benefitType !== "VoluntaryOfferings") {
    rows.push([
      planRef,
      benefitType,
      "Plan notes",
      "Notes",
      typeof details.notes === "string" ? details.notes : null,
      "Optional context or an explanation for an “Other” selection.",
      "notes",
    ]);
  }
  return rows;
}

function detailDefinitionRow(
  planRef: string,
  definition: DetailDefinition,
  value: PolicyDetailValue
) {
  const allowed = definition.field.options?.join("; ");
  const subtypeNote = definition.field.subtypes?.length
    ? `Applies to: ${definition.field.subtypes.join(", ")}.`
    : "";
  const units =
    definition.field.type === "currency"
      ? "USD"
      : definition.field.type === "percent"
        ? "Enter 20 for 20%."
        : definition.field.suffix ?? "";
  return [
    planRef || null,
    definition.benefitType,
    definition.groupLabel,
    definition.field.label,
    value,
    [allowed ? `Allowed: ${allowed}.` : "", units, definition.field.help ?? "", subtypeNote]
      .filter(Boolean)
      .join(" "),
    definition.field.key,
  ];
}

function setupSheetTitle(
  sheet: ExcelJS.Worksheet,
  title: string,
  note: string,
  columnCount: number
) {
  sheet.mergeCells(1, 1, 1, Math.max(columnCount, 3));
  sheet.getCell("A1").value = title;
  sheet.getCell("A1").style = {
    fill: solid(COLORS.ink),
    font: { name: "Aptos Display", size: 18, bold: true, color: { argb: COLORS.white } },
    alignment: { vertical: "middle" },
  };
  sheet.getRow(1).height = 34;
  sheet.mergeCells(2, 1, 2, Math.max(columnCount, 3));
  sheet.getCell("A2").value = note;
  sheet.getCell("A2").style = {
    fill: solid(COLORS.panel),
    font: { name: "Aptos", size: 10, color: { argb: COLORS.muted } },
    alignment: { wrapText: true, vertical: "middle" },
  };
  sheet.getRow(2).height = 32;
}

function styleHeader(row: ExcelJS.Row, count: number) {
  for (let column = 1; column <= count; column += 1) {
    row.getCell(column).style = {
      fill: solid(COLORS.teal),
      font: { name: "Aptos", size: 10, bold: true, color: { argb: COLORS.white } },
      alignment: { vertical: "middle" },
      border: boxBorder(COLORS.teal),
    };
  }
  row.height = 26;
}

function sectionStyle(cell: ExcelJS.Cell) {
  cell.style = {
    fill: solid(COLORS.tealLight),
    font: { name: "Aptos", size: 11, bold: true, color: { argb: COLORS.teal } },
    alignment: { vertical: "middle" },
    border: { bottom: { style: "thin", color: { argb: COLORS.teal } } },
  };
}

function inputStyle(): Partial<ExcelJS.Style> {
  return {
    fill: solid(COLORS.cream),
    font: { name: "Aptos", size: 10, color: { argb: COLORS.text } },
    alignment: { wrapText: true, vertical: "top" },
    border: bottomBorder(COLORS.border),
  };
}

function solid(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function boxBorder(argb: string): Partial<ExcelJS.Borders> {
  const edge = { style: "thin" as const, color: { argb } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

function bottomBorder(argb: string): Partial<ExcelJS.Borders> {
  return { bottom: { style: "thin", color: { argb } } };
}

function tableName(name: string) {
  return `BH${name.replace(/[^A-Za-z0-9]/g, "")}`;
}

function applyProfileValidation(
  cell: ExcelJS.Cell,
  definition: ProfileField,
  lists: ReturnType<typeof addListsSheet>
) {
  let formula: string | undefined;
  if (definition.type === "boolean") formula = lists.yesNo;
  if (definition.key === "primaryIndustry" || definition.key === "secondaryIndustry") formula = lists.industries;
  if (definition.key === "ownershipType") formula = lists.ownership;
  if (definition.key === "entityStructure") formula = lists.entityStructures;
  if (definition.key === "disruptionTolerance") formula = lists.disruption;
  if (formula) {
    cell.dataValidation = {
      type: "list",
      allowBlank: definition.type !== "required",
      formulae: [formula],
      showErrorMessage: true,
      errorTitle: "Choose a supported value",
      error: "Select a value from the dropdown list.",
    };
  }
}

function profileSource(payload?: ClientExportPayload): Record<string, unknown> {
  const profile = payload?.client.profile;
  return {
    displayName: payload?.client.name ?? null,
    primaryColor: payload?.client.primaryColor ?? "#1F2937",
    secondaryColor: payload?.client.secondaryColor ?? "#14B8A6",
    legalName: profile?.legalName ?? payload?.client.name ?? null,
    ...(profile ?? {}),
  };
}

function profileDisplayValue(definition: ProfileField, value: unknown): ExcelJS.CellValue {
  if (Array.isArray(value)) return value.join("; ");
  if (typeof value === "boolean") return yesNo(value);
  if (value === undefined) return null;
  if (definition.type === "currency" || definition.type === "percent" || definition.type === "integer") {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return value as ExcelJS.CellValue;
}

function readProfileValues(workbook: ExcelJS.Workbook, issues: string[]) {
  const sheet = workbook.getWorksheet("Client Profile");
  if (!sheet) {
    issues.push('Required worksheet "Client Profile" is missing.');
    return {} as Record<string, ExcelJS.CellValue>;
  }
  const values: Record<string, ExcelJS.CellValue> = {};
  for (let row = 5; row <= sheet.rowCount; row += 1) {
    const key = textValue(sheet.getCell(row, 4));
    if (key) values[key] = rawCellValue(sheet.getCell(row, 2));
  }
  return values;
}

type ParsedRow = { rowNumber: number; values: Record<string, ExcelJS.CellValue> };

function readRows(workbook: ExcelJS.Workbook, sheetName: string, issues: string[]): ParsedRow[] {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    issues.push(`Required worksheet "${sheetName}" is missing.`);
    return [];
  }
  const headers: Array<{ column: number; key: string }> = [];
  for (let column = 1; column <= sheet.actualColumnCount; column += 1) {
    const key = normalizeHeader(textValue(sheet.getCell(4, column)));
    if (key) headers.push({ column, key });
  }
  return Array.from({ length: Math.max(0, sheet.rowCount - 4) }, (_, index) => {
    const rowNumber = index + 5;
    const values: Record<string, ExcelJS.CellValue> = {};
    headers.forEach(({ column, key }) => {
      values[key] = rawCellValue(sheet.getCell(rowNumber, column));
    });
    return { rowNumber, values };
  });
}

function parsePlans(
  workbook: ExcelJS.Workbook,
  planYears: Map<string, ClientExportPayload["client"]["planYears"][number]>,
  issues: string[]
) {
  type Plan = ClientExportPayload["client"]["planYears"][number]["benefitPrograms"][number]["plans"][number];
  const plans = new Map<string, { plan: Plan; benefitType: BenefitType }>();
  for (const row of readRows(workbook, "Benefit Plans", issues)) {
    if (rowIsBlank(row)) continue;
    const label = `Benefit Plans row ${row.rowNumber}`;
    const ref = requiredRowText(row, "plan id", label, issues);
    const planYearRef = requiredRowText(row, "plan year id", label, issues);
    const benefitTypeText = requiredRowText(row, "benefit type", label, issues);
    const name = requiredRowText(row, "plan / class name", label, issues);
    const subtype = requiredRowText(row, "subtype", label, issues);
    if (!ref || !planYearRef || !benefitTypeText || !name || !subtype) continue;
    if (plans.has(ref)) {
      issues.push(`${label}: Plan ID "${ref}" is duplicated.`);
      continue;
    }
    const planYear = planYears.get(planYearRef);
    if (!planYear) {
      issues.push(`${label}: Plan Year ID "${planYearRef}" was not found on Plan Years.`);
      continue;
    }
    if (!(BENEFIT_TYPES as readonly string[]).includes(benefitTypeText)) {
      issues.push(`${label}: Benefit Type "${benefitTypeText}" is not supported.`);
      continue;
    }
    const benefitType = benefitTypeText as BenefitType;
    if (!PLAN_SUBTYPES[benefitType].includes(subtype)) {
      issues.push(`${label}: Subtype "${subtype}" is not supported for ${BENEFIT_META[benefitType].label}.`);
      continue;
    }
    const details: Record<string, PolicyDetailValue> = {};
    if (benefitType === "VoluntaryOfferings") {
      const selected = new Set(splitList(textValue(row.values["additional offerings"])));
      for (const offering of VOLUNTARY_PLAN_OFFERINGS) {
        if (selected.has(offering.label)) details[offering.key] = true;
      }
    }
    const aliases = splitList(textValue(row.values["census aliases"]));
    const plan: Plan = {
      exportId: ref,
      name,
      carrierName: nullableText(row.values.carrier),
      subtype,
      offered: booleanValue(row.values.offered) ?? true,
      details,
      customAttributes: [],
      detailSchemaVersion: 1,
      renewedFromExportId: nullableText(row.values["renewed from plan id"]),
      sortOrder: 0,
      rates: [],
      aliases: Array.from(new Set([name, ...aliases])).map((alias) => ({
        alias,
        normalizedAlias: normalizePolicyName(alias),
      })),
    };
    let program = planYear.benefitPrograms.find((item) => item.benefitType === benefitType);
    if (!program) {
      program = {
        benefitType,
        offered: false,
        sortOrder: BENEFIT_META[benefitType].sortOrder,
        plans: [],
      };
      planYear.benefitPrograms.push(program);
    }
    plan.sortOrder = program.plans.length;
    program.plans.push(plan);
    program.offered ||= plan.offered;
    plans.set(ref, { plan, benefitType });
  }
  for (const { plan } of plans.values()) {
    if (plan.renewedFromExportId && !plans.has(plan.renewedFromExportId)) {
      issues.push(`Benefit Plans: Renewed From Plan ID "${plan.renewedFromExportId}" was not found.`);
    }
  }
  return plans;
}

function parseRates(
  workbook: ExcelJS.Workbook,
  plans: ReturnType<typeof parsePlans>,
  issues: string[]
) {
  for (const row of readRows(workbook, "Rates & Contributions", issues)) {
    if (rowIsBlank(row)) continue;
    const label = `Rates & Contributions row ${row.rowNumber}`;
    const planRef = requiredRowText(row, "plan id", label, issues);
    const tier = requiredRowText(row, "tier", label, issues);
    const ratePeriod = requiredRowText(row, "rate period", label, issues);
    const grossPremium = requiredNumber(row.values["gross premium"], label, "Gross Premium", issues);
    const employeeContribution = requiredNumber(
      row.values["employee contribution"],
      label,
      "Employee Contribution",
      issues
    );
    if (!planRef || !tier || !ratePeriod || grossPremium === null || employeeContribution === null) continue;
    const item = plans.get(planRef);
    if (!item) {
      issues.push(`${label}: Plan ID "${planRef}" was not found on Benefit Plans.`);
      continue;
    }
    if (!(TIER_CODES as readonly string[]).includes(tier)) {
      issues.push(`${label}: Tier "${tier}" is not supported.`);
      continue;
    }
    if (!(RATE_PERIODS as readonly string[]).includes(ratePeriod)) {
      issues.push(`${label}: Rate Period "${ratePeriod}" is not supported.`);
      continue;
    }
    if (employeeContribution > grossPremium) {
      issues.push(`${label}: Employee Contribution cannot exceed Gross Premium.`);
      continue;
    }
    item.plan.rates.push({
      tier: tier as (typeof TIER_CODES)[number],
      grossPremium: String(grossPremium),
      employeeContribution: String(employeeContribution),
      employerContribution: String(roundCurrency(grossPremium - employeeContribution)),
      ratePeriod,
      enrollmentOverride: nullableInteger(row.values["enrollment override"], label, "Enrollment Override", issues),
      sortOrder: item.plan.rates.length,
    });
  }
}

function parsePlanDetails(
  workbook: ExcelJS.Workbook,
  plans: ReturnType<typeof parsePlans>,
  issues: string[]
) {
  for (const row of readRows(workbook, "Plan Details", issues)) {
    const planRef = nullableText(row.values["plan id"]);
    const response = row.values.response;
    if (!planRef || isBlank(response)) continue;
    const label = `Plan Details row ${row.rowNumber}`;
    const item = plans.get(planRef);
    if (!item) {
      issues.push(`${label}: Plan ID "${planRef}" was not found on Benefit Plans.`);
      continue;
    }
    let key = nullableText(row.values["field key"]);
    if (!key) {
      const provision = nullableText(row.values.provision);
      const match = DETAIL_DEFINITIONS.find(
        (definition) =>
          definition.benefitType === item.benefitType &&
          definition.field.label.toLowerCase() === provision?.toLowerCase()
      );
      key = match?.field.key ?? null;
    }
    if (!key) {
      issues.push(`${label}: the hidden Field Key is missing and the Provision could not be recognized.`);
      continue;
    }
    const details = item.plan.details as Record<string, PolicyDetailValue>;
    if (key === "notes") {
      details.notes = textValue(response);
      continue;
    }
    const definition = detailByBenefitAndKey.get(`${item.benefitType}|${key}`);
    if (!definition) {
      issues.push(`${label}: Field Key "${key}" is not supported for ${item.benefitType}.`);
      continue;
    }
    const value = parseDetailValue(response, definition.field, label, issues);
    if (value !== undefined) details[key] = value;
  }
}

function parseCustomFields(
  workbook: ExcelJS.Workbook,
  plans: ReturnType<typeof parsePlans>,
  issues: string[]
) {
  for (const row of readRows(workbook, "Custom Plan Fields", issues)) {
    if (rowIsBlank(row)) continue;
    const rowLabel = `Custom Plan Fields row ${row.rowNumber}`;
    const planRef = requiredRowText(row, "plan id", rowLabel, issues);
    const label = requiredRowText(row, "label", rowLabel, issues);
    if (!planRef || !label) continue;
    const item = plans.get(planRef);
    if (!item) {
      issues.push(`${rowLabel}: Plan ID "${planRef}" was not found on Benefit Plans.`);
      continue;
    }
    item.plan.customAttributes.push({ label, value: textValue(row.values.value) });
  }
}

function parseEmployees(
  workbook: ExcelJS.Workbook,
  planYears: Map<string, ClientExportPayload["client"]["planYears"][number]>,
  issues: string[]
) {
  for (const row of readRows(workbook, "Employees", issues)) {
    if (rowIsBlank(row)) continue;
    const label = `Employees row ${row.rowNumber}`;
    const planYearRef = requiredRowText(row, "plan year id", label, issues);
    const employeeNumber = requiredRowText(row, "employee number", label, issues);
    const firstName = requiredRowText(row, "first name", label, issues);
    const lastName = requiredRowText(row, "last name", label, issues);
    if (!planYearRef || !employeeNumber || !firstName || !lastName) continue;
    const planYear = planYears.get(planYearRef);
    if (!planYear) {
      issues.push(`${label}: Plan Year ID "${planYearRef}" was not found on Plan Years.`);
      continue;
    }
    if (planYear.employees.some((employee) => employee.employeeNumber === employeeNumber)) {
      issues.push(`${label}: Employee Number "${employeeNumber}" is duplicated within ${planYearRef}.`);
      continue;
    }
    planYear.employees.push({
      employeeNumber,
      firstName,
      lastName,
      birthDate: nullableIsoDate(row.values["birth date"], label, "Birth Date", issues),
      gender: nullableText(row.values.gender),
      hireDate: nullableIsoDate(row.values["hire date"], label, "Hire Date", issues),
      employmentStatus: nullableText(row.values["employment status"]),
      baseSalary: nullableDecimalString(row.values["base salary"], label, "Base Salary", issues),
      postalCode: nullableText(row.values["postal code"]),
      dependents: [],
      elections: [],
    });
  }
}

function parseDependents(
  workbook: ExcelJS.Workbook,
  planYears: Map<string, ClientExportPayload["client"]["planYears"][number]>,
  issues: string[]
) {
  for (const row of readRows(workbook, "Dependents", issues)) {
    if (rowIsBlank(row)) continue;
    const label = `Dependents row ${row.rowNumber}`;
    const planYearRef = requiredRowText(row, "plan year id", label, issues);
    const employeeNumber = requiredRowText(row, "employee number", label, issues);
    if (!planYearRef || !employeeNumber) continue;
    const employee = planYears
      .get(planYearRef)
      ?.employees.find((item) => item.employeeNumber === employeeNumber);
    if (!employee) {
      issues.push(`${label}: employee "${employeeNumber}" was not found in Plan Year "${planYearRef}".`);
      continue;
    }
    employee.dependents.push({
      firstName: nullableText(row.values["first name"]),
      lastName: nullableText(row.values["last name"]),
      birthDate: nullableIsoDate(row.values["birth date"], label, "Birth Date", issues),
      gender: nullableText(row.values.gender),
      relationshipType: nullableText(row.values.relationship),
    });
  }
}

function parseElections(
  workbook: ExcelJS.Workbook,
  planYears: Map<string, ClientExportPayload["client"]["planYears"][number]>,
  issues: string[]
) {
  for (const row of readRows(workbook, "Employee Elections", issues)) {
    if (rowIsBlank(row)) continue;
    const label = `Employee Elections row ${row.rowNumber}`;
    const planYearRef = requiredRowText(row, "plan year id", label, issues);
    const employeeNumber = requiredRowText(row, "employee number", label, issues);
    const benefitType = requiredRowText(row, "benefit type", label, issues);
    if (!planYearRef || !employeeNumber || !benefitType) continue;
    const employee = planYears
      .get(planYearRef)
      ?.employees.find((item) => item.employeeNumber === employeeNumber);
    if (!employee) {
      issues.push(`${label}: employee "${employeeNumber}" was not found in Plan Year "${planYearRef}".`);
      continue;
    }
    employee.elections.push({
      benefitType,
      planName: nullableText(row.values["plan name"]),
      optionName: nullableText(row.values["option / tier"]),
      volume: nullableDecimalString(row.values.volume, label, "Volume", issues),
    });
  }
}

function parseDetailValue(
  value: ExcelJS.CellValue,
  definition: PolicyDetailField,
  label: string,
  issues: string[]
): PolicyDetailValue | undefined {
  if (definition.type === "text" || definition.type === "select") {
    const text = textValue(value);
    if (definition.options && text && !definition.options.includes(text)) {
      issues.push(`${label}: "${text}" is not an allowed value for ${definition.label}.`);
      return undefined;
    }
    return text;
  }
  const numeric = numericValue(value);
  if (numeric === null || numeric < 0) {
    issues.push(`${label}: ${definition.label} must be a non-negative number.`);
    return undefined;
  }
  if (definition.type === "percent" && numeric > (definition.max ?? 100)) {
    issues.push(`${label}: ${definition.label} cannot exceed ${definition.max ?? 100}%.`);
    return undefined;
  }
  return numeric;
}

function requiredProfileText(
  values: Record<string, ExcelJS.CellValue>,
  key: string,
  label: string,
  issues: string[]
) {
  const value = textValue(values[key]);
  if (!value) issues.push(`Client Profile: ${label} is required.`);
  return value;
}

function nullableProfileText(values: Record<string, ExcelJS.CellValue>, key: string) {
  return nullableText(values[key]);
}

function profileInteger(values: Record<string, ExcelJS.CellValue>, key: string) {
  const value = numericValue(values[key]);
  return value === null ? null : Math.trunc(value);
}

function profileBoolean(values: Record<string, ExcelJS.CellValue>, key: string) {
  return booleanValue(values[key]);
}

function profileDecimalString(values: Record<string, ExcelJS.CellValue>, key: string) {
  const value = numericValue(values[key]);
  return value === null ? null : String(value);
}

function parseHex(
  value: ExcelJS.CellValue,
  fallback: string,
  label: string,
  issues: string[]
) {
  const text = textValue(value) || fallback;
  if (!/^#[0-9A-Fa-f]{6}$/.test(text)) {
    issues.push(`Client Profile: ${label} must be a hex color like #1F2937.`);
    return fallback;
  }
  return text.toUpperCase();
}

function requiredRowText(row: ParsedRow, key: string, label: string, issues: string[]) {
  const value = textValue(row.values[key]);
  if (!value) issues.push(`${label}: ${titleCase(key)} is required.`);
  return value;
}

function requiredNumber(
  value: ExcelJS.CellValue,
  rowLabel: string,
  fieldLabel: string,
  issues: string[]
) {
  const numeric = numericValue(value);
  if (numeric === null || numeric < 0) {
    issues.push(`${rowLabel}: ${fieldLabel} is required and must be a non-negative number.`);
    return null;
  }
  return numeric;
}

function nullableInteger(
  value: ExcelJS.CellValue,
  rowLabel: string,
  fieldLabel: string,
  issues: string[]
) {
  if (isBlank(value)) return null;
  const numeric = numericValue(value);
  if (numeric === null || numeric < 0 || !Number.isInteger(numeric)) {
    issues.push(`${rowLabel}: ${fieldLabel} must be a non-negative whole number.`);
    return null;
  }
  return numeric;
}

function nullableDecimalString(
  value: ExcelJS.CellValue,
  rowLabel: string,
  fieldLabel: string,
  issues: string[]
) {
  if (isBlank(value)) return null;
  const numeric = numericValue(value);
  if (numeric === null || numeric < 0) {
    issues.push(`${rowLabel}: ${fieldLabel} must be a non-negative number.`);
    return null;
  }
  return String(numeric);
}

function nullableIsoDate(
  value: ExcelJS.CellValue,
  rowLabel: string,
  fieldLabel: string,
  issues: string[]
) {
  if (isBlank(value)) return null;
  const parsed = isoDateValue(value);
  if (!parsed) issues.push(`${rowLabel}: ${fieldLabel} must be a valid date.`);
  return parsed;
}

function rawCellValue(cell: ExcelJS.Cell): ExcelJS.CellValue {
  const value = cell.value;
  if (value && typeof value === "object" && "result" in value) {
    return (value.result as ExcelJS.CellValue) ?? null;
  }
  if (value && typeof value === "object" && "richText" in value) {
    return value.richText.map((part) => part.text).join("");
  }
  if (value && typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text;
  }
  return value;
}

function textValue(value: ExcelJS.Cell | ExcelJS.CellValue | undefined): string {
  const raw = value && typeof value === "object" && "value" in value
    ? rawCellValue(value as ExcelJS.Cell)
    : value;
  if (raw === null || raw === undefined) return "";
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === "object") return "";
  return String(raw).trim();
}

function nullableText(value: ExcelJS.CellValue | undefined): string | null {
  return textValue(value) || null;
}

function numberValue(cell: ExcelJS.Cell): number | null {
  return numericValue(rawCellValue(cell));
}

function numericValue(value: ExcelJS.CellValue | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = textValue(value);
  if (!text) return null;
  const percent = text.endsWith("%");
  const parsed = Number(text.replace(/[$,%\s]/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return percent ? parsed : parsed;
}

function booleanValue(value: ExcelJS.CellValue | undefined): boolean | null {
  if (typeof value === "boolean") return value;
  const text = textValue(value).toLowerCase();
  if (!text) return null;
  if (["yes", "true", "y", "1", "x"].includes(text)) return true;
  if (["no", "false", "n", "0"].includes(text)) return false;
  return null;
}

function isoDateValue(value: ExcelJS.CellValue | undefined): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "number") {
    const date = new Date(Math.round((value - 25569) * 86_400_000));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const text = textValue(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function splitList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[;\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function rowIsBlank(row: ParsedRow) {
  return Object.values(row.values).every(isBlank);
}

function isBlank(value: ExcelJS.CellValue | undefined) {
  return value === null || value === undefined || textValue(value) === "";
}

function normalizeHeader(value: string) {
  return value
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function toExcelDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
