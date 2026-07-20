import { z } from "zod";
import { hexColor } from "@/lib/validation";

export const INDUSTRY_OPTIONS = [
  "Agriculture, Forestry & Fishing",
  "Construction",
  "Education",
  "Energy & Utilities",
  "Financial Services",
  "Government",
  "Healthcare",
  "Hospitality & Leisure",
  "Insurance",
  "Legal & Professional Services",
  "Manufacturing",
  "Media & Entertainment",
  "Nonprofit",
  "Real Estate",
  "Retail",
  "Technology",
  "Telecommunications",
  "Transportation & Logistics",
  "Wholesale & Distribution",
  "Other",
] as const;

export const OWNERSHIP_TYPES = [
  "Privately Held",
  "Publicly Traded",
  "Private Equity-Backed",
  "Nonprofit",
  "Government",
  "Other",
] as const;

export const ENTITY_STRUCTURES = [
  "Single Entity",
  "Controlled Group",
  "Multiple Unrelated Entities",
  "Other",
] as const;

export const WORKFORCE_TYPES = [
  "Seasonal",
  "Temporary",
  "Part-Time",
  "Variable-Hour",
  "None of These",
] as const;

export const DISRUPTION_TOLERANCE_OPTIONS = [
  "No Disruption",
  "Minimal Disruption",
  "Moderate Disruption",
  "Open to Disruption for Material Value",
  "Not Yet Determined",
] as const;

export const INTERNAL_TEAM_ROLES = [
  "Lead Consultant",
  "Account Executive / Producer",
  "Account Manager",
  "Benefits Analyst",
  "Compliance Contact",
  "Communications Contact",
  "Executive Sponsor",
] as const;

export const CLIENT_CONTACT_ROLES = [
  "Primary Benefits Contact",
  "Finance Contact",
  "Payroll Contact",
  "Legal / Compliance Contact",
  "Accounts Payable Contact",
  "Authorized Signer",
] as const;

export const CLIENT_PRIORITY_OPTIONS = [
  "Reduce overall benefit cost",
  "Minimize employee disruption",
  "Improve employee contributions",
  "Improve benefit competitiveness",
  "Improve recruiting and retention",
  "Reduce administrative burden",
  "Improve compliance",
  "Consolidate vendors",
  "Harmonize acquired companies",
  "Prepare for acquisition or sale",
  "Transition away from a PEO",
  "Evaluate self-funding",
  "Improve pharmacy management",
  "Reduce high-cost claims",
  "Improve employee engagement",
  "Modernize benefit administration",
  "Improve reporting and analytics",
] as const;

export const CLIENT_DOCUMENT_CATEGORIES = [
  "benefit-summary",
  "rates",
  "plan-documents",
  "contracts",
  "historical-renewals",
  "claims",
  "contribution-schedules",
  "census",
  "compliance",
  "communications",
] as const;

export type ClientDocumentCategory = (typeof CLIENT_DOCUMENT_CATEGORIES)[number];

export const CLIENT_DOCUMENT_CATEGORY_LABELS: Record<ClientDocumentCategory, string> = {
  "benefit-summary": "Current benefit summary",
  rates: "Current and renewal rates",
  "plan-documents": "Plan documents / SPDs",
  contracts: "Carrier and vendor contracts",
  "historical-renewals": "Historical renewals",
  claims: "Claims reports",
  "contribution-schedules": "Employee contribution schedules",
  census: "Current census",
  compliance: "Compliance documents",
  communications: "Employee communications / benefit guide",
};

export const US_STATES = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
  ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"],
  ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"],
  ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
] as const;

const nullableText = (max: number) => z.string().trim().max(max).nullable();
const nullableNonNegativeInteger = z.number().int().min(0).max(100_000_000).nullable();
const nullableBoolean = z.boolean().nullable();
const monthSchema = z.number().int().min(1).max(12).nullable();
const daySchema = z.number().int().min(1).max(31).nullable();

