import { prisma } from "@/lib/prisma";
import {
  BENEFIT_META,
  policyDetailSummaryGroups,
  type BenefitType,
  type PolicyDetailSummaryGroup,
  type PolicyPlanDetails,
} from "@/lib/policy-details";

async function loadCurrentPlanYear(planYearId: string) {
  const planYear = await prisma.planYear.findUniqueOrThrow({
    where: { id: planYearId },
    include: {
      employees: { include: { dependents: true, elections: true } },
      policyLines: { orderBy: { createdAt: "asc" } },
      benefitPrograms: {
        orderBy: { sortOrder: "asc" },
        include: {
          plans: {
            where: { offered: true },
            orderBy: { sortOrder: "asc" },
            include: {
              rates: { orderBy: { sortOrder: "asc" } },
              aliases: { orderBy: { createdAt: "asc" } },
            },
          },
        },
      },
      client: {
        select: {
          profile: {
            select: { budgetTarget: true, maximumAcceptableIncrease: true },
          },
        },
      },
    },
  });

  return planYear;
}

async function loadPriorPlanYear(clientId: string, effectiveDate: Date) {
  return prisma.planYear.findFirst({
    where: {
      clientId,
      effectiveDate: { lt: effectiveDate },
    },
    orderBy: { effectiveDate: "desc" },
    select: {
      id: true,
      label: true,
      effectiveDate: true,
      policyLines: { orderBy: { createdAt: "asc" } },
      benefitPrograms: {
        where: { offered: true },
        orderBy: { sortOrder: "asc" },
        include: {
          plans: {
            where: { offered: true },
            orderBy: { sortOrder: "asc" },
            include: {
              rates: { orderBy: { sortOrder: "asc" } },
              aliases: { orderBy: { createdAt: "asc" } },
            },
          },
        },
      },
    },
  });
}

type CurrentPlanYear = Awaited<ReturnType<typeof loadCurrentPlanYear>>;
type PriorPlanYear = Awaited<ReturnType<typeof loadPriorPlanYear>>;
type LoadedPolicyLine = CurrentPlanYear["policyLines"][number];

export type ChartPolicyLine = LoadedPolicyLine & {
  planId?: string;
  renewedFromPlanId?: string | null;
  aliases?: string[];
  enrollmentOverride?: number | null;
};

export type ChartPlanDesign = {
  benefitType: BenefitType;
  benefitLabel: string;
  planName: string;
  subtype: string;
  groups: PolicyDetailSummaryGroup[];
};

type ChartPlanYearCore = Omit<
  CurrentPlanYear,
  "benefitPrograms" | "policyLines" | "client"
>;
type ChartPriorPlanYear = Omit<
  NonNullable<PriorPlanYear>,
  "benefitPrograms" | "policyLines"
> & {
  policyLines: ChartPolicyLine[];
};

export type ChartRenewalTargets = {
  budgetTarget: number | null;
  maximumAcceptableIncrease: number | null;
};

export type ChartDataset = ChartPlanYearCore & {
  policyLines: ChartPolicyLine[];
  planDesigns: ChartPlanDesign[];
  comparisonPlanYear?: ChartPriorPlanYear | null;
  renewalTargets: ChartRenewalTargets;
};

export async function loadChartDataset(planYearId: string): Promise<ChartDataset> {
  const planYear = await loadCurrentPlanYear(planYearId);
  const comparisonPlanYear = await loadPriorPlanYear(
    planYear.clientId,
    planYear.effectiveDate
  );
  const { benefitPrograms, policyLines, client, ...planYearCore } = planYear;
  const renewalTargets: ChartRenewalTargets = {
    budgetTarget: client.profile?.budgetTarget?.toNumber() ?? null,
    maximumAcceptableIncrease: client.profile?.maximumAcceptableIncrease?.toNumber() ?? null,
  };
  const currentLines = effectivePolicyLines(planYear.id, policyLines, benefitPrograms);
  const planDesigns = benefitPrograms
    .filter(
      (program) =>
        program.offered && program.benefitType !== "VoluntaryOfferings"
    )
    .flatMap((program) => {
      const benefitType = program.benefitType as BenefitType;
      return program.plans.flatMap((plan) => {
        const groups = policyDetailSummaryGroups(
          benefitType,
          plan.subtype,
          plan.details as PolicyPlanDetails
        );
        return groups.length > 0
          ? [
              {
                benefitType,
                benefitLabel: BENEFIT_META[benefitType].label,
                planName: plan.name,
                subtype: plan.subtype,
                groups,
              },
            ]
          : [];
      });
    });
  const normalizedPrior = comparisonPlanYear
    ? (() => {
        const { benefitPrograms: priorPrograms, policyLines: priorLines, ...priorCore } =
          comparisonPlanYear;
        return {
          ...priorCore,
          policyLines: effectivePolicyLines(
            comparisonPlanYear.id,
            priorLines,
            priorPrograms
          ),
        };
      })()
    : null;
  return {
    ...planYearCore,
    policyLines: currentLines,
    planDesigns,
    comparisonPlanYear: normalizedPrior,
    renewalTargets,
  };
}

function effectivePolicyLines(
  planYearId: string,
  legacyLines: LoadedPolicyLine[],
  programs: CurrentPlanYear["benefitPrograms"]
): ChartPolicyLine[] {
  const structuredLines: ChartPolicyLine[] = programs
    .filter((program) => program.offered)
    .flatMap((program) =>
      program.plans.flatMap((plan) =>
        plan.rates.map((rate) => ({
          id: rate.id,
          planYearId,
          coverageType: program.benefitType === "BasicLife" ? "Life" : program.benefitType,
          planName: plan.name,
          tier: rate.tier,
          employeeCost: rate.employeeContribution,
          employerCost: rate.employerContribution,
          totalPremium: rate.grossPremium,
          ratePeriod: rate.ratePeriod,
          sortOrder: program.sortOrder * 10_000 + plan.sortOrder * 100 + rate.sortOrder,
          createdAt: rate.createdAt,
          planId: plan.id,
          renewedFromPlanId: plan.renewedFromPlanId,
          aliases: plan.aliases.map((alias) => alias.alias),
          enrollmentOverride: rate.enrollmentOverride,
        }))
      )
    );

  return structuredLines.length > 0 ? structuredLines : legacyLines;
}

export function ageInYears(birthDate: Date | null, asOf: Date): number | null {
  if (!birthDate) return null;
  const ms = asOf.getTime() - birthDate.getTime();
  return ms / (365.25 * 24 * 60 * 60 * 1000);
}

export function tenureInYears(hireDate: Date | null, asOf: Date): number | null {
  if (!hireDate) return null;
  const ms = asOf.getTime() - hireDate.getTime();
  return ms / (365.25 * 24 * 60 * 60 * 1000);
}
