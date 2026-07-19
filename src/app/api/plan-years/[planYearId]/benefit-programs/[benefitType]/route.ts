import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { acquireAdvisoryTransactionLock } from "@/lib/advisory-lock";
import {
  BENEFIT_META,
  benefitProgramInputSchema,
  isRateBenefitType,
  normalizePolicyName,
} from "@/lib/policy-details";
import { prisma } from "@/lib/prisma";

const INVALID_PLAN_ID = "INVALID_POLICY_PLAN_ID";
const INVALID_RENEWAL_PLAN_ID = "INVALID_RENEWAL_POLICY_PLAN_ID";

export async function PUT(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ planYearId: string; benefitType: string }>;
  }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planYearId, benefitType } = await params;
  const planYear = await prisma.planYear.findUnique({
    where: { id: planYearId },
    include: { client: { select: { archivedAt: true } } },
  });
  if (!planYear) {
    return NextResponse.json({ error: "Plan year not found" }, { status: 404 });
  }
  if (planYear.client.archivedAt) {
    return NextResponse.json(
      { error: "Restore this client before changing policy details" },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = benefitProgramInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid policy details" },
      { status: 400 }
    );
  }
  if (parsed.data.benefitType !== benefitType) {
    return NextResponse.json(
      { error: "Benefit type does not match the request path" },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(tx, planYearId);

      const renewalPlanIds = Array.from(
        new Set(
          parsed.data.plans
            .map((plan) => plan.renewedFromPlanId)
            .filter((id): id is string => Boolean(id))
        )
      );
      if (renewalPlanIds.length > 0) {
        const eligibleRenewalPlans = await tx.benefitPlan.count({
          where: {
            id: { in: renewalPlanIds },
            benefitProgram: {
              planYear: {
                clientId: planYear.clientId,
                effectiveDate: { lt: planYear.effectiveDate },
              },
            },
          },
        });
        if (eligibleRenewalPlans !== renewalPlanIds.length) {
          throw new Error(INVALID_RENEWAL_PLAN_ID);
        }
      }

      const program = await tx.benefitProgram.upsert({
        where: {
          planYearId_benefitType: {
            planYearId,
            benefitType: parsed.data.benefitType,
          },
        },
        update: {
          offered: parsed.data.offered,
          sortOrder: BENEFIT_META[parsed.data.benefitType].sortOrder,
        },
        create: {
          planYearId,
          benefitType: parsed.data.benefitType,
          offered: parsed.data.offered,
          sortOrder: BENEFIT_META[parsed.data.benefitType].sortOrder,
        },
      });

      const suppliedIds = parsed.data.plans
        .map((plan) => plan.id)
        .filter((id): id is string => Boolean(id));
      if (suppliedIds.length > 0) {
        const ownedPlans = await tx.benefitPlan.findMany({
          where: { id: { in: suppliedIds }, benefitProgramId: program.id },
          select: { id: true },
        });
        if (ownedPlans.length !== suppliedIds.length) {
          throw new Error(INVALID_PLAN_ID);
        }
      }

      const savedPlanIds: string[] = [];
      for (const planInput of parsed.data.plans) {
        const planData = {
          name: planInput.name,
          subtype: planInput.subtype,
          offered: planInput.offered,
          details: planInput.details as Prisma.InputJsonValue,
          detailSchemaVersion: planInput.detailSchemaVersion,
          renewedFromPlanId: planInput.renewedFromPlanId ?? null,
          sortOrder: planInput.sortOrder,
        };

        const plan = planInput.id
          ? await tx.benefitPlan.update({
              where: { id: planInput.id },
              data: planData,
            })
          : await tx.benefitPlan.create({
              data: { benefitProgramId: program.id, ...planData },
            });
        savedPlanIds.push(plan.id);

        await tx.planRate.deleteMany({ where: { benefitPlanId: plan.id } });
        if (planInput.rates.length > 0) {
          await tx.planRate.createMany({
            data: planInput.rates.map((rate) => {
              const grossPremium = roundCurrency(rate.grossPremium);
              const employeeContribution = roundCurrency(rate.employeeContribution);
              return {
                benefitPlanId: plan.id,
                tier: rate.tier,
                grossPremium,
                employeeContribution,
                employerContribution: subtractCurrency(
                  grossPremium,
                  employeeContribution
                ),
                ratePeriod: rate.ratePeriod,
                enrollmentOverride: rate.enrollmentOverride ?? null,
                sortOrder: rate.sortOrder,
              };
            }),
          });
        }

        await tx.planAlias.deleteMany({ where: { benefitPlanId: plan.id } });
        const aliases = Array.from(new Set([planInput.name, ...planInput.aliases]))
          .map((alias) => ({ alias: alias.trim(), normalized: normalizePolicyName(alias) }))
          .filter(
            (alias, index, values) =>
              alias.normalized.length > 0 &&
              values.findIndex((candidate) => candidate.normalized === alias.normalized) === index
          );
        if (aliases.length > 0) {
          await tx.planAlias.createMany({
            data: aliases.map((alias) => ({
              benefitPlanId: plan.id,
              alias: alias.alias,
              normalizedAlias: alias.normalized,
            })),
          });
        }
      }

      await tx.benefitPlan.deleteMany({
        where: {
          benefitProgramId: program.id,
          ...(savedPlanIds.length > 0 ? { id: { notIn: savedPlanIds } } : {}),
        },
      });

      // Keep the legacy rate rows synchronized so reverting to the previous
      // application build remains operational during the transition window.
      if (isRateBenefitType(parsed.data.benefitType)) {
        await tx.policyLine.deleteMany({
          where: { planYearId, coverageType: parsed.data.benefitType },
        });
        if (parsed.data.offered) {
          const legacyRates = parsed.data.plans
            .filter((plan) => plan.offered)
            .flatMap((plan) =>
              plan.rates.map((rate) => {
                const grossPremium = roundCurrency(rate.grossPremium);
                const employeeContribution = roundCurrency(rate.employeeContribution);
                return {
                  planYearId,
                  coverageType: parsed.data.benefitType,
                  planName: plan.name,
                  tier: rate.tier,
                  employeeCost: employeeContribution,
                  employerCost: subtractCurrency(grossPremium, employeeContribution),
                  totalPremium: grossPremium,
                  ratePeriod: rate.ratePeriod,
                  sortOrder: plan.sortOrder * 100 + rate.sortOrder,
                };
              })
            );
          if (legacyRates.length > 0) {
            await tx.policyLine.createMany({ data: legacyRates });
          }
        }
      }

      return { id: program.id, savedPlans: savedPlanIds.length };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === INVALID_PLAN_ID || error.message === INVALID_RENEWAL_PLAN_ID)
    ) {
      return NextResponse.json(
        { error: "One of these plans is stale or does not belong to this renewal" },
        { status: 409 }
      );
    }
    throw error;
  }
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function subtractCurrency(total: number, employee: number): number {
  return (Math.round(total * 100) - Math.round(employee * 100)) / 100;
}
