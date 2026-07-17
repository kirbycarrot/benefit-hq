import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deckSelectionsSchema } from "@/lib/validation";

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
      { error: "Restore this client before changing deck settings" },
      { status: 409 }
    );
  }

  const body = await request.json();
  const parsed = deckSelectionsSchema.safeParse(body?.selections);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid selections payload" }, { status: 400 });
  }

  const deckConfig = await prisma.deckConfig.upsert({
    where: { planYearId },
    update: { selections: parsed.data },
    create: { planYearId, selections: parsed.data },
  });

  return NextResponse.json({ id: deckConfig.id });
}
