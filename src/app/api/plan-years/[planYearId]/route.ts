import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { planYearDeletionLabelMatches } from "@/lib/clients";
import { prisma } from "@/lib/prisma";
import { deleteStoredFile } from "@/lib/storage";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ planYearId: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { planYearId } = await params;
  const planYear = await prisma.planYear.findUnique({
    where: { id: planYearId },
    select: {
      id: true,
      label: true,
      decks: { select: { filePath: true } },
      documents: { select: { filePath: true } },
    },
  });
  if (!planYear) {
    return NextResponse.json({ error: "Plan year not found" }, { status: 404 });
  }

  let confirmationLabel: unknown;
  try {
    confirmationLabel = (await request.json())?.confirmationLabel;
  } catch {
    return NextResponse.json({ error: "Plan year label confirmation is required" }, { status: 400 });
  }

  if (!planYearDeletionLabelMatches(confirmationLabel, planYear.label)) {
    return NextResponse.json(
      { error: `Type ${planYear.label} to confirm permanent deletion` },
      { status: 400 }
    );
  }

  await prisma.planYear.delete({ where: { id: planYear.id } });

  const filePaths = [
    ...planYear.decks.flatMap((deck) => (deck.filePath ? [deck.filePath] : [])),
    ...planYear.documents.map((document) => document.filePath),
  ];
  const cleanupResults = await Promise.allSettled(
    filePaths.map((filePath) => deleteStoredFile(filePath))
  );
  if (cleanupResults.some((result) => result.status === "rejected")) {
    console.error("One or more stored assets could not be removed for a deleted plan year");
  }

  return NextResponse.json({ ok: true });
}
