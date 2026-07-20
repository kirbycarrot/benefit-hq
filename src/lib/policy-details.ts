import { z } from "zod";
import { RATE_PERIODS } from "@/lib/validation";

export const BENEFIT_TYPES = [
  "Medical",
  "Dental",
  "Vision",
  "BasicLife",
  "VoluntaryLife",
  "STD",
  "LTD",
  "VoluntaryOfferings",
] as const;

export type BenefitType = (typeof BENEFIT_TYPES)[number];

export const BENEFIT_META: Record<
  BenefitType,
  { label: string; description: string; sortOrder: number }
> = {
  Medical: {
    label: "Medical",
    description: "HMO, PPO, and HSA-qualified HDHP plans",
    sortOrder: 10,
  },
  Dental: {
    label: "Dental",
    description: "DHMO and DPPO plans",
    sortOrder: 20,
  },
  Vision: {
    label: "Vision",
    description: "Vision rates, frequencies, copays, and allowances",
    sortOrder: 30,
  },
  BasicLife: {
    label: "Employer paid life",
    description: "Employer-sponsored life insurance by class",
    sortOrder: 40,
  },
  VoluntaryLife: {
    label: "Voluntary life",
    description: "Employee, spouse, and child voluntary coverage",
    sortOrder: 50,
  },
  STD: {
    label: "Short-term disability",
    description: "STD provisions by employee class",
    sortOrder: 60,
  },
  LTD: {
    label: "Long-term disability",
    description: "LTD provisions by employee class",
    sortOrder: 70,
  },
  VoluntaryOfferings: {
    label: "Voluntary Plan Offerings",
    description: "Additional voluntary and supplemental benefits offered to employees",
    sortOrder: 80,
  },
};

export const PLAN_SUBTYPES: Record<BenefitType, readonly string[]> = {
  Medical: ["HMO", "PPO", "HDHP"],
  Dental: ["DHMO", "DPPO"],
  Vision: ["Vision"],
  BasicLife: ["Basic Life"],
  VoluntaryLife: ["Employee", "Spouse", "Child"],
  STD: ["STD"],
  LTD: ["LTD"],
  VoluntaryOfferings: ["Voluntary Offerings"],
};

// Displayed in place of a stored subtype value without changing the value
// itself, so existing plan records and census alias matching are unaffected.
const SUBTYPE_DISPLAY_LABELS: Record<string, string> = {
  "Basic Life": "Employer Paid Life",
};

export function subtypeDisplayLabel(subtype: string): string {
  return SUBTYPE_DISPLAY_LABELS[subtype] ?? subtype;
}

export const VOLUNTARY_PLAN_OFFERINGS = [
  { key: "accident", label: "Accident" },
  { key: "cancerCriticalIllness", label: "Cancer / Critical Illness" },
  { key: "hospitalIndemnity", label: "Hospital indemnity" },
  { key: "vision", label: "Vision" },
  { key: "individualDisabilityInsurance", label: "Individual Disability Insurance" },
  { key: "wholeUniversalLife", label: "Whole / Universal Life" },
  { key: "longTermCare", label: "Long-Term Care" },
  { key: "autoHomeowners", label: "Auto / Homeowners" },
  { key: "idTheft", label: "ID Theft" },
  { key: "legalBenefits", label: "Legal Benefits" },
  { key: "discountPurchaseProgram", label: "Discount Purchase Program" },
  {
    key: "studentLoanRefinancingRepayment",
    label: "Student Loan Refinancing / Repayment",
  },
  { key: "petInsurance", label: "Pet Insurance" },
  { key: "lifestyleSpendingAccount", label: "Lifestyle Spending Account" },
] as const;

export const VOLUNTARY_OFFERINGS_PLAN_NAME = "Additional Benefits Offered";
export const VOLUNTARY_OFFERINGS_PLAN_SUBTYPE = "Voluntary Offerings";

