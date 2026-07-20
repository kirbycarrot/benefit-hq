import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import {
  importClientExportPayload,
  parseClientExportPayload,
  CLIENT_EXPORT_FORMAT,
  CLIENT_EXPORT_VERSION,
} from "@/lib/client-transfer";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a client export file" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return NextResponse.json({ error: "This file isn't a valid client export" }, { status: 400 });
  }

  if (
    typeof raw !== "object" ||
    raw === null ||
    (raw as { format?: unknown }).format !== CLIENT_EXPORT_FORMAT
  ) {
    return NextResponse.json({ error: "This file isn't a valid client export" }, { status: 400 });
  }
  if ((raw as { version?: unknown }).version !== CLIENT_EXPORT_VERSION) {
    return NextResponse.json(
      { error: "This export was created by an incompatible version of the import/export feature" },
      { status: 400 }
    );
  }

  let payload;
  try {
    payload = parseClientExportPayload(raw);
  } catch (error) {
    const message = error instanceof ZodError ? (error.issues[0]?.message ?? "Invalid export file") : "Invalid export file";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const result = await importClientExportPayload(payload, { createdById: session.user.id });

  return NextResponse.json({ id: result.clientId, warnings: result.warnings });
}
