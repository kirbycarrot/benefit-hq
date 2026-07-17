import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ planYearId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planYearId } = await params;
  const body = await request.json();

  if (typeof body?.selections !== "object" || body.selections === null) {
    return NextResponse.json({ error: "Invalid selections payload" }, { status: 400 });
  }

  const deckConfig = await prisma.deckConfig.upsert({
    where: { planYearId },
    update: { selections: body.selections },
    create: { planYearId, selections: body.selections },
  });

  return NextResponse.json({ id: deckConfig.id });
}