export const RATE_BENEFIT_TYPES = ["Medical", "Dental", "Vision"] as const;

export type RateBenefitType = (typeof RATE_BENEFIT_TYPES)[number];

export const TIER_CODES = [
  "EE",
  "EE+Spouse",
  "EE+Child",
  "Family",
  "EE+Dependent",
  "EE+Family",
] as const;

export type PolicyTierCode = (typeof TIER_CODES)[number];

export const POLICY_TIER_LABELS: Record<PolicyTierCode, string> = {
  EE: "Employee",
  "EE+Spouse": "Employee + Spouse",
  "EE+Child": "Employee + Child(ren)",
  Family: "Family",
  "EE+Dependent": "Employee + Dependent",
  "EE+Family": "Employee + Family",
};

export const TIER_TEMPLATES = {
  "four-tier": ["EE", "EE+Spouse", "EE+Child", "Family"],
  "three-tier": ["EE", "EE+Dependent", "Family"],
  "two-tier": ["EE", "EE+Family"],
} as const satisfies Record<string, readonly PolicyTierCode[]>;

export type TierTemplate = keyof typeof TIER_TEMPLATES;

export const TIER_TEMPLATE_LABELS: Record<TierTemplate, string> = {
  "four-tier": "Four tier",
  "three-tier": "Three tier",
  "two-tier": "Two tier",
};

export type PolicyDetailValue = string | number | boolean | null;
export type PolicyPlanDetails = Record<string, PolicyDetailValue>;

export type PolicyDetailField = {
  key: string;
  label: string;
  type: "text" | "select" | "currency" | "number" | "percent";
  max?: number;
  options?: readonly string[];
  help?: string;
  suffix?: string;
  subtypes?: readonly string[];
  showWhen?: { key: string; equals: PolicyDetailValue };
};

export type PolicyDetailGroup = {
  key: string;
  label: string;
  description?: string;
  fields: readonly PolicyDetailField[];
};

export type PolicyDetailSummaryItem = {
  key: string;
  label: string;
  value: string;
};

export type PolicyDetailSummaryGroup = {
  key: string;
  label: string;
  items: PolicyDetailSummaryItem[];
};