const profileSchema = z.object({
  legalName: z.string().trim().min(1, "Legal company name is required").max(200),
  website: nullableText(500),
  primaryIndustry: nullableText(150),
  secondaryIndustry: nullableText(150),
  industryCode: nullableText(30),
  ownershipType: nullableText(100),
  parentCompany: nullableText(200),
  privateEquitySponsor: nullableText(200),
  fiscalYearEndMonth: monthSchema,
  fiscalYearEndDay: daySchema,
  primaryRenewalMonth: monthSchema,
  primaryRenewalDay: daySchema,
  usEmployeeCount: nullableNonNegativeInteger,
  globalEmployeeCount: nullableNonNegativeInteger,
  benefitsEligibleCount: nullableNonNegativeInteger,
  enrolledEmployeeCount: nullableNonNegativeInteger,
  entityStructure: nullableText(100),
  numberOfEins: z.number().int().min(1).max(10_000).nullable(),
  benefitsConsistentAcrossEntities: nullableBoolean,
  benefitsConsistencyNotes: nullableText(2_000),
  hasUnionPopulation: nullableBoolean,
  hasCollectivelyBargainedPlans: nullableBoolean,
  hasAcquiredCompanies: nullableBoolean,
  hasInternationalEmployees: nullableBoolean,
  workforceTypes: z.array(z.enum(WORKFORCE_TYPES)).max(WORKFORCE_TYPES.length),
  coveredThroughPeo: nullableBoolean,
  statesWithEmployees: z.array(z.string().length(2)).max(US_STATES.length),
  remoteEmployeePercentage: z.number().min(0).max(100).nullable(),
  benefitChallenges: nullableText(5_000),
  renewalSuccessOutcomes: nullableText(5_000),
  budgetTarget: z.number().min(0).max(999_999_999_999.99).nullable(),
  maximumAcceptableIncrease: z.number().min(0).max(100).nullable(),
  disruptionTolerance: nullableText(150),
  excludedCarriers: z.array(z.string().trim().min(1).max(150)).max(100),
  acquisitionsExpected: nullableBoolean,
  headcountChangesExpected: nullableBoolean,
  harmonizationUnderway: nullableBoolean,
  preparingForTransaction: nullableBoolean,
});

const teamAssignmentSchema = z.object({
  role: z.enum(INTERNAL_TEAM_ROLES),
  userId: z.string().min(1),
});

const contactSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1, "Contact name is required").max(200),
  title: nullableText(200),
  email: z.union([z.literal(""), z.email("Enter a valid email"), z.null()]),
  phone: nullableText(50),
  roles: z.array(z.enum(CLIENT_CONTACT_ROLES)).min(1, "Choose at least one contact role"),
  notes: nullableText(2_000),
  sortOrder: z.number().int().min(0).max(10_000),
});

const locationSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1, "Location name is required").max(200),
  line1: z.string().trim().min(1, "Street address is required").max(250),
  line2: nullableText(250),
  city: z.string().trim().min(1, "City is required").max(150),
  state: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().min(3).max(20),
  country: z.string().trim().min(1).max(100),
  isHeadquarters: z.boolean(),
  employeeCount: nullableNonNegativeInteger,
  sortOrder: z.number().int().min(0).max(10_000),
});

const entitySchema = z.object({
  id: z.string().min(1).optional(),
  legalName: z.string().trim().min(1, "Entity legal name is required").max(200),
  taxIdLastFour: z.union([z.literal(""), z.string().regex(/^\d{4}$/, "Use the final four digits only"), z.null()]),
  notes: nullableText(2_000),
  sortOrder: z.number().int().min(0).max(10_000),
});

const prioritySchema = z.object({
  objective: z.enum(CLIENT_PRIORITY_OPTIONS),
  rank: z.number().int().min(1).max(CLIENT_PRIORITY_OPTIONS.length),
  currentState: nullableText(2_000),
  desiredOutcome: nullableText(2_000),
  measurementKpi: nullableText(500),
  notes: nullableText(2_000),
});

