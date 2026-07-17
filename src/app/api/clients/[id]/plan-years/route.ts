import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { planYearSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clientId } = await params;
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = planYearSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const planYear = await prisma.planYear.create({
      data: {
        clientId,
        label: parsed.data.label,
        effectiveDate: parsed.data.effectiveDate,
      },
    });
    return NextResponse.json({ id: planYear.id });
  } catch {
    return NextResponse.json(
      { error: "A plan year with that label already exists for this client" },
      { status: 409 }
    );
  }
}
