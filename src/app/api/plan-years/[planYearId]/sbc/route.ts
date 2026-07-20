import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteStoredFile, saveFile } from "@/lib/storage";
import { detectClientDocumentType } from "@/lib/uploads";
import { parseSbcDocument } from "@/lib/sbc/parse";

const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

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
    include: { client: { select: { id: true, archivedAt: true } } },
  });
  if (!planYear) {
    return NextResponse.json({ error: "Plan year not found" }, { status: 404 });
  }
  if (planYear.client.archivedAt) {
    return NextResponse.json(
      { error: "Restore this client before uploading documents" },
      { status: 409 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose an SBC file to upload" }, { status: 400 });
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: "Documents must be 25MB or smaller" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectClientDocumentType(file.name, buffer);
  if (!detected || detected.extension !== "pdf") {
    return NextResponse.json({ error: "Upload the SBC as a PDF file" }, { status: 400 });
  }

  let extractedFields;
  try {
    extractedFields = await parseSbcDocument(buffer);
  } catch (error) {
    console.error("SBC parse failed", error);
    return NextResponse.json(
      { error: "Unable to read this PDF. It may be scanned/image-only or corrupted." },
      { status: 400 }
    );
  }

  const filePath = await saveFile("documents", file.name, buffer);
  try {
    const document = await prisma.clientDocument.create({
      data: {
        clientId: planYear.client.id,
        planYearId,
        category: "sbc",
        originalFilename: file.name,
        filePath,
        mediaType: detected.mediaType,
        sizeBytes: file.size,
        uploadedById: session.user.id,
        extractedFields: extractedFields as unknown as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({
      id: document.id,
      originalFilename: document.originalFilename,
      uploadedAt: document.uploadedAt.toISOString(),
      extractedFields,
    });
  } catch (error) {
    await deleteStoredFile(filePath);
    throw error;
  }
}
