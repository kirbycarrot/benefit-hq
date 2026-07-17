import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { CensusNormalizeResult } from "./normalize";

export type CensusUploadMetadata = {
  filenames: string[];
};

type TransactionRunner = Pick<typeof prisma, "$transaction">;

async function replaceCensus(
  tx: Prisma.TransactionClient,
  planYearId: string,
  result: CensusNormalizeResult,
  metadata: CensusUploadMetadata
) {
  // PostgreSQL transaction-scoped advisory locks serialize replacements for a
  // plan year without exposing an empty or partially imported census.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${planYearId}, 0))`;

  // Dependents and elections are removed by their ON DELETE CASCADE foreign
  // keys. Keeping the replacement inside this transaction preserves the old
  // census if any new row fails to insert.
  await tx.employee.deleteMany({ where: { planYearId } });

  for (const employee of result.employees) {
    await tx.employee.create({
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

  return tx.censusUpload.create({
    data: {
      planYearId,
      filenames: metadata.filenames,
      status: "committed",
      warnings: result.warnings,
      summary: result.summary,
    },
  });
}

export async function persistCensus(
  planYearId: string,
  result: CensusNormalizeResult,
  metadata: CensusUploadMetadata,
  client: TransactionRunner = prisma
) {
  return client.$transaction(
    (tx) => replaceCensus(tx, planYearId, result, metadata),
    {
      maxWait: 10_000,
      timeout: 120_000,
    }
  );
}
