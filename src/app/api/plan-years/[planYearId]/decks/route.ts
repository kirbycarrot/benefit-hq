import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateDeckBuffer } from "@/lib/deck/generate";
import { deleteStoredFile, saveFile } from "@/lib/storage";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ planYearId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planYearId } = await params;
  const planYear = await prisma.planYear.findUnique({
    where: { id: planYearId },
    include: { client: true, _count: { select: { employees: true } } },
  });
  if (!planYear) {
    return NextResponse.json({ error: "Plan year not found" }, { status: 404 });
  }
  if (planYear._count.employees === 0) {
    return NextResponse.json(
      { error: "Upload a census before generating a deck" },
      { status: 400 }
    );
  }

  const deck = await prisma.deck.create({
    data: { planYearId, status: "generating" },
  });

  let filePath: string | null = null;
  try {
    const buffer = await generateDeckBuffer(planYearId);
    const filename = `${planYear.client.name.replace(/[^a-zA-Z0-9]+/g, "-")}-${planYear.label.replace(/[^a-zA-Z0-9]+/g, "-")}.pptx`;
    filePath = await saveFile("decks", filename, buffer);

    const updated = await prisma.deck.update({
      where: { id: deck.id },
      data: { status: "ready", filePath },
    });

    return NextResponse.json({ id: updated.id });
  } catch (error) {
    if (filePath) await deleteStoredFile(filePath);
    await prisma.deck.update({ where: { id: deck.id }, data: { status: "failed" } });
    console.error("Deck generation failed", error);
    return NextResponse.json({ error: "Deck generation failed" }, { status: 500 });
  }
}
