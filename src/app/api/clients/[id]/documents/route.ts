import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { clientDocumentCategorySchema } from "@/lib/client-onboarding";
import { prisma } from "@/lib/prisma";
import { deleteStoredFile, saveFile } from "@/lib/storage";
import { detectClientDocumentType } from "@/lib/uploads";

const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

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
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (client.archivedAt) {
    return NextResponse.json(
      { error: "Restore this client before uploading documents" },
      { status: 409 }
    );
  }

  const formData = await request.formData();
  const category = clientDocumentCategorySchema.safeParse(formData.get("category"));
  if (!category.success) {
    return NextResponse.json({ error: "Choose a valid document category" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a document to upload" }, { status: 400 });
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: "Documents must be 25MB or smaller" }, { status: 400 });
  }
  if (file.name.length > 255) {
    return NextResponse.json({ error: "Document filename is too long" }, { status: 400 });
  }

  const planYearIdValue = formData.get("planYearId");
  const planYearId = typeof planYearIdValue === "string" && planYearIdValue ? planYearIdValue : null;
  if (planYearId) {
    const planYear = await prisma.planYear.findFirst({
      where: { id: planYearId, clientId },
      select: { id: true },
    });
    if (!planYear) {
      return NextResponse.json({ error: "Plan year does not belong to this client" }, { status: 400 });
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectClientDocumentType(file.name, buffer);
  if (!detected) {
    return NextResponse.json(
      { error: "Upload a valid PDF, Excel, Word, PowerPoint, CSV, or text file" },
      { status: 400 }
    );
  }

  const filePath = await saveFile("documents", file.name, buffer);
  try {
    const document = await prisma.clientDocument.create({
      data: {
        clientId,
        planYearId,
        category: category.data,
        originalFilename: file.name,
        filePath,
        mediaType: detected.mediaType,
        sizeBytes: file.size,
        uploadedById: session.user.id,
      },
      include: {
        uploadedBy: { select: { name: true } },
        planYear: { select: { label: true } },
      },
    });
    return NextResponse.json({
      id: document.id,
      category: document.category,
      originalFilename: document.originalFilename,
      sizeBytes: document.sizeBytes,
      uploadedAt: document.uploadedAt.toISOString(),
      uploadedByName: document.uploadedBy?.name ?? null,
      planYearLabel: document.planYear?.label ?? null,
    });
  } catch (error) {
    await deleteStoredFile(filePath);
    throw error;
  }
}
