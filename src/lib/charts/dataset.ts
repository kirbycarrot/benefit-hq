import { prisma } from "@/lib/prisma";

async function loadCurrentPlanYear(planYearId: string) {
  const planYear = await prisma.planYear.findUniqueOrThrow({
    where: { id: planYearId },
    include: {
      employees: { include: { dependents: true, elections: true } },
      policyLines: { orderBy: { createdAt: "asc" } },
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
    },
  });
}

type CurrentPlanYear = Awaited<ReturnType<typeof loadCurrentPlanYear>>;
type PriorPlanYear = Awaited<ReturnType<typeof loadPriorPlanYear>>;

export type ChartDataset = CurrentPlanYear & {
  comparisonPlanYear?: PriorPlanYear;
};

export async function loadChartDataset(planYearId: string): Promise<ChartDataset> {
  const planYear = await loadCurrentPlanYear(planYearId);
  const comparisonPlanYear = await loadPriorPlanYear(
    planYear.clientId,
    planYear.effectiveDate
  );
  return { ...planYear, comparisonPlanYear };
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