export const POLICY_DETAIL_GROUPS: Record<BenefitType, readonly PolicyDetailGroup[]> = {
  Medical: [
    {
      key: "funding",
      label: "Funding arrangement",
      fields: [
        {
          key: "fundingArrangement",
          label: "Arrangement",
          type: "select",
          options: ["Fully Insured", "Self-Funded", "Level-Funded", "Other"],
        },
        {
          key: "islDeductible",
          label: "Individual stop-loss deductible",
          type: "currency",
          showWhen: { key: "fundingArrangement", equals: "Self-Funded" },
        },
        {
          key: "aggregatingSpecific",
          label: "Aggregating specific deductible",
          type: "currency",
          showWhen: { key: "fundingArrangement", equals: "Self-Funded" },
        },
        {
          key: "aggregateCorridor",
          label: "Aggregate corridor",
          type: "percent",
          max: 500,
          help: "Aggregate stop-loss corridors commonly exceed 100% (for example, 125%).",
          showWhen: { key: "fundingArrangement", equals: "Self-Funded" },
        },
        {
          key: "islCompositeRate",
          label: "ISL composite rate",
          type: "currency",
          showWhen: { key: "fundingArrangement", equals: "Self-Funded" },
        },
        {
          key: "aslCompositeRate",
          label: "ASL composite rate",
          type: "currency",
          showWhen: { key: "fundingArrangement", equals: "Self-Funded" },
        },
      ],
    },
    {
      key: "design",
      label: "Plan design attributes",
      fields: [
        { key: "actuarialValue", label: "Actuarial value", type: "percent" },
        { key: "deductibleIndividual", label: "Individual deductible", type: "currency" },
        { key: "deductibleFamily", label: "Family deductible", type: "currency" },
        { key: "memberCoinsurance", label: "Member coinsurance", type: "percent" },
        { key: "oopMaximumIndividual", label: "Individual out-of-pocket maximum", type: "currency" },
        { key: "oopMaximumFamily", label: "Family out-of-pocket maximum", type: "currency" },
      ],
    },
    {
      key: "copays",
      label: "Network copays",
      description: "Shown for HMO and traditional PPO plans.",
      fields: [
        { key: "primaryCareCopay", label: "Physician office visit", type: "currency", subtypes: ["HMO", "PPO"] },
        { key: "specialistCopay", label: "Specialist visit", type: "currency", subtypes: ["HMO", "PPO"] },
        { key: "urgentCareCopay", label: "Urgent care", type: "currency", subtypes: ["HMO", "PPO"] },
        { key: "emergencyRoomCopay", label: "Emergency room", type: "currency", subtypes: ["HMO", "PPO"] },
      ],
    },
    {
      key: "pharmacy",
      label: "Pharmacy copays",
      description: "Retail, 30-day supply.",
      fields: [
        { key: "genericCopay", label: "Generic", type: "currency", subtypes: ["HMO", "PPO"] },
        { key: "formularyBrandCopay", label: "Formulary brand", type: "currency", subtypes: ["HMO", "PPO"] },
        { key: "nonFormularyBrandCopay", label: "Non-formulary brand", type: "currency", subtypes: ["HMO", "PPO"] },
        { key: "specialtyCopay", label: "Specialty", type: "currency", subtypes: ["HMO", "PPO"] },
      ],
    },
    {
      key: "hsa",
      label: "Employer-funded HSA",
      description: "Maximum annual employer contribution.",
      fields: [
        { key: "hsaContributionEE", label: "Employee", type: "currency", subtypes: ["HDHP"] },
        { key: "hsaContributionSpouse", label: "Employee + Spouse", type: "currency", subtypes: ["HDHP"] },
        { key: "hsaContributionChild", label: "Employee + Child(ren)", type: "currency", subtypes: ["HDHP"] },
        { key: "hsaContributionFamily", label: "Family", type: "currency", subtypes: ["HDHP"] },
      ],
    },
  ],
  Dental: [
    {
      key: "dental-design",
      label: "DPPO plan design attributes",
      fields: [
        { key: "deductibleIndividual", label: "Individual deductible", type: "currency", subtypes: ["DPPO"] },
        { key: "deductibleFamily", label: "Family deductible", type: "currency", subtypes: ["DPPO"] },
        { key: "preventiveCoinsurance", label: "Preventive coinsurance", type: "percent", subtypes: ["DPPO"] },
        { key: "basicCoinsurance", label: "Basic coinsurance", type: "percent", subtypes: ["DPPO"] },
        { key: "majorCoinsurance", label: "Major coinsurance", type: "percent", subtypes: ["DPPO"] },
        { key: "annualMaximum", label: "Annual maximum", type: "currency", subtypes: ["DPPO"] },
        {
          key: "orthodontiaOffered",
          label: "Orthodontia",
          type: "select",
          options: ["N/A", "Child Only", "All Members", "Other"],
          subtypes: ["DPPO"],
        },
        { key: "orthodontiaCoinsurance", label: "Orthodontia coinsurance", type: "percent", subtypes: ["DPPO"] },
        { key: "orthodontiaLifetimeMaximum", label: "Orthodontia lifetime maximum", type: "currency", subtypes: ["DPPO"] },
      ],
    },
  ],
  Vision: [
    {
      key: "vision-design",
      label: "Vision plan design attributes",
      fields: [
        { key: "examFrequencyMonths", label: "Exam frequency", type: "number", suffix: "months" },
        { key: "lensesFrequencyMonths", label: "Lenses frequency", type: "number", suffix: "months" },
        { key: "framesFrequencyMonths", label: "Frames frequency", type: "number", suffix: "months" },
        { key: "examCopay", label: "Exam copay", type: "currency" },
        { key: "materialsCopay", label: "Materials copay", type: "currency" },
        { key: "framesAllowance", label: "Frames allowance", type: "currency" },
        { key: "contactsAllowance", label: "Contacts allowance", type: "currency" },
      ],
    },
  ],
  BasicLife: [
    {
      key: "basic-life",
      label: "Employer paid life provisions",
      fields: [
        {
          key: "benefitFormula",
          label: "Benefit formula",
          type: "select",
          options: ["Flat Amount", "X Salary", "Other", "Not Offered"],
        },
        {
          key: "salaryMultiplier",
          label: "Salary multiplier",
          type: "number",
          suffix: "× salary",
          showWhen: { key: "benefitFormula", equals: "X Salary" },
        },
        { key: "maximumAmount", label: "Maximum amount", type: "currency" },
        { key: "guaranteeIssue", label: "Guarantee issue", type: "currency" },
        { key: "volume", label: "Volume", type: "currency", help: "Total insured volume, typically supplied by the census." },
        { key: "rate", label: "Rate", type: "currency" },
        { key: "rateBasis", label: "Rate basis", type: "number", help: "Premium = (Volume ÷ Rate basis) × Rate." },
        { key: "annualPremium", label: "Annual premium", type: "currency" },
        { key: "enrollment", label: "Enrollment", type: "number" },
      ],
    },
  ],
  VoluntaryLife: [
    {
      key: "voluntary-life",
      label: "Voluntary life provisions",
      fields: [
        { key: "maximumAmount", label: "Maximum amount", type: "currency" },
        { key: "guaranteeIssue", label: "Guarantee issue", type: "currency" },
        { key: "volume", label: "Volume", type: "currency", help: "Total insured volume, typically supplied by the census." },
        { key: "rate", label: "Rate", type: "currency" },
        { key: "rateBasis", label: "Rate basis", type: "number", help: "Premium = (Volume ÷ Rate basis) × Rate." },
        { key: "annualPremium", label: "Annual premium", type: "currency" },
        { key: "enrollment", label: "Enrollment", type: "number" },
      ],
    },
  ],
  STD: [
    {
      key: "std",
      label: "Short-term disability provisions",
      fields: [
        { key: "subsidy", label: "Subsidy", type: "select", options: ["Employer paid", "Voluntary"] },
        { key: "eliminationPeriodAccident", label: "Elimination period — accident", type: "number", suffix: "days" },
        { key: "eliminationPeriodSickness", label: "Elimination period — sickness", type: "number", suffix: "days" },
        { key: "benefitPercentage", label: "Benefit percentage", type: "percent" },
        { key: "maximumBenefit", label: "Maximum weekly benefit", type: "currency" },
        { key: "benefitPeriodWeeks", label: "Benefit duration", type: "number", suffix: "weeks, including EP" },
        { key: "volume", label: "Volume", type: "currency", help: "Total covered weekly benefit or payroll, typically supplied by the census." },
        { key: "rate", label: "Rate", type: "currency" },
        { key: "rateBasis", label: "Rate basis", type: "number", help: "Premium = (Volume ÷ Rate basis) × Rate." },
        { key: "annualPremium", label: "Annual premium", type: "currency" },
        { key: "enrollment", label: "Enrollment", type: "number" },
      ],
    },
  ],
  LTD: [
    {
      key: "ltd",
      label: "Long-term disability provisions",
      fields: [
        { key: "subsidy", label: "Subsidy", type: "select", options: ["Employer paid", "Voluntary"] },
        { key: "eliminationPeriod", label: "Elimination period", type: "number", suffix: "days" },
        { key: "benefitPercentage", label: "Benefit percentage", type: "percent" },
        { key: "maximumBenefit", label: "Maximum monthly benefit", type: "currency" },
        { key: "benefitPeriod", label: "Benefit duration", type: "text", help: "The workbook assumes SSNRA / age 65." },
        { key: "volume", label: "Volume", type: "currency", help: "Total covered monthly benefit or payroll, typically supplied by the census." },
        { key: "rate", label: "Rate", type: "currency" },
        { key: "rateBasis", label: "Rate basis", type: "number", help: "Premium = (Volume ÷ Rate basis) × Rate." },
        { key: "annualPremium", label: "Annual premium", type: "currency" },
        { key: "enrollment", label: "Enrollment", type: "number" },
      ],
    },
  ],
  VoluntaryOfferings: [],
};

const emptyStringToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const planRateInputSchema = z
  .object({
    id: z.string().min(1).optional(),
    tier: z.enum(TIER_CODES),
    grossPremium: z.coerce.number().min(0).max(9_999_999.99),
    employeeContribution: z.coerce.number().min(0).max(9_999_999.99),
    ratePeriod: z.enum(RATE_PERIODS),
    enrollmentOverride: z.preprocess(
      emptyStringToUndefined,
      z.coerce.number().int().min(0).max(10_000_000).optional()
    ),
    sortOrder: z.coerce.number().int().min(0).max(10_000),
  })
  .refine((rate) => rate.employeeContribution <= rate.grossPremium, {
    message: "Employee contribution cannot exceed gross premium",
    path: ["employeeContribution"],
  });

const detailValueSchema = z.union([
  z.string().max(1_000),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

// Free-form label/value pairs a consultant can attach to a plan purely for
// internal reference. Not read by chart computation or deck generation.
export const customAttributeSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(100),
  value: z.string().trim().max(500),
});

export type CustomPlanAttribute = z.infer<typeof customAttributeSchema>;

export const benefitPlanInputSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1, "Plan or class name is required").max(200),
  carrierName: z.string().trim().max(200).nullable().optional(),
  subtype: z.string().trim().min(1).max(100),
  offered: z.boolean(),
  details: z.record(z.string().min(1).max(100), detailValueSchema),
  customAttributes: z.array(customAttributeSchema).max(20).default([]),
  detailSchemaVersion: z.literal(1).default(1),
  renewedFromPlanId: z.string().min(1).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
  aliases: z.array(z.string().trim().min(1).max(200)).max(30),
  rates: z.array(planRateInputSchema).max(20),
});

