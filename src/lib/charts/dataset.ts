import { prisma } from "@/lib/prisma";

export async function loadChartDataset(planYearId: string) {
  const planYear = await prisma.planYear.findUniqueOrThrow({
    where: { id: planYearId },
    include: {
      employees: { include: { dependents: true, elections: true } },
      policyLines: { orderBy: { createdAt: "asc" } },
    },
  });

  return planYear;
}

export type ChartDataset = Awaited<ReturnType<typeof loadChartDataset>>;

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
