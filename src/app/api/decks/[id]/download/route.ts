import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readStoredFile } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deck = await prisma.deck.findUnique({
    where: { id },
    include: { planYear: { include: { client: true } } },
  });
  if (!deck || !deck.filePath || deck.status !== "ready") {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const buffer = await readStoredFile(deck.filePath);
  const filename = `${deck.planYear.client.name.replace(/[^a-zA-Z0-9]+/g, "-")}-${deck.planYear.label.replace(/[^a-zA-Z0-9]+/g, "-")}.pptx`;

  // Buffer is a valid Response body at runtime (Node's fetch/undici accepts it),
  // but its ArrayBufferLike backing type doesn't structurally satisfy BodyInit.
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