export const benefitProgramInputSchema = z
  .object({
    benefitType: z.enum(BENEFIT_TYPES),
    offered: z.boolean(),
    plans: z.array(benefitPlanInputSchema).max(100),
  })
  .superRefine((program, context) => {
    const allowedSubtypes = PLAN_SUBTYPES[program.benefitType];
    const seenNames = new Set<string>();
    const aliasOwners = new Map<string, number>();

    program.plans.forEach((plan, planIndex) => {
      if (!allowedSubtypes.includes(plan.subtype)) {
        context.addIssue({
          code: "custom",
          message: `Unsupported ${BENEFIT_META[program.benefitType].label} plan type`,
          path: ["plans", planIndex, "subtype"],
        });
      }

      const normalizedName = normalizePolicyName(plan.name);
      if (seenNames.has(normalizedName)) {
        context.addIssue({
          code: "custom",
          message: "Plan or class names must be unique within a benefit",
          path: ["plans", planIndex, "name"],
        });
      }
      seenNames.add(normalizedName);

      [plan.name, ...plan.aliases].forEach((alias, aliasIndex) => {
        const normalizedAlias = normalizePolicyName(alias);
        const owner = aliasOwners.get(normalizedAlias);
        if (owner !== undefined && owner !== planIndex) {
          context.addIssue({
            code: "custom",
            message: "Plan names and census aliases must be unique within a benefit",
            path:
              aliasIndex === 0
                ? ["plans", planIndex, "name"]
                : ["plans", planIndex, "aliases", aliasIndex - 1],
          });
        } else if (normalizedAlias) {
          aliasOwners.set(normalizedAlias, planIndex);
        }
      });

      const seenTiers = new Set<string>();
      plan.rates.forEach((rate, rateIndex) => {
        if (seenTiers.has(rate.tier)) {
          context.addIssue({
            code: "custom",
            message: "A plan cannot contain duplicate rate tiers",
            path: ["plans", planIndex, "rates", rateIndex, "tier"],
          });
        }
        seenTiers.add(rate.tier);
      });

      if (!RATE_BENEFIT_TYPES.includes(program.benefitType as RateBenefitType) && plan.rates.length > 0) {
        context.addIssue({
          code: "custom",
          message: "This benefit stores provisions rather than tiered rates",
          path: ["plans", planIndex, "rates"],
        });
      }

      validateDetailValues(program.benefitType, plan, planIndex, context);
    });
  });

