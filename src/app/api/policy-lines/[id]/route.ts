import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const policyLine = await prisma.policyLine.findUnique({
    where: { id },
    select: { planYear: { select: { client: { select: { archivedAt: true } } } } },
  });
  if (!policyLine) {
    return NextResponse.json({ error: "Policy line not found" }, { status: 404 });
  }
  if (policyLine.planYear.client.archivedAt) {
    return NextResponse.json(
      { error: "Restore this client before changing policy details" },
      { status: 409 }
    );
  }

  await prisma.policyLine.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
