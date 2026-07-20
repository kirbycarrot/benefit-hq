import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const profileSchema = z.object({
  datasetId: z.string().min(1),
  primaryCohortId: z.string().min(1),
});

export async function PUT(
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
      { error: "Restore this client before changing benchmark settings" },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid benchmark selection" }, { status: 400 });
  }

  const cohort = await prisma.benchmarkCohort.findFirst({
    where: {
      id: parsed.data.primaryCohortId,
      datasetId: parsed.data.datasetId,
      dataset: { status: { in: ["active", "retired"] } },
    },
  });
  if (!cohort) {
    return NextResponse.json(
      { error: "That Mercer peer group is no longer available" },
      { status: 409 }
    );
  }

  const profile = await prisma.planYearBenchmarkProfile.upsert({
    where: { planYearId },
    update: {
      datasetId: parsed.data.datasetId,
      primaryCohortId: parsed.data.primaryCohortId,
    },
    create: {
      planYearId,
      datasetId: parsed.data.datasetId,
      primaryCohortId: parsed.data.primaryCohortId,
    },
  });

  return NextResponse.json({ id: profile.id });
}
