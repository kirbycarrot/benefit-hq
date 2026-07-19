import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { acquireAdvisoryTransactionLock } from "@/lib/advisory-lock";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ planYearId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planYearId } = await params;
  const current = await prisma.planYear.findUnique({
    where: { id: planYearId },
    include: { client: { select: { archivedAt: true } } },
  });
  if (!current) {
    return NextResponse.json({ error: "Plan year not found" }, { status: 404 });
  }
  if (current.client.archivedAt) {
    return NextResponse.json(
      { error: "Restore this client before changing policy details" },
      { status: 409 }
    );
  }

  const prior = await prisma.planYear.findFirst({
    where: {
      clientId: current.clientId,
      effectiveDate: { lt: current.effectiveDate },
      benefitPrograms: { some: {} },
    },
    orderBy: { effectiveDate: "desc" },
    include: {
      benefitPrograms: {
        orderBy: { sortOrder: "asc" },
        include: {
          plans: {
            orderBy: { sortOrder: "asc" },
            include: {
              rates: { orderBy: { sortOrder: "asc" } },
              aliases: true,
            },
          },
        },
      },
      policyLines: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!prior) {
    return NextResponse.json(
      { error: "No earlier plan year with policy details was found" },
      { status: 404 }
    );
  }

  const copied = await prisma.$transaction(async (tx) => {
    await acquireAdvisoryTransactionLock(tx, planYearId);
    const existingCount = await tx.benefitProgram.count({ where: { planYearId } });
    if (existingCount > 0) return null;

    let planCount = 0;
    for (const program of prior.benefitPrograms) {
      const createdProgram = await tx.benefitProgram.create({
        data: {
          planYearId,
          benefitType: program.benefitType,
          offered: program.offered,
          sortOrder: program.sortOrder,
        },
      });

      for (const plan of program.plans) {
        await tx.benefitPlan.create({
          data: {
            benefitProgramId: createdProgram.id,
            name: plan.name,
            subtype: plan.subtype,
            offered: plan.offered,
            details: plan.details as Prisma.InputJsonValue,
            detailSchemaVersion: plan.detailSchemaVersion,
            renewedFromPlanId: plan.id,
            sortOrder: plan.sortOrder,
            rates: {
              create: plan.rates.map((rate) => ({
                tier: rate.tier,
                grossPremium: rate.grossPremium,
                employeeContribution: rate.employeeContribution,
                employerContribution: rate.employerContribution,
                ratePeriod: rate.ratePeriod,
                enrollmentOverride: null,
                sortOrder: rate.sortOrder,
              })),
            },
            aliases: {
              create: plan.aliases.map((alias) => ({
                alias: alias.alias,
                normalizedAlias: alias.normalizedAlias,
              })),
            },
          },
        });
        planCount++;
      }
    }

    if (prior.policyLines.length > 0) {
      await tx.policyLine.createMany({
        data: prior.policyLines.map((line) => ({
          planYearId,
          coverageType: line.coverageType,
          planName: line.planName,
          tier: line.tier,
          employeeCost: line.employeeCost,
          employerCost: line.employerCost,
          totalPremium: line.totalPremium,
          ratePeriod: line.ratePeriod,
          sortOrder: line.sortOrder,
        })),
      });
    }

    return { programs: prior.benefitPrograms.length, plans: planCount, priorLabel: prior.label };
  });

  if (!copied) {
    return NextResponse.json(
      { error: "Policy details already exist for this plan year" },
      { status: 409 }
    );
  }

  return NextResponse.json(copied);
}