function validateDetailValues(
  benefitType: BenefitType,
  plan: z.infer<typeof benefitPlanInputSchema>,
  planIndex: number,
  context: z.RefinementCtx
) {
  const visibleFields = POLICY_DETAIL_GROUPS[benefitType]
    .flatMap((group) => group.fields)
    .filter((field) => !field.subtypes || field.subtypes.includes(plan.subtype));

  for (const field of visibleFields) {
    const value = plan.details[field.key];
    if (value === undefined || value === null || value === "") continue;

    if (["currency", "number", "percent"].includes(field.type)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        context.addIssue({
          code: "custom",
          message: `${field.label} must be a non-negative number`,
          path: ["plans", planIndex, "details", field.key],
        });
      }
    }
    const maximumPercent = field.max ?? 100;
    if (
      field.type === "percent" &&
      typeof value === "number" &&
      value > maximumPercent
    ) {
      context.addIssue({
        code: "custom",
        message: `${field.label} cannot exceed ${maximumPercent}%`,
        path: ["plans", planIndex, "details", field.key],
      });
    }
  }
}

export type PolicyRateInput = z.infer<typeof planRateInputSchema>;
export type PolicyPlanInput = z.infer<typeof benefitPlanInputSchema>;
export type PolicyProgramInput = z.infer<typeof benefitProgramInputSchema>;

export type PolicyReadinessIssue = {
  severity: "error" | "warning";
  benefitType: BenefitType;
  planName?: string;
  message: string;
};

export type CensusPlanSuggestion = {
  benefitType: RateBenefitType;
  planName: string;
  subtype: string;
  tierEnrollments: Partial<Record<PolicyTierCode, number>>;
};

export function policyReadinessIssues(programs: readonly PolicyProgramInput[]): PolicyReadinessIssue[] {
  const issues: PolicyReadinessIssue[] = [];

  for (const program of programs) {
    if (program.offered && program.plans.filter((plan) => plan.offered).length === 0) {
      issues.push({
        severity: "error",
        benefitType: program.benefitType,
        message: "This benefit is offered but has no active plans or classes.",
      });
    }

    if (!program.offered) continue;

    for (const plan of program.plans.filter((item) => item.offered)) {
      if (RATE_BENEFIT_TYPES.includes(program.benefitType as RateBenefitType)) {
        if (plan.rates.length === 0) {
          issues.push({
            severity: "error",
            benefitType: program.benefitType,
            planName: plan.name,
            message: "Add at least one rate tier.",
          });
        } else if (plan.rates.every((rate) => rate.grossPremium === 0)) {
          issues.push({
            severity: "warning",
            benefitType: program.benefitType,
            planName: plan.name,
            message: "All gross premiums are currently zero.",
          });
        }
      }

      const deductibleIndividual = numericDetail(plan.details, "deductibleIndividual");
      const deductibleFamily = numericDetail(plan.details, "deductibleFamily");
      if (
        deductibleIndividual !== null &&
        deductibleFamily !== null &&
        deductibleFamily < deductibleIndividual
      ) {
        issues.push({
          severity: "warning",
          benefitType: program.benefitType,
          planName: plan.name,
          message: "Family deductible is below the individual deductible.",
        });
      }

      const oopIndividual = numericDetail(plan.details, "oopMaximumIndividual");
      if (
        oopIndividual !== null &&
        deductibleIndividual !== null &&
        oopIndividual < deductibleIndividual
      ) {
        issues.push({
          severity: "error",
          benefitType: program.benefitType,
          planName: plan.name,
          message: "Individual out-of-pocket maximum is below the deductible.",
        });
      }

      if (
        program.benefitType === "Medical" &&
        plan.details.fundingArrangement === "Self-Funded" &&
        numericDetail(plan.details, "islDeductible") === null
      ) {
        issues.push({
          severity: "warning",
          benefitType: program.benefitType,
          planName: plan.name,
          message: "Self-funded plan does not include an individual stop-loss deductible.",
        });
      }
    }
  }

  return issues;
}

