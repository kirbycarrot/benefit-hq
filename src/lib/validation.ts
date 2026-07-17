import { z } from "zod";

export const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex color like #1F2937");

export const clientSchema = z.object({
  name: z.string().min(1, "Client name is required").max(200),
  primaryColor: hexColor,
  secondaryColor: hexColor,
});

export const planYearSchema = z.object({
  label: z.string().min(1, "Label is required").max(100),
  effectiveDate: z.coerce.date({ message: "Enter a valid date" }),
});

export const COVERAGE_TYPES = [
  "Medical",
  "Dental",
  "Vision",
  "Life",
  "STD",
  "LTD",
] as const;

export const TIERS = ["EE", "EE+Spouse", "EE+Child", "Family"] as const;

export const TIER_LABELS: Record<(typeof TIERS)[number], string> = {
  EE: "Employee",
  "EE+Spouse": "Employee + Spouse",
  "EE+Child": "Employee + Child",
  Family: "Family",
};

export const RATE_PERIODS = ["monthly", "per-pay-period", "annual"] as const;

export const RATE_PERIOD_LABELS: Record<(typeof RATE_PERIODS)[number], string> = {
  monthly: "Monthly",
  "per-pay-period": "Per pay period",
  annual: "Annual",
};

export const ratePeriodSchema = z.object({
  ratePeriod: z.enum(RATE_PERIODS),
});

export const policyLineSchema = z.object({
  coverageType: z.enum(COVERAGE_TYPES),
  planName: z.string().min(1, "Plan name is required").max(200),
  tier: z.enum(TIERS),
  employeeCost: z.coerce.number().min(0).max(9_999_999.99),
  employerCost: z.coerce.number().min(0).max(9_999_999.99),
  ratePeriod: z.enum(RATE_PERIODS),
});

export function addCurrencyAmounts(left: number, right: number): number {
  return (Math.round(left * 100) + Math.round(right * 100)) / 100;
}

export const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  isAdmin: z.boolean().default(false),
});
