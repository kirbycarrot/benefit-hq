import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteLogoForUrl,
  deleteStoredFile,
  saveLogo,
  storedLogoPathFromUrl,
} from "@/lib/storage";
import { detectLogoType } from "@/lib/uploads";
import { clientSchema } from "@/lib/validation";
import { clientDeletionNameMatches } from "@/lib/clients";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (existing.archivedAt) {
    return NextResponse.json(
      { error: "Restore this client before editing its details" },
      { status: 409 }
    );
  }

  const formData = await request.formData();
  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  let logoPath: string | undefined;
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: "Logo must be under 5MB" }, { status: 400 });
    }
    const buffer = Buffer.from(await logo.arrayBuffer());
    const logoType = detectLogoType(buffer);
    if (!logoType) {
      return NextResponse.json(
        { error: "Logo must be a valid PNG, JPEG, or WebP image" },
        { status: 400 }
      );
    }
    logoPath = await saveLogo(logoType.extension, buffer);
  }

  let client;
  try {
    client = await prisma.client.update({
      where: { id },
      data: {
        name: parsed.data.name,
        primaryColor: parsed.data.primaryColor,
        secondaryColor: parsed.data.secondaryColor,
        ...(logoPath ? { logoPath } : {}),
      },
    });
  } catch (error) {
    const storedLogo = storedLogoPathFromUrl(logoPath);
    if (storedLogo) await deleteStoredFile(storedLogo);
    throw error;
  }

  if (logoPath) {
    await deleteLogoForUrl(existing.logoPath);
  }

  return NextResponse.json({ id: client.id });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      logoPath: true,
      planYears: { select: { decks: { select: { filePath: true } } } },
    },
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  let confirmationName: unknown;
  try {
    confirmationName = (await request.json())?.confirmationName;
  } catch {
    return NextResponse.json({ error: "Client name confirmation is required" }, { status: 400 });
  }

  if (!clientDeletionNameMatches(confirmationName, client.name)) {
    return NextResponse.json(
      { error: `Type ${client.name} to confirm permanent deletion` },
      { status: 400 }
    );
  }

  const deckPaths = client.planYears.flatMap((planYear) =>
    planYear.decks.flatMap((deck) => (deck.filePath ? [deck.filePath] : []))
  );

  await prisma.client.delete({ where: { id: client.id } });

  const cleanupResults = await Promise.allSettled([
    deleteLogoForUrl(client.logoPath),
    ...deckPaths.map((filePath) => deleteStoredFile(filePath)),
  ]);
  if (cleanupResults.some((result) => result.status === "rejected")) {
    console.error("One or more stored assets could not be removed for a deleted client");
  }

  return NextResponse.json({ ok: true });
}