export function normalizePolicyName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function policyTierFromCensusOption(optionName: string | null): PolicyTierCode {
  const text = (optionName ?? "").toLowerCase();
  const hasSpouse = /spouse|[/+\- ]sp\b/.test(text);
  const hasChild = /child|[/+\- ]ch\b/.test(text);
  if (text.includes("family") || (hasSpouse && hasChild)) return "Family";
  if (hasSpouse) return "EE+Spouse";
  if (hasChild) return "EE+Child";
  return "EE";
}

export function inferPlanSubtype(benefitType: RateBenefitType, planName: string): string {
  const text = planName.toLowerCase();
  if (benefitType === "Medical") {
    if (/hdhp|hsa/.test(text)) return "HDHP";
    if (/hmo/.test(text)) return "HMO";
    return "PPO";
  }
  if (benefitType === "Dental") {
    return /dhmo|dental hmo|\bhmo\b/.test(text) ? "DHMO" : "DPPO";
  }
  return "Vision";
}

export function isRateBenefitType(value: BenefitType): value is RateBenefitType {
  return RATE_BENEFIT_TYPES.includes(value as RateBenefitType);
}

export function selectedVoluntaryPlanOfferings(details: unknown): string[] {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];
  const values = details as Record<string, unknown>;
  return VOLUNTARY_PLAN_OFFERINGS.filter((offering) => values[offering.key] === true).map(
    (offering) => offering.label
  );
}

