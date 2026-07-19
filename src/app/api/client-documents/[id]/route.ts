import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteStoredFile, readStoredFile } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const document = await prisma.clientDocument.findUnique({ where: { id } });
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const buffer = await readStoredFile(document.filePath);
  const filename = document.originalFilename.replace(/["\r\n]/g, "_");
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": document.mediaType,
      "Content-Length": String(document.sizeBytes),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const document = await prisma.clientDocument.findUnique({
    where: { id },
    include: { client: { select: { archivedAt: true } } },
  });
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (document.client.archivedAt) {
    return NextResponse.json(
      { error: "Restore this client before deleting documents" },
      { status: 409 }
    );
  }

  await prisma.clientDocument.delete({ where: { id } });
  await deleteStoredFile(document.filePath);
  return NextResponse.json({ ok: true });
}
