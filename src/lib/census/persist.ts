import { prisma } from "@/lib/prisma";
import type { CensusNormalizeResult } from "./normalize";

export async function persistCensus(planYearId: string, result: CensusNormalizeResult) {
  await prisma.$transaction([
    prisma.dependent.deleteMany({ where: { employee: { planYearId } } }),
    prisma.benefitElection.deleteMany({ where: { employee: { planYearId } } }),
    prisma.employee.deleteMany({ where: { planYearId } }),
  ]);

  for (const employee of result.employees) {
    await prisma.employee.create({
      data: {
        planYearId,
        employeeNumber: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        birthDate: employee.birthDate,
        gender: employee.gender,
        hireDate: employee.hireDate,
        employmentStatus: employee.employmentStatus,
        baseSalary: employee.baseSalary,
        postalCode: employee.postalCode,
        dependents: {
          create: employee.dependents.map((dep) => ({
            firstName: dep.firstName,
            lastName: dep.lastName,
            birthDate: dep.birthDate,
            gender: dep.gender,
            relationshipType: dep.relationshipType,
          })),
        },
        elections: {
          create: employee.elections.map((el) => ({
            benefitType: el.benefitType,
            planName: el.planName,
            optionName: el.optionName,
            volume: el.volume,
          })),
        },
      },
    });
  }
}