export function numericDetail(details: PolicyPlanDetails, key: string): number | null {
  const value = details[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export const ANCILLARY_VOLUME_BENEFIT_TYPES = ["BasicLife", "VoluntaryLife", "STD", "LTD"] as const;
export type AncillaryVolumeBenefitType = (typeof ANCILLARY_VOLUME_BENEFIT_TYPES)[number];

export function isAncillaryVolumeBenefitType(
  value: BenefitType
): value is AncillaryVolumeBenefitType {
  return (ANCILLARY_VOLUME_BENEFIT_TYPES as readonly string[]).includes(value);
}

// Rate basis conventions vary by carrier; these are starting defaults applied
// when a new plan is created, and can be edited per plan. Life/AD&D is almost
// universally quoted per $1,000 of volume; STD/LTD rate bases are less
// consistent across carriers (per $10 of weekly benefit, per $100 of covered
// payroll, etc.), so $100 is an assumption to confirm against the carrier's
// actual rate basis rather than a settled convention.
export const DEFAULT_RATE_BASIS: Record<AncillaryVolumeBenefitType, number> = {
  BasicLife: 1000,
  VoluntaryLife: 1000,
  STD: 100,
  LTD: 100,
};

// Maps a policy benefit type onto the literal `BenefitElection.benefitType`
// string produced by census normalization (src/lib/census/normalize.ts), so
// ancillary plan volume can be suggested from imported census elections.
export const CENSUS_ELECTION_BENEFIT_TYPE: Record<AncillaryVolumeBenefitType, string> = {
  BasicLife: "Life",
  VoluntaryLife: "VoluntaryLife",
  STD: "STD",
  LTD: "LTD",
};

/** Premium = (Volume ÷ Rate basis) × Rate, the standard ancillary-line rating convention. */
export function computeAncillaryPremium(details: PolicyPlanDetails): number | null {
  const volume = numericDetail(details, "volume");
  const rate = numericDetail(details, "rate");
  const rateBasis = numericDetail(details, "rateBasis");
  if (volume === null || rate === null || !rateBasis) return null;
  return Math.round((volume / rateBasis) * rate * 100) / 100;
}

/**
 * Rough actuarial-value estimate from deductible, coinsurance, and
 * out-of-pocket maximum — the three inputs that drive most of AV in
 * practice. This is NOT the official CMS AV Calculator (which uses a
 * continuance-table methodology) or a specific named proprietary formula;
 * it is a simplified approximation meant to give a directional starting
 * value, and should be checked against the carrier's filed AV or the CMS
 * calculator before being relied on.
 */
export function estimateActuarialValue(details: PolicyPlanDetails): number | null {
  const coinsurance = numericDetail(details, "memberCoinsurance");
  const deductibleIndividual = numericDetail(details, "deductibleIndividual");
  const oopMaximumIndividual = numericDetail(details, "oopMaximumIndividual");
  if (coinsurance === null || deductibleIndividual === null || oopMaximumIndividual === null) {
    return null;
  }

  const payerShare = 1 - coinsurance / 100;
  const deductibleDrag = clamp(deductibleIndividual / 20_000, 0, 0.15);
  const oopDrag = clamp(oopMaximumIndividual / 40_000, 0, 0.08);
  const estimate = payerShare - deductibleDrag - oopDrag + 0.05;
  return Math.round(clamp(estimate, 0.5, 0.98) * 1000) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function visibleDetailGroups(benefitType: BenefitType, plan: PolicyPlanInput) {
  return POLICY_DETAIL_GROUPS[benefitType]
    .map((group) => ({
      ...group,
      fields: group.fields.filter(
        (field) =>
          (!field.subtypes || field.subtypes.includes(plan.subtype)) &&
          (!field.showWhen || plan.details[field.showWhen.key] === field.showWhen.equals)
      ),
    }))
    .filter((group) => group.fields.length > 0);
}

export function policyDetailSummaryGroups(
  benefitType: BenefitType,
  subtype: string,
  details: PolicyPlanDetails
): PolicyDetailSummaryGroup[] {
  const groups = POLICY_DETAIL_GROUPS[benefitType]
    .map((group) => ({
      key: group.key,
      label: group.label,
      items: group.fields
        .filter(
          (field) =>
            (!field.subtypes || field.subtypes.includes(subtype)) &&
            (!field.showWhen || details[field.showWhen.key] === field.showWhen.equals)
        )
        .flatMap((field) => {
          const value = details[field.key];
          if (value === undefined || value === null || value === "") return [];
          return [{ key: field.key, label: field.label, value: formatPolicyDetailValue(field, value) }];
        }),
    }))
    .filter((group) => group.items.length > 0);

  const notes = details.notes;
  if (typeof notes === "string" && notes.trim()) {
    groups.push({
      key: "notes",
      label: "Plan notes",
      items: [{ key: "notes", label: "Notes", value: notes.trim() }],
    });
  }

  return groups;
}

function formatPolicyDetailValue(
  field: PolicyDetailField,
  value: PolicyDetailValue
): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  if (typeof value !== "number") return "—";

  if (field.type === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (field.type === "percent") {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}%`;
  }

  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  return field.suffix ? `${formatted} ${field.suffix}` : formatted;
}
