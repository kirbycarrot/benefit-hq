import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { acquireAdvisoryTransactionLock } from "@/lib/advisory-lock";
import type { CensusNormalizeResult } from "./normalize";
import { zipToState } from "./zipToState";
import { US_STATES } from "@/lib/client-onboarding";

const VALID_STATE_CODES = new Set<string>(US_STATES.map(([code]) => code));

function resolveEmployeeState(
  employee: CensusNormalizeResult["employees"][number]
): string | undefined {
  const explicit = employee.state?.trim().toUpperCase();
  if (explicit && VALID_STATE_CODES.has(explicit)) return explicit;
  return zipToState(employee.postalCode);
}

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
  await acquireAdvisoryTransactionLock(tx, planYearId);

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

  await syncStatesWithEmployees(tx, planYearId, result.employees);

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

// Infers states from employee ZIP codes and folds any newly-seen states into
// the client's profile. Existing entries (including ones added manually for
// states with no census-eligible employees yet) are never removed here.
async function syncStatesWithEmployees(
  tx: Prisma.TransactionClient,
  planYearId: string,
  employees: CensusNormalizeResult["employees"]
) {
  const derivedStates = new Set(
    employees
      .map((employee) => resolveEmployeeState(employee))
      .filter((state): state is string => Boolean(state))
  );
  if (derivedStates.size === 0) return;

  const planYear = await tx.planYear.findUnique({
    where: { id: planYearId },
    select: { clientId: true },
  });
  if (!planYear) return;

  const profile = await tx.clientProfile.findUnique({
    where: { clientId: planYear.clientId },
    select: { statesWithEmployees: true },
  });
  if (!profile) return;

  const existingStates = Array.isArray(profile.statesWithEmployees)
    ? (profile.statesWithEmployees as string[])
    : [];
  const merged = Array.from(new Set([...existingStates, ...derivedStates]));
  if (merged.length === existingStates.length) return;

  await tx.clientProfile.update({
    where: { clientId: planYear.clientId },
    data: { statesWithEmployees: merged },
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