export const clientOnboardingSchema = z
  .object({
    displayName: z.string().trim().min(1, "Display name is required").max(200),
    primaryColor: hexColor,
    secondaryColor: hexColor,
    profile: profileSchema,
    teamAssignments: z.array(teamAssignmentSchema).max(INTERNAL_TEAM_ROLES.length),
    contacts: z.array(contactSchema).max(100),
    locations: z.array(locationSchema).max(250),
    entities: z.array(entitySchema).max(100),
    priorities: z.array(prioritySchema).max(CLIENT_PRIORITY_OPTIONS.length),
  })
  .superRefine((data, context) => {
    requireUnique(data.teamAssignments, (item) => item.role, context, "teamAssignments", "An internal role can have only one assignee");
    requireUnique(data.priorities, (item) => String(item.rank), context, "priorities", "Priority ranks must be unique");
    requireUnique(data.priorities, (item) => item.objective, context, "priorities", "A priority can be selected only once");
    if (data.locations.filter((location) => location.isHeadquarters).length > 1) {
      context.addIssue({ code: "custom", path: ["locations"], message: "Choose only one headquarters" });
    }
    if (
      data.profile.workforceTypes.includes("None of These") &&
      data.profile.workforceTypes.length > 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["profile", "workforceTypes"],
        message: "None of These cannot be combined with another workforce type",
      });
    }
    const validStateCodes = new Set<string>(US_STATES.map(([code]) => code));
    if (data.profile.statesWithEmployees.some((code) => !validStateCodes.has(code))) {
      context.addIssue({
        code: "custom",
        path: ["profile", "statesWithEmployees"],
        message: "Choose states from the supported list",
      });
    }
    if (
      data.profile.enrolledEmployeeCount !== null &&
      data.profile.benefitsEligibleCount !== null &&
      data.profile.enrolledEmployeeCount > data.profile.benefitsEligibleCount
    ) {
      context.addIssue({
        code: "custom",
        path: ["profile", "enrolledEmployeeCount"],
        message: "Enrolled employees cannot exceed benefits-eligible employees",
      });
    }
    validateMonthDay(data.profile.primaryRenewalMonth, data.profile.primaryRenewalDay, context, "primaryRenewal");
    validateMonthDay(data.profile.fiscalYearEndMonth, data.profile.fiscalYearEndDay, context, "fiscalYearEnd");
  });

export const newClientIntakeSchema = z
  .object({
    legalName: z.string().trim().min(1, "Legal company name is required").max(200),
    displayName: z.string().trim().min(1, "Display name is required").max(200),
    primaryIndustry: z.string().trim().min(1, "Primary industry is required").max(150),
    primaryRenewalMonth: z.coerce.number().int().min(1).max(12),
    primaryRenewalDay: z.coerce.number().int().min(1).max(31),
    headquartersLine1: z.string().trim().min(1, "Headquarters address is required").max(250),
    headquartersLine2: z.string().trim().max(250).optional(),
    headquartersCity: z.string().trim().min(1, "Headquarters city is required").max(150),
    headquartersState: z.string().trim().refine(
      (code) => US_STATES.some(([stateCode]) => stateCode === code),
      "Choose a supported headquarters state"
    ),
    headquartersPostalCode: z.string().trim().min(3).max(20),
    primaryColor: hexColor,
    secondaryColor: hexColor,
  })
  .superRefine((data, context) => {
    const value = new Date(
      Date.UTC(2024, data.primaryRenewalMonth - 1, data.primaryRenewalDay)
    );
    if (
      value.getUTCMonth() !== data.primaryRenewalMonth - 1 ||
      value.getUTCDate() !== data.primaryRenewalDay
    ) {
      context.addIssue({
        code: "custom",
        path: ["primaryRenewalDay"],
        message: "Enter a valid renewal month and day",
      });
    }
  });

export const clientDocumentCategorySchema = z.enum(CLIENT_DOCUMENT_CATEGORIES);

export type ClientOnboardingInput = z.infer<typeof clientOnboardingSchema>;
export type NewClientIntakeInput = z.infer<typeof newClientIntakeSchema>;

export type OnboardingSectionKey = "profile" | "team" | "organization" | "goals" | "documents";

export type OnboardingProgress = {
  percentage: number;
  completed: number;
  total: number;
  documentCount: number;
  sections: Record<OnboardingSectionKey, { completed: number; total: number; percentage: number }>;
};

export function computeOnboardingProgress(
  data: Pick<ClientOnboardingInput, "displayName" | "profile" | "teamAssignments" | "contacts" | "locations" | "priorities">,
  documentCount: number
): OnboardingProgress {
  const profile = data.profile;
  return computeOnboardingSummary({
    displayName: data.displayName,
    legalName: profile.legalName,
    primaryIndustry: profile.primaryIndustry,
    primaryRenewalMonth: profile.primaryRenewalMonth,
    primaryRenewalDay: profile.primaryRenewalDay,
    headquartersComplete: data.locations.some(
      (location) =>
        location.isHeadquarters &&
        Boolean(location.line1 && location.city && location.state && location.postalCode)
    ),
    usEmployeeCount: profile.usEmployeeCount,
    benefitsEligibleCount: profile.benefitsEligibleCount,
    enrolledEmployeeCount: profile.enrolledEmployeeCount,
    teamAssignmentCount: data.teamAssignments.length,
    contactCount: data.contacts.length,
    entityStructure: profile.entityStructure,
    benefitsConsistentAcrossEntities: profile.benefitsConsistentAcrossEntities,
    hasUnionPopulation: profile.hasUnionPopulation,
    workforceTypes: profile.workforceTypes,
    coveredThroughPeo: profile.coveredThroughPeo,
    statesWithEmployees: profile.statesWithEmployees,
    benefitChallenges: profile.benefitChallenges,
    renewalSuccessOutcomes: profile.renewalSuccessOutcomes,
    disruptionTolerance: profile.disruptionTolerance,
    priorityCount: data.priorities.length,
    documentCount,
  });
}

