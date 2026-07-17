import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  addCurrencyAmounts,
  policyLineSchema,
  ratePeriodSchema,
} from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ planYearId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planYearId } = await params;
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

  const body = await request.json();
  const parsed = policyLineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const policyLine = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${planYearId}, 0))`;
    const existingRatePeriod = await tx.policyLine.findFirst({
      where: { planYearId },
      select: { ratePeriod: true },
    });
    if (existingRatePeriod && existingRatePeriod.ratePeriod !== parsed.data.ratePeriod) {
      return null;
    }

    return tx.policyLine.create({
      data: {
        planYearId,
        ...parsed.data,
        totalPremium: addCurrencyAmounts(
          parsed.data.employeeCost,
          parsed.data.employerCost
        ),
      },
    });
  });

  if (!policyLine) {
    return NextResponse.json(
      { error: "All policy rates in a plan year must use the same rate period" },
      { status: 400 }
    );
  }

  return NextResponse.json({ id: policyLine.id });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ planYearId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planYearId } = await params;
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

  const body = await request.json();
  const parsed = ratePeriodSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${planYearId}, 0))`;
    return tx.policyLine.updateMany({
      where: { planYearId },
      data: { ratePeriod: parsed.data.ratePeriod },
    });
  });

  return NextResponse.json({ updated: result.count });
}