export function computeOnboardingSummary(input: {
  displayName: string | null;
  legalName: string | null;
  primaryIndustry: string | null;
  primaryRenewalMonth: number | null;
  primaryRenewalDay: number | null;
  headquartersComplete: boolean;
  usEmployeeCount: number | null;
  benefitsEligibleCount: number | null;
  enrolledEmployeeCount: number | null;
  teamAssignmentCount: number;
  contactCount: number;
  entityStructure: string | null;
  benefitsConsistentAcrossEntities: boolean | null;
  hasUnionPopulation: boolean | null;
  workforceTypes: readonly string[];
  coveredThroughPeo: boolean | null;
  statesWithEmployees: readonly string[];
  benefitChallenges: string | null;
  renewalSuccessOutcomes: string | null;
  disruptionTolerance: string | null;
  priorityCount: number;
  documentCount: number;
}): OnboardingProgress {
  const completionSections = {
    profile: score([
      Boolean(input.legalName),
      Boolean(input.displayName),
      Boolean(input.primaryIndustry),
      input.primaryRenewalMonth !== null && input.primaryRenewalDay !== null,
      input.headquartersComplete,
      input.usEmployeeCount !== null,
      input.benefitsEligibleCount !== null,
      input.enrolledEmployeeCount !== null,
    ]),
    team: score([input.teamAssignmentCount > 0, input.contactCount > 0]),
    organization: score([
      Boolean(input.entityStructure),
      input.benefitsConsistentAcrossEntities !== null,
      input.hasUnionPopulation !== null,
      input.workforceTypes.length > 0,
      input.coveredThroughPeo !== null,
      input.statesWithEmployees.length > 0,
    ]),
    goals: score([
      Boolean(input.benefitChallenges),
      Boolean(input.renewalSuccessOutcomes),
      Boolean(input.disruptionTolerance),
      input.priorityCount > 0,
    ]),
  };
  const completed = Object.values(completionSections).reduce(
    (sum, section) => sum + section.completed,
    0
  );
  const total = Object.values(completionSections).reduce(
    (sum, section) => sum + section.total,
    0
  );
  const sections: OnboardingProgress["sections"] = {
    ...completionSections,
    documents: { completed: 0, total: 0, percentage: 0 },
  };
  return {
    percentage: percent(completed, total),
    completed,
    total,
    documentCount: input.documentCount,
    sections,
  };
}

export function formatRecurringDate(month: number | null, day: number | null): string | null {
  if (!month || !day) return null;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(2024, month - 1, day))
  );
}

function score(items: boolean[]) {
  const completed = items.filter(Boolean).length;
  return { completed, total: items.length, percentage: percent(completed, items.length) };
}

function percent(completed: number, total: number) {
  return total === 0 ? 100 : Math.round((completed / total) * 100);
}

function requireUnique<T>(
  items: T[],
  key: (item: T) => string,
  context: z.RefinementCtx,
  path: string,
  message: string
) {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    const value = key(item);
    if (seen.has(value)) context.addIssue({ code: "custom", path: [path, index], message });
    seen.add(value);
  });
}

function validateMonthDay(
  month: number | null,
  day: number | null,
  context: z.RefinementCtx,
  path: string
) {
  if ((month === null) !== (day === null)) {
    context.addIssue({ code: "custom", path: ["profile", path], message: "Enter both month and day" });
    return;
  }
  if (month === null || day === null) return;
  const value = new Date(Date.UTC(2024, month - 1, day));
  if (value.getUTCMonth() !== month - 1 || value.getUTCDate() !== day) {
    context.addIssue({ code: "custom", path: ["profile", path], message: "Enter a valid month and day" });
  }
}
